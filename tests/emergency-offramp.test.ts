import { describe, expect, it } from "vitest";
import { isEmergencyStatement } from "@/lib/emergency-offramp";

describe("isEmergencyStatement", () => {
  it.each([
    "I can't breathe", "i cant breathe", "I cannot breathe", "I can’t breathe",
    "my husband can't breathe", "she's not breathing", "he stopped breathing",
    "I'm having chest pain", "I think it's a heart attack", "my mom had a stroke",
    "he passed out", "she's unconscious", "his lips are blue", "he won't wake up",
    "I feel like I'm suffocating", "I'm really struggling for air",
    "I want to kill myself", "I'm dying", "my wife is dying", "this is an emergency",
    "I need an ambulance", "please call 911", "my concentrator caught fire",
  ])("matches %j", (text) => {
    expect(isEmergencyStatement(text)).toBe(true);
  });

  // Deliberate: an unnecessary message costs far less than a missed emergency
  it("still matches negated statements", () => {
    expect(isEmergencyStatement("I'm not having chest pain")).toBe(true);
  });

  it.each([
    "how much does the G5 weigh", "what's the battery life on the Rove 6",
    "my battery is dying", "does medicare cover this", "how does pulse dose work",
    "I have an emergency backup battery question", "I'd like to know the warranty",
    "can I take it on a plane", "is it breathable", "what is the price",
  ])("does not match %j", (text) => {
    expect(isEmergencyStatement(text)).toBe(false);
  });

  it.each([null, undefined, 5, {}, ""])("ignores non-text input %j", (value) => {
    expect(isEmergencyStatement(value)).toBe(false);
  });

  // Documents the stopgap's limits. Replacing these with real detection is Phase 2.
  it("known gap: misses indirect wording", () => {
    expect(isEmergencyStatement("my oxygen machine stopped and I feel dizzy")).toBe(false);
  });
});
