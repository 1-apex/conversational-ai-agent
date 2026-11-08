import { sql } from "drizzle-orm";
import type { RetrievedChunk } from "@/lib/conversation/pipeline";
import type { Db } from "@/lib/db";
import type { Embedder } from "./embeddings";

const CANDIDATES = 12;
const RESULTS    = 4;
const RRF_K      = 60; // the usual reciprocal rank fusion constant

// In the SQL, not the application, so a bug further up can't surface unapproved text.
const ELIGIBLE = sql`
  kv.status = 'approved'
  AND (kv.effective_date IS NULL OR kv.effective_date <= CURRENT_DATE)
  AND (kv.expiry_date IS NULL OR kv.expiry_date >= CURRENT_DATE)
`;

interface Row extends Record<string, unknown> {
  id: string;
  version_id: string;
  content: string;
  section: string;
}

const rowsOf = (result: unknown): Row[] => (result as { rows: Row[] }).rows;

async function keywordSearch(db: Db, query: string, audience: string): Promise<Row[]> {
  // OR of the words: a short spoken question rarely contains every word in a section
  return rowsOf(await db.execute(sql`
    WITH q AS (
      SELECT to_tsquery('english', string_agg(lexeme, ' | ')) AS terms
      FROM unnest(tsvector_to_array(to_tsvector('english', ${query}))) AS lexeme
    )
    SELECT c.id, c.version_id, c.content, c.section
    FROM knowledge_chunks c
    JOIN knowledge_versions kv ON kv.id = c.version_id
    JOIN knowledge_documents d ON d.id = kv.document_id, q
    WHERE ${ELIGIBLE} AND d.audience = ${audience} AND c.search_vector @@ q.terms
    ORDER BY ts_rank(c.search_vector, q.terms) DESC
    LIMIT ${CANDIDATES}
  `));
}

async function vectorSearch(db: Db, embedding: number[], audience: string): Promise<Row[]> {
  const literal = `[${embedding.join(",")}]`;
  return rowsOf(await db.execute(sql`
    SELECT c.id, c.version_id, c.content, c.section
    FROM knowledge_chunks c
    JOIN knowledge_versions kv ON kv.id = c.version_id
    JOIN knowledge_documents d ON d.id = kv.document_id
    WHERE ${ELIGIBLE} AND d.audience = ${audience} AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${literal}::vector
    LIMIT ${CANDIDATES}
  `));
}

export async function retrieve(
  db: Db, query: string, options: { embedder?: Embedder | null; audience?: string } = {},
): Promise<RetrievedChunk[]> {
  if (!query.trim()) return [];
  const audience = options.audience ?? "consumer";

  const lists: Row[][] = [await keywordSearch(db, query, audience)];
  if (options.embedder) {
    // Keyword results still count if the embedding provider is down
    const vectors = await options.embedder([query]).catch(() => null);
    if (vectors) lists.push(await vectorSearch(db, vectors[0], audience));
  }

  const scores = new Map<string, { score: number; row: Row }>();
  for (const list of lists) {
    list.forEach((row, rank) => {
      const entry = scores.get(row.id) ?? { score: 0, row };
      entry.score += 1 / (RRF_K + rank + 1);
      scores.set(row.id, entry);
    });
  }

  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, RESULTS).map(({ row }) => ({
    id: row.id, versionId: row.version_id, content: row.content, section: row.section,
  }));
}
