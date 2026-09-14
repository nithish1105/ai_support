import { WSMessage } from '../types';

type MessageHandler = (message: WSMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private ticketId: number | null = null;
  private token: string | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnects = 8;
  private isConnected = false;
  private messageQueue: string[] = [];

  connect(ticketId: number, onStatusChange?: (status: 'connected' | 'disconnected' | 'reconnecting') => void) {
    this.ticketId = ticketId;
    this.token = localStorage.getItem('support_token');

    const host =
      typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? `${window.location.hostname}:8000`
        : window.location.host;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const tokenParam = this.token ? `?token=${encodeURIComponent(this.token)}` : '';
    const wsUrl = `${protocol}://${host}/ws/tickets/${ticketId}${tokenParam}`;

    try {
      if (this.ws) {
        try {
          this.ws.close();
        } catch {}
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        onStatusChange?.('connected');

        // Flush message queue
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          if (msg && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(msg);
          }
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handlers.forEach((handler) => handler(data));
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        onStatusChange?.('disconnected');
        this.attemptReconnect(ticketId, onStatusChange);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
    }
  }

  private attemptReconnect(
    ticketId: number,
    onStatusChange?: (status: 'connected' | 'disconnected' | 'reconnecting') => void
  ) {
    if (this.reconnectAttempts >= this.maxReconnects) return;

    this.reconnectAttempts++;
    onStatusChange?.('reconnecting');

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectTimer = setTimeout(() => {
      this.connect(ticketId, onStatusChange);
    }, delay);
  }

  send(message: WSMessage) {
    const raw = JSON.stringify(message);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(raw);
    } else {
      this.messageQueue.push(raw);
      if (this.ticketId) {
        this.connect(this.ticketId);
      }
    }
  }

  addHandler(handler: MessageHandler) {
    this.handlers.push(handler);
  }

  removeHandler(handler: MessageHandler) {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.handlers = [];
    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = this.maxReconnects;
  }

  get connected() {
    return this.isConnected;
  }
}

export const wsService = new WebSocketService();
export default wsService;
