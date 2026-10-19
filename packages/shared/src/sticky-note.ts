export type StickyNoteType =
  | 'qa_scenario'
  | 'constraint'
  | 'module'
  | 'pattern'
  | 'view_element'
  | 'adr'
  | 'risk'
  | 'note'
  | 'question';

export type StickyNoteStatus = 'active' | 'draft' | 'archived' | 'disputed';

export interface StickyNote {
  id: string;
  type: StickyNoteType;
  content: string;
  position: { x: number; y: number };
  author: string;
  status: StickyNoteStatus;
  phase: string;
  flowId: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, string>;
}

export const STICKY_NOTE_COLORS: Record<StickyNoteType, { bg: string; border: string; label: string }> = {
  qa_scenario:  { bg: '#F3E5F5', border: '#9C27B0', label: 'QA Scenario' },
  constraint:   { bg: '#FFEBEE', border: '#F44336', label: 'Constraint' },
  module:       { bg: '#E3F2FD', border: '#2196F3', label: 'Module' },
  pattern:      { bg: '#E8F5E9', border: '#4CAF50', label: 'Pattern' },
  view_element: { bg: '#FFFDE7', border: '#FFC107', label: 'View Element' },
  adr:          { bg: '#FCE4EC', border: '#E91E63', label: 'ADR' },
  risk:         { bg: '#FFF3E0', border: '#FF9800', label: 'Risk' },
  note:         { bg: '#ECEFF1', border: '#607D8B', label: 'Note' },
  question:     { bg: '#E0F7FA', border: '#00BCD4', label: 'Question' },
};
