"use client";

import { useEffect, useRef } from "react";
import { AgentTurn, AgentName, AgentState } from "@/lib/types";
import { AGENT_META } from "./AgentBadge";

interface Props {
  turns: AgentTurn[];
  interimText: string;
  agentState: AgentState;
  activeAgent: AgentName;
  speakingTurnId: string;
}

export default function AgentTranscript({ turns, interimText, agentState, activeAgent, speakingTurnId }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, interimText, agentState]);

  if (turns.length === 0 && agentState === "idle") {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm select-none px-8 text-center">
        Press <strong className="mx-1 text-gray-600">Start Call</strong> — the agent will greet you and the conversation begins.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

        {turns.map((turn) => {
          const isAgent = turn.role === "agent";
          const meta    = isAgent && turn.agent ? AGENT_META[turn.agent] : null;

          return (
            <div key={turn.id} className={`flex gap-2.5 animate-fade-in ${isAgent ? "" : "flex-row-reverse"}`}>
              {/* Avatar */}
              <div
                className={`shrink-0 w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center mt-0.5 ${
                  isAgent
                    ? (meta ? meta.dot : "bg-teal-500")
                    : "bg-gradient-to-br from-violet-500 to-purple-600"
                }`}
              >
                {isAgent ? (turn.agent?.[0]?.toUpperCase() ?? "A") : "U"}
              </div>

              <div className="flex flex-col gap-1 max-w-[78%]">
                {/* Speaker label */}
                <span className={`text-[10px] font-medium ${isAgent ? "text-left" : "text-right"} ${
                  meta ? meta.color.split(" ").find(c => c.startsWith("text-")) ?? "text-gray-500" : "text-violet-500"
                }`}>
                  {isAgent ? (meta?.label ?? "Agent") : "You"}
                </span>

                {/* Bubble */}
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-all ${
                  isAgent
                    ? `glass-panel rounded-tl-md text-gray-800 ${turn.id === speakingTurnId ? "ring-2 ring-teal-300 shadow-teal-100 shadow-md" : ""}`
                    : "bg-linear-to-br from-violet-500 to-purple-600 text-white rounded-tr-md"
                }`}>
                  {turn.content}
                  {turn.id === speakingTurnId && (
                    <span className="inline-block w-0.5 h-3.5 bg-teal-400 rounded ml-1 animate-pulse align-middle" />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Interim user text while speaking */}
        {interimText && agentState === "listening" && (
          <div className="flex gap-2.5 flex-row-reverse animate-fade-in">
            <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5 opacity-60">
              U
            </div>
            <div className="max-w-[78%] flex flex-col gap-1 items-end">
              <span className="text-[10px] font-medium text-violet-400">You</span>
              <div className="glass-panel rounded-2xl rounded-tr-md px-4 py-2.5 text-sm text-gray-400 italic">
                {interimText}
                <span className="inline-block w-0.5 h-3.5 bg-gray-400 rounded ml-1 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {/* Agent thinking indicator */}
        {agentState === "thinking" && (
          <div className="flex gap-2.5 animate-fade-in">
            <div className={`shrink-0 w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center mt-0.5 ${AGENT_META[activeAgent].dot}`}>
              {activeAgent[0].toUpperCase()}
            </div>
            <div className="glass-panel rounded-2xl rounded-tl-md px-4 py-3">
              <div className="flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
