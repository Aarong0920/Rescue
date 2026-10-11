import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chapterStage,
  chapterWork,
  draftRestoredMessage,
  initialQuizStatus,
  mergeDraft,
  noticeClass,
  parseDraft,
  placeHref,
  readPlace,
  shouldLoadAccount,
} from "../lib/place";

test("tab focus for the same account does not reload the workspace", () => {
  assert.equal(shouldLoadAccount("SIGNED_IN", "user-1", "user-1"), "ignore");
  assert.equal(shouldLoadAccount("TOKEN_REFRESHED", "user-1", "user-1"), "ignore");
  assert.equal(shouldLoadAccount("INITIAL_SESSION", null, null), "signout");
  assert.equal(shouldLoadAccount("SIGNED_IN", null, "user-1"), "load");
  assert.equal(shouldLoadAccount("SIGNED_IN", "user-1", "user-2"), "load");
  assert.equal(shouldLoadAccount("SIGNED_OUT", "user-1", null), "signout");
  assert.equal(shouldLoadAccount("INITIAL_SESSION", "user-1", null), "ignore");
});

test("bookmarkable screens survive a refresh", () => {
  assert.deepEqual(readPlace("?screen=library&chapter=chapter-2"), {
    page: "My library",
    chapter: "chapter-2",
  });
  assert.equal(placeHref("Practice quizzes", null), "/?screen=quizzes");
  assert.equal(readPlace("").page, "Dashboard");
  assert.equal(readPlace("?screen=nope&chapter=../secret").chapter, null);
});

test("chapter progress uses completed pages and never invents a total", () => {
  assert.deepEqual(
    chapterWork({ processing: "processing", nextPage: 4, totalPages: 10 }),
    { done: 3, total: 10 },
  );
  assert.equal(chapterWork({ processing: "processing", nextPage: 2 }), null);
  assert.equal(chapterStage({ stage: "ocr", processing: "processing" }), "Reading scanned pages");
  assert.equal(chapterStage({ processing: "failed" }), "Failed");
  assert.equal(chapterStage({ processing: "ready", pages: 8 }), "Ready");
});

test("an initial quiz is ready only after it is saved", () => {
  assert.equal(
    initialQuizStatus({
      autoQuiz: true,
      hasSavedQuiz: false,
      processing: "processing",
      isChapter: true,
    }),
    "pending",
  );
  assert.equal(
    initialQuizStatus({
      autoQuiz: true,
      hasSavedQuiz: false,
      processing: "ready",
      activity: "generating",
      isChapter: true,
    }),
    "generating",
  );
  assert.equal(
    initialQuizStatus({
      autoQuiz: true,
      hasSavedQuiz: true,
      processing: "ready",
      isChapter: true,
    }),
    "ready",
  );
  assert.equal(
    initialQuizStatus({
      autoQuiz: false,
      hasSavedQuiz: false,
      processing: "ready",
      isChapter: true,
    }),
    "off",
  );
  assert.equal(
    initialQuizStatus({
      autoQuiz: true,
      hasSavedQuiz: false,
      processing: "ready",
      activity: "failed",
      isChapter: true,
    }),
    "failed",
  );
});

test("draft recovery keeps the student's notes and quiz answers, not textbook text", () => {
  const raw = JSON.stringify({
    userId: "user-1",
    answers: [1, -1],
    cardIndex: 3,
    note: { title: "Airway", topic: "Airway", content: "my notes" },
    content: "extracted textbook page",
    file: "secret.pdf",
  });
  const draft = parseDraft(raw, "user-1");
  assert.equal(parseDraft(raw, "someone-else"), null);
  assert.deepEqual(draft?.answers, [1, -1]);
  assert.equal(draft?.note?.content, "my notes");
  assert.equal("content" in (draft ?? {}), false);
  assert.equal(
    draftRestoredMessage(draft),
    "Restored your unsaved study draft.",
  );
  assert.equal(draftRestoredMessage(mergeDraft(null, undefined, "user-1")), null);
  const merged = mergeDraft(
    { userId: "user-1", note: { title: "A", topic: "B", content: "C" } },
    { setId: "quiz-1", answers: [0], cardIndex: 2 },
    "user-1",
  );
  assert.equal(merged?.selected, "quiz-1");
  assert.deepEqual(merged?.answers, [0]);
  assert.equal(merged?.note?.content, "C");
});

test("success notices are not styled as errors", () => {
  assert.equal(noticeClass("success"), "notice success");
  assert.equal(noticeClass("error").includes("success"), false);
  assert.equal(noticeClass("info"), "notice info");
  assert.equal(noticeClass("warning"), "notice warning");
});
