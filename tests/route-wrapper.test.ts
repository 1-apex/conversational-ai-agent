import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { route } from "@/lib/http/route";
import { InMemoryLimiter } from "@/lib/rate-limit";
import { jsonRequest } from "./helpers";

const allow = { limit: async () => ({ success: true }) };

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const echo = route({
  name: "test",
  access: "public",
  limiter: allow,
  body: z.object({ text: z.string().max(5) }),
  maxBytes: 100,
  handler: async ({ body }) => NextResponse.json({ text: body.text }),
});

describe("route wrapper", () => {
  it("passes validated, stripped input to the handler", async () => {
    const res = await echo(jsonRequest("/x", { text: "hi", forged: "field" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "hi" });
  });

  it("adds a correlation ID to every response", async () => {
    const res = await echo(jsonRequest("/x", { text: "hi" }));
    expect(res.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each([
    ["malformed JSON", "{not json", 400, "invalid_json"],
    ["schema failure", { text: "too long for this" }, 400, "invalid_request"],
    ["oversized body", { text: "x".repeat(200) }, 413, "payload_too_large"],
  ])("rejects %s with a safe envelope", async (_name, body, status, code) => {
    const res = await echo(jsonRequest("/x", body as string));
    expect(res.status).toBe(status);
    const json = await res.json();
    expect(json.error.code).toBe(code);
    expect(json.error.correlationId).toBe(res.headers.get("x-correlation-id"));
  });

  it("rejects by declared size before reading the body", async () => {
    const res = await echo(jsonRequest("/x", { text: "hi" }, { "content-length": "99999" }));
    expect(res.status).toBe(413);
  });

  it("rate limits before running the handler", async () => {
    const handler = vi.fn(async () => NextResponse.json({}));
    const limited = route({ name: "t", access: "public", limiter: new InMemoryLimiter(1, 60_000), handler });
    const headers = { "x-real-ip": "192.0.2.1" };
    expect((await limited(jsonRequest("/x", {}, headers))).status).toBe(200);
    const blocked = await limited(jsonRequest("/x", {}, headers));
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error.code).toBe("rate_limited");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("never exposes a thrown error's message", async () => {
    const failing = route({
      name: "t", access: "public", limiter: allow,
      handler: async () => { throw new Error("CANARY db password"); },
    });
    const res = await failing(jsonRequest("/x", {}));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("CANARY");
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).not.toContain("CANARY");
    expect(logged).toContain("request.failed");
  });
});
