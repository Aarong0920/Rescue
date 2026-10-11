import { createHash } from "node:crypto";
import { extractText, getDocumentProxy, getMeta } from "unpdf";
import { authenticate, failure } from "@/lib/server";
import {
  MAX_UPLOAD_BYTES,
  ScannedPdfError,
  chapterTitle,
  chunkChapter,
  chunksForPage,
  selectWork,
  type StoredChunk,
} from "@/lib/chapters";
import { recognizePage } from "@/lib/ocr";

export const runtime = "nodejs";
export const maxDuration = 60;

type Db = Awaited<ReturnType<typeof authenticate>>["db"];

function migrationNeeded(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";
  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    error?.code === "PGRST205" ||
    /schema cache|does not exist|chapter_jobs|file_hash/i.test(message)
  );
}

function hashBytes(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function saveChunks(
  db: Db,
  resourceId: string,
  ownerId: string,
  chunks: StoredChunk[],
  startIndex: number,
) {
  const rows = chunks.map((chunk, index) => ({
    ...chunk,
    chunk_index: startIndex + index,
    resource_id: resourceId,
    owner_id: ownerId,
  }));
  for (let index = 0; index < rows.length; index += 20) {
    const inserted = await db.from("chapter_chunks").insert(rows.slice(index, index + 20));
    if (inserted.error) {
      await db.from("chapter_chunks").delete().eq("resource_id", resourceId);
      throw new Error(
        migrationNeeded(inserted.error)
          ? "Chapter storage is not set up yet. Run supabase/chapter-pdf.sql once in the Supabase SQL editor, then try again."
          : "The chapter could not be saved. Nothing was shared.",
      );
    }
  }
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
      return Response.json({ error: "Choose a saved PDF." }, { status: 400 });
    const { data: resource, error } = await db
      .from("resources")
      .select("id,title,file_path,visibility,owner_id")
      .eq("id", body.resourceId)
      .single();
    if (error || !resource)
      return Response.json({ error: "Resource unavailable." }, { status: 404 });
    if (
      resource.visibility !== "private" ||
      resource.owner_id !== user.id ||
      !resource.file_path?.startsWith(`${user.id}/`) ||
      resource.file_path.includes("..")
    )
      return Response.json(
        { error: "Only your private files can be read." },
        { status: 403 },
      );
    if (!resource.file_path.toLowerCase().endsWith(".pdf"))
      return Response.json({ error: "Choose a private PDF." }, { status: 400 });
    const downloaded = await db.storage
      .from("private-materials")
      .download(resource.file_path);
    if (downloaded.error || !downloaded.data)
      return Response.json(
        { error: "The private PDF could not be read. Upload it again." },
        { status: 404 },
      );
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD_BYTES)
      return Response.json(
        { error: "Choose a file smaller than 50 MB." },
        { status: 413 },
      );
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
      return Response.json(
        { error: "That file is not a readable PDF." },
        { status: 400 },
      );
    const fileHash = hashBytes(bytes);
    const existing = await db
      .from("chapter_documents")
      .select("page_count,chapter_title,extracted_characters,file_hash")
      .eq("resource_id", resource.id)
      .maybeSingle();
    if (existing.error && migrationNeeded(existing.error))
      return legacyExtract(db, user.id, resource, bytes);
    if (
      existing.data?.file_hash &&
      existing.data.file_hash === fileHash &&
      !body.retry
    ) {
      return Response.json({
        status: "ready",
        unchanged: true,
        pageCount: existing.data.page_count,
        characters: existing.data.extracted_characters,
        title: existing.data.chapter_title,
      });
    }
    const jobResult = await db
      .from("chapter_jobs")
      .select("status,page_count,next_page,file_hash,error,updated_at")
      .eq("resource_id", resource.id)
      .maybeSingle();
    if (jobResult.error && migrationNeeded(jobResult.error))
      return legacyExtract(db, user.id, resource, bytes);
    if (jobResult.error)
      return Response.json(
        { error: "Chapter processing could not be checked." },
        { status: 503 },
      );
    const job = jobResult.data;
    const restart = !job || job.file_hash !== fileHash;
    if (
      job &&
      !restart &&
      job.status === "processing" &&
      Date.now() - Date.parse(job.updated_at) < 15000 &&
      !body.retry
    ) {
      return Response.json({
        status: "processing",
        pageCount: job.page_count,
        nextPage: job.next_page,
        busy: true,
      });
    }
    if (restart) {
      await db.from("chapter_chunks").delete().eq("resource_id", resource.id);
      await db.from("chapter_documents").delete().eq("resource_id", resource.id);
    }
    const pdf = await getDocumentProxy(bytes);
    try {
      const extracted = await extractText(pdf, { mergePages: false });
      const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
      let nextPage = restart ? 1 : Math.max(job?.next_page ?? 1, 1);
      if (job?.status === "failed" && body.retry && job.file_hash === fileHash)
        nextPage = Math.max(job.next_page, 1);
      const work = selectWork(pages, nextPage);
      if (work.done || !pages.length) {
        return await finishChapter(db, user.id, resource, pages.length, fileHash);
      }
      await db.from("chapter_jobs").upsert({
        resource_id: resource.id,
        owner_id: user.id,
        status: "processing",
        page_count: pages.length,
        next_page: work.from,
        file_hash: fileHash,
        error: "",
        updated_at: new Date().toISOString(),
      });
      const produced: StoredChunk[] = [];
      for (let page = work.from; page <= work.to; page += 1) {
        const text = work.ocr
          ? await recognizePage(pdf, page)
          : pages[page - 1] ?? "";
        produced.push(...chunksForPage(text, page));
      }
      const latest = await db
        .from("chapter_chunks")
        .select("chunk_index")
        .eq("resource_id", resource.id)
        .order("chunk_index", { ascending: false })
        .limit(1);
      const startIndex = latest.data?.[0]?.chunk_index;
      await saveChunks(
        db,
        resource.id,
        user.id,
        produced,
        startIndex === undefined ? 0 : startIndex + 1,
      );
      const following = work.to + 1;
      const finished = following > pages.length;
      if (!finished) {
        await db.from("chapter_jobs").upsert({
          resource_id: resource.id,
          owner_id: user.id,
          status: "processing",
          page_count: pages.length,
          next_page: following,
          file_hash: fileHash,
          error: "",
          updated_at: new Date().toISOString(),
        });
        return Response.json({
          status: "processing",
          pageCount: pages.length,
          nextPage: following,
          ocr: work.ocr,
        });
      }
      return await finishChapter(db, user.id, resource, pages.length, fileHash, pdf);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "This PDF could not be read. Use a PDF that is not password-protected.";
      await db.from("chapter_jobs").upsert({
        resource_id: resource.id,
        owner_id: user.id,
        status: "failed",
        page_count: job?.page_count ?? 0,
        next_page: job?.next_page ?? 1,
        file_hash: fileHash,
        error: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      });
      return Response.json({ status: "failed", error: message }, { status: 422 });
    } finally {
      const closable = pdf as { destroy?: () => Promise<void> | void };
      await closable.destroy?.();
    }
  } catch (error) {
    return failure(error);
  }
}

async function finishChapter(
  db: Db,
  ownerId: string,
  resource: { id: string; title: string },
  pageCount: number,
  fileHash: string,
  pdf?: Awaited<ReturnType<typeof getDocumentProxy>>,
) {
  const chunks = await db
    .from("chapter_chunks")
    .select("content")
    .eq("resource_id", resource.id);
  if (chunks.error || !chunks.data?.length)
    throw new ScannedPdfError();
  let metaTitle = "";
  if (pdf) {
    try {
      const meta = await getMeta(pdf);
      if (typeof meta.info?.Title === "string") metaTitle = meta.info.Title;
    } catch {
      metaTitle = "";
    }
  }
  const title = chapterTitle(metaTitle, resource.title);
  const characters = chunks.data.reduce(
    (total, chunk) => total + chunk.content.length,
    0,
  );
  const saved = await db.from("chapter_documents").upsert({
    resource_id: resource.id,
    owner_id: ownerId,
    page_count: Math.max(pageCount, 1),
    extracted_characters: characters,
    chapter_title: title,
    file_hash: fileHash,
  });
  if (saved.error) throw new Error("The chapter summary could not be saved.");
  await db.from("chapter_jobs").upsert({
    resource_id: resource.id,
    owner_id: ownerId,
    status: "ready",
    page_count: pageCount,
    next_page: pageCount + 1,
    file_hash: fileHash,
    error: "",
    updated_at: new Date().toISOString(),
  });
  return Response.json({
    status: "ready",
    unchanged: false,
    pageCount,
    chunks: chunks.data.length,
    characters,
    title,
  });
}

async function legacyExtract(
  db: Db,
  ownerId: string,
  resource: { id: string; title: string },
  bytes: Uint8Array,
) {
  const pdf = await getDocumentProxy(bytes);
  let pages: string[] = [];
  let metaTitle = "";
  try {
    const extracted = await extractText(pdf, { mergePages: false });
    pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
    try {
      const meta = await getMeta(pdf);
      if (typeof meta.info?.Title === "string") metaTitle = meta.info.Title;
    } catch {
      metaTitle = "";
    }
  } catch {
    return Response.json(
      {
        error:
          "This PDF could not be read. Use a PDF that is not password-protected. Scanned pages need supabase/phase1.sql before OCR can run.",
      },
      { status: 422 },
    );
  } finally {
    const closable = pdf as { destroy?: () => Promise<void> | void };
    await closable.destroy?.();
  }
  let chunks;
  try {
    chunks = chunkChapter(pages);
  } catch (error) {
    if (error instanceof ScannedPdfError)
      return Response.json(
        {
          error:
            "This PDF looks scanned or image-only. Run supabase/phase1.sql once in the Supabase SQL editor, then retry. RESCUE will read scanned pages after that.",
        },
        { status: 422 },
      );
    throw error;
  }
  const title = chapterTitle(metaTitle, resource.title);
  const characters = chunks.reduce((total, chunk) => total + chunk.content.length, 0);
  await db.from("chapter_chunks").delete().eq("resource_id", resource.id);
  await saveChunks(db, resource.id, ownerId, chunks, 0);
  const saved = await db.from("chapter_documents").upsert({
    resource_id: resource.id,
    owner_id: ownerId,
    page_count: pages.length,
    extracted_characters: characters,
    chapter_title: title,
  });
  if (saved.error) {
    await db.from("chapter_chunks").delete().eq("resource_id", resource.id);
    return Response.json(
      { error: "The chapter summary could not be saved." },
      { status: 500 },
    );
  }
  return Response.json({
    status: "ready",
    pageCount: pages.length,
    chunks: chunks.length,
    characters,
    title,
  });
}
