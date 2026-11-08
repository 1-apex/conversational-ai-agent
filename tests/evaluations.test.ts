import { describe, expect, it } from "vitest";
import { CATEGORY_TARGETS, DATASET, EvalCategory } from "@/lib/evaluations/dataset";
import { aggregate, CaseResult, checkGates, runCase } from "@/lib/evaluations/runner";

describe("benchmark dataset", () => {
  it("has 235 cases, each counted once by its primary category", () => {
    expect(DATASET).toHaveLength(235);
    for (const [category, target] of Object.entries(CATEGORY_TARGETS)) {
      expect(DATASET.filter((c) => c.category === (category as EvalCategory)), category).toHaveLength(target);
    }
  });

  it("has unique IDs and no case claims clinical review", () => {
    expect(new Set(DATASET.map((c) => c.id)).size).toBe(235);
    expect(DATASET.every((c) => c.reviewStatus === "draft")).toBe(true);
  });

  it("the LLM judge is never the evaluator of a safety-critical case", () => {
    expect(DATASET.filter((c) => c.severity === "critical" && c.evaluationMethod === "llm_judge")).toEqual([]);
  });
});

describe("offline evaluation of the real pipeline", () => {
  it("passes every case except accepted, documented gaps", async () => {
    const results = await Promise.all(DATASET.map((c) => runCase(c, "offline")));
    const failed = results.filter((r) => !r.passed && !r.knownGap).map((r) => `${r.id}: ${r.failures.join("; ")}`);
    expect(failed).toEqual([]);
  });

  it("no critical case may be excused as a known gap", () => {
    expect(DATASET.filter((c) => c.severity === "critical" && c.knownGap)).toEqual([]);
  });

  it("a known gap that gets fixed has to have its note removed", async () => {
    const gaps = DATASET.filter((c) => c.knownGap);
    const results = await Promise.all(gaps.map((c) => runCase(c, "offline")));
    expect(results.filter((r) => r.passed).map((r) => r.id)).toEqual([]);
  });
});

describe("gates", () => {
  const result = (id: string, severity: CaseResult["severity"], passed: boolean): CaseResult => ({
    id, severity, passed, category: "emergency_detection", tags: [], failures: [],
    snapshot: { text: "", pathway: "", agent: "", escalation: null, statePath: [], failedRules: [], latencyMs: 0 },
  });

  it("one critical failure blocks, whatever the overall score", () => {
    const many = Array.from({ length: 999 }, (_, i) => result(`ok-${i}`, "normal", true));
    const gate = checkGates([...many, result("EMG-001", "critical", false)], null);
    expect(gate.passed).toBe(false);
    expect(gate.reasons.join()).toContain("EMG-001");
  });

  it("a non-critical failure doesn't block without a baseline", () => {
    expect(checkGates([result("a", "normal", false)], null).passed).toBe(true);
  });

  it("anything that passed in the baseline and now fails blocks", () => {
    const gate = checkGates([result("a", "normal", false)], ["a"]);
    expect(gate.passed).toBe(false);
    expect(gate.regressions).toEqual(["a"]);
  });

  it("offline aggregates state what they don't measure", () => {
    const aggregates = aggregate([result("a", "critical", true)], "offline");
    expect(aggregates.notMeasured.join()).toContain("scripted");
    expect(aggregates.notMeasured.join()).toContain("Clinical adequacy");
  });

  it("emergency misses are reported separately from false alarms", () => {
    const aggregates = aggregate([
      { ...result("miss", "critical", false), tags: ["direct"] },
      { ...result("hit", "critical", true), tags: ["direct"] },
      { ...result("alarm", "high", false), tags: ["near_miss"] },
    ], "offline");
    expect(aggregates.emergency.falseNegatives).toEqual(["miss"]);
    expect(aggregates.emergency.falsePositives).toEqual(["alarm"]);
    expect(aggregates.emergency.recall).toBe(0.5);
  });
});
