import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as analytics } from "@/app/api/analytics/route";
import { POST as calls } from "@/app/api/calls/route";
import { POST as extract } from "@/app/api/extract/route";
import { POST as tts } from "@/app/api/tts/route";
import { getRequest, jsonRequest } from "./helpers";

const db = vi.hoisted(() => ({ getDb: vi.fn(), ensureSchema: vi.fn() }));
const claude = vi.hoisted(() => ({ extractCallBrief: vi.fn() }));
const groq = vi.hoisted(() => ({ extractWithGroq: vi.fn() }));
const convert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => db);
vi.mock("@/lib/claude-client", () => claude);
vi.mock("@/lib/groq-client", () => groq);
vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: class { textToSpeech = { convert }; },
}));

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  db.getDb.mockReset();
  db.getDb.mockReturnValue(null);
  claude.extractCallBrief.mockReset();
  groq.extractWithGroq.mockReset();
  convert.mockReset();
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("GROQ_API_KEY", "");
  vi.stubEnv("ELEVENLABS_API_KEY", "");
});

const turn = { id: "t1", speaker: "prospect", text: "Tell me about the G5", timestamp: 1 };
const brief = { summary: "S", entities: { names: [], companies: [], products: [], contacts: [] }, actionItems: [], duration: 5 };

describe("POST /api/tts", () => {
  const post = (body: unknown) => tts(jsonRequest("/api/tts", body));

  it("returns 501 without a key, which the client relies on", async () => {
    expect((await post({ text: "hi" })).status).toBe(501);
  });

  it("rejects missing and oversized text before calling the provider", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "key");
    expect((await post({})).status).toBe(400);
    expect((await post({ text: "x".repeat(1001) })).status).toBe(400);
    expect(convert).not.toHaveBeenCalled();
  });

  it("streams audio", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "key");
    convert.mockResolvedValue(new Response("audio").body);
    const res = await post({ text: "hi", agent: "sales" });
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(res.headers.get("x-correlation-id")).toBeTruthy();
  });

  it("doesn't leak provider errors", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "key");
    convert.mockRejectedValue(new Error("CANARY quota detail"));
    const res = await post({ text: "hi" });
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("CANARY");
  });
});

describe("POST /api/extract", () => {
  const post = (body: unknown = { turns: [turn], duration: 5 }) => extract(jsonRequest("/api/extract", body));

  it("rejects an empty transcript", async () => {
    expect((await post({ turns: [] })).status).toBe(400);
  });

  it("uses rule-based extraction with no keys", async () => {
    const json = await (await post()).json();
    expect(json.summary).toContain("5s call");
    expect(json.duration).toBe(5);
  });

  it("falls through to Groq when Claude fails", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "key");
    vi.stubEnv("GROQ_API_KEY", "key");
    claude.extractCallBrief.mockRejectedValue(new Error("down"));
    groq.extractWithGroq.mockResolvedValue({ ...brief, summary: "from groq" });
    expect((await (await post()).json()).summary).toBe("from groq");
  });

  it("falls through to rules when every provider fails", async () => {
    vi.stubEnv("GROQ_API_KEY", "key");
    groq.extractWithGroq.mockRejectedValue(new Error("down"));
    const res = await post();
    expect(res.status).toBe(200);
    expect((await res.json()).summary).toContain("5s call");
  });

  it("treats malformed model output as a failure", async () => {
    vi.stubEnv("GROQ_API_KEY", "key");
    groq.extractWithGroq.mockResolvedValue({ nonsense: true });
    expect((await (await post()).json()).summary).toContain("5s call");
  });

  it("fills in missing fields, so a partial brief can't crash the UI", async () => {
    vi.stubEnv("GROQ_API_KEY", "key");
    groq.extractWithGroq.mockResolvedValue({ summary: "S", duration: 5 });
    const json = await (await post()).json();
    expect(json.entities.names).toEqual([]);
    expect(json.actionItems).toEqual([]);
  });
});

describe("POST /api/calls", () => {
  const body = { id: "abc", startedAt: "2026-11-05T00:00:00.000Z" };
  const post = (b: unknown = body) => calls(jsonRequest("/api/calls", b));

  it("skips logging without a database", async () => {
    expect(await (await post()).json()).toEqual({ ok: false, reason: "no-db" });
  });

  it("rejects invalid input before touching the database", async () => {
    const sql = vi.fn();
    db.getDb.mockReturnValue(sql);
    expect((await post({ id: "abc" })).status).toBe(400);
    expect((await post({ ...body, startedAt: "yesterday" })).status).toBe(400);
    expect((await post({ ...body, sentiment: "<script>" })).status).toBe(400);
    expect((await post({ ...body, agentsUsed: ["root"] })).status).toBe(400);
    expect(sql).not.toHaveBeenCalled();
  });

  it("writes a valid call", async () => {
    const sql = vi.fn(async () => []);
    db.getDb.mockReturnValue(sql);
    expect(await (await post()).json()).toEqual({ ok: true });
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("doesn't leak database errors", async () => {
    db.getDb.mockReturnValue(vi.fn(async () => { throw new Error("CANARY connection string"); }));
    const res = await post();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("CANARY");
  });
});

describe("GET /api/analytics", () => {
  const get = () => analytics(getRequest("/api/analytics"));

  it("reports no-db in the envelope the dashboard reads", async () => {
    const res = await get();
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("no-db");
  });

  it("returns a safe error if the query fails", async () => {
    db.getDb.mockReturnValue(vi.fn(async () => { throw new Error("CANARY query"); }));
    const res = await get();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("CANARY");
  });
});
