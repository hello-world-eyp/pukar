import { ClientMessage, ServerMessage } from '../../server/types';
import { ConnectionStatus } from './types';

export type MessageHandler = (message: ServerMessage) => void;
export type StatusHandler = (status: ConnectionStatus) => void;

export interface SocketClientOptions {
  url?: string;
  WebSocketClass?: any;
  pingIntervalMs?: number;
}

const WS_OPEN_STATE = 1;

/**
 * Resolves the default WebSocket endpoint based on environment.
 * Prioritizes VITE_WS_URL if set.
 * In dev (e.g. Vite on any port 517x, 4173, or 3000), targets port 3001.
 * In prod, uses the same host and wss/ws protocol.
 */
export function resolveDefaultSocketUrl(): string {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL) {
      // @ts-ignore
      const envUrl = import.meta.env.VITE_WS_URL;
      if (typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim();
    }
  } catch {
    // Ignore import.meta check error
  }

  try {
    if (typeof process !== 'undefined' && process.env?.VITE_WS_URL) {
      const envUrl = process.env.VITE_WS_URL;
      if (typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim();
    }
  } catch {
    // Ignore process.env check error
  }

  try {
    if (typeof window !== 'undefined' && window.location) {
      const loc = window.location;
      const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      const isViteDevPort =
        /^51[7-9]\d$/.test(loc.port) ||
        /^517\d+$/.test(loc.port) ||
        loc.port === '5173' ||
        loc.port === '4173' ||
        loc.port === '3000';
      const isDev =
        isViteDevPort ||
        (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');

      const host = isDev ? `${loc.hostname || 'localhost'}:3001` : (loc.host || 'localhost:3001');
      return `${protocol}//${host}`;
    }
  } catch {
    // Fallback if window access fails
  }
  return 'ws://localhost:3001';
}

/**
 * Robust WebSocket client with auto-reconnect backoff, an outbox queue,
 * periodic PING keepalive, safe frame parsing, and lifecycle subscriptions.
 */
export class SocketClient {
  private ws: any = null;
  private readonly url: string;
  private readonly wsFactory: (targetUrl: string) => any;
  private readonly pingIntervalMs: number;
  private pingTimer: any = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private outboxQueue: ClientMessage[] = [];
  private isManuallyClosed = false;
  private currentStatus: ConnectionStatus = 'DISCONNECTED';

  constructor(urlOrOptions?: string | SocketClientOptions) {
    let resolvedUrl: string | undefined;
    let customWsClass: any;
    let customPingInterval: number | undefined;

    if (typeof urlOrOptions === 'string') {
      resolvedUrl = urlOrOptions;
    } else if (urlOrOptions && typeof urlOrOptions === 'object') {
      resolvedUrl = urlOrOptions.url;
      customWsClass = urlOrOptions.WebSocketClass;
      customPingInterval = urlOrOptions.pingIntervalMs;
    }

    this.url = resolvedUrl || resolveDefaultSocketUrl();
    this.pingIntervalMs = typeof customPingInterval === 'number' ? customPingInterval : 25000;

    this.wsFactory = (targetUrl: string) => {
      const WS =
        customWsClass ||
        (typeof WebSocket !== 'undefined' ? WebSocket : (globalThis as any).WebSocket);
      if (!WS) {
        throw new Error('[SocketClient] No WebSocket implementation available in this environment');
      }
      return new WS(targetUrl);
    };
  }


  /**
   * Returns current connection status.
   */
  public getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  /**
   * Returns configured socket URL.
   */
  public getUrl(): string {
    return this.url;
  }

  /**
   * Returns true if socket is actively connected and OPEN.
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WS_OPEN_STATE;
  }

  /**
   * Returns shallow copy of queued messages for testing/diagnostics.
   */
  public getOutboxQueue(): readonly ClientMessage[] {
    return [...this.outboxQueue];
  }

  /**
   * Returns number of queued messages waiting for socket OPEN.
   */
  public getOutboxCount(): number {
    return this.outboxQueue.length;
  }

  /**
   * Clears outbox queue (e.g. on voluntary room exit).
   */
  public clearOutbox(): void {
    this.outboxQueue = [];
  }

  /**
   * Connects to the WebSocket server.
   * If already open or connecting, does not tear down socket unless force is true.
   * Cancels any pending reconnection timer.
   */
  public connect(force = false): void {
    this.isManuallyClosed = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!force && this.ws && (this.ws.readyState === WS_OPEN_STATE || this.ws.readyState === 0)) {
      return;
    }

    this.cleanupSocket();

    const statusToNotify: ConnectionStatus =
      this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING';
    this.notifyStatus(statusToNotify);

    try {
      this.ws = this.wsFactory(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.notifyStatus('CONNECTED');
        this.startPingTimer();
        this.flushQueue();
      };

      this.ws.onmessage = (event: any) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : event.data?.toString();
          if (!raw) return;
          const msg = JSON.parse(raw) as ServerMessage;
          this.messageHandlers.forEach((handler) => {
            try {
              handler(msg);
            } catch (handlerErr) {
              console.error('[SocketClient] Handler execution error:', handlerErr);
            }
          });
        } catch (err) {
          console.error('[SocketClient] Bad message payload:', err);
        }
      };

      this.ws.onclose = () => {
        this.stopPingTimer();
        this.notifyStatus('DISCONNECTED');
        if (!this.isManuallyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err: any) => {
        console.warn('[SocketClient] Socket error:', err);
      };
    } catch (err) {
      console.error('[SocketClient] Connection failure:', err);
      this.notifyStatus('DISCONNECTED');
      if (!this.isManuallyClosed) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Schedules reconnection using exponential backoff:
   * 1s, 2s, 4s, 8s, capped at 10s.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.isManuallyClosed) {
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    this.notifyStatus('RECONNECTING');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isManuallyClosed) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Sends a message to the server, or queues it if the socket is not yet OPEN.
   */
  public send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WS_OPEN_STATE) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (err) {
        console.error('[SocketClient] Failed to send frame, queueing:', err);
        this.outboxQueue.push(msg);
      }
    } else {
      this.outboxQueue.push(msg);
    }
  }

  /**
   * Flushes queued messages sequentially once socket is OPEN.
   */
  private flushQueue(): void {
    while (this.outboxQueue.length > 0 && this.ws && this.ws.readyState === WS_OPEN_STATE) {
      const msg = this.outboxQueue.shift();
      if (msg) {
        try {
          this.ws.send(JSON.stringify(msg));
        } catch (err) {
          console.error('[SocketClient] Error flushing queued message:', err);
          this.outboxQueue.unshift(msg);
          break;
        }
      }
    }
  }

  /**
   * Registers a callback for incoming parsed ServerMessages.
   * Returns an unsubscribe function.
   */
  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Registers a callback for ConnectionStatus transitions.
   * Returns an unsubscribe function.
   */
  public onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    // Immediately notify current status upon subscription
    try {
      handler(this.currentStatus);
    } catch (err) {
      console.error('[SocketClient] Status listener error on subscription:', err);
    }
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  /**
   * Notifies all registered status listeners of a transition.
   */
  private notifyStatus(status: ConnectionStatus): void {
    this.currentStatus = status;
    this.statusHandlers.forEach((h) => {
      try {
        h(status);
      } catch (err) {
        console.error('[SocketClient] Status listener error:', err);
      }
    });
  }

  /**
   * Starts periodic application-level PING keepalive.
   */
  private startPingTimer(): void {
    this.stopPingTimer();
    if (this.pingIntervalMs <= 0) return;

    this.pingTimer = setInterval(() => {
      if (this.isConnected()) {
        try {
          this.ws.send(JSON.stringify({ type: 'PING' }));
        } catch (err) {
          console.warn('[SocketClient] Failed to send PING keepalive:', err);
        }
      }
    }, this.pingIntervalMs);

    this.pingTimer.unref?.();
  }

  /**
   * Cancels periodic application-level PING keepalive timer.
   */
  private stopPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Explicitly closes the socket and cancels any ongoing reconnect loop.
   */
  public close(): void {
    this.isManuallyClosed = true;
    this.stopPingTimer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupSocket();
    this.notifyStatus('DISCONNECTED');
  }

  /**
   * Safely disengages event listeners and closes underlying socket.
   */
  private cleanupSocket(): void {
    this.stopPingTimer();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = () => {};
      try {
        this.ws.close();
      } catch {
        // Ignore close error on stale socket
      }
      this.ws = null;
    }
  }
}

