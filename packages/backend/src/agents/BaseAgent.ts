import type { AgentConfig, AgentRole, CanvasAction } from '@team-architecture-kata/shared';
import { callAIWithRetry } from '../llm/callAI.js';

export interface AgentResponse {
  role: AgentRole;
  content: string;
  actions: CanvasAction[];
  decisionRequest?: import('@team-architecture-kata/shared').DecisionRequest;
  timedOut?: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentCallOptions {
  instruction: string;
  context: { phase: string; domainDescription: string; noteSummary: string; conversationHistory: string[]; canvasState: string };
  signal?: AbortSignal;
  provider?: string; baseURL?: string; apiKey?: string;
}

export abstract class BaseAgent {
  constructor(public readonly config: AgentConfig) {}
  get role(): AgentRole { return this.config.role; }
  get label(): string { return this.config.label; }
  get model(): string { return this.config.model; }
  abstract call(options: AgentCallOptions): Promise<AgentResponse>;

  protected buildSystemPrompt(phase: string): string { return this.config.systemPrompt.replace('{phase}', phase); }

  protected async callAIAndParse(instruction: string, context: AgentCallOptions['context'], signal?: AbortSignal, llmOverrides?: { provider?: string; baseURL?: string; apiKey?: string },
  ): Promise<{ text: string; parsed: any; rawResult: import('../llm/callAI.js').CallAIResult }> {
    const systemPrompt = this.buildSystemPrompt(context.phase);
    const prompt = [
      `## 当前阶段: ${context.phase}`, `## 领域: ${context.domainDescription}`, `## 当前画布:`, context.canvasState, '',
      context.conversationHistory.length > 0 ? `## 讨论记录:\n${context.conversationHistory.join('\n')}` : '## 这是本轮开始。', '',
      `## 任务:`, instruction,
    ].join('\n');
    const historyLen = context.conversationHistory.length;
    const timeoutMs = Math.min(90_000 + historyLen * 5_000, 300_000);
    const rawResult = await callAIWithRetry({ model: this.config.model, system: systemPrompt, messages: [{ role: 'user', content: prompt }], responseFormat: 'json', signal, timeoutMs, provider: llmOverrides?.provider, baseURL: llmOverrides?.baseURL, apiKey: llmOverrides?.apiKey });
    if (rawResult.timedOut) return { text: '', parsed: null, rawResult };
    let parsed: any = null;
    try { parsed = JSON.parse(rawResult.text); } catch { /* raw text */ }
    return { text: rawResult.text, parsed, rawResult };
  }

  protected normalizeResponse(data: any, rawText: string): { content: string; actions: any[] } {
    const content = data.reasoning || data.content || data.response?.answer || data.response?.question || rawText;
    let actions = data.actions || [];
    if (!actions.length && data.qaScenarios?.length) actions = data.qaScenarios.map((e: any) => ({ type: 'propose_note', payload: { type: 'qa_scenario', content: e.name || e.scenario || e.content || e } }));
    if (!actions.length && data.constraints?.length) actions = data.constraints.map((c: any) => ({ type: 'propose_note', payload: { type: 'constraint', content: c.content || c.name || c } }));
    if (!actions.length && data.modules?.length) actions = data.modules.map((m: any) => ({ type: 'propose_note', payload: { type: 'module', content: m.name || m.content || m } }));
    if (!actions.length && data.patterns?.length) actions = data.patterns.map((p: any) => ({ type: 'propose_note', payload: { type: 'pattern', content: p.selectedPattern || p.name || p.content || p } }));
    return { content, actions };
  }
}
