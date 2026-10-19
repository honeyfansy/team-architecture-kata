import React from 'react';
import { useSessionStore } from '../store/useSessionStore.js';

export function StatusBar() {
  const sessionId = useSessionStore((s) => s.sessionId);
  const session = useSessionStore((s) => s.session);
  const notes = useSessionStore((s) => s.notes);
  const edges = useSessionStore((s) => s.edges);
  const messages = useSessionStore((s) => s.messages);
  const tokenTotals = useSessionStore((s) => s.tokenTotals);
  const connected = useSessionStore((s) => s.connected);

  return (
    <div style={styles.bar}>
      <div style={styles.left}>
        <span style={{ ...styles.dot, background: connected ? '#4CAF50' : '#f44336' }} />
        <span style={styles.item}>会话: {sessionId?.slice(0, 8)}...</span>
        {session?.config.flows && session.config.flows.length > 1 && (
          <span style={styles.item}>
            流程: {session.currentFlowIndex + 1}/{session.config.flows.length}
          </span>
        )}
        <span style={styles.item}>便签: {notes.length}</span>
        <span style={styles.item}>连线: {edges.length}</span>
        <span style={styles.item}>消息: {messages.length}</span>
        {tokenTotals.input + tokenTotals.output > 0 && (
          <span style={styles.item}>Tokens: ⬆{tokenTotals.input} ⬇{tokenTotals.output}</span>
        )}
      </div>
      <div>
        <button onClick={() => { sessionStorage.removeItem('team-architecture-kata-session'); location.reload(); }}
          style={{ padding: '4px 12px', borderRadius: 5, border: '1px solid #555',
            cursor: 'pointer', background: '#333', color: '#ccc', fontSize: 11, fontWeight: 600 }}>
          新会话
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 40, flexShrink: 0, zIndex: 10,
    background: '#1a1a2e', color: '#ccc',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 16px', fontSize: 12, fontFamily: 'monospace',
  },
  left: { display: 'flex', alignItems: 'center', gap: 16 },
  dot: { width: 6, height: 6, borderRadius: '50%' },
  item: { color: '#aaa' },
};
