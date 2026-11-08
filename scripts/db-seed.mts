import nextEnv from "@next/env";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/sessions";
import { Role } from "@/lib/auth/permissions";
import { getDefaultOrganizationId } from "@/lib/conversation/store";
import { getDb } from "@/lib/db";
import { userRoles, users } from "@/lib/db/schema";
import { INOGEN_KNOWLEDGE } from "@/lib/inogen-knowledge";
import { ingestDocument } from "@/lib/knowledge/ingest";

nextEnv.loadEnvConfig(process.cwd());

// Test accounts for local use only. You choose the password, so none is stored in the repo.
const password = process.env.SEED_PASSWORD;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
if (!password || password.length < 10) throw new Error("Set SEED_PASSWORD (10+ characters) in .env.local");
if (process.env.VERCEL || process.env.NODE_ENV === "production") throw new Error("The seed script doesn't run in production");

const ACCOUNTS: { email: string; displayName: string; role: Role }[] = [
  { email: "admin@demo.test",      displayName: "Demo Admin",      role: "ADMIN" },
  { email: "supervisor@demo.test", displayName: "Demo Supervisor", role: "SUPERVISOR" },
  { email: "support@demo.test",    displayName: "Demo Support",    role: "SUPPORT_AGENT" },
  { email: "auditor@demo.test",    displayName: "Demo Auditor",    role: "AUDITOR" },
];

const db = (await getDb())!;
const organizationId = await getDefaultOrganizationId(db);
const passwordHash = await hashPassword(password);
let adminId = "";

for (const account of ACCOUNTS) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, account.email)).limit(1);
  const id = existing?.id ?? (await db.insert(users).values({
    organizationId, email: account.email, displayName: account.displayName, passwordHash,
  }).returning({ id: users.id }))[0].id;
  await db.insert(userRoles).values({ userId: id, role: account.role }).onConflictDoNothing();
  if (account.role === "ADMIN") adminId = id;
  console.log(`Account ready: ${account.email} (${account.role})`);
}

// The old knowledge string as a document awaiting review. It stays unusable by retrieval
// until a second person approves it, which is one of the manual test steps.
const { version, chunkCount } = await ingestDocument(db, {
  organizationId, uploadedBy: adminId,
  title: "Legacy knowledge base (unverified)", sourceType: "legacy_unverified",
  content: INOGEN_KNOWLEDGE,
});
console.log(`Knowledge document v${version.version} pending review, ${chunkCount} chunks`);
process.exit(0);
