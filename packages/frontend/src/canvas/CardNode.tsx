import React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { STICKY_NOTE_COLORS, type StickyNoteType } from '@team-architecture-kata/shared';

interface CardNodeData { label: string; noteType: StickyNoteType; author: string; phase: string; status: string; }

export function CardNode({ data }: NodeProps<CardNodeData>) {
  const colors = STICKY_NOTE_COLORS[data.noteType] || STICKY_NOTE_COLORS.note;
  return (
    <div style={{ ...styles.node, background: colors.bg, borderColor: colors.border }}>
      <div style={{ ...styles.typeLabel, background: colors.border }}>{colors.label}</div>
      <div style={styles.content}>{data.label}</div>
      <div style={styles.footer}><span style={styles.author}>@{data.author}</span></div>
      <Handle type="target" position={Position.Left} style={styles.handle} />
      <Handle type="source" position={Position.Right} style={styles.handle} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  node: { width: 180, minHeight: 64, borderRadius: 8, border: '2px solid', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', cursor: 'pointer', transition: 'box-shadow 0.2s' },
  typeLabel: { fontSize: 10, fontWeight: 600, color: 'white', padding: '2px 8px', textTransform: 'uppercase', letterSpacing: 0.5, borderRadius: '6px 6px 0 0' },
  content: { padding: '8px 10px', fontSize: 13, fontWeight: 500, color: '#333', lineHeight: 1.4, flex: 1, wordBreak: 'break-word' },
  footer: { padding: '2px 8px 4px', fontSize: 10, color: '#999' },
  author: { fontStyle: 'italic' },
  handle: { width: 8, height: 8, background: '#999', border: '2px solid white', borderRadius: '50%' },
};
