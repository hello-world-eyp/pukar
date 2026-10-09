# Pukar Multiplayer (LAN & Online) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authoritative WebSocket multiplayer system for Pukar Card Game supporting LAN (same Wi-Fi) and online play with room lobbies, seat assignments, session reconnection, diagnostic logging, and zero duplication of the pure game engine.

**Architecture:** An authoritative Node.js WebSocket server (`server/`) directly runs the pure TypeScript game engine (`src/engine/`), sanitizing state per player to prevent cheating. A resilient client networking layer (`src/network/`) handles auto-reconnects and session storage. React UI components (`src/ui/components/multiplayer/`) provide clean mode switching, 4-character room codes, interactive team seating, and perspective-locked gameplay.

**Tech Stack:** Node.js, WebSockets (`ws`), React 19, TypeScript, Vite, Tailwind CSS, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-pukar-multiplayer-design.md`

## Global Constraints

- **Engine Authority**: Reuses `pukarReducer`, `dealInitialState`, and `sanitizeStateForPlayer` from `src/engine/` directly on the server. Zero duplicated game logic.
- **Cheating Prevention**: Opponents' private cards and stock deck contents are strictly masked via `sanitizeStateForPlayer` before transmission.
- **Defensive Error Handling**: Every network handler, action dispatcher, and state transition is wrapped in `try/catch` with structured, diagnostic logs.
- **Decoupled Architecture**: All large functions are decomposed into focused single-purpose units.
- **Session Resilience**: Disconnections preserve player hands and seats; players auto-reconnect via tokens stored in `sessionStorage`.
- **Dual Mode**: Offline Local Hot-Seat mode remains intact and fully functional alongside Multiplayer mode.
- **Test Integrity**: All existing 427 engine/UI tests must continue to pass; all new server and multiplayer modules must have automated Vitest unit and integration coverage.

---

### Task 1: Networking Dependencies, Core Server Types & Structured Diagnostic Logger

**Files:**
- Modify: `package.json`
- Create: `server/types.ts`
- Create: `server/logger.ts`
- Test: `tests/server/logger.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  - `server/types.ts`: `ClientMessage`, `ServerMessage`, `Seat`, `Room`, `PlayerSession`, `RoomStatus`
  - `server/logger.ts`: `logger.info`, `logger.warn`, `logger.error`, `logger.debug`, `formatLog`

- [ ] **Step 1: Write the failing test for the diagnostic logger**

Create `tests/server/logger.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverLogger, formatLogMessage } from '../../server/logger';

describe('Server Diagnostic Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('formats log messages with timestamp, level, context tags, and message', () => {
    const formatted = formatLogMessage('INFO', 'Server started', {
      roomCode: 'ABCD',
      playerId: 'p1',
    });
    expect(formatted).toContain('[INFO]');
    expect(formatted).toContain('[ROOM:ABCD]');
    expect(formatted).toContain('[PLAYER:p1]');
    expect(formatted).toContain('Server started');
  });

  it('preserves error stacks and details in ERROR logs', () => {
    const err = new Error('Test failure');
    const formatted = formatLogMessage('ERROR', 'Operation failed', {
      error: err,
      roomCode: 'ABCD',
    });
    expect(formatted).toContain('[ERROR]');
    expect(formatted).toContain('Operation failed');
    expect(formatted).toContain('Test failure');
  });

  it('safely handles logging without throwing even when circular or invalid context is passed', () => {
    const circular: any = {};
    circular.self = circular;
    expect(() => {
      serverLogger.warn('Circular warning', { roomCode: 'WILD', circular });
    }).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/server/logger.test.ts`
Expected: FAIL (Cannot find module `../../server/logger`)

- [ ] **Step 3: Install dependencies and implement types & logger**

1. Install `ws`, `@types/ws`, and `tsx`:
```bash
npm install ws
npm install -D @types/ws tsx
```

2. Create `server/types.ts`:
```typescript
import { GameAction, GameState, SanitizedGameState } from '../src/engine/types';

export type RoomStatus = 'LOBBY' | 'IN_GAME' | 'ROUND_OVER' | 'GAME_OVER';

export interface LobbySeat {
  seatIndex: number;
  playerId: string | null;
  playerName: string | null;
  team: 'A' | 'B';
  isConnected: boolean;
  isHost: boolean;
}

export interface PlayerSession {
  playerId: string;
  playerName: string;
  sessionToken: string;
  socketId: string;
  roomCode: string;
  seatIndex: number | null;
  isConnected: boolean;
}

export interface Room {
  roomCode: string;
  playerCount: 4 | 6;
  status: RoomStatus;
  hostPlayerId: string;
  createdAt: number;
  seats: LobbySeat[];
  sessions: Map<string, PlayerSession>; // playerId -> PlayerSession
  tokenToPlayerId: Map<string, string>; // sessionToken -> playerId
  gameState: GameState | null;
}

// Client -> Server
export type ClientMessage =
  | { type: 'CREATE_ROOM'; playerName: string; playerCount: 4 | 6 }
  | { type: 'JOIN_ROOM'; roomCode: string; playerName: string; sessionToken?: string }
  | { type: 'SELECT_SEAT'; seatIndex: number }
  | { type: 'START_GAME' }
  | { type: 'GAME_ACTION'; action: GameAction }
  | { type: 'KICK_PLAYER'; seatIndex: number }
  | { type: 'LEAVE_ROOM' };

// Server -> Client
export type ServerMessage =
  | {
      type: 'ROOM_JOINED';
      roomCode: string;
      playerId: string;
      sessionToken: string;
      isHost: boolean;
      seatIndex: number | null;
    }
  | {
      type: 'LOBBY_UPDATE';
      roomCode: string;
      playerCount: 4 | 6;
      hostPlayerId: string;
      seats: LobbySeat[];
    }
  | {
      type: 'GAME_STARTED';
      state: SanitizedGameState;
      mySeatIndex: number;
      myPlayerId: string;
    }
  | {
      type: 'STATE_UPDATE';
      state: SanitizedGameState;
      lastActionError?: string;
    }
  | {
      type: 'ACTION_REJECTED';
      error: string;
    }
  | {
      type: 'PLAYER_CONNECTION_CHANGED';
      seatIndex: number;
      playerName: string;
      isConnected: boolean;
    }
  | {
      type: 'ERROR';
      message: string;
      code: string;
    };
```

3. Create `server/logger.ts`:
```typescript
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  roomCode?: string;
  playerId?: string;
  socketId?: string;
  actionType?: string;
  error?: unknown;
  [key: string]: unknown;
}

export function formatLogMessage(
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  try {
    const timestamp = new Date().toISOString();
    const roomTag = context?.roomCode ? ` [ROOM:${context.roomCode}]` : '';
    const playerTag = context?.playerId ? ` [PLAYER:${context.playerId}]` : '';
    const actionTag = context?.actionType ? ` [ACTION:${context.actionType}]` : '';

    let extra = '';
    if (context) {
      const { roomCode, playerId, actionType, error, ...rest } = context;
      if (error) {
        if (error instanceof Error) {
          extra += ` | Error: ${error.message}\n${error.stack || ''}`;
        } else {
          extra += ` | Error: ${String(error)}`;
        }
      }
      const restKeys = Object.keys(rest);
      if (restKeys.length > 0) {
        try {
          extra += ` | Data: ${JSON.stringify(rest)}`;
        } catch {
          extra += ' | Data: [unserializable]';
        }
      }
    }

    return `[${timestamp}] [${level}]${roomTag}${playerTag}${actionTag} ${message}${extra}`;
  } catch {
    return `[LOG_FALLBACK] [${level}] ${message}`;
  }
}

export const serverLogger = {
  debug: (message: string, context?: LogContext) => {
    console.debug(formatLogMessage('DEBUG', message, context));
  },
  info: (message: string, context?: LogContext) => {
    console.log(formatLogMessage('INFO', message, context));
  },
  warn: (message: string, context?: LogContext) => {
    console.warn(formatLogMessage('WARN', message, context));
  },
  error: (message: string, context?: LogContext) => {
    console.error(formatLogMessage('ERROR', message, context));
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/server/logger.test.ts`
Expected: PASS (all tests pass cleanly)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json server/types.ts server/logger.ts tests/server/logger.test.ts
git commit -m "feat(server): add networking contracts and diagnostic logger"
```

---

### Task 2: Decoupled Room Manager & Reconnection Session Store

**Files:**
- Create: `server/room-manager.ts`
- Test: `tests/server/room-manager.test.ts`

**Interfaces:**
- Consumes: `server/types.ts`, `server/logger.ts`
- Produces:
  - `generateRoomCode(): string`
  - `createRoom(hostName, playerCount, socketId): { room, session }`
  - `joinRoom(roomCode, playerName, socketId, sessionToken?): JoinRoomResult`
  - `claimSeat(roomCode, playerId, seatIndex): ClaimSeatResult`
  - `vacateSeat(roomCode, playerId): boolean`
  - `kickPlayer(roomCode, hostPlayerId, seatIndex): boolean`
  - `handleDisconnect(socketId): DisconnectResult`
  - `getRoom(roomCode): Room | undefined`
  - `destroyRoom(roomCode): boolean`

- [ ] **Step 1: Write the failing test for Room Manager**

Create `tests/server/room-manager.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../../server/room-manager';

describe('RoomManager', () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
  });

  it('creates a 4-player room with alternating team seats', () => {
    const { room, session } = manager.createRoom('Alice', 4, 'sock_1');
    expect(room.roomCode).toMatch(/^[A-Z0-9]{4}$/);
    expect(room.playerCount).toBe(4);
    expect(room.status).toBe('LOBBY');
    expect(room.seats).toHaveLength(4);
    expect(room.seats[0].team).toBe('A');
    expect(room.seats[1].team).toBe('B');
    expect(room.seats[2].team).toBe('A');
    expect(room.seats[3].team).toBe('B');

    // Host is automatically assigned to seat 0
    expect(room.seats[0].playerName).toBe('Alice');
    expect(room.seats[0].playerId).toBe(session.playerId);
    expect(room.seats[0].isHost).toBe(true);
  });

  it('creates a 6-player room with 6 alternating team seats', () => {
    const { room } = manager.createRoom('Host6', 6, 'sock_1');
    expect(room.seats).toHaveLength(6);
    expect(room.seats.map((s) => s.team)).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
  });

  it('allows players to join and select seats', () => {
    const { room } = manager.createRoom('Alice', 4, 'sock_1');
    const joinResult = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
    expect(joinResult.success).toBe(true);
    if (!joinResult.success) return;

    const seatResult = manager.claimSeat(room.roomCode, joinResult.session.playerId, 1);
    expect(seatResult.success).toBe(true);
    expect(room.seats[1].playerName).toBe('Bob');
    expect(room.seats[1].team).toBe('B');
  });

  it('prevents selecting an already occupied seat', () => {
    const { room } = manager.createRoom('Alice', 4, 'sock_1');
    const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
    if (!bob.success) return;

    const seatResult = manager.claimSeat(room.roomCode, bob.session.playerId, 0); // seat 0 taken by Alice
    expect(seatResult.success).toBe(false);
    expect(seatResult.error).toContain('already occupied');
  });

  it('preserves seat on disconnect and restores on reconnect with sessionToken', () => {
    const { room, session } = manager.createRoom('Alice', 4, 'sock_1');
    
    // Disconnect Alice
    const disResult = manager.handleDisconnect('sock_1');
    expect(disResult.found).toBe(true);
    expect(room.seats[0].isConnected).toBe(false);

    // Reconnect Alice with sessionToken
    const reconResult = manager.joinRoom(room.roomCode, 'Alice', 'sock_new', session.sessionToken);
    expect(reconResult.success).toBe(true);
    if (!reconResult.success) return;

    expect(reconResult.isReconnect).toBe(true);
    expect(reconResult.session.seatIndex).toBe(0);
    expect(room.seats[0].isConnected).toBe(true);
  });

  it('allows the host to kick an abandoned seat', () => {
    const { room, session: hostSession } = manager.createRoom('Alice', 4, 'sock_1');
    const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
    if (!bob.success) return;
    manager.claimSeat(room.roomCode, bob.session.playerId, 1);

    const kickResult = manager.kickPlayer(room.roomCode, hostSession.playerId, 1);
    expect(kickResult).toBe(true);
    expect(room.seats[1].playerId).toBeNull();
    expect(room.seats[1].playerName).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/server/room-manager.test.ts`
Expected: FAIL (Cannot find module `../../server/room-manager`)

- [ ] **Step 3: Implement Room Manager with defensive try/catch blocks**

Create `server/room-manager.ts`:
```typescript
import { LobbySeat, PlayerSession, Room } from './types';
import { serverLogger } from './logger';
import crypto from 'crypto';

export interface JoinRoomSuccess {
  success: true;
  room: Room;
  session: PlayerSession;
  isReconnect: boolean;
}

export interface JoinRoomFailure {
  success: false;
  error: string;
}

export type JoinRoomResult = JoinRoomSuccess | JoinRoomFailure;

export interface ClaimSeatResult {
  success: boolean;
  error?: string;
}

export interface DisconnectResult {
  found: boolean;
  roomCode?: string;
  seatIndex?: number | null;
  playerName?: string;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private socketToPlayer: Map<string, { roomCode: string; playerId: string }> = new Map();

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing I, 1, O, 0
    let code = '';
    for (let attempts = 0; attempts < 100; attempts++) {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (!this.rooms.has(code)) return code;
    }
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  public createRoom(
    hostName: string,
    playerCount: 4 | 6,
    socketId: string
  ): { room: Room; session: PlayerSession } {
    try {
      const roomCode = this.generateRoomCode();
      const hostId = `p_${crypto.randomUUID().slice(0, 8)}`;
      const sessionToken = crypto.randomUUID();

      const seats: LobbySeat[] = Array.from({ length: playerCount }).map((_, index) => ({
        seatIndex: index,
        playerId: index === 0 ? hostId : null,
        playerName: index === 0 ? hostName.trim() || 'Host' : null,
        team: index % 2 === 0 ? 'A' : 'B',
        isConnected: index === 0,
        isHost: index === 0,
      }));

      const hostSession: PlayerSession = {
        playerId: hostId,
        playerName: hostName.trim() || 'Host',
        sessionToken,
        socketId,
        roomCode,
        seatIndex: 0,
        isConnected: true,
      };

      const room: Room = {
        roomCode,
        playerCount,
        status: 'LOBBY',
        hostPlayerId: hostId,
        createdAt: Date.now(),
        seats,
        sessions: new Map([[hostId, hostSession]]),
        tokenToPlayerId: new Map([[sessionToken, hostId]]),
        gameState: null,
      };

      this.rooms.set(roomCode, room);
      this.socketToPlayer.set(socketId, { roomCode, playerId: hostId });

      serverLogger.info(`Room created successfully`, { roomCode, playerId: hostId });
      return { room, session: hostSession };
    } catch (err) {
      serverLogger.error(`Failed to create room`, { error: err });
      throw err;
    }
  }

  public joinRoom(
    roomCode: string,
    playerName: string,
    socketId: string,
    sessionToken?: string
  ): JoinRoomResult {
    try {
      const cleanCode = roomCode.trim().toUpperCase();
      const room = this.rooms.get(cleanCode);
      if (!room) {
        return { success: false, error: `Room ${cleanCode} does not exist` };
      }

      // Check reconnection via sessionToken
      if (sessionToken && room.tokenToPlayerId.has(sessionToken)) {
        const playerId = room.tokenToPlayerId.get(sessionToken)!;
        const session = room.sessions.get(playerId);
        if (session) {
          session.socketId = socketId;
          session.isConnected = true;
          this.socketToPlayer.set(socketId, { roomCode: cleanCode, playerId });

          if (session.seatIndex !== null && room.seats[session.seatIndex]) {
            room.seats[session.seatIndex].isConnected = true;
          }

          serverLogger.info(`Player reconnected via token`, {
            roomCode: cleanCode,
            playerId,
          });
          return { success: true, room, session, isReconnect: true };
        }
      }

      // New player joining
      const newPlayerId = `p_${crypto.randomUUID().slice(0, 8)}`;
      const newToken = crypto.randomUUID();
      const newSession: PlayerSession = {
        playerId: newPlayerId,
        playerName: playerName.trim() || 'Player',
        sessionToken: newToken,
        socketId,
        roomCode: cleanCode,
        seatIndex: null,
        isConnected: true,
      };

      room.sessions.set(newPlayerId, newSession);
      room.tokenToPlayerId.set(newToken, newPlayerId);
      this.socketToPlayer.set(socketId, { roomCode: cleanCode, playerId: newPlayerId });

      serverLogger.info(`New player joined room`, { roomCode: cleanCode, playerId: newPlayerId });
      return { success: true, room, session: newSession, isReconnect: false };
    } catch (err) {
      serverLogger.error(`Error joining room`, { roomCode, error: err });
      return { success: false, error: 'Internal error joining room' };
    }
  }

  public claimSeat(roomCode: string, playerId: string, seatIndex: number): ClaimSeatResult {
    try {
      const room = this.rooms.get(roomCode);
      if (!room) return { success: false, error: 'Room not found' };

      if (seatIndex < 0 || seatIndex >= room.seats.length) {
        return { success: false, error: 'Invalid seat index' };
      }

      const targetSeat = room.seats[seatIndex];
      if (targetSeat.playerId && targetSeat.playerId !== playerId) {
        return { success: false, error: 'Seat is already occupied' };
      }

      const session = room.sessions.get(playerId);
      if (!session) return { success: false, error: 'Player session not found' };

      // Vacate previous seat if any
      if (session.seatIndex !== null && session.seatIndex !== seatIndex) {
        const oldSeat = room.seats[session.seatIndex];
        if (oldSeat && oldSeat.playerId === playerId) {
          oldSeat.playerId = null;
          oldSeat.playerName = null;
          oldSeat.isConnected = false;
        }
      }

      targetSeat.playerId = playerId;
      targetSeat.playerName = session.playerName;
      targetSeat.isConnected = true;
      targetSeat.isHost = room.hostPlayerId === playerId;
      session.seatIndex = seatIndex;

      serverLogger.info(`Player claimed seat ${seatIndex}`, { roomCode, playerId });
      return { success: true };
    } catch (err) {
      serverLogger.error(`Error claiming seat`, { roomCode, playerId, error: err });
      return { success: false, error: 'Error claiming seat' };
    }
  }

  public kickPlayer(roomCode: string, hostPlayerId: string, seatIndex: number): boolean {
    try {
      const room = this.rooms.get(roomCode);
      if (!room || room.hostPlayerId !== hostPlayerId) return false;

      const seat = room.seats[seatIndex];
      if (!seat || !seat.playerId || seat.playerId === hostPlayerId) return false;

      const kickedPlayerId = seat.playerId;
      seat.playerId = null;
      seat.playerName = null;
      seat.isConnected = false;

      const session = room.sessions.get(kickedPlayerId);
      if (session) {
        session.seatIndex = null;
      }

      serverLogger.info(`Host kicked seat ${seatIndex}`, { roomCode, hostPlayerId });
      return true;
    } catch (err) {
      serverLogger.error(`Error kicking player`, { roomCode, hostPlayerId, error: err });
      return false;
    }
  }

  public handleDisconnect(socketId: string): DisconnectResult {
    try {
      const lookup = this.socketToPlayer.get(socketId);
      if (!lookup) return { found: false };

      const { roomCode, playerId } = lookup;
      this.socketToPlayer.delete(socketId);

      const room = this.rooms.get(roomCode);
      if (!room) return { found: false };

      const session = room.sessions.get(playerId);
      if (!session) return { found: false };

      session.isConnected = false;
      if (session.seatIndex !== null && room.seats[session.seatIndex]) {
        room.seats[session.seatIndex].isConnected = false;
      }

      serverLogger.warn(`Player socket disconnected`, { roomCode, playerId });
      return {
        found: true,
        roomCode,
        seatIndex: session.seatIndex,
        playerName: session.playerName,
      };
    } catch (err) {
      serverLogger.error(`Error handling disconnect`, { socketId, error: err });
      return { found: false };
    }
  }

  public getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.trim().toUpperCase());
  }

  public destroyRoom(roomCode: string): boolean {
    const code = roomCode.trim().toUpperCase();
    return this.rooms.delete(code);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/server/room-manager.test.ts`
Expected: PASS (all tests pass)

- [ ] **Step 5: Commit**

```bash
git add server/room-manager.ts tests/server/room-manager.test.ts
git commit -m "feat(server): implement room manager with session resilience"
```

---

### Task 3: Authoritative Game Coordinator & State Sanitization

**Files:**
- Create: `server/game-coordinator.ts`
- Test: `tests/server/game-coordinator.test.ts`

**Interfaces:**
- Consumes: `server/types.ts`, `server/logger.ts`, `src/engine/` (`pukarReducer`, `dealInitialState`, `sanitizeStateForPlayer`)
- Produces:
  - `GameCoordinator.canStartGame(room): { canStart: boolean; reason?: string }`
  - `GameCoordinator.startGame(room): boolean`
  - `GameCoordinator.handleAction(room, playerId, action): { success: boolean; error?: string }`
  - `GameCoordinator.getSanitizedStateForPlayer(room, playerId): SanitizedGameState | null`

- [ ] **Step 1: Write the failing test for Game Coordinator**

Create `tests/server/game-coordinator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { RoomManager } from '../../server/room-manager';
import { GameCoordinator } from '../../server/game-coordinator';

describe('GameCoordinator', () => {
  it('prevents starting the game when not all seats are claimed', () => {
    const manager = new RoomManager();
    const { room } = manager.createRoom('Host', 4, 's1');

    const check = GameCoordinator.canStartGame(room);
    expect(check.canStart).toBe(false);
    expect(check.reason).toContain('Not all seats are filled');
  });

  it('starts the game when all 4 seats are claimed, dealing initial hands', () => {
    const manager = new RoomManager();
    const { room } = manager.createRoom('P1', 4, 's1');
    for (let i = 1; i <= 3; i++) {
      const join = manager.joinRoom(room.roomCode, `P${i + 1}`, `s${i + 1}`);
      if (join.success) manager.claimSeat(room.roomCode, join.session.playerId, i);
    }

    expect(GameCoordinator.canStartGame(room).canStart).toBe(true);
    const started = GameCoordinator.startGame(room);
    expect(started).toBe(true);
    expect(room.status).toBe('IN_GAME');
    expect(room.gameState).not.toBeNull();
    expect(room.gameState?.players).toHaveLength(4);
  });

  it('strictly sanitizes state so opponents hands are masked', () => {
    const manager = new RoomManager();
    const { room, session: hostSession } = manager.createRoom('P1', 4, 's1');
    const p2 = manager.joinRoom(room.roomCode, 'P2', 's2');
    const p3 = manager.joinRoom(room.roomCode, 'P3', 's3');
    const p4 = manager.joinRoom(room.roomCode, 'P4', 's4');
    if (p2.success) manager.claimSeat(room.roomCode, p2.session.playerId, 1);
    if (p3.success) manager.claimSeat(room.roomCode, p3.session.playerId, 2);
    if (p4.success) manager.claimSeat(room.roomCode, p4.session.playerId, 3);
    GameCoordinator.startGame(room);

    // Host sanitization
    const hostSanitized = GameCoordinator.getSanitizedStateForPlayer(room, hostSession.playerId);
    expect(hostSanitized).not.toBeNull();
    expect(hostSanitized!.players[0].hand).toBeDefined();
    expect(hostSanitized!.players[0].hand).toHaveLength(13);
    // Opponent hands must be undefined
    expect(hostSanitized!.players[1].hand).toBeUndefined();
    expect(hostSanitized!.players[1].cardCount).toBe(13);
  });

  it('rejects action when dispatched by wrong player', () => {
    const manager = new RoomManager();
    const { room } = manager.createRoom('P1', 4, 's1');
    const p2 = manager.joinRoom(room.roomCode, 'P2', 's2');
    const p3 = manager.joinRoom(room.roomCode, 'P3', 's3');
    const p4 = manager.joinRoom(room.roomCode, 'P4', 's4');
    if (p2.success) manager.claimSeat(room.roomCode, p2.session.playerId, 1);
    if (p3.success) manager.claimSeat(room.roomCode, p3.session.playerId, 2);
    if (p4.success) manager.claimSeat(room.roomCode, p4.session.playerId, 3);
    GameCoordinator.startGame(room);

    // Current player is index 0 (P1). P2 tries to draw.
    if (p2.success) {
      const res = GameCoordinator.handleAction(room, p2.session.playerId, {
        type: 'DRAW_CARD',
        source: 'DECK',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Not your turn');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/server/game-coordinator.test.ts`
Expected: FAIL (Cannot find module `../../server/game-coordinator`)

- [ ] **Step 3: Implement Game Coordinator**

Create `server/game-coordinator.ts`:
```typescript
import { Room } from './types';
import { serverLogger } from './logger';
import { dealInitialState } from '../src/engine/deck';
import { pukarReducer } from '../src/engine/reducer';
import { sanitizeStateForPlayer } from '../src/engine/sanitizer';
import { GameAction, SanitizedGameState } from '../src/engine/types';

export class GameCoordinator {
  public static canStartGame(room: Room): { canStart: boolean; reason?: string } {
    if (room.status !== 'LOBBY') {
      return { canStart: false, reason: 'Game is already in progress' };
    }
    const emptySeats = room.seats.filter((s) => !s.playerId);
    if (emptySeats.length > 0) {
      return {
        canStart: false,
        reason: `Not all seats are filled (${emptySeats.length} empty)`,
      };
    }
    return { canStart: true };
  }

  public static startGame(room: Room): boolean {
    try {
      const check = this.canStartGame(room);
      if (!check.canStart) {
        serverLogger.warn(`Cannot start game: ${check.reason}`, { roomCode: room.roomCode });
        return false;
      }

      const playerNames = room.seats.map((s) => s.playerName || `Player ${s.seatIndex + 1}`);
      const initialState = dealInitialState(room.playerCount, playerNames);

      // Re-map internal player IDs to session player IDs so sanitizeStateForPlayer matches
      initialState.players.forEach((p, idx) => {
        const seatPlayerId = room.seats[idx].playerId;
        if (seatPlayerId) {
          p.id = seatPlayerId;
        }
      });

      room.gameState = initialState;
      room.status = 'IN_GAME';

      serverLogger.info(`Game started successfully`, { roomCode: room.roomCode });
      return true;
    } catch (err) {
      serverLogger.error(`Error starting game`, { roomCode: room.roomCode, error: err });
      return false;
    }
  }

  public static handleAction(
    room: Room,
    playerId: string,
    action: GameAction
  ): { success: boolean; error?: string } {
    try {
      if (room.status !== 'IN_GAME' || !room.gameState) {
        return { success: false, error: 'Game is not currently active' };
      }

      // Verify turn order
      const activePlayer = room.gameState.players[room.gameState.currentPlayerIndex];
      if (action.type !== 'START_NEXT_ROUND' && action.type !== 'RESET_GAME') {
        if (!activePlayer || activePlayer.id !== playerId) {
          return { success: false, error: 'Not your turn to play' };
        }
      }

      const { state: nextState, error } = pukarReducer(room.gameState, action);
      if (error) {
        serverLogger.warn(`Action rejected by rules engine: ${error}`, {
          roomCode: room.roomCode,
          playerId,
          actionType: action.type,
        });
        return { success: false, error };
      }

      room.gameState = nextState;
      if (nextState.isRoundOver) {
        room.status = nextState.roundStatus === 'GAME_OVER' ? 'GAME_OVER' : 'ROUND_OVER';
      }

      serverLogger.info(`Action executed cleanly: ${action.type}`, {
        roomCode: room.roomCode,
        playerId,
      });
      return { success: true };
    } catch (err) {
      serverLogger.error(`Unexpected exception during action execution`, {
        roomCode: room.roomCode,
        playerId,
        actionType: action.type,
        error: err,
      });
      return { success: false, error: 'Internal server error processing move' };
    }
  }

  public static getSanitizedStateForPlayer(
    room: Room,
    playerId: string
  ): SanitizedGameState | null {
    try {
      if (!room.gameState) return null;
      return sanitizeStateForPlayer(room.gameState, playerId);
    } catch (err) {
      serverLogger.error(`Failed to sanitize state for player`, {
        roomCode: room.roomCode,
        playerId,
        error: err,
      });
      return null;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/server/game-coordinator.test.ts`
Expected: PASS (all tests pass)

- [ ] **Step 5: Commit**

```bash
git add server/game-coordinator.ts tests/server/game-coordinator.test.ts
git commit -m "feat(server): implement authoritative game coordinator and state sanitizer"
```

---

### Task 4: WebSocket Server, Connection Lifecycle & Multi-Client E2E Test Suite

**Files:**
- Create: `server/server.ts`
- Test: `tests/server/websocket-integration.test.ts`
- Modify: `package.json` (add scripts: `"server": "tsx server/server.ts"`)

**Interfaces:**
- Consumes: `server/room-manager.ts`, `server/game-coordinator.ts`, `server/logger.ts`, `server/types.ts`
- Produces:
  - `startServer(port?: number): Promise<{ server: http.Server; wss: WebSocketServer; close: () => Promise<void> }>`

- [ ] **Step 1: Write the failing E2E WebSocket test**

Create `tests/server/websocket-integration.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { startServer } from '../../server/server';
import { ServerMessage } from '../../server/types';

describe('Multiplayer WebSocket E2E Lifecycle', () => {
  let serverInstance: { close: () => Promise<void>; port: number };

  beforeAll(async () => {
    // Dynamic port 0 lets OS allocate an available port
    const running = await startServer(0);
    serverInstance = running;
  });

  afterAll(async () => {
    if (serverInstance) {
      await serverInstance.close();
    }
  });

  function connectClient(port: number): Promise<{
    ws: WebSocket;
    messages: ServerMessage[];
    waitForMessage: (predicate: (msg: ServerMessage) => boolean) => Promise<ServerMessage>;
  }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      const messages: ServerMessage[] = [];
      const waiters: Array<{
        predicate: (msg: ServerMessage) => boolean;
        resolve: (msg: ServerMessage) => void;
      }> = [];

      ws.on('open', () => {
        resolve({
          ws,
          messages,
          waitForMessage: (predicate) => {
            const existing = messages.find(predicate);
            if (existing) return Promise.resolve(existing);
            return new Promise((res) => {
              waiters.push({ predicate, resolve: res });
            });
          },
        });
      });

      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString()) as ServerMessage;
          messages.push(parsed);
          for (let i = waiters.length - 1; i >= 0; i--) {
            if (waiters[i].predicate(parsed)) {
              waiters[i].resolve(parsed);
              waiters.splice(i, 1);
            }
          }
        } catch (err) {
          console.error('Error parsing client message:', err);
        }
      });

      ws.on('error', reject);
    });
  }

  it('executes a 4-client lobby, game start, card draw, and token reconnection', async () => {
    const port = serverInstance.port;

    // 1. Host creates room
    const c1 = await connectClient(port);
    c1.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice', playerCount: 4 }));
    const r1 = await c1.waitForMessage((m) => m.type === 'ROOM_JOINED');
    if (r1.type !== 'ROOM_JOINED') throw new Error('Expected ROOM_JOINED');
    const roomCode = r1.roomCode;
    expect(r1.isHost).toBe(true);

    // 2. Clients 2, 3, 4 join
    const c2 = await connectClient(port);
    c2.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'Bob' }));
    await c2.waitForMessage((m) => m.type === 'ROOM_JOINED');
    c2.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 1 }));

    const c3 = await connectClient(port);
    c3.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'Charlie' }));
    const r3 = await c3.waitForMessage((m) => m.type === 'ROOM_JOINED');
    if (r3.type !== 'ROOM_JOINED') throw new Error('Expected ROOM_JOINED');
    c3.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 2 }));

    const c4 = await connectClient(port);
    c4.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'Dave' }));
    await c4.waitForMessage((m) => m.type === 'ROOM_JOINED');
    c4.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 3 }));

    // Verify all seats claimed in lobby
    await c1.waitForMessage(
      (m) => m.type === 'LOBBY_UPDATE' && m.seats.every((s) => s.playerId !== null)
    );

    // 3. Host starts game
    c1.ws.send(JSON.stringify({ type: 'START_GAME' }));
    const g1 = await c1.waitForMessage((m) => m.type === 'GAME_STARTED');
    const g2 = await c2.waitForMessage((m) => m.type === 'GAME_STARTED');
    expect(g1.type).toBe('GAME_STARTED');
    expect(g2.type).toBe('GAME_STARTED');

    // 4. Client 1 (active player) draws from deck
    c1.ws.send(JSON.stringify({ type: 'GAME_ACTION', action: { type: 'DRAW_CARD', source: 'DECK' } }));
    const u1 = await c1.waitForMessage((m) => m.type === 'STATE_UPDATE');
    if (u1.type === 'STATE_UPDATE') {
      expect(u1.state.players[0].hand).toHaveLength(14);
    }

    // 5. Simulate Client 3 disconnect and reconnect via sessionToken
    c3.ws.close();
    await c1.waitForMessage(
      (m) => m.type === 'PLAYER_CONNECTION_CHANGED' && m.seatIndex === 2 && !m.isConnected
    );

    // Reconnect Charlie
    const c3Reconnect = await connectClient(port);
    c3Reconnect.ws.send(
      JSON.stringify({
        type: 'JOIN_ROOM',
        roomCode,
        playerName: 'Charlie',
        sessionToken: r3.sessionToken,
      })
    );
    const reconMsg = await c3Reconnect.waitForMessage((m) => m.type === 'ROOM_JOINED');
    expect(reconMsg.type).toBe('ROOM_JOINED');
    if (reconMsg.type === 'ROOM_JOINED') {
      expect(reconMsg.seatIndex).toBe(2);
    }

    // Clean up connections
    c1.ws.close();
    c2.ws.close();
    c3Reconnect.ws.close();
    c4.ws.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/server/websocket-integration.test.ts`
Expected: FAIL (Cannot find module `../../server/server`)

- [ ] **Step 3: Implement WebSocket server in server/server.ts**

Create `server/server.ts`:
```typescript
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './room-manager';
import { GameCoordinator } from './game-coordinator';
import { serverLogger } from './logger';
import { ClientMessage, ServerMessage, Room } from './types';

export function broadcastToRoom(
  room: Room,
  socketMap: Map<string, WebSocket>,
  messageBuilder: (playerId: string) => ServerMessage | null
) {
  try {
    for (const session of room.sessions.values()) {
      if (!session.isConnected) continue;
      const ws = socketMap.get(session.socketId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        const msg = messageBuilder(session.playerId);
        if (msg) {
          ws.send(JSON.stringify(msg));
        }
      }
    }
  } catch (err) {
    serverLogger.error(`Error broadcasting to room`, { roomCode: room.roomCode, error: err });
  }
}

export function broadcastLobby(room: Room, socketMap: Map<string, WebSocket>) {
  broadcastToRoom(room, socketMap, () => ({
    type: 'LOBBY_UPDATE',
    roomCode: room.roomCode,
    playerCount: room.playerCount,
    hostPlayerId: room.hostPlayerId,
    seats: room.seats,
  }));
}

export function broadcastGameState(room: Room, socketMap: Map<string, WebSocket>) {
  broadcastToRoom(room, socketMap, (playerId) => {
    const sanitized = GameCoordinator.getSanitizedStateForPlayer(room, playerId);
    if (!sanitized) return null;
    return {
      type: 'STATE_UPDATE',
      state: sanitized,
    };
  });
}

export function startServer(port: number = 3001): Promise<{
  server: http.Server;
  wss: WebSocketServer;
  port: number;
  close: () => Promise<void>;
}> {
  return new Promise((resolve, reject) => {
    const manager = new RoomManager();
    const sockets = new Map<string, WebSocket>();

    const server = http.createServer((req, res) => {
      // Basic healthcheck
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws: WebSocket) => {
      const socketId = `sock_${Math.random().toString(36).substring(2, 9)}`;
      sockets.set(socketId, ws);

      serverLogger.info(`Client connected: ${socketId}`);

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as ClientMessage;

          switch (msg.type) {
            case 'CREATE_ROOM': {
              const { room, session } = manager.createRoom(
                msg.playerName,
                msg.playerCount,
                socketId
              );
              ws.send(
                JSON.stringify({
                  type: 'ROOM_JOINED',
                  roomCode: room.roomCode,
                  playerId: session.playerId,
                  sessionToken: session.sessionToken,
                  isHost: true,
                  seatIndex: session.seatIndex,
                })
              );
              broadcastLobby(room, sockets);
              break;
            }

            case 'JOIN_ROOM': {
              const res = manager.joinRoom(
                msg.roomCode,
                msg.playerName,
                socketId,
                msg.sessionToken
              );
              if (!res.success) {
                ws.send(JSON.stringify({ type: 'ERROR', message: res.error, code: 'JOIN_FAILED' }));
                return;
              }
              const { room, session, isReconnect } = res;
              ws.send(
                JSON.stringify({
                  type: 'ROOM_JOINED',
                  roomCode: room.roomCode,
                  playerId: session.playerId,
                  sessionToken: session.sessionToken,
                  isHost: room.hostPlayerId === session.playerId,
                  seatIndex: session.seatIndex,
                })
              );

              if (room.status === 'LOBBY') {
                broadcastLobby(room, sockets);
              } else if (room.status === 'IN_GAME' && isReconnect) {
                // Send current state
                const sanitized = GameCoordinator.getSanitizedStateForPlayer(room, session.playerId);
                if (sanitized) {
                  ws.send(
                    JSON.stringify({
                      type: 'STATE_UPDATE',
                      state: sanitized,
                    })
                  );
                }
                broadcastToRoom(room, sockets, () => ({
                  type: 'PLAYER_CONNECTION_CHANGED',
                  seatIndex: session.seatIndex ?? 0,
                  playerName: session.playerName,
                  isConnected: true,
                }));
              }
              break;
            }

            case 'SELECT_SEAT': {
              const room = Array.from(manager['rooms'].values()).find((r) =>
                Array.from(r.sessions.values()).some((s) => s.socketId === socketId)
              );
              if (!room) return;
              const session = Array.from(room.sessions.values()).find((s) => s.socketId === socketId);
              if (!session) return;

              const claim = manager.claimSeat(room.roomCode, session.playerId, msg.seatIndex);
              if (claim.success) {
                broadcastLobby(room, sockets);
              } else {
                ws.send(JSON.stringify({ type: 'ACTION_REJECTED', error: claim.error || 'Seat error' }));
              }
              break;
            }

            case 'START_GAME': {
              const room = Array.from(manager['rooms'].values()).find((r) =>
                Array.from(r.sessions.values()).some((s) => s.socketId === socketId)
              );
              if (!room) return;
              const session = Array.from(room.sessions.values()).find((s) => s.socketId === socketId);
              if (!session || room.hostPlayerId !== session.playerId) return;

              const started = GameCoordinator.startGame(room);
              if (!started) {
                ws.send(
                  JSON.stringify({
                    type: 'ACTION_REJECTED',
                    error: 'Cannot start game until all seats are filled',
                  })
                );
                return;
              }

              // Broadcast GAME_STARTED customized per player
              broadcastToRoom(room, sockets, (pId) => {
                const s = room.sessions.get(pId);
                const sanitized = GameCoordinator.getSanitizedStateForPlayer(room, pId);
                if (!sanitized) return null;
                return {
                  type: 'GAME_STARTED',
                  state: sanitized,
                  mySeatIndex: s?.seatIndex ?? 0,
                  myPlayerId: pId,
                };
              });
              break;
            }

            case 'GAME_ACTION': {
              const room = Array.from(manager['rooms'].values()).find((r) =>
                Array.from(r.sessions.values()).some((s) => s.socketId === socketId)
              );
              if (!room) return;
              const session = Array.from(room.sessions.values()).find((s) => s.socketId === socketId);
              if (!session) return;

              const result = GameCoordinator.handleAction(room, session.playerId, msg.action);
              if (!result.success) {
                ws.send(
                  JSON.stringify({
                    type: 'ACTION_REJECTED',
                    error: result.error || 'Action rejected',
                  })
                );
                return;
              }

              broadcastGameState(room, sockets);
              break;
            }

            case 'KICK_PLAYER': {
              const room = Array.from(manager['rooms'].values()).find((r) =>
                Array.from(r.sessions.values()).some((s) => s.socketId === socketId)
              );
              if (!room) return;
              const session = Array.from(room.sessions.values()).find((s) => s.socketId === socketId);
              if (!session || room.hostPlayerId !== session.playerId) return;

              const kicked = manager.kickPlayer(room.roomCode, session.playerId, msg.seatIndex);
              if (kicked) broadcastLobby(room, sockets);
              break;
            }
          }
        } catch (err) {
          serverLogger.error(`Error processing WebSocket message`, { socketId, error: err });
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Malformed message', code: 'PARSE_ERROR' }));
        }
      });

      ws.on('close', () => {
        sockets.delete(socketId);
        const dis = manager.handleDisconnect(socketId);
        if (dis.found && dis.roomCode) {
          const room = manager.getRoom(dis.roomCode);
          if (room) {
            if (room.status === 'LOBBY') {
              broadcastLobby(room, sockets);
            } else {
              broadcastToRoom(room, sockets, () => ({
                type: 'PLAYER_CONNECTION_CHANGED',
                seatIndex: dis.seatIndex ?? 0,
                playerName: dis.playerName || 'Player',
                isConnected: false,
              }));
            }
          }
        }
      });
    });

    server.listen(port, () => {
      const actualPort = (server.address() as any).port;
      serverLogger.info(`Pukar WebSocket Server listening on port ${actualPort}`);
      resolve({
        server,
        wss,
        port: actualPort,
        close: () =>
          new Promise<void>((res) => {
            wss.close(() => {
              server.close(() => res());
            });
          }),
      });
    });

    server.on('error', reject);
  });
}

// Standalone runner
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  const port = Number(process.env.PORT) || 3001;
  startServer(port).catch(console.error);
}
```

Add script to `package.json`:
```json
"server": "tsx server/server.ts"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/server/websocket-integration.test.ts`
Expected: PASS (4-client lifecycle completes in <250ms)

- [ ] **Step 5: Commit**

```bash
git add server/server.ts tests/server/websocket-integration.test.ts package.json
git commit -m "feat(server): implement full WebSocket server and end-to-end multi-client test"
```

---

### Task 5: Client Networking Layer & React State Hook (`useMultiplayerGame`)

**Files:**
- Create: `src/network/types.ts`
- Create: `src/network/session-storage.ts`
- Create: `src/network/socket-client.ts`
- Create: `src/network/useMultiplayerGame.ts`
- Test: `tests/network/useMultiplayerGame.test.ts`

**Interfaces:**
- Consumes: `server/types.ts` (ClientMessage, ServerMessage, LobbySeat), `src/engine/types.ts`
- Produces:
  - `src/network/socket-client.ts`: `SocketClient`
  - `src/network/useMultiplayerGame.ts`: `useMultiplayerGame()`

- [ ] **Step 1: Write the failing unit test for client networking & session storage**

Create `tests/network/useMultiplayerGame.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveSessionCredentials,
  getSessionCredentials,
  clearSessionCredentials,
} from '../../src/network/session-storage';

describe('Multiplayer Session Storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('saves and retrieves room session credentials', () => {
    saveSessionCredentials({
      roomCode: 'WILD',
      playerId: 'p_123',
      sessionToken: 'tok_abc',
      seatIndex: 1,
    });

    const creds = getSessionCredentials();
    expect(creds).not.toBeNull();
    expect(creds?.roomCode).toBe('WILD');
    expect(creds?.sessionToken).toBe('tok_abc');
    expect(creds?.seatIndex).toBe(1);
  });

  it('clears session credentials on voluntary leave', () => {
    saveSessionCredentials({
      roomCode: 'WILD',
      playerId: 'p_123',
      sessionToken: 'tok_abc',
      seatIndex: 1,
    });
    clearSessionCredentials();
    expect(getSessionCredentials()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/network/useMultiplayerGame.test.ts`
Expected: FAIL (Cannot find module `../../src/network/session-storage`)

- [ ] **Step 3: Implement client networking layer**

1. Create `src/network/types.ts`:
```typescript
import { LobbySeat, ServerMessage, ClientMessage } from '../../server/types';
import { GameAction, SanitizedGameState } from '../engine/types';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

export interface StoredSession {
  roomCode: string;
  playerId: string;
  sessionToken: string;
  seatIndex: number | null;
}
```

2. Create `src/network/session-storage.ts`:
```typescript
import { StoredSession } from './types';

const STORAGE_KEY = 'pukar_multiplayer_session';

export function saveSessionCredentials(session: StoredSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn('Failed to save multiplayer session:', err);
  }
}

export function getSessionCredentials(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function clearSessionCredentials(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear multiplayer session:', err);
  }
}
```

3. Create `src/network/socket-client.ts`:
```typescript
import { ClientMessage, ServerMessage } from '../../server/types';

export type MessageHandler = (message: ServerMessage) => void;
export type StatusHandler = (status: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING') => void;

export class SocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private outboxQueue: ClientMessage[] = [];
  private isManuallyClosed = false;

  constructor(url?: string) {
    if (url) {
      this.url = url;
    } else {
      const loc = window.location;
      const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      // In dev with Vite, connects to port 3001 or window.location.host
      const host = loc.port === '5173' ? `${loc.hostname}:3001` : loc.host;
      this.url = `${protocol}//${host}`;
    }
  }

  public connect(): void {
    this.isManuallyClosed = false;
    this.cleanupSocket();

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.notifyStatus('CONNECTED');
        this.flushQueue();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          this.messageHandlers.forEach((handler) => handler(msg));
        } catch (err) {
          console.error('[SocketClient] Bad message payload:', err);
        }
      };

      this.ws.onclose = () => {
        this.notifyStatus('DISCONNECTED');
        if (!this.isManuallyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[SocketClient] Socket error:', err);
      };
    } catch (err) {
      console.error('[SocketClient] Connection failure:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    this.notifyStatus('RECONNECTING');

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  public send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.outboxQueue.push(msg);
    }
  }

  private flushQueue(): void {
    while (this.outboxQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const msg = this.outboxQueue.shift();
      if (msg) this.ws.send(JSON.stringify(msg));
    }
  }

  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  public onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private notifyStatus(status: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING'): void {
    this.statusHandlers.forEach((h) => h(status));
  }

  public close(): void {
    this.isManuallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.cleanupSocket();
  }

  private cleanupSocket(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }
}
```

4. Create `src/network/useMultiplayerGame.ts`:
```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { SocketClient } from './socket-client';
import { LobbySeat, ServerMessage } from '../../server/types';
import { GameAction, SanitizedGameState } from '../engine/types';
import {
  saveSessionCredentials,
  getSessionCredentials,
  clearSessionCredentials,
} from './session-storage';
import { ConnectionStatus } from './types';

export function useMultiplayerGame() {
  const clientRef = useRef<SocketClient | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [lobbySeats, setLobbySeats] = useState<LobbySeat[]>([]);
  const [gameState, setGameState] = useState<SanitizedGameState | null>(null);
  const [mySeatIndex, setMySeatIndex] = useState<number | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInGame, setIsInGame] = useState(false);

  useEffect(() => {
    const client = new SocketClient();
    clientRef.current = client;

    client.onStatus((status) => {
      setConnectionStatus(status);
    });

    client.onMessage((msg: ServerMessage) => {
      try {
        switch (msg.type) {
          case 'ROOM_JOINED': {
            setRoomCode(msg.roomCode);
            setIsHost(msg.isHost);
            setMyPlayerId(msg.playerId);
            setMySeatIndex(msg.seatIndex);
            saveSessionCredentials({
              roomCode: msg.roomCode,
              playerId: msg.playerId,
              sessionToken: msg.sessionToken,
              seatIndex: msg.seatIndex,
            });
            break;
          }
          case 'LOBBY_UPDATE': {
            setRoomCode(msg.roomCode);
            setLobbySeats(msg.seats);
            setIsHost(msg.hostPlayerId === myPlayerId);
            break;
          }
          case 'GAME_STARTED': {
            setGameState(msg.state);
            setMySeatIndex(msg.mySeatIndex);
            setMyPlayerId(msg.myPlayerId);
            setIsInGame(true);
            break;
          }
          case 'STATE_UPDATE': {
            setGameState(msg.state);
            setIsInGame(true);
            break;
          }
          case 'ACTION_REJECTED': {
            setErrorMessage(msg.error);
            break;
          }
          case 'ERROR': {
            setErrorMessage(msg.message);
            break;
          }
        }
      } catch (err) {
        console.error('Error handling server message:', err);
      }
    });

    client.connect();

    return () => {
      client.close();
    };
  }, []);

  const createRoom = useCallback((playerName: string, playerCount: 4 | 6) => {
    setErrorMessage(null);
    clientRef.current?.send({
      type: 'CREATE_ROOM',
      playerName,
      playerCount,
    });
  }, []);

  const joinRoom = useCallback((targetCode: string, playerName: string) => {
    setErrorMessage(null);
    const existing = getSessionCredentials();
    clientRef.current?.send({
      type: 'JOIN_ROOM',
      roomCode: targetCode,
      playerName,
      sessionToken: existing?.roomCode === targetCode ? existing.sessionToken : undefined,
    });
  }, []);

  const selectSeat = useCallback((seatIndex: number) => {
    setErrorMessage(null);
    clientRef.current?.send({
      type: 'SELECT_SEAT',
      seatIndex,
    });
  }, []);

  const startGame = useCallback(() => {
    setErrorMessage(null);
    clientRef.current?.send({
      type: 'START_GAME',
    });
  }, []);

  const dispatchAction = useCallback((action: GameAction) => {
    setErrorMessage(null);
    clientRef.current?.send({
      type: 'GAME_ACTION',
      action,
    });
  }, []);

  const kickPlayer = useCallback((seatIndex: number) => {
    clientRef.current?.send({
      type: 'KICK_PLAYER',
      seatIndex,
    });
  }, []);

  const leaveRoom = useCallback(() => {
    clearSessionCredentials();
    clientRef.current?.send({ type: 'LEAVE_ROOM' });
    setRoomCode(null);
    setGameState(null);
    setIsInGame(false);
    setLobbySeats([]);
    setMySeatIndex(null);
  }, []);

  return {
    connectionStatus,
    roomCode,
    isHost,
    isInLobby: roomCode !== null && !isInGame,
    isInGame,
    lobbySeats,
    gameState,
    mySeatIndex,
    myPlayerId,
    errorMessage,
    createRoom,
    joinRoom,
    selectSeat,
    startGame,
    dispatchAction,
    kickPlayer,
    leaveRoom,
    clearError: () => setErrorMessage(null),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/network/useMultiplayerGame.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/network/ tests/network/
git commit -m "feat(network): implement resilient client socket and multiplayer game hook"
```

---

### Task 6: Multiplayer UI Components: Mode Selector, Create/Join View & Interactive Lobby

**Files:**
- Create: `src/ui/components/ModeSelectorModal.tsx`
- Create: `src/ui/components/multiplayer/CreateJoinView.tsx`
- Create: `src/ui/components/multiplayer/LobbyView.tsx`
- Create: `src/ui/components/multiplayer/MultiplayerHub.tsx`
- Test: `tests/ui/multiplayer-lobby.test.tsx`

**Interfaces:**
- Consumes: `src/network/useMultiplayerGame.ts`, `server/types.ts`
- Produces:
  - `ModeSelectorModal`: Choose between Local Hot-Seat & Multiplayer
  - `CreateJoinView`: Create 4/6p room & Join room
  - `LobbyView`: Visual seating grid, teams, ready states, host controls
  - `MultiplayerHub`: Container view

- [ ] **Step 1: Write the failing test for Multiplayer Lobby UI**

Create `tests/ui/multiplayer-lobby.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CreateJoinView } from '../../src/ui/components/multiplayer/CreateJoinView';
import { LobbyView } from '../../src/ui/components/multiplayer/LobbyView';
import { LobbySeat } from '../../server/types';

describe('Multiplayer UI Components', () => {
  it('renders Create Room and Join Room tabs in CreateJoinView', () => {
    const onCreate = vi.fn();
    const onJoin = vi.fn();
    render(<CreateJoinView onCreateRoom={onCreate} onJoinRoom={onJoin} isConnected={true} />);

    expect(screen.getByText('Create Room')).toBeDefined();
    expect(screen.getByText('Join Room')).toBeDefined();

    // Trigger Create
    const nameInput = screen.getByPlaceholderText(/your name/i);
    fireEvent.change(nameInput, { target: { value: 'Alice' } });
    fireEvent.click(screen.getByRole('button', { name: /create room/i }));
    expect(onCreate).toHaveBeenCalledWith('Alice', 4);
  });

  it('renders team seating board in LobbyView with claim buttons', () => {
    const seats: LobbySeat[] = [
      { seatIndex: 0, playerId: 'p1', playerName: 'Alice', team: 'A', isConnected: true, isHost: true },
      { seatIndex: 1, playerId: null, playerName: null, team: 'B', isConnected: false, isHost: false },
      { seatIndex: 2, playerId: null, playerName: null, team: 'A', isConnected: false, isHost: false },
      { seatIndex: 3, playerId: null, playerName: null, team: 'B', isConnected: false, isHost: false },
    ];

    const onSelectSeat = vi.fn();
    const onStart = vi.fn();
    const onLeave = vi.fn();

    render(
      <LobbyView
        roomCode="ABCD"
        seats={seats}
        myPlayerId="p1"
        isHost={true}
        onSelectSeat={onSelectSeat}
        onStartGame={onStart}
        onLeaveLobby={onLeave}
      />
    );

    expect(screen.getByText('ABCD')).toBeDefined();
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getAllByText(/Claim Seat/i)).toHaveLength(3);

    // Host start button should be disabled because room is not full
    const startBtn = screen.getByRole('button', { name: /start game/i });
    expect(startBtn.hasAttribute('disabled')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/ui/multiplayer-lobby.test.tsx`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement UI components**

1. Create `src/ui/components/ModeSelectorModal.tsx`:
```tsx
import React from 'react';
import { Users, Wifi, MonitorPlay } from 'lucide-react';

interface ModeSelectorModalProps {
  isOpen: boolean;
  onSelectLocal: () => void;
  onSelectMultiplayer: () => void;
  onClose: () => void;
}

export const ModeSelectorModal: React.FC<ModeSelectorModalProps> = ({
  isOpen,
  onSelectLocal,
  onSelectMultiplayer,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl text-stone-100 flex flex-col gap-6">
        <div className="text-center">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-400 mb-2">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">Choose Game Mode</h2>
          <p className="text-xs text-stone-400 mt-1">Play locally on one screen or join friends on LAN / Online</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => {
              onSelectLocal();
              onClose();
            }}
            className="group flex items-start gap-4 p-4 rounded-2xl bg-stone-800/80 hover:bg-stone-800 border border-stone-700/60 hover:border-amber-500/50 transition-all text-left"
          >
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform">
              <MonitorPlay className="w-6 h-6" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-stone-100 group-hover:text-amber-300">
                Local Hot-Seat / Pass & Play
              </div>
              <div className="text-xs text-stone-400 mt-0.5">
                Play on this device with perspective switcher & God-Mode inspector.
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              onSelectMultiplayer();
              onClose();
            }}
            className="group flex items-start gap-4 p-4 rounded-2xl bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/50 hover:border-emerald-500/60 transition-all text-left"
          >
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
              <Wifi className="w-6 h-6" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-emerald-200 group-hover:text-emerald-100">
                LAN & Online Multiplayer
              </div>
              <div className="text-xs text-stone-400 mt-0.5">
                Create a 4-letter room code or join friends on Wi-Fi with personal hands.
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl font-bold text-xs text-stone-400 hover:text-stone-200 bg-stone-800/40 hover:bg-stone-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
```

2. Create `src/ui/components/multiplayer/CreateJoinView.tsx`:
```tsx
import React, { useState } from 'react';
import { PlusCircle, LogIn, Users } from 'lucide-react';

interface CreateJoinViewProps {
  onCreateRoom: (playerName: string, playerCount: 4 | 6) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  isConnected: boolean;
}

export const CreateJoinView: React.FC<CreateJoinViewProps> = ({
  onCreateRoom,
  onJoinRoom,
  isConnected,
}) => {
  const [tab, setTab] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [playerCount, setPlayerCount] = useState<4 | 6>(4);

  return (
    <div className="w-full max-w-md mx-auto bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl text-stone-100">
      <div className="flex rounded-xl bg-stone-800/80 p-1 mb-6">
        <button
          onClick={() => setTab('CREATE')}
          className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
            tab === 'CREATE' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
          }`}
        >
          Create Room
        </button>
        <button
          onClick={() => setTab('JOIN')}
          className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
            tab === 'JOIN' ? 'bg-amber-500 text-stone-950 shadow-md' : 'text-stone-400 hover:text-white'
          }`}
        >
          Join Room
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-bold text-stone-400 mb-1">Your Name</label>
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-stone-800 border border-stone-700 text-white placeholder-stone-500 text-sm font-semibold focus:outline-none focus:border-amber-500"
          />
        </div>

        {tab === 'CREATE' ? (
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1">Player Count</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPlayerCount(4)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  playerCount === 4
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : 'border-stone-700 bg-stone-800/60 text-stone-400'
                }`}
              >
                <Users className="w-4 h-4" /> 4 Players (2v2)
              </button>
              <button
                type="button"
                onClick={() => setPlayerCount(6)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  playerCount === 6
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : 'border-stone-700 bg-stone-800/60 text-stone-400'
                }`}
              >
                <Users className="w-4 h-4" /> 6 Players (3v3)
              </button>
            </div>

            <button
              disabled={!isConnected}
              onClick={() => onCreateRoom(playerName, playerCount)}
              className="mt-6 w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-lg shadow-amber-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" /> Create Room
            </button>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-stone-400 mb-1">4-Letter Room Code</label>
            <input
              type="text"
              maxLength={4}
              placeholder="e.g. PKAR"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 rounded-xl bg-stone-800 border border-stone-700 text-amber-300 placeholder-stone-500 text-lg font-black tracking-widest text-center uppercase focus:outline-none focus:border-amber-500"
            />

            <button
              disabled={!isConnected || roomCode.length !== 4}
              onClick={() => onJoinRoom(roomCode, playerName)}
              className="mt-6 w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" /> Join Room
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
```

3. Create `src/ui/components/multiplayer/LobbyView.tsx`:
```tsx
import React, { useState } from 'react';
import { Copy, Check, Play, UserMinus, ShieldAlert } from 'lucide-react';
import { LobbySeat } from '../../../server/types';

interface LobbyViewProps {
  roomCode: string;
  seats: LobbySeat[];
  myPlayerId: string | null;
  isHost: boolean;
  onSelectSeat: (seatIndex: number) => void;
  onStartGame: () => void;
  onKickPlayer?: (seatIndex: number) => void;
  onLeaveLobby: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomCode,
  seats,
  myPlayerId,
  isHost,
  onSelectSeat,
  onStartGame,
  onKickPlayer,
  onLeaveLobby,
}) => {
  const [copied, setCopied] = useState(false);
  const isFull = seats.length > 0 && seats.every((s) => s.playerId !== null);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl text-stone-100 flex flex-col gap-6">
      {/* Header & Room Code */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-stone-800">
        <div>
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Room Code</span>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black tracking-widest text-amber-400 font-mono">{roomCode}</span>
            <button
              onClick={handleCopy}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
              title="Copy Room Code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="text-center sm:text-right">
          <span className="text-xs font-bold text-stone-400">Status</span>
          <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 justify-center sm:justify-end">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Waiting for players ({seats.filter((s) => s.playerId).length}/{seats.length})
          </div>
        </div>
      </div>

      {/* Seating Grid */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-wider text-stone-400 mb-3">
          Seating Arrangement (Alternating Teams)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {seats.map((seat) => {
            const isMe = seat.playerId === myPlayerId;
            const isTeamA = seat.team === 'A';

            return (
              <div
                key={seat.seatIndex}
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                  isMe
                    ? 'border-amber-500/80 bg-amber-500/10'
                    : seat.playerId
                    ? 'border-stone-700 bg-stone-800/60'
                    : 'border-dashed border-stone-700/60 bg-stone-800/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center ${
                      isTeamA
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-violet-500/20 text-violet-400 border border-violet-500/40'
                    }`}
                  >
                    {seat.team}
                    {Math.floor(seat.seatIndex / 2) + 1}
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      {seat.playerName ? (
                        <>
                          <span className="text-white">{seat.playerName}</span>
                          {isMe && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-extrabold">
                              YOU
                            </span>
                          )}
                          {seat.isHost && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-stone-700 text-stone-300 font-bold">
                              HOST
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-stone-500 italic">Empty Seat</span>
                      )}
                    </div>
                    <div className="text-[10px] text-stone-400">Team {seat.team}</div>
                  </div>
                </div>

                <div>
                  {!seat.playerId ? (
                    <button
                      onClick={() => onSelectSeat(seat.seatIndex)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-200 transition-colors"
                    >
                      Claim Seat
                    </button>
                  ) : isHost && !isMe && onKickPlayer ? (
                    <button
                      onClick={() => onKickPlayer(seat.seatIndex)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Kick player"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Host Controls & Leave */}
      <div className="flex items-center justify-between pt-4 border-t border-stone-800">
        <button
          onClick={onLeaveLobby}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 transition-colors"
        >
          Leave Lobby
        </button>

        {isHost && (
          <button
            disabled={!isFull}
            onClick={onStartGame}
            className="px-6 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 active:scale-98 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" /> Start Game
          </button>
        )}
      </div>
    </div>
  );
};
```

4. Create `src/ui/components/multiplayer/MultiplayerHub.tsx`:
```tsx
import React from 'react';
import { CreateJoinView } from './CreateJoinView';
import { LobbyView } from './LobbyView';
import { useMultiplayerGame } from '../../network/useMultiplayerGame';

interface MultiplayerHubProps {
  onBackToMenu: () => void;
  multiplayerHook: ReturnType<typeof useMultiplayerGame>;
}

export const MultiplayerHub: React.FC<MultiplayerHubProps> = ({
  onBackToMenu,
  multiplayerHook,
}) => {
  const {
    connectionStatus,
    roomCode,
    isHost,
    isInLobby,
    lobbySeats,
    myPlayerId,
    errorMessage,
    createRoom,
    joinRoom,
    selectSeat,
    startGame,
    kickPlayer,
    leaveRoom,
  } = multiplayerHook;

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-4">
      {errorMessage && (
        <div className="w-full max-w-md mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/40 text-red-400 text-xs font-bold text-center">
          {errorMessage}
        </div>
      )}

      {isInLobby && roomCode ? (
        <LobbyView
          roomCode={roomCode}
          seats={lobbySeats}
          myPlayerId={myPlayerId}
          isHost={isHost}
          onSelectSeat={selectSeat}
          onStartGame={startGame}
          onKickPlayer={kickPlayer}
          onLeaveLobby={() => {
            leaveRoom();
            onBackToMenu();
          }}
        />
      ) : (
        <CreateJoinView
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          isConnected={connectionStatus === 'CONNECTED'}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/ui/multiplayer-lobby.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/ModeSelectorModal.tsx src/ui/components/multiplayer/ tests/ui/multiplayer-lobby.test.tsx
git commit -m "feat(ui): implement multiplayer create, join, and interactive lobby components"
```

---

### Task 7: App Integration, In-Game Multiplayer Experience & End-to-End Verification

**Files:**
- Create: `src/ui/components/multiplayer/MultiplayerStatusBar.tsx`
- Modify: `src/App.tsx`
- Test: `tests/ui/app-multiplayer-integration.test.tsx`

**Interfaces:**
- Consumes: `useMultiplayerGame()`, `MultiplayerHub`, `MultiplayerStatusBar`, `ModeSelectorModal`
- Produces: Complete app supporting seamless toggle between Local Hot-Seat and Multiplayer modes

- [ ] **Step 1: Write integration test for App Multiplayer Mode**

Create `tests/ui/app-multiplayer-integration.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { App } from '../../src/App';

describe('App Multiplayer Mode Switching', () => {
  it('opens Mode Selector and allows toggling to Multiplayer mode', () => {
    render(<App />);

    // Click mode switcher button in header
    const modeBtn = screen.getByRole('button', { name: /mode/i });
    fireEvent.click(modeBtn);

    expect(screen.getByText('Choose Game Mode')).toBeDefined();
    expect(screen.getByText('LAN & Online Multiplayer')).toBeDefined();

    // Select Multiplayer
    fireEvent.click(screen.getByText('LAN & Online Multiplayer'));

    // Multiplayer Hub forms should be displayed
    expect(screen.getByText('Create Room')).toBeDefined();
    expect(screen.getByText('Join Room')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/ui/app-multiplayer-integration.test.tsx`
Expected: FAIL (button with name /mode/ not found)

- [ ] **Step 3: Implement MultiplayerStatusBar & wire App.tsx**

1. Create `src/ui/components/multiplayer/MultiplayerStatusBar.tsx`:
```tsx
import React from 'react';
import { Wifi, LogOut } from 'lucide-react';
import { ConnectionStatus } from '../../network/types';

interface MultiplayerStatusBarProps {
  roomCode: string;
  connectionStatus: ConnectionStatus;
  seatIndex: number | null;
  onLeave: () => void;
}

export const MultiplayerStatusBar: React.FC<MultiplayerStatusBarProps> = ({
  roomCode,
  connectionStatus,
  seatIndex,
  onLeave,
}) => {
  return (
    <div className="w-full bg-stone-900/90 border-b border-stone-800 px-4 py-2 flex items-center justify-between text-xs text-stone-300 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Wifi
            className={`w-3.5 h-3.5 ${
              connectionStatus === 'CONNECTED'
                ? 'text-emerald-400'
                : connectionStatus === 'RECONNECTING'
                ? 'text-amber-400 animate-pulse'
                : 'text-red-400'
            }`}
          />
          <span className="font-mono font-bold text-amber-300">Room: {roomCode}</span>
        </div>
        {seatIndex !== null && (
          <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-200 font-semibold text-[11px]">
            Seat {seatIndex + 1}
          </span>
        )}
      </div>

      <button
        onClick={onLeave}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-red-500/20 hover:text-red-300 text-stone-400 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Leave Room</span>
      </button>
    </div>
  );
};
```

2. Modify `src/App.tsx`:
- Import `useMultiplayerGame`, `ModeSelectorModal`, `MultiplayerHub`, and `MultiplayerStatusBar`.
- Add `appMode: 'LOCAL' | 'MULTIPLAYER'` state.
- In `MULTIPLAYER` mode, render `MultiplayerHub` when in lobby, or render the table locked to `multiplayerHook.gameState` and `multiplayerHook.mySeatIndex` when in game, suppressing hot-seat and God-Mode controls.
- Add "Mode: Local / Multiplayer" toggle button in the header.

- [ ] **Step 4: Run all tests and verify 100% pass rate**

Run: `npm test`
Expected: PASS (All tests, including existing 427 tests and all new multiplayer suites, pass cleanly)

- [ ] **Step 5: Run production build verification**

Run: `npm run build`
Expected: PASS (0 TypeScript errors, clean bundle output)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/ui/components/multiplayer/MultiplayerStatusBar.tsx tests/ui/app-multiplayer-integration.test.tsx
git commit -m "feat: complete multiplayer application integration with mode switcher"
```

---
