import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { WebSocket as NodeWebSocket } from 'ws';
import {
  saveSessionCredentials,
  getSessionCredentials,
  clearSessionCredentials,
  resetMemoryFallback,
} from '../../src/network/session-storage';
import {
  SocketClient,
  resolveDefaultSocketUrl,
} from '../../src/network/socket-client';
import { useMultiplayerGame } from '../../src/network/useMultiplayerGame';
import { startServer } from '../../server/server';
import { ServerMessage, ClientMessage, LobbySeat } from '../../server/types';
import { SanitizedGameState } from '../../src/engine/types';

/* ========================================================================
 * Minimal DOM Environment Setup for React 19 Hook Testing in Node
 * ======================================================================== */

class ElementMock {}
class HTMLElementMock extends ElementMock {}
class HTMLIFrameElementMock extends HTMLElementMock {}

if (typeof (globalThis as any).navigator === 'undefined') {
  (globalThis as any).navigator = { userAgent: 'node' };
}
if (typeof (globalThis as any).Element === 'undefined') {
  (globalThis as any).Element = ElementMock;
}
if (typeof (globalThis as any).HTMLElement === 'undefined') {
  (globalThis as any).HTMLElement = HTMLElementMock;
}
if (typeof (globalThis as any).HTMLIFrameElement === 'undefined') {
  (globalThis as any).HTMLIFrameElement = HTMLIFrameElementMock;
}

function createMockElement(tag = 'div') {
  const el = Object.create(HTMLElementMock.prototype);
  Object.assign(el, {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    nodeName: tag.toUpperCase(),
    childNodes: [] as any[],
    children: [] as any[],
    style: {},
    attributes: {} as Record<string, string>,
    ownerDocument: null as any,
    setAttribute(k: string, v: string) {
      this.attributes[k] = v;
    },
    removeAttribute(k: string) {
      delete this.attributes[k];
    },
    getAttribute(k: string) {
      return this.attributes[k];
    },
    appendChild(child: any) {
      this.childNodes.push(child);
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(child: any) {
      const idx = this.childNodes.indexOf(child);
      if (idx !== -1) this.childNodes.splice(idx, 1);
      const cIdx = this.children.indexOf(child);
      if (cIdx !== -1) this.children.splice(cIdx, 1);
      child.parentNode = null;
      return child;
    },
    insertBefore(newChild: any, refChild: any) {
      const idx = this.childNodes.indexOf(refChild);
      if (idx !== -1) {
        this.childNodes.splice(idx, 0, newChild);
        this.children.splice(idx, 0, newChild);
      } else {
        this.childNodes.push(newChild);
        this.children.push(newChild);
      }
      newChild.parentNode = this;
      return newChild;
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  });
  return el;
}

const mockDoc: any = {
  nodeType: 9,
  createElement: createMockElement,
  createTextNode: (text: string) => ({ nodeType: 3, nodeValue: text, textContent: text }),
  createComment: (data: string) => ({ nodeType: 8, data }),
  defaultView: globalThis,
  activeElement: null,
  addEventListener() {},
  removeEventListener() {},
};
mockDoc.ownerDocument = mockDoc;

if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = mockDoc;
}
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function renderHook<T>(hookFn: () => T) {
  const container = createMockElement('div');
  container.ownerDocument = mockDoc;
  const root = createRoot(container as any);
  const result = { current: null as unknown as T };

  function Harness() {
    result.current = hookFn();
    return null;
  }

  act(() => {
    root.render(React.createElement(Harness));
  });

  return {
    result,
    rerender() {
      act(() => {
        root.render(React.createElement(Harness));
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
    },
  };
}

/* ========================================================================
 * Mock WebSocket Implementation for Deterministic Unit Testing
 * ======================================================================== */

class MockWebSocket {
  public static instances: MockWebSocket[] = [];
  public readyState = 0; // 0 = CONNECTING
  public url: string;
  public sentMessages: string[] = [];
  public onopen: (() => void) | null = null;
  public onmessage: ((event: { data: any }) => void) | null = null;
  public onclose: ((event?: any) => void) | null = null;
  public onerror: ((error: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  public send(data: string) {
    if (this.readyState !== 1) {
      throw new Error('WebSocket is not open: readyState ' + this.readyState);
    }
    this.sentMessages.push(data);
  }

  public close() {
    this.readyState = 3;
    if (this.onclose) {
      this.onclose({ code: 1000, reason: 'Normal Closure' });
    }
  }

  public triggerOpen() {
    this.readyState = 1;
    if (this.onopen) this.onopen();
  }

  public triggerMessage(data: any) {
    if (this.onmessage) this.onmessage({ data });
  }

  public triggerClose(code = 1006, reason = 'Abnormal Closure') {
    this.readyState = 3;
    if (this.onclose) this.onclose({ code, reason });
  }

  public triggerError(err: any) {
    if (this.onerror) this.onerror(err);
  }
}

/* ========================================================================
 * Test Suite 1: Multiplayer Session Storage
 * ======================================================================== */

describe('Multiplayer Session Storage', () => {
  beforeEach(() => {
    resetMemoryFallback();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves and retrieves valid room session credentials', () => {
    saveSessionCredentials({
      roomCode: 'WILD',
      playerId: 'p_123',
      sessionToken: 'tok_abc',
      seatIndex: 1,
    });

    const creds = getSessionCredentials();
    expect(creds).not.toBeNull();
    expect(creds?.roomCode).toBe('WILD');
    expect(creds?.playerId).toBe('p_123');
    expect(creds?.sessionToken).toBe('tok_abc');
    expect(creds?.seatIndex).toBe(1);
  });

  it('handles null seatIndex for spectators or unseated participants', () => {
    saveSessionCredentials({
      roomCode: 'CARD',
      playerId: 'p_999',
      sessionToken: 'tok_xyz',
      seatIndex: null,
    });

    const creds = getSessionCredentials();
    expect(creds).not.toBeNull();
    expect(creds?.seatIndex).toBeNull();
  });

  it('returns null when no session is stored', () => {
    expect(getSessionCredentials()).toBeNull();
  });

  it('returns null and warns when stored data is corrupted JSON', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('pukar_multiplayer_session', '{corrupted-json...');
    }
    expect(getSessionCredentials()).toBeNull();
    warnSpy.mockRestore();
  });

  it('returns null when stored payload lacks required credential fields', () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('pukar_multiplayer_session', JSON.stringify({ roomCode: 'ABCD' }));
    }
    expect(getSessionCredentials()).toBeNull();
  });

  it('clears session credentials upon voluntary exit', () => {
    saveSessionCredentials({
      roomCode: 'WILD',
      playerId: 'p_123',
      sessionToken: 'tok_abc',
      seatIndex: 1,
    });

    clearSessionCredentials();
    expect(getSessionCredentials()).toBeNull();
  });

  it('recovers defensively when sessionStorage.setItem throws QuotaExceededError', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    if (typeof sessionStorage !== 'undefined') {
      vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError: Storage quota exceeded');
      });
    }

    expect(() => {
      saveSessionCredentials({
        roomCode: 'SAFE',
        playerId: 'p_safe',
        sessionToken: 'tok_safe',
        seatIndex: 0,
      });
    }).not.toThrow();

    // Memory fallback captures it even when sessionStorage throws
    const creds = getSessionCredentials();
    expect(creds?.roomCode).toBe('SAFE');
    warnSpy.mockRestore();
  });

  it('recovers defensively when sessionStorage.getItem throws SecurityError', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    if (typeof sessionStorage !== 'undefined') {
      vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError: Access is denied');
      });
    }

    expect(() => getSessionCredentials()).not.toThrow();
    expect(getSessionCredentials()).toBeNull();
    warnSpy.mockRestore();
  });

  it('recovers defensively when sessionStorage.removeItem throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    if (typeof sessionStorage !== 'undefined') {
      vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
        throw new Error('Storage access blocked');
      });
    }

    expect(() => clearSessionCredentials()).not.toThrow();
    warnSpy.mockRestore();
  });

  it('ignores invalid or incomplete credential objects defensively', () => {
    saveSessionCredentials({} as any);
    expect(getSessionCredentials()).toBeNull();

    saveSessionCredentials({
      roomCode: '   ',
      playerId: 'p1',
      sessionToken: 'tok1',
      seatIndex: 0,
    } as any);
    expect(getSessionCredentials()).toBeNull();

    saveSessionCredentials({
      roomCode: 'VALID',
      playerId: '',
      sessionToken: 'tok1',
      seatIndex: 0,
    } as any);
    expect(getSessionCredentials()).toBeNull();
  });
});

/* ========================================================================
 * Test Suite 2: SocketClient
 * ======================================================================== */

describe('SocketClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('URL Auto-Resolution', () => {
    it('uses custom URL passed to constructor', () => {
      const client = new SocketClient('ws://my-custom-host:8080');
      expect(client.getUrl()).toBe('ws://my-custom-host:8080');
    });

    it('resolves port 3001 in dev when window.location.port is 5173', () => {
      const originalLoc = window.location;
      delete (window as any).location;
      (window as any).location = {
        protocol: 'http:',
        hostname: '192.168.1.10',
        port: '5173',
        host: '192.168.1.10:5173',
      };

      const resolved = resolveDefaultSocketUrl();
      expect(resolved).toBe('ws://192.168.1.10:3001');

      (window as any).location = originalLoc;
    });

    it('resolves secure wss:// and preserves host in production', () => {
      const originalLoc = window.location;
      delete (window as any).location;
      (window as any).location = {
        protocol: 'https:',
        hostname: 'pukar.game',
        port: '',
        host: 'pukar.game',
      };

      const resolved = resolveDefaultSocketUrl();
      expect(resolved).toBe('wss://pukar.game');

      (window as any).location = originalLoc;
    });
  });

  describe('Connection Lifecycle & Status Transitions', () => {
    it('notifies status subscribers through CONNECTING -> CONNECTED -> DISCONNECTED lifecycle', () => {
      const client = new SocketClient({
        url: 'ws://127.0.0.1:3001',
        WebSocketClass: MockWebSocket,
      });

      const statuses: string[] = [];
      const unsub = client.onStatus((status) => statuses.push(status));

      expect(statuses).toEqual(['DISCONNECTED']); // Immediate status upon subscribe

      client.connect();
      expect(statuses).toEqual(['DISCONNECTED', 'CONNECTING']);

      const mockWs = MockWebSocket.instances[0];
      mockWs.triggerOpen();
      expect(statuses).toEqual(['DISCONNECTED', 'CONNECTING', 'CONNECTED']);
      expect(client.isConnected()).toBe(true);

      client.close();
      expect(statuses).toEqual(['DISCONNECTED', 'CONNECTING', 'CONNECTED', 'DISCONNECTED']);
      expect(client.isConnected()).toBe(false);

      unsub();
    });

    it('unsubscribes status listener cleanly', () => {
      const client = new SocketClient({ WebSocketClass: MockWebSocket });
      const statuses: string[] = [];
      const unsub = client.onStatus((s) => statuses.push(s));
      unsub();

      client.connect();
      expect(statuses).toEqual(['DISCONNECTED']);
    });
  });

  describe('Message Delivery & Handlers', () => {
    it('dispatches parsed ServerMessages to registered listeners', () => {
      const client = new SocketClient({ WebSocketClass: MockWebSocket });
      client.connect();
      const mockWs = MockWebSocket.instances[0];
      mockWs.triggerOpen();

      const received: ServerMessage[] = [];
      client.onMessage((msg) => received.push(msg));

      const payload: ServerMessage = {
        type: 'ROOM_JOINED',
        roomCode: 'ABCD',
        playerId: 'p1',
        sessionToken: 'tok1',
        isHost: true,
        seatIndex: 0,
      };

      mockWs.triggerMessage(JSON.stringify(payload));
      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(payload);
    });

    it('supports multiple handlers and cleanly unregisters one without affecting others', () => {
      const client = new SocketClient({ WebSocketClass: MockWebSocket });
      client.connect();
      const mockWs = MockWebSocket.instances[0];
      mockWs.triggerOpen();

      const list1: any[] = [];
      const list2: any[] = [];
      const unsub1 = client.onMessage((m) => list1.push(m));
      client.onMessage((m) => list2.push(m));

      mockWs.triggerMessage(JSON.stringify({ type: 'ERROR', message: 'Err1', code: 'E1' }));
      expect(list1).toHaveLength(1);
      expect(list2).toHaveLength(1);

      unsub1();
      mockWs.triggerMessage(JSON.stringify({ type: 'ERROR', message: 'Err2', code: 'E2' }));
      expect(list1).toHaveLength(1);
      expect(list2).toHaveLength(2);
    });

    it('isolates handler exceptions so one faulty handler cannot break others', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const client = new SocketClient({ WebSocketClass: MockWebSocket });
      client.connect();
      const mockWs = MockWebSocket.instances[0];
      mockWs.triggerOpen();

      const received: any[] = [];
      client.onMessage(() => {
        throw new Error('Exploding handler');
      });
      client.onMessage((m) => received.push(m));

      expect(() => {
        mockWs.triggerMessage(JSON.stringify({ type: 'ERROR', message: 'Safe', code: 'OK' }));
      }).not.toThrow();

      expect(received).toHaveLength(1);
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });

  describe('Outbox Queue & Flushing', () => {
    it('queues messages when disconnected and flushes sequentially upon socket OPEN', () => {
      const client = new SocketClient({ WebSocketClass: MockWebSocket });

      // Send before connect
      const msg1: ClientMessage = { type: 'CREATE_ROOM', playerName: 'Alice', playerCount: 4 };
      const msg2: ClientMessage = { type: 'SELECT_SEAT', seatIndex: 0 };
      client.send(msg1);
      client.send(msg2);

      expect(client.getOutboxCount()).toBe(2);
      expect(client.getOutboxQueue()).toEqual([msg1, msg2]);

      // Connect socket
      client.connect();
      const mockWs = MockWebSocket.instances[0];
      expect(mockWs.sentMessages).toHaveLength(0); // Not open yet

      mockWs.triggerOpen();
      expect(client.getOutboxCount()).toBe(0);
      expect(mockWs.sentMessages).toEqual([JSON.stringify(msg1), JSON.stringify(msg2)]);
    });

    it('sends directly without queueing when socket is already OPEN', () => {
      const client = new SocketClient({ WebSocketClass: MockWebSocket });
      client.connect();
      const mockWs = MockWebSocket.instances[0];
      mockWs.triggerOpen();

      const msg: ClientMessage = { type: 'START_GAME' };
      client.send(msg);

      expect(client.getOutboxCount()).toBe(0);
      expect(mockWs.sentMessages).toEqual([JSON.stringify(msg)]);
    });

    it('clearOutbox empties pending queued messages', () => {
      const client = new SocketClient({ WebSocketClass: MockWebSocket });
      client.send({ type: 'START_GAME' });
      expect(client.getOutboxCount()).toBe(1);

      client.clearOutbox();
      expect(client.getOutboxCount()).toBe(0);
    });
  });

  describe('Defensive JSON Handling', () => {
    it('catches malformed JSON payloads and logs error without crashing', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const client = new SocketClient({ WebSocketClass: MockWebSocket });
      client.connect();
      const mockWs = MockWebSocket.instances[0];
      mockWs.triggerOpen();

      const received: any[] = [];
      client.onMessage((m) => received.push(m));

      expect(() => {
        mockWs.triggerMessage('{"bad json:');
      }).not.toThrow();

      expect(errorSpy).toHaveBeenCalled();
      expect(received).toHaveLength(0);

      // Follow-up valid message still processes
      mockWs.triggerMessage(JSON.stringify({ type: 'ERROR', message: 'Recovered', code: 'OK' }));
      expect(received).toHaveLength(1);

      errorSpy.mockRestore();
    });

    it('handles empty or non-string message data without throwing', () => {
      const client = new SocketClient({ WebSocketClass: MockWebSocket });
      client.connect();
      const mockWs = MockWebSocket.instances[0];
      mockWs.triggerOpen();

      expect(() => mockWs.triggerMessage('')).not.toThrow();
      expect(() => mockWs.triggerMessage(null)).not.toThrow();
    });
  });

  describe('Auto-Reconnect with Exponential Backoff', () => {
    it('reconnects with exponential backoff (1s, 2s, 4s, 8s, capped at 10s) upon unexpected drop', () => {
      const client = new SocketClient({ WebSocketClass: MockWebSocket });
      client.connect();

      let ws = MockWebSocket.instances[0];
      ws.triggerOpen();

      // 1. Unexpected drop #1 -> delay: 1000ms
      ws.triggerClose(1006);
      expect(client.getStatus()).toBe('RECONNECTING');
      expect(MockWebSocket.instances).toHaveLength(1);

      vi.advanceTimersByTime(999);
      expect(MockWebSocket.instances).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances).toHaveLength(2); // Attempt 1 connected

      // 2. Drop #2 -> delay: 2000ms
      ws = MockWebSocket.instances[1];
      ws.triggerClose(1006);
      expect(client.getStatus()).toBe('RECONNECTING');
      vi.advanceTimersByTime(1999);
      expect(MockWebSocket.instances).toHaveLength(2);
      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances).toHaveLength(3); // Attempt 2 connected

      // 3. Drop #3 -> delay: 4000ms
      ws = MockWebSocket.instances[2];
      ws.triggerClose(1006);
      vi.advanceTimersByTime(4000);
      expect(MockWebSocket.instances).toHaveLength(4);

      // 4. Drop #4 -> delay: 8000ms
      ws = MockWebSocket.instances[3];
      ws.triggerClose(1006);
      vi.advanceTimersByTime(8000);
      expect(MockWebSocket.instances).toHaveLength(5);

      // 5. Drop #5 -> capped at 10000ms
      ws = MockWebSocket.instances[4];
      ws.triggerClose(1006);
      vi.advanceTimersByTime(9999);
      expect(MockWebSocket.instances).toHaveLength(5);
      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances).toHaveLength(6);

      client.close();
    });

    it('resets backoff attempt counter to 0 after connection succeeds', () => {
      const client = new SocketClient({ WebSocketClass: MockWebSocket });
      client.connect();

      const ws1 = MockWebSocket.instances[0];
      ws1.triggerClose(1006);
      vi.advanceTimersByTime(1000); // 1s
      expect(MockWebSocket.instances).toHaveLength(2);

      const ws2 = MockWebSocket.instances[1];
      ws2.triggerOpen(); // Successfully connected! Counter resets.

      ws2.triggerClose(1006);
      // Next attempt must be 1000ms again, not 2000ms
      vi.advanceTimersByTime(1000);
      expect(MockWebSocket.instances).toHaveLength(3);

      client.close();
    });

    it('manual close prevents reconnect loop and cancels active timer', () => {
      const client = new SocketClient({ WebSocketClass: MockWebSocket });
      client.connect();

      const ws = MockWebSocket.instances[0];
      ws.triggerOpen();

      // Trigger unexpected close to start timer
      ws.triggerClose(1006);
      expect(client.getStatus()).toBe('RECONNECTING');

      // Now manually close
      client.close();
      expect(client.getStatus()).toBe('DISCONNECTED');

      // Advance time - no new socket should be created
      vi.advanceTimersByTime(60000);
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    it('manual connect() cancels pending reconnectTimer and prevents dangling reconnection attempt', () => {
      const client = new SocketClient({ WebSocketClass: MockWebSocket });
      client.connect();

      const ws1 = MockWebSocket.instances[0];
      ws1.triggerOpen();

      // Unexpected drop triggers 1000ms timer
      ws1.triggerClose(1006);
      expect(client.getStatus()).toBe('RECONNECTING');

      // Manual connect called at 500ms
      vi.advanceTimersByTime(500);
      client.connect();
      expect(MockWebSocket.instances).toHaveLength(2);

      const ws2 = MockWebSocket.instances[1];
      ws2.triggerOpen();
      expect(client.getStatus()).toBe('CONNECTED');

      // Advance past the original 1000ms mark: no 3rd socket should be spawned
      vi.advanceTimersByTime(1000);
      expect(MockWebSocket.instances).toHaveLength(2);
      expect(client.isConnected()).toBe(true);

      client.close();
    });

    it('connect() is idempotent and does not recreate socket if already OPEN or CONNECTING', () => {
      const client = new SocketClient({ WebSocketClass: MockWebSocket });
      client.connect();
      expect(MockWebSocket.instances).toHaveLength(1);

      // Calling connect while CONNECTING does not recreate
      client.connect();
      expect(MockWebSocket.instances).toHaveLength(1);

      const ws = MockWebSocket.instances[0];
      ws.triggerOpen();
      expect(client.isConnected()).toBe(true);

      // Calling connect while OPEN does not recreate
      client.connect();
      expect(MockWebSocket.instances).toHaveLength(1);
      expect(client.isConnected()).toBe(true);

      client.close();
    });
  });
});

/* ========================================================================
 * Test Suite 3: useMultiplayerGame React Hook
 * ======================================================================== */

describe('useMultiplayerGame Hook', () => {
  beforeEach(() => {
    resetMemoryFallback();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    MockWebSocket.instances = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with clean disconnected default state', () => {
    const client = new SocketClient({
      WebSocketClass: MockWebSocket,
    });

    const { result, unmount } = renderHook(() =>
      useMultiplayerGame({ client, autoConnect: false })
    );

    expect(result.current.connectionStatus).toBe('DISCONNECTED');
    expect(result.current.roomCode).toBeNull();
    expect(result.current.isHost).toBe(false);
    expect(result.current.isInLobby).toBe(false);
    expect(result.current.isInGame).toBe(false);
    expect(result.current.lobbySeats).toEqual([]);
    expect(result.current.gameState).toBeNull();
    expect(result.current.mySeatIndex).toBeNull();
    expect(result.current.myPlayerId).toBeNull();
    expect(result.current.errorMessage).toBeNull();

    unmount();
  });

  it('dispatches createRoom and joinRoom actions with proper formatting and credentials', () => {
    const client = new SocketClient({ WebSocketClass: MockWebSocket });
    const { result, unmount } = renderHook(() =>
      useMultiplayerGame({ client, autoConnect: false })
    );

    // 1. Create Room action
    act(() => {
      result.current.createRoom('Alice', 4);
    });
    expect(client.getOutboxCount()).toBe(1);
    expect(client.getOutboxQueue()[0]).toEqual({
      type: 'CREATE_ROOM',
      playerName: 'Alice',
      playerCount: 4,
    });

    client.clearOutbox();

    // 2. Join Room action (uppercased & trimmed)
    act(() => {
      result.current.joinRoom('  game  ', 'Bob');
    });
    expect(client.getOutboxQueue()[0]).toEqual({
      type: 'JOIN_ROOM',
      roomCode: 'GAME',
      playerName: 'Bob',
      sessionToken: undefined,
    });

    unmount();
  });

  it('automatically attaches stored sessionToken when joining same roomCode', () => {
    saveSessionCredentials({
      roomCode: 'RECON',
      playerId: 'p_saved',
      sessionToken: 'tok_secret_123',
      seatIndex: 2,
    });

    const client = new SocketClient({ WebSocketClass: MockWebSocket });
    const { result, unmount } = renderHook(() =>
      useMultiplayerGame({ client, autoConnect: false })
    );

    act(() => {
      result.current.joinRoom('recon', 'Alice');
    });

    expect(client.getOutboxQueue()[0]).toEqual({
      type: 'JOIN_ROOM',
      roomCode: 'RECON',
      playerName: 'Alice',
      sessionToken: 'tok_secret_123',
    });

    unmount();
  });

  it('handles room actions: selectSeat, startGame, dispatchAction, kickPlayer, clearError', () => {
    const client = new SocketClient({ WebSocketClass: MockWebSocket });
    const { result, unmount } = renderHook(() =>
      useMultiplayerGame({ client, autoConnect: false })
    );

    act(() => {
      result.current.selectSeat(3);
      result.current.startGame();
      result.current.dispatchAction({ type: 'DRAW_CARD', source: 'DECK' });
      result.current.kickPlayer(1);
    });

    const queue = client.getOutboxQueue();
    expect(queue).toHaveLength(4);
    expect(queue[0]).toEqual({ type: 'SELECT_SEAT', seatIndex: 3 });
    expect(queue[1]).toEqual({ type: 'START_GAME' });
    expect(queue[2]).toEqual({
      type: 'GAME_ACTION',
      action: { type: 'DRAW_CARD', source: 'DECK' },
    });
    expect(queue[3]).toEqual({ type: 'KICK_PLAYER', seatIndex: 1 });

    unmount();
  });

  it('processes ROOM_JOINED: stores session and updates roomCode, isHost, playerId, seatIndex', () => {
    const client = new SocketClient({ WebSocketClass: MockWebSocket });
    client.connect();
    const mockWs = MockWebSocket.instances[0];
    mockWs.triggerOpen();

    const { result, unmount } = renderHook(() => useMultiplayerGame({ client }));

    act(() => {
      mockWs.triggerMessage(
        JSON.stringify({
          type: 'ROOM_JOINED',
          roomCode: 'HOST1',
          playerId: 'p_alice',
          sessionToken: 'tok_abc_999',
          isHost: true,
          seatIndex: 0,
        })
      );
    });

    expect(result.current.roomCode).toBe('HOST1');
    expect(result.current.isHost).toBe(true);
    expect(result.current.myPlayerId).toBe('p_alice');
    expect(result.current.mySeatIndex).toBe(0);
    expect(result.current.isInLobby).toBe(true);

    const saved = getSessionCredentials();
    expect(saved?.roomCode).toBe('HOST1');
    expect(saved?.sessionToken).toBe('tok_abc_999');

    unmount();
  });

  it('processes LOBBY_UPDATE: updates lobbySeats, roomCode, and host status', () => {
    const client = new SocketClient({ WebSocketClass: MockWebSocket });
    client.connect();
    const mockWs = MockWebSocket.instances[0];
    mockWs.triggerOpen();

    const { result, unmount } = renderHook(() => useMultiplayerGame({ client }));

    const seats: LobbySeat[] = [
      {
        seatIndex: 0,
        playerId: 'p_host',
        playerName: 'Alice',
        team: 'A',
        isConnected: true,
        isHost: true,
      },
      {
        seatIndex: 1,
        playerId: 'p_bob',
        playerName: 'Bob',
        team: 'B',
        isConnected: true,
        isHost: false,
      },
      {
        seatIndex: 2,
        playerId: null,
        playerName: null,
        team: 'A',
        isConnected: false,
        isHost: false,
      },
      {
        seatIndex: 3,
        playerId: null,
        playerName: null,
        team: 'B',
        isConnected: false,
        isHost: false,
      },
    ];

    // Simulate join first
    act(() => {
      mockWs.triggerMessage(
        JSON.stringify({
          type: 'ROOM_JOINED',
          roomCode: 'LOBB',
          playerId: 'p_bob',
          sessionToken: 'tok_bob',
          isHost: false,
          seatIndex: 1,
        })
      );
    });

    // Lobby update arrives
    act(() => {
      mockWs.triggerMessage(
        JSON.stringify({
          type: 'LOBBY_UPDATE',
          roomCode: 'LOBB',
          playerCount: 4,
          hostPlayerId: 'p_host',
          seats,
        })
      );
    });

    expect(result.current.lobbySeats).toEqual(seats);
    expect(result.current.isHost).toBe(false); // Bob is not host
    expect(result.current.mySeatIndex).toBe(1);

    unmount();
  });

  it('processes GAME_STARTED: sets gameState, isInGame=true, and updates seating', () => {
    const client = new SocketClient({ WebSocketClass: MockWebSocket });
    client.connect();
    const mockWs = MockWebSocket.instances[0];
    mockWs.triggerOpen();

    const { result, unmount } = renderHook(() => useMultiplayerGame({ client }));

    const mockSanitizedState: SanitizedGameState = {
      playerCount: 4,
      players: [
        {
          id: 'p1',
          name: 'Alice',
          team: 'A',
          hand: [{ id: 'c1', suit: 'HEARTS', rank: 10 }],
          cardCount: 1,
        },
      ],
      currentPlayerIndex: 0,
      phase: 'DRAW',
      stockDeckCount: 50,
      discardPile: [],
      pukarPoolCount: 0,
      melds: { A: [], B: [] },
      scores: { A: 0, B: 0 },
      roundScores: { A: 0, B: 0 },
      totalScores: { A: 0, B: 0 },
      pukarsClaimed: { A: 0, B: 0 },
      round: 1,
      roundStatus: 'PLAYING',
      isRoundOver: false,
    };

    act(() => {
      mockWs.triggerMessage(
        JSON.stringify({
          type: 'GAME_STARTED',
          state: mockSanitizedState,
          mySeatIndex: 0,
          myPlayerId: 'p1',
        })
      );
    });

    expect(result.current.isInGame).toBe(true);
    expect(result.current.isInLobby).toBe(false);
    expect(result.current.gameState).toEqual(mockSanitizedState);
    expect(result.current.mySeatIndex).toBe(0);
    expect(result.current.myPlayerId).toBe('p1');

    unmount();
  });

  it('processes STATE_UPDATE, ACTION_REJECTED and ERROR messages', () => {
    const client = new SocketClient({ WebSocketClass: MockWebSocket });
    client.connect();
    const mockWs = MockWebSocket.instances[0];
    mockWs.triggerOpen();

    const { result, unmount } = renderHook(() => useMultiplayerGame({ client }));

    // ACTION_REJECTED
    act(() => {
      mockWs.triggerMessage(
        JSON.stringify({
          type: 'ACTION_REJECTED',
          error: 'Not your turn',
        })
      );
    });
    expect(result.current.errorMessage).toBe('Not your turn');

    // clearError
    act(() => {
      result.current.clearError();
    });
    expect(result.current.errorMessage).toBeNull();

    // ERROR
    act(() => {
      mockWs.triggerMessage(
        JSON.stringify({
          type: 'ERROR',
          message: 'Room not found',
          code: 'ROOM_NOT_FOUND',
        })
      );
    });
    expect(result.current.errorMessage).toBe('Room not found');

    unmount();
  });

  it('processes PLAYER_CONNECTION_CHANGED to update seat status', () => {
    const client = new SocketClient({ WebSocketClass: MockWebSocket });
    client.connect();
    const mockWs = MockWebSocket.instances[0];
    mockWs.triggerOpen();

    const { result, unmount } = renderHook(() => useMultiplayerGame({ client }));

    // Populate seats via LOBBY_UPDATE
    act(() => {
      mockWs.triggerMessage(
        JSON.stringify({
          type: 'LOBBY_UPDATE',
          roomCode: 'DISC',
          playerCount: 4,
          hostPlayerId: 'p1',
          seats: [
            { seatIndex: 0, playerId: 'p1', playerName: 'P1', team: 'A', isConnected: true, isHost: true },
            { seatIndex: 1, playerId: 'p2', playerName: 'P2', team: 'B', isConnected: true, isHost: false },
          ],
        })
      );
    });

    // P2 disconnects
    act(() => {
      mockWs.triggerMessage(
        JSON.stringify({
          type: 'PLAYER_CONNECTION_CHANGED',
          seatIndex: 1,
          playerName: 'P2',
          isConnected: false,
        })
      );
    });

    expect(result.current.lobbySeats[1].isConnected).toBe(false);
    expect(result.current.lobbySeats[0].isConnected).toBe(true);

    unmount();
  });

  it('leaveRoom sends LEAVE_ROOM, clears session credentials and resets hook state', () => {
    saveSessionCredentials({
      roomCode: 'LEAV',
      playerId: 'p_leaving',
      sessionToken: 'tok_leave',
      seatIndex: 0,
    });

    const client = new SocketClient({ WebSocketClass: MockWebSocket });
    client.connect();
    const mockWs = MockWebSocket.instances[0];
    mockWs.triggerOpen();

    const { result, unmount } = renderHook(() => useMultiplayerGame({ client }));

    // Simulate joined state
    act(() => {
      mockWs.triggerMessage(
        JSON.stringify({
          type: 'ROOM_JOINED',
          roomCode: 'LEAV',
          playerId: 'p_leaving',
          sessionToken: 'tok_leave',
          isHost: true,
          seatIndex: 0,
        })
      );
    });

    expect(result.current.roomCode).toBe('LEAV');
    expect(result.current.isInLobby).toBe(true);

    // Call leaveRoom
    act(() => {
      result.current.leaveRoom();
    });

    expect(result.current.roomCode).toBeNull();
    expect(result.current.isHost).toBe(false);
    expect(result.current.isInLobby).toBe(false);
    expect(result.current.isInGame).toBe(false);
    expect(result.current.gameState).toBeNull();
    expect(result.current.mySeatIndex).toBeNull();
    expect(result.current.myPlayerId).toBeNull();
    expect(getSessionCredentials()).toBeNull();

    expect(mockWs.sentMessages).toContain(JSON.stringify({ type: 'LEAVE_ROOM' }));

    unmount();
  });

  it('processes LOBBY_UPDATE: updates seat credentials in sessionStorage and resets mySeatIndex to null if kicked or unseated', () => {
    saveSessionCredentials({
      roomCode: 'SYNC',
      playerId: 'p_bob',
      sessionToken: 'tok_bob',
      seatIndex: null,
    });

    const client = new SocketClient({ WebSocketClass: MockWebSocket });
    client.connect();
    const mockWs = MockWebSocket.instances[0];
    mockWs.triggerOpen();

    const { result, unmount } = renderHook(() => useMultiplayerGame({ client }));

    // Initial ROOM_JOINED with seatIndex: null
    act(() => {
      mockWs.triggerMessage(
        JSON.stringify({
          type: 'ROOM_JOINED',
          roomCode: 'SYNC',
          playerId: 'p_bob',
          sessionToken: 'tok_bob',
          isHost: false,
          seatIndex: null,
        })
      );
    });
    expect(result.current.mySeatIndex).toBeNull();
    expect(getSessionCredentials()?.seatIndex).toBeNull();

    // 1. Bob claims seat 1 -> LOBBY_UPDATE assigns seat 1 and synchronizes sessionStorage
    act(() => {
      mockWs.triggerMessage(
        JSON.stringify({
          type: 'LOBBY_UPDATE',
          roomCode: 'SYNC',
          playerCount: 4,
          hostPlayerId: 'p_host',
          seats: [
            { seatIndex: 0, playerId: 'p_host', playerName: 'Host', team: 'A', isConnected: true, isHost: true },
            { seatIndex: 1, playerId: 'p_bob', playerName: 'Bob', team: 'B', isConnected: true, isHost: false },
          ],
        })
      );
    });
    expect(result.current.mySeatIndex).toBe(1);
    expect(getSessionCredentials()?.seatIndex).toBe(1);

    // 2. Bob is kicked from seat 1 -> LOBBY_UPDATE vacates seat 1, mySeatIndex resets to null, sessionStorage resets
    act(() => {
      mockWs.triggerMessage(
        JSON.stringify({
          type: 'LOBBY_UPDATE',
          roomCode: 'SYNC',
          playerCount: 4,
          hostPlayerId: 'p_host',
          seats: [
            { seatIndex: 0, playerId: 'p_host', playerName: 'Host', team: 'A', isConnected: true, isHost: true },
            { seatIndex: 1, playerId: null, playerName: null, team: 'B', isConnected: false, isHost: false },
          ],
        })
      );
    });
    expect(result.current.mySeatIndex).toBeNull();
    expect(getSessionCredentials()?.seatIndex).toBeNull();

    unmount();
  });

  it('processes STATE_UPDATE: synthesizes lobbySeats if empty upon mid-game reconnect', () => {
    const client = new SocketClient({ WebSocketClass: MockWebSocket });
    client.connect();
    const mockWs = MockWebSocket.instances[0];
    mockWs.triggerOpen();

    const { result, unmount } = renderHook(() => useMultiplayerGame({ client }));

    // Reconnecting directly mid-game without prior LOBBY_UPDATE
    act(() => {
      mockWs.triggerMessage(
        JSON.stringify({
          type: 'ROOM_JOINED',
          roomCode: 'MIDG',
          playerId: 'p2',
          sessionToken: 'tok2',
          isHost: false,
          seatIndex: 1,
        })
      );
    });
    expect(result.current.lobbySeats).toEqual([]);

    act(() => {
      mockWs.triggerMessage(
        JSON.stringify({
          type: 'STATE_UPDATE',
          state: {
            playerCount: 4,
            players: [
              { id: 'p1', name: 'Alice', team: 'A', cardCount: 10 },
              { id: 'p2', name: 'Bob', team: 'B', cardCount: 10 },
            ],
            currentPlayerIndex: 0,
            phase: 'DRAW',
            stockDeckCount: 30,
            discardPile: [],
            pukarPoolCount: 0,
            melds: { A: [], B: [] },
            scores: { A: 0, B: 0 },
          },
        })
      );
    });

    expect(result.current.isInGame).toBe(true);
    expect(result.current.lobbySeats).toHaveLength(2);
    expect(result.current.lobbySeats[0].playerName).toBe('Alice');
    expect(result.current.lobbySeats[1].playerName).toBe('Bob');

    unmount();
  });

  it('processes ERROR: clears session credentials on JOIN_FAILED or ROOM_NOT_FOUND', () => {
    saveSessionCredentials({
      roomCode: 'DEAD',
      playerId: 'p_old',
      sessionToken: 'tok_old',
      seatIndex: 0,
    });

    const client = new SocketClient({ WebSocketClass: MockWebSocket });
    client.connect();
    const mockWs = MockWebSocket.instances[0];
    mockWs.triggerOpen();

    const { result, unmount } = renderHook(() => useMultiplayerGame({ client }));

    act(() => {
      mockWs.triggerMessage(
        JSON.stringify({
          type: 'ERROR',
          message: 'Room not found',
          code: 'JOIN_FAILED',
        })
      );
    });

    expect(result.current.errorMessage).toBe('Room not found');
    expect(getSessionCredentials()).toBeNull();

    unmount();
  });

  it('joinRoom: rejects empty or blank room code with clear error message', () => {
    const client = new SocketClient({ WebSocketClass: MockWebSocket });
    const { result, unmount } = renderHook(() =>
      useMultiplayerGame({ client, autoConnect: false })
    );

    act(() => {
      result.current.joinRoom('   ', 'Bob');
    });

    expect(result.current.errorMessage).toBe('Room code is required');
    expect(client.getOutboxCount()).toBe(0);

    unmount();
  });
});

/* ========================================================================
 * Test Suite 4: End-to-End WebSocket Server Integration
 * ======================================================================== */

describe('useMultiplayerGame with Authoritative Server E2E', () => {
  let serverInstance: { close: () => Promise<void>; port: number };

  beforeEach(async () => {
    resetMemoryFallback();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    serverInstance = await startServer(0);
  });

  afterEach(async () => {
    if (serverInstance) {
      await serverInstance.close();
    }
  });

  it('executes a real end-to-end create room, join room, and leave room lifecycle over real WebSockets', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      const msg = args.join(' ');
      if (msg.includes('was not wrapped in act') || msg.includes('act scope')) {
        return;
      }
      console.warn(...args);
    });

    const port = serverInstance.port;

    // 1. Host hook
    const hostClient = new SocketClient({
      url: `ws://127.0.0.1:${port}`,
      WebSocketClass: NodeWebSocket,
    });

    const host = renderHook(() => useMultiplayerGame({ client: hostClient }));

    // Wait for connection
    await vi.waitFor(() => {
      expect(host.result.current.connectionStatus).toBe('CONNECTED');
    });

    // 2. Host creates room
    act(() => {
      host.result.current.createRoom('HostAlice', 4);
    });

    await vi.waitFor(() => {
      expect(host.result.current.roomCode).not.toBeNull();
      expect(host.result.current.isHost).toBe(true);
      expect(host.result.current.isInLobby).toBe(true);
    });

    const roomCode = host.result.current.roomCode!;

    // 3. Client Bob joins room (represents a separate browser tab, so clear Alice's tab session)
    clearSessionCredentials();
    const bobClient = new SocketClient({
      url: `ws://127.0.0.1:${port}`,
      WebSocketClass: NodeWebSocket,
    });

    const bob = renderHook(() => useMultiplayerGame({ client: bobClient }));

    await vi.waitFor(() => {
      expect(bob.result.current.connectionStatus).toBe('CONNECTED');
    });

    act(() => {
      bob.result.current.joinRoom(roomCode, 'Bob');
    });

    await vi.waitFor(() => {
      expect(bob.result.current.roomCode).toBe(roomCode);
      expect(bob.result.current.isHost).toBe(false);
    });

    // 4. Bob selects seat 1
    act(() => {
      bob.result.current.selectSeat(1);
    });

    await vi.waitFor(() => {
      const bobSeat = host.result.current.lobbySeats.find((s) => s.seatIndex === 1);
      expect(bobSeat?.playerName).toBe('Bob');
    });

    // 5. Bob leaves room
    act(() => {
      bob.result.current.leaveRoom();
    });

    await vi.waitFor(() => {
      expect(bob.result.current.roomCode).toBeNull();
      expect(bob.result.current.isInLobby).toBe(false);
    });

    // Clean up
    host.unmount();
    bob.unmount();
    hostClient.close();
    bobClient.close();
    errorSpy.mockRestore();
  });
});
