import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Session, SessionConfig, SessionStatus, SessionPhase, StickyNote, Edge, AgentMessage, DecisionRequest, ServerMessage, ClientMessage, CanvasChange, AgentStatusInfo, AgentRole } from '@team-architecture-kata/shared';

interface SessionState {
  ws: WebSocket | null; connected: boolean;
  sessionId: string | null; session: Session | null; status: SessionStatus; phase: SessionPhase;
  notes: StickyNote[]; edges: Edge[];
  messages: AgentMessage[];
  agentStatuses: AgentStatusInfo[]; tokenTotals: { input: number; output: number };
  agentTokenAccum: Record<string, { input: number; output: number; speakCount: number }>;
  availableModels: string[]; architectureReport: any | null;
  pendingDecision: DecisionRequest | null;
  connect: () => void; createSession: (config: SessionConfig, availableModels: string[]) => void;
  sendControl: (action: 'pause' | 'resume' | 'stop') => void; sendInput: (content: string) => void;
  sendDecision: (requestId: string, optionId?: string, customInput?: string) => void;
  changeAgentModel: (sessionId: string, role: string, model: string) => void;
  sendCanvasChangeResponse: (sessionId: string, action: 'continue' | 'stop') => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      ws: null, connected: false, sessionId: null, session: null, status: 'idle', phase: 'drivers',
      notes: [], edges: [], messages: [], agentStatuses: [],
      tokenTotals: { input: 0, output: 0 }, agentTokenAccum: {}, availableModels: [],
      architectureReport: null, pendingDecision: null,

      connect: () => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:5174/ws`;
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => set({ connected: true });
        ws.onmessage = (event) => { const msg: ServerMessage = JSON.parse(event.data); handleMessage(msg, set, get); };
        ws.onclose = () => set({ connected: false, ws: null });
        set({ ws });
      },

      createSession: (config: SessionConfig, availableModels: string[]) => {
        const { ws } = get(); if (!ws) return;
        set({ availableModels });
        ws.send(JSON.stringify({ type: 'create_session', payload: { config }, timestamp: Date.now() } satisfies ClientMessage));
      },

      sendControl: (action: 'pause' | 'resume' | 'stop') => {
        const { ws, sessionId } = get(); if (!ws || !sessionId) return;
        ws.send(JSON.stringify({ type: 'session_control', payload: { sessionId, action }, timestamp: Date.now() } satisfies ClientMessage));
      },

      sendInput: (content: string) => {
        const { ws, sessionId } = get(); if (!ws || !sessionId) return;
        ws.send(JSON.stringify({ type: 'user_input', payload: { sessionId, content }, timestamp: Date.now() } satisfies ClientMessage));
        set((s) => ({ messages: [...s.messages, { id: crypto.randomUUID(), sessionId, from: 'facilitator' as AgentRole, to: 'user' as const, content: `📝 You: ${content}`, phase: s.phase, timestamp: Date.now(), type: 'chat' as const }] }));
      },

      sendDecision: (requestId: string, optionId?: string, customInput?: string) => {
        const { ws, sessionId } = get(); if (!ws || !sessionId) return;
        const action = optionId ? 'select' : customInput ? 'custom' : 'skip';
        ws.send(JSON.stringify({ type: 'decision_response', payload: { sessionId, requestId, optionId, customInput, action }, timestamp: Date.now() } satisfies ClientMessage));
        set({ pendingDecision: null });
      },

      changeAgentModel: (sessionId: string, role: string, model: string) => {
        const { ws } = get(); if (!ws) return;
        set((s) => ({ agentStatuses: s.agentStatuses.map((a) => a.role === role ? { ...a, model } : a) }));
        ws.send(JSON.stringify({ type: 'update_agent_model', payload: { sessionId, role, model }, timestamp: Date.now() }));
      },

      sendCanvasChangeResponse: (sessionId: string, action: 'continue' | 'stop') => {
        const { ws } = get(); if (!ws) return;
        ws.send(JSON.stringify({ type: 'canvas_change_response', payload: { sessionId, action }, timestamp: Date.now() }));
      },
    }),
    { name: 'team-architecture-kata-session', storage: createJSONStorage(() => sessionStorage), partialize: (state: SessionState) => ({ sessionId: state.sessionId, session: state.session, status: state.status, phase: state.phase, notes: state.notes, edges: state.edges, messages: state.messages, agentStatuses: state.agentStatuses, tokenTotals: state.tokenTotals, agentTokenAccum: state.agentTokenAccum, availableModels: state.availableModels, architectureReport: state.architectureReport }) },
  ),
);

function handleMessage(msg: ServerMessage, set: any, get: () => SessionState) {
  switch (msg.type) {
    case 'session_created': { const { sessionId } = msg.payload as { sessionId: string }; set({ sessionId }); break; }
    case 'session_state': { const { status } = msg.payload as { status: SessionStatus; message?: string }; set({ status }); if (status === 'running') set({ pendingDecision: null }); break; }
    case 'phase_change': { const { phase } = msg.payload as { phase: SessionPhase }; set({ phase }); break; }
    case 'agent_message': {
      const { message } = msg.payload as { message: AgentMessage };
      set((s: SessionState) => { const from = message.from; const prev = s.agentTokenAccum[from] || { input: 0, output: 0, speakCount: 0 }; return { messages: [...s.messages, message], agentTokenAccum: { ...s.agentTokenAccum, [from]: { input: prev.input + (message.inputTokens || 0), output: prev.output + (message.outputTokens || 0), speakCount: prev.speakCount + 1 } } }; });
      break;
    }
    case 'canvas_update': { const { state } = msg.payload as { change: CanvasChange; state: { notes: StickyNote[]; edges: Edge[] } }; if (state) set({ notes: state.notes, edges: state.edges }); break; }
    case 'agent_status': { const { status: agentStatus } = msg.payload as { status: AgentStatusInfo }; set((s: SessionState) => { const existing = s.agentStatuses.filter((a) => a.role !== agentStatus.role); return { agentStatuses: [...existing, agentStatus], tokenTotals: { input: s.tokenTotals.input + (agentStatus.inputTokens || 0), output: s.tokenTotals.output + (agentStatus.outputTokens || 0) } }; }); break; }
    case 'architecture_report': { const { report } = msg.payload as { report: any }; set({ architectureReport: report }); break; }
    case 'decision_request': { const { decision } = msg.payload as { decision: DecisionRequest }; set({ pendingDecision: decision, status: 'waiting_input' }); break; }
    case 'error': { const { message } = msg.payload as { message: string }; console.error('Server error:', message); break; }
  }
}
