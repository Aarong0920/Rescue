import { test } from "node:test";
import assert from "node:assert/strict";
import { displayName, fullName, initials } from "../lib/profile";
import { questionsAnswered, recordSession, weakTopics } from "../lib/progress";
import type { Progress } from "../lib/domain";

test("names prefer the saved first name and keep a fallback", () => {
  assert.equal(displayName({ firstName: "Aaron", email: "a@example.com" }), "Aaron");
  assert.equal(displayName({ email: "future@example.com" }), "future");
  assert.equal(
    fullName({ firstName: "Aaron", lastName: "Student", email: "a@example.com" }),
    "Aaron Student",
  );
  assert.equal(initials({ firstName: "Aaron", lastName: "Student" }), "AS");
  assert.equal(initials({ email: "future@example.com" }), "F");
  assert.equal(fullName({ email: "future@example.com" }), "future");
});

test("weak topics come only from completed attempts", () => {
  const attempts = [
    { id: "1", topic: "Airway", correct: 1, total: 4, date: "2026-10-10T00:00:00Z" },
    { id: "2", topic: "Trauma", correct: 4, total: 4, date: "2026-10-10T00:00:00Z" },
  ];
  assert.deepEqual(
    weakTopics(attempts).map((topic) => topic.topic),
    ["Airway"],
  );
  assert.equal(questionsAnswered(attempts), 8);
  assert.deepEqual(weakTopics([]), []);
});

test("a repeated study action inside 30 minutes does not add another session", () => {
  const progress: Progress = {
    sets: [],
    mastered: [],
    attempts: [],
    messages: [],
    sessions: [
      {
        id: "session",
        kind: "quiz",
        topic: "Airway",
        date: "2026-10-10T12:00:00Z",
      },
    ],
  };
  const same = recordSession(progress, {
    kind: "quiz",
    topic: "Airway",
    date: "2026-10-10T12:10:00Z",
  });
  assert.equal(same.sessions?.length, 1);
  const later = recordSession(progress, {
    kind: "cards",
    topic: "Airway",
    date: "2026-10-10T13:00:00Z",
  });
  assert.equal(later.sessions?.length, 2);
});
