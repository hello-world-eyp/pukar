import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import { RoomManager } from './room-manager';
import { GameCoordinator } from './game-coordinator';
import { serverLogger } from './logger';
import { ClientMessage, ServerMessage, Room } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveFilePathCaseInsensitive(baseDir: string, relativePath: string): string | null {
  try {
    const segments = relativePath.split(/[/\\]+/).filter(Boolean);
    let currentDir = baseDir;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (!fs.existsSync(currentDir) || !fs.statSync(currentDir).isDirectory()) {
        return null;
      }

      const exactPath = path.join(currentDir, segment);
      if (fs.existsSync(exactPath)) {
        currentDir = exactPath;
        continue;
      }

      // Try case-insensitive match
      const entries = fs.readdirSync(currentDir);
      const match = entries.find((e) => e.toLowerCase() === segment.toLowerCase());
      if (match) {
        currentDir = path.join(currentDir, match);
      } else {
        return null;
      }
    }

    return currentDir;
  } catch {
    return null;
  }
}

function serveStaticFile(reqPath: string, res: http.ServerResponse): boolean {
  try {
    if (!fs.existsSync(distDir)) return false;

    const safePath = path.normalize(decodeURIComponent(reqPath)).replace(/^(\.\.[\/\\])+/, '');
    let targetPath = path.join(distDir, safePath);

    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      targetPath = path.join(targetPath, 'index.html');
    }

    if (!fs.existsSync(targetPath)) {
      const resolved = resolveFilePathCaseInsensitive(distDir, safePath);
      if (resolved) {
        targetPath = resolved;
      }
    }

    if (!fs.existsSync(targetPath)) {
      if (reqPath.startsWith('/cards/') || reqPath.startsWith('/assets/')) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return true;
      }
      targetPath = path.join(distDir, 'index.html');
    }

    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      const ext = path.extname(targetPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = fs.readFileSync(targetPath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': content.length,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      });
      res.end(content);
      return true;
    }
  } catch (err) {
    serverLogger.error('Error serving static file', { error: err });
  }
  return false;
}


interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
  socketId: string;
  msgCount: number;
  windowStart: number;
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
  cleanupIntervalMs?: number;
  roomMaxIdleMs?: number;
  maxPayloadBytes?: number;
  allowedOrigins?: string[];
  rateLimitMaxMessages?: number;
  rateLimitWindowMs?: number;
  roomManager?: RoomManager;
  serveStatic?: boolean;
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

          if (options?.serveStatic) {
            const urlPath = req.url?.split('?')[0] || '/';
            if (serveStaticFile(urlPath, res)) {
              return;
            }
          }

          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        } catch (httpErr) {
          serverLogger.error('Error handling HTTP request', { error: httpErr });
          res.writeHead(500);
          res.end();
        }
      });

      const maxPayload = options?.maxPayloadBytes ?? 64 * 1024;
      const wss = new WebSocketServer({ server, maxPayload });

      // Stale room garbage collection timer
      const cleanupIntervalMs = options?.cleanupIntervalMs ?? 60000;
      const roomMaxIdleMs = options?.roomMaxIdleMs ?? 15 * 60 * 1000;
      const cleanupTimer = setInterval(() => {
        try {
          const cleaned = manager.cleanupStaleRooms(roomMaxIdleMs);
          if (cleaned.length > 0) {
            serverLogger.info(`Cleaned up ${cleaned.length} stale rooms`, { roomCodes: cleaned });
          }
        } catch (cleanupErr) {
          serverLogger.error('Error during room cleanup timer', { error: cleanupErr });
        }
      }, cleanupIntervalMs);
      cleanupTimer.unref?.();

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

      // Lobby host migration check timer (migrates host if host disconnected in lobby > 30s)
      const hostMigrationTimer = setInterval(() => {
        try {
          const migrated = manager.checkLobbyHostMigration(30000);
          for (const item of migrated) {
            const room = manager.getRoom(item.roomCode);
            if (room) {
              broadcastLobby(room, sockets);
            }
          }
        } catch (migErr) {
          serverLogger.error('Error during lobby host migration timer', { error: migErr });
        }
      }, 5000);
      hostMigrationTimer.unref?.();

      wss.on('connection', (rawWs: WebSocket, req: http.IncomingMessage) => {

        // Origin validation check if configured
        if (options?.allowedOrigins && options.allowedOrigins.length > 0) {
          const origin = req.headers.origin;
          if (origin && !options.allowedOrigins.includes(origin)) {
            serverLogger.warn(`Connection rejected: unauthorized origin ${origin}`, { origin });
            rawWs.close(4403, 'Forbidden origin');
            return;
          }
        }

        const ws = rawWs as ExtWebSocket;
        const socketId = `sock_${crypto.randomUUID().slice(0, 8)}`;
        ws.socketId = socketId;
        ws.isAlive = true;
        ws.msgCount = 0;
        ws.windowStart = Date.now();
        sockets.set(socketId, ws);

        ws.on('error', (err) => {
          serverLogger.error(`Socket error on ${socketId}`, { socketId, error: err });
        });

        serverLogger.info(`Client connected: ${socketId}`, { socketId });

        ws.on('pong', () => {
          ws.isAlive = true;
        });

        ws.on('message', (raw) => {
          try {
            // Rate limiting check
            const now = Date.now();
            const rateLimitWindowMs = options?.rateLimitWindowMs ?? 2000;
            const maxMessages = options?.rateLimitMaxMessages ?? 50;

            if (now - ws.windowStart > rateLimitWindowMs) {
              ws.windowStart = now;
              ws.msgCount = 1;
            } else {
              ws.msgCount++;
              if (ws.msgCount > maxMessages) {
                serverLogger.warn(`Rate limit exceeded for socket: ${socketId}`, { socketId, count: ws.msgCount });
                safeSend(ws, {
                  type: 'ERROR',
                  message: 'Rate limit exceeded: too many requests',
                  code: 'RATE_LIMITED',
                });
                return;
              }
            }
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
                    code: (res as any).code || 'JOIN_FAILED',
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

                  // Inform reconnecting player of any other seated players who are currently disconnected
                  for (const seat of room.seats) {
                    if (seat.seatIndex !== session.seatIndex && seat.playerId && !seat.isConnected) {
                      safeSend(ws, {
                        type: 'PLAYER_CONNECTION_CHANGED',
                        seatIndex: seat.seatIndex,
                        playerName: seat.playerName || 'Player',
                        isConnected: false,
                      });
                    }
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

              case 'END_GAME': {
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
                    error: 'Only the host can end the game',
                  });
                  return;
                }

                const roomCode = room.roomCode;
                serverLogger.info('Host ended game and closed room', {
                  roomCode,
                  hostPlayerId: session.playerId,
                });

                // Notify all connected sessions in the room that the game has ended
                broadcastToRoom(room, sockets, () => ({
                  type: 'ERROR',
                  message: 'The host has ended the game',
                  code: 'ROOM_CLOSED',
                }));

                // Destroy room and remove from active rooms
                manager.destroyRoom(roomCode);
                break;
              }

              case 'PING': {
                ws.isAlive = true;
                const room = manager.getRoomBySocket(socketId);
                if (room) {
                  manager.touchRoom(room.roomCode);
                }
                safeSend(ws, {
                  type: 'PONG',
                  timestamp: Date.now(),
                });
                break;
              }

              case 'CLAIM_HOST': {
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

                const claimRes = manager.claimHost(room.roomCode, session.playerId);
                if (claimRes.success) {
                  broadcastLobby(room, sockets);
                } else {
                  safeSend(ws, {
                    type: 'ACTION_REJECTED',
                    error: claimRes.error || 'Cannot claim host',
                  });
                }
                break;
              }

              case 'VOICE_SIGNAL': {
                const room = manager.getRoomBySocket(socketId);
                const session = manager.getSessionBySocket(socketId);
                if (!room || !session) {
                  return;
                }
                if (!msg.targetPlayerId || !msg.signal) {
                  return;
                }
                const targetSession = room.sessions.get(msg.targetPlayerId);
                if (targetSession && targetSession.isConnected) {
                  const targetWs = sockets.get(targetSession.socketId);
                  if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    safeSend(targetWs, {
                      type: 'VOICE_SIGNAL',
                      fromPlayerId: session.playerId,
                      signal: msg.signal,
                    });
                  }
                }
                break;
              }

              case 'VOICE_STATE_UPDATE': {
                const room = manager.getRoomBySocket(socketId);
                const session = manager.getSessionBySocket(socketId);
                if (!room || !session) {
                  return;
                }
                if (!room.voiceLocks) room.voiceLocks = new Set();
                if (!room.voiceStates) room.voiceStates = new Map();

                const isLocked = room.voiceLocks.has(session.playerId);
                const effectiveMuted = isLocked ? true : Boolean(msg.isMuted);

                room.voiceStates.set(session.playerId, {
                  isMuted: effectiveMuted,
                  isHardMuted: isLocked,
                  isSpeaking: effectiveMuted ? false : Boolean(msg.isSpeaking),
                });

                broadcastToRoom(room, sockets, () => ({
                  type: 'VOICE_STATE_CHANGED',
                  playerId: session.playerId,
                  isMuted: effectiveMuted,
                  isHardMuted: isLocked,
                  isSpeaking: effectiveMuted ? false : Boolean(msg.isSpeaking),
                }));
                break;
              }

              case 'ADMIN_MUTE_PLAYER': {
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
                    error: 'Only the room host can moderate voice chat',
                  });
                  return;
                }

                if (!msg.targetPlayerId) {
                  safeSend(ws, {
                    type: 'ERROR',
                    message: 'Missing targetPlayerId',
                    code: 'INVALID_PAYLOAD',
                  });
                  return;
                }

                const targetSession = room.sessions.get(msg.targetPlayerId);
                if (!targetSession) {
                  safeSend(ws, {
                    type: 'ERROR',
                    message: 'Target player not found in room',
                    code: 'PLAYER_NOT_FOUND',
                  });
                  return;
                }

                const voiceLocks = room.voiceLocks || (room.voiceLocks = new Set<string>());
                const voiceStates = room.voiceStates || (room.voiceStates = new Map());

                const targetWs = sockets.get(targetSession.socketId);

                if (msg.muteType === 'TEMP') {
                  if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    safeSend(targetWs, {
                      type: 'VOICE_FORCE_MUTED',
                      muteType: 'TEMP',
                    });
                  }
                  voiceStates.set(msg.targetPlayerId, {
                    isMuted: true,
                    isHardMuted: voiceLocks.has(msg.targetPlayerId),
                    isSpeaking: false,
                  });
                  broadcastToRoom(room, sockets, () => ({
                    type: 'VOICE_STATE_CHANGED',
                    playerId: msg.targetPlayerId,
                    isMuted: true,
                    isHardMuted: voiceLocks.has(msg.targetPlayerId),
                    isSpeaking: false,
                  }));
                } else if (msg.muteType === 'HARD') {
                  voiceLocks.add(msg.targetPlayerId);
                  if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    safeSend(targetWs, {
                      type: 'VOICE_FORCE_MUTED',
                      muteType: 'HARD',
                    });
                  }
                  voiceStates.set(msg.targetPlayerId, {
                    isMuted: true,
                    isHardMuted: true,
                    isSpeaking: false,
                  });
                  broadcastToRoom(room, sockets, () => ({
                    type: 'VOICE_STATE_CHANGED',
                    playerId: msg.targetPlayerId,
                    isMuted: true,
                    isHardMuted: true,
                    isSpeaking: false,
                  }));
                } else if (msg.muteType === 'UNMUTE') {
                  voiceLocks.delete(msg.targetPlayerId);
                  if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    safeSend(targetWs, {
                      type: 'VOICE_FORCE_UNMUTED',
                    });
                  }
                  voiceStates.set(msg.targetPlayerId, {
                    isMuted: false,
                    isHardMuted: false,
                    isSpeaking: false,
                  });
                  broadcastToRoom(room, sockets, () => ({
                    type: 'VOICE_STATE_CHANGED',
                    playerId: msg.targetPlayerId,
                    isMuted: false,
                    isHardMuted: false,
                    isSpeaking: false,
                  }));
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
              if (cleanupTimer) {
                clearInterval(cleanupTimer);
              }
              if (hostMigrationTimer) {
                clearInterval(hostMigrationTimer);
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
  startServer(port, { serveStatic: true })
    .then(({ port: actualPort }) => {
      serverLogger.info(`Pukar Web & WebSocket Server running on port ${actualPort}`);
    })
    .catch((err) => {
      serverLogger.error('Failed to start standalone server', { error: err });
      process.exit(1);
    });
}
