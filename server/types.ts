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

export type Seat = LobbySeat;

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
  lastActivityAt?: number;
  hostDisconnectedAt?: number | null;
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
  | { type: 'LEAVE_ROOM' }
  | { type: 'PING' }
  | { type: 'CLAIM_HOST' };

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
    }
  | {
      type: 'PONG';
      timestamp?: number;
    };

export type ClientMessageType = ClientMessage['type'];
export type ServerMessageType = ServerMessage['type'];


