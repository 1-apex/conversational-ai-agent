import { getKnowledgeMode } from "@/lib/config";
import type { Db } from "@/lib/db";
import { INOGEN_KNOWLEDGE } from "@/lib/inogen-knowledge";
import { getEmbedder } from "@/lib/knowledge/embeddings";
import { retrieve } from "@/lib/knowledge/retrieval";
import { classifyWithGroq, generateWithGroq } from "@/lib/providers/llm";
import type { PipelineDeps } from "./pipeline";

export function productionDeps(db: Db | null): PipelineDeps {
  const mode = getKnowledgeMode();
  return {
    generate: generateWithGroq,
    classify: process.env.GROQ_API_KEY ? classifyWithGroq : undefined,
    knowledge: {
      mode,
      legacyText: INOGEN_KNOWLEDGE,
      retrieve: (query) => db ? retrieve(db, query, { embedder: getEmbedder() }) : Promise.resolve([]),
    },
  };
}
