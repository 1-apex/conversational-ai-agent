import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { knowledgeChunks, knowledgeDocuments, knowledgeVersions } from "@/lib/db/schema";
import { redactPii } from "@/lib/safety/detectors";
import type { Embedder } from "./embeddings";

const MAX_CHUNK_CHARS = 1_200;
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

// Flagged for the reviewer, not blocked: official documents can legitimately say "ignore".
const INSTRUCTION_LIKE = /\b(ignore (all |any |the )?(previous|prior|above)|disregard|system prompt|you are now|new instructions|as an ai)\b/i;
// Zero-width and bidirectional control characters are used to hide text from reviewers
const HIDDEN_CHARS = /[​-‏‪-‮⁠-⁤﻿]/;

export function normalizeDocument(text: string): string {
  return text.normalize("NFKC").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function scanDocument(text: string): string[] {
  const flags: string[] = [];
  if (INSTRUCTION_LIKE.test(text)) flags.push("instruction_like_text");
  if (HIDDEN_CHARS.test(text)) flags.push("hidden_characters");
  if (redactPii(text).text !== text) flags.push("possible_personal_data");
  return flags;
}

export interface Chunk {
  section: string;
  sourceLocation: string;
  content: string;
}

// Splits on headings so facts stay with their section. Paragraphs are never cut mid-way,
// which keeps tables of specs in one piece unless a single one exceeds the limit.
export function chunkDocument(text: string): Chunk[] {
  const lines = text.split("\n");
  const sections: { title: string; line: number; body: string[] }[] = [{ title: "Introduction", line: 1, body: [] }];
  lines.forEach((line, i) => {
    const heading = line.match(/^#{1,4}\s+(.+)$/) ?? line.match(/^━+\s*(.+?)\s*━+$/);
    if (heading) sections.push({ title: heading[1].trim(), line: i + 1, body: [] });
    else sections.at(-1)!.body.push(line);
  });

  const chunks: Chunk[] = [];
  for (const section of sections) {
    let current = "";
    let part = 1;
    const flush = () => {
      if (!current.trim()) return;
      chunks.push({
        section: section.title,
        sourceLocation: `line ${section.line}${part > 1 ? `, part ${part}` : ""}`,
        content: current.trim(),
      });
      part += 1;
      current = "";
    };
    for (const paragraph of section.body.join("\n").split(/\n\s*\n/)) {
      if (current && current.length + paragraph.length > MAX_CHUNK_CHARS) flush();
      current += `${paragraph}\n\n`;
    }
    flush();
  }
  return chunks;
}

export interface IngestInput {
  organizationId: string;
  uploadedBy: string;
  title: string;
  sourceType: string;
  sourceUrl?: string | null;
  product?: string | null;
  audience?: string;
  content: string;
  effectiveDate?: string | null;
  expiryDate?: string | null;
}

export async function ingestDocument(db: Db, input: IngestInput, embedder?: Embedder | null) {
  const text   = normalizeDocument(input.content);
  const chunks = chunkDocument(text);
  if (chunks.length === 0) throw new Error("empty_document");

  const [existing] = await db.select().from(knowledgeDocuments).where(and(
    eq(knowledgeDocuments.organizationId, input.organizationId),
    eq(knowledgeDocuments.title, input.title),
  )).limit(1);

  const document = existing ?? (await db.insert(knowledgeDocuments).values({
    organizationId: input.organizationId, title: input.title, sourceType: input.sourceType,
    sourceUrl: input.sourceUrl ?? null, product: input.product ?? null, audience: input.audience ?? "consumer",
  }).returning())[0];

  const [latest] = await db.select({ version: knowledgeVersions.version }).from(knowledgeVersions)
    .where(eq(knowledgeVersions.documentId, document.id)).orderBy(desc(knowledgeVersions.version)).limit(1);

  const [version] = await db.insert(knowledgeVersions).values({
    documentId: document.id, version: (latest?.version ?? 0) + 1,
    contentHash: hash(text), flags: scanDocument(text), uploadedBy: input.uploadedBy,
    effectiveDate: input.effectiveDate ?? null, expiryDate: input.expiryDate ?? null,
  }).returning();

  // Failing to embed isn't fatal: the version still works with keyword search
  const vectors = embedder ? await embedder(chunks.map((c) => c.content)).catch(() => null) : null;

  await db.insert(knowledgeChunks).values(chunks.map((chunk, i) => ({
    versionId: version.id, section: chunk.section, sourceLocation: chunk.sourceLocation,
    content: chunk.content, contentHash: hash(chunk.content), embedding: vectors?.[i] ?? null,
  })));

  return { document, version, chunkCount: chunks.length };
}

export class ApprovalError extends Error {
  constructor(public code: "not_found" | "not_pending" | "own_upload") {
    super(code);
    this.name = "ApprovalError";
  }
}

async function loadVersion(db: Db, versionId: string, organizationId: string) {
  const [row] = await db.select({ version: knowledgeVersions }).from(knowledgeVersions)
    .innerJoin(knowledgeDocuments, eq(knowledgeDocuments.id, knowledgeVersions.documentId))
    .where(and(eq(knowledgeVersions.id, versionId), eq(knowledgeDocuments.organizationId, organizationId))).limit(1);
  if (!row) throw new ApprovalError("not_found");
  return row.version;
}

export async function approveVersion(db: Db, versionId: string, approverId: string, organizationId: string) {
  const version = await loadVersion(db, versionId, organizationId);
  if (version.status !== "pending_review") throw new ApprovalError("not_pending");
  if (version.uploadedBy === approverId) throw new ApprovalError("own_upload");

  await db.update(knowledgeVersions).set({ status: "superseded" }).where(and(
    eq(knowledgeVersions.documentId, version.documentId), eq(knowledgeVersions.status, "approved"),
  ));
  await db.update(knowledgeVersions).set({
    status: "approved", approvedBy: approverId,
    effectiveDate: version.effectiveDate ?? sql`CURRENT_DATE`,
  }).where(eq(knowledgeVersions.id, versionId));
}

export async function setVersionStatus(
  db: Db, versionId: string, organizationId: string, status: "rejected" | "retired", reason?: string,
) {
  await loadVersion(db, versionId, organizationId);
  await db.update(knowledgeVersions).set({ status, rejectReason: reason ?? null }).where(eq(knowledgeVersions.id, versionId));
}
