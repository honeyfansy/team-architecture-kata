import React, { useEffect, useRef } from 'react';
import { useSessionStore } from '../store/useSessionStore.js';
import { AgentRoster } from '../components/AgentRoster.js';
import type { AgentMessage, DecisionRequest } from '@team-architecture-kata/shared';

const ROLE_COLORS: Record<string, string> = {
  facilitator: '#6b7280', domain_architect: '#3b82f6', system_architect: '#22c55e',
  quality_analyst: '#a855f7', technology_architect: '#6366f1', data_architect: '#14b8a6',
  infra_architect: '#f97316', risk_reviewer: '#f43f5e',
};

const ROLE_LABELS: Record<string, string> = {
  facilitator: '主持人', domain_architect: '领域架构师', system_architect: '系统架构师',
  quality_analyst: '质量分析师', technology_architect: '技术架构师', data_architect: '数据架构师',
  infra_architect: '基础设施架构师', risk_reviewer: '风险评审者',
};

const TYPE_ICONS: Record<string, string> = { thought: '💭', question: '❓', decision: '✅', action: '⚡', chat: '💬' };

export function AgentPanel() {
  const messages = useSessionStore((s) => s.messages);
  const phase = useSessionStore((s) => s.phase);
  const status = useSessionStore((s) => s.status);
  const sendInput = useSessionStore((s) => s.sendInput);
  const pendingDecision = useSessionStore((s) => s.pendingDecision);
  const sendDecision = useSessionStore((s) => s.sendDecision);
  const sendControl = useSessionStore((s) => s.sendControl);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = React.useState('');

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    if (pendingDecision) {
      sendDecision(pendingDecision.id, undefined, input.trim());
    } else {
      sendInput(input.trim());
    }
    setInput('');
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h3 style={styles.headerTitle}>讨论</h3>
        <span style={{ ...styles.statusDot, background: status === 'running' ? '#4CAF50' : status === 'waiting_input' ? '#FF9800' : '#999' }} />
        <span style={styles.statusText}>{status}</span>
      </div>
      <AgentRoster />

      {/* Communication controls */}
      <div style={styles.controlBar}>
        <div style={{ display: 'flex', gap: 6 }}>
          {status === 'waiting_input' && <span style={styles.waitingBadge}>⏳ 等待你的输入</span>}
          {status === 'running' ? (
            <button onClick={() => sendControl('pause')} style={styles.ctrlBtn}>⏸ 暂停</button>
          ) : status === 'paused' ? (
            <button onClick={() => sendControl('resume')} style={styles.ctrlBtn}>▶ 继续</button>
          ) : status === 'complete' ? (
            <span style={{ fontSize: 11, color: '#4CAF50', fontWeight: 600 }}>✅ 已完成</span>
          ) : null}
        </div>
        <div style={{ flex: 1 }} />
      </div>

      <div style={styles.messages}>
        {messages.length === 0 && <div style={styles.empty}>等待 Agent 开始讨论...</div>}
        {messages.map((msg) => (
          <div key={msg.id} style={{ ...styles.message, borderLeftColor: ROLE_COLORS[msg.from] || '#999', background: msg.type === 'chat' ? '#f0f4ff' : 'white' }}>
            <div style={styles.msgHeader}>
              <span style={styles.typeIcon}>{TYPE_ICONS[msg.type] || '💭'}</span>
              <span style={{ ...styles.roleLabel, color: ROLE_COLORS[msg.from] || '#999' }}>{ROLE_LABELS[msg.from] || msg.from}</span>
              <span style={styles.msgTime}>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              {(msg.inputTokens || msg.outputTokens) ? <span style={styles.msgTokens}>⬆{msg.inputTokens} ⬇{msg.outputTokens}</span> : null}
            </div>
            <div style={styles.msgContent}>{msg.content}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {status === 'waiting_input' ? (
        <div>
          {pendingDecision && pendingDecision.options.length > 0 && (
            <div style={styles.decisionOptions}>
              <div style={styles.decisionPrompt}>{pendingDecision.description}</div>
              <div style={styles.optionRow}>
                {pendingDecision.options.map((opt) => (
                  <button key={opt.id} onClick={() => sendDecision(pendingDecision.id, opt.id)} style={styles.optionBtn}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={styles.inputArea}>
            <input style={styles.input} placeholder={pendingDecision ? '或输入自定义内容...' : '输入你的回应...'} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} autoFocus />
            <button onClick={handleSend} style={styles.sendBtn}>发送</button>
          </div>
        </div>
      ) : status === 'running' ? (
        <div style={styles.runningBanner}><span style={styles.runningDot} /> Agent 正在自动讨论中...</div>
      ) : (<div style={styles.runningBanner}>{status === 'paused' ? '⏸ 已暂停' : status === 'complete' ? '✅ 已完成' : `状态: ${status}`}</div>)}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  controlBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 10px', borderBottom: '1px solid #e0e0e0',
    background: '#f8f9fa', flexShrink: 0,
  },
  ctrlBtn: {
    padding: '3px 10px', borderRadius: 5, border: '1px solid #ccc',
    cursor: 'pointer', background: 'white', fontSize: 11, fontWeight: 600, color: '#555',
  },
  waitingBadge: {
    fontSize: 11, fontWeight: 600, color: '#E65100',
    padding: '3px 8px', borderRadius: 4, background: 'rgba(255,152,0,0.15)',
  },
  panel: { width: 360, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e0e0e0', background: '#fafafa', flexShrink: 0 },
  header: { padding: '12px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 8, background: 'white' },
  headerTitle: { fontSize: 15, fontWeight: 600, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: '50%' },
  statusText: { fontSize: 12, color: '#666' },
  messages: { flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  empty: { color: '#999', fontSize: 13, textAlign: 'center', padding: 40, fontStyle: 'italic' },
  message: { padding: '8px 12px', borderRadius: 8, borderLeft: '3px solid', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
  msgHeader: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  typeIcon: { fontSize: 12 },
  roleLabel: { fontSize: 12, fontWeight: 600 },
  msgTime: { fontSize: 10, color: '#bbb' },
  msgTokens: { fontSize: 9, color: '#4CAF50', marginLeft: 6, fontFamily: 'monospace' },
  msgContent: { fontSize: 13, color: '#444', lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  inputArea: { padding: 10, borderTop: '1px solid #e0e0e0', display: 'flex', gap: 8, background: 'white' },
  input: { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, outline: 'none' },
  decisionOptions: {
    padding: '8px 12px', background: '#fff8e1', borderTop: '2px solid #FFB300',
  },
  decisionPrompt: {
    fontSize: 12, color: '#795548', lineHeight: 1.5, marginBottom: 8,
  },
  optionRow: {
    display: 'flex', flexWrap: 'wrap', gap: 6,
  },
  optionBtn: {
    padding: '6px 14px', borderRadius: 16, border: '1px solid #FFB300',
    background: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600,
    color: '#E65100', whiteSpace: 'nowrap',
  },
  sendBtn: { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#667eea', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  runningBanner: { padding: '12px 16px', borderTop: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#f5f5f5', fontSize: 13, color: '#666' },
  runningDot: {
    width: 8, height: 8, borderRadius: '50%',
    background: '#4CAF50',
    animation: 'pulse 1.5s ease-in-out infinite',
    display: 'inline-block',
  },
};
