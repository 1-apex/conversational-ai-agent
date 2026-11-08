"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import StaffShell, { api } from "@/components/staff/StaffShell";

interface Review { id: string; callId: string; failureClass: string; notes: string | null; reviewerName: string; createdAt: string; proposedCase: unknown; }
interface ApiCall { id: string; started_at: string; emergency_locked: boolean; turn_count: number; intelligence: { summary?: string } | null; }
interface Turn { id: string; speaker: string; agent: string | null; textContent: string; pathway: string | null; validationStatus: string | null; }

const CLASSES = ["hallucination", "unsafe_response", "wrong_routing", "bad_summary", "unresolved", "other"];

function Reviews() {
  const [calls, setCalls]     = useState<ApiCall[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [callId, setCallId]   = useState("");
  const [turns, setTurns]     = useState<Turn[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm]       = useState({ failureClass: "hallucination", notes: "", correctedSummary: "", caseInput: "", caseExpected: "" });

  const load = useCallback(() => {
    api<{ calls: ApiCall[] }>("/api/analytics").then((d) => setCalls(d.calls)).catch((e) => setMessage(`Error: ${e.message}`));
    api<{ reviews: Review[] }>("/api/reviews").then((d) => setReviews(d.reviews)).catch((e) => setMessage(`Error: ${e.message}`));
  }, []);
  useEffect(load, [load]);

  async function pick(id: string) {
    setCallId(id);
    const d = await api<{ turns: Turn[] }>(`/api/staff/calls/${id}`);
    setTurns(d.turns);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/reviews", {
        method: "POST",
        json: {
          callId, failureClass: form.failureClass, notes: form.notes || undefined,
          correctedSummary: form.correctedSummary || undefined,
          proposedCase: form.caseInput ? { input: form.caseInput, expectedBehavior: form.caseExpected, category: form.failureClass } : undefined,
        },
      });
      setMessage("Review saved. A proposed case waits here for a person to add it to the dataset; nothing changes automatically.");
      setForm({ ...form, notes: "", correctedSummary: "", caseInput: "", caseExpected: "" });
      load();
    } catch (e) {
      setMessage(`Error: ${(e as Error).message}`);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4 text-xs">
      <div className="space-y-4">
        {message && <p role="status" className="text-gray-700">{message}</p>}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y max-h-72 overflow-y-auto">
          {calls.length === 0 && <p className="p-4 text-gray-500">No calls yet.</p>}
          {calls.map((c) => (
            <button key={c.id} onClick={() => pick(c.id)} className={`w-full text-left p-2 hover:bg-gray-50 ${callId === c.id ? "bg-teal-50" : ""}`}>
              {new Date(c.started_at).toLocaleString()} · {c.turn_count} turns{c.emergency_locked ? " · emergency pathway" : ""}
              <span className="block text-gray-500 truncate">{c.intelligence?.summary ?? "No summary"}</span>
            </button>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 max-h-72 overflow-y-auto">
          {turns.length === 0 && <p className="text-gray-500">Select a call to read it. Reading is logged.</p>}
          {turns.map((t) => (
            <p key={t.id} className="mb-1"><span className="font-medium">{t.speaker === "agent" ? (t.agent ?? "agent") : "caller"}:</span> {t.textContent} {t.validationStatus === "blocked" && <span className="text-amber-700">(model reply blocked)</span>}</p>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">Record a finding</h2>
          <select aria-label="Failure type" value={form.failureClass} onChange={(e) => setForm({ ...form, failureClass: e.target.value })} className="w-full px-2 py-1.5 border rounded">
            {CLASSES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
          </select>
          <textarea aria-label="Notes" rows={2} placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-2 py-1.5 border rounded" />
          <textarea aria-label="Corrected summary" rows={2} placeholder="Corrected summary (the original is kept)" value={form.correctedSummary} onChange={(e) => setForm({ ...form, correctedSummary: e.target.value })} className="w-full px-2 py-1.5 border rounded" />
          <input aria-label="Proposed test input" placeholder="Proposed evaluation input (synthetic wording only)" value={form.caseInput} onChange={(e) => setForm({ ...form, caseInput: e.target.value })} className="w-full px-2 py-1.5 border rounded" />
          <input aria-label="Expected behaviour" placeholder="Expected behaviour" value={form.caseExpected} onChange={(e) => setForm({ ...form, caseExpected: e.target.value })} className="w-full px-2 py-1.5 border rounded" />
          <button type="submit" disabled={!callId} className="px-3 py-1.5 rounded bg-teal-500 text-white disabled:opacity-50">Save review</button>
        </form>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y">
          {reviews.map((r) => (
            <p key={r.id} className="p-2"><span className="font-medium">{r.failureClass.replace(/_/g, " ")}</span> by {r.reviewerName}{r.proposedCase ? " · case proposed" : ""}{r.notes ? `: ${r.notes}` : ""}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <StaffShell title="Quality reviews" intro="Reviewing never changes prompts, policy or knowledge by itself. Fixes go through code review and the evaluation suite.">
      {() => <Reviews />}
    </StaffShell>
  );
}
