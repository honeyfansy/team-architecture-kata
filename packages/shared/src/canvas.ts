import type { StickyNoteType } from './sticky-note.js';

export type EdgeType = 'depends_on' | 'triggers' | 'refines' | 'conflicts_with';

export interface Edge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  phase: string;
  flowId: string;
}

export type CanvasChangeType =
  | 'note_added'
  | 'note_removed'
  | 'note_updated'
  | 'note_moved'
  | 'edge_added'
  | 'edge_removed'
  | 'phase_changed'
  | 'batch';

export interface CanvasChange {
  type: CanvasChangeType;
  note?: import('./sticky-note.js').StickyNote;
  noteId?: string;
  edge?: Edge;
  edges?: Edge[];
  notes?: import('./sticky-note.js').StickyNote[];
  noteType?: StickyNoteType;
  phase?: string;
  changes?: CanvasChange[];
  timestamp: number;
}

export interface CanvasState {
  sessionId: string;
  notes: import('./sticky-note.js').StickyNote[];
  edges: Edge[];
  phase: string;
}
