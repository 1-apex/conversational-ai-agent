"use client";

import { useEffect, useState } from "react";

interface CallRow {
  id: string;
  started_at: string;
  duration: number | null;
  agents_used: string[] | null;
  sentiment: string | null;
  brief: { summary?: string } | null;
  created_at: string;
}

function fmtDuration(s: number | null) {
  if (s == null) return "—";
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function avgDuration(calls: CallRow[]) {
  const valid = calls.filter(c => c.duration != null);
  if (!valid.length) return null;
  return Math.round(valid.reduce((s, c) => s + (c.duration ?? 0), 0) / valid.length);
}

function mostUsedAgent(calls: CallRow[]) {
  const counts: Record<string, number> = {};
  for (const c of calls) {
    for (const a of (c.agents_used ?? [])) {
      counts[a] = (counts[a] ?? 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "—";
}

function positiveRate(calls: CallRow[]) {
  if (!calls.length) return 0;
  return Math.round((calls.filter(c => c.sentiment === "positive").length / calls.length) * 100);
}

// Calls per day — last 7 days
function callsPerDay(calls: CallRow[]) {
  const days: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-US", { weekday: "short" });
    const dateStr = d.toISOString().slice(0, 10);
    const count = calls.filter(c => c.created_at.slice(0, 10) === dateStr).length;
    days.push({ label, count });
  }
  return days;
}

// Agent usage counts
function agentUsage(calls: CallRow[]) {
  const counts: Record<string, number> = {};
  for (const c of calls) {
    for (const a of (c.agents_used ?? [])) {
      counts[a] = (counts[a] ?? 0) + 1;
    }
  }
  const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }));
}

// Sentiment ring SVG
function SentimentRing({ calls }: { calls: CallRow[] }) {
  const pos = calls.filter(c => c.sentiment === "positive").length;
  const neg = calls.filter(c => c.sentiment === "negative").length;
  const neu = calls.filter(c => c.sentiment !== "positive" && c.sentiment !== "negative").length;
  const total = calls.length || 1;

  const r = 40;
  const circ = 2 * Math.PI * r;
  const posArc = (pos / total) * circ;
  const negArc = (neg / total) * circ;
  const neuArc = (neu / total) * circ;

  const posOffset = 0;
  const negOffset = -(posArc);
  const neuOffset = -(posArc + negArc);

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="18" />
        {calls.length > 0 && <>
          <circle cx="60" cy="60" r={r} fill="none" stroke="#10b981" strokeWidth="18"
            strokeDasharray={`${posArc} ${circ - posArc}`}
            strokeDashoffset={posOffset}
            transform="rotate(-90 60 60)" />
          <circle cx="60" cy="60" r={r} fill="none" stroke="#ef4444" strokeWidth="18"
            strokeDasharray={`${negArc} ${circ - negArc}`}
            strokeDashoffset={negOffset}
            transform="rotate(-90 60 60)" />
          <circle cx="60" cy="60" r={r} fill="none" stroke="#d1d5db" strokeWidth="18"
            strokeDasharray={`${neuArc} ${circ - neuArc}`}
            strokeDashoffset={neuOffset}
            transform="rotate(-90 60 60)" />
        </>}
        <text x="60" y="56" textAnchor="middle" className="fill-gray-800 text-xs font-bold" fontSize="16" fontWeight="bold" fill="#1f2937">{total}</text>
        <text x="60" y="72" textAnchor="middle" fontSize="10" fill="#6b7280">calls</text>
      </svg>
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /><span className="text-gray-600">Positive ({pos})</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /><span className="text-gray-600">Negative ({neg})</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" /><span className="text-gray-600">Neutral ({neu})</span></div>
      </div>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (sentiment === "positive") return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Positive</span>;
  if (sentiment === "negative") return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Negative</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Neutral</span>;
}

export default function DashboardPage() {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/analytics")
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setCalls(d.calls as CallRow[]);
      })
      .catch(() => setError("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  const avg = avgDuration(calls);
  const topAgent = mostUsedAgent(calls);
  const posRate = positiveRate(calls);
  const perDay = callsPerDay(calls);
  const maxDay = Math.max(...perDay.map(d => d.count), 1);
  const agents = agentUsage(calls);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-400">Loading analytics…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-red-500">{error}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Kyron Analytics</h1>
            <p className="text-xs text-gray-400 mt-0.5">Last {calls.length} calls</p>
          </div>
          <a href="/" className="text-xs text-teal-600 hover:underline">← Back to agent</a>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Calls", value: String(calls.length) },
            { label: "Avg Duration", value: fmtDuration(avg) },
            { label: "Top Agent", value: topAgent },
            { label: "Positive Rate", value: `${posRate}%` },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium">{card.label}</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Sentiment ring */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Sentiment Distribution</h2>
            <SentimentRing calls={calls} />
          </div>

          {/* Agent usage */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Agent Usage</h2>
            {agents.length === 0 ? (
              <p className="text-xs text-gray-400">No data</p>
            ) : (
              <div className="space-y-3">
                {agents.map(a => (
                  <div key={a.name} className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span className="capitalize">{a.name}</span>
                      <span className="text-gray-400">{a.count} ({a.pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-400 rounded-full transition-all" style={{ width: `${a.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Calls per day */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Calls — Last 7 Days</h2>
          <div className="flex items-end gap-3 h-24">
            {perDay.map(d => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-500">{d.count || ""}</span>
                <div className="w-full bg-gray-100 rounded-t-md overflow-hidden flex flex-col justify-end" style={{ height: "64px" }}>
                  <div
                    className="w-full bg-teal-400 rounded-t-md transition-all"
                    style={{ height: `${(d.count / maxDay) * 64}px` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent calls table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Recent Calls</h2>
          </div>
          {calls.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No calls recorded yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-2.5 font-medium">ID</th>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Duration</th>
                  <th className="px-5 py-2.5 font-medium">Agents</th>
                  <th className="px-5 py-2.5 font-medium">Sentiment</th>
                  <th className="px-5 py-2.5 font-medium">Brief</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c, i) => (
                  <tr key={c.id} className={`border-b border-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                    <td className="px-5 py-2.5 font-mono text-gray-400">{c.id.slice(0, 8)}</td>
                    <td className="px-5 py-2.5 text-gray-600">{fmtDate(c.created_at)}</td>
                    <td className="px-5 py-2.5 font-mono text-gray-600">{fmtDuration(c.duration)}</td>
                    <td className="px-5 py-2.5 text-gray-500">{(c.agents_used ?? []).join(", ") || "—"}</td>
                    <td className="px-5 py-2.5"><SentimentBadge sentiment={c.sentiment} /></td>
                    <td className="px-5 py-2.5 text-gray-500 max-w-xs truncate">{c.brief?.summary ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
