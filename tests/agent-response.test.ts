import { describe, expect, it } from "vitest";
import { parseAgentResponse, UNPARSEABLE_REPLY } from "@/lib/agent-response";

describe("parseAgentResponse", () => {
  it("parses a valid response", () => {
    const raw = JSON.stringify({ reply: "Sure.", agent: "sales", handoff: "product" });
    expect(parseAgentResponse(raw, "general")).toEqual({ reply: "Sure.", agent: "sales", handoff: "product" });
  });

  it("rejects invented agent names", () => {
    const raw = JSON.stringify({ reply: "Hi", agent: "admin", handoff: "root" });
    expect(parseAgentResponse(raw, "general")).toEqual({ reply: "Hi", agent: "general", handoff: null });
  });

  it("strips JSON leaked after plain text", () => {
    const raw = `Sure, it's light. {"agent":"sales","handoff":null}`;
    expect(parseAgentResponse(raw, "sales").reply).toBe("Sure, it's light");
  });

  it("recovers the text when max_tokens truncates the JSON", () => {
    const raw = `{"reply":"The G5 has six settings and a \\"quiet\\" mode, which`;
    const parsed = parseAgentResponse(raw, "product");
    expect(parsed.reply).toBe(`The G5 has six settings and a "quiet" mode, which`);
    expect(parsed.reply).not.toContain("{");
  });

  it.each([`{"agent":"sales"`, `{"reply":"`, `{`])("never speaks raw JSON: %s", (raw) => {
    expect(parseAgentResponse(raw, "sales").reply).toBe(UNPARSEABLE_REPLY);
  });

  it("uses the fallback reply when a valid object has no reply", () => {
    expect(parseAgentResponse(`{"agent":"sales"}`, "sales").reply).toBe(UNPARSEABLE_REPLY);
  });

  it("passes plain text through", () => {
    expect(parseAgentResponse("Just text.", "sales").reply).toBe("Just text.");
  });
});
