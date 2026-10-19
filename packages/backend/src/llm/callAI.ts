import { getLLMConfig } from './LLMConfig.js';

interface CallAIOptions {
  model: string;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  responseFormat?: 'text' | 'json';
  signal?: AbortSignal;
  timeoutMs?: number;
  provider?: string;
  baseURL?: string;
  apiKey?: string;
}

export interface CallAIResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  timedOut?: boolean;
}

export async function callAI(options: CallAIOptions): Promise<CallAIResult> {
  const globalConfig = getLLMConfig();
  const config = {
    ...globalConfig,
    provider: (options.provider as any) || globalConfig.provider,
    baseURL: options.baseURL || globalConfig.baseURL,
    apiKey: options.apiKey || globalConfig.apiKey,
  };
  const timeout = options.timeoutMs || 60000;
  const timeoutSignal = AbortSignal.timeout(timeout);
  const combinedSignal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
  const callOpts = { ...options, signal: combinedSignal };
  try {
    switch (config.provider) {
      case 'anthropic': return callAnthropic(callOpts);
      case 'openai-compatible': case 'openai': return callOpenAICompatible(callOpts);
      default: return callAnthropic(callOpts);
    }
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError' || err?.name === 'TimeoutError' || err?.name === 'APIUserAbortError'
      || err?.code === 'TIMEOUT' || err?.code === 'ECONNABORTED' || err?.type === 'timeout';
    if (isAbort) return { text: '', timedOut: true };
    throw err;
  }
}

/** Wrapper with auto-retry on timeout and rate limiting. */
export async function callAIWithRetry(options: CallAIOptions & { retries?: number }): Promise<CallAIResult> {
  const maxRetries = options.retries ?? 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await callAI(options);
      if (!result.timedOut) return result;
      console.log(`[AI] Timeout, retry ${attempt + 1}/${maxRetries}`);
    } catch (err: any) {
      const msg = err?.message || err?.status || '';
      const isRateLimit = msg?.toString().includes('429') || msg?.toString().includes('rate limit') || msg?.toString().includes('Rate limit');
      if (isRateLimit && attempt < maxRetries) {
        const noDeploy = msg?.toString().includes('No deployments available');
        if (noDeploy) {
          console.log(`[AI] Model "${options.model}" not available`);
          throw new Error(`MODEL_UNAVAILABLE: ${options.model}`);
        }
        // Extract retry delay from error message or use exponential backoff
        const delayMatch = msg?.toString().match(/after\s+([\d.]+)s/);
        const baseDelay = delayMatch ? parseFloat(delayMatch[1]) * 1000 : Math.min(1000 * Math.pow(2, attempt), 8000);
        const jitter = Math.random() * 500;
        const delay = baseDelay + jitter;
        console.log(`[AI] Rate limited, retry ${attempt + 1}/${maxRetries} after ${delay.toFixed(0)}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (attempt >= maxRetries) throw err;
      console.log(`[AI] Call failed (attempt ${attempt + 1}), retrying...`, msg?.slice(0, 100));
    }
  }
  return { text: '', timedOut: true };
}

async function callAnthropic(options: CallAIOptions): Promise<CallAIResult> {
  const globalConfig = getLLMConfig();
  const apiKey = options.apiKey || globalConfig.apiKey;
  const baseURL = options.baseURL || globalConfig.baseURL;
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey, baseURL });
  const systemMsg = options.responseFormat === 'json'
    ? `${options.system}\n\nYou MUST respond in valid JSON format only, with no markdown wrapping.`
    : options.system;
  const msgs = options.messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
  const response = await client.messages.create({ model: options.model, max_tokens: 8192, system: systemMsg, messages: msgs }, { signal: options.signal });
  const textBlock = response.content.find((b) => b.type === 'text');
  return { text: textBlock?.text || '', inputTokens: response.usage?.input_tokens, outputTokens: response.usage?.output_tokens };
}

async function callOpenAICompatible(options: CallAIOptions): Promise<CallAIResult> {
  const globalConfig = getLLMConfig();
  const apiKey = options.apiKey || globalConfig.apiKey;
  const baseURL = options.baseURL || globalConfig.baseURL;
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey, baseURL });
  const sysMsg = { role: 'system' as const, content: options.responseFormat === 'json' ? `${options.system}\n\nYou MUST respond in valid JSON format only.` : options.system };
  const msgs = [...options.messages];
  const response = await client.chat.completions.create({ model: options.model, max_tokens: 8192, messages: [sysMsg, ...msgs], response_format: options.responseFormat === 'json' ? { type: 'json_object' } : undefined }, { signal: options.signal });
  const choice = response.choices?.[0];
  return { text: choice?.message?.content || '', inputTokens: response.usage?.prompt_tokens, outputTokens: response.usage?.completion_tokens };
}
