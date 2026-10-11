import { test } from "node:test";
import assert from "node:assert/strict";
import { demoResources, demoSet } from "../lib/demo";
import { groundedStudySchema, validateGroundedStudy } from "../lib/grounding";
const source = demoResources[0];
const draft = () => ({
  status: "ready",
  title: demoSet.title,
  cards: demoSet.cards,
  questions: demoSet.questions,
});

test("accepts a source-backed mixed quiz and supplies the actual source title", () => {
  const set = validateGroundedStudy(draft(), source);
  assert.equal(set.questions.filter((q) => q.kind === "terminology").length, 1);
  assert.equal(set.questions.filter((q) => q.kind === "scenario").length, 2);
  assert.equal(set.groundingVersion, 1);
  assert.ok(set.questions.every((q) => q.source === source.title));
});
test("rejects fabricated source passages instead of returning a partial set", () => {
  const input = draft();
  input.questions = input.questions.map((q, i) =>
    i === 0
      ? {
          ...q,
          evidence:
            "This invented passage is not present in the uploaded notes.",
        }
      : q,
  );
  assert.throws(
    () => validateGroundedStudy(input, source),
    /could not be found/,
  );
});
test("rejects an unrelated source even when the generated format is valid", () => {
  assert.throws(
    () => validateGroundedStudy(draft(), demoResources[1]),
    /could not be found/,
  );
});
test("allows whitespace variation but does not change words or negation", () => {
  const input = draft();
  input.questions = input.questions.map((q, i) =>
    i === 0 ? { ...q, evidence: q.evidence!.replaceAll(" ", "\n ") } : q,
  );
  assert.doesNotThrow(() => validateGroundedStudy(input, source));
  input.questions[0] = {
    ...input.questions[0],
    evidence:
      "The primary assessment does not identify immediate life threats.",
  };
  assert.throws(
    () => validateGroundedStudy(input, source),
    /could not be found/,
  );
});
test("rejects sets with one missing question type or an unbalanced mix", () => {
  const input = draft();
  input.questions = input.questions.map((q) => ({
    ...q,
    kind: "terminology" as const,
  }));
  assert.throws(() => validateGroundedStudy(input, source), /balanced mix/);
  input.questions = [
    demoSet.questions[0],
    ...Array(4).fill(demoSet.questions[1]),
  ];
  assert.throws(() => validateGroundedStudy(input, source), /balanced mix/);
});
test("insufficient source produces a useful failure and no quiz", () => {
  assert.throws(
    () =>
      validateGroundedStudy(
        {
          status: "insufficient_source",
          title: "More text needed",
          cards: [],
          questions: [],
        },
        source,
      ),
    /Add more source text/,
  );
});
test("new generation requires evidence for flashcards as well as questions", () => {
  const input = draft();
  input.cards = input.cards.map((c) => ({ ...c, evidence: undefined }));
  assert.equal(groundedStudySchema.safeParse(input).success, false);
});
test("rejects duplicate options even when the supporting text matches", () => {
  const input = draft();
  input.questions = input.questions.map((q, i) =>
    i === 0
      ? {
          ...q,
          options: [q.options[0], q.options[0], q.options[2], q.options[3]],
        }
      : q,
  );
  assert.throws(() => validateGroundedStudy(input, source), /duplicate answer/);
});
