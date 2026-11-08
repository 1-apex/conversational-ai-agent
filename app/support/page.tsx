"use client";

import { useCallback, useEffect, useState } from "react";
import StaffShell, { api, Me } from "@/components/staff/StaffShell";

interface Escalation {
  id: string; callId: string; reason: string; priority: string; status: string;
  assignedTo: string | null; assigneeName: string | null; createdAt: string; outcome: string | null;
}
interface Turn { id: string; speaker: string; agent: string | null; textContent: string; pathway: string | null; validationStatus: string | null; }
interface Detail {
  escalation: Escalation & { contact: string | null; hasContact: boolean; preferredWindow: string | null };
  events: { id: string; eventType: string; createdAt: string; detail: string | null }[];
}

function Queue({ me }: { me: Me }) {
  const [rows, setRows]     = useState<Escalation[]>([]);
  const [error, setError]   = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [turns, setTurns]   = useState<Turn[] | null>(null);
  const [outcome, setOutcome] = useState("");

  const load = useCallback(() => {
    api<{ escalations: Escalation[] }>("/api/escalations").then((d) => setRows(d.escalations)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const open = useCallback(async (id: string) => {
    setSelected(id); setTurns(null); setError("");
    try {
      const d = await api<Detail>(`/api/escalations/${id}`);
      setDetail(d);
      // Allowed only once this person is responsible for the call, and logged when read
      const t = await api<{ turns: Turn[] }>(`/api/staff/calls/${d.escalation.callId}`).catch(() => null);
      setTurns(t?.turns ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  async function act(body: object) {
    if (!selected) return;
    try {
      await api(`/api/escalations/${selected}`, { method: "PATCH", json: body });
      load();
      await open(selected);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y">
        {rows.length === 0 && <p className="p-4 text-sm text-gray-500">The queue is empty.</p>}
        {rows.map((r) => (
          <button key={r.id} onClick={() => open(r.id)} className={`w-full text-left p-3 text-xs hover:bg-gray-50 ${selected === r.id ? "bg-teal-50" : ""}`}>
            <span className="font-semibold text-gray-800">{r.priority}</span>{" "}
            <span className="text-gray-700">{r.reason.replace(/_/g, " ")}</span>
            <span className="block text-gray-500 mt-0.5">{r.status.replace(/_/g, " ")} · {r.assigneeName ?? "unassigned"} · {new Date(r.createdAt).toLocaleString()}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3 text-xs">
        {error && <p role="alert" className="text-red-600">Error: {error}</p>}
        {!detail && <p className="text-gray-500">Select an item. The list shows no call content.</p>}
        {detail && (
          <>
            <h2 className="text-sm font-semibold text-gray-800">{detail.escalation.reason.replace(/_/g, " ")} ({detail.escalation.priority})</h2>
            <p className="text-gray-600">Status: {detail.escalation.status.replace(/_/g, " ")}. Callback number: {detail.escalation.contact ?? (detail.escalation.hasContact ? "hidden until you claim this" : "none given")}.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => act({ action: "claim" })} className="px-2 py-1 rounded bg-teal-500 text-white">Claim</button>
              <button onClick={() => act({ action: "status", status: "in_progress" })} className="px-2 py-1 rounded border">In progress</button>
              <button onClick={() => act({ action: "status", status: "unable_to_reach" })} className="px-2 py-1 rounded border">Unable to reach</button>
            </div>
            <div className="flex gap-2">
              <input aria-label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Outcome" className="flex-1 min-w-0 px-2 py-1 border rounded" />
              <button onClick={() => act({ action: "status", status: "resolved", outcome })} className="px-2 py-1 rounded border">Resolve</button>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-1">Transcript</h3>
              {turns === null
                ? <p className="text-gray-500">{me.permissions.includes("transcript:read") ? "Not available." : "Claim this item to read the transcript."}</p>
                : turns.map((t) => (
                    <p key={t.id} className="mb-1"><span className="font-medium">{t.speaker === "agent" ? (t.agent ?? "agent") : "caller"}:</span> {t.textContent}</p>
                  ))}
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-1">History</h3>
              {detail.events.map((e) => <p key={e.id} className="text-gray-500">{new Date(e.createdAt).toLocaleTimeString()} {e.eventType}{e.detail ? `: ${e.detail}` : ""}</p>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <StaffShell title="Support queue" intro="Practice queue for this demo. There's no live transfer, and nobody really gets called.">
      {(me) => <Queue me={me} />}
    </StaffShell>
  );
}
