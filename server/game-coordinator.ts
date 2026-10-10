import { Room } from './types';
import { serverLogger } from './logger';
import { dealInitialState } from '../src/engine/deck';
import { pukarReducer } from '../src/engine/reducer';
import { sanitizeStateForPlayer } from '../src/engine/sanitizer';
import { Card, GameAction, SanitizedGameState } from '../src/engine/types';

export class GameCoordinator {
  /**
   * Validates if a room can start a game.
   * Requires room status to be 'LOBBY', seat count to match playerCount (4 or 6),
   * all seatIndices 0..(playerCount-1) present and unique,
   * all seats to have a valid non-empty playerId, and no duplicate playerIds.
   */
  public static canStartGame(room: Room): { canStart: boolean; reason?: string } {
    try {
      if (!room) {
        return { canStart: false, reason: 'Invalid room' };
      }
      if (room.status !== 'LOBBY') {
        return { canStart: false, reason: 'Game is already in progress' };
      }
      if (!Array.isArray(room.seats) || room.seats.length === 0) {
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

      // Validate all seats are defined and seat indices form 0..(playerCount-1)
      const seatIndices = new Set<number>();
      for (const seat of room.seats) {
        if (!seat || typeof seat.seatIndex !== 'number' || seat.seatIndex < 0 || seat.seatIndex >= room.playerCount) {
          return { canStart: false, reason: 'Invalid seat configuration in room' };
        }
        if (seatIndices.has(seat.seatIndex)) {
          return { canStart: false, reason: `Duplicate seat index ${seat.seatIndex}` };
        }
        seatIndices.add(seat.seatIndex);
      }
      if (seatIndices.size !== room.playerCount) {
        return { canStart: false, reason: 'Missing seat positions in room' };
      }

      // Check empty or invalid playerIds
      const emptySeats = room.seats.filter(
        (s) => !s.playerId || typeof s.playerId !== 'string' || s.playerId.trim() === ''
      );
      if (emptySeats.length > 0) {
        return {
          canStart: false,
          reason: `Not all seats are filled (${emptySeats.length} empty)`,
        };
      }

      // Check for duplicate playerIds across seats
      const playerIds = room.seats.map((s) => s.playerId!.trim());
      const uniquePlayerIds = new Set(playerIds);
      if (uniquePlayerIds.size !== room.playerCount) {
        return {
          canStart: false,
          reason: 'Duplicate player IDs found across seats',
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
   * Sorts seats by seatIndex so player mapping aligns with game engine seats.
   * Remaps dealt player IDs and names to match seated session players so state sanitization maps correctly.
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

      // Sort seats strictly by seatIndex so player mapping aligns predictably
      const sortedSeats = [...room.seats].sort((a, b) => a.seatIndex - b.seatIndex);
      const playerNames = sortedSeats.map((s) => s.playerName?.trim() || `Player ${s.seatIndex + 1}`);
      const initialState = dealInitialState(room.playerCount, customDeck, playerNames);

      // Re-map internal player IDs and names to seated session players so sanitizeStateForPlayer matches
      initialState.players.forEach((p, idx) => {
        const seat = sortedSeats[idx];
        if (seat?.playerId) {
          p.id = seat.playerId;
        }
        if (seat?.playerName?.trim()) {
          p.name = seat.playerName.trim();
        }
      });

      room.gameState = initialState;
      room.status = 'IN_GAME';

      serverLogger.info('Game started successfully', {
        roomCode: room.roomCode,
        playerId: room.hostPlayerId,
      });
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

      if (!action || typeof action !== 'object' || typeof action.type !== 'string' || !action.type.trim()) {
        serverLogger.warn('Action rejected: Invalid action payload', {
          roomCode: room.roomCode,
          playerId,
        });
        return { success: false, error: 'Invalid action payload' };
      }

      if (!playerId || typeof playerId !== 'string' || playerId.trim() === '') {
        serverLogger.warn('Action rejected: Invalid player ID', {
          roomCode: room.roomCode,
          actionType: action.type,
        });
        return { success: false, error: 'Invalid player ID' };
      }

      const isRoundAdvance = action.type === 'START_NEXT_ROUND' || action.type === 'RESET_GAME';
      const isGameActive =
        room.status === 'IN_GAME' ||
        (isRoundAdvance && (room.status === 'ROUND_OVER' || room.status === 'GAME_OVER'));

      if (!isGameActive) {
        serverLogger.warn('Action rejected: Game is not currently active', {
          roomCode: room.roomCode,
          playerId,
          actionType: action.type,
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
            actionType: action.type,
          });
          return { success: false, error: 'Player is not seated in this room' };
        }
      }

      // Disallow START_NEXT_ROUND if game has completed (GAME_OVER)
      if (action.type === 'START_NEXT_ROUND') {
        if (room.status === 'GAME_OVER' || room.gameState.roundStatus === 'GAME_OVER') {
          serverLogger.warn('Action rejected: Cannot start next round when game is already over', {
            roomCode: room.roomCode,
            playerId,
            actionType: action.type,
          });
          return { success: false, error: 'Cannot start next round: game is already over' };
        }
      }

      // Disallow non-host player from resetting an active in-progress game
      if (action.type === 'RESET_GAME') {
        if (
          room.status === 'IN_GAME' &&
          room.gameState.roundStatus === 'PLAYING' &&
          room.hostPlayerId &&
          playerId !== room.hostPlayerId
        ) {
          serverLogger.warn('Action rejected: Only host can reset active game in progress', {
            roomCode: room.roomCode,
            playerId,
            actionType: action.type,
          });
          return { success: false, error: 'Only the host can reset an active game in progress' };
        }

        if (action.playerCount && action.playerCount !== room.playerCount) {
          serverLogger.warn('Action rejected: Cannot change player count on reset', {
            roomCode: room.roomCode,
            playerId,
            actionType: action.type,
          });
          return {
            success: false,
            error: `Cannot change room player count from ${room.playerCount} to ${action.playerCount}`,
          };
        }
      }

      // Turn verification for regular game moves (deck optimization and frustration can be requested at any time by any seated player)
      const isTurnAgnosticAction =
        isRoundAdvance ||
        action.type === 'OPTIMIZE_DECK_ORDER' ||
        action.type === 'TRIGGER_FRUSTRATION' ||
        action.type === 'CLEAR_FRUSTRATION';

      if (!isTurnAgnosticAction) {
        const activePlayer = room.gameState.players?.[room.gameState.currentPlayerIndex];
        if (!activePlayer || activePlayer.id !== playerId) {
          serverLogger.warn('Action rejected: Not your turn to play', {
            roomCode: room.roomCode,
            playerId,
            actionType: action.type,
          });
          return { success: false, error: 'Not your turn to play' };
        }
      }

      // Prepare seats sorted by seatIndex to maintain correct mapping
      const sortedSeats = [...(room.seats || [])].sort((a, b) => a.seatIndex - b.seatIndex);
      const senderSeat = sortedSeats.find((s) => s.playerId === playerId);
      const senderPlayer = room.gameState.players?.find((p) => p.id === playerId);
      const sendingPlayerName = senderSeat?.playerName?.trim() || senderPlayer?.name?.trim() || 'Player';

      // Normalize RESET_GAME so player names and count from the authoritative room are preserved
      const effectiveAction: GameAction =
        action.type === 'RESET_GAME'
          ? {
              ...action,
              playerCount: room.playerCount,
              playerNames: sortedSeats.map((s) => s.playerName?.trim() || `Player ${s.seatIndex + 1}`),
            }
          : action.type === 'TRIGGER_FRUSTRATION'
          ? {
              ...action,
              playerName: action.playerName || sendingPlayerName,
            }
          : action;

      // Execute action via authoritative rules engine reducer
      const { state: nextState, error } = pukarReducer(room.gameState, effectiveAction);
      if (error) {
        serverLogger.warn(`Action rejected by rules engine: ${error}`, {
          roomCode: room.roomCode,
          playerId,
          actionType: action.type,
        });
        return { success: false, error };
      }

      // Re-map internal player IDs and names to seated session player IDs on round advance/reset
      if (isRoundAdvance && nextState.players) {
        nextState.players.forEach((p, idx) => {
          const seat = sortedSeats[idx];
          if (seat?.playerId) {
            p.id = seat.playerId;
          }
          if (seat?.playerName?.trim()) {
            p.name = seat.playerName.trim();
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
      if (!room || !room.gameState || room.status === 'LOBBY') {
        return null;
      }
      if (!playerId || typeof playerId !== 'string' || !playerId.trim()) {
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
