export type AgentRole =
  | 'facilitator'
  | 'domain_architect'
  | 'system_architect'
  | 'quality_analyst'
  | 'technology_architect'
  | 'data_architect'
  | 'infra_architect'
  | 'risk_reviewer';

export type AgentStatusType = 'idle' | 'thinking' | 'speaking' | 'waiting' | 'done' | 'error';

export interface AgentStatusInfo {
  role: AgentRole;
  label: string;
  color: string;
  model: string;
  status: AgentStatusType;
  message?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentConfig {
  role: AgentRole;
  label: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  color: string;
  enabled: boolean;
}

export interface AgentMessage {
  id: string;
  sessionId: string;
  from: AgentRole;
  to: AgentRole | 'all' | 'user';
  content: string;
  phase: string;
  timestamp: number;
  type: 'thought' | 'question' | 'decision' | 'action' | 'chat';
  actions?: CanvasAction[];
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentThought {
  role: AgentRole;
  content: string;
  phase: string;
  visible: boolean;
}

export interface CanvasAction {
  type: 'add_note' | 'add_notes' | 'remove_note' | 'update_note' | 'add_edge' | 'remove_edge'
    | 'invite_agent' | 'invite_all' | 'advance_phase' | 'request_decision' | 'wait_for_user'
    | 'summarize' | 'propose_note' | 'propose_edges' | 'disagree' | 'agree';
  payload: Record<string, unknown>;
}

export interface DecisionRequest {
  id: string;
  sessionId: string;
  phase: string;
  title: string;
  description: string;
  context: string[];
  options: DecisionOption[];
  from: AgentRole[];
  status: 'pending' | 'resolved' | 'skipped';
  createdAt: number;
}

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
}

export interface DecisionResponse {
  requestId: string;
  optionId?: string;
  customInput?: string;
  action: 'select' | 'skip' | 'custom';
}
