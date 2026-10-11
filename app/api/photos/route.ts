import { createHash } from "node:crypto";
import OpenAI from "openai";
import { authenticate, failure } from "@/lib/server";
import { chunksForPage } from "@/lib/chapters";
import { recognizeImage } from "@/lib/ocr";
import { readingQuality } from "@/lib/photos";
import { transcribeStudyPhoto } from "@/lib/public-search";

export const runtime = "nodejs";
export const maxDuration = 60;

function migrationNeeded(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    /schema cache|does not exist|resource_pages/i.test(message)
  );
}

function imageKind(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg" as const;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "image/png" as const;
  return null;
}

export async function POST(request: Request) {
  try {
    const { db, user } = await authenticate(request);
    const raw = await request.text();
    if (raw.length > 2000)
      return Response.json({ error: "Request too large." }, { status: 413 });
    let body: { resourceId?: string; retry?: boolean };
    try {
      body = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Invalid JSON." }, { status: 400 });
    }
    if (!body.resourceId)
      return Response.json({ error: "Choose a saved photo set." }, { status: 400 });
    const { data: resource, error } = await db
      .from("resources")
      .select("id,title,visibility,owner_id")
      .eq("id", body.resourceId)
      .single();
    if (error || !resource)
      return Response.json({ error: "Resource unavailable." }, { status: 404 });
    if (resource.visibility !== "private" || resource.owner_id !== user.id)
      return Response.json({ error: "Only your private photos can be read." }, { status: 403 });
    const listed = await db
      .from("resource_pages")
      .select("id,page_index,storage_path")
      .eq("resource_id", resource.id)
      .order("page_index");
    if (listed.error && migrationNeeded(listed.error))
      return Response.json(
        {
          error:
            "Photo storage is not set up yet. Run supabase/photos.sql once in the Supabase SQL editor, then try again.",
        },
        { status: 503 },
      );
    if (listed.error || !listed.data?.length)
      return Response.json({ error: "No photos were found for this study set." }, { status: 404 });
    const pages = listed.data;
    const fileHash = createHash("sha256")
      .update(pages.map((page) => page.storage_path).join("\n"))
      .digest("hex");
    const jobResult = await db
      .from("chapter_jobs")
      .select("status,page_count,next_page,file_hash,updated_at")
      .eq("resource_id", resource.id)
      .maybeSingle();
    if (jobResult.error)
      return Response.json({ error: "Photo processing could not be checked." }, { status: 503 });
    const job = jobResult.data;
    if (
      job?.status === "ready" &&
      job.file_hash === fileHash &&
      !body.retry
    )
      return Response.json({
        status: "ready",
        unchanged: true,
        pageCount: pages.length,
        title: resource.title,
      });
    if (
      job &&
      job.file_hash === fileHash &&
      job.status === "processing" &&
      Date.now() - Date.parse(job.updated_at) < 15000 &&
      !body.retry
    )
      return Response.json({
        status: "processing",
        pageCount: pages.length,
        nextPage: job.next_page,
        busy: true,
      });
    const nextPage =
      body.retry || !job || job.file_hash !== fileHash
        ? body.retry && job?.file_hash === fileHash
          ? Math.max(job.next_page, 1)
          : 1
        : Math.max(job.next_page, 1);
    if (nextPage > pages.length) {
      await db.from("chapter_documents").upsert({
        resource_id: resource.id,
        owner_id: user.id,
        page_count: pages.length,
        extracted_characters: 1,
        chapter_title: resource.title,
        file_hash: fileHash,
      });
      await db.from("chapter_jobs").upsert({
        resource_id: resource.id,
        owner_id: user.id,
        status: "ready",
        page_count: pages.length,
        next_page: pages.length + 1,
        file_hash: fileHash,
        error: "",
        updated_at: new Date().toISOString(),
      });
      return Response.json({
        status: "ready",
        unchanged: false,
        pageCount: pages.length,
        title: resource.title,
      });
    }
    const page = pages[nextPage - 1];
    if (!page.storage_path.startsWith(`${user.id}/`) || page.storage_path.includes(".."))
      return Response.json({ error: "A photo path was not valid." }, { status: 403 });
    await db.from("chapter_jobs").upsert({
      resource_id: resource.id,
      owner_id: user.id,
      status: "processing",
      page_count: pages.length,
      next_page: nextPage,
      file_hash: fileHash,
      error: "",
      updated_at: new Date().toISOString(),
    });
    const downloaded = await db.storage.from("private-materials").download(page.storage_path);
    if (downloaded.error || !downloaded.data)
      return Response.json({ error: `Photo ${nextPage} could not be opened.` }, { status: 404 });
    const bytes = Buffer.from(await downloaded.data.arrayBuffer());
    const mime = imageKind(bytes);
    if (!mime)
      return Response.json(
        { error: `Photo ${nextPage} is not a JPEG or PNG. Export HEIC photos as JPEG in this browser.` },
        { status: 422 },
      );
    let recognized = await recognizeImage(bytes);
    let quality = readingQuality(recognized.text, recognized.confidence);
    if (quality.uncertain && process.env.OPENAI_API_KEY) {
      const quota = await db.rpc("consume_ai_quota");
      if (!quota.error && quota.data) {
        try {
          const client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 45000,
            maxRetries: 0,
          });
          const transcript = await transcribeStudyPhoto(client, bytes, mime);
          recognized = { text: transcript, confidence: /\[unclear\]/i.test(transcript) ? 40 : 90 };
          quality = readingQuality(recognized.text, recognized.confidence);
        } catch {
          quality = readingQuality(recognized.text, recognized.confidence);
        }
      }
    }
    const savedPage = await db.rpc("record_page_reading", {
      page_id: page.id,
      body: quality.text,
      is_uncertain: quality.uncertain,
      score: recognized.confidence,
    });
    if (savedPage.error)
      return Response.json({ error: "The recognized text could not be saved." }, { status: 503 });
    await db
      .from("chapter_chunks")
      .delete()
      .eq("resource_id", resource.id)
      .eq("page_start", nextPage);
    const chunks = chunksForPage(quality.text, nextPage);
    if (chunks.length) {
      const inserted = await db.from("chapter_chunks").insert(
        chunks.map((chunk, index) => ({
          ...chunk,
          chunk_index: (nextPage - 1) * 4 + index,
          resource_id: resource.id,
          owner_id: user.id,
        })),
      );
      if (inserted.error)
        return Response.json({ error: "The recognized text could not be stored." }, { status: 503 });
    }
    const following = nextPage + 1;
    await db.from("chapter_jobs").upsert({
      resource_id: resource.id,
      owner_id: user.id,
      status: following > pages.length ? "ready" : "processing",
      page_count: pages.length,
      next_page: following,
      file_hash: fileHash,
      error: "",
      updated_at: new Date().toISOString(),
    });
    if (following > pages.length) {
      const stored = await db.from("chapter_chunks").select("content").eq("resource_id", resource.id);
      const characters = (stored.data ?? []).reduce((total, chunk) => total + chunk.content.length, 0);
      await db.from("chapter_documents").upsert({
        resource_id: resource.id,
        owner_id: user.id,
        page_count: pages.length,
        extracted_characters: Math.max(characters, 1),
        chapter_title: resource.title,
        file_hash: fileHash,
      });
      return Response.json({
        status: "ready",
        unchanged: false,
        pageCount: pages.length,
        nextPage: following,
        title: resource.title,
      });
    }
    return Response.json({
      status: "processing",
      pageCount: pages.length,
      nextPage: following,
      ocr: true,
    });
  } catch (error) {
    return failure(error);
  }
}
