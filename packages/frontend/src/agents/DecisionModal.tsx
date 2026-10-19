import React, { useState } from 'react';
import { useSessionStore } from '../store/useSessionStore.js';
import type { DecisionRequest } from '@team-architecture-kata/shared';

interface Props {
  decision: DecisionRequest;
}

export function DecisionModal({ decision }: Props) {
  const sendDecision = useSessionStore((s) => s.sendDecision);
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const handleSelect = (optionId: string) => sendDecision(decision.id, optionId);
  const handleSkip = () => sendDecision(decision.id);
  const handleCustom = () => {
    if (customInput.trim()) sendDecision(decision.id, undefined, customInput.trim());
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <span style={styles.icon}>🤔</span>
          <div>
            <h3 style={styles.title}>需要你做出决策</h3>
            <p style={{ fontSize: 12, color: '#999', margin: 0 }}>会话正在等待你的输入来决定下一步方向</p>
          </div>
        </div>

        <p style={styles.description}>{decision.description}</p>

        {decision.context.length > 0 && (
          <div style={styles.context}>
            {decision.context.map((line, i) => (
              <div key={i} style={styles.contextLine}>{line}</div>
            ))}
          </div>
        )}

        {!customMode ? (
          <div style={styles.options}>
            {decision.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                style={styles.optionBtn}
              >
                <strong>{opt.label}</strong>
                {opt.description && (
                  <span style={styles.optionDesc}>{opt.description}</span>
                )}
              </button>
            ))}
            <button
              onClick={() => setCustomMode(true)}
              style={{ ...styles.optionBtn, ...styles.customBtn }}
            >
              ✏️ 自己输入...
            </button>
          </div>
        ) : (
          <div style={styles.customArea}>
            <textarea
              style={styles.customInput}
              placeholder="输入你的决策或指导意见..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              rows={3}
            />
            <div style={styles.customActions}>
              <button onClick={handleCustom} style={styles.confirmBtn}>确认</button>
              <button onClick={() => setCustomMode(false)} style={styles.backBtn}>返回</button>
            </div>
          </div>
        )}

        <div style={styles.footer}>
          <button onClick={handleSkip} style={styles.skipBtn}>
            ⏭ 跳过，让系统自行决策
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: 'white', borderRadius: 16, padding: 24, maxWidth: 480, width: '90%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
  },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  icon: { fontSize: 24 },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: '#333' },
  description: { fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 16 },
  context: {
    background: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 16,
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  contextLine: { fontSize: 13, color: '#555', lineHeight: 1.5 },
  options: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  optionBtn: {
    display: 'flex', flexDirection: 'column', gap: 4,
    padding: '12px 16px', borderRadius: 10,
    border: '2px solid #e0e0e0', background: 'white', cursor: 'pointer',
    textAlign: 'left', fontSize: 14,
    transition: 'border-color 0.15s',
  },
  optionDesc: { fontSize: 12, color: '#888', lineHeight: 1.4 },
  customBtn: { border: '2px dashed #ccc', alignItems: 'center', padding: 10 },
  customArea: { marginBottom: 16 },
  customInput: {
    width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd',
    fontSize: 14, resize: 'vertical', boxSizing: 'border-box',
  },
  customActions: { display: 'flex', gap: 8, marginTop: 8 },
  confirmBtn: {
    flex: 1, padding: '8px 16px', borderRadius: 8,
    border: 'none', background: '#667eea', color: 'white',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  backBtn: {
    padding: '8px 16px', borderRadius: 8,
    border: '1px solid #ddd', background: 'white', color: '#555',
    fontSize: 14, cursor: 'pointer',
  },
  footer: { display: 'flex', justifyContent: 'flex-end' },
  skipBtn: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: 'transparent', color: '#999', fontSize: 13,
    cursor: 'pointer', textDecoration: 'underline',
  },
};
