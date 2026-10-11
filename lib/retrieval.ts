import { retrieveChunks, type StoredChunk } from "./chapters";

export type RetrievalKind = "match" | "overview" | "unmatched";

export type RetrievalPlan = {
  kind: RetrievalKind;
  passages: StoredChunk[];
  partial: boolean;
};

const STOP = new Set([
  "about",
  "after",
  "also",
  "answer",
  "because",
  "been",
  "before",
  "chapter",
  "chapters",
  "could",
  "describe",
  "does",
  "explain",
  "focus",
  "from",
  "have",
  "help",
  "ideas",
  "into",
  "just",
  "know",
  "like",
  "main",
  "material",
  "more",
  "notes",
  "only",
  "over",
  "please",
  "question",
  "remember",
  "should",
  "some",
  "study",
  "tell",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "they",
  "this",
  "through",
  "want",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
]);

const BROAD =
  /\b(summar\w*|overview|tell me about|what(?:'s| is) (?:this|the) (?:chapter|material|document|notes)|explain (?:this|the) (?:chapter|material|notes|document)|key ideas|main (?:ideas|concepts|points)|what should i (?:focus|know|study)|walk me through|describe (?:this|the) chapter)\b/i;

export function contentTerms(query: string) {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 3 && !STOP.has(term)),
    ),
  ];
}

export function isBroadQuestion(query: string) {
  return BROAD.test(query);
}

export function sampleChapter(chunks: StoredChunk[], limit = 6, budget = 12000) {
  if (!chunks.length) return [];
  const picks: StoredChunk[] = [];
  if (chunks.length <= limit) picks.push(...chunks);
  else {
    const indexes = new Set<number>();
    const step = (chunks.length - 1) / (limit - 1);
    for (let index = 0; index < limit; index += 1)
      indexes.add(Math.round(index * step));
    [...indexes]
      .sort((a, b) => a - b)
      .forEach((index) => picks.push(chunks[index]));
  }
  const used: StoredChunk[] = [];
  let size = 0;
  const last = picks[picks.length - 1];
  for (const chunk of picks) {
    const reserved =
      chunk === last || used.includes(last) ? 0 : last.content.length;
    if (used.length && size + chunk.content.length + reserved > budget) continue;
    used.push(chunk);
    size += chunk.content.length;
  }
  return used.length ? used : picks.slice(0, 1);
}

export function planStudyRetrieval(
  chunks: StoredChunk[],
  query: string,
): RetrievalPlan {
  const terms = contentTerms(query);
  const broad = isBroadQuestion(query);
  if (broad && !terms.length) {
    const passages = sampleChapter(chunks);
    return {
      kind: "overview",
      passages,
      partial: passages.length < chunks.length,
    };
  }
  const matched = terms.length ? retrieveChunks(chunks, query) : [];
  if (matched.length) return { kind: "match", passages: matched, partial: false };
  if (broad || !terms.length) {
    const passages = sampleChapter(chunks);
    return {
      kind: "overview",
      passages,
      partial: passages.length < chunks.length,
    };
  }
  return { kind: "unmatched", passages: [], partial: false };
}
