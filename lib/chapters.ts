export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const REVIEW_LABEL =
  "AI-generated study aid. Review the cited passage and page before you rely on it.";
const TARGET = 5000;
const HARD = 8000;
const GENERATION_BUDGET = 24000;

export type StoredChunk = {
  chunk_index: number;
  page_start: number;
  page_end: number;
  content: string;
};

export class ScannedPdfError extends Error {
  constructor() {
    super(
      "No readable text was found in this PDF.",
    );
    this.name = "ScannedPdfError";
  }
}

export function normalizeChapterText(text: string) {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim();
}

export function pageNeedsOcr(text: string) {
  return (text.match(/[A-Za-z]/g)?.length ?? 0) < 40;
}

export function selectWork(pages: string[], startPage: number, textLimit = 20) {
  const start = Math.min(Math.max(startPage, 1), pages.length + 1);
  let to = start - 1;
  let ocr = false;
  for (let page = start; page <= pages.length; page += 1) {
    if (pageNeedsOcr(pages[page - 1] ?? "")) {
      if (to >= start) break;
      ocr = true;
      to = page;
      break;
    }
    to = page;
    if (to - start + 1 >= textLimit) break;
  }
  return { from: start, to, ocr, done: start > pages.length };
}

export function chunksForPage(text: string, page: number): StoredChunk[] {
  const normalized = normalizeChapterText(text);
  if (pageNeedsOcr(normalized)) return [];
  const parts =
    normalized.length > HARD
      ? Array.from(
          { length: Math.ceil(normalized.length / TARGET) },
          (_, index) => normalized.slice(index * TARGET, index * TARGET + TARGET),
        )
      : [normalized];
  return parts.filter(Boolean).map((content) => ({
    chunk_index: 0,
    page_start: page,
    page_end: page,
    content,
  }));
}

export function assertTextPdf(pages: string[]) {
  const letters = pages.reduce(
    (total, page) => total + (page.match(/[A-Za-z]/g)?.length ?? 0),
    0,
  );
  const readablePages = pages.filter(
    (page) => (page.match(/[A-Za-z]/g)?.length ?? 0) >= 40,
  ).length;
  if (letters < 80 || (readablePages === 0 && letters < 400))
    throw new ScannedPdfError();
}

export function chunkChapter(pages: string[]): StoredChunk[] {
  assertTextPdf(pages);
  const chunks: StoredChunk[] = [];
  let buffer: { page: number; text: string }[] = [];
  let size = 0;
  const flush = () => {
    if (!buffer.length) return;
    chunks.push({
      chunk_index: chunks.length,
      page_start: buffer[0].page,
      page_end: buffer[buffer.length - 1].page,
      content: buffer.map((page) => page.text).join("\n\n"),
    });
    buffer = [];
    size = 0;
  };
  pages.forEach((raw, index) => {
    const text = normalizeChapterText(raw);
    if (!text) return;
    const page = index + 1;
    if (text.length > HARD) {
      flush();
      for (let start = 0; start < text.length; start += TARGET)
        chunks.push({
          chunk_index: chunks.length,
          page_start: page,
          page_end: page,
          content: text.slice(start, start + TARGET),
        });
      return;
    }
    if (size && size + text.length + 2 > TARGET) flush();
    buffer.push({ page, text });
    size += text.length + 2;
  });
  flush();
  if (!chunks.length) throw new ScannedPdfError();
  return chunks.map((chunk, chunk_index) => ({ ...chunk, chunk_index }));
}

export function selectGenerationChunks(
  chunks: StoredChunk[],
  pageStart?: number,
  pageEnd?: number,
) {
  const start = pageStart ?? 1;
  const end = pageEnd ?? 2000;
  const ranged = chunks.filter(
    (chunk) => chunk.page_end >= start && chunk.page_start <= end,
  );
  const used: StoredChunk[] = [];
  let size = 0;
  for (const chunk of ranged) {
    if (used.length && size + chunk.content.length > GENERATION_BUDGET) break;
    used.push(chunk);
    size += chunk.content.length;
  }
  return {
    chunks: used,
    partial: used.length < ranged.length,
    pageStart: used[0]?.page_start ?? null,
    pageEnd: used.at(-1)?.page_end ?? null,
  };
}

export function retrieveChunks(
  chunks: StoredChunk[],
  query: string,
  limit = 4,
) {
  const terms = [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 3),
    ),
  ];
  if (!terms.length) return [];
  return chunks
    .map((chunk) => ({
      chunk,
      score: terms.reduce(
        (total, term) =>
          total + (chunk.content.toLowerCase().includes(term) ? 1 : 0),
        0,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.chunk.chunk_index - b.chunk.chunk_index,
    )
    .slice(0, limit)
    .map((item) => item.chunk);
}

export function pageLabel(chunk: StoredChunk) {
  return chunk.page_start === chunk.page_end
    ? `p. ${chunk.page_start}`
    : `pp. ${chunk.page_start}–${chunk.page_end}`;
}

export function citeSource(
  title: string,
  evidence: string,
  chunks: StoredChunk[],
) {
  const needle = normalizeChapterText(evidence);
  const hit = chunks.find((chunk) =>
    normalizeChapterText(chunk.content).includes(needle),
  );
  return hit ? `${title} (${pageLabel(hit)})` : title;
}

export function chapterTitle(preferred: string, fallback: string) {
  const cleaned = preferred.replace(/[\u0000-\u001f]/g, " ").trim();
  const title = (cleaned || fallback).slice(0, 120).trim();
  return title || "Private chapter";
}
