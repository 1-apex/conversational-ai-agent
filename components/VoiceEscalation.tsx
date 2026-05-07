"use client";

import { useState } from "react";

interface Props {
  hasMessages: boolean;
}

export default function VoiceEscalation({ hasMessages }: Props) {
  const [calling, setCalling] = useState(false);

  if (!hasMessages) return null;

  const handleCall = () => {
    setCalling(true);
  };

  return (
    <div className="px-4 pb-3">
      <div className="max-w-3xl mx-auto">
        {!calling ? (
          <button
            onClick={handleCall}
            className="w-full glass-panel border border-white/30 rounded-xl px-4 py-3 text-sm font-medium text-teal-700 hover:bg-white/40 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <span className="text-lg">📞</span>
            Continue via Phone
          </button>
        ) : (
          <div className="animate-fade-in glass-panel border border-teal-300/40 rounded-xl px-4 py-4 text-center space-y-2">
            <div className="text-lg animate-pulse">📞 Calling you now…</div>
            <p className="text-sm text-gray-600">
              Continuing conversation via voice AI (simulated)
            </p>
            <p className="text-xs text-gray-400">
              ✅ Chat context has been transferred — the voice agent has your full conversation history.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

