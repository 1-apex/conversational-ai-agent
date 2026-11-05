import { expect, it, vi } from "vitest";
import { createLogger } from "@/lib/observability/logger";

it("drops every field that isn't allowlisted", () => {
  const spy = vi.spyOn(console, "info").mockImplementation(() => {});
  createLogger("corr-1").info("test.event", {
    route: "agent",
    status: 200,
    transcript: "CANARY-TRANSCRIPT",
    message: "CANARY-MESSAGE",
    apiKey: "CANARY-KEY",
  });

  const line = String(spy.mock.calls[0][0]);
  expect(line).not.toContain("CANARY");
  expect(JSON.parse(line)).toEqual({
    level: "info", event: "test.event", correlationId: "corr-1", route: "agent", status: 200,
  });
});
