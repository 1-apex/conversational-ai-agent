"use client";

import { useEffect, useState } from "react";

interface CallBrief {
  summary?:     string;
  actionItems?: string[];
  entities?: {
    names?:     string[];
    companies?: string[];
    products?:  string[];
    contacts?:  string[];
  };
  duration?: number;
}

interface CallRow {
  id:          string;
  started_at:  string;
  duration:    number | null;
  agents_used: string[] | null;
  sentiment:   string | null;
  brief:       CallBrief | null;
  created_at:  string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDuration(s: number | null) {
  if (s == null) return "—";
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function avgDuration(calls: CallRow[]) {
  const valid = calls.filter(c => c.duration != null);
  if (!valid.length) return null;
  return Math.round(valid.reduce((s, c) => s + (c.duration ?? 0), 0) / valid.length);
}

function mostUsedAgent(calls: CallRow[]) {
  const counts: Record<string, number> = {};
  for (const c of calls)
    for (const a of (c.agents_used ?? []))
      counts[a] = (counts[a] ?? 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "—";
}

function positiveRate(calls: CallRow[]) {
  if (!calls.length) return 0;
  return Math.round((calls.filter(c => c.sentiment === "positive").length / calls.length) * 100);
}

function callsPerDay(calls: CallRow[]) {
  const days: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label   = d.toLocaleDateString("en-US", { weekday: "short" });
    const dateStr = d.toISOString().slice(0, 10);
    const count   = calls.filter(c => c.created_at.slice(0, 10) === dateStr).length;
    days.push({ label, count });
  }
  return days;
}

function agentUsage(calls: CallRow[]) {
  const counts: Record<string, number> = {};
  for (const c of calls)
    for (const a of (c.agents_used ?? []))
      counts[a] = (counts[a] ?? 0) + 1;
  const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }));
}

// Extract keyword frequencies from all brief summaries
const STOP = new Set([
  // articles / conjunctions / prepositions
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by","as",
  "from","into","over","through","about","after","before","between","during","under",
  // pronouns
  "i","we","you","he","she","they","it","this","that","these","those","our","your",
  "their","my","his","her","its","them","him","her","us","who","which","what",
  // auxiliary verbs
  "is","was","are","were","be","been","being","have","has","had","do","does","did",
  "will","would","could","should","may","might","shall","must","need","ought",
  // common words
  "if","so","no","not","just","also","more","very","much","like","well","then",
  "there","here","when","how","said","even","still","already","now","yes","thank",
  "thanks","sure","okay","yes","know","think","time","back","get","got","take",
  "make","want","need","use","used","using","come","came","going","went","one",
  "two","three","four","five","six","seven","eight","nine","ten","new","any","all",
  "some","other","such","same","each","both","few","many","own","than","then",
  // call transcript filler
  "call","caller","called","agent","customer","specialist","spoke","speaking",
  "discussed","discussion","mentioned","mention","asked","asking","expressed",
  "inquired","inquiry","inquiry","provided","provide","offering","offered","noted",
  "said","indicated","stated","explained","ended","ending","outcome","action",
  "transfer","transferred","connect","connected","regarding","information","details",
  "further","specific","another","during","while","without","however","although",
  "because","therefore","since","thus","either","neither","whether","upon","above",
  "below","throughout","around","toward","towards","within","along","against",
  "following","followed","resulted","result","taken","take","given","give","able",
  "unable","tried","looking","looked","happy","helped","help","right","know","knew",
  "call","calls","brief","topic","topics","question","questions","response","answer",
]);

function buildWordMap(calls: CallRow[]): [string, number][] {
  const freq: Record<string, number> = {};
  for (const c of calls) {
    const text = c.brief?.summary ?? "";
    if (!text) continue;
    const words = text
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP.has(w));
    for (const w of words) freq[w] = (freq[w] ?? 0) + 1;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 50);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SentimentRing({ calls }: { calls: CallRow[] }) {
  const pos   = calls.filter(c => c.sentiment === "positive").length;
  const neg   = calls.filter(c => c.sentiment === "negative").length;
  const neu   = calls.filter(c => c.sentiment !== "positive" && c.sentiment !== "negative").length;
  const total = calls.length || 1;

  const r     = 40;
  const circ  = 2 * Math.PI * r;
  const posArc = (pos / total) * circ;
  const negArc = (neg / total) * circ;
  const neuArc = (neu / total) * circ;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="18" />
        {calls.length > 0 && <>
          <circle cx="60" cy="60" r={r} fill="none" stroke="#10b981" strokeWidth="18"
            strokeDasharray={`${posArc} ${circ - posArc}`} strokeDashoffset={0}
            transform="rotate(-90 60 60)" />
          <circle cx="60" cy="60" r={r} fill="none" stroke="#ef4444" strokeWidth="18"
            strokeDasharray={`${negArc} ${circ - negArc}`} strokeDashoffset={-posArc}
            transform="rotate(-90 60 60)" />
          <circle cx="60" cy="60" r={r} fill="none" stroke="#d1d5db" strokeWidth="18"
            strokeDasharray={`${neuArc} ${circ - neuArc}`} strokeDashoffset={-(posArc + negArc)}
            transform="rotate(-90 60 60)" />
        </>}
        <text x="60" y="56" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1f2937">{total}</text>
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
  if (sentiment === "positive")
    return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Positive</span>;
  if (sentiment === "negative")
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Negative</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Neutral</span>;
}

function WordMap({ calls }: { calls: CallRow[] }) {
  const words = buildWordMap(calls);
  if (words.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-4">No brief data yet — complete a call to see topics.</p>;
  }
  const maxFreq = words[0][1];
  const minFreq = words[words.length - 1][1];
  const range   = Math.max(maxFreq - minFreq, 1);

  const colors = [
    "text-teal-600","text-cyan-600","text-violet-600","text-indigo-500",
    "text-emerald-600","text-sky-600","text-purple-600","text-blue-600",
  ];

  return (
    <div className="flex flex-wrap gap-2 items-center justify-center py-2">
      {words.map(([word, freq], i) => {
        const t    = (freq - minFreq) / range; // 0 → smallest, 1 → largest
        const size = Math.round(11 + t * 16);  // 11px – 27px
        const fw   = t > 0.6 ? "700" : t > 0.3 ? "600" : "400";
        const col  = colors[i % colors.length];
        return (
          <span
            key={word}
            className={`${col} leading-none select-none cursor-default transition-opacity hover:opacity-70`}
            style={{ fontSize: `${size}px`, fontWeight: fw }}
            title={`${freq} mention${freq > 1 ? "s" : ""}`}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

function BriefModal({ call, onClose }: { call: CallRow; onClose: () => void }) {
  const brief = call.brief;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Call Brief</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {fmtDate(call.created_at)} · {fmtDuration(call.duration)} · <span className="font-mono">{call.id.slice(0, 8)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Sentiment + agents */}
          <div className="flex items-center gap-3 flex-wrap">
            <SentimentBadge sentiment={call.sentiment} />
            {(call.agents_used ?? []).map(a => (
              <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium capitalize">{a}</span>
            ))}
          </div>

          {/* Summary */}
          {brief?.summary ? (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Summary</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{brief.summary}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No brief available for this call.</p>
          )}

          {/* Action items */}
          {brief?.actionItems && brief.actionItems.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Action Items</h3>
              <ul className="space-y-1.5">
                {brief.actionItems.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-teal-500 mt-0.5 shrink-0">▸</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Entities */}
          {brief?.entities && (
            (() => {
              const { names = [], companies = [], products = [], contacts = [] } = brief.entities;
              const hasAny = names.length || companies.length || products.length || contacts.length;
              if (!hasAny) return null;
              return (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Entities</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Names",     items: names },
                      { label: "Companies", items: companies },
                      { label: "Products",  items: products },
                      { label: "Contacts",  items: contacts },
                    ].filter(g => g.items.length > 0).map(g => (
                      <div key={g.label}>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">{g.label}</p>
                        <div className="flex flex-wrap gap-1">
                          {g.items.map((item, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{item}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [calls,       setCalls]       = useState<CallRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [selectedCall, setSelectedCall] = useState<CallRow | null>(null);

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

  // Close modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedCall(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const avg      = avgDuration(calls);
  const topAgent = mostUsedAgent(calls);
  const posRate  = positiveRate(calls);
  const perDay   = callsPerDay(calls);
  const maxDay   = Math.max(...perDay.map(d => d.count), 1);
  const agents   = agentUsage(calls);

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
      {selectedCall && <BriefModal call={selectedCall} onClose={() => setSelectedCall(null)} />}

      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Inogen Analytics</h1>
            <p className="text-xs text-gray-400 mt-0.5">Last {calls.length} calls</p>
          </div>
          <a href="/" className="text-xs text-teal-600 hover:underline">← Back to agent</a>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Calls",   value: String(calls.length) },
            { label: "Avg Duration",  value: fmtDuration(avg) },
            { label: "Top Agent",     value: topAgent },
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

        {/* Word map — topics from call briefs */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Top Topics</h2>
          <p className="text-xs text-gray-400 mb-4">Keywords extracted from call summaries — size reflects frequency</p>
          <WordMap calls={calls} />
        </div>

        {/* Recent calls table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Recent Calls</h2>
            <p className="text-xs text-gray-400 mt-0.5">Click any row to view the full brief</p>
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
                  <th className="px-5 py-2.5 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCall(c)}
                    className={`border-b border-gray-50 cursor-pointer hover:bg-teal-50/60 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}
                  >
                    <td className="px-5 py-2.5 font-mono text-gray-400">{c.id.slice(0, 8)}</td>
                    <td className="px-5 py-2.5 text-gray-600">{fmtDate(c.created_at)}</td>
                    <td className="px-5 py-2.5 font-mono text-gray-600">{fmtDuration(c.duration)}</td>
                    <td className="px-5 py-2.5 text-gray-500">{(c.agents_used ?? []).join(", ") || "—"}</td>
                    <td className="px-5 py-2.5"><SentimentBadge sentiment={c.sentiment} /></td>
                    <td className="px-5 py-2.5 text-gray-500 max-w-xs truncate">
                      {c.brief?.summary
                        ? <span className="text-teal-600 hover:underline">{c.brief.summary}</span>
                        : <span className="text-gray-300 italic">No brief</span>}
                    </td>
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
