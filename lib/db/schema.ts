import {
  bigserial, boolean, customType, date, index, integer, jsonb, pgTable, primaryKey, text,
  timestamp, uniqueIndex, uuid, vector,
} from "drizzle-orm/pg-core";

// docs/12-database-design.md explains why each table exists.
export const EMBEDDING_DIMENSIONS = 1536;

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });
const timestamps = () => timestamp({ withTimezone: true }).notNull().defaultNow();

// ── Identity ──────────────────────────────────────────────────────────────
export const organizations = pgTable("organizations", {
  id:        uuid().primaryKey().defaultRandom(),
  name:      text().notNull(),
  createdAt: timestamps(),
});

export const users = pgTable("users", {
  id:             uuid().primaryKey().defaultRandom(),
  organizationId: uuid().notNull().references(() => organizations.id),
  email:          text().notNull().unique(),
  displayName:    text().notNull(),
  passwordHash:   text().notNull(),
  status:         text().notNull().default("active"),
  createdAt:      timestamps(),
});

export const userRoles = pgTable("user_roles", {
  userId: uuid().notNull().references(() => users.id),
  role:   text().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.role] })]);

export const sessions = pgTable("sessions", {
  id:           uuid().primaryKey().defaultRandom(),
  userId:       uuid().notNull().references(() => users.id),
  tokenHash:    text().notNull().unique(),
  createdAt:    timestamps(),
  lastSeenAt:   timestamps(),
  expiresAt:    timestamp({ withTimezone: true }).notNull(),
  revokedAt:    timestamp({ withTimezone: true }),
});

// Append-only: triggers in the first migration reject UPDATE and DELETE and fill the hash chain.
export const auditLogs = pgTable("audit_logs", {
  id:             bigserial({ mode: "number" }).primaryKey(),
  organizationId: uuid(),
  actorId:        uuid(),
  action:         text().notNull(),
  targetType:     text(),
  targetId:       text(),
  correlationId:  text(),
  metadata:       jsonb().$type<Record<string, string | number | boolean | null>>(),
  prevHash:       text(),
  entryHash:      text(),
  createdAt:      timestamps(),
}, (t) => [index().on(t.createdAt), index().on(t.targetType, t.targetId)]);

// ── Calls ─────────────────────────────────────────────────────────────────
export const calls = pgTable("calls", {
  id:                 uuid().primaryKey(),
  organizationId:     uuid().notNull().references(() => organizations.id),
  state:              text().notNull(),
  activeAgent:        text().notNull(),
  dataMode:           text().notNull().default("synthetic"),
  emergencyLocked:    boolean().notNull().default(false),
  sentiment:          text(),
  agentsUsed:         text().array().notNull().default([]),
  startedAt:          timestamps(),
  endedAt:            timestamp({ withTimezone: true }),
  lastActivityAt:     timestamps(),
  retentionExpiresAt: timestamp({ withTimezone: true }).notNull(),
}, (t) => [index().on(t.organizationId, t.startedAt), index().on(t.retentionExpiresAt)]);

export const callTurns = pgTable("call_turns", {
  id:               uuid().primaryKey(),
  callId:           uuid().notNull().references(() => calls.id, { onDelete: "cascade" }),
  sequence:         integer().notNull(),
  speaker:          text().notNull(),
  agent:            text(),
  textContent:      text().notNull(),
  pathway:          text(),
  validationStatus: text(),
  promptVersion:    text(),
  policyVersion:    text(),
  modelId:          text(),
  timings:          jsonb().$type<Record<string, number>>(),
  createdAt:        timestamps(),
}, (t) => [uniqueIndex().on(t.callId, t.sequence)]);

export const callSummaries = pgTable("call_summaries", {
  callId:         uuid().primaryKey().references(() => calls.id, { onDelete: "cascade" }),
  intelligence:   jsonb().notNull(),
  method:         text().notNull(),
  modelId:        text(),
  humanCorrected: boolean().notNull().default(false),
  createdAt:      timestamps(),
});

// Rule IDs and categories only. Caller words stay in the access-controlled turn.
export const safetyEvents = pgTable("safety_events", {
  id:             uuid().primaryKey().defaultRandom(),
  organizationId: uuid().notNull().references(() => organizations.id),
  callId:         uuid().notNull().references(() => calls.id, { onDelete: "cascade" }),
  turnId:         uuid(),
  stage:          text().notNull(),
  categories:     text().array().notNull(),
  severity:       text().notNull(),
  ruleIds:        text().array().notNull(),
  actionTaken:    text().notNull(),
  policyVersion:  text().notNull(),
  createdAt:      timestamps(),
}, (t) => [index().on(t.organizationId, t.createdAt, t.severity)]);

// ── Escalation ────────────────────────────────────────────────────────────
export const escalations = pgTable("escalations", {
  id:               uuid().primaryKey().defaultRandom(),
  organizationId:   uuid().notNull().references(() => organizations.id),
  callId:           uuid().notNull().references(() => calls.id, { onDelete: "cascade" }),
  reason:           text().notNull(),
  priority:         text().notNull(),
  status:           text().notNull().default("open"),
  assignedTo:       uuid().references(() => users.id),
  encryptedContact: text(),
  preferredWindow:  text(),
  outcome:          text(),
  createdAt:        timestamps(),
  updatedAt:        timestamps(),
}, (t) => [index().on(t.organizationId, t.status, t.priority, t.createdAt)]);

export const escalationEvents = pgTable("escalation_events", {
  id:           uuid().primaryKey().defaultRandom(),
  escalationId: uuid().notNull().references(() => escalations.id, { onDelete: "cascade" }),
  actorId:      uuid().references(() => users.id),
  eventType:    text().notNull(),
  detail:       text(),
  createdAt:    timestamps(),
});

export const followUpTasks = pgTable("follow_up_tasks", {
  id:          uuid().primaryKey().defaultRandom(),
  callId:      uuid().notNull().references(() => calls.id, { onDelete: "cascade" }),
  ownerId:     uuid().references(() => users.id),
  description: text().notNull(),
  status:      text().notNull().default("open"),
  createdAt:   timestamps(),
});

// ── Knowledge ─────────────────────────────────────────────────────────────
export const knowledgeDocuments = pgTable("knowledge_documents", {
  id:             uuid().primaryKey().defaultRandom(),
  organizationId: uuid().notNull().references(() => organizations.id),
  title:          text().notNull(),
  sourceType:     text().notNull(),
  sourceUrl:      text(),
  product:        text(),
  audience:       text().notNull().default("consumer"),
  createdAt:      timestamps(),
});

export const knowledgeVersions = pgTable("knowledge_versions", {
  id:            uuid().primaryKey().defaultRandom(),
  documentId:    uuid().notNull().references(() => knowledgeDocuments.id),
  version:       integer().notNull(),
  status:        text().notNull().default("pending_review"),
  contentHash:   text().notNull(),
  flags:         text().array().notNull().default([]),
  effectiveDate: date(),
  expiryDate:    date(),
  uploadedBy:    uuid().notNull().references(() => users.id),
  approvedBy:    uuid().references(() => users.id),
  rejectReason:  text(),
  createdAt:     timestamps(),
}, (t) => [uniqueIndex().on(t.documentId, t.version), index().on(t.status)]);

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id:             uuid().primaryKey().defaultRandom(),
  versionId:      uuid().notNull().references(() => knowledgeVersions.id, { onDelete: "cascade" }),
  section:        text().notNull(),
  sourceLocation: text().notNull(),
  content:        text().notNull(),
  contentHash:    text().notNull(),
  embedding:      vector({ dimensions: EMBEDDING_DIMENSIONS }),
  searchVector:   tsvector(),
}, (t) => [index().on(t.versionId), index().using("gin", t.searchVector)]);

export const turnCitations = pgTable("turn_citations", {
  turnId:    uuid().notNull(),
  chunkId:   uuid().notNull().references(() => knowledgeChunks.id),
  versionId: uuid().notNull().references(() => knowledgeVersions.id),
}, (t) => [primaryKey({ columns: [t.turnId, t.chunkId] })]);

// ── Review and evaluation ─────────────────────────────────────────────────
export const reviewItems = pgTable("review_items", {
  id:           uuid().primaryKey().defaultRandom(),
  organizationId: uuid().notNull().references(() => organizations.id),
  callId:       uuid().notNull().references(() => calls.id, { onDelete: "cascade" }),
  reviewerId:   uuid().notNull().references(() => users.id),
  failureClass: text().notNull(),
  notes:        text(),
  status:       text().notNull().default("open"),
  proposedCase: jsonb(),
  createdAt:    timestamps(),
});

export const evaluationRuns = pgTable("evaluation_runs", {
  id:               uuid().primaryKey().defaultRandom(),
  tier:             text().notNull(),
  datasetVersion:   text().notNull(),
  datasetHash:      text().notNull(),
  provider:         text(),
  modelId:          text(),
  promptVersion:    text().notNull(),
  policyVersion:    text().notNull(),
  knowledgeVersion: text().notNull(),
  codeCommit:       text(),
  aggregates:       jsonb().notNull(),
  gateResult:       text().notNull(),
  createdAt:        timestamps(),
});

export const evaluationResults = pgTable("evaluation_results", {
  id:       uuid().primaryKey().defaultRandom(),
  runId:    uuid().notNull().references(() => evaluationRuns.id, { onDelete: "cascade" }),
  caseId:   text().notNull(),
  category: text().notNull(),
  severity: text().notNull(),
  passed:   boolean().notNull(),
  failures: text().array().notNull(),
  snapshot: jsonb(),
}, (t) => [index().on(t.runId, t.passed)]);
