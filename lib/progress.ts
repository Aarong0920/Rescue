import type { Attempt, Card, Progress, StudySession } from "./domain";
import { accuracy } from "./domain";

export function topicStats(attempts: Attempt[]) {
  return [...new Set(attempts.map((attempt) => attempt.topic))].map((topic) => {
    const rows = attempts.filter((attempt) => attempt.topic === topic);
    return {
      topic,
      accuracy: accuracy(rows),
      attempts: rows.length,
      questions: rows.reduce((total, attempt) => total + attempt.total, 0),
    };
  });
}

export function weakTopics(attempts: Attempt[]) {
  return topicStats(attempts).filter(
    (topic) => topic.attempts > 0 && topic.accuracy < 70,
  );
}

export function questionsAnswered(attempts: Attempt[]) {
  return attempts.reduce((total, attempt) => total + attempt.total, 0);
}

export function cardKey(setId: string, card: Card, index: number) {
  return `${setId}:${card.id ?? index}`;
}

export function cardOrder(cards: Card[], misses: Record<string, number> | undefined, setId: string) {
  return cards
    .map((card, index) => index)
    .sort(
      (a, b) =>
        (misses?.[cardKey(setId, cards[b], b)] ?? 0) -
        (misses?.[cardKey(setId, cards[a], a)] ?? 0),
    );
}

export function recordSession(
  progress: Progress,
  session: Omit<StudySession, "id" | "date"> & { id?: string; date?: string },
) {
  const date = session.date ?? new Date().toISOString();
  const sessions = progress.sessions ?? [];
  const last = sessions[0];
  if (
    last &&
    last.kind === session.kind &&
    last.topic === session.topic &&
    Date.parse(date) - Date.parse(last.date) < 30 * 60 * 1000
  )
    return progress;
  return {
    ...progress,
    sessions: [
      {
        id: session.id ?? crypto.randomUUID(),
        kind: session.kind,
        topic: session.topic,
        date,
      },
      ...sessions,
    ].slice(0, 100),
  };
}
