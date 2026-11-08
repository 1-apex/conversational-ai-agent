"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import StaffShell, { api, Me } from "@/components/staff/StaffShell";

interface Version {
  versionId: string; version: number; status: string; flags: string[]; title: string; sourceType: string;
  sourceUrl: string | null; uploaderName: string; uploadedBy: string; chunkCount: number; createdAt: string;
}
interface Chunk { id: string; section: string; sourceLocation: string; content: string; }

function Knowledge({ me }: { me: Me }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [viewerId, setViewerId] = useState("");
  const [chunks, setChunks]     = useState<{ id: string; rows: Chunk[] } | null>(null);
  const [message, setMessage]   = useState("");
  const [form, setForm]         = useState({ title: "", sourceType: "public_page_unverified", sourceUrl: "", content: "" });

  const load = useCallback(() => {
    api<{ versions: Version[]; viewerId: string }>("/api/knowledge")
      .then((d) => { setVersions(d.versions); setViewerId(d.viewerId); })
      .catch((e) => setMessage(`Error: ${e.message}`));
  }, []);
  useEffect(load, [load]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    try {
      const res = await api<{ chunkCount: number; flags: string[] }>("/api/knowledge", {
        method: "POST",
        json: { title: form.title, sourceType: form.sourceType, content: form.content, sourceUrl: form.sourceUrl || undefined },
      });
      setMessage(`Uploaded ${res.chunkCount} chunks, awaiting review.${res.flags.length ? ` Flags: ${res.flags.join(", ")}.` : ""}`);
      setForm({ ...form, title: "", content: "", sourceUrl: "" });
      load();
    } catch (e) {
      setMessage(`Error: ${(e as Error).message}`);
    }
  }

  async function act(versionId: string, action: "approve" | "reject" | "retire") {
    try {
      await api(`/api/knowledge/versions/${versionId}`, { method: "POST", json: { action } });
      setMessage(`Done: ${action}.`);
      load();
    } catch (e) {
      const code = (e as Error).message;
      setMessage(code === "own_upload" ? "You can't approve your own upload. A second person has to." : `Error: ${code}`);
    }
  }

  const canApprove = me.permissions.includes("knowledge:approve");

  return (
    <div className="space-y-4">
      {message && <p role="status" className="text-xs text-gray-700">{message}</p>}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y text-xs">
        {versions.length === 0 && <p className="p-4 text-gray-500">No documents yet.</p>}
        {versions.map((v) => (
          <div key={v.versionId} className="p-3 space-y-1">
            <p><span className="font-semibold text-gray-800">{v.title}</span> v{v.version} · <span className="font-medium">{v.status.replace(/_/g, " ")}</span> · {v.sourceType.replace(/_/g, " ")} · {v.chunkCount} chunks · by {v.uploaderName}</p>
            {v.sourceUrl && <p className="text-gray-500 break-all">{v.sourceUrl}</p>}
            {v.flags.length > 0 && <p className="text-amber-700">Flagged for review: {v.flags.join(", ").replace(/_/g, " ")}</p>}
            <div className="flex gap-2">
              <button onClick={() => api<{ chunks: Chunk[] }>(`/api/knowledge/versions/${v.versionId}`).then((d) => setChunks({ id: v.versionId, rows: d.chunks }))} className="px-2 py-1 border rounded">Review content</button>
              {canApprove && v.status === "pending_review" && (
                <>
                  <button onClick={() => act(v.versionId, "approve")} disabled={v.uploadedBy === viewerId} title={v.uploadedBy === viewerId ? "You uploaded this" : undefined} className="px-2 py-1 rounded bg-teal-500 text-white disabled:opacity-50">Approve</button>
                  <button onClick={() => act(v.versionId, "reject")} className="px-2 py-1 border rounded">Reject</button>
                </>
              )}
              {canApprove && v.status === "approved" && <button onClick={() => act(v.versionId, "retire")} className="px-2 py-1 border rounded">Retire</button>}
            </div>
            {chunks?.id === v.versionId && chunks.rows.map((c) => (
              <div key={c.id} className="mt-2 p-2 bg-gray-50 rounded">
                <p className="font-medium text-gray-700">{c.section} ({c.sourceLocation})</p>
                <p className="whitespace-pre-wrap text-gray-600">{c.content}</p>
              </div>
            ))}
          </div>
        ))}
      </div>

      {me.permissions.includes("knowledge:upload") && (
        <form onSubmit={upload} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-2 text-xs">
          <h2 className="text-sm font-semibold text-gray-800">Upload a text document</h2>
          <input aria-label="Title" required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-2 py-1.5 border rounded" />
          <select aria-label="Source type" value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value })} className="w-full px-2 py-1.5 border rounded">
            <option value="public_page_unverified">Public page (not verified by the manufacturer)</option>
            <option value="synthetic_test">Synthetic test content</option>
            <option value="official">Official, supplied by the manufacturer</option>
          </select>
          <input aria-label="Source URL" type="url" placeholder="Source URL" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} className="w-full px-2 py-1.5 border rounded" />
          <textarea aria-label="Content" required rows={6} placeholder="Plain text or Markdown. Headings become sections." value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full px-2 py-1.5 border rounded font-mono" />
          <button type="submit" className="px-3 py-1.5 rounded bg-teal-500 text-white">Upload for review</button>
        </form>
      )}
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <StaffShell title="Knowledge" intro="Only approved versions can support an answer, and the uploader can't approve their own. Uploaded text is treated as data, never as instructions.">
      {(me) => <Knowledge me={me} />}
    </StaffShell>
  );
}
