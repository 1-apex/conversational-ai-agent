"use client";

import { FormEvent, useState } from "react";
import { MAX_CALLER_TEXT } from "@/lib/limits";

interface Props {
  disabled: boolean;
  onSend(text: string): void;
}

// Works without a microphone, for unsupported browsers, denied permission, and
// anyone who can't or would rather not speak.
export default function TypedInput({ disabled, onSend }: Props) {
  const [text, setText] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <form onSubmit={submit} className="flex gap-2 w-full max-w-xs">
      <input
        aria-label="Type your message"
        value={text}
        maxLength={MAX_CALLER_TEXT}
        onChange={(event) => setText(event.target.value)}
        placeholder="Or type your message"
        className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-white/70 border border-gray-200 rounded-lg text-gray-700"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="text-xs px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-medium disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
