export interface BackendConfig {
  availableModels: string[];
  providers: string[];
  currentProvider: string;
}

export interface DetectedAgent {
  id: string; name: string; provider: 'anthropic' | 'openai' | 'openai-compatible';
  baseURL: string; apiKey: string; available: boolean; models: string[];
  description: string; source: 'cli' | 'env' | 'proxy' | 'config';
}

export async function fetchConfig(): Promise<BackendConfig> {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Failed to fetch backend config');
  return res.json();
}

export async function fetchDetectedAgents(): Promise<DetectedAgent[]> {
  try { const res = await fetch('/api/detect-agents'); if (!res.ok) return []; const data = await res.json(); return data.agents || []; }
  catch { return []; }
}
