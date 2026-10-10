import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';
import { sanitizeStateForPlayer } from '../../src/engine/sanitizer';
import { GameCoordinator } from '../../server/game-coordinator';
import { Room } from '../../server/types';

describe('Frustration Mechanics (Engine & Sanitizer)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers frustration, setting 60-second cooldown and activeFrustration state', () => {
    const initialState = dealInitialState(4);
    const now = 1000000;
    vi.setSystemTime(now);

    const { state: nextState, error } = pukarReducer(initialState, {
      type: 'TRIGGER_FRUSTRATION',
      playerName: 'Uncle G',
    });

    expect(error).toBeUndefined();
    expect(nextState.frustrationCooldownUntil).toBe(now + 60000);
    expect(nextState.activeFrustration).toEqual({
      playerName: 'Uncle G',
      triggeredAt: now,
    });
  });

  it('defaults triggering playerName to active player when not provided in action', () => {
    const initialState = dealInitialState(4);
    const activePlayerName = initialState.players[initialState.currentPlayerIndex].name;
    const now = 2000000;
    vi.setSystemTime(now);

    const { state: nextState, error } = pukarReducer(initialState, {
      type: 'TRIGGER_FRUSTRATION',
    });

    expect(error).toBeUndefined();
    expect(nextState.activeFrustration?.playerName).toBe(activePlayerName);
  });

  it('rejects trigger attempt during active 60s cooldown with clear error message', () => {
    const initialState = dealInitialState(4);
    const now = 3000000;
    vi.setSystemTime(now);

    const { state: state1 } = pukarReducer(initialState, {
      type: 'TRIGGER_FRUSTRATION',
      playerName: 'Player 1',
    });

    // Advance 15 seconds into cooldown
    vi.advanceTimersByTime(15000);

    const { state: state2, error } = pukarReducer(state1, {
      type: 'TRIGGER_FRUSTRATION',
      playerName: 'Player 2',
    });

    expect(error).toMatch(/Frustration is on cooldown\. Please wait 45 seconds/i);
    // State remains unchanged from state1
    expect(state2.frustrationCooldownUntil).toBe(now + 60000);
    expect(state2.activeFrustration?.playerName).toBe('Player 1');
  });

  it('allows triggering again once the 60s cooldown expires', () => {
    const initialState = dealInitialState(4);
    const now = 4000000;
    vi.setSystemTime(now);

    const { state: state1 } = pukarReducer(initialState, {
      type: 'TRIGGER_FRUSTRATION',
      playerName: 'Player 1',
    });

    // Advance 61 seconds (past cooldown)
    vi.advanceTimersByTime(61000);
    const newNow = now + 61000;

    const { state: state2, error } = pukarReducer(state1, {
      type: 'TRIGGER_FRUSTRATION',
      playerName: 'Player 2',
    });

    expect(error).toBeUndefined();
    expect(state2.frustrationCooldownUntil).toBe(newNow + 60000);
    expect(state2.activeFrustration?.playerName).toBe('Player 2');
  });

  it('clears activeFrustration on CLEAR_FRUSTRATION without resetting cooldown', () => {
    const initialState = dealInitialState(4);
    const now = 5000000;
    vi.setSystemTime(now);

    const { state: state1 } = pukarReducer(initialState, {
      type: 'TRIGGER_FRUSTRATION',
      playerName: 'Player 1',
    });

    const { state: state2, error } = pukarReducer(state1, {
      type: 'CLEAR_FRUSTRATION',
    });

    expect(error).toBeUndefined();
    expect(state2.activeFrustration).toBeNull();
    // Cooldown is still active
    expect(state2.frustrationCooldownUntil).toBe(now + 60000);
  });

  it('sanitizes state while preserving frustration cooldown and activeFrustration', () => {
    const state = dealInitialState(4);
    state.frustrationCooldownUntil = 9999999;
    state.activeFrustration = {
      playerName: 'Chacha',
      triggeredAt: 9939999,
    };

    const sanitized = sanitizeStateForPlayer(state, state.players[0].id);
    expect(sanitized.frustrationCooldownUntil).toBe(9999999);
    expect(sanitized.activeFrustration).toEqual({
      playerName: 'Chacha',
      triggeredAt: 9939999,
    });
  });

  it('allows non-turn seated players in multiplayer to trigger frustration via GameCoordinator', () => {
    const mockRoom: Room = {
      roomCode: 'ABCD',
      hostPlayerId: 'p1',
      playerCount: 4,
      status: 'IN_GAME',
      createdAt: Date.now(),
      seats: [
        { seatIndex: 0, playerId: 'p1', playerName: 'Player 1', team: 'A', isHost: true, isConnected: true },
        { seatIndex: 1, playerId: 'p2', playerName: 'Player 2', team: 'B', isHost: false, isConnected: true },
        { seatIndex: 2, playerId: 'p3', playerName: 'Player 3', team: 'A', isHost: false, isConnected: true },
        { seatIndex: 3, playerId: 'p4', playerName: 'Player 4', team: 'B', isHost: false, isConnected: true },
      ],
      sessions: new Map(),
      tokenToPlayerId: new Map(),
      gameState: dealInitialState(4),
    };

    // Ensure active player is seat 0 (p1)
    mockRoom.gameState!.currentPlayerIndex = 0;

    // p2 is NOT the active player, but attempts to trigger frustration
    const res = GameCoordinator.handleAction(mockRoom, 'p2', {
      type: 'TRIGGER_FRUSTRATION',
    });

    expect(res.success).toBe(true);
    expect(mockRoom.gameState?.activeFrustration?.playerName).toBe('Player 2');
    expect(mockRoom.gameState?.frustrationCooldownUntil).toBeGreaterThan(0);
  });
});
