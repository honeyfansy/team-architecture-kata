import type { AgentConfig, AgentRole } from './agent.js';
import type { StickyNote } from './sticky-note.js';
import type { Edge } from './canvas.js';

export type SessionPhase =
  | 'drivers'
  | 'decomposition'
  | 'patterns'
  | 'views'
  | 'adr'
  | 'review'
  | 'refinement'
  | 'report'
  | 'complete';

export type SessionStatus = 'idle' | 'running' | 'paused' | 'waiting_input' | 'complete' | 'error';

export type InterventionMode = 'automatic' | 'smart_pause' | 'manual';

export interface FlowConfig {
  id: string;
  name: string;
  description: string;
  phase: SessionPhase;
  phaseHistory: SessionPhase[];
  status: 'pending' | 'running' | 'complete';
}

export interface SessionConfig {
  flows: FlowConfig[];
  agents: AgentConfig[];
  interventionMode: InterventionMode;
  autoConfirmPhase: boolean;
  canvasChangeResponse: 'continue' | 'stop';
  llmProvider?: string;
  llmBaseURL?: string;
  llmApiKey?: string;
}

export interface Session {
  id: string;
  name: string;
  config: SessionConfig;
  status: SessionStatus;
  currentFlowIndex: number;
  phase: SessionPhase;
  phaseHistory: SessionPhase[];
  canvas: {
    notes: StickyNote[];
    edges: Edge[];
  };
  createdAt: number;
  updatedAt: number;
  pendingDecisions: number;
  unresolvedCount: number;
}
