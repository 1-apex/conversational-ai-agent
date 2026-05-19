import { AgentName, AgentState } from "@/lib/types";

interface Props {
  agent: AgentName;
  state: AgentState;
}

export const AGENT_META: Record<AgentName, { label: string; color: string; dot: string }> = {
  orchestrator: { label: "Main Agent",   color: "bg-teal-500/15 text-teal-700 border-teal-400/30",     dot: "bg-teal-500"   },
  sales:        { label: "Sales",        color: "bg-emerald-500/15 text-emerald-700 border-emerald-400/30", dot: "bg-emerald-500" },
  product:      { label: "Product",      color: "bg-blue-500/15 text-blue-700 border-blue-400/30",     dot: "bg-blue-500"   },
  general:      { label: "General Info", color: "bg-slate-500/15 text-slate-700 border-slate-400/30",  dot: "bg-slate-500"  },
  b2b:          { label: "B2B",          color: "bg-violet-500/15 text-violet-700 border-violet-400/30", dot: "bg-violet-500" },
};

const STATE_LABEL: Record<AgentState, string> = {
  idle:      "",
  thinking:  "thinking…",
  speaking:  "speaking",
  listening: "listening",
};

export default function AgentBadge({ agent, state }: Props) {
  const meta = AGENT_META[agent];
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${meta.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot} ${state === "speaking" ? "animate-pulse" : ""}`} />
      {meta.label}
      {STATE_LABEL[state] && (
        <span className="opacity-60 font-normal">&nbsp;·&nbsp;{STATE_LABEL[state]}</span>
      )}
    </div>
  );
}
