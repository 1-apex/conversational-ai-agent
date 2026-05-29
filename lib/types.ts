// ── Call Intelligence ─────────────────────────────────────────────────────

export type CallStatus = "idle" | "active" | "ending" | "done";

export interface EntityMap {
  names: string[];
  companies: string[];
  products: string[];
  emails: string[];
  phones: string[];
  dates: string[];
  prices: string[];
}

export interface TranscriptTurn {
  id: string;
  speaker: "agent" | "prospect";
  text: string;
  timestamp: number;
  entities: EntityMap;
}

// ── Agent system ──────────────────────────────────────────────────────────

export type AgentName = "orchestrator" | "sales" | "product" | "general" | "b2b";
export type AgentState = "idle" | "thinking" | "speaking" | "listening";

export interface AgentTurn {
  id: string;
  role: "agent" | "user";
  content: string;
  agent?: AgentName;
  timestamp: number;
}

export interface AgentApiResponse {
  reply: string;
  agent: AgentName;
  handoff: AgentName | null;
}

export interface CallBriefData {
  summary: string;
  entities: {
    names: string[];
    companies: string[];
    products: string[];
    contacts: string[];
  };
  actionItems: string[];
  duration: number;
}
