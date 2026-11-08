import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getDb } = await import("@/lib/db");
const { evaluationResults, evaluationRuns } = await import("@/lib/db/schema");
const { DATASET } = await import("@/lib/evaluations/dataset");
const { judgeQuality } = await import("@/lib/evaluations/judge");
const { aggregate, checkGates, runCase, runMetadata } = await import("@/lib/evaluations/runner");
const { classifyWithGroq, generateWithGroq, GROQ_MODEL } = await import("@/lib/providers/llm");

const tier = process.argv[2] === "live" ? "live" as const : "offline" as const;
const promote = process.argv.includes("--promote-baseline");
const repeats = tier === "live" ? Number(process.env.EVAL_REPEATS ?? 1) : 1;

if (tier === "live" && !process.env.GROQ_API_KEY) {
  console.error("Live evaluation needs GROQ_API_KEY. No scores were produced.");
  process.exit(2);
}

const baselinePath = path.join(process.cwd(), "lib", "evaluations", `baseline.${tier}.json`);
const baseline: string[] | null = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, "utf8")) : null;

const results = [];
for (const testCase of DATASET) {
  // A live case must pass every repeat, because the model varies between runs
  let worst = await runCase(testCase, tier, generateWithGroq, classifyWithGroq);
  for (let i = 1; i < repeats && worst.passed; i++) worst = await runCase(testCase, tier, generateWithGroq, classifyWithGroq);
  if (tier === "live" && testCase.evaluationMethod === "llm_judge") {
    const judged = await judgeQuality(testCase.input.at(-1)!, worst.snapshot.text).catch(() => null);
    (worst.snapshot as unknown as Record<string, unknown>).judge = judged;
  }
  results.push(worst);
}

const aggregates = aggregate(results, tier);
const gate = checkGates(results, baseline);
const metadata = runMetadata(tier, tier === "live" ? GROQ_MODEL : "stub");
let commit: string | null = null;
try { commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim(); } catch { /* not a git checkout */ }

// ── Report ────────────────────────────────────────────────────────────────
const reportDir = path.join(process.cwd(), "eval-reports");
fs.mkdirSync(reportDir, { recursive: true });
const report = { metadata: { ...metadata, commit }, aggregates, gate, results };
const reportPath = path.join(reportDir, `${tier}-${metadata.timestamp.replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`\n${tier.toUpperCase()} evaluation of ${metadata.datasetVersion} (${metadata.datasetHash})`);
if (tier === "offline") console.log("Model replies are SCRIPTED. This tests the safety and routing code, not a real model.");
console.log(`Passed ${aggregates.passed} of ${aggregates.total}`);
for (const [category, score] of Object.entries(aggregates.byCategory)) console.log(`  ${category}: ${score.passed}/${score.total}`);
console.log(`Emergency recall: ${(aggregates.emergency.recall * 100).toFixed(1)}% of ${aggregates.emergency.positives} (not clinically reviewed)`);
console.log(`Emergency false negatives: ${aggregates.emergency.falseNegatives.join(", ") || "none"}`);
console.log(`Emergency false positives: ${aggregates.emergency.falsePositives.join(", ") || "none"} of ${aggregates.emergency.nearMisses} near misses`);
console.log(`Medical false negatives: ${aggregates.medical.falseNegatives.join(", ") || "none"}`);
console.log(`Not measured by this run:`);
for (const item of aggregates.notMeasured) console.log(`  - ${item}`);
for (const r of results.filter((x) => !x.passed)) {
  console.log(`FAIL ${r.id} [${r.severity}] ${r.failures.join("; ")}${r.knownGap ? ` (known gap: ${r.knownGap})` : ""}`);
}
console.log(`Gate: ${gate.passed ? "PASS" : "BLOCKED"}${gate.reasons.length ? `\n  ${gate.reasons.join("\n  ")}` : ""}`);
console.log(`Report: ${path.relative(process.cwd(), reportPath)}`);

// ── Optional: store the run for the dashboard ─────────────────────────────
const db = await getDb();
if (db) {
  try {
    const [run] = await db.insert(evaluationRuns).values({
      tier, datasetVersion: metadata.datasetVersion, datasetHash: metadata.datasetHash,
      provider: metadata.provider, modelId: metadata.modelId, promptVersion: metadata.promptVersion,
      policyVersion: metadata.policyVersion, knowledgeVersion: metadata.knowledgeVersion, codeCommit: commit,
      aggregates, gateResult: gate.passed ? "pass" : "blocked",
    }).returning({ id: evaluationRuns.id });
    await db.insert(evaluationResults).values(results.map((r) => ({
      runId: run.id, caseId: r.id, category: r.category, severity: r.severity,
      passed: r.passed, failures: r.failures, snapshot: r.snapshot,
    })));
    console.log(`Stored run ${run.id}`);
  } catch (error) {
    console.error("Couldn't store the run:", error instanceof Error ? error.name : "Unknown");
  }
}

// A person decides when a baseline moves. It never updates by itself.
if (promote) {
  fs.writeFileSync(baselinePath, JSON.stringify(results.filter((r) => r.passed).map((r) => r.id), null, 2));
  console.log(`Baseline promoted: ${path.relative(process.cwd(), baselinePath)}`);
}

process.exit(gate.passed ? 0 : 1);
