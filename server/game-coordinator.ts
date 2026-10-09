import { Room } from './types';
import { serverLogger } from './logger';
import { dealInitialState } from '../src/engine/deck';
import { pukarReducer } from '../src/engine/reducer';
import { sanitizeStateForPlayer } from '../src/engine/sanitizer';
import { Card, GameAction, SanitizedGameState } from '../src/engine/types';

export class GameCoordinator {
  /**
   * Validates if a room can start a game.
   * Requires room status to be 'LOBBY' and all seats (4 or 6) to have a valid playerId.
   */
  public static canStartGame(room: Room): { canStart: boolean; reason?: string } {
    try {
      if (!room) {
        return { canStart: false, reason: 'Invalid room' };
      }
      if (room.status !== 'LOBBY') {
        return { canStart: false, reason: 'Game is already in progress' };
      }
      if (!room.seats || room.seats.length === 0) {
        return { canStart: false, reason: 'No seats configured in room' };
      }
      if (room.playerCount !== 4 && room.playerCount !== 6) {
        return { canStart: false, reason: `Invalid player count: ${room.playerCount}` };
      }
      if (room.seats.length !== room.playerCount) {
        return {
          canStart: false,
          reason: `Invalid seats count (${room.seats.length} configured, expected ${room.playerCount})`,
        };
      }
      const emptySeats = room.seats.filter((s) => !s.playerId || s.playerId.trim() === '');
      if (emptySeats.length > 0) {
        return {
          canStart: false,
          reason: `Not all seats are filled (${emptySeats.length} empty)`,
        };
      }
      return { canStart: true };
    } catch (err) {
      let roomCode: string | undefined;
      try {
        roomCode = room?.roomCode;
      } catch {
        // Safe fallback
      }
      serverLogger.error('Error checking canStartGame', { roomCode, error: err });
      return { canStart: false, reason: 'Internal error checking room readiness' };
    }
  }

  /**
   * Initializes and deals a new game for the given room.
   * Remaps dealt player IDs to match seated session playerIds so state sanitization maps correctly.
   */
  public static startGame(room: Room, customDeck?: Card[]): boolean {
    try {
      if (!room) {
        serverLogger.warn('Cannot start game: room is undefined');
        return false;
      }
      const check = this.canStartGame(room);
      if (!check.canStart) {
        serverLogger.warn(`Cannot start game: ${check.reason}`, { roomCode: room.roomCode });
        return false;
      }

      const playerNames = room.seats.map((s) => s.playerName?.trim() || `Player ${s.seatIndex + 1}`);
      const initialState = dealInitialState(room.playerCount, customDeck, playerNames);

      // Re-map internal player IDs to seated session player IDs so sanitizeStateForPlayer matches
      initialState.players.forEach((p, idx) => {
        const seatPlayerId = room.seats[idx]?.playerId;
        if (seatPlayerId) {
          p.id = seatPlayerId;
        }
      });

      room.gameState = initialState;
      room.status = 'IN_GAME';

      serverLogger.info('Game started successfully', { roomCode: room.roomCode });
      return true;
    } catch (err) {
      let roomCode: string | undefined;
      try {
        roomCode = room?.roomCode;
      } catch {
        // Safe fallback
      }
      serverLogger.error('Error starting game', { roomCode, error: err });
      return false;
    }
  }

  /**
   * Handles an incoming game action dispatched by a player.
   * Verifies game is active, enforces strict turn order, passes action to pukarReducer,
   * updates room state and status, and logs diagnostic messages.
   */
  public static handleAction(
    room: Room,
    playerId: string,
    action: GameAction
  ): { success: boolean; error?: string } {
    try {
      if (!room || !room.gameState) {
        let roomCode: string | undefined;
        try {
          roomCode = room?.roomCode;
        } catch {
          // Safe fallback
        }
        serverLogger.warn('Action rejected: Game is not currently active', {
          roomCode,
          playerId,
          actionType: action?.type,
        });
        return { success: false, error: 'Game is not currently active' };
      }

      const isRoundAdvance = action?.type === 'START_NEXT_ROUND' || action?.type === 'RESET_GAME';
      const isGameActive =
        room.status === 'IN_GAME' ||
        (isRoundAdvance && (room.status === 'ROUND_OVER' || room.status === 'GAME_OVER'));

      if (!isGameActive) {
        serverLogger.warn('Action rejected: Game is not currently active', {
          roomCode: room.roomCode,
          playerId,
          actionType: action?.type,
        });
        return { success: false, error: 'Game is not currently active' };
      }

      // Check if player is a seated participant in this room
      const isSeated = room.seats?.some((s) => s.playerId === playerId);
      if (!isSeated) {
        if (isRoundAdvance) {
          serverLogger.warn('Action rejected: Player is not seated in this room', {
            roomCode: room.roomCode,
            playerId,
            actionType: action?.type,
          });
          return { success: false, error: 'Player is not seated in this room' };
        }
      }

      // Turn verification for regular game moves
      if (!isRoundAdvance) {
        const activePlayer = room.gameState.players?.[room.gameState.currentPlayerIndex];
        if (!activePlayer || activePlayer.id !== playerId) {
          serverLogger.warn('Action rejected: Not your turn to play', {
            roomCode: room.roomCode,
            playerId,
            actionType: action?.type,
          });
          return { success: false, error: 'Not your turn to play' };
        }
      }

      // Execute action via authoritative rules engine reducer
      const { state: nextState, error } = pukarReducer(room.gameState, action);
      if (error) {
        serverLogger.warn(`Action rejected by rules engine: ${error}`, {
          roomCode: room.roomCode,
          playerId,
          actionType: action?.type,
        });
        return { success: false, error };
      }

      // Re-map internal player IDs to seated session player IDs on round advance/reset
      if (isRoundAdvance && nextState.players) {
        nextState.players.forEach((p, idx) => {
          const seatPlayerId = room.seats?.[idx]?.playerId;
          if (seatPlayerId) {
            p.id = seatPlayerId;
          }
        });
      }

      room.gameState = nextState;

      // Update room status if round is over or game completed
      if (
        nextState.isRoundOver ||
        nextState.roundStatus === 'ROUND_OVER' ||
        nextState.roundStatus === 'GAME_OVER'
      ) {
        room.status = nextState.roundStatus === 'GAME_OVER' ? 'GAME_OVER' : 'ROUND_OVER';
      } else {
        room.status = 'IN_GAME';
      }

      serverLogger.info(`Action executed cleanly: ${action.type}`, {
        roomCode: room.roomCode,
        playerId,
        actionType: action.type,
      });
      return { success: true };
    } catch (err) {
      let roomCode: string | undefined;
      try {
        roomCode = room?.roomCode;
      } catch {
        // Safe fallback
      }
      serverLogger.error('Unexpected exception during action execution', {
        roomCode,
        playerId,
        actionType: action?.type,
        error: err,
      });
      return { success: false, error: 'Internal server error processing move' };
    }
  }

  /**
   * Obtains sanitized game state from the perspective of the specified player.
   * Masks opponent hands and deck sequences while keeping public table info and own hand intact.
   */
  public static getSanitizedStateForPlayer(
    room: Room,
    playerId: string
  ): SanitizedGameState | null {
    try {
      if (!room || !room.gameState) {
        return null;
      }
      return sanitizeStateForPlayer(room.gameState, playerId);
    } catch (err) {
      let roomCode: string | undefined;
      try {
        roomCode = room?.roomCode;
      } catch {
        // Safe fallback
      }
      serverLogger.error('Failed to sanitize state for player', {
        roomCode,
        playerId,
        error: err,
      });
      return null;
    }
  }
}
