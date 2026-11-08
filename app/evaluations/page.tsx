"use client";

import { useEffect, useState } from "react";
import StaffShell, { api } from "@/components/staff/StaffShell";

interface Aggregates {
  total: number; passed: number;
  byCategory: Record<string, { passed: number; total: number }>;
  emergency: { recall: number; falseNegatives: string[]; falsePositives: string[]; positives: number; nearMisses: number };
  medical: { compliance: number; falseNegatives: string[] };
  routingAccuracy: number;
  piiLeaks: string[];
  injectionFailures: string[];
  notMeasured: string[];
}
interface Run {
  id: string; tier: string; datasetVersion: string; datasetHash: string; modelId: string | null;
  promptVersion: string; policyVersion: string; knowledgeVersion: string; codeCommit: string | null;
  aggregates: Aggregates; gateResult: string; createdAt: string;
}
interface Failed { id: string; caseId: string; category: string; severity: string; failures: string[]; }

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function Metric({ label, value, how }: { label: string; value: string; how: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
      <p className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-[11px] text-gray-500 mt-1">{how}</p>
    </div>
  );
}

function Evaluations() {
  const [runs, setRuns]     = useState<Run[]>([]);
  const [selected, setSelected] = useState<Run | null>(null);
  const [failed, setFailed] = useState<Failed[]>([]);
  const [error, setError]   = useState("");

  useEffect(() => {
    api<{ runs: Run[] }>("/api/evaluations/runs").then((d) => {
      setRuns(d.runs);
      setSelected(d.runs[0] ?? null);
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    api<{ failed: Failed[] }>(`/api/evaluations/runs/${selected.id}`).then((d) => setFailed(d.failed)).catch((e) => setError(e.message));
  }, [selected]);

  if (error) return <p role="alert" className="text-sm text-red-600">Error: {error}</p>;
  if (!selected) {
    return <p className="text-sm text-gray-600">No run has been stored yet. Run <code>npm run eval:offline</code> with a database configured. Nothing here is sample data.</p>;
  }
  const a = selected.aggregates;

  return (
    <div className="space-y-4 text-xs">
      {selected.tier === "offline" && (
        <p role="note" className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
          <strong>Offline run: every model reply was scripted.</strong> This measures the safety, routing and validation code. It says nothing about what the real model would say.
        </p>
      )}
      <p className="text-gray-600">
        Gate: <strong className={selected.gateResult === "pass" ? "text-teal-700" : "text-red-600"}>{selected.gateResult}</strong> ·
        {" "}{selected.tier} · model {selected.modelId ?? "none"} · dataset {selected.datasetVersion} ({selected.datasetHash}) ·
        {" "}prompt {selected.promptVersion} · policy {selected.policyVersion} · knowledge {selected.knowledgeVersion} · commit {selected.codeCommit ?? "unknown"}
      </p>

      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Overall" value={`${a.passed}/${a.total}`} how="Cases where every assertion held" />
        <Metric label="Emergency recall" value={pct(a.emergency.recall)} how={`${a.emergency.positives} synthetic cases, not clinically reviewed. Misses: ${a.emergency.falseNegatives.length}`} />
        <Metric label="False emergency alarms" value={`${a.emergency.falsePositives.length}/${a.emergency.nearMisses}`} how="Near-miss wording wrongly treated as an emergency" />
        <Metric label="Medical boundary" value={pct(a.medical.compliance)} how="No forbidden content, correct script" />
        <Metric label="Routing accuracy" value={pct(a.routingAccuracy)} how="Final agent matched the expected one" />
        <Metric label="PII leaks" value={String(a.piiLeaks.length)} how="Canary values reaching the model, storage or speech" />
        <Metric label="Injection failures" value={String(a.injectionFailures.length)} how="Refusal not given, or instructions leaked" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">By category</h2>
        {Object.entries(a.byCategory).map(([category, score]) => (
          <div key={category} className="flex items-center gap-2 mb-1">
            <span className="w-48 text-gray-600">{category.replace(/_/g, " ")}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded"><div className="h-2 bg-teal-500 rounded" style={{ width: `${(score.passed / score.total) * 100}%` }} /></div>
            <span className="w-12 text-right text-gray-600">{score.passed}/{score.total}</span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        <h2 className="text-sm font-semibold text-gray-800 mb-1">Not measured by this run</h2>
        <ul className="list-disc pl-4 text-gray-600">{a.notMeasured.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        <h2 className="text-sm font-semibold text-gray-800 mb-1">Failed cases ({failed.length})</h2>
        {failed.length === 0 && <p className="text-gray-500">None.</p>}
        {failed.map((f) => <p key={f.id} className="mb-1"><span className="font-mono">{f.caseId}</span> [{f.severity}] {f.failures.join("; ")}</p>)}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y">
        <h2 className="text-sm font-semibold text-gray-800 p-3">History</h2>
        {runs.map((run) => (
          <button key={run.id} onClick={() => setSelected(run)} className={`w-full text-left p-2 hover:bg-gray-50 ${selected.id === run.id ? "bg-teal-50" : ""}`}>
            {new Date(run.createdAt).toLocaleString()} · {run.tier} · {run.aggregates.passed}/{run.aggregates.total} · gate {run.gateResult} · {run.promptVersion} · {run.modelId ?? "no model"}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EvaluationsPage() {
  return (
    <StaffShell title="Evaluations" intro="Each number says what it counts. Synthetic data only, and no case has been clinically reviewed.">
      {() => <Evaluations />}
    </StaffShell>
  );
}
