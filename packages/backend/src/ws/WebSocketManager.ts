import type { ServerMessage, ClientMessage, WSMessageType } from '@team-architecture-kata/shared';
import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';

type MessageHandler = (ws: WebSocket, payload: Record<string, unknown>) => void;

export class WebSocketManager {
  private wss: WebSocketServer;
  private sessions: Map<string, Set<WebSocket>> = new Map();
  private handlers: Map<WSMessageType, MessageHandler> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });
    this.wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        try {
          const msg: ClientMessage = JSON.parse(data.toString());
          const handler = this.handlers.get(msg.type);
          if (handler) handler(ws, msg.payload);
        } catch (err) {
          console.error('WS message error:', err);
        }
      });
      ws.on('close', () => {
        for (const [, sockets] of this.sessions) sockets.delete(ws);
      });
    });
  }

  on(type: WSMessageType, handler: MessageHandler) {
    this.handlers.set(type, handler);
  }

  subscribe(ws: WebSocket, sessionId: string) {
    let sockets = this.sessions.get(sessionId);
    if (!sockets) { sockets = new Set(); this.sessions.set(sessionId, sockets); }
    sockets.add(ws);
  }

  broadcast(sessionId: string, message: ServerMessage) {
    const sockets = this.sessions.get(sessionId);
    if (!sockets) return;
    const data = JSON.stringify(message);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    }
  }

  send(ws: WebSocket, message: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }
}
