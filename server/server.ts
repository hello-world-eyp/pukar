import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import { RoomManager } from './room-manager';
import { GameCoordinator } from './game-coordinator';
import { serverLogger } from './logger';
import { ClientMessage, ServerMessage, Room } from './types';

interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
  socketId: string;
}

export interface ServerInstance {
  server: http.Server;
  wss: WebSocketServer;
  port: number;
  roomManager: RoomManager;
  close: () => Promise<void>;
}

export interface ServerOptions {
  heartbeatIntervalMs?: number;
  roomManager?: RoomManager;
}

/**
 * Safely dispatches a message to a WebSocket client if the socket is open.
 */
function safeSend(ws: WebSocket | undefined, message: ServerMessage): void {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  } catch (err) {
    serverLogger.error('Failed to send WebSocket message', { error: err });
  }
}

/**
 * Dispatches personalized or common messages to all active connected players in a room.
 */
export function broadcastToRoom(
  room: Room,
  socketMap: Map<string, WebSocket>,
  messageBuilder: (playerId: string) => ServerMessage | null
): void {
  try {
    if (!room || !room.sessions) return;
    for (const session of room.sessions.values()) {
      if (!session.isConnected) continue;
      const ws = socketMap.get(session.socketId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          const msg = messageBuilder(session.playerId);
          if (msg) {
            safeSend(ws, msg);
          }
        } catch (playerErr) {
          serverLogger.error('Error building message for player in broadcast', {
            roomCode: room.roomCode,
            playerId: session.playerId,
            error: playerErr,
          });
        }
      }
    }
  } catch (err) {
    let roomCode: string | undefined;
    try {
      roomCode = room?.roomCode;
    } catch {
      // Safe fallback
    }
    serverLogger.error('Error broadcasting to room', { roomCode, error: err });
  }
}

/**
 * Broadcasts authoritative lobby state (seats, teams, connection status) to all room participants.
 */
export function broadcastLobby(room: Room, socketMap: Map<string, WebSocket>): void {
  if (!room) return;
  broadcastToRoom(room, socketMap, () => ({
    type: 'LOBBY_UPDATE',
    roomCode: room.roomCode,
    playerCount: room.playerCount,
    hostPlayerId: room.hostPlayerId,
    seats: room.seats,
  }));
}

/**
 * Broadcasts personalized sanitized game state to all room participants.
 */
export function broadcastGameState(
  room: Room,
  socketMap: Map<string, WebSocket>,
  lastActionError?: string
): void {
  if (!room) return;
  broadcastToRoom(room, socketMap, (playerId) => {
    const sanitized = GameCoordinator.getSanitizedStateForPlayer(room, playerId);
    if (!sanitized) return null;
    return {
      type: 'STATE_UPDATE',
      state: sanitized,
      ...(lastActionError ? { lastActionError } : {}),
    };
  });
}

/**
 * Starts the authoritative Pukar HTTP + WebSocket game server.
 */
export function startServer(
  port: number = 3001,
  options?: ServerOptions
): Promise<ServerInstance> {
  return new Promise((resolve, reject) => {
    try {
      const manager = options?.roomManager || new RoomManager();
      const sockets = new Map<string, WebSocket>();

      const server = http.createServer((req, res) => {
        try {
          if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
            return;
          }
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        } catch (httpErr) {
          serverLogger.error('Error handling HTTP request', { error: httpErr });
          res.writeHead(500);
          res.end();
        }
      });

      const wss = new WebSocketServer({ server });

      // Heartbeat configuration
      const heartbeatIntervalMs = options?.heartbeatIntervalMs ?? 30000;
      const heartbeatTimer = setInterval(() => {
        try {
          for (const client of wss.clients) {
            try {
              const extWs = client as ExtWebSocket;
              if (extWs.isAlive === false) {
                serverLogger.warn(`Terminating stale socket connection: ${extWs.socketId}`);
                client.terminate();
                continue;
              }
              extWs.isAlive = false;
              if (client.readyState === WebSocket.OPEN) {
                client.ping();
              }
            } catch (clientErr) {
              serverLogger.error('Error during heartbeat check for client socket', { error: clientErr });
            }
          }
        } catch (timerErr) {
          serverLogger.error('Error during heartbeat interval execution', { error: timerErr });
        }
      }, heartbeatIntervalMs);

      // Prevent timer from keeping Node process alive if no active handles remain
      heartbeatTimer.unref?.();

      wss.on('connection', (rawWs: WebSocket) => {
        const ws = rawWs as ExtWebSocket;
        const socketId = `sock_${crypto.randomUUID().slice(0, 8)}`;
        ws.socketId = socketId;
        ws.isAlive = true;
        sockets.set(socketId, ws);

        serverLogger.info(`Client connected: ${socketId}`, { socketId });

        ws.on('pong', () => {
          ws.isAlive = true;
        });

        ws.on('message', (raw) => {
          try {
            let msg: ClientMessage;
            try {
              msg = JSON.parse(raw.toString()) as ClientMessage;
            } catch (parseErr) {
              serverLogger.error('Error parsing client message JSON', { socketId, error: parseErr });
              safeSend(ws, {
                type: 'ERROR',
                message: 'Malformed message',
                code: 'PARSE_ERROR',
              });
              return;
            }

            if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
              serverLogger.error('Invalid message structure received', { socketId });
              safeSend(ws, {
                type: 'ERROR',
                message: 'Invalid message structure',
                code: 'INVALID_FORMAT',
              });
              return;
            }

            switch (msg.type) {
              case 'CREATE_ROOM': {
                if (
                  !msg.playerName ||
                  typeof msg.playerName !== 'string' ||
                  !msg.playerName.trim() ||
                  (msg.playerCount !== 4 && msg.playerCount !== 6)
                ) {
                  safeSend(ws, {
                    type: 'ERROR',
                    message: 'Invalid CREATE_ROOM payload: requires playerName and playerCount 4 or 6',
                    code: 'INVALID_PAYLOAD',
                  });
                  return;
                }

                // If this socket was already associated with another room, notify that room
                const prevRoom = manager.getRoomBySocket(socketId);
                if (prevRoom) {
                  const dis = manager.handleDisconnect(socketId);
                  if (dis.found && dis.roomCode) {
                    const oldRoom = manager.getRoom(dis.roomCode);
                    if (oldRoom) {
                      if (oldRoom.status === 'LOBBY') {
                        broadcastLobby(oldRoom, sockets);
                      } else if (dis.seatIndex !== null && dis.seatIndex !== undefined) {
                        broadcastToRoom(oldRoom, sockets, () => ({
                          type: 'PLAYER_CONNECTION_CHANGED',
                          seatIndex: dis.seatIndex!,
                          playerName: dis.playerName || 'Player',
                          isConnected: false,
                        }));
                      }
                    }
                  }
                }

                const { room, session } = manager.createRoom(
                  msg.playerName,
                  msg.playerCount,
                  socketId
                );

                safeSend(ws, {
                  type: 'ROOM_JOINED',
                  roomCode: room.roomCode,
                  playerId: session.playerId,
                  sessionToken: session.sessionToken,
                  isHost: true,
                  seatIndex: session.seatIndex,
                });

                broadcastLobby(room, sockets);
                break;
              }

              case 'JOIN_ROOM': {
                if (!msg.roomCode || typeof msg.roomCode !== 'string' || !msg.roomCode.trim()) {
                  safeSend(ws, {
                    type: 'ERROR',
                    message: 'Missing or invalid roomCode',
                    code: 'INVALID_PAYLOAD',
                  });
                  return;
                }

                const cleanCode = msg.roomCode.trim().toUpperCase();

                // If this socket was already in a different room, notify the old room
                const prevRoom = manager.getRoomBySocket(socketId);
                if (prevRoom && prevRoom.roomCode !== cleanCode) {
                  const dis = manager.handleDisconnect(socketId);
                  if (dis.found && dis.roomCode) {
                    const oldRoom = manager.getRoom(dis.roomCode);
                    if (oldRoom) {
                      if (oldRoom.status === 'LOBBY') {
                        broadcastLobby(oldRoom, sockets);
                      } else if (dis.seatIndex !== null && dis.seatIndex !== undefined) {
                        broadcastToRoom(oldRoom, sockets, () => ({
                          type: 'PLAYER_CONNECTION_CHANGED',
                          seatIndex: dis.seatIndex!,
                          playerName: dis.playerName || 'Player',
                          isConnected: false,
                        }));
                      }
                    }
                  }
                }

                // Check for ghost socket to terminate upon token reconnection
                const targetRoom = manager.getRoom(cleanCode);
                let ghostSocketToTerminate: WebSocket | undefined;
                if (targetRoom && msg.sessionToken) {
                  const existingPId = targetRoom.tokenToPlayerId.get(msg.sessionToken);
                  if (existingPId) {
                    const existingSess = targetRoom.sessions.get(existingPId);
                    if (existingSess && existingSess.socketId && existingSess.socketId !== socketId) {
                      ghostSocketToTerminate = sockets.get(existingSess.socketId);
                    }
                  }
                }

                const res = manager.joinRoom(
                  msg.roomCode,
                  msg.playerName || 'Player',
                  socketId,
                  msg.sessionToken
                );

                if (!res.success) {
                  safeSend(ws, {
                    type: 'ERROR',
                    message: res.error,
                    code: 'JOIN_FAILED',
                  });
                  return;
                }

                // Cleanly terminate replaced ghost socket if any
                if (ghostSocketToTerminate && ghostSocketToTerminate !== ws) {
                  try {
                    ghostSocketToTerminate.terminate();
                  } catch {
                    // Safe fallback
                  }
                }

                const { room, session, isReconnect } = res;

                safeSend(ws, {
                  type: 'ROOM_JOINED',
                  roomCode: room.roomCode,
                  playerId: session.playerId,
                  sessionToken: session.sessionToken,
                  isHost: room.hostPlayerId === session.playerId,
                  seatIndex: session.seatIndex,
                });

                if (room.status === 'LOBBY') {
                  broadcastLobby(room, sockets);
                } else if (isReconnect) {
                  // Mid-game reconnect: send current sanitized state immediately
                  const sanitized = GameCoordinator.getSanitizedStateForPlayer(room, session.playerId);
                  if (sanitized) {
                    safeSend(ws, {
                      type: 'STATE_UPDATE',
                      state: sanitized,
                    });
                  }

                  // Broadcast connection status to other seated players
                  if (session.seatIndex !== null) {
                    broadcastToRoom(room, sockets, () => ({
                      type: 'PLAYER_CONNECTION_CHANGED',
                      seatIndex: session.seatIndex!,
                      playerName: session.playerName,
                      isConnected: true,
                    }));
                  }
                }
                break;
              }

              case 'SELECT_SEAT': {
                const room = manager.getRoomBySocket(socketId);
                const session = manager.getSessionBySocket(socketId);
                if (!room || !session) {
                  safeSend(ws, {
                    type: 'ERROR',
                    message: 'Not in a room',
                    code: 'NOT_IN_ROOM',
                  });
                  return;
                }

                const claim = manager.claimSeat(room.roomCode, session.playerId, msg.seatIndex);
                if (claim.success) {
                  broadcastLobby(room, sockets);
                } else {
                  safeSend(ws, {
                    type: 'ACTION_REJECTED',
                    error: claim.error || 'Seat error',
                  });
                }
                break;
              }

              case 'START_GAME': {
                const room = manager.getRoomBySocket(socketId);
                const session = manager.getSessionBySocket(socketId);
                if (!room || !session) {
                  safeSend(ws, {
                    type: 'ERROR',
                    message: 'Not in a room',
                    code: 'NOT_IN_ROOM',
                  });
                  return;
                }

                if (room.hostPlayerId !== session.playerId) {
                  safeSend(ws, {
                    type: 'ACTION_REJECTED',
                    error: 'Only the host can start the game',
                  });
                  return;
                }

                const canStartCheck = GameCoordinator.canStartGame(room);
                if (!canStartCheck.canStart) {
                  safeSend(ws, {
                    type: 'ACTION_REJECTED',
                    error: canStartCheck.reason || 'Cannot start game until all seats are filled',
                  });
                  return;
                }

                const started = GameCoordinator.startGame(room);
                if (!started) {
                  safeSend(ws, {
                    type: 'ACTION_REJECTED',
                    error: 'Cannot start game until all seats are filled',
                  });
                  return;
                }

                broadcastToRoom(room, sockets, (pId) => {
                  const s = room.sessions.get(pId);
                  if (!s || s.seatIndex === null || s.seatIndex === undefined) return null;
                  const sanitized = GameCoordinator.getSanitizedStateForPlayer(room, pId);
                  if (!sanitized) return null;
                  return {
                    type: 'GAME_STARTED',
                    state: sanitized,
                    mySeatIndex: s.seatIndex,
                    myPlayerId: pId,
                  };
                });
                break;
              }

              case 'GAME_ACTION': {
                const room = manager.getRoomBySocket(socketId);
                const session = manager.getSessionBySocket(socketId);
                if (!room || !session) {
                  safeSend(ws, {
                    type: 'ERROR',
                    message: 'Not in a room',
                    code: 'NOT_IN_ROOM',
                  });
                  return;
                }

                if (!msg.action) {
                  safeSend(ws, {
                    type: 'ERROR',
                    message: 'Missing action payload',
                    code: 'INVALID_PAYLOAD',
                  });
                  return;
                }

                const result = GameCoordinator.handleAction(room, session.playerId, msg.action);
                if (!result.success) {
                  safeSend(ws, {
                    type: 'ACTION_REJECTED',
                    error: result.error || 'Action rejected',
                  });
                  return;
                }

                broadcastGameState(room, sockets);
                break;
              }

              case 'KICK_PLAYER': {
                const room = manager.getRoomBySocket(socketId);
                const session = manager.getSessionBySocket(socketId);
                if (!room || !session) {
                  safeSend(ws, {
                    type: 'ERROR',
                    message: 'Not in a room',
                    code: 'NOT_IN_ROOM',
                  });
                  return;
                }

                if (room.hostPlayerId !== session.playerId) {
                  safeSend(ws, {
                    type: 'ACTION_REJECTED',
                    error: 'Only the host can kick players',
                  });
                  return;
                }

                const kicked = manager.kickPlayer(room.roomCode, session.playerId, msg.seatIndex);
                if (kicked) {
                  broadcastLobby(room, sockets);
                } else {
                  safeSend(ws, {
                    type: 'ACTION_REJECTED',
                    error: 'Unable to kick player from seat',
                  });
                }
                break;
              }

              case 'LEAVE_ROOM': {
                const room = manager.getRoomBySocket(socketId);
                const session = manager.getSessionBySocket(socketId);
                if (!room || !session) {
                  safeSend(ws, {
                    type: 'ERROR',
                    message: 'Not in a room',
                    code: 'NOT_IN_ROOM',
                  });
                  return;
                }

                const roomCode = room.roomCode;
                const wasInLobby = room.status === 'LOBBY';
                const seatIndex = session.seatIndex;
                const playerName = session.playerName;
                const left = manager.leaveRoom(roomCode, session.playerId);
                if (left) {
                  const updatedRoom = manager.getRoom(roomCode);
                  if (updatedRoom) {
                    if (wasInLobby) {
                      broadcastLobby(updatedRoom, sockets);
                    } else if (seatIndex !== null && seatIndex !== undefined) {
                      broadcastToRoom(updatedRoom, sockets, () => ({
                        type: 'PLAYER_CONNECTION_CHANGED',
                        seatIndex,
                        playerName,
                        isConnected: false,
                      }));
                    }
                  }
                }
                break;
              }

              default: {
                serverLogger.warn(`Unhandled message type: ${(msg as any).type}`, { socketId });
                safeSend(ws, {
                  type: 'ERROR',
                  message: `Unknown message type: ${(msg as any).type}`,
                  code: 'UNKNOWN_TYPE',
                });
                break;
              }
            }
          } catch (msgErr) {
            serverLogger.error('Error handling WebSocket message', { socketId, error: msgErr });
            safeSend(ws, {
              type: 'ERROR',
              message: 'Internal server error processing message',
              code: 'INTERNAL_ERROR',
            });
          }
        });

        ws.on('close', () => {
          try {
            sockets.delete(socketId);
            const dis = manager.handleDisconnect(socketId);
            if (dis.found && dis.roomCode) {
              const room = manager.getRoom(dis.roomCode);
              if (room) {
                if (room.status === 'LOBBY') {
                  broadcastLobby(room, sockets);
                } else {
                  if (dis.seatIndex !== null && dis.seatIndex !== undefined) {
                    broadcastToRoom(room, sockets, () => ({
                      type: 'PLAYER_CONNECTION_CHANGED',
                      seatIndex: dis.seatIndex!,
                      playerName: dis.playerName || 'Player',
                      isConnected: false,
                    }));
                  }
                }
              }
            }
          } catch (closeErr) {
            serverLogger.error('Error handling socket disconnect', { socketId, error: closeErr });
          }
        });

        ws.on('error', (wsErr) => {
          serverLogger.error('WebSocket client error', { socketId, error: wsErr });
        });
      });

      wss.on('error', (wssErr) => {
        serverLogger.error('WebSocketServer encountered an error', { error: wssErr });
      });

      server.on('error', (serverErr) => {
        serverLogger.error('HTTP Server encountered an error', { error: serverErr });
        reject(serverErr);
      });

      server.listen(port, () => {
        const addr = server.address();
        const actualPort = typeof addr === 'object' && addr !== null ? addr.port : port;
        serverLogger.info(`Pukar WebSocket Server listening on port ${actualPort}`);

        resolve({
          server,
          wss,
          port: actualPort,
          roomManager: manager,
          close: () =>
            new Promise<void>((resolveClose) => {
              if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
              }

              // Terminate all connected clients
              for (const ws of sockets.values()) {
                try {
                  ws.terminate();
                } catch {
                  // Safe fallback
                }
              }
              sockets.clear();

              wss.close(() => {
                if (typeof (server as any).closeAllConnections === 'function') {
                  try {
                    (server as any).closeAllConnections();
                  } catch {
                    // Safe fallback
                  }
                }
                server.close(() => {
                  resolveClose();
                });
              });
            }),
        });
      });
    } catch (startErr) {
      serverLogger.error('Fatal error starting server', { error: startErr });
      reject(startErr);
    }
  });
}

// Standalone runner
if (
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))
) {
  const port = Number(process.env.PORT) || 3001;
  startServer(port)
    .then(({ port: actualPort }) => {
      serverLogger.info(`Pukar WebSocket Server running standalone on port ${actualPort}`);
    })
    .catch((err) => {
      serverLogger.error('Failed to start standalone server', { error: err });
      process.exit(1);
    });
}
