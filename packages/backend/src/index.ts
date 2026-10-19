import 'dotenv/config';
import { WebSocketManager } from './ws/WebSocketManager.js';
import { CanvasManager } from './canvas/CanvasManager.js';
import { Orchestrator } from './orchestrator/Orchestrator.js';
import { AgentRegistry } from './agents/AgentRegistry.js';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getLLMConfig, fetchAvailableModels, resetLLMConfig } from './llm/LLMConfig.js';
import { detectLocalAgents } from './llm/AgentDetector.js';
import { parseFileUpload } from './routes/fileUpload.js';

const sessions = new Map<string, { session: any; canvas: CanvasManager; orchestrator: Orchestrator }>();

const server = createServer((_req, res) => {
  if (_req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  if (_req.url === '/api/parse-file' && _req.method === 'POST') {
    parseFileUpload(_req).then((result) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    }).catch((err: Error) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  if (_req.url === '/api/config') {
    const cfg = getLLMConfig();
    fetchAvailableModels().then((models) => {
      if (res.writableEnded) return;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        availableModels: models,
        providers: ['anthropic', 'openai-compatible', 'openai'],
        currentProvider: cfg.provider,
        defaultModel: cfg.defaultModel,
        modelMap: cfg.modelMap,
      }));
    }).catch(() => {
      if (res.writableEnded) return;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        availableModels: [],
        providers: ['anthropic', 'openai-compatible', 'openai'],
        currentProvider: cfg.provider,
        defaultModel: cfg.defaultModel,
        modelMap: cfg.modelMap,
      }));
    });
    return;
  }
  if (_req.url === '/api/detect-agents') {
    detectLocalAgents().then((agents) => {
      if (res.writableEnded) return;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ agents }));
    }).catch(() => {
      if (res.writableEnded) return;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ agents: [] }));
    });
    return;
  }

  if (_req.url === '/api/config' && _req.method === 'POST') {
    let body = '';
    _req.on('data', (chunk) => body += chunk);
    _req.on('end', () => {
      try {
        const newConfig = JSON.parse(body);
        const configPath = resolve(dirname(fileURLToPath(import.meta.url)), '../llm.config.json');
        const existing = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf-8')) : {};
        const merged = { ...existing, ...newConfig };
        writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
        resetLLMConfig();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const wsm = new WebSocketManager(server);

wsm.on('create_session', async (ws, payload) => {
  const config = payload.config as any;
  const id = randomUUID();

  const agentRegistry = new AgentRegistry(config);
  const canvas = new CanvasManager(id);
  const orchestrator = new Orchestrator(id, agentRegistry, canvas, wsm, config.flows, {
    provider: config.llmProvider, baseURL: config.llmBaseURL, apiKey: config.llmApiKey,
  });

  const session = {
    id, name: config.flows[0]?.name?.slice(0, 50) || 'Team Architecture Kata',
    config, status: 'idle', currentFlowIndex: 0, phase: 'drivers',
    phaseHistory: [], canvas: { notes: [], edges: [] },
    createdAt: Date.now(), updatedAt: Date.now(), pendingDecisions: 0, unresolvedCount: 0,
  };

  sessions.set(id, { session, canvas, orchestrator });

  wsm.subscribe(ws, id);
  ws.send(JSON.stringify({ type: 'session_created', payload: { sessionId: id }, timestamp: Date.now() }));

  session.status = 'running';
  orchestrator.start().catch((err) => {
    console.error('Orchestrator error:', err);
    session.status = 'error';
    wsm.broadcast(id, { type: 'error', payload: { message: 'Orchestrator error: ' + (err as Error).message }, timestamp: Date.now() });
  });
});

wsm.on('reconnect_session', (ws, payload) => {
  const sessionId = payload?.sessionId as string;
  if (!sessionId || !sessions.has(sessionId)) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Session not found' }, timestamp: Date.now() }));
    return;
  }
  wsm.subscribe(ws, sessionId);
  const entry = sessions.get(sessionId)!;
  ws.send(JSON.stringify({
    type: 'session_state',
    payload: { status: entry.session.status, flowName: entry.session.config.flows?.[entry.session.currentFlowIndex]?.name || '' },
    timestamp: Date.now(),
  }));
  ws.send(JSON.stringify({
    type: 'canvas_update',
    payload: { state: { notes: entry.canvas.getNotes(), edges: entry.canvas.getEdges() } },
    timestamp: Date.now(),
  }));
  ws.send(JSON.stringify({
    type: 'phase_change',
    payload: { phase: entry.session.phase, phaseLabel: entry.session.phase },
    timestamp: Date.now(),
  }));
  console.log(`[Server] Client reconnected to session ${sessionId}`);
});

wsm.on('session_control', async (ws, payload) => {
  const { sessionId, action } = payload as { sessionId: string; action: 'pause' | 'resume' | 'stop' };
  const entry = sessions.get(sessionId);
  if (!entry) return;
  const { session, orchestrator } = entry;
  switch (action) {
    case 'pause': session.status = 'paused'; orchestrator.pause(); break;
    case 'resume': session.status = 'running'; orchestrator.resume(); break;
    case 'stop': session.status = 'complete'; orchestrator.stop(); break;
  }
  wsm.broadcast(sessionId, { type: 'session_state', payload: { status: session.status }, timestamp: Date.now() });
});

wsm.on('user_input', async (ws, payload) => {
  const { sessionId, content } = payload as { sessionId: string; content: string };
  const entry = sessions.get(sessionId);
  if (!entry) return;
  entry.orchestrator.receiveUserInput(content, 'chat');
});

wsm.on('update_agent_model', async (ws, payload) => {
  const { sessionId, role, model } = payload as { sessionId: string; role: string; model: string };
  const entry = sessions.get(sessionId);
  if (!entry) return;
  const agent = entry.orchestrator.getAgent(role);
  if (agent) {
    (agent.config as any).model = model;
    wsm.broadcast(sessionId, {
      type: 'agent_status',
      payload: { status: { role: agent.role, label: agent.label, color: agent.config.color, model: agent.config.model, status: 'idle' } },
      timestamp: Date.now(),
    });
  }
});

wsm.on('decision_response', async (ws, payload) => {
  const { sessionId, ...response } = payload as { sessionId: string; requestId?: string; optionId?: string; customInput?: string; action: string };
  const entry = sessions.get(sessionId);
  if (!entry) return;
  entry.orchestrator.receiveUserInput(JSON.stringify(response), 'decision');
});

const PORT = parseInt(process.env.PORT || '3002', 10);
server.listen(PORT, () => {
  console.log(`Team Architecture Kata Server running on port ${PORT}`);
});
