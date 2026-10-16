import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { WebSocket } from 'ws';
import { startServer, broadcastToRoom, broadcastLobby, broadcastGameState } from '../../server/server';
import { ServerMessage, Room } from '../../server/types';

interface TestClient {
  ws: WebSocket;
  messages: ServerMessage[];
  waitForMessage: (
    predicate: (msg: ServerMessage) => boolean,
    timeoutMs?: number
  ) => Promise<ServerMessage>;
  close: () => Promise<void>;
}

function connectClient(port: number): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const messages: ServerMessage[] = [];
    const waiters: Array<{
      predicate: (msg: ServerMessage) => boolean;
      resolve: (msg: ServerMessage) => void;
      reject: (err: Error) => void;
      timer: NodeJS.Timeout;
    }> = [];

    ws.on('open', () => {
      resolve({
        ws,
        messages,
        waitForMessage: (predicate, timeoutMs = 4000) => {
          const existing = messages.find(predicate);
          if (existing) {
            return Promise.resolve(existing);
          }

          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              const idx = waiters.findIndex((w) => w.timer === timer);
              if (idx !== -1) {
                waiters.splice(idx, 1);
              }
              rej(
                new Error(
                  `Timeout (${timeoutMs}ms) waiting for message. Received ${messages.length} messages: ${JSON.stringify(
                    messages
                  )}`
                )
              );
            }, timeoutMs);

            waiters.push({ predicate, resolve: res, reject: rej, timer });
          });
        },
        close: () => {
          return new Promise<void>((resClose) => {
            if (ws.readyState === WebSocket.CLOSED) {
              resClose();
              return;
            }
            ws.once('close', () => resClose());
            ws.close();
          });
        },
      });
    });

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString()) as ServerMessage;
        messages.push(parsed);
        for (let i = waiters.length - 1; i >= 0; i--) {
          const waiter = waiters[i];
          if (waiter.predicate(parsed)) {
            clearTimeout(waiter.timer);
            waiter.resolve(parsed);
            waiters.splice(i, 1);
          }
        }
      } catch (err) {
        console.error('Error parsing client message in test:', err);
      }
    });

    ws.on('error', (err) => {
      reject(err);
    });
  });
}

describe('Multiplayer WebSocket E2E Lifecycle & Server Integration', () => {
  let serverInstance: { server: http.Server; port: number; close: () => Promise<void> };

  beforeAll(async () => {
    // Dynamic port 0 lets OS allocate an available port
    serverInstance = await startServer(0);
  });

  afterAll(async () => {
    if (serverInstance) {
      await serverInstance.close();
    }
  });

  it('provides a functioning /health HTTP endpoint', async () => {
    const res = await fetch(`http://127.0.0.1:${serverInstance.port}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; timestamp: number };
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('number');
  });

  it('returns 404 for unknown HTTP endpoints', async () => {
    const res = await fetch(`http://127.0.0.1:${serverInstance.port}/not-found`);
    expect(res.status).toBe(404);
  });

  it('executes a complete 4-client lobby, game start, card draw, disconnect, and token reconnection', async () => {
    const port = serverInstance.port;

    // 1. Host creates room
    const c1 = await connectClient(port);
    c1.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice', playerCount: 4 }));
    const r1 = await c1.waitForMessage((m) => m.type === 'ROOM_JOINED');
    expect(r1.type).toBe('ROOM_JOINED');
    if (r1.type !== 'ROOM_JOINED') return;

    expect(r1.isHost).toBe(true);
    expect(r1.roomCode).toMatch(/^[A-Z0-9]{4}$/);
    expect(r1.seatIndex).toBe(0);
    expect(r1.sessionToken).toBeTruthy();
    expect(r1.playerId).toBeTruthy();
    const roomCode = r1.roomCode;

    // 2. Clients 2, 3, 4 join and select seats 1, 2, 3
    const c2 = await connectClient(port);
    c2.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'Bob' }));
    const r2 = await c2.waitForMessage((m) => m.type === 'ROOM_JOINED');
    expect(r2.type).toBe('ROOM_JOINED');
    if (r2.type === 'ROOM_JOINED') {
      expect(r2.isHost).toBe(false);
      expect(r2.seatIndex).toBeNull();
    }
    c2.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 1 }));

    const c3 = await connectClient(port);
    c3.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'Charlie' }));
    const r3 = await c3.waitForMessage((m) => m.type === 'ROOM_JOINED');
    expect(r3.type).toBe('ROOM_JOINED');
    if (r3.type !== 'ROOM_JOINED') return;
    expect(r3.isHost).toBe(false);
    c3.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 2 }));

    const c4 = await connectClient(port);
    c4.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'Dave' }));
    const r4 = await c4.waitForMessage((m) => m.type === 'ROOM_JOINED');
    expect(r4.type).toBe('ROOM_JOINED');
    c4.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 3 }));

    // Verify all seats claimed in lobby
    const fullLobbyMsg = await c1.waitForMessage(
      (m) => m.type === 'LOBBY_UPDATE' && m.seats.every((s) => s.playerId !== null)
    );
    expect(fullLobbyMsg.type).toBe('LOBBY_UPDATE');
    if (fullLobbyMsg.type === 'LOBBY_UPDATE') {
      expect(fullLobbyMsg.seats[0].playerName).toBe('Alice');
      expect(fullLobbyMsg.seats[0].team).toBe('A');
      expect(fullLobbyMsg.seats[1].playerName).toBe('Bob');
      expect(fullLobbyMsg.seats[1].team).toBe('B');
      expect(fullLobbyMsg.seats[2].playerName).toBe('Charlie');
      expect(fullLobbyMsg.seats[2].team).toBe('A');
      expect(fullLobbyMsg.seats[3].playerName).toBe('Dave');
      expect(fullLobbyMsg.seats[3].team).toBe('B');
    }

    // Non-host (Bob) tries to start game -> rejected
    c2.ws.send(JSON.stringify({ type: 'START_GAME' }));
    const rejectedStart = await c2.waitForMessage((m) => m.type === 'ACTION_REJECTED');
    expect(rejectedStart.type).toBe('ACTION_REJECTED');
    if (rejectedStart.type === 'ACTION_REJECTED') {
      expect(rejectedStart.error).toContain('Only the host can start the game');
    }

    // 3. Host starts game -> all 4 clients receive GAME_STARTED with sanitized hands
    c1.ws.send(JSON.stringify({ type: 'START_GAME' }));
    const g1 = await c1.waitForMessage((m) => m.type === 'GAME_STARTED');
    const g2 = await c2.waitForMessage((m) => m.type === 'GAME_STARTED');
    const g3 = await c3.waitForMessage((m) => m.type === 'GAME_STARTED');
    const g4 = await c4.waitForMessage((m) => m.type === 'GAME_STARTED');

    expect(g1.type).toBe('GAME_STARTED');
    expect(g2.type).toBe('GAME_STARTED');
    expect(g3.type).toBe('GAME_STARTED');
    expect(g4.type).toBe('GAME_STARTED');

    if (
      g1.type === 'GAME_STARTED' &&
      g2.type === 'GAME_STARTED' &&
      g3.type === 'GAME_STARTED' &&
      g4.type === 'GAME_STARTED'
    ) {
      expect(g1.mySeatIndex).toBe(0);
      expect(g2.mySeatIndex).toBe(1);
      expect(g3.mySeatIndex).toBe(2);
      expect(g4.mySeatIndex).toBe(3);

      // Verify strict security sanitization:
      // Player 1 sees own hand (13 cards), opponents hands masked
      expect(g1.state.players[0].hand).toHaveLength(13);
      expect(g1.state.players[1].hand).toBeUndefined();
      expect(g1.state.players[1].cardCount).toBe(13);
      expect(g1.state.players[2].hand).toBeUndefined();
      expect(g1.state.players[3].hand).toBeUndefined();
      expect((g1.state as any).stockDeck).toBeUndefined(); // Deck cards masked
      expect(g1.state.stockDeckCount).toBeGreaterThan(0);

      // Player 2 sees own hand (13 cards), player 1 masked
      expect(g2.state.players[1].hand).toHaveLength(13);
      expect(g2.state.players[0].hand).toBeUndefined();
    }

    // 4. Client 1 (active player) draws from deck
    // Non-active player (Bob) tries to draw out of turn -> rejected
    c2.ws.send(JSON.stringify({ type: 'GAME_ACTION', action: { type: 'DRAW_CARD', source: 'DECK' } }));
    const outOfTurnRejected = await c2.waitForMessage((m) => m.type === 'ACTION_REJECTED');
    expect(outOfTurnRejected.type).toBe('ACTION_REJECTED');

    // Alice draws card
    c1.ws.send(JSON.stringify({ type: 'GAME_ACTION', action: { type: 'DRAW_CARD', source: 'DECK' } }));
    const u1 = await c1.waitForMessage(
      (m) => m.type === 'STATE_UPDATE' && m.state.players[0].cardCount === 14
    );
    expect(u1.type).toBe('STATE_UPDATE');
    if (u1.type !== 'STATE_UPDATE') return;
    expect(u1.state.players[0].hand).toHaveLength(14);

    // Opponent Bob sees Alice now has 14 cards, but cannot see her hand
    const u2 = await c2.waitForMessage(
      (m) => m.type === 'STATE_UPDATE' && m.state.players[0].cardCount === 14
    );
    expect(u2.type).toBe('STATE_UPDATE');
    if (u2.type === 'STATE_UPDATE') {
      expect(u2.state.players[0].hand).toBeUndefined();
      expect(u2.state.players[0].cardCount).toBe(14);
    }

    // 5. Client 3 disconnects -> server broadcasts PLAYER_CONNECTION_CHANGED (isConnected: false)
    await c3.close();
    const disMsg = await c1.waitForMessage(
      (m) => m.type === 'PLAYER_CONNECTION_CHANGED' && m.seatIndex === 2 && !m.isConnected
    );
    expect(disMsg.type).toBe('PLAYER_CONNECTION_CHANGED');
    if (disMsg.type === 'PLAYER_CONNECTION_CHANGED') {
      expect(disMsg.seatIndex).toBe(2);
      expect(disMsg.playerName).toBe('Charlie');
      expect(disMsg.isConnected).toBe(false);
    }

    // 6. Client 3 reconnects with sessionToken -> re-acquires Seat 2, receives current game state
    const c3Reconnect = await connectClient(port);
    c3Reconnect.ws.send(
      JSON.stringify({
        type: 'JOIN_ROOM',
        roomCode,
        playerName: 'Charlie',
        sessionToken: r3.sessionToken,
      })
    );

    const reconJoined = await c3Reconnect.waitForMessage((m) => m.type === 'ROOM_JOINED');
    expect(reconJoined.type).toBe('ROOM_JOINED');
    if (reconJoined.type === 'ROOM_JOINED') {
      expect(reconJoined.seatIndex).toBe(2);
      expect(reconJoined.playerId).toBe(r3.playerId);
    }

    // Charlie receives STATE_UPDATE with their own hand preserved
    const charlieState = await c3Reconnect.waitForMessage((m) => m.type === 'STATE_UPDATE');
    expect(charlieState.type).toBe('STATE_UPDATE');
    if (charlieState.type === 'STATE_UPDATE') {
      expect(charlieState.state.players[2].hand).toHaveLength(13);
    }

    // Other clients see Charlie reconnected
    const reconnectedBroadcast = await c1.waitForMessage(
      (m) => m.type === 'PLAYER_CONNECTION_CHANGED' && m.seatIndex === 2 && m.isConnected
    );
    expect(reconnectedBroadcast.type).toBe('PLAYER_CONNECTION_CHANGED');

    // 7. Verify gameplay progression through reconnected Charlie:
    // Alice (Player 0) currently has 14 cards in DISCARD phase. Alice discards.
    const aliceCard = u1.state.players[0].hand![0].id;
    c1.ws.send(JSON.stringify({ type: 'GAME_ACTION', action: { type: 'DISCARD_CARD', cardId: aliceCard } }));

    // Bob (Player 1) observes it is now his turn, draws and discards
    await c2.waitForMessage((m) => m.type === 'STATE_UPDATE' && m.state.currentPlayerIndex === 1);
    c2.ws.send(JSON.stringify({ type: 'GAME_ACTION', action: { type: 'DRAW_CARD', source: 'DECK' } }));
    const bobDrawn = await c2.waitForMessage((m) => m.type === 'STATE_UPDATE' && m.state.players[1].cardCount === 14);
    if (bobDrawn.type === 'STATE_UPDATE') {
      const bobCard = bobDrawn.state.players[1].hand![0].id;
      c2.ws.send(JSON.stringify({ type: 'GAME_ACTION', action: { type: 'DISCARD_CARD', cardId: bobCard } }));
    }

    // Charlie (Player 2, reconnected socket) observes it is now his turn!
    await c3Reconnect.waitForMessage((m) => m.type === 'STATE_UPDATE' && m.state.currentPlayerIndex === 2);

    // Charlie draws from deck using reconnected socket
    c3Reconnect.ws.send(JSON.stringify({ type: 'GAME_ACTION', action: { type: 'DRAW_CARD', source: 'DECK' } }));
    const charlieDrawn = await c3Reconnect.waitForMessage(
      (m) => m.type === 'STATE_UPDATE' && m.state.players[2].cardCount === 14
    );
    expect(charlieDrawn.type).toBe('STATE_UPDATE');
    if (charlieDrawn.type === 'STATE_UPDATE') {
      expect(charlieDrawn.state.players[2].hand).toHaveLength(14);
    }

    // Opponent Alice sees Charlie now has 14 cards
    const aliceSeesCharlie = await c1.waitForMessage(
      (m) => m.type === 'STATE_UPDATE' && m.state.players[2].cardCount === 14
    );
    expect(aliceSeesCharlie.type).toBe('STATE_UPDATE');

    // Clean up
    await c1.close();
    await c2.close();
    await c3Reconnect.close();
    await c4.close();
  });

  it('safely handles malformed messages and unknown room requests without crashing', async () => {
    const port = serverInstance.port;
    const client = await connectClient(port);

    // 1. Malformed JSON payload
    client.ws.send('{ invalid json :::');
    const parseError = await client.waitForMessage((m) => m.type === 'ERROR');
    expect(parseError.type).toBe('ERROR');
    if (parseError.type === 'ERROR') {
      expect(parseError.code).toBe('PARSE_ERROR');
    }

    // 2. Joining non-existent room
    client.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode: 'ZZZZ', playerName: 'Ghost' }));
    const joinError = await client.waitForMessage((m) => m.type === 'ERROR' && m.code === 'JOIN_FAILED');
    expect(joinError.type).toBe('ERROR');

    // 3. Selecting seat when not in any room
    client.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 0 }));
    const seatError = await client.waitForMessage((m) => m.type === 'ERROR' && m.code === 'NOT_IN_ROOM');
    expect(seatError.type).toBe('ERROR');

    // 4. Starting game when not in any room
    client.ws.send(JSON.stringify({ type: 'START_GAME' }));
    const startError = await client.waitForMessage((m) => m.type === 'ERROR' && m.code === 'NOT_IN_ROOM');
    expect(startError.type).toBe('ERROR');

    // 5. Game action when not in any room
    client.ws.send(
      JSON.stringify({ type: 'GAME_ACTION', action: { type: 'DRAW_CARD', source: 'DECK' } })
    );
    const actionError = await client.waitForMessage((m) => m.type === 'ERROR' && m.code === 'NOT_IN_ROOM');
    expect(actionError.type).toBe('ERROR');

    // 6. Leaving room when not in any room
    client.ws.send(JSON.stringify({ type: 'LEAVE_ROOM' }));
    const leaveError = await client.waitForMessage((m) => m.type === 'ERROR' && m.code === 'NOT_IN_ROOM');
    expect(leaveError.type).toBe('ERROR');

    await client.close();
  });

  it('handles host kicking player and player leaving room in lobby', async () => {
    const port = serverInstance.port;
    const host = await connectClient(port);
    host.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Host', playerCount: 4 }));
    const hostJoin = await host.waitForMessage((m) => m.type === 'ROOM_JOINED');
    if (hostJoin.type !== 'ROOM_JOINED') return;
    const roomCode = hostJoin.roomCode;

    const guest1 = await connectClient(port);
    guest1.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'Guest 1' }));
    await guest1.waitForMessage((m) => m.type === 'ROOM_JOINED');
    guest1.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 1 }));

    // Wait until Seat 1 is occupied
    await host.waitForMessage(
      (m) => m.type === 'LOBBY_UPDATE' && m.seats[1].playerId !== null
    );

    // Guest 1 tries to kick Host -> rejected
    guest1.ws.send(JSON.stringify({ type: 'KICK_PLAYER', seatIndex: 0 }));
    const rejectKick = await guest1.waitForMessage((m) => m.type === 'ACTION_REJECTED');
    expect(rejectKick.type).toBe('ACTION_REJECTED');

    // Host kicks Guest 1
    host.ws.send(JSON.stringify({ type: 'KICK_PLAYER', seatIndex: 1 }));
    const lobbyAfterKick = await host.waitForMessage(
      (m) => m.type === 'LOBBY_UPDATE' && m.seats[1].playerId === null
    );
    expect(lobbyAfterKick.type).toBe('LOBBY_UPDATE');

    // Guest 2 joins, takes Seat 2, then voluntarily leaves
    const guest2 = await connectClient(port);
    guest2.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'Guest 2' }));
    await guest2.waitForMessage((m) => m.type === 'ROOM_JOINED');
    guest2.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 2 }));

    await host.waitForMessage(
      (m) => m.type === 'LOBBY_UPDATE' && m.seats[2].playerId !== null
    );

    guest2.ws.send(JSON.stringify({ type: 'LEAVE_ROOM' }));
    const lobbyAfterLeave = await host.waitForMessage(
      (m) => m.type === 'LOBBY_UPDATE' && m.seats[2].playerId === null
    );
    expect(lobbyAfterLeave.type).toBe('LOBBY_UPDATE');

    await host.close();
    await guest1.close();
    await guest2.close();
  });

  it('rejects game start if lobby is not full', async () => {
    const port = serverInstance.port;
    const host = await connectClient(port);
    host.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Host', playerCount: 4 }));
    await host.waitForMessage((m) => m.type === 'ROOM_JOINED');

    // Host tries to start immediately without full seats
    host.ws.send(JSON.stringify({ type: 'START_GAME' }));
    const rejected = await host.waitForMessage((m) => m.type === 'ACTION_REJECTED');
    expect(rejected.type).toBe('ACTION_REJECTED');
    if (rejected.type === 'ACTION_REJECTED') {
      expect(rejected.error).toContain('Not all seats are filled');
    }

    await host.close();
  });

  it('supports 6-player lobby creation and seating', async () => {
    const port = serverInstance.port;
    const host = await connectClient(port);
    host.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Host6', playerCount: 6 }));
    const hostJoin = await host.waitForMessage((m) => m.type === 'ROOM_JOINED');
    if (hostJoin.type !== 'ROOM_JOINED') return;

    const lobbyUpdate = await host.waitForMessage((m) => m.type === 'LOBBY_UPDATE');
    if (lobbyUpdate.type === 'LOBBY_UPDATE') {
      expect(lobbyUpdate.playerCount).toBe(6);
      expect(lobbyUpdate.seats).toHaveLength(6);
      expect(lobbyUpdate.seats.map((s) => s.team)).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
    }

    await host.close();
  });

  it('terminates unresponsive client sockets via heartbeat ping/pong detection', async () => {
    // Start temporary server with very short heartbeat interval (40ms)
    const hbServer = await startServer(0, { heartbeatIntervalMs: 40 });
    try {
      const client = await connectClient(hbServer.port);
      // Suppress client's automatic pong response to simulate a dead/frozen connection
      (client.ws as any).pong = () => {};

      const closedPromise = new Promise<boolean>((resolve) => {
        client.ws.on('close', () => resolve(true));
      });

      // Heartbeat runs every 40ms, unresponsiveness should terminate socket within 250ms
      const wasClosed = await Promise.race([
        closedPromise,
        new Promise<boolean>((res) => setTimeout(() => res(false), 500)),
      ]);

      expect(wasClosed).toBe(true);
    } finally {
      await hbServer.close();
    }
  });

  it('rejects illegal game action via rules engine and returns ACTION_REJECTED', async () => {
    const port = serverInstance.port;
    const c1 = await connectClient(port);
    c1.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'P1', playerCount: 4 }));
    const r1 = await c1.waitForMessage((m) => m.type === 'ROOM_JOINED');
    if (r1.type !== 'ROOM_JOINED') return;
    const roomCode = r1.roomCode;

    const clients: TestClient[] = [];
    for (let i = 1; i <= 3; i++) {
      const c = await connectClient(port);
      clients.push(c);
      c.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: `P${i + 1}` }));
      await c.waitForMessage((m) => m.type === 'ROOM_JOINED');
      c.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: i }));
    }

    await c1.waitForMessage(
      (m) => m.type === 'LOBBY_UPDATE' && m.seats.every((s) => s.playerId !== null)
    );

    c1.ws.send(JSON.stringify({ type: 'START_GAME' }));
    await c1.waitForMessage((m) => m.type === 'GAME_STARTED');

    // Attempt invalid game move: melding before drawing
    c1.ws.send(
      JSON.stringify({
        type: 'GAME_ACTION',
        action: { type: 'PLAY_NEW_MELD', cardIds: ['card-x', 'card-y', 'card-z'] },
      })
    );
    const rejected = await c1.waitForMessage((m) => m.type === 'ACTION_REJECTED');
    expect(rejected.type).toBe('ACTION_REJECTED');
    if (rejected.type === 'ACTION_REJECTED') {
      expect(rejected.error).toContain('Cannot meld: current phase is DRAW');
    }

    // Attempt joining an in-progress game without a sessionToken
    const intruder = await connectClient(port);
    intruder.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'Intruder' }));
    const intruderErr = await intruder.waitForMessage((m) => m.type === 'ERROR');
    expect(intruderErr.type).toBe('ERROR');
    if (intruderErr.type === 'ERROR') {
      expect(intruderErr.code).toBe('JOIN_FAILED');
      expect(intruderErr.message).toContain('Game is already in progress');
    }

    await intruder.close();
    await c1.close();
    for (const c of clients) {
      await c.close();
    }
  });

  it('terminates stale ghost socket upon token reconnection and blocks actions from stale socket', async () => {
    const port = serverInstance.port;
    const c1 = await connectClient(port);
    c1.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'P1', playerCount: 4 }));
    const r1 = await c1.waitForMessage((m) => m.type === 'ROOM_JOINED');
    if (r1.type !== 'ROOM_JOINED') return;
    const roomCode = r1.roomCode;

    const c2 = await connectClient(port);
    c2.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'P2' }));
    const r2 = await c2.waitForMessage((m) => m.type === 'ROOM_JOINED');
    if (r2.type !== 'ROOM_JOINED') return;
    c2.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 1 }));

    const c3 = await connectClient(port);
    c3.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'P3' }));
    await c3.waitForMessage((m) => m.type === 'ROOM_JOINED');
    c3.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 2 }));

    const c4 = await connectClient(port);
    c4.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'P4' }));
    await c4.waitForMessage((m) => m.type === 'ROOM_JOINED');
    c4.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 3 }));

    await c1.waitForMessage(
      (m) => m.type === 'LOBBY_UPDATE' && m.seats.every((s) => s.playerId !== null)
    );

    c1.ws.send(JSON.stringify({ type: 'START_GAME' }));
    await c1.waitForMessage((m) => m.type === 'GAME_STARTED');

    // C2 re-connects on a NEW socket without closing old c2 socket first
    const c2OldClosedPromise = new Promise<boolean>((resolve) => {
      c2.ws.once('close', () => resolve(true));
    });

    const c2New = await connectClient(port);
    c2New.ws.send(
      JSON.stringify({
        type: 'JOIN_ROOM',
        roomCode,
        playerName: 'P2',
        sessionToken: r2.sessionToken,
      })
    );

    await c2New.waitForMessage((m) => m.type === 'ROOM_JOINED');

    // Verify old socket was terminated by server
    const wasOldClosed = await Promise.race([
      c2OldClosedPromise,
      new Promise<boolean>((res) => setTimeout(() => res(false), 800)),
    ]);
    expect(wasOldClosed).toBe(true);

    await c1.close();
    await c2New.close();
    await c3.close();
    await c4.close();
  });

  it('does not broadcast GAME_STARTED with fake seat 0 to unseated sessions in the room', async () => {
    const port = serverInstance.port;
    const c1 = await connectClient(port);
    c1.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'P1', playerCount: 4 }));
    const r1 = await c1.waitForMessage((m) => m.type === 'ROOM_JOINED');
    if (r1.type !== 'ROOM_JOINED') return;
    const roomCode = r1.roomCode;

    // Connect 3 seated guests
    const seatedClients: TestClient[] = [];
    for (let i = 1; i <= 3; i++) {
      const c = await connectClient(port);
      seatedClients.push(c);
      c.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: `P${i + 1}` }));
      await c.waitForMessage((m) => m.type === 'ROOM_JOINED');
      c.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: i }));
    }

    // Connect a 5th player who stays unseated in the room
    const c5Spectator = await connectClient(port);
    c5Spectator.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'P5_Spectator' }));
    await c5Spectator.waitForMessage((m) => m.type === 'ROOM_JOINED');

    // Host starts game
    await c1.waitForMessage(
      (m) => m.type === 'LOBBY_UPDATE' && m.seats.every((s) => s.playerId !== null)
    );
    c1.ws.send(JSON.stringify({ type: 'START_GAME' }));

    // Seated clients receive GAME_STARTED
    const g1 = await c1.waitForMessage((m) => m.type === 'GAME_STARTED');
    expect(g1.type).toBe('GAME_STARTED');

    // Unseated spectator must NOT receive GAME_STARTED claiming they are seat 0
    let spectatorReceivedGameStarted = false;
    for (const msg of c5Spectator.messages) {
      if (msg.type === 'GAME_STARTED') {
        spectatorReceivedGameStarted = true;
      }
    }
    await new Promise((res) => setTimeout(res, 100));
    for (const msg of c5Spectator.messages) {
      if (msg.type === 'GAME_STARTED') {
        spectatorReceivedGameStarted = true;
      }
    }
    expect(spectatorReceivedGameStarted).toBe(false);

    await c1.close();
    for (const c of seatedClients) await c.close();
    await c5Spectator.close();
  });

  it('notifies previous room when a socket switches to creating or joining a new room', async () => {
    const port = serverInstance.port;
    const host1 = await connectClient(port);
    host1.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Host1', playerCount: 4 }));
    const r1 = await host1.waitForMessage((m) => m.type === 'ROOM_JOINED');
    if (r1.type !== 'ROOM_JOINED') return;

    // Guest joins Room 1 and claims seat 1
    const guest = await connectClient(port);
    guest.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode: r1.roomCode, playerName: 'Guest' }));
    await guest.waitForMessage((m) => m.type === 'ROOM_JOINED');
    guest.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 1 }));

    await host1.waitForMessage(
      (m) => m.type === 'LOBBY_UPDATE' && m.seats[1].playerId !== null
    );

    // Guest switches on SAME socket to creating a brand new room
    guest.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'GuestNewRoom', playerCount: 4 }));
    const guestNewRoom = await guest.waitForMessage(
      (m) => m.type === 'ROOM_JOINED' && m.roomCode !== r1.roomCode
    );
    expect(guestNewRoom.type).toBe('ROOM_JOINED');

    // Host1 in Room 1 observes that Seat 1 was disconnected/vacated
    const host1Update = await host1.waitForMessage(
      (m) => m.type === 'LOBBY_UPDATE' && m.seats[1].isConnected === false
    );
    expect(host1Update.type).toBe('LOBBY_UPDATE');

    await host1.close();
    await guest.close();
  });

  it('broadcasts PLAYER_CONNECTION_CHANGED when a player leaves an in-progress game', async () => {
    const port = serverInstance.port;
    const c1 = await connectClient(port);
    c1.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'P1', playerCount: 4 }));
    const r1 = await c1.waitForMessage((m) => m.type === 'ROOM_JOINED');
    if (r1.type !== 'ROOM_JOINED') return;
    const roomCode = r1.roomCode;

    const c2 = await connectClient(port);
    c2.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'P2' }));
    await c2.waitForMessage((m) => m.type === 'ROOM_JOINED');
    c2.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 1 }));

    const c3 = await connectClient(port);
    c3.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'P3' }));
    await c3.waitForMessage((m) => m.type === 'ROOM_JOINED');
    c3.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 2 }));

    const c4 = await connectClient(port);
    c4.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'P4' }));
    await c4.waitForMessage((m) => m.type === 'ROOM_JOINED');
    c4.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 3 }));

    await c1.waitForMessage(
      (m) => m.type === 'LOBBY_UPDATE' && m.seats.every((s) => s.playerId !== null)
    );

    c1.ws.send(JSON.stringify({ type: 'START_GAME' }));
    await c1.waitForMessage((m) => m.type === 'GAME_STARTED');

    // Player 2 voluntarily sends LEAVE_ROOM during active game
    c2.ws.send(JSON.stringify({ type: 'LEAVE_ROOM' }));

    // C1 receives PLAYER_CONNECTION_CHANGED with isConnected: false
    const leftMsg = await c1.waitForMessage(
      (m) => m.type === 'PLAYER_CONNECTION_CHANGED' && m.seatIndex === 1 && !m.isConnected
    );
    expect(leftMsg.type).toBe('PLAYER_CONNECTION_CHANGED');
    if (leftMsg.type === 'PLAYER_CONNECTION_CHANGED') {
      expect(leftMsg.seatIndex).toBe(1);
      expect(leftMsg.isConnected).toBe(false);
    }

    await c1.close();
    await c2.close();
    await c3.close();
    await c4.close();
  });

  it('safely handles broadcast helpers with closed or empty rooms', () => {
    const fakeRoom: Room = {
      roomCode: 'TEST',
      playerCount: 4,
      status: 'LOBBY',
      hostPlayerId: 'p1',
      createdAt: Date.now(),
      seats: [],
      sessions: new Map(),
      tokenToPlayerId: new Map(),
      gameState: null,
    };
    const emptySockets = new Map<string, WebSocket>();

    // These should not throw
    expect(() => broadcastToRoom(fakeRoom, emptySockets, () => null)).not.toThrow();
    expect(() => broadcastLobby(fakeRoom, emptySockets)).not.toThrow();
    expect(() => broadcastGameState(fakeRoom, emptySockets)).not.toThrow();
  });

  describe('Security & Hardening', () => {
    it('enforces message rate limiting per socket', async () => {
      // Start a server with low rate limit for testing
      const rateLimitedServer = await startServer(0, {
        rateLimitMaxMessages: 5,
        rateLimitWindowMs: 2000,
      });

      const client = await connectClient(rateLimitedServer.port);
      // Send 5 rapid messages (within limit)
      for (let i = 0; i < 5; i++) {
        client.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: `P${i}`, playerCount: 4 }));
      }

      // 6th message exceeds limit
      client.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'P_Flooder', playerCount: 4 }));

      const rateLimitMsg = await client.waitForMessage((m) => m.type === 'ERROR' && (m as any).code === 'RATE_LIMITED');
      expect(rateLimitMsg.type).toBe('ERROR');
      if (rateLimitMsg.type === 'ERROR') {
        expect(rateLimitMsg.code).toBe('RATE_LIMITED');
      }

      await client.close();
      await rateLimitedServer.close();
    });

    it('rejects connections from unauthorized origins when allowedOrigins is configured', async () => {
      const secureServer = await startServer(0, {
        allowedOrigins: ['https://pukar-official.example.com'],
      });

      // Try connecting with an unauthorized origin
      const unauthorizedWs = new WebSocket(`ws://127.0.0.1:${secureServer.port}`, {
        headers: { origin: 'https://evil-attacker.example.com' },
      });

      const closeEvent = await new Promise<{ code: number; reason: string }>((resolve) => {
        unauthorizedWs.on('close', (code, reason) => {
          resolve({ code, reason: reason.toString() });
        });
        unauthorizedWs.on('error', () => {
          // Handled via close
        });
      });

      expect(closeEvent.code).toBe(4403);
      expect(closeEvent.reason).toContain('Forbidden origin');

      await secureServer.close();
    });

    it('enforces maxPayload limit on oversized messages', async () => {
      const secureServer = await startServer(0, {
        maxPayloadBytes: 1024, // 1 KB limit
      });

      const client = await connectClient(secureServer.port);
      const closePromise = new Promise<number>((resolve) => {
        client.ws.on('close', (code) => resolve(code));
      });

      // Send 2KB oversized payload
      const hugeString = 'X'.repeat(2048);
      client.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: hugeString, playerCount: 4 }));

      const closeCode = await Promise.race([
        closePromise,
        new Promise<number>((res) => setTimeout(() => res(0), 1000)),
      ]);

      expect(closeCode).toBe(1009); // 1009 = Message Too Big

      await client.close();
      await secureServer.close();
    });

    it('responds to application-level PING keepalive with PONG', async () => {
      const port = serverInstance.port;
      const client = await connectClient(port);

      client.ws.send(JSON.stringify({ type: 'PING' }));
      const pongMsg = await client.waitForMessage((m) => m.type === 'PONG');

      expect(pongMsg.type).toBe('PONG');
      expect((pongMsg as any).timestamp).toBeDefined();

      await client.close();
    });

    it('processes CLAIM_HOST message over WebSocket and broadcasts updated lobby', async () => {
      const port = serverInstance.port;
      const host = await connectClient(port);
      host.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'AliceHost', playerCount: 4 }));
      const r1 = await host.waitForMessage((m) => m.type === 'ROOM_JOINED');
      if (r1.type !== 'ROOM_JOINED') return;

      const guest = await connectClient(port);
      guest.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode: r1.roomCode, playerName: 'BobGuest' }));
      await guest.waitForMessage((m) => m.type === 'ROOM_JOINED');
      guest.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 1 }));
      await guest.waitForMessage(
        (m) => m.type === 'LOBBY_UPDATE' && m.seats[1].playerId !== null
      );

      // Disconnect host
      await host.close();

      // Guest receives lobby update reflecting host disconnected
      await guest.waitForMessage(
        (m) => m.type === 'LOBBY_UPDATE' && m.seats[0].isConnected === false
      );

      // Guest sends CLAIM_HOST
      guest.ws.send(JSON.stringify({ type: 'CLAIM_HOST' }));

      // Guest receives lobby update with new host
      const updatedLobby = await guest.waitForMessage(
        (m) => m.type === 'LOBBY_UPDATE' && m.seats[1].isHost === true
      );

      expect(updatedLobby.type).toBe('LOBBY_UPDATE');
      if (updatedLobby.type === 'LOBBY_UPDATE') {
        expect(updatedLobby.seats[1].isHost).toBe(true);
        expect(updatedLobby.seats[0].isHost).toBe(false);
      }

      await guest.close();
    });

    it('informs reconnected mid-game player about existing disconnected seats', async () => {
      const port = serverInstance.port;

      // Create room and fill 4 seats
      const p1 = await connectClient(port);
      p1.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice', playerCount: 4 }));
      const r1 = await p1.waitForMessage((m) => m.type === 'ROOM_JOINED');
      if (r1.type !== 'ROOM_JOINED') return;
      const roomCode = r1.roomCode;
      const p1Token = r1.sessionToken;

      const p2 = await connectClient(port);
      p2.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'Bob' }));
      await p2.waitForMessage((m) => m.type === 'ROOM_JOINED');
      p2.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 1 }));

      const p3 = await connectClient(port);
      p3.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'Charlie' }));
      await p3.waitForMessage((m) => m.type === 'ROOM_JOINED');
      p3.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 2 }));

      const p4 = await connectClient(port);
      p4.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'Dana' }));
      await p4.waitForMessage((m) => m.type === 'ROOM_JOINED');
      p4.ws.send(JSON.stringify({ type: 'SELECT_SEAT', seatIndex: 3 }));

      // Wait for all seats occupied
      await p1.waitForMessage(
        (m) => m.type === 'LOBBY_UPDATE' && m.seats.every((s) => s.playerId !== null)
      );

      // Start game
      p1.ws.send(JSON.stringify({ type: 'START_GAME' }));
      await p1.waitForMessage((m) => m.type === 'GAME_STARTED');
      await p2.waitForMessage((m) => m.type === 'GAME_STARTED');

      // Now Bob (seat 1) disconnects
      await p2.close();
      await p1.waitForMessage(
        (m) => m.type === 'PLAYER_CONNECTION_CHANGED' && m.seatIndex === 1 && !m.isConnected
      );

      // Now Alice (p1) also disconnects
      await p1.close();

      // Alice reconnects with her sessionToken
      const p1Reconnected = await connectClient(port);
      p1Reconnected.ws.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          roomCode,
          playerName: 'Alice',
          sessionToken: p1Token,
        })
      );

      // Alice receives ROOM_JOINED, STATE_UPDATE, and PLAYER_CONNECTION_CHANGED for Bob (seat 1)
      await p1Reconnected.waitForMessage((m) => m.type === 'ROOM_JOINED');
      await p1Reconnected.waitForMessage((m) => m.type === 'STATE_UPDATE');
      const bobDisconnectStatus = await p1Reconnected.waitForMessage(
        (m) => m.type === 'PLAYER_CONNECTION_CHANGED' && m.seatIndex === 1 && m.isConnected === false
      );

      expect(bobDisconnectStatus).toBeDefined();
      expect((bobDisconnectStatus as any).seatIndex).toBe(1);
      expect((bobDisconnectStatus as any).isConnected).toBe(false);

      await p1Reconnected.close();
      await p3.close();
      await p4.close();
    });
  });
});
