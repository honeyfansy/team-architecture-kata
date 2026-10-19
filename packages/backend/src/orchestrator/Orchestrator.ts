import { AgentRegistry } from '../agents/AgentRegistry.js';
import { CanvasManager } from '../canvas/CanvasManager.js';
import { WebSocketManager } from '../ws/WebSocketManager.js';
import { PHASE_CONFIGS, AGENT_SYSTEM_PROMPTS } from './phases.js';
import type {
  AgentMessage, CanvasAction, DecisionRequest, SessionPhase,
  StickyNote, AgentRole, AgentStatusInfo, FlowConfig,
} from '@team-architecture-kata/shared';
import { randomUUID } from 'crypto';

interface PendingDecision extends DecisionRequest {
  resolve: (response: string) => void;
}

export class Orchestrator {
  private running = false;
  private paused = false;
  private waitingForInput = false;
  private abortController = new AbortController();
  private inputResolver: ((input: string) => void) | null = null;
  private flows: FlowConfig[] = [];
  private currentFlowIndex = 0;
  private llmProvider = '';
  private llmBaseURL = '';
  private llmApiKey = '';
  private flowPhaseIndexes: Map<string, number> = new Map();
  private flowHistories: Map<string, string[]> = new Map();
  private flowAgentHistories: Map<string, Map<AgentRole, string[]>> = new Map();
  private roundsWithoutChange = 0;
  private pendingDecision: PendingDecision | null = null;

  private readonly phases: SessionPhase[] = [
    'drivers', 'decomposition', 'patterns', 'views', 'adr', 'review',
  ];

  private get currentFlowId(): string { return this.flows[this.currentFlowIndex]?.id || ''; }
  private get currentFlowDesc(): string { return this.flows[this.currentFlowIndex]?.description || ''; }
  private get currentFlowName(): string { return this.flows[this.currentFlowIndex]?.name || ''; }
  private get flowPhaseIndex(): number { return this.flowPhaseIndexes.get(this.currentFlowId) ?? 0; }
  private set flowPhaseIndex(v: number) { this.flowPhaseIndexes.set(this.currentFlowId, v); }
  private get currentPhase(): SessionPhase { return this.phases[this.flowPhaseIndex] || 'drivers'; }
  private get flowHistory(): string[] {
    let h = this.flowHistories.get(this.currentFlowId);
    if (!h) { h = []; this.flowHistories.set(this.currentFlowId, h); }
    return h;
  }
  private get agentHistory(): Map<AgentRole, string[]> {
    let h = this.flowAgentHistories.get(this.currentFlowId);
    if (!h) { h = new Map(); this.flowAgentHistories.set(this.currentFlowId, h); }
    return h;
  }

  constructor(
    private sessionId: string,
    private agents: AgentRegistry,
    private canvas: CanvasManager,
    private ws: WebSocketManager,
    flows: FlowConfig[],
    llmConfig?: { provider?: string; baseURL?: string; apiKey?: string },
  ) {
    this.flows = flows;
    if (llmConfig) {
      this.llmProvider = llmConfig.provider || '';
      this.llmBaseURL = llmConfig.baseURL || '';
      this.llmApiKey = llmConfig.apiKey || '';
    }
    this.canvas.onChange((change) => {
      this.ws.broadcast(sessionId, {
        type: 'canvas_update',
        payload: { change, state: this.canvas.getState() },
        timestamp: Date.now(),
      });
    });
  }

  async start() {
    console.log(`[Orchestrator] Starting session ${this.sessionId} with ${this.flows.length} flows`);
    this.running = true;
    this.ws.broadcast(this.sessionId, {
      type: 'session_state',
      payload: { status: 'running' },
      timestamp: Date.now(),
    });
    try {
      for (let fi = 0; fi < this.flows.length && this.running; fi++) {
        this.currentFlowIndex = fi;
        const flow = this.flows[fi];
        flow.status = 'running';
        console.log(`[Orchestrator] Starting flow ${fi + 1}/${this.flows.length}: "${flow.name}"`);
        this.ws.broadcast(this.sessionId, {
          type: 'session_state',
          payload: { status: 'running', flowName: flow.name, flowIndex: fi, flowTotal: this.flows.length },
          timestamp: Date.now(),
        });
        await this.runLoop();
        flow.status = 'complete';
        console.log(`[Orchestrator] Flow "${flow.name}" completed`);
      }
      this.running = false;
      console.log(`[Orchestrator] Session ${this.sessionId} completed (all ${this.flows.length} flows)`);
      this.ws.broadcast(this.sessionId, {
        type: 'session_state',
        payload: { status: 'complete', message: '架构设计工作坊完成！' },
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error(`[Orchestrator] Error:`, err);
      this.running = false;
      this.ws.broadcast(this.sessionId, {
        type: 'session_state',
        payload: { status: 'error', message: (err as Error).message },
        timestamp: Date.now(),
      });
    }
  }

  pause() { this.paused = true; this.tryResolve('paused'); }
  resume() { this.paused = false; this.tryResolve('resume'); }
  stop() { this.running = false; this.abortController.abort(); this.tryResolve('stopped'); }

  receiveUserInput(input: string, _source: string) {
    if (this.pendingDecision) {
      try {
        const parsed = JSON.parse(input);
        if (parsed.action === 'skip') {
          this.flowHistory.push('[Decision skipped]');
        } else {
          const chosen = parsed.optionId
            ? this.pendingDecision.options?.find((o: any) => o.id === parsed.optionId)?.label || parsed.optionId
            : parsed.customInput || input;
          this.flowHistory.push(`[Decision]: ${chosen}`);
        }
      } catch {
        this.flowHistory.push(`[User input]: ${input}`);
      }
      this.pendingDecision.resolve(input);
      this.pendingDecision = null;
    }
    this.waitingForInput = false;
    this.tryResolve(input);
  }

  getAgent(role: string) { return this.agents.get(role as AgentRole); }

  private tryResolve(value: string) {
    if (this.inputResolver) {
      const r = this.inputResolver;
      this.inputResolver = null;
      r(value);
    }
  }

  async runLoop() {
    while (this.running) {
      if (this.paused) {
        await this.waitFor('resume');
        continue;
      }
      if (this.waitingForInput) {
        const input = await this.waitFor('input');
        await this.handleUserInput(input);
        continue;
      }

      const phase = this.currentPhase;
      const phaseConfig = PHASE_CONFIGS[phase as keyof typeof PHASE_CONFIGS];
      if (!phaseConfig) break;

      this.ws.broadcast(this.sessionId, {
        type: 'phase_change',
        payload: { phase, phaseLabel: phaseConfig.label },
        timestamp: Date.now(),
      });

      await this.runPhase(phase, phaseConfig);

      if (!this.running) break;

      this.flowHistory.push(`[System]: Phase "${phase}" complete. Moving next.`);
      this.flowPhaseIndex++;
      this.roundsWithoutChange = 0;

      if (this.flowPhaseIndex >= this.phases.length) {
        break;
      }
    }
  }

  private async runPhase(phase: SessionPhase, config: typeof PHASE_CONFIGS.drivers) {
    console.log(`[Orchestrator] Starting phase: ${phase}`);
    const noteCountBefore = this.canvas.getNotes().length;

    for (const agent of this.agents.getAll()) {
      this.broadcastAgentStatus(agent.role, 'idle');
    }

    await this.facilitatorSay(config.introPrompt.replace('{phase}', config.label));

    for (let round = 0; round < config.maxRounds; round++) {
      if (!this.running || this.paused) break;

      const action = await this.getFacilitatorAction(phase, round, config);
      if (!action) break;

      const handled = await this.executeFacilitatorAction(action, phase);
      if (!handled) break;

      const newNotes = this.canvas.getNotes().length - noteCountBefore;
      if (newNotes === 0) this.roundsWithoutChange++;
      else this.roundsWithoutChange = 0;

      if (this.roundsWithoutChange >= config.saturationRounds) {
        await this.facilitatorSay(config.saturationMessage);
        break;
      }
    }

    await this.inviteAgent('facilitator', `Phase "${config.label}" winding down. Provide brief summary of what was discovered in this phase. Include key decisions, and any open questions.`);
  }

  private async getFacilitatorAction(phase: string, round: number, config: any): Promise<CanvasAction | null> {
    const facilitator = this.agents.get('facilitator');
    if (!facilitator) throw new Error('Facilitator agent required');

    const instruction = config.facilitatorInstruction
      .replace('{round}', String(round + 1))
      .replace('{maxRounds}', String(config.maxRounds));

    console.log(`[Orchestrator] Facilitator round ${round + 1}/${config.maxRounds}`);

    const resp = await facilitator.call({
      instruction,
      context: this.buildContext(phase, 'facilitator'),
      signal: this.abortController.signal,
      provider: this.llmProvider, baseURL: this.llmBaseURL, apiKey: this.llmApiKey,
    });

    if (resp.timedOut || !resp.actions?.length) return null;

    this.broadcastMessage('facilitator', resp.content, 'thought');
    this.flowHistory.push(`[Facilitator]: ${resp.content}`);

    const mainAction = resp.actions.find((a: any) => a.type !== 'propose_note' && a.type !== 'propose_edges');
    if (mainAction && mainAction.type === 'advance_phase') return null;
    return mainAction || null;
  }

  private async executeFacilitatorAction(action: CanvasAction, phase: SessionPhase): Promise<boolean> {
    switch (action.type) {
      case 'invite_agent': {
        const p = action.payload as { target?: AgentRole; question?: string } | null;
        const target = p?.target || 'domain_architect';
        const question = p?.question || '请从你的角度补充架构内容';
        await this.inviteAgent(target, question);
        return true;
      }

      case 'invite_all': {
        const payload = action.payload as { question?: string } | null;
        const question = payload?.question || '请从你的视角补充遗漏的内容';
        for (const agent of this.agents.getAll()) {
          if (agent.role === 'facilitator') continue;
          await this.inviteAgent(agent.role, question);
        }
        return true;
      }

      case 'add_note': {
        const notePayload = action.payload as Partial<StickyNote>;
        const note = this.canvas.addNote({
          type: notePayload.type || 'note',
          content: notePayload.content || '',
          position: notePayload.position || { x: 100 + this.canvas.getNotes().length * 20, y: 200 },
          author: 'facilitator',
          status: 'active',
          phase,
          flowId: this.currentFlowId,
        });
        this.flowHistory.push(`[Facilitator added "${note.content}" (${note.type})]`);
        this.broadcastMessage('facilitator', `Added note: "${note.content}"`, 'action');
        return true;
      }

      case 'add_notes': {
        const notes = action.payload as { notes: Array<Partial<StickyNote>> };
        if (notes.notes) {
          for (const n of notes.notes) {
            this.canvas.addNote({
              type: n.type || 'note',
              content: n.content || '',
              position: n.position || { x: 100 + Math.random() * 400, y: 200 + Math.random() * 200 },
              author: 'facilitator',
              status: 'active',
              phase,
              flowId: this.currentFlowId,
            });
          }
        }
        return true;
      }

      case 'add_edge': {
        const edgePayload = action.payload as { source: string; target: string; type: string };
        if (edgePayload.source && edgePayload.target) {
          this.canvas.addEdge({
            source: edgePayload.source, target: edgePayload.target,
            type: edgePayload.type as any,
            phase, flowId: this.currentFlowId,
          });
        }
        return true;
      }

      case 'request_decision': {
        const decPayload = action.payload as any;
        if (!decPayload?.title) return true;
        await this.requestDecision(
          decPayload.title,
          decPayload.description || '',
          decPayload.options || [],
        );
        return true;
      }

      case 'wait_for_user':
        await this.waitForUserInput(action.payload as any);
        return true;

      case 'summarize':
        this.broadcastMessage('facilitator', (action.payload as any)?.summary || '', 'thought');
        return true;

      default:
        console.warn('Unknown facilitator action:', action.type);
        return true;
    }
  }

  private async inviteAgent(role: AgentRole, question: string) {
    const agent = this.agents.get(role);
    if (!agent) {
      console.warn(`Agent "${role}" not found`);
      return;
    }

    this.broadcastMessage(role, question, 'question');
    console.log(`[Orchestrator] Calling agent "${agent.label}" with model "${agent.config.model}"`);
    this.broadcastAgentStatus(role, 'thinking');
    const resp = await agent.call({
      instruction: question,
      context: this.buildContext(this.currentPhase, role),
      signal: this.abortController.signal,
      provider: this.llmProvider, baseURL: this.llmBaseURL, apiKey: this.llmApiKey,
    });

    if (resp.timedOut) {
      console.log(`[Orchestrator] Agent "${agent.label}" timed out`);
      this.broadcastAgentStatus(role, 'error', '超时', resp.inputTokens, resp.outputTokens);
      this.broadcastMessage(role, `⚠️ ${agent.label} 响应超时，跳过本轮。`, 'action');
      this.flowHistory.push(`[${agent.label} timed out]`);
      return;
    }

    this.broadcastAgentStatus(role, 'speaking', undefined, resp.inputTokens, resp.outputTokens);
    console.log(`[Orchestrator] Agent "${agent.label}" responded: ${resp.content.slice(0, 100)}...`);

    if (resp.decisionRequest) {
      this.pendingDecision = {
        ...resp.decisionRequest,
        resolve: (response: string) => {
          this.flowHistory.push(`[User decision on ${resp.decisionRequest?.title}]: ${response}`);
        },
      } as PendingDecision;
      this.ws.broadcast(this.sessionId, {
        type: 'decision_request', payload: { decision: resp.decisionRequest },
        timestamp: Date.now(),
      });
    }

    this.broadcastMessage(role, resp.content, 'thought', resp.inputTokens, resp.outputTokens);
    this.processAgentActions(role, resp.actions);
  }

  private processAgentActions(role: AgentRole, actions: CanvasAction[]) {
    for (const action of actions || []) {
      switch (action.type) {
        case 'propose_note': {
          const note = action.payload as Partial<StickyNote>;
          const existing = this.canvas.getNotes().find((n) => n.content === note.content && n.type === note.type);
          if (!existing) {
            this.canvas.addNote({
              type: (note.type || 'note') as StickyNote['type'],
              content: note.content || '',
              position: note.position || { x: 100 + Math.random() * 400, y: 100 + Math.random() * 400 },
              author: role,
              status: 'active',
              phase: this.currentPhase,
              flowId: this.currentFlowId,
            });
            this.flowHistory.push(`[${role} proposed: ${note.content}]`);
          }
          break;
        }
        case 'propose_edges': {
          const edgePayload = action.payload as { edges?: Array<{ source: string; target: string; type: string }> };
          if (edgePayload.edges) {
            for (const e of edgePayload.edges) {
              this.canvas.addEdge({
                source: e.source, target: e.target,
                type: e.type as any,
                phase: this.currentPhase, flowId: this.currentFlowId,
              });
            }
          }
          break;
        }
        case 'disagree': {
          const da = action.payload as { reason?: string } | null;
          this.flowHistory.push(`[${role} DISAGREES]: ${da?.reason || ''}`);
          break;
        }
      }
    }

    this.ws.broadcast(this.sessionId, {
      type: 'canvas_update',
      payload: { change: { type: 'batch', timestamp: Date.now() }, state: this.canvas.getState() },
      timestamp: Date.now(),
    });
  }

  private async facilitatorSay(content: string) {
    this.broadcastMessage('facilitator', content, 'thought');
    this.flowHistory.push(`[Facilitator]: ${content}`);
  }

  private broadcastAgentStatus(role: AgentRole, status: AgentStatusInfo['status'], message?: string, inputTokens?: number, outputTokens?: number) {
    const agent = this.agents.get(role);
    if (!agent) return;
    this.ws.broadcast(this.sessionId, {
      type: 'agent_status',
      payload: {
        status: {
          role, label: agent.label, color: agent.config.color,
          model: agent.config.model, status, message, inputTokens, outputTokens,
        } satisfies AgentStatusInfo,
      },
      timestamp: Date.now(),
    });
  }

  private broadcastMessage(from: AgentRole, content: string, type: AgentMessage['type'], inputTokens?: number, outputTokens?: number) {
    this.ws.broadcast(this.sessionId, {
      type: 'agent_message',
      payload: {
        message: {
          id: randomUUID(), sessionId: this.sessionId, from, to: 'all',
          content, phase: this.currentPhase, timestamp: Date.now(), type,
          inputTokens, outputTokens,
        } satisfies AgentMessage,
      },
      timestamp: Date.now(),
    });
  }

  private async requestDecision(title: string, description: string, options: any[]) {
    const id = randomUUID();
    const decision: DecisionRequest = {
      id, sessionId: this.sessionId, phase: this.currentPhase,
      title, description,
      context: this.flowHistory.slice(-5),
      options: options.map((o: any, i: number) => ({ id: `opt-${i}`, label: o.label || o, description: o.description || '' })),
      from: ['facilitator'],
      status: 'pending', createdAt: Date.now(),
    };

    this.pendingDecision = {
      ...decision,
      resolve: (response: string) => {
        this.flowHistory.push(`[User decision on "${title}"]: ${response}`);
      },
    } as PendingDecision;

    this.ws.broadcast(this.sessionId, {
      type: 'decision_request',
      payload: { decision },
      timestamp: Date.now(),
    });

    this.waitingForInput = true;
    this.ws.broadcast(this.sessionId, {
      type: 'session_state',
      payload: { status: 'waiting_input' },
      timestamp: Date.now(),
    });
  }

  private async waitForUserInput(payload: any) {
    this.waitingForInput = true;
    this.broadcastMessage('facilitator', `⏸️ Paused — waiting for your input: ${(payload as any)?.prompt || ''}`, 'action');
    this.ws.broadcast(this.sessionId, {
      type: 'session_state', payload: { status: 'waiting_input' },
      timestamp: Date.now(),
    });
    const input = await this.waitFor('input');
    this.flowHistory.push(`[User input]: ${input}`);
    this.waitingForInput = false;
    this.ws.broadcast(this.sessionId, {
      type: 'session_state', payload: { status: 'running' },
      timestamp: Date.now(),
    });
  }

  private async handleUserInput(input: string) {
    if (this.pendingDecision) {
      try {
        const parsed = JSON.parse(input);
        if (parsed.action === 'skip') {
          this.flowHistory.push('[Decision skipped]');
        } else {
          const chosen = parsed.optionId
            ? this.pendingDecision.options?.find((o: any) => o.id === parsed.optionId)?.label || parsed.optionId
            : parsed.customInput || input;
          this.flowHistory.push(`[Decision]: ${chosen}`);
        }
      } catch {
        this.flowHistory.push(`[User input]: ${input}`);
      }
      this.pendingDecision.resolve(input);
      this.pendingDecision = null;
    }
    this.waitingForInput = false;
    this.ws.broadcast(this.sessionId, {
      type: 'session_state', payload: { status: 'running' },
      timestamp: Date.now(),
    });
  }

  private buildContext(phase: string, role: AgentRole) {
    const history = this.flowHistory;
    const recentHistory = history.length > 12
      ? history.slice(-12).map((e) => e.length > 200 ? e.slice(0, 200) + '...[truncated]' : e)
      : history.map((e) => e.length > 200 ? e.slice(0, 200) + '...[truncated]' : e);
    const compactNote = '\n[System tip: long responses truncated. Continue based on key info.]';
    return {
      phase,
      domainDescription: this.currentFlowDesc,
      noteSummary: this.canvas.getStateSummary(this.currentFlowId),
      conversationHistory: [...recentHistory, compactNote],
      canvasState: this.canvas.getStateSummary(this.currentFlowId),
    };
  }

  private waitFor(reason: 'input' | 'resume'): Promise<string> {
    return new Promise((resolve) => {
      this.inputResolver = resolve;
    });
  }
}
