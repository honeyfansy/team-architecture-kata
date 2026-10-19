import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { getLLMConfig, fetchAvailableModels } from './LLMConfig.js';

export interface DetectedAgent {
  id: string; name: string; provider: 'anthropic' | 'openai' | 'openai-compatible';
  baseURL: string; apiKey: string; available: boolean; models: string[];
  description: string; source: 'cli' | 'env' | 'proxy' | 'config';
}

function which(cmd: string): boolean {
  try { execSync(`which "${cmd}" 2>/dev/null`, { stdio: 'ignore', timeout: 2000 }); return true; } catch { return false; }
}

export async function detectLocalAgents(): Promise<DetectedAgent[]> {
  const agents: DetectedAgent[] = []; const currentConfig = getLLMConfig();
  if (which('claude')) {
    let claudeBaseURL = ''; let claudeApiKey = '';
    try { const settingsPath = join(homedir(), '.claude', 'settings.json'); if (existsSync(settingsPath)) { const s = JSON.parse(readFileSync(settingsPath, 'utf-8')); claudeBaseURL = s.env?.ANTHROPIC_BASE_URL || ''; claudeApiKey = s.env?.ANTHROPIC_AUTH_TOKEN || s.env?.ANTHROPIC_API_KEY || ''; } } catch { /* ignore */ }
    if (!claudeApiKey) claudeApiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';
    let models: string[] = []; const fetchURL = claudeBaseURL ? `${claudeBaseURL.replace(/\/+$/, '')}/v1/models` : 'https://api.anthropic.com/v1/models';
    try { const res = await fetch(fetchURL, { headers: { 'x-api-key': claudeApiKey, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(3000) }); if (res.ok) { const data = await res.json() as any; models = (data.data || []).map((m: any) => m.id).filter(Boolean).sort(); } } catch { /* ignore */ }
    if (models.length > 0) agents.push({ id: 'claude-code', name: 'Claude Code CLI', provider: 'anthropic', baseURL: claudeBaseURL || 'https://api.anthropic.com', apiKey: claudeApiKey, available: true, models, description: '本地 Claude Code CLI', source: 'cli' });
  }
  if (process.env.ANTHROPIC_API_KEY && !which('claude')) {
    let models: string[] = [];
    try { const res = await fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(3000) }); if (res.ok) { const data = await res.json() as any; models = (data.data || []).map((m: any) => m.id).filter(Boolean).sort(); } } catch { /* ignore */ }
    if (models.length > 0) agents.push({ id: 'anthropic-api', name: 'Anthropic API (环境变量)', provider: 'anthropic', baseURL: 'https://api.anthropic.com', apiKey: process.env.ANTHROPIC_API_KEY, available: true, models, description: '通过 ANTHROPIC_API_KEY 环境变量配置', source: 'env' });
  }
  if (which('codex')) {
    let codexApiKey = process.env.OPENAI_API_KEY || ''; let codexBaseURL = 'https://api.openai.com/v1'; let codexProvider = '';
    try { const authPath = join(homedir(), '.codex', 'auth.json'); if (existsSync(authPath)) { const a = JSON.parse(readFileSync(authPath, 'utf-8')); codexApiKey = a.OPENAI_API_KEY || codexApiKey; } const configPath = join(homedir(), '.codex', 'config.toml'); if (existsSync(configPath)) { const raw = readFileSync(configPath, 'utf-8'); for (const line of raw.split('\n')) { const m = line.match(/^base_url\s*=\s*"(.+)"$/); if (m) codexBaseURL = m[1]; const p = line.match(/^wire_api\s*=\s*"(.+)"$/); if (p) codexProvider = p[1]; } } } catch { /* ignore */ }
    let models: string[] = [];
    if (codexApiKey && codexBaseURL) {
      try { const res = await fetch(`${codexBaseURL.replace(/\/+$/, '')}/models`, { headers: { Authorization: `Bearer ${codexApiKey}` }, signal: AbortSignal.timeout(5000) }); if (res.ok) { const data = await res.json() as any; const raw: any[] = data.data || data.models || []; for (const m of raw) { const name = m.slug || m.id || m.model || m.name || (typeof m === 'string' ? m : ''); if (name) models.push(name); } models.sort(); } } catch { /* ignore */ }
    }
    if (models.length > 0) agents.push({ id: 'codex', name: 'Codex CLI', provider: codexProvider === 'responses' ? 'openai' : 'openai-compatible', baseURL: codexBaseURL, apiKey: codexApiKey, available: true, models, description: '本地 Codex CLI', source: 'cli' });
  }
  if (process.env.OPENAI_API_KEY) {
    let models: string[] = [];
    try { const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, signal: AbortSignal.timeout(3000) }); if (res.ok) { const data = await res.json() as any; models = (data.data || []).map((m: any) => m.id).filter((id: string) => id.startsWith('gpt-') || id.startsWith('o')).sort(); } } catch { /* ignore */ }
    if (models.length > 0) agents.push({ id: 'openai', name: 'OpenAI API (环境变量)', provider: 'openai', baseURL: 'https://api.openai.com/v1', apiKey: process.env.OPENAI_API_KEY, available: true, models, description: '通过 OPENAI_API_KEY 环境变量配置', source: 'env' });
  }
  if (which('ollama')) {
    let models: string[] = [];
    try { const output = execSync('ollama list 2>/dev/null', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' }); models = output.split('\n').slice(1).filter((l) => l.trim()).map((l) => l.split(/\s+/)[0]).filter(Boolean); } catch { /* ignore */ }
    if (models.length > 0) agents.push({ id: 'ollama', name: 'Ollama (本地)', provider: 'openai-compatible', baseURL: 'http://localhost:11434/v1', apiKey: 'ollama', available: true, models, description: '本地 Ollama 服务', source: 'cli' });
  }
  for (const port of [4000, 8787]) {
    try { const res = await fetch(`http://localhost:${port}/v1/models`, { signal: AbortSignal.timeout(1000) }); if (res.ok) { const data = await res.json() as any; const models: string[] = (data.data || []).map((m: any) => m.id || m).filter(Boolean).sort(); if (models.length > 0) agents.push({ id: `proxy-${port}`, name: `LLM 代理 (端口 ${port})`, provider: 'openai-compatible', baseURL: `http://localhost:${port}/v1`, apiKey: '', available: true, models, description: `本地代理服务 (http://localhost:${port})`, source: 'proxy' }); } } catch { /* ignore */ }
  }
  if (currentConfig.baseURL) {
    try { const models = await fetchAvailableModels(); if (models.length > 0 && !agents.some((a) => a.baseURL.includes(currentConfig.baseURL.replace('http://', '').replace('https://', '').split('/')[0]))) agents.push({ id: 'configured-proxy', name: currentConfig.provider === 'anthropic' ? 'Anthropic 代理' : 'OpenAI 兼容代理', provider: currentConfig.provider, baseURL: currentConfig.baseURL, apiKey: currentConfig.apiKey, available: true, models, description: `当前配置的 LLM 服务 (${currentConfig.baseURL})`, source: 'config' }); } catch { /* ignore */ }
  }
  return agents;
}
