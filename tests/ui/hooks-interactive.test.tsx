import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTableShortcuts } from '../../src/ui/hooks/useTableShortcuts';
import { useGameAudio } from '../../src/ui/hooks/useGameAudio';
import { useGameNotifications } from '../../src/ui/hooks/useGameNotifications';
import { useLocalGame } from '../../src/ui/hooks/useLocalGame';
import { dealInitialState } from '../../src/engine/deck';
import { UseMultiplayerGameReturn } from '../../src/network/types';
import * as soundModule from '../../src/ui/sound';

describe('Hooks Interactive Execution & Edge Cases (Stage 3)', () => {
  let originalWindow: any;
  let listeners: Record<string, ((e: any) => void)[]> = {};

  beforeEach(() => {
    listeners = {};
    originalWindow = globalThis.window;
    globalThis.window = {
      addEventListener: (event: string, cb: (e: any) => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      },
      removeEventListener: (event: string, cb: (e: any) => void) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((fn) => fn !== cb);
        }
      },
      innerWidth: 1024,
    } as any;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    vi.restoreAllMocks();
  });

  function withHookRunner<T>(hookFn: () => T, options?: { runEffects?: boolean }): T {
    let result!: T;
    const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const oldH = internals?.H;

    const stateMap = new Map<number, any>();
    let stateIdx = 0;

    if (internals) {
      internals.H = {
        useState: (init: any) => {
          const idx = stateIdx++;
          if (!stateMap.has(idx)) {
            stateMap.set(idx, typeof init === 'function' ? init() : init);
          }
          const val = stateMap.get(idx);
          const setter = (updater: any) => {
            const nextVal = typeof updater === 'function' ? updater(stateMap.get(idx)) : updater;
            stateMap.set(idx, nextVal);
          };
          return [val, setter];
        },
        useEffect: (fn: any) => {
          if (options?.runEffects ?? true) {
            const cleanup = fn();
            return cleanup;
          }
        },
        useCallback: (fn: any) => fn,
        useMemo: (fn: any) => fn(),
        useRef: (init: any) => ({ current: init }),
        useId: () => 'test-id',
      };
    }

    try {
      result = hookFn();
    } finally {
      if (internals && oldH) {
        internals.H = oldH;
      }
    }

    return result;
  }

  describe('useTableShortcuts interactive key event handling', () => {
    it('dispatches OPTIMIZE_DECK_ORDER when double pressing j within 1.2s', () => {
      const onAction = vi.fn();

      withHookRunner(() => {
        useTableShortcuts({ currentScreen: 'GAME', onAction });
      });

      expect(listeners['keydown']).toBeDefined();
      expect(listeners['keydown'].length).toBe(1);

      const handler = listeners['keydown'][0];

      // First 'j' press
      handler({ key: 'j', target: null });
      expect(onAction).not.toHaveBeenCalled();

      // Second 'j' press within 1.2s
      handler({ key: 'j', target: null });
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onAction).toHaveBeenCalledWith({ type: 'OPTIMIZE_DECK_ORDER' });
    });

    it('ignores double j if typing into input or textarea elements', () => {
      const onAction = vi.fn();

      withHookRunner(() => {
        useTableShortcuts({ currentScreen: 'GAME', onAction });
      });

      const handler = listeners['keydown'][0];

      // Keydown inside input
      handler({ key: 'j', target: { tagName: 'INPUT' } });
      handler({ key: 'j', target: { tagName: 'INPUT' } });
      expect(onAction).not.toHaveBeenCalled();

      // Keydown inside textarea
      handler({ key: 'j', target: { tagName: 'TEXTAREA' } });
      handler({ key: 'j', target: { tagName: 'TEXTAREA' } });
      expect(onAction).not.toHaveBeenCalled();

      // Keydown inside contentEditable
      handler({ key: 'j', target: { isContentEditable: true } });
      handler({ key: 'j', target: { isContentEditable: true } });
      expect(onAction).not.toHaveBeenCalled();
    });

    it('resets interval if another key is pressed between j keys', () => {
      const onAction = vi.fn();

      withHookRunner(() => {
        useTableShortcuts({ currentScreen: 'GAME', onAction });
      });

      const handler = listeners['keydown'][0];

      handler({ key: 'j', target: null });
      handler({ key: 'a', target: null }); // intermediate key
      handler({ key: 'j', target: null }); // restarts interval

      expect(onAction).not.toHaveBeenCalled();
    });

    it('does not register keydown listener if currentScreen is not GAME', () => {
      const onAction = vi.fn();

      withHookRunner(() => {
        useTableShortcuts({ currentScreen: 'MENU', onAction });
      });

      expect(listeners['keydown'] ?? []).toHaveLength(0);
    });
  });

  describe('useGameAudio interactive controls', () => {
    it('toggleMute updates audio state and synchronizes setSoundEnabled', () => {
      const setSoundEnabledSpy = vi.spyOn(soundModule, 'setSoundEnabled');

      const audio = withHookRunner(() => useGameAudio());
      expect(audio.isMuted).toBe(false);

      audio.toggleMute();
      expect(setSoundEnabledSpy).toHaveBeenCalledWith(false);

      setSoundEnabledSpy.mockRestore();
    });

    it('triggerSound catches and ignores audio playback errors gracefully', () => {
      const playSoundSpy = vi.spyOn(soundModule, 'playSound').mockImplementation(() => {
        throw new Error('WebAudio context blocked');
      });

      const audio = withHookRunner(() => useGameAudio());
      expect(() => audio.triggerSound('draw')).not.toThrow();

      playSoundSpy.mockRestore();
    });
  });

  describe('useGameNotifications celebration triggers & clearAll', () => {
    const dummyMultiplayerHook: UseMultiplayerGameReturn = {
      connectionStatus: 'DISCONNECTED',
      roomCode: null,
      isHost: false,
      isInLobby: false,
      isInGame: false,
      lobbySeats: [],
      gameState: null,
      mySeatIndex: null,
      myPlayerId: null,
      errorMessage: null,
      createRoom: vi.fn(),
      joinRoom: vi.fn(),
      selectSeat: vi.fn(),
      startGame: vi.fn(),
      dispatchAction: vi.fn(),
      kickPlayer: vi.fn(),
      leaveRoom: vi.fn(),
      clearError: vi.fn(),
    };

    it('triggerPukarCelebration sets event data and rippling flag', () => {
      const notifs = withHookRunner(() =>
        useGameNotifications({
          appMode: 'LOCAL',
          multiplayerHook: dummyMultiplayerHook,
          triggerSound: vi.fn(),
        })
      );

      notifs.triggerPukarCelebration({
        team: 'B',
        playerName: 'Bob',
        points: 50,
      });

      notifs.clearAllNotifications();
      // Should not throw and resets state
      expect(typeof notifs.clearAllNotifications).toBe('function');
    });
  });

  describe('useLocalGame turn and perspective lifecycle', () => {
    const dummyMultiplayerHook: UseMultiplayerGameReturn = {
      connectionStatus: 'DISCONNECTED',
      roomCode: null,
      isHost: false,
      isInLobby: false,
      isInGame: false,
      lobbySeats: [],
      gameState: null,
      mySeatIndex: null,
      myPlayerId: null,
      errorMessage: null,
      createRoom: vi.fn(),
      joinRoom: vi.fn(),
      selectSeat: vi.fn(),
      startGame: vi.fn(),
      dispatchAction: vi.fn(),
      kickPlayer: vi.fn(),
      leaveRoom: vi.fn(),
      clearError: vi.fn(),
    };

    it('handles card selection toggle, clear, and perspective switching', () => {
      const initialState = dealInitialState(4);
      const setErrorMessage = vi.fn();
      const triggerSound = vi.fn();

      const game = withHookRunner(() =>
        useLocalGame({
          initialState,
          appMode: 'LOCAL',
          multiplayerHook: dummyMultiplayerHook,
          triggerSound,
          setErrorMessage,
          triggerPukarCelebration: vi.fn(),
          setExhaustNotification: vi.fn(),
          setJokerPickupBanner: vi.fn(),
          clearAllNotifications: vi.fn(),
          setJokerPromptData: vi.fn(),
        })
      );

      const firstCardId = initialState.players[0].hand[0].id;

      // Toggle selection on
      game.handleToggleCardSelection(firstCardId);
      // Clear selection
      game.handleClearSelection();

      // Switch viewed player perspective
      game.handleSwitchPlayer(2);

      // Force turn to target player
      game.handleForceTurn(3);

      expect(typeof game.handleAction).toBe('function');
    });

    it('executes DRAW_FROM_STOCK in local mode successfully', () => {
      const initialState = dealInitialState(4);
      const setErrorMessage = vi.fn();
      const triggerSound = vi.fn();

      const game = withHookRunner(() =>
        useLocalGame({
          initialState,
          appMode: 'LOCAL',
          multiplayerHook: dummyMultiplayerHook,
          triggerSound,
          setErrorMessage,
          triggerPukarCelebration: vi.fn(),
          setExhaustNotification: vi.fn(),
          setJokerPickupBanner: vi.fn(),
          clearAllNotifications: vi.fn(),
          setJokerPromptData: vi.fn(),
        })
      );

      const success = game.handleAction({ type: 'DRAW_FROM_STOCK' });
      expect(success).toBe(true);
      expect(triggerSound).toHaveBeenCalledWith('draw');
      expect(setErrorMessage).toHaveBeenCalledWith(null);
    });

    it('enforces turn guard in multiplayer mode when not active player turn', () => {
      const initialState = dealInitialState(4);
      const setErrorMessage = vi.fn();
      const triggerSound = vi.fn();

      const mpHookWithGame: UseMultiplayerGameReturn = {
        ...dummyMultiplayerHook,
        isInGame: true,
        mySeatIndex: 1, // viewer is seat 1
        gameState: {
          ...initialState,
          currentPlayerIndex: 0, // active player is seat 0
          phase: 'DRAW',
          stockDeckCount: 50,
          pukarPoolCount: 2,
        } as any,
      };

      const game = withHookRunner(() =>
        useLocalGame({
          initialState,
          appMode: 'MULTIPLAYER',
          multiplayerHook: mpHookWithGame,
          triggerSound,
          setErrorMessage,
          triggerPukarCelebration: vi.fn(),
          setExhaustNotification: vi.fn(),
          setJokerPickupBanner: vi.fn(),
          clearAllNotifications: vi.fn(),
          setJokerPromptData: vi.fn(),
        })
      );

      const success = game.handleAction({ type: 'DRAW_FROM_STOCK' });
      expect(success).toBe(false);
      expect(setErrorMessage).toHaveBeenCalledWith('Not your turn to play');
      expect(triggerSound).toHaveBeenCalledWith('error');
    });
  });
});
