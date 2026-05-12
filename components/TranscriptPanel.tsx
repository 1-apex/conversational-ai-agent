"use client";

import { useEffect, useRef } from "react";
import { TranscriptTurn, EntityMap } from "@/lib/types";

interface Props {
  turns: TranscriptTurn[];
  interimText: string;
  currentSpeaker: "agent" | "prospect";
  allEntities: EntityMap;
}

const ENTITY_LABELS: { key: keyof EntityMap; label: string; color: string }[] = [
  { key: "names",     label: "Names",     color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "companies", label: "Companies", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { key: "products",  label: "Products",  color: "bg-orange-100 text-orange-700 border-orange-200" },
  { key: "dates",     label: "Dates",     color: "bg-green-100 text-green-700 border-green-200" },
  { key: "prices",    label: "Prices",    color: "bg-red-100 text-red-700 border-red-200" },
  { key: "emails",    label: "Emails",    color: "bg-gray-100 text-gray-700 border-gray-200" },
  { key: "phones",    label: "Phones",    color: "bg-gray-100 text-gray-700 border-gray-200" },
];

const hasAnyEntity = (e: EntityMap) =>
  Object.values(e).some((arr) => arr.length > 0);

export default function TranscriptPanel({ turns, interimText, currentSpeaker, allEntities }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, interimText]);

  if (turns.length === 0 && !interimText) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm select-none">
        Transcript will appear here once the call starts
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scrollable transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {turns.map((turn) => (
          <div key={turn.id} className={`flex gap-3 ${turn.speaker === "agent" ? "" : "flex-row-reverse"}`}>
            {/* Speaker badge */}
            <div
              className={`shrink-0 w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center mt-0.5 ${
                turn.speaker === "agent"
                  ? "bg-gradient-to-br from-teal-400 to-cyan-500"
                  : "bg-gradient-to-br from-violet-500 to-purple-600"
              }`}
            >
              {turn.speaker === "agent" ? "A" : "P"}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                turn.speaker === "agent"
                  ? "glass-panel rounded-tl-md text-gray-800"
                  : "bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-tr-md"
              }`}
            >
              {turn.text}
            </div>
          </div>
        ))}

        {/* Interim (currently being spoken) */}
        {interimText && (
          <div className={`flex gap-3 animate-fade-in ${currentSpeaker === "agent" ? "" : "flex-row-reverse"}`}>
            <div
              className={`shrink-0 w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center mt-0.5 opacity-60 ${
                currentSpeaker === "agent"
                  ? "bg-gradient-to-br from-teal-400 to-cyan-500"
                  : "bg-gradient-to-br from-violet-500 to-purple-600"
              }`}
            >
              {currentSpeaker === "agent" ? "A" : "P"}
            </div>
            <div className="max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed glass-panel rounded-tl-md text-gray-400 italic">
              {interimText}
              <span className="inline-block w-1 h-3.5 bg-gray-400 rounded ml-0.5 animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* Entity strip — only when entities exist */}
      {hasAnyEntity(allEntities) && (
        <div className="shrink-0 border-t border-white/20 px-5 py-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">Detected</p>
          <div className="flex flex-wrap gap-1.5">
            {ENTITY_LABELS.map(({ key, color }) =>
              allEntities[key].map((val) => (
                <span
                  key={`${key}-${val}`}
                  className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${color}`}
                >
                  {val}
                </span>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
