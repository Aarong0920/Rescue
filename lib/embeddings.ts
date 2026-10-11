import type OpenAI from "openai";
import type { StoredChunk } from "./chapters";

const MODEL = "text-embedding-3-small";
const DIMS = 1536;
const MIN_SIMILARITY = 0.45;

type QueryResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

type EmbeddingDb = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<QueryResult>;
};

function unavailable(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";
  return (
    error?.code === "42883" ||
    error?.code === "PGRST202" ||
    error?.code === "42P01" ||
    /does not exist|schema cache|chunk_embeddings|vector/i.test(message)
  );
}

export function embeddingLiteral(values: number[]) {
  if (values.length !== DIMS || values.some((value) => !Number.isFinite(value)))
    return null;
  return `[${values.join(",")}]`;
}

export async function semanticPassages(
  db: EmbeddingDb,
  client: OpenAI,
  resourceId: string,
  query: string,
): Promise<StoredChunk[]> {
  try {
    const pending = await db.rpc("chunks_without_embeddings", {
      rid: resourceId,
    });
    if (pending.error) return [];
    const rows = Array.isArray(pending.data)
      ? (pending.data as { id?: string; content?: string }[])
      : [];
    const ready = rows.filter(
      (row): row is { id: string; content: string } =>
        Boolean(row.id && row.content),
    );
    const embedded = await client.embeddings.create({
      model: MODEL,
      input: [query.slice(0, 1000), ...ready.map((row) => row.content.slice(0, 2000))],
    });
    const vectors = [...embedded.data]
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
    const queryVector = embeddingLiteral(vectors[0] ?? []);
    if (!queryVector) return [];
    for (let index = 0; index < ready.length; index += 1) {
      const literal = embeddingLiteral(vectors[index + 1] ?? []);
      if (!literal) continue;
      const saved = await db.rpc("save_chunk_embedding", {
        chunk_id: ready[index].id,
        embedding: literal,
      });
      if (saved.error && unavailable(saved.error)) return [];
    }
    const matched = await db.rpc("match_chapter_passages", {
      rid: resourceId,
      query: queryVector,
      match_count: 4,
    });
    if (matched.error || !Array.isArray(matched.data)) return [];
    return (
      matched.data as {
        chunk_index: number;
        page_start: number;
        page_end: number;
        content: string;
        similarity: number;
      }[]
    )
      .filter((row) => row.similarity >= MIN_SIMILARITY && row.content)
      .map((row) => ({
        chunk_index: row.chunk_index,
        page_start: row.page_start,
        page_end: row.page_end,
        content: row.content,
      }));
  } catch {
    return [];
  }
}
