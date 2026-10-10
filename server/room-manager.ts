import crypto from 'crypto';
import { LobbySeat, PlayerSession, Room } from './types';
import { serverLogger } from './logger';

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
  playerId?: string;
  seatIndex?: number | null;
  playerName?: string;
}

/**
 * Sanitizes and trims player names, stripping control characters and enforcing a max length of 24 chars.
 */
export function sanitizePlayerName(rawName: unknown, defaultFallback: string = 'Player'): string {
  if (typeof rawName !== 'string') return defaultFallback;
  const clean = rawName.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 24);
  return clean || defaultFallback;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private socketToPlayer: Map<string, { roomCode: string; playerId: string }> = new Map();

  /**
   * Generates a 4-character uppercase alphanumeric code.
   * Excludes visually ambiguous characters: I, 1, O, 0.
   * Deterministically falls back within the valid character space if random attempts collide.
   */
  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempts = 0; attempts < 1000; attempts++) {
      let code = '';
      for (let i = 0; i < 4; i++) {
        const randIndex = crypto.randomInt(0, chars.length);
        code += chars.charAt(randIndex);
      }
      if (!this.rooms.has(code)) {
        return code;
      }
    }

    // Deterministic search through valid character space if random attempts collide
    for (let i = 0; i < chars.length; i++) {
      for (let j = 0; j < chars.length; j++) {
        for (let k = 0; k < chars.length; k++) {
          for (let l = 0; l < chars.length; l++) {
            const code = `${chars[i]}${chars[j]}${chars[k]}${chars[l]}`;
            if (!this.rooms.has(code)) {
              return code;
            }
          }
        }
      }
    }

    throw new Error('Room namespace exhausted: all 4-character codes in use');
  }

  /**
   * Creates a new room in LOBBY status with alternating seats (A, B, A, B...)
   * Assigns the host to seat 0 with host credentials and sessionToken.
   * Cleans up any prior socket mapping to prevent ghost connections.
   */
  public createRoom(
    hostName: string,
    playerCount: 4 | 6,
    socketId: string
  ): { room: Room; session: PlayerSession } {
    try {
      if (playerCount !== 4 && playerCount !== 6) {
        throw new Error('Player count must be 4 or 6');
      }

      // Clean up previous socket mapping to prevent ghost connections
      if (this.socketToPlayer.has(socketId)) {
        this.handleDisconnect(socketId);
      }

      const cleanHostName = sanitizePlayerName(hostName, 'Host');
      const roomCode = this.generateRoomCode();
      const hostId = `p_${crypto.randomUUID().slice(0, 8)}`;
      const sessionToken = crypto.randomUUID();

      const seats: LobbySeat[] = Array.from({ length: playerCount }).map((_, index) => ({
        seatIndex: index,
        playerId: index === 0 ? hostId : null,
        playerName: index === 0 ? cleanHostName : null,
        team: index % 2 === 0 ? 'A' : 'B',
        isConnected: index === 0,
        isHost: index === 0,
      }));

      const hostSession: PlayerSession = {
        playerId: hostId,
        playerName: cleanHostName,
        sessionToken,
        socketId,
        roomCode,
        seatIndex: 0,
        isConnected: true,
      };

      const now = Date.now();
      const room: Room = {
        roomCode,
        playerCount,
        status: 'LOBBY',
        hostPlayerId: hostId,
        createdAt: now,
        lastActivityAt: now,
        seats,
        sessions: new Map([[hostId, hostSession]]),
        tokenToPlayerId: new Map([[sessionToken, hostId]]),
        gameState: null,
      };

      this.rooms.set(roomCode, room);
      this.socketToPlayer.set(socketId, { roomCode, playerId: hostId });

      serverLogger.info('Room created successfully', { roomCode, playerId: hostId });
      return { room, session: hostSession };
    } catch (err) {
      serverLogger.error('Failed to create room', { error: err });
      throw err;
    }
  }

  /**
   * Joins an existing room.
   * If sessionToken matches an existing session in the room, rebinds the player's socket
   * and marks the session and occupied seat as connected.
   */
  public joinRoom(
    roomCode: string,
    playerName: string,
    socketId: string,
    sessionToken?: string
  ): JoinRoomResult {
    try {
      if (!roomCode || typeof roomCode !== 'string') {
        return { success: false, error: 'Room code is required' };
      }

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
          // If this socket was bound to a different room/player, clean it up first
          const existing = this.socketToPlayer.get(socketId);
          if (existing && (existing.roomCode !== cleanCode || existing.playerId !== playerId)) {
            this.handleDisconnect(socketId);
          }

          if (session.socketId && session.socketId !== socketId) {
            this.socketToPlayer.delete(session.socketId);
          }
          session.socketId = socketId;
          session.isConnected = true;
          this.socketToPlayer.set(socketId, { roomCode: cleanCode, playerId });

          if (session.seatIndex !== null && room.seats[session.seatIndex]) {
            room.seats[session.seatIndex].isConnected = true;
          }

          serverLogger.info('Player reconnected via token', {
            roomCode: cleanCode,
            playerId,
          });
          return { success: true, room, session, isReconnect: true };
        }
      }

      // New player cannot join if game has already started
      if (room.status !== 'LOBBY') {
        return { success: false, error: 'Game is already in progress' };
      }

      // If this socket was bound elsewhere, clean up before binding new player
      if (this.socketToPlayer.has(socketId)) {
        this.handleDisconnect(socketId);
      }

      // New player joining lobby
      const newPlayerId = `p_${crypto.randomUUID().slice(0, 8)}`;
      const newToken = crypto.randomUUID();
      const cleanName = sanitizePlayerName(playerName, 'Player');

      const newSession: PlayerSession = {
        playerId: newPlayerId,
        playerName: cleanName,
        sessionToken: newToken,
        socketId,
        roomCode: cleanCode,
        seatIndex: null,
        isConnected: true,
      };

      room.sessions.set(newPlayerId, newSession);
      room.tokenToPlayerId.set(newToken, newPlayerId);
      room.lastActivityAt = Date.now();
      this.socketToPlayer.set(socketId, { roomCode: cleanCode, playerId: newPlayerId });

      serverLogger.info('New player joined room', { roomCode: cleanCode, playerId: newPlayerId });
      return { success: true, room, session: newSession, isReconnect: false };
    } catch (err) {
      serverLogger.error('Error joining room', { roomCode, error: err });
      return { success: false, error: 'Internal error joining room' };
    }
  }

  /**
   * Claims a seat for a player.
   * If the player already occupied any seat, vacates that seat first.
   */
  public claimSeat(roomCode: string, playerId: string, seatIndex: number): ClaimSeatResult {
    try {
      if (!roomCode || typeof roomCode !== 'string') {
        return { success: false, error: 'Room code is required' };
      }

      const cleanCode = roomCode.trim().toUpperCase();
      const room = this.rooms.get(cleanCode);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      if (room.status !== 'LOBBY') {
        return { success: false, error: 'Cannot change seats while game is in progress' };
      }

      if (
        typeof seatIndex !== 'number' ||
        !Number.isInteger(seatIndex) ||
        seatIndex < 0 ||
        seatIndex >= room.seats.length
      ) {
        return { success: false, error: 'Invalid seat index' };
      }

      const session = room.sessions.get(playerId);
      if (!session) {
        return { success: false, error: 'Player session not found' };
      }

      // Idempotent: already in this seat
      if (session.seatIndex === seatIndex) {
        return { success: true };
      }

      const targetSeat = room.seats[seatIndex];
      if (targetSeat.playerId && targetSeat.playerId !== playerId) {
        return { success: false, error: 'Seat is already occupied' };
      }

      // Vacate any previously occupied seat(s) for this player
      for (const seat of room.seats) {
        if (seat.seatIndex !== seatIndex && seat.playerId === playerId) {
          seat.playerId = null;
          seat.playerName = null;
          seat.isConnected = false;
          seat.isHost = false;
        }
      }

      // Occupy target seat
      targetSeat.playerId = playerId;
      targetSeat.playerName = session.playerName;
      targetSeat.isConnected = session.isConnected;
      targetSeat.isHost = room.hostPlayerId === playerId;
      session.seatIndex = seatIndex;
      room.lastActivityAt = Date.now();

      serverLogger.info(`Player claimed seat ${seatIndex}`, { roomCode: cleanCode, playerId });
      return { success: true };
    } catch (err) {
      serverLogger.error('Error claiming seat', { roomCode, playerId, error: err });
      return { success: false, error: 'Error claiming seat' };
    }
  }

  /**
   * Alias for claimSeat returning a boolean status, matching spec Section 4.2.
   */
  public assignSeat(roomCode: string, playerId: string, seatIndex: number): boolean {
    return this.claimSeat(roomCode, playerId, seatIndex).success;
  }

  /**
   * Vacates a player's seat without removing them from the room sessions.
   */
  public vacateSeat(roomCode: string, playerId: string): boolean {
    try {
      if (!roomCode || typeof roomCode !== 'string' || !playerId) {
        return false;
      }

      const cleanCode = roomCode.trim().toUpperCase();
      const room = this.rooms.get(cleanCode);
      if (!room || room.status !== 'LOBBY') {
        return false;
      }

      const session = room.sessions.get(playerId);
      if (!session || session.seatIndex === null) {
        return false;
      }

      for (const seat of room.seats) {
        if (seat.playerId === playerId) {
          seat.playerId = null;
          seat.playerName = null;
          seat.isConnected = false;
          seat.isHost = false;
        }
      }

      session.seatIndex = null;
      serverLogger.info('Player vacated seat', { roomCode: cleanCode, playerId });
      return true;
    } catch (err) {
      serverLogger.error('Error vacating seat', { roomCode, playerId, error: err });
      return false;
    }
  }

  /**
   * Host privilege: kicks a player from a seat in the lobby.
   * Vacates the seat and unseats the player's session.
   */
  public kickPlayer(roomCode: string, hostPlayerId: string, seatIndex: number): boolean {
    try {
      if (!roomCode || typeof roomCode !== 'string' || !hostPlayerId) {
        return false;
      }

      const cleanCode = roomCode.trim().toUpperCase();
      const room = this.rooms.get(cleanCode);
      if (!room || room.status !== 'LOBBY' || room.hostPlayerId !== hostPlayerId) {
        return false;
      }

      if (
        typeof seatIndex !== 'number' ||
        !Number.isInteger(seatIndex) ||
        seatIndex < 0 ||
        seatIndex >= room.seats.length
      ) {
        return false;
      }

      const seat = room.seats[seatIndex];
      if (!seat || !seat.playerId || seat.playerId === hostPlayerId) {
        return false;
      }

      const kickedPlayerId = seat.playerId;
      seat.playerId = null;
      seat.playerName = null;
      seat.isConnected = false;
      seat.isHost = false;

      const session = room.sessions.get(kickedPlayerId);
      if (session) {
        session.seatIndex = null;
      }

      serverLogger.info(`Host kicked seat ${seatIndex}`, {
        roomCode: cleanCode,
        hostPlayerId,
        kickedPlayerId,
      });
      return true;
    } catch (err) {
      serverLogger.error('Error kicking player', { roomCode, hostPlayerId, error: err });
      return false;
    }
  }

  /**
   * Host privilege: transfers room host role to another player in the room.
   * Updates seat isHost flags accordingly.
   */
  public transferHost(
    roomCode: string,
    currentHostPlayerId: string,
    newHostPlayerId: string
  ): boolean {
    try {
      if (!roomCode || typeof roomCode !== 'string' || !currentHostPlayerId || !newHostPlayerId) {
        return false;
      }

      const cleanCode = roomCode.trim().toUpperCase();
      const room = this.rooms.get(cleanCode);
      if (!room || room.hostPlayerId !== currentHostPlayerId) {
        return false;
      }

      // Idempotent
      if (currentHostPlayerId === newHostPlayerId) {
        return true;
      }

      const newHostSession = room.sessions.get(newHostPlayerId);
      if (!newHostSession) {
        return false;
      }

      room.hostPlayerId = newHostPlayerId;

      // Update seat isHost flags
      for (const seat of room.seats) {
        seat.isHost = seat.playerId === newHostPlayerId;
      }

      serverLogger.info('Host transferred', {
        roomCode: cleanCode,
        from: currentHostPlayerId,
        to: newHostPlayerId,
      });
      return true;
    } catch (err) {
      serverLogger.error('Error transferring host', {
        roomCode,
        currentHostPlayerId,
        newHostPlayerId,
        error: err,
      });
      return false;
    }
  }

  /**
   * Voluntarily leaves a room: vacates seat, removes player session and tokens.
   * If the leaving player was the host, transfers host to another active player,
   * or destroys the room if no players remain.
   */
  public leaveRoom(roomCode: string, playerId: string): boolean {
    try {
      if (!roomCode || typeof roomCode !== 'string' || !playerId) {
        return false;
      }

      const cleanCode = roomCode.trim().toUpperCase();
      const room = this.rooms.get(cleanCode);
      if (!room) {
        return false;
      }

      const session = room.sessions.get(playerId);
      if (!session) {
        return false;
      }

      // Vacate seat if seated
      for (const seat of room.seats) {
        if (seat.playerId === playerId) {
          seat.playerId = null;
          seat.playerName = null;
          seat.isConnected = false;
          seat.isHost = false;
        }
      }

      // Clean up socket mapping and session token
      if (session.socketId) {
        this.socketToPlayer.delete(session.socketId);
      }
      room.tokenToPlayerId.delete(session.sessionToken);
      room.sessions.delete(playerId);

      serverLogger.info('Player left room', { roomCode: cleanCode, playerId });

      // If leaving player was host, resolve new host or destroy if empty
      if (room.hostPlayerId === playerId) {
        const remainingSessions = Array.from(room.sessions.values());
        if (remainingSessions.length === 0) {
          this.destroyRoom(cleanCode);
        } else {
          const nextHost =
            remainingSessions.find((s) => s.isConnected) || remainingSessions[0];
          this.transferHost(cleanCode, playerId, nextHost.playerId);
        }
      }

      return true;
    } catch (err) {
      serverLogger.error('Error leaving room', { roomCode, playerId, error: err });
      return false;
    }
  }

  /**
   * Handles socket disconnection.
   * Marks the player's session and seat as isConnected=false while preserving hands and tokens.
   */
  public handleDisconnect(socketId: string): DisconnectResult {
    try {
      const lookup = this.socketToPlayer.get(socketId);
      if (!lookup) {
        return { found: false };
      }

      const { roomCode, playerId } = lookup;
      this.socketToPlayer.delete(socketId);

      const room = this.rooms.get(roomCode);
      if (!room) {
        return { found: false };
      }

      const session = room.sessions.get(playerId);
      if (!session) {
        return { found: false };
      }

      session.isConnected = false;
      if (session.seatIndex !== null && room.seats[session.seatIndex]) {
        room.seats[session.seatIndex].isConnected = false;
      }
      room.lastActivityAt = Date.now();

      serverLogger.warn('Player socket disconnected', { roomCode, playerId, socketId });
      return {
        found: true,
        roomCode,
        playerId,
        seatIndex: session.seatIndex,
        playerName: session.playerName,
      };
    } catch (err) {
      serverLogger.error('Error handling disconnect', { socketId, error: err });
      return { found: false };
    }
  }

  /**
   * Retrieves a room by its code (case-insensitive).
   */
  public getRoom(roomCode: string): Room | undefined {
    if (!roomCode || typeof roomCode !== 'string') {
      return undefined;
    }
    return this.rooms.get(roomCode.trim().toUpperCase());
  }

  /**
   * Destroys a room and cleans up any socket-to-player mappings.
   */
  public destroyRoom(roomCode: string): boolean {
    try {
      if (!roomCode || typeof roomCode !== 'string') {
        return false;
      }

      const cleanCode = roomCode.trim().toUpperCase();
      const room = this.rooms.get(cleanCode);
      if (!room) {
        return false;
      }

      for (const session of room.sessions.values()) {
        if (session.socketId) {
          this.socketToPlayer.delete(session.socketId);
        }
      }

      const deleted = this.rooms.delete(cleanCode);
      serverLogger.info('Room destroyed', { roomCode: cleanCode });
      return deleted;
    } catch (err) {
      serverLogger.error('Error destroying room', { roomCode, error: err });
      return false;
    }
  }

  /**
   * Destroys room if all players have left or all sessions are disconnected.
   */
  public destroyRoomIfEmpty(roomCode: string): boolean {
    try {
      if (!roomCode || typeof roomCode !== 'string') {
        return false;
      }

      const cleanCode = roomCode.trim().toUpperCase();
      const room = this.rooms.get(cleanCode);
      if (!room) {
        return false;
      }

      const isEmpty =
        room.sessions.size === 0 ||
        Array.from(room.sessions.values()).every((s) => !s.isConnected);

      if (isEmpty) {
        return this.destroyRoom(cleanCode);
      }

      return false;
    } catch (err) {
      serverLogger.error('Error checking destroyRoomIfEmpty', { roomCode, error: err });
      return false;
    }
  }

  /**
   * Updates lastActivityAt timestamp for an active room.
   */
  public touchRoom(roomCode: string): void {
    const room = this.getRoom(roomCode);
    if (room) {
      room.lastActivityAt = Date.now();
    }
  }

  /**
   * Scans all rooms and destroys any that are abandoned or stale.
   * A room is considered stale if:
   * 1. It has 0 sessions or all sessions are disconnected, AND idle time >= maxIdleMs (default 15 mins).
   * 2. It has been finished (GAME_OVER) for more than 5 minutes.
   * Returns an array of destroyed room codes.
   */
  public cleanupStaleRooms(maxIdleMs: number = 15 * 60 * 1000): string[] {
    const destroyed: string[] = [];
    const now = Date.now();

    for (const [code, room] of this.rooms.entries()) {
      try {
        const lastActive = room.lastActivityAt || room.createdAt || now;
        const idleTime = now - lastActive;

        // Condition 1: Empty or all players disconnected for >= maxIdleMs
        const allDisconnected =
          room.sessions.size === 0 ||
          Array.from(room.sessions.values()).every((s) => !s.isConnected);

        if (allDisconnected && idleTime >= maxIdleMs) {
          if (this.destroyRoom(code)) {
            destroyed.push(code);
            continue;
          }
        }

        // Condition 2: Completed games idle for >= 5 minutes
        if (room.status === 'GAME_OVER' && idleTime >= 5 * 60 * 1000) {
          if (this.destroyRoom(code)) {
            destroyed.push(code);
            continue;
          }
        }
      } catch (err) {
        serverLogger.error('Error during cleanupStaleRooms for room', { roomCode: code, error: err });
      }
    }

    return destroyed;
  }

  /**
   * Retrieves a PlayerSession by socket ID.
   */
  public getSessionBySocket(socketId: string): PlayerSession | undefined {
    const lookup = this.socketToPlayer.get(socketId);
    if (!lookup) return undefined;
    const room = this.rooms.get(lookup.roomCode);
    return room?.sessions.get(lookup.playerId);
  }

  /**
   * Retrieves a Room by socket ID.
   */
  public getRoomBySocket(socketId: string): Room | undefined {
    const lookup = this.socketToPlayer.get(socketId);
    if (!lookup) return undefined;
    return this.rooms.get(lookup.roomCode);
  }
}
