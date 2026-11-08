import { describe, expect, it } from "vitest";
import { parseAgentResponse } from "@/lib/agent-response";

describe("parseAgentResponse", () => {
  it("parses the contract", () => {
    const raw = JSON.stringify({
      reply: "Sure.", proposedAgent: "product", handoffReason: "specs", requestsEscalation: false, citedChunkIds: ["a"],
    });
    expect(parseAgentResponse(raw)).toMatchObject({
      reply: "Sure.", proposedAgent: "product", citedChunkIds: ["a"], wellFormed: true,
    });
  });

  it("drops invented agent names and malformed fields", () => {
    const raw = JSON.stringify({ reply: "Hi", proposedAgent: "root", requestsEscalation: "yes", citedChunkIds: "x" });
    expect(parseAgentResponse(raw)).toMatchObject({ reply: "Hi", proposedAgent: null, requestsEscalation: false, citedChunkIds: [] });
  });

  it("reads the older handoff field", () => {
    expect(parseAgentResponse(JSON.stringify({ reply: "Hi", handoff: "sales" })).proposedAgent).toBe("sales");
  });

  it("strips JSON leaked after plain text", () => {
    expect(parseAgentResponse(`Sure, it's light. {"handoff":null}`).reply).toBe("Sure, it's light");
  });

  it("recovers the text when max_tokens truncates the JSON", () => {
    const parsed = parseAgentResponse(`{"reply":"The G5 has a \\"quiet\\" mode, which`);
    expect(parsed.reply).toBe(`The G5 has a "quiet" mode, which`);
    expect(parsed.wellFormed).toBe(false);
  });

  it.each([`{"agent":"sales"`, `{"reply":"`, `{`, `{"agent":"sales"}`])("returns no text for unusable output: %s", (raw) => {
    expect(parseAgentResponse(raw).reply).toBe("");
  });

  it("passes plain text through", () => {
    expect(parseAgentResponse("Just text.").reply).toBe("Just text.");
  });
});
