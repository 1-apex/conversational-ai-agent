"use client";

import { useEffect, useState } from "react";
import StaffShell, { api } from "@/components/staff/StaffShell";

interface Entry { id: number; action: string; actorId: string | null; targetType: string | null; targetId: string | null; createdAt: string; }

function Audit() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [chain, setChain]     = useState<{ intact: boolean; brokenAt: number | null } | null>(null);
  const [error, setError]     = useState("");
  useEffect(() => {
    api<{ entries: Entry[]; chain: { intact: boolean; brokenAt: number | null } }>("/api/audit-logs")
      .then((d) => { setEntries(d.entries); setChain(d.chain); })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="space-y-3 text-xs">
      {error && <p role="alert" className="text-red-600">Error: {error}</p>}
      {chain && (
        <p className={chain.intact ? "text-teal-700" : "text-red-600"}>
          Hash chain: {chain.intact ? "intact" : `broken at entry ${chain.brokenAt}`}.
        </p>
      )}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y">
        {entries.map((e) => (
          <p key={e.id} className="p-2 font-mono break-all">{new Date(e.createdAt).toLocaleString()} {e.action} {e.targetType ? `${e.targetType}:${e.targetId}` : ""} {e.actorId ? `by ${e.actorId.slice(0, 8)}` : ""}</p>
        ))}
      </div>
    </div>
  );
}

export default function AuditPage() {
  return <StaffShell title="Audit log" intro="Latest 200 entries. Entries hold IDs, not call content, and the database rejects changes to them.">{() => <Audit />}</StaffShell>;
}
