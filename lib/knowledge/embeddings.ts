import { assertProviderAllowed } from "@/lib/config";
import { EMBEDDING_DIMENSIONS } from "@/lib/db/schema";

export type Embedder = (texts: string[]) => Promise<number[][]>;

// Optional. Without these settings, retrieval uses keyword search only. Any
// OpenAI-compatible endpoint works; no provider is assumed or built in.
export function getEmbedder(): Embedder | null {
  const url   = process.env.EMBEDDING_API_URL;
  const key   = process.env.EMBEDDING_API_KEY;
  const model = process.env.EMBEDDING_MODEL;
  if (!url || !key || !model) return null;

  return async (texts) => {
    assertProviderAllowed("embedding", "configured-endpoint");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, input: texts, dimensions: EMBEDDING_DIMENSIONS }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Embedding ${res.status}`);
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data.map((d) => d.embedding);
  };
}
