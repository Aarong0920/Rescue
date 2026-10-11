import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ScannedPdfError,
  chunkChapter,
  chunksForPage,
  citeSource,
  pageNeedsOcr,
  retrieveChunks,
  selectGenerationChunks,
  selectWork,
} from "../lib/chapters";

const page = (sentence: string) =>
  Array.from(
    { length: 20 },
    () =>
      `${sentence} The primary assessment identifies immediate life threats and treats them before the detailed exam.`,
  ).join(" ");

test("chapter chunks keep page numbers and stay within the storage limit", () => {
  const chunks = chunkChapter([
    page("Airway assessment begins with looking."),
    page("Breathing is checked for rate and effort."),
    "x".repeat(9000),
  ]);
  assert.equal(chunks[0].page_start, 1);
  assert.ok(chunks.some((chunk) => chunk.page_start === 3 && chunk.page_end === 3));
  assert.ok(chunks.every((chunk) => chunk.content.length <= 12000));
  assert.ok(chunks.filter((chunk) => chunk.page_start === 3).length > 1);
  assert.deepEqual(
    chunks.map((chunk) => chunk.chunk_index),
    chunks.map((_, index) => index),
  );
});

test("scanned pages are rejected instead of inventing text", () => {
  assert.throws(() => chunkChapter(["", "   ", "img"]), ScannedPdfError);
});

test("generation can cover a later page range without dropping its citations", () => {
  const chunks = chunkChapter([
    page("Scene safety comes before patient contact."),
    page("Airway opening uses a manual maneuver."),
    page("Oxygen decisions follow local protocol."),
  ]);
  const selected = selectGenerationChunks(chunks, 2, 3);
  assert.equal(selected.pageStart, 2);
  assert.equal(selected.pageEnd, 3);
  assert.equal(selected.partial, false);
  assert.equal(
    citeSource("Airway", chunks[1].content.slice(0, 80), selected.chunks),
    "Airway (p. 2)",
  );
});

test("large chapters report a partial page window", () => {
  const chunks = chunkChapter(
    Array.from({ length: 12 }, (_, index) =>
      page(`Topic ${index} remains in the source.`),
    ),
  );
  const selected = selectGenerationChunks(chunks);
  assert.equal(selected.partial, true);
  assert.ok(selected.chunks.length < chunks.length);
  assert.equal(selected.pageStart, 1);
});

test("mixed chapters OCR only the scanned pages and keep page numbers", () => {
  const pages = [
    page("Scene safety comes before patient contact."),
    "   ",
    page("Airway opening uses a manual maneuver."),
  ];
  assert.equal(pageNeedsOcr(pages[0]), false);
  assert.equal(pageNeedsOcr(pages[1]), true);
  const first = selectWork(pages, 1, 20);
  assert.equal(first.ocr, false);
  assert.equal(first.to, 1);
  const scanned = selectWork(pages, 2, 20);
  assert.equal(scanned.ocr, true);
  assert.equal(scanned.to, 2);
  const stored = chunksForPage(pages[2], 3);
  assert.equal(stored[0].page_start, 3);
  assert.equal(selectWork(pages, 4).done, true);
});

test("tutor retrieval returns only matching private passages", () => {
  const chunks = chunkChapter([
    page("Scene safety comes before patient contact."),
    page("Airway opening uses a manual maneuver."),
  ]);
  const found = retrieveChunks(chunks, "How is the airway opened?");
  assert.equal(found.length, 1);
  assert.equal(found[0].page_start, 2);
  assert.deepEqual(retrieveChunks(chunks, "Why?"), []);
});
