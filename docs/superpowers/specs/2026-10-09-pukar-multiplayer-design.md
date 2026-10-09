# Design Specification: Pukar Multiplayer (LAN & Online)

**Date:** 2026-10-09  
**Status:** Approved  
**Author:** Pair Programming (User & Antigravity)  
**Target:** Authoritative WebSocket Server, Room Lobby & Real-Time Multiplayer Client for Pukar Card Game

---

## 1. Executive Summary & Objective

The Pukar Card Game currently features a fully verified, pure TypeScript game engine (`src/engine/`) with deterministic state transitions, 100% test coverage (427 Vitest tests), and a local hot-seat web UI (`src/ui/`).

This specification outlines the architecture, networking protocol, server subsystems, client state machine, user experience, and end-to-end verification plan for **Phase 2: Real-Time Multiplayer Support (LAN & Online)**.

### Core Objectives:
1. **Zero Engine Duplication**: Reuse the existing, deterministic `pukarReducer`, `dealInitialState`, and `sanitizeStateForPlayer` from `src/engine/` directly on the server as the single source of truth.
2. **Authoritative Server Security**: Clients submit actions (e.g., `DRAW`, `MELD`, `DISCARD`); the server validates each action and broadcasts sanitized state so opponents' private cards and stock deck contents can never be inspected over the wire.
3. **Decoupled, Focused Modules**: Decompose large functions into small, single-responsibility units across both backend and frontend.
4. **Defensive Robustness & Diagnostic Logging**: Wrap all network parsing, action dispatching, and state transitions in `try/catch` blocks. Output structured, timestamped logs with context tags (`[ROOM:XXXX] [PLAYER:P1]`) so any error or abnormal condition is immediately diagnostic and debuggable.
5. **Session Resilience & Reconnection**: Generate unique session tokens stored in browser `sessionStorage`. If a player reloads or suffers temporary Wi-Fi disconnect, they automatically resume their active seat and hand without disrupting the room.
6. **Dual Mode Architecture**: Preserve the existing offline **Local Hot-Seat / Pass-and-Play** mode (with player switcher and God-Mode inspector) alongside the new **LAN & Online Multiplayer** mode.

---

## 2. High-Level Architecture & System Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Node.js Server (`server/`)                      │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ RoomManager (In-Memory Room Store)                           │     │
│   │ • 4-character room codes ("ABCD")                            │     │
│   │ • Seats (P1..P4 / P6) mapped to Teams (A & B)                │     │
│   │ • Session tokens & socket connection lifecycle               │     │
│   │ • Authoritative GameState managed via `pukarReducer`         │     │
│   └──────────────────────────────┬───────────────────────────────┘     │
│                                  │                                     │
│              Per-player Sanitization (`sanitizeStateForPlayer`)        │
│                                  │                                     │
└──────────────┬───────────────────┼───────────────────┬─────────────────┘
               │ ws                │ ws                │ ws
        ┌──────┴──────┐     ┌──────┴──────┐     ┌──────┴──────┐
        │  Player 1   │     │  Player 2   │     │  Player 3   │  ... (4 or 6)
        │ (Team A, P1)│     │ (Team B, P1)│     │ (Team A, P2)│
        │ Web Client  │     │ Web Client  │     │ Web Client  │
        └─────────────┘     └─────────────┘     └─────────────┘
```

- **Transport**: Standard WebSockets (`ws` library on Node.js, native `WebSocket` in browser).
- **Hosting**:
  - **LAN**: Runs on local network (`http://<LAN-IP>:3001`); players connect from phones/laptops on the same Wi-Fi.
  - **Online**: Deployable to any standard Node host (Render, Fly.io, Railway) or tunnel (Cloudflare Tunnel, ngrok).
  - **Unified Dev Experience**: Vite dev server proxies `/ws` to the local backend, or a single combined script runs both client and server seamlessly.

---

## 3. Network Protocol Specification

All WebSocket frames transmit JSON payloads structured according to strict TypeScript contracts.

### 3.1 Client → Server Messages

| Type | Payload | Description |
| :--- | :--- | :--- |
| `CREATE_ROOM` | `{ playerName: string, playerCount: 4 \| 6 }` | Creates a new room; sender becomes host and receives room code and session token. |
| `JOIN_ROOM` | `{ roomCode: string, playerName: string, sessionToken?: string }` | Joins room by code; reclaims seat if `sessionToken` matches existing session. |
| `SELECT_SEAT` | `{ seatIndex: number }` | Claims an open seat (0..3 for 4p, 0..5 for 6p) in the lobby. |
| `START_GAME` | `{}` | Host only: starts game once all seats are claimed. |
| `GAME_ACTION` | `{ action: GameAction }` | Dispatches engine game action (`DRAW_CARD`, `PLAY_NEW_MELD`, `ADD_TO_MELD`, `DISCARD_CARD`, `START_NEXT_ROUND`). |
| `KICK_PLAYER` | `{ seatIndex: number }` | Host only: kicks player or frees abandoned seat. |
| `LEAVE_ROOM` | `{}` | Voluntarily vacates seat and clears player session. |

### 3.2 Server → Client Messages

| Type | Payload | Description |
| :--- | :--- | :--- |
| `ROOM_JOINED` | `{ roomCode: string, playerId: string, sessionToken: string, isHost: boolean, seatIndex: number \| null }` | Acknowledges join; client saves `sessionToken` to `sessionStorage`. |
| `LOBBY_UPDATE` | `{ roomCode: string, playerCount: 4 \| 6, hostPlayerId: string, seats: LobbySeat[] }` | Broadcast when room membership or seat configuration changes. |
| `GAME_STARTED` | `{ state: SanitizedGameState, mySeatIndex: number, myPlayerId: string }` | Broadcast when host starts game; provides initial sanitized hand. |
| `STATE_UPDATE` | `{ state: SanitizedGameState, lastActionError?: string }` | Broadcast on every valid move; customized per player. |
| `ACTION_REJECTED` | `{ error: string }` | Sent privately to actor if move is rejected by rules engine. |
| `PLAYER_CONNECTION_CHANGED` | `{ seatIndex: number, playerName: string, isConnected: boolean }` | Broadcast when a player disconnects or reconnects. |
| `ERROR` | `{ message: string, code: string }` | Sent on unexpected error or invalid request. |

---

## 4. Server Subsystem Design & Module Decoupling

The server code resides in `server/` with isolated single-responsibility files:

```
server/
├── types.ts              # Room, Seat, Session, and WebSocket contract types
├── logger.ts             # Contextual structured logger with log levels & stack tracing
├── room-manager.ts       # Room lifecycle, seating, token generation & reconnect handling
├── game-coordinator.ts   # Action validation, reducer invocation & state broadcast
└── server.ts             # HTTP + WebSocket server setup, heartbeat ping/pong, router
```

### 4.1 Diagnostic Logger (`server/logger.ts`)
- **Log Format**: `[ISO_TIMESTAMP] [LEVEL] [ROOM:XXXX] [PLAYER:YYYY] <Message> | <ContextData>`
- **Levels**: `DEBUG`, `INFO`, `WARN`, `ERROR`.
- **Stack Trace & Context Preservation**: Any error logged preserves the full error object, room context, and triggering action payload for instant debugging.

### 4.2 Room Manager (`server/room-manager.ts`)
Decomposed functions:
- `generateRoomCode(): string`: Produces unique 4-character uppercase alphanumeric codes.
- `createRoom(hostName: string, playerCount: 4 | 6, socketId: string): Room`: Initializes room in `LOBBY` status with alternating seats (`A1, B1, A2, B2`).
- `joinRoom(roomCode: string, playerName: string, socketId: string, sessionToken?: string): JoinResult`:
  - If `sessionToken` matches an existing seat: re-binds socket, sets `isConnected = true`, returns reconnected state.
  - If new: creates participant record.
- `assignSeat(roomCode: string, playerId: string, seatIndex: number): boolean`: Validates seat index and availability.
- `handleDisconnect(socketId: string): DisconnectResult`: Marks seat `isConnected = false`, retains session token and hand.
- `kickPlayer(roomCode: string, hostPlayerId: string, seatIndex: number): boolean`: Host-only seat clearing.
- `destroyRoomIfEmpty(roomCode: string): void`: Cleans up rooms when all players have left.

### 4.3 Game Coordinator (`server/game-coordinator.ts`)
Decomposed functions:
- `startGame(roomCode: string, hostPlayerId: string): StartGameResult`:
  - Validates all seats are occupied.
  - Deals initial game state via `dealInitialState(playerCount, playerNames)`.
  - Transitions room to `IN_GAME`.
  - Dispatches `GAME_STARTED` with `sanitizeStateForPlayer` for each seat.
- `handleGameAction(roomCode: string, playerId: string, action: GameAction): ActionResult`:
  - Checks room status is `IN_GAME`.
  - Verifies acting player matches `gameState.currentPlayerIndex` (or valid round action).
  - Executes `pukarReducer(room.gameState, action)` inside `try/catch`.
  - If reducer errors: logs `[WARN]` and sends `ACTION_REJECTED` to the actor.
  - If reducer succeeds: updates `room.gameState` and broadcasts `STATE_UPDATE` with `sanitizeStateForPlayer` to each connected player.

### 4.4 WebSocket Server & Heartbeat (`server/server.ts`)
- Runs a 30-second ping/pong heartbeat to detect dropped sockets.
- Closes stale connections gracefully without throwing uncaught exceptions.
- Wraps all connection event handlers in `try/catch` with structured logging.

---

## 5. Client Networking Layer (`src/network/`)

```
src/network/
├── types.ts              # Client-side networking interfaces
├── socket-client.ts      # WebSocket wrapper with auto-reconnect backoff & queueing
├── session-storage.ts    # Safe sessionStorage helper for room tokens
└── useMultiplayerGame.ts # React hook exposing state, lobby, and action methods
```

### 5.1 Robust Socket Client (`src/network/socket-client.ts`)
- Reconnection backoff: 1s, 2s, 4s, capped at 10s.
- Outbox queue: messages attempted during brief reconnection are queued and delivered upon reconnect.
- Safe parsing: all incoming socket messages parsed with `try/catch`. Bad payloads log `[ClientSocket Error]` without breaking the UI.

### 5.2 Session Storage Helper (`src/network/session-storage.ts`)
- Stores `{ roomCode, playerId, sessionToken, seatIndex }`.
- Restores session on browser refresh.
- Clears session explicitly on voluntary room exit.

### 5.3 React Hook (`src/network/useMultiplayerGame.ts`)
Exposes:
- `connectionStatus`: `'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING'`
- `roomCode`, `isHost`, `isInLobby`, `isInGame`
- `lobbySeats`: Array of seats with player names, team badges, and connection statuses
- `gameState`: SanitizedGameState for the viewing player
- `mySeatIndex`, `myPlayerId`
- Action handlers: `createRoom`, `joinRoom`, `selectSeat`, `startGame`, `dispatchAction`, `leaveRoom`, `clearError`

---

## 6. User Experience & UI Integration

```
src/ui/
├── components/
│   ├── ModeSelectorModal.tsx      # Welcome screen: choose Local Hot-Seat or Multiplayer
│   └── multiplayer/
│       ├── MultiplayerHub.tsx     # Container managing view transitions
│       ├── CreateJoinView.tsx     # Create room (4/6p) & Join room with code input
│       ├── LobbyView.tsx          # Seating grid, team badges, host controls, share link
│       └── MultiplayerStatusBar.tsx # In-game connection status, room code, teammate ping
```

### 6.1 Mode Selection Entry Point
- Users can switch between **Local Hot-Seat** and **Online / LAN Multiplayer** from the header or welcome screen.

### 6.2 Lobby View
- **Room Code**: Displayed prominently with a "Copy Invite Link" button (`?room=XXXX`).
- **Seating Grid**:
  - Clear visual layout separating Team A and Team B.
  - Interactive "Claim Seat" buttons.
  - Live connection status indicators (🟢 Connected / 🟡 Reconnecting).
  - Host "Start Game" button enabled once all seats are filled.

### 6.3 In-Game Multiplayer Experience
- Reuses all table components ([`ScoreBoard`](file:///Users/Harsh/Pukar%20game/src/ui/components/ScoreBoard.tsx), [`TableMeldBoard`](file:///Users/Harsh/Pukar%20game/src/ui/components/TableMeldBoard.tsx), [`CenterTable`](file:///Users/Harsh/Pukar%20game/src/ui/components/CenterTable.tsx), [`PlayerHand`](file:///Users/Harsh/Pukar%20game/src/ui/components/PlayerHand.tsx), [`ActionControls`](file:///Users/Harsh/Pukar%20game/src/ui/components/ActionControls.tsx)).
- Perspective is strictly locked to the player's personal seat.
- God-Mode and hot-seat switcher are hidden in multiplayer mode.
- Non-blocking connection banner notifies players if an opponent or teammate disconnects.

---

## 7. Error Handling & Defensive Resilience Contract

1. **Defensive Boundaries**:
   - Every network handler on server and client is enclosed in `try/catch`.
   - Parsing failures or malformed messages are safely logged and discarded without crashing the process.
2. **Diagnostic Logs**:
   - Server logs all incoming messages and outgoing broadcasts with room and player context.
   - Exceptions include timestamp, action type, payload parameters, and full error stack.
3. **Action Rejection**:
   - Invalid moves generate clear error strings sent back to the acting player, rendered as subtle toasts in the UI without freezing the game table.

---

## 8. Automated Verification Plan (Vitest)

### 8.1 Unit Tests
1. `tests/server/logger.test.ts`:
   - Validates log formatting, log levels, context tag interpolation, and error stack preservation.
2. `tests/server/room-manager.test.ts`:
   - Unique 4-character room code generation and collision avoidance.
   - 4-player and 6-player room seating and alternating team validation.
   - Session token generation and seat re-attachment on reconnect.
   - Host transfer and kick player behavior.
3. `tests/server/game-coordinator.test.ts`:
   - Out-of-turn move rejection with `ACTION_REJECTED`.
   - Strict `sanitizeStateForPlayer` verification (opponent hands and stock deck masked).
   - Valid move state transition and multi-player broadcast.

### 8.2 End-to-End WebSocket Integration Tests (`tests/server/websocket-integration.test.ts`)
Spins up an in-memory WebSocket server and connects 4 real client sockets:
1. **Room & Seating Flow**: Client 1 creates room; Clients 2, 3, and 4 join and claim seats.
2. **Game Start**: Client 1 starts game; asserts all 4 clients receive `GAME_STARTED` with unique sanitized hands.
3. **Turn Execution**: Client 1 draws and discards; asserts turn advances to Client 2 across all 4 sockets.
4. **Disconnect & Reconnect Simulation**:
   - Client 3 terminates socket.
   - Asserts server logs `[WARN]` and broadcasts `PLAYER_CONNECTION_CHANGED`.
   - Client 3 reconnects with `sessionToken`.
   - Asserts Client 3 immediately re-acquires seat, receives current game state, and resumes play.
5. **Defensive Error Handling**:
   - Sends malformed JSON and out-of-order action payloads.
   - Asserts server logs `[ERROR]` with diagnostic context, rejects safely, and remains running.

### 8.3 UI Integration Tests (`tests/ui/multiplayer-lobby.test.tsx`)
- Form validation for Create Room and Join Room.
- Seat selection, team assignment display, and start game button states.
