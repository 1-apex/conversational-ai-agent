"use client";

import { FormEvent, useState } from "react";

interface Props {
  callId: string;
  callToken: string;
}

export default function CallbackForm({ callId, callToken }: Props) {
  const [phone, setPhone]   = useState("");
  const [state, setState]   = useState<"idle" | "sent" | "error">("idle");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const res = await fetch(`/api/calls/${callId}/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callToken, phone }),
    }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  }

  if (state === "sent") {
    return <p className="m-4 mb-0 text-xs text-teal-700">Recorded in the demo support queue. Nobody will really call.</p>;
  }
  return (
    <form onSubmit={submit} className="m-4 mb-0 p-3 rounded-lg border border-amber-200 bg-amber-50 space-y-2">
      <label htmlFor="callback-phone" className="block text-xs text-amber-900">
        This demo can add a callback request to its practice queue. <strong>Use a made-up number</strong>: nobody will really call.
      </label>
      <div className="flex gap-2">
        <input
          id="callback-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="555 010 0100"
          className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg"
        />
        <button type="submit" className="text-xs px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-medium">
          Add request
        </button>
      </div>
      {state === "error" && <p role="alert" className="text-xs text-red-600">That didn&apos;t work. Check the number, and note that the queue needs a database.</p>}
    </form>
  );
}
