"use client";

import { Message } from "@/lib/types";

/** Simple markdown-like bold rendering: **text** → <strong>text</strong> */
function renderContent(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    // Handle newlines
    const lines = part.split("\n");
    return lines.map((line, j) => (
      <span key={`${i}-${j}`}>
        {j > 0 && <br />}
        {line}
      </span>
    ));
  });
}

interface Props {
  message: Message;
  showCursor?: boolean;
}

export default function MessageBubble({ message, showCursor }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-3 animate-fade-in ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
          isUser
            ? "bg-gradient-to-br from-violet-500 to-purple-600"
            : "bg-gradient-to-br from-teal-400 to-cyan-500"
        }`}
      >
        {isUser ? "U" : "C"}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-tr-md"
            : "glass-panel rounded-tl-md text-gray-800"
        }`}
      >
        {renderContent(message.content)}
        {showCursor && (
          <span className="inline-block w-0.5 h-[0.9em] bg-teal-500 ml-0.5 align-text-bottom rounded-sm animate-pulse" />
        )}
      </div>
    </div>
  );
}

