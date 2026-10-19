import React, { useMemo, useState, useEffect } from 'react';
import ReactFlow, { Background, Controls, MiniMap, type Node, type Edge as FlowEdge, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import type { AgentRole } from '@team-architecture-kata/shared';
import { useSessionStore } from '../store/useSessionStore.js';
import { CardNode } from './CardNode.js';

const nodeTypes = { cardNode: CardNode };

const PHASE_INFO: Record<string, { label: string; en: string; desc: string }> = {
  drivers: { label: '架构驱动识别', en: 'Drivers', desc: '识别质量属性和约束条件' },
  decomposition: { label: '系统分解', en: 'Decomposition', desc: '模块划分和层次结构' },
  patterns: { label: '架构模式选择', en: 'Patterns', desc: '模式选型与权衡' },
  views: { label: '多视图生成', en: 'Views', desc: '逻辑/过程/数据/部署视图' },
  adr: { label: '架构决策记录', en: 'ADR', desc: '记录关键架构决策' },
  review: { label: '架构风险评审', en: 'Review', desc: '风险识别与QA验证' },
  complete: { label: '已完成', en: 'Complete', desc: '架构设计完成！' },
};

const PHASES = ['drivers', 'decomposition', 'patterns', 'views', 'adr', 'review'];

export function ArchitectureKataCanvas() {
  const notes = useSessionStore((s) => s.notes);
  const edges = useSessionStore((s) => s.edges);
  const phase = useSessionStore((s) => s.phase);
  const status = useSessionStore((s) => s.status);
  const agentStatuses = useSessionStore((s) => s.agentStatuses);
  const session = useSessionStore((s) => s.session);
  const [thinkingStart, setThinkingStart] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());

  const FLOW_GAP = 1600;
  const getFlowYOffset = (flowId: string): number => { const idx = session?.config.flows.findIndex((f) => f.id === flowId) ?? -1; return idx < 0 ? 0 : idx * FLOW_GAP; };

  useEffect(() => {
    const thinkingRoles = agentStatuses.filter((a) => a.status === 'thinking').map((a) => a.role);
    setThinkingStart((prev) => {
      const next = { ...prev };
      for (const role of thinkingRoles) { if (!next[role]) next[role] = Date.now(); }
      for (const role of Object.keys(next) as AgentRole[]) { if (!thinkingRoles.includes(role)) delete next[role]; }
      return next;
    });
  }, [agentStatuses]);

  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(interval); }, []);

  const getThinkingTime = (role: string): string => {
    const start = thinkingStart[role]; if (!start) return '';
    const elapsed = Math.floor((now - start) / 1000); if (elapsed < 3) return '';
    if (elapsed < 60) return `${elapsed}秒`;
    return `${Math.floor(elapsed / 60)}分${elapsed % 60}秒`;
  };

  const { nodes, flowEdges } = useMemo(() => {
    const CARD_WIDTH = 180; const CARD_GAP_X = 24; const CARD_STEP_X = CARD_WIDTH + CARD_GAP_X;
    const TYPE_GAP_Y = 40; const CARD_HEADER_H = 20; const CARD_FOOTER_H = 22;
    const LINE_HEIGHT = 18; const CHARS_PER_LINE = 11;
    const estCardHeight = (content: string): number => { const lines = Math.max(1, Math.ceil(String(content).length / CHARS_PER_LINE)); return CARD_HEADER_H + CARD_FOOTER_H + lines * LINE_HEIGHT + 12; };
    const typeOrder = ['qa_scenario', 'constraint', 'module', 'pattern', 'view_element', 'adr', 'risk', 'note', 'question'];
    const groupedByType = new Map<string, typeof notes>();
    for (const note of notes) { const arr = groupedByType.get(note.type) || []; arr.push(note); groupedByType.set(note.type, arr); }
    const noteNodes: Node[] = []; let currentY = 60;
    for (const type of typeOrder) {
      const typeNotes = groupedByType.get(type); if (!typeNotes || typeNotes.length === 0) continue;
      const maxCol = Math.max(1, Math.floor(2500 / CARD_STEP_X));
      const rowsForType = Math.ceil(typeNotes.length / maxCol);
      let maxCardH = 0; typeNotes.forEach(n => { const h = estCardHeight(n.content); if (h > maxCardH) maxCardH = h; });
      const typeRowHeight = maxCardH + TYPE_GAP_Y;
      typeNotes.forEach((note, idx) => {
        const flowY = getFlowYOffset(note.flowId);
        const col = idx % maxCol; const row = Math.floor(idx / maxCol);
        const cardH = estCardHeight(note.content);
        noteNodes.push({ id: note.id, type: 'cardNode', position: { x: 40 + col * CARD_STEP_X, y: flowY + currentY + row * (cardH + 8) }, data: { label: note.content, noteType: note.type, author: note.author, phase: note.phase, status: note.status } });
      });
      currentY += typeRowHeight * rowsForType;
    }
    const flowEdges: FlowEdge[] = edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: 'smoothstep', animated: e.type === 'depends_on', label: edgeLabel(e.type), style: { stroke: '#999', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#999' }, labelStyle: { fontSize: 10, fill: '#666' } }));
    return { nodes: noteNodes, flowEdges };
  }, [notes, edges]);

  return (
    <div style={{ flex: 1, height: '100%', position: 'relative' }}>
      <div style={styles.topBar}>
        {session?.config.flows && session.config.flows.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {session.config.flows.map((f, i) => (
              <span key={f.id} style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', background: i === (session.currentFlowIndex) ? '#667eea' : '#e0e0e0', color: i === (session.currentFlowIndex) ? 'white' : '#666' }}>{f.name}</span>
            ))}
          </div>
        )}
        <div style={styles.phaseBadge}>
          <div style={styles.phaseLabel}>{PHASE_INFO[phase]?.label || phase}</div>
          <div style={styles.phaseEn}>{PHASE_INFO[phase]?.en || ''} — {PHASE_INFO[phase]?.desc || ''}</div>
        </div>
        {agentStatuses.filter((a) => a.status === 'thinking').map((a) => {
          const elapsed = getThinkingTime(a.role); const tooLong = (thinkingStart[a.role] && now - thinkingStart[a.role] > 60000);
          return (<span key={a.role} style={{ background: 'rgba(255,152,0,0.15)', color: '#E65100', padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 500 }}>◌ {a.label} 思考中{elapsed ? ` (${elapsed})` : ''}{tooLong ? ' ⚠️' : ''}</span>);
        })}
      </div>
      <ReactFlow nodes={nodes} edges={flowEdges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.2 }} style={{ background: '#FAFBFC' }} nodesDraggable={true} nodesConnectable={false}>
        <Background color="#eee" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap nodeStrokeWidth={3} nodeColor={(n) => { const type = (n.data as any)?.noteType; const colors: Record<string, string> = { qa_scenario: '#9C27B0', constraint: '#F44336', module: '#2196F3', pattern: '#4CAF50', view_element: '#FFC107', adr: '#E91E63', risk: '#FF9800' }; return colors[type] || '#ccc'; }} style={{ border: '1px solid #ddd' }} />
      </ReactFlow>
    </div>
  );
}

function edgeLabel(type: string): string {
  const labels: Record<string, string> = { depends_on: '→', triggers: 'triggers', refines: 'refines', conflicts_with: 'conflicts' };
  return labels[type] || type;
}

const styles: Record<string, React.CSSProperties> = {
  topBar: { position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10, display: 'flex', alignItems: 'flex-start', gap: 12 },
  phaseBadge: { background: 'rgba(255,255,255,0.95)', padding: '8px 16px', borderRadius: 12, fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  phaseLabel: { fontSize: 13, fontWeight: 500 },
  phaseEn: { fontSize: 11, color: '#888', marginTop: 2 },
};
