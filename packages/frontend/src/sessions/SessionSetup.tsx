import React, { useState, useEffect, useRef } from 'react';
import { useSessionStore } from '../store/useSessionStore.js';
import { fetchConfig, fetchDetectedAgents, type BackendConfig, type DetectedAgent } from '../store/api.js';
import type { AgentRole, SessionConfig, AgentConfig } from '@team-architecture-kata/shared';

interface AgentOption { role: AgentRole; label: string; color: string; enabled: boolean; model: string; temperature: number; }

const ROLES: { role: AgentRole; label: string; color: string }[] = [
  { role: 'domain_architect', label: '领域与数据架构师', color: '#3b82f6' },
  { role: 'system_architect', label: '系统与集成架构师', color: '#22c55e' },
  { role: 'quality_analyst', label: '质量属性分析师', color: '#a855f7' },
];
const DETAILED_ROLES: { role: AgentRole; label: string; color: string }[] = [
  { role: 'technology_architect', label: '技术架构师', color: '#6366f1' },
  { role: 'data_architect', label: '数据架构师', color: '#14b8a6' },
  { role: 'infra_architect', label: '基础设施架构师', color: '#f97316' },
  { role: 'risk_reviewer', label: '风险评审者', color: '#f43f5e' },
];

export function SessionSetup() {
  const createSession = useSessionStore((s) => s.createSession);
  const wsConnected = useSessionStore((s) => s.connected);
  const [domain, setDomain] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'event_storming' | 'product_workshop' | 'both'>('text');
  const [inheritedInput, setInheritedInput] = useState('');
  const [inheritedInput2, setInheritedInput2] = useState('');

  const [usingFileUpload, setUsingFileUpload] = useState(false);
  const [mode, setMode] = useState<'smart_pause' | 'automatic' | 'manual'>('smart_pause');
  const [roleMode, setRoleMode] = useState<'simple' | 'detailed'>('simple');
  const [detailedEnabled, setDetailedEnabled] = useState<Record<string, boolean>>({});
  const [backendConfig, setBackendConfig] = useState<BackendConfig | null>(null);
  const [detectedAgents, setDetectedAgents] = useState<DetectedAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [configError, setConfigError] = useState('');

  const [agents, setAgents] = useState<AgentOption[]>(() => getDefaultAgents([]));

  function getSelectedAgentModels(): string[] {
    if (selectedAgentId && detectedAgents.length > 0) { const agent = detectedAgents.find((a) => a.id === selectedAgentId); if (agent?.models?.length) return agent.models; }
    return backendConfig?.availableModels || [];
  }

  function getDefaultAgents(models: string[]): AgentOption[] {
    const defaultModel = models[0] || '';
    return [
      { role: 'facilitator', label: '主持人', color: '#6b7280', enabled: true, model: defaultModel, temperature: 0.3 },
      ...ROLES.map((r) => ({ ...r, enabled: true, model: defaultModel, temperature: 0.5 })),
    ];
  }

  useEffect(() => {
    Promise.all([fetchConfig(), fetchDetectedAgents()]).then(([cfg, agentsList]) => {
      setBackendConfig(cfg); setDetectedAgents(agentsList); setConfigError('');
      const preferred = agentsList.find((a) => a.source === 'config') || agentsList.find((a) => a.id === 'claude-code') || agentsList[0];
      setSelectedAgentId(preferred?.id || '');
      const models = preferred?.models?.length ? preferred.models : cfg.availableModels;
      setAgents(getDefaultAgents(models)); setLoadingAgents(false);
    }).catch(() => { setConfigError('Cannot connect to backend — is it running on port 3002?'); setLoadingAgents(false); });
  }, []);

  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    const agent = detectedAgents.find((a) => a.id === agentId);
    const models = agent?.models?.length ? agent.models : (backendConfig?.availableModels || []);
    setAgents((prev) => prev.map((a) => ({ ...a, model: models[0] || a.model })));
  };

  const handleStart = () => {
    if (!domain.trim() && !inheritedInput.trim()) return;
    if (inputMode === 'both' && !inheritedInput2.trim()) return;
    const description = inputMode === 'both'
      ? `【事件风暴产出】\n${inheritedInput.trim()}\n\n【产品工作坊产出】\n${inheritedInput2.trim()}`
      : inputMode !== 'text' ? inheritedInput.trim() : domain.trim();
    const flowConfigs: import('@team-architecture-kata/shared').FlowConfig[] = [{
      id: crypto.randomUUID(), name: description.slice(0, 40), description,
      phase: 'drivers', phaseHistory: [], status: 'pending',
    }];

    const models = getSelectedAgentModels();
    const fallbackModel = models[0] || '';

    const defaultRoles: AgentOption[] = [
      { role: 'facilitator', label: '主持人', color: '#6b7280', enabled: true, model: agents.find((a) => a.role === 'facilitator')?.model || fallbackModel, temperature: 0.3 },
      ...ROLES.map((r) => ({ ...r, enabled: true, model: agents.find((a) => a.role === r.role)?.model || fallbackModel, temperature: 0.5 })),
    ];

    const extraRoles = roleMode === 'detailed' ? DETAILED_ROLES.filter((r) => detailedEnabled[r.role]).map((r) => ({ ...r, enabled: true, model: fallbackModel, temperature: 0.5 })) : [];

    const agentConfigs: AgentConfig[] = [...defaultRoles, ...extraRoles].map((a) => ({
      role: a.role, label: a.label, model: a.model, temperature: a.temperature,
      systemPrompt: '', color: a.color, enabled: true,
    }));

    const selectedAgent = detectedAgents.find((a) => a.id === selectedAgentId);
    const config: SessionConfig = {
      flows: flowConfigs, agents: agentConfigs, interventionMode: mode,
      autoConfirmPhase: mode === 'automatic', canvasChangeResponse: 'continue',
      llmProvider: selectedAgent?.provider || backendConfig?.currentProvider || 'anthropic',
      llmBaseURL: selectedAgent?.baseURL || '', llmApiKey: selectedAgent?.apiKey || '',
    };
    createSession(config, models);
  };

  const isInheritedMode = inputMode === 'event_storming' || inputMode === 'product_workshop' || inputMode === 'both';
  const currentModels = getSelectedAgentModels();
  const selectedAgent = detectedAgents.find((a) => a.id === selectedAgentId);

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Team Architecture Kata</h1>
          <p style={styles.subtitle}>多 Agent 并行的系统架构设计工作坊</p>
          {configError && <p style={styles.error}>{configError}</p>}
          {selectedAgent && <p style={styles.providerBadge}>AI: {selectedAgent.name} · {selectedAgent.models.length} models</p>}
        </div>

        <div style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>输入模式</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setInputMode('text')} style={{ ...styles.tabBtn, background: inputMode === 'text' ? '#3b82f6' : '#eee', color: inputMode === 'text' ? 'white' : '#333' }}>独立模式</button>
              <button onClick={() => setInputMode('event_storming')} style={{ ...styles.tabBtn, background: inputMode === 'event_storming' ? '#3b82f6' : '#eee', color: inputMode === 'event_storming' ? 'white' : '#333' }}>继承事件风暴</button>
              <button onClick={() => setInputMode('product_workshop')} style={{ ...styles.tabBtn, background: inputMode === 'product_workshop' ? '#3b82f6' : '#eee', color: inputMode === 'product_workshop' ? 'white' : '#333' }}>继承产品工作坊</button>
              <button onClick={() => setInputMode('both')} style={{ ...styles.tabBtn, background: inputMode === 'both' ? '#3b82f6' : '#eee', color: inputMode === 'both' ? 'white' : '#333' }}>产品工作坊 + 事件风暴</button>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              {inputMode === 'event_storming' ? '事件风暴产出' : inputMode === 'product_workshop' ? '产品工作坊产出' : inputMode === 'both' ? '事件风暴产出' : '系统/业务描述'}
              {isInheritedMode && <span style={{ fontWeight: 400, fontSize: 12, color: '#999' }}>（粘贴文本 或 上传文件）</span>}
            </label>

            {isInheritedMode ? (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button onClick={() => { setUsingFileUpload(false); }} style={{ ...styles.tabBtn, background: !usingFileUpload ? '#3b82f6' : '#eee', color: !usingFileUpload ? 'white' : '#333' }}>粘贴文本</button>
                  <button onClick={() => setUsingFileUpload(true)} style={{ ...styles.tabBtn, background: usingFileUpload ? '#3b82f6' : '#eee', color: usingFileUpload ? 'white' : '#333' }}>上传文件</button>
                </div>

                {inputMode === 'both' ? (
                  <>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6' }}>▸ 事件风暴产出</label>
                    {!usingFileUpload ? (
                      <textarea style={{ ...styles.textarea, marginBottom: 12 }}
                        placeholder="粘贴事件风暴的输出，包括限界上下文、领域事件、角色、业务策略等..."
                        value={inheritedInput} onChange={(e) => setInheritedInput(e.target.value)} rows={5} />
                    ) : (
                      <InputWithUpload value={inheritedInput} onChange={setInheritedInput} placeholder="事件风暴产出" />
                    )}
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>▸ 产品工作坊产出</label>
                    {!usingFileUpload ? (
                      <textarea style={styles.textarea}
                        placeholder="粘贴产品工作坊的输出，包括用户故事、验收条件、业务规则、优先级等..."
                        value={inheritedInput2} onChange={(e) => setInheritedInput2(e.target.value)} rows={5} />
                    ) : (
                      <InputWithUpload value={inheritedInput2} onChange={setInheritedInput2} placeholder="产品工作坊产出" />
                    )}
                  </>
                ) : !usingFileUpload ? (
                  <textarea style={styles.textarea}
                    placeholder={inputMode === 'event_storming' ? '粘贴事件风暴的输出，包括限界上下文、领域事件、角色、业务策略等...' : '粘贴产品工作坊的输出，包括用户故事、验收条件、业务规则、优先级等...'}
                    value={inheritedInput} onChange={(e) => setInheritedInput(e.target.value)} rows={6} />
                ) : (
                  <InputWithUpload value={inheritedInput} onChange={setInheritedInput} placeholder={inputMode === 'event_storming' ? '事件风暴产出' : '产品工作坊产出'} />
                )}
              </>
            ) : (
              <textarea style={styles.textarea} placeholder="描述系统定位、主要业务场景、关键质量要求、技术约束等..."
                value={domain} onChange={(e) => setDomain(e.target.value)} rows={4} />
            )}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>AI 后端 / LLM 供应商</label>
            {loadingAgents ? (<p style={{ fontSize: 12, color: '#999' }}>检测本地 AI Agent...</p>) : detectedAgents.length === 0 ? (<p style={{ fontSize: 12, color: '#f44336' }}>未检测到本地 AI Agent</p>) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                {detectedAgents.map((agent) => (
                  <div key={agent.id} onClick={() => handleAgentChange(agent.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, border: selectedAgentId === agent.id ? '2px solid #3b82f6' : '1px solid #e0e0e0', background: selectedAgentId === agent.id ? '#f0f4ff' : 'white', cursor: 'pointer', fontSize: 12 }}>
                    <input type="radio" checked={selectedAgentId === agent.id} onChange={() => handleAgentChange(agent.id)} />
                    <span style={{ fontWeight: 600, flex: 1 }}>{agent.name}</span>
                    <span style={{ fontSize: 10, color: '#999' }}>{agent.models.length} models</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>角色与模型配置</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#f5f7ff', borderRadius: 10, padding: 12, border: '1px solid #e0e5ff' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setRoleMode('simple'); setDetailedEnabled({}); }} style={{ ...styles.tabBtn, background: roleMode === 'simple' ? '#3b82f6' : '#eee', color: roleMode === 'simple' ? 'white' : '#333' }}>精简（3 人）</button>
                <button onClick={() => { setRoleMode('detailed'); setDetailedEnabled({ technology_architect: true, data_architect: true, infra_architect: true, risk_reviewer: true }); }} style={{ ...styles.tabBtn, background: roleMode === 'detailed' ? '#3b82f6' : '#eee', color: roleMode === 'detailed' ? 'white' : '#333' }}>完整（6+ 人）</button>
              </div>
              <div style={{ borderTop: '1px solid #e0e5ff', paddingTop: 8 }}>
                {currentModels.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6, marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 12, color: '#4f46e5', width: 120, whiteSpace: 'nowrap' }}>⚡ 设为全部</span>
                    <select value={agents[0]?.model || currentModels[0]}
                      onChange={(e) => setAgents((prev) => prev.map((a) => ({ ...a, model: e.target.value })))}
                      style={{ flex: 1, padding: '2px 6px', borderRadius: 4, border: '1px solid #c7d2fe', fontSize: 12, background: 'white' }}>
                      {currentModels.map((m) => (<option key={m} value={m}>{m}</option>))}
                    </select>
                    <button onClick={() => {
                      const model = agents[0]?.model || currentModels[0];
                      setAgents((prev) => prev.map((a) => ({ ...a, model })));
                    }} style={{
                      padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: '#4f46e5', color: 'white', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                    }}>应用到全部</button>
                  </div>
                )}
                {ROLES.map((r) => {
                  const agent = agents.find((a) => a.role === r.role);
                  return (
                    <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: 'white', borderRadius: 6, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: r.color, width: 120 }}>{r.label}</span>
                      {currentModels.length > 0 ? (
                        <select value={agent?.model || currentModels[0]} onChange={(e) => setAgents((prev) => prev.map((a) => a.role === r.role ? { ...a, model: e.target.value } : a))} style={{ flex: 1, padding: '2px 6px', borderRadius: 4, border: '1px solid #ddd', fontSize: 12, background: 'white' }}>
                          {currentModels.map((m) => (<option key={m} value={m}>{m}</option>))}
                        </select>
                      ) : (<span style={{ fontSize: 11, color: '#999' }}>加载中...</span>)}
                    </div>
                  );
                })}
                {roleMode === 'detailed' && DETAILED_ROLES.map((r) => (
                  <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: detailedEnabled[r.role] ? '#f0f4ff' : 'white', borderRadius: 6, marginBottom: 6, opacity: detailedEnabled[r.role] ? 1 : 0.5 }}>
                    <input type="checkbox" checked={!!detailedEnabled[r.role]} onChange={() => {
                      const updated = { ...detailedEnabled, [r.role]: !detailedEnabled[r.role] };
                      setDetailedEnabled(updated);
                      if (!detailedEnabled[r.role] && !agents.find((a) => a.role === r.role)) {
                        setAgents((prev) => [...prev, { role: r.role, label: r.label, color: r.color, enabled: true, model: currentModels[0] || '', temperature: 0.5 }]);
                      }
                    }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: r.color, width: 120 }}>{r.label}</span>
                    {detailedEnabled[r.role] && currentModels.length > 0 && (
                      <select value={agents.find((a) => a.role === r.role)?.model || currentModels[0]}
                        onChange={(e) => setAgents((prev) => prev.map((a) => a.role === r.role ? { ...a, model: e.target.value } : a))}
                        style={{ flex: 1, padding: '2px 6px', borderRadius: 4, border: '1px solid #ddd', fontSize: 12, background: 'white' }}>
                        {currentModels.map((m) => (<option key={m} value={m}>{m}</option>))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Intervention Mode</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['smart_pause', 'automatic', 'manual'].map((m) => (
                <button key={m} onClick={() => setMode(m as any)} style={{ ...styles.tabBtn, background: mode === m ? '#3b82f6' : '#eee', color: mode === m ? 'white' : '#333', fontSize: 12 }}>
                  {m === 'smart_pause' ? '智能暂停' : m === 'automatic' ? '全自动' : '手动'}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleStart} disabled={!(domain.trim() || inheritedInput.trim()) || !wsConnected}
            style={{ padding: '14px 24px', borderRadius: 10, border: 'none', background: '#3b82f6', color: 'white', fontSize: 16, fontWeight: 600, opacity: (domain.trim() || inheritedInput.trim()) && wsConnected ? 1 : 0.5, cursor: (domain.trim() || inheritedInput.trim()) && wsConnected ? 'pointer' : 'not-allowed' }}>
            {wsConnected ? '🚀 启动架构工作坊' : '⏳ 连接服务器中...'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Upload area with drop zone, reused for each input field */
function InputWithUpload({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [uploading, setUploading] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [uploadResults, setUploadResults] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true); setParseErrors([]); setUploadResults([]);
    const allTexts: string[] = [];
    const results: string[] = [];
    const errs: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const fd = new FormData();
        fd.append('file', f);
        const res = await fetch('/api/parse-file', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) { errs.push(`${f.name}: ${data.error || '解析失败'}`); continue; }
        results.push(`✅ ${data.filename} (${(data.size / 1024).toFixed(1)}KB)`);
        if (data.text) allTexts.push(`--- ${f.name} ---\n${data.text}`);
      } catch (err: any) { errs.push(`${f.name}: ${err.message}`); }
    }
    setUploadResults(results);
    setParseErrors(errs);
    if (allTexts.length > 0) onChange(allTexts.join('\n\n'));
    setUploading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} multiple accept=".md,.html,.htm,.xlsx,.xls,.csv,.txt" />
      {!value ? (
        <div style={styles.dropZone} onClick={() => fileInputRef.current?.click()}>
          {uploading ? (<span>解析中...</span>) : (
            <><span style={{ fontSize: 28 }}>📄</span><span style={{ color: '#888', fontSize: 13 }}>点击上传文件，支持 .md .html .xlsx .csv .txt</span></>
          )}
        </div>
      ) : (
        <textarea style={{ ...styles.textarea, border: '2px solid #4CAF50' }}
          placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} rows={5} />
      )}
      {uploadResults.map((r, i) => <span key={i} style={{ fontSize: 12, color: '#4CAF50', fontWeight: 600, display: 'block' }}>{r}</span>)}
      {parseErrors.map((e, i) => <span key={i} style={{ fontSize: 12, color: '#f44336', display: 'block' }}>{e}</span>)}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { width: '100vw', height: '100vh', overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px 0' },
  card: { background: 'white', borderRadius: 16, padding: '24px 32px', width: 640, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  header: { marginBottom: 28, textAlign: 'center' },
  title: { fontSize: 28, fontWeight: 700, color: '#333' },
  subtitle: { color: '#888', marginTop: 8, fontSize: 14 },
  error: { color: '#f44336', fontSize: 13, marginTop: 8 },
  providerBadge: { display: 'inline-block', marginTop: 8, padding: '2px 10px', background: '#e8f5e9', borderRadius: 12, fontSize: 12, color: '#2e7d32' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontWeight: 600, color: '#555', fontSize: 14 },
  tabBtn: { padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  textarea: { padding: 12, borderRadius: 8, border: '1px solid #ddd', fontSize: 14, resize: 'vertical', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' },
  uploadArea: { display: 'flex', flexDirection: 'column', gap: 8 },
  dropZone: { border: '2px dashed #ccc', borderRadius: 8, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', background: '#fafafa' },
  uploadResult: { fontSize: 12, color: '#4CAF50', fontWeight: 600 },
  parseError: { fontSize: 12, color: '#f44336' },
};
