import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkChapter } from "../lib/chapters";
import { planStudyRetrieval } from "../lib/retrieval";
import { embeddingLiteral } from "../lib/embeddings";

const page = (sentence: string) =>
  `${sentence} ${"The assessment continues with the same stated priority. ".repeat(80)}`;

const chapter = () =>
  chunkChapter([
    page("Scene safety comes before patient contact."),
    page("Airway opening uses a manual maneuver."),
    page("Breathing is checked for rate and effort."),
    page("Circulation is checked for pulse and bleeding."),
    page("Reassessment looks for changes after treatment."),
  ]);

test("a broad chapter question samples the chapter instead of failing", () => {
  const plan = planStudyRetrieval(chapter(), "Tell me about Chapter 2.");
  assert.equal(plan.kind, "overview");
  assert.equal(plan.passages[0].page_start, 1);
  assert.equal(plan.passages.at(-1)?.page_end, 5);
  assert.equal(plan.partial, true);
});

test("a specific question still uses the matching page", () => {
  const plan = planStudyRetrieval(chapter(), "How is the airway opened?");
  assert.equal(plan.kind, "match");
  assert.equal(plan.passages[0].page_start, 2);
});

test("an unrelated clinical question is not treated as a textbook match", () => {
  const plan = planStudyRetrieval(
    chapter(),
    "What is the adult dose of epinephrine for anaphylaxis?",
  );
  assert.equal(plan.kind, "unmatched");
  assert.deepEqual(plan.passages, []);
});

test("embedding literals keep the expected size", () => {
  assert.equal(embeddingLiteral([0.1, 0.2]), null);
  assert.equal(embeddingLiteral(Array.from({ length: 1536 }, () => 0.01))?.startsWith("[0.01,"), true);
});
