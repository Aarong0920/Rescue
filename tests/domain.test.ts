import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accuracy,
  canSubmit,
  requestSchema,
  score,
  studySchema,
} from "../lib/domain";
import { demoSet } from "../lib/demo";
test("quiz scoring accounts for unanswered and incorrect choices", () => {
  assert.equal(score(demoSet.questions, [1, 2, 0]), 3);
  assert.equal(score(demoSet.questions, [1]), 1);
  assert.equal(score(demoSet.questions, [0, 0, 1]), 0);
});
test("accuracy is weighted by number of questions", () => {
  assert.equal(accuracy([]), 0);
  assert.equal(
    accuracy([
      { id: "1", topic: "a", correct: 1, total: 1, date: "" },
      { id: "2", topic: "a", correct: 0, total: 9, date: "" },
    ]),
    10,
  );
});
test("sharing requires both distribution rights and a class", () => {
  assert.equal(canSubmit("private", "class"), false);
  assert.equal(canSubmit("original", ""), false);
  assert.equal(canSubmit("authorized", "class"), true);
});
test("AI request rejects invalid resource ids and oversized messages", () => {
  assert.equal(
    requestSchema.safeParse({
      mode: "tutor",
      resourceId: "other-user-resource",
    }).success,
    false,
  );
  assert.equal(
    requestSchema.safeParse({
      mode: "tutor",
      resourceId: "00000000-0000-4000-8000-000000000001",
      message: "x".repeat(1501),
    }).success,
    false,
  );
});
test("AI schema validates answers and option count", () => {
  assert.equal(studySchema.safeParse(demoSet).success, true);
  assert.equal(
    studySchema.safeParse({
      ...demoSet,
      questions: [{ ...demoSet.questions[0], answer: 4 }],
    }).success,
    false,
  );
});
