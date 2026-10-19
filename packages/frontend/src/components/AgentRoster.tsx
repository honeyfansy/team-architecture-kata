import React, { useState } from 'react';
import { useSessionStore } from '../store/useSessionStore.js';
import type { AgentStatusType, AgentRole } from '@team-architecture-kata/shared';

const STATUS_INDICATORS: Record<AgentStatusType, { icon: string; color: string }> = {
  idle: { icon: '○', color: '#bbb' }, thinking: { icon: '◌', color: '#FF9800' },
  speaking: { icon: '●', color: '#4CAF50' }, waiting: { icon: '◉', color: '#2196F3' },
  done: { icon: '✓', color: '#4CAF50' }, error: { icon: '✕', color: '#f44336' },
};

const STATUS_LABELS: Record<AgentStatusType, string> = {
  idle: '空闲', thinking: '思考中...', speaking: '发言中',
  waiting: '等待中', done: '已完成', error: '出错',
};

const ROLE_INFO: Record<string, { cn: string; desc: string }> = {
  facilitator: { cn: '主持人', desc: '引导流程、控制节奏、调解分歧' },
  domain_architect: { cn: '领域架构师', desc: '业务架构、模块边界、数据模型、存储策略' },
  system_architect: { cn: '系统架构师', desc: '系统分解、模式选型、模块协作、接口风格' },
  quality_analyst: { cn: '质量分析师', desc: '质量属性场景、度量指标、跨架构验证' },
  technology_architect: { cn: '技术架构师', desc: '技术栈选型、框架决定、横切关注点' },
  data_architect: { cn: '数据架构师', desc: '数据模型、数据流、一致性策略、存储选型' },
  infra_architect: { cn: '基础设施架构师', desc: '部署视图、网络拓扑、高可用方案' },
  risk_reviewer: { cn: '风险评审者', desc: '风险识别、Trade-off 分析、ADR 挑战' },
};

export function AgentRoster() {
  const agentStatuses = useSessionStore((s) => s.agentStatuses);
  const session = useSessionStore((s) => s.session);
  const agentTokenAccum = useSessionStore((s) => s.agentTokenAccum);
  const availableModels = useSessionStore((s) => s.availableModels);
  const [expanded, setExpanded] = useState(false);

  const displayStatuses = agentStatuses.length > 0 ? agentStatuses
    : (session?.config?.agents || []).map((a) => ({ role: a.role, label: a.label, color: a.color, model: a.model, status: 'idle' as AgentStatusType }));

  return (
    <div style={{ borderBottom: '1px solid #e0e0e0', background: '#fafafa' }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', padding: '6px 12px' }}>
        {displayStatuses.map((agent) => {
          const indicator = STATUS_INDICATORS[agent.status] || STATUS_INDICATORS.idle;
          const info = ROLE_INFO[agent.role] || { cn: agent.label, desc: '' };
          return (
            <div key={agent.role} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 12, background: 'white', fontSize: 11, cursor: 'pointer', borderLeft: `3px solid ${agent.color}`, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }} onClick={() => setExpanded(!expanded)} title={`${agent.label} — ${info.desc}\nModel: ${agent.model}`}>
              <span style={{ color: indicator.color, fontSize: 10 }}>{indicator.icon}</span>
              <span style={{ fontWeight: 600, fontSize: 11, color: '#333' }}>{info.cn}</span>
              <span style={{ fontSize: 9, color: '#999', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.model}</span>
              <span style={{ fontSize: 10, fontStyle: 'italic', color: indicator.color, marginLeft: 2 }}>{STATUS_LABELS[agent.status] || '空闲'}</span>
            </div>
          );
        })}
        <span style={{ fontSize: 10, color: '#999', fontFamily: 'monospace' }}>{displayStatuses.length} Agent</span>
      </div>
      {expanded && (
        <div style={{ padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #eee' }}>
          {displayStatuses.map((agent) => {
            const info = ROLE_INFO[agent.role] || { cn: agent.label, desc: '' };
            const stats = agentTokenAccum[agent.role];
            return (
              <div key={agent.role} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 12, color: agent.color }}>{info.cn} <span style={{ fontWeight: 400, color: '#999', fontSize: 11 }}>({agent.label})</span></span>
                <div style={{ paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 11, color: '#888' }}>{info.desc}</span>
                  <span style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 6 }}>
                    Model: <select value={agent.model} onChange={(e) => useSessionStore.getState().changeAgentModel(useSessionStore.getState().sessionId || '', agent.role, e.target.value)} style={{ fontSize: 11, padding: '1px 4px', borderRadius: 4, border: '1px solid #ddd', background: 'white', flex: 1 }}>{(availableModels.length > 0 ? availableModels : [agent.model]).map((m) => (<option key={m} value={m}>{m}</option>))}</select>
                  </span>
                  {stats && <span style={{ fontSize: 11, color: '#4CAF50', fontFamily: 'monospace' }}>发言 {stats.speakCount} 次 · Tokens ⬆{stats.input} ⬇{stats.output}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
