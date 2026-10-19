import type { StickyNote, CanvasChange, Edge } from '@team-architecture-kata/shared';
import { randomUUID } from 'crypto';

export class CanvasManager {
  private notes: Map<string, StickyNote> = new Map();
  private edges: Map<string, Edge> = new Map();
  private changeListeners: Array<(change: CanvasChange) => void> = [];

  constructor(public readonly sessionId: string) {}

  onChange(cb: (change: CanvasChange) => void) { this.changeListeners.push(cb); }

  private emit(change: CanvasChange) { for (const cb of this.changeListeners) cb(change); }

  addNote(note: Omit<StickyNote, 'id' | 'createdAt' | 'updatedAt'>): StickyNote {
    const newNote: StickyNote = { ...note, id: randomUUID(), createdAt: Date.now(), updatedAt: Date.now() };
    this.notes.set(newNote.id, newNote);
    this.emit({ type: 'note_added', note: newNote, timestamp: Date.now() });
    return newNote;
  }

  addNotes(notes: Omit<StickyNote, 'id' | 'createdAt' | 'updatedAt'>[]): StickyNote[] {
    return notes.map((n) => this.addNote(n));
  }

  removeNote(id: string) { this.notes.delete(id); this.emit({ type: 'note_removed', noteId: id, timestamp: Date.now() }); }

  updateNote(id: string, updates: Partial<StickyNote>): StickyNote | undefined {
    const note = this.notes.get(id); if (!note) return undefined;
    const updated = { ...note, ...updates, updatedAt: Date.now() };
    this.notes.set(id, updated); this.emit({ type: 'note_updated', note: updated, timestamp: Date.now() });
    return updated;
  }

  moveNote(id: string, position: { x: number; y: number }) { return this.updateNote(id, { position }); }

  addEdge(edge: Omit<Edge, 'id'>): Edge {
    const newEdge: Edge = { ...edge, id: randomUUID() };
    this.edges.set(newEdge.id, newEdge);
    this.emit({ type: 'edge_added', edge: newEdge, timestamp: Date.now() });
    return newEdge;
  }

  removeEdge(id: string) { this.edges.delete(id); this.emit({ type: 'edge_removed', timestamp: Date.now() }); }
  getNotes(): StickyNote[] { return Array.from(this.notes.values()); }
  getEdges(): Edge[] { return Array.from(this.edges.values()); }

  getState() { return { sessionId: this.sessionId, notes: this.getNotes(), edges: this.getEdges() }; }

  getStateSummary(flowId?: string): string {
    const notes = flowId ? Array.from(this.notes.values()).filter((n) => n.flowId === flowId) : Array.from(this.notes.values());
    const edges = flowId ? Array.from(this.edges.values()).filter((e) => e.flowId === flowId) : Array.from(this.edges.values());
    const byType = new Map<string, StickyNote[]>();
    for (const note of notes) { const arr = byType.get(note.type) || []; arr.push(note); byType.set(note.type, arr); }
    const parts: string[] = [];
    for (const [type, ns] of byType) parts.push(`  ${type} (${ns.length}): ${ns.map((n) => n.content).join(', ')}`);
    const edgeList = edges.length > 0 ? `\nEdges:\n${edges.map((e) => `  ${e.source} -> ${e.target} [${e.type}]`).join('\n')}` : '';
    return `Notes:\n${parts.join('\n')}${edgeList}`;
  }

  getNotesByFlow(flowId: string): StickyNote[] { return Array.from(this.notes.values()).filter((n) => n.flowId === flowId); }
  getEdgesByFlow(flowId: string): Edge[] { return Array.from(this.edges.values()).filter((e) => e.flowId === flowId); }
}
