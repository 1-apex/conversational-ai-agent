import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { sessions, userRoles, users } from "@/lib/db/schema";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;

export const SESSION_COOKIE = "staff_session";
export const ABSOLUTE_LIFETIME_MS = 8 * 60 * 60 * 1000;
export const IDLE_LIFETIME_MS     = 30 * 60 * 1000;
const LAST_SEEN_WRITE_MS          = 60 * 1000;
const KEY_LENGTH                  = 64;

export interface StaffUser {
  id: string;
  organizationId: string;
  email: string;
  displayName: string;
  roles: string[];
  sessionId: string;
}

// ── Passwords ─────────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key  = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, saltHex, keyHex] = stored.split("$");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual   = await scrypt(password, Buffer.from(saltHex, "hex"), KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}

// Compared against when the email is unknown, so timing doesn't reveal which emails exist.
export const DUMMY_PASSWORD_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(KEY_LENGTH * 2)}`;

// ── Sessions ──────────────────────────────────────────────────────────────
// The database stores only a hash, so reading the table doesn't give usable sessions.
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(db: Db, userId: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token     = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + ABSOLUTE_LIFETIME_MS);
  await db.insert(sessions).values({
    userId, tokenHash: hashToken(token), createdAt: now, lastSeenAt: now, expiresAt,
  });
  return { token, expiresAt };
}

export async function readSession(db: Db, token: string | undefined, now = new Date()): Promise<StaffUser | null> {
  if (!token) return null;
  const [row] = await db.select({
    sessionId: sessions.id, lastSeenAt: sessions.lastSeenAt, expiresAt: sessions.expiresAt,
    id: users.id, organizationId: users.organizationId, email: users.email,
    displayName: users.displayName, status: users.status,
  }).from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt))).limit(1);

  if (!row || row.status !== "active") return null;
  const idleFor = now.getTime() - row.lastSeenAt.getTime();
  if (row.expiresAt <= now || idleFor > IDLE_LIFETIME_MS) return null;

  if (idleFor > LAST_SEEN_WRITE_MS) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.sessionId));
  }
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, row.id));
  return {
    id: row.id, organizationId: row.organizationId, email: row.email, displayName: row.displayName,
    sessionId: row.sessionId, roles: roles.map((r) => r.role),
  };
}

export async function revokeSession(db: Db, sessionId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
}

export async function revokeAllSessions(db: Db, userId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
