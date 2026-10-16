import { LobbySeat } from '../../server/types';
import { GameAction, SanitizedGameState } from '../engine/types';

export type { LobbySeat, ServerMessage, ClientMessage } from '../../server/types';
export type { GameAction, SanitizedGameState } from '../engine/types';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

export interface StoredSession {
  roomCode: string;
  playerId: string;
  sessionToken: string;
  seatIndex: number | null;
  playerName?: string;
}

export interface UseMultiplayerGameReturn {
  connectionStatus: ConnectionStatus;
  roomCode: string | null;
  isHost: boolean;
  isInLobby: boolean;
  isInGame: boolean;
  lobbySeats: LobbySeat[];
  gameState: SanitizedGameState | null;
  mySeatIndex: number | null;
  myPlayerId: string | null;
  errorMessage: string | null;
  createRoom: (playerName: string, playerCount: 4 | 6) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  selectSeat: (seatIndex: number) => void;
  startGame: () => void;
  dispatchAction: (action: GameAction) => void;
  kickPlayer: (seatIndex: number) => void;
  leaveRoom: () => void;
  clearError: () => void;
  claimHost?: () => void;
}

