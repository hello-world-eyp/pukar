import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/App';
import { UnclePukarChoiceModal } from '../../src/ui/components/UnclePukarChoiceModal';
import { useBotGame } from '../../src/ui/hooks/useBotGame';
import { useTableShortcuts } from '../../src/ui/hooks/useTableShortcuts';
import { useMultiplayerGame } from '../../src/network/useMultiplayerGame';
import { dealInitialState } from '../../src/engine/deck';
import { pukarReducer } from '../../src/engine/reducer';
import { BotGameConfig } from '../../src/engine/bots/types';
import { decideFastChachiTurn } from '../../src/engine/bots/strategies/fast-chachi';
import { Card } from '../../src/engine/types';

describe('useBotGame & Bot Pacing Fixes', () => {
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
    vi.useRealTimers();
  });

  function createTestBotConfig(): BotGameConfig {
    return {
      playerCount: 4,
      seats: [
        { seatIndex: 0, name: 'You', personality: 'smart_chacha', isHuman: true },
        { seatIndex: 1, name: 'Chachi', personality: 'fast_chachi', isHuman: false },
        { seatIndex: 2, name: 'Sid', personality: 'smart_chacha', isHuman: false },
        { seatIndex: 3, name: 'Harsh', personality: 'the_long_term_guy', isHuman: false },
      ],
    };
  }

  function runHook<T>(hookFn: () => T, stateMap?: Map<number, any>): { result: T; cleanups: (() => void)[] } {
    let result!: T;
    const cleanups: (() => void)[] = [];
    const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const oldH = internals?.H;

    const map = stateMap || new Map<number, any>();
    let stateIdx = 0;
    let isReRendering = false;

    if (internals) {
      internals.H = {
        useState: (init: any) => {
          const idx = stateIdx++;
          if (!map.has(idx)) {
            map.set(idx, typeof init === 'function' ? init() : init);
          }
          const val = map.get(idx);
          const setter = (updater: any) => {
            const nextVal = typeof updater === 'function' ? updater(map.get(idx)) : updater;
            if (Object.is(map.get(idx), nextVal)) return;
            map.set(idx, nextVal);
            if (!isReRendering) {
              isReRendering = true;
              try {
                runHook(hookFn, map);
              } finally {
                isReRendering = false;
              }
            }
          };
          return [val, setter];
        },
        useEffect: (fn: any, deps?: any[]) => {
          const idx = stateIdx++;
          const prevEntry = map.get(idx);
          let shouldRun = false;
          if (!prevEntry) {
            shouldRun = true;
          } else if (!deps) {
            shouldRun = true;
          } else {
            const prevDeps = prevEntry.deps;
            if (!prevDeps || prevDeps.length !== deps.length || deps.some((d, i) => !Object.is(d, prevDeps[i]))) {
              shouldRun = true;
            }
          }

          if (shouldRun) {
            if (prevEntry?.cleanup && typeof prevEntry.cleanup === 'function') {
              prevEntry.cleanup();
            }
            const cleanup = fn();
            map.set(idx, { deps, cleanup });
            if (typeof cleanup === 'function') {
              cleanups.push(cleanup);
            }
          }
        },
        useCallback: (fn: any, deps?: any[]) => {
          const idx = stateIdx++;
          const prevEntry = map.get(idx);
          if (prevEntry && deps && prevEntry.deps && prevEntry.deps.length === deps.length) {
            const match = deps.every((d, i) => Object.is(d, prevEntry.deps[i]));
            if (match) return prevEntry.fn;
          }
          map.set(idx, { deps, fn });
          return fn;
        },
        useMemo: (fn: any, deps?: any[]) => {
          const idx = stateIdx++;
          const prevEntry = map.get(idx);
          if (prevEntry && deps && prevEntry.deps && prevEntry.deps.length === deps.length) {
            const match = deps.every((d, i) => Object.is(d, prevEntry.deps[i]));
            if (match) return prevEntry.val;
          }
          const val = fn();
          map.set(idx, { deps, val });
          return val;
        },
        useRef: (init: any) => {
          const idx = stateIdx++;
          if (!map.has(idx)) {
            map.set(idx, { current: init });
          }
          return map.get(idx);
        },
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

    return { result, cleanups };
  }

  describe('useBotGame responsiveness & timer stability', () => {
    it('derives botStatus via useMemo for bot seat, returning isThinking true', () => {
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1; // Fast Chachi (Bot)
      state.phase = 'DRAW';
      const botConfig = createTestBotConfig();

      const { result } = runHook(() =>
        useBotGame({
          appMode: 'BOTS',
          gameState: state,
          botConfig,
          handleAction: vi.fn(),
        })
      );

      expect(result.botStatus).not.toBeNull();
      expect(result.botStatus?.botName).toBe('Chachi');
      expect(result.botStatus?.isThinking).toBe(true);
      expect(result.botStatus?.phase).toBe('DRAW');
    });

    it('returns null botStatus when active player is human (Seat 0)', () => {
      const state = dealInitialState(4);
      state.currentPlayerIndex = 0; // Human
      state.phase = 'DRAW';
      const botConfig = createTestBotConfig();

      const { result } = runHook(() =>
        useBotGame({
          appMode: 'BOTS',
          gameState: state,
          botConfig,
          handleAction: vi.fn(),
        })
      );

      expect(result.botStatus).toBeNull();
    });

    it('executes bot turn within 250ms default delay', () => {
      vi.useFakeTimers();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1; // Bot turn
      state.phase = 'DRAW';
      const botConfig = createTestBotConfig();
      const handleAction = vi.fn();

      runHook(() =>
        useBotGame({
          appMode: 'BOTS',
          gameState: state,
          botConfig,
          handleAction,
        })
      );

      expect(handleAction).not.toHaveBeenCalled();

      // Fast-forward 250ms
      vi.advanceTimersByTime(250);

      expect(handleAction).toHaveBeenCalledTimes(1);
      expect(handleAction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringMatching(/DRAW_FROM_STOCK|TAKE_DISCARD/),
        })
      );
    });

    it('does not re-cancel timer when re-rendered with new handleAction identity', () => {
      vi.useFakeTimers();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1; // Bot turn
      state.phase = 'DRAW';
      const botConfig = createTestBotConfig();

      const handleAction1 = vi.fn();
      const stateMap = new Map<number, any>();

      // First render
      runHook(
        () =>
          useBotGame({
            appMode: 'BOTS',
            gameState: state,
            botConfig,
            handleAction: handleAction1,
          }),
        stateMap
      );

      // Advance 100ms (timer not fired yet)
      vi.advanceTimersByTime(100);
      expect(handleAction1).not.toHaveBeenCalled();

      // Second render with a new handleAction function reference
      const handleAction2 = vi.fn();
      runHook(
        () =>
          useBotGame({
            appMode: 'BOTS',
            gameState: state,
            botConfig,
            handleAction: handleAction2,
          }),
        stateMap
      );

      // Advance remaining 150ms
      vi.advanceTimersByTime(150);

      // handleAction2 (latest ref) was called, timer was NOT canceled by reference recreation!
      expect(handleAction2).toHaveBeenCalledTimes(1);
    });

    it('does not trigger SELECT_PUKAR_DECK on normal turns when bot reaches 13 cards without claiming Pukar', () => {
      vi.useFakeTimers();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1;
      state.phase = 'MELD';
      // Hand has 13 cards from a normal turn (e.g. started with 13, drew to 14, melded 1 to 13)
      state.initialHandSizeThisTurn = 13;
      expect(state.pukarPool.length).toBeGreaterThanOrEqual(1);

      const botConfig = createTestBotConfig();
      const dispatchedActions: any[] = [];
      const handleAction = vi.fn((act) => {
        dispatchedActions.push(act);
        return true;
      });

      runHook(() =>
        useBotGame({
          appMode: 'BOTS',
          gameState: state,
          botConfig,
          handleAction,
        })
      );

      // Advance timers across MELD and DISCARD subphases
      vi.advanceTimersByTime(500);

      // Verify SELECT_PUKAR_DECK was NOT dispatched
      expect(dispatchedActions.some((a) => a.type === 'SELECT_PUKAR_DECK')).toBe(false);
      expect(handleAction).toHaveBeenCalled();
    });

    it('proceeds to discard when a meld action is rejected, preventing deadlock', () => {
      vi.useFakeTimers();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1;
      state.phase = 'MELD';

      // Give bot cards that form a meld
      state.players[1].hand = [
        { id: 'c1', suit: 'SPADES', rank: 14 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c2', suit: 'SPADES', rank: 2 as any, isNaturalJoker: false, isJoker: true },
        { id: 'c3', suit: 'SPADES', rank: 3 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c4', suit: 'HEARTS', rank: 9 as any, isNaturalJoker: false, isJoker: false },
      ];

      const botConfig = createTestBotConfig();
      const dispatchedActions: any[] = [];
      const handleAction = vi.fn((act) => {
        dispatchedActions.push(act);
        if (act.type === 'PLAY_NEW_MELD') {
          return false; // Reject the meld action!
        }
        return true;
      });

      runHook(() =>
        useBotGame({
          appMode: 'BOTS',
          gameState: state,
          botConfig,
          handleAction,
        })
      );

      vi.advanceTimersByTime(250);

      // Because meld was rejected (returned false), it immediately attempted discard!
      expect(dispatchedActions.length).toBe(2);
      expect(dispatchedActions[0].type).toBe('PLAY_NEW_MELD');
      expect(dispatchedActions[1].type).toBe('DISCARD_CARD');
    });

    it('failsafe discard avoids discarding single picked up card', () => {
      vi.useFakeTimers();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1;
      state.phase = 'DISCARD';
      state.cardsPickedUpThisTurn = ['c_picked'];
      state.initialHandSizeThisTurn = 13;
      state.players[1].hand = [
        { id: 'c_picked', suit: 'HEARTS', rank: 5 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c_other', suit: 'SPADES', rank: 9 as any, isNaturalJoker: false, isJoker: false },
      ];

      const botConfig = createTestBotConfig();
      const dispatchedActions: any[] = [];
      const handleAction = vi.fn((act) => {
        dispatchedActions.push(act);
        // Force failure on primary discard to test failsafe
        return false;
      });

      runHook(() =>
        useBotGame({
          appMode: 'BOTS',
          gameState: state,
          botConfig,
          handleAction,
        })
      );

      vi.advanceTimersByTime(250);

      // Failsafe discard must have chosen c_other, avoiding c_picked
      const discardActions = dispatchedActions.filter((a) => a.type === 'DISCARD_CARD');
      expect(discardActions.length).toBeGreaterThanOrEqual(1);
      const lastDiscard = discardActions[discardActions.length - 1];
      expect(lastDiscard.cardId).toBe('c_other');
    });

    it('mid-turn re-plans remaining melds when a Joker is retrieved from the table', () => {
      vi.useFakeTimers();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1; // Bot
      state.phase = 'MELD';

      // Table has a pure sequence for Team B (so pure opening requirement is already satisfied)
      const pureMeld = {
        id: 'pure-meld',
        type: 'RUN' as const,
        suit: 'CLUBS' as const,
        cards: [
          { id: 'c1', suit: 'CLUBS' as const, rank: 4 as any, isNaturalJoker: false, isJoker: false },
          { id: 'c2', suit: 'CLUBS' as const, rank: 5 as any, isNaturalJoker: false, isJoker: false },
          { id: 'c3', suit: 'CLUBS' as const, rank: 6 as any, isNaturalJoker: false, isJoker: false },
        ],
        slots: [
          { card: { id: 'c1', suit: 'CLUBS' as const, rank: 4 as any, isNaturalJoker: false, isJoker: false }, representedRank: 4, representedSuit: 'CLUBS' as const, isWildcard: false },
          { card: { id: 'c2', suit: 'CLUBS' as const, rank: 5 as any, isNaturalJoker: false, isJoker: false }, representedRank: 5, representedSuit: 'CLUBS' as const, isWildcard: false },
          { card: { id: 'c3', suit: 'CLUBS' as const, rank: 6 as any, isNaturalJoker: false, isJoker: false }, representedRank: 6, representedSuit: 'CLUBS' as const, isWildcard: false },
        ],
        isClean: true,
        isPure: true,
        isPure13: false,
        points: 0,
        team: 'B' as const,
        playerId: 'p1',
      };

      // Table also has a run with a Natural Joker that can be retrieved
      const meldWithJoker = {
        id: 'meld-with-joker',
        type: 'RUN' as const,
        suit: 'SPADES' as const,
        cards: [
          { id: 's4', suit: 'SPADES' as const, rank: 4 as any, isNaturalJoker: false, isJoker: false },
          { id: 'joker-retrievable', suit: null, rank: 0 as any, isNaturalJoker: true, isJoker: true },
          { id: 's6', suit: 'SPADES' as const, rank: 6 as any, isNaturalJoker: false, isJoker: false },
        ],
        slots: [
          { card: { id: 's4', suit: 'SPADES' as const, rank: 4 as any, isNaturalJoker: false, isJoker: false }, representedRank: 4, representedSuit: 'SPADES' as const, isWildcard: false },
          { card: { id: 'joker-retrievable', suit: null, rank: 0 as any, isNaturalJoker: true, isJoker: true }, representedRank: 5, representedSuit: 'SPADES' as const, isWildcard: true },
          { card: { id: 's6', suit: 'SPADES' as const, rank: 6 as any, isNaturalJoker: false, isJoker: false }, representedRank: 6, representedSuit: 'SPADES' as const, isWildcard: false },
        ],
        isClean: false,
        isPure: false,
        isPure13: false,
        points: 0,
        team: 'B' as const,
        playerId: 'p1',
      };

      state.melds['B'] = [pureMeld, meldWithJoker];

      // Hand:
      // s5: can substitute joker-retrievable
      // h7, h8: cannot form a meld alone, but can form a meld with joker-retrievable!
      // d9: deadwood for discard
      state.players[1].hand = [
        { id: 's5', suit: 'SPADES' as const, rank: 5 as any, isNaturalJoker: false, isJoker: false },
        { id: 'h7', suit: 'HEARTS' as const, rank: 7 as any, isNaturalJoker: false, isJoker: false },
        { id: 'h8', suit: 'HEARTS' as const, rank: 8 as any, isNaturalJoker: false, isJoker: false },
        { id: 'd9', suit: 'DIAMONDS' as const, rank: 9 as any, isNaturalJoker: false, isJoker: false },
      ];

      const botConfig = createTestBotConfig();
      const dispatchedActions: any[] = [];
      const handleAction = vi.fn((act) => {
        dispatchedActions.push(act);
        return true;
      });

      runHook(() =>
        useBotGame({
          appMode: 'BOTS',
          gameState: state,
          botConfig,
          handleAction,
          meldDelayMs: 0,
        })
      );

      vi.advanceTimersByTime(250);

      // Bot should have executed ADD_TO_MELD (retrieving the joker),
      // re-planned mid-turn, and also executed PLAY_NEW_MELD using the retrieved Joker!
      const meldActions = dispatchedActions.filter(
        (a) => a.type === 'ADD_TO_MELD' || a.type === 'PLAY_NEW_MELD'
      );
      expect(meldActions.length).toBe(2);
      expect(meldActions[0].type).toBe('ADD_TO_MELD');
      expect(meldActions[0].cardIds).toEqual(['s5']);
      expect(meldActions[1].type).toBe('PLAY_NEW_MELD');
      expect(meldActions[1].cardIds).toContain('joker-retrievable');
    });

    it('mid-turn Pukar claim selects best deck, updates working state, and dispatches melds before discarding', () => {
      vi.useFakeTimers();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1;
      state.phase = 'DISCARD';
      state.players[1].team = 'B';
      state.players[1].hand = [
        { id: 'c_discard_mid', suit: 'DIAMONDS', rank: 9 as any, isNaturalJoker: false, isJoker: false },
      ];

      // Table has pure meld
      const tableMeld = {
        id: 'table-pure-b',
        team: 'B' as const,
        type: 'RUN' as const,
        suit: 'HEARTS' as const,
        cards: [
          { id: 'h3', suit: 'HEARTS' as const, rank: 3 as any, isNaturalJoker: false, isJoker: false },
          { id: 'h4', suit: 'HEARTS' as const, rank: 4 as any, isNaturalJoker: false, isJoker: false },
          { id: 'h5', suit: 'HEARTS' as const, rank: 5 as any, isNaturalJoker: false, isJoker: false },
        ],
        slots: [
          { card: { id: 'h3', suit: 'HEARTS' as const, rank: 3 as any, isNaturalJoker: false, isJoker: false }, representedRank: 3, isWildcard: false },
          { card: { id: 'h4', suit: 'HEARTS' as const, rank: 4 as any, isNaturalJoker: false, isJoker: false }, representedRank: 4, isWildcard: false },
          { card: { id: 'h5', suit: 'HEARTS' as const, rank: 5 as any, isNaturalJoker: false, isJoker: false }, representedRank: 5, isWildcard: false },
        ],
        points: 30,
        isClean: true,
        isPure: true,
        isPure13: false,
      };
      state.melds.B = [tableMeld];

      // Deck 0 has 0 melds (all deadwood)
      const deck0: Card[] = [
        { id: 's4', suit: 'SPADES', rank: 4 as any, isNaturalJoker: false, isJoker: false },
        { id: 's7', suit: 'SPADES', rank: 7 as any, isNaturalJoker: false, isJoker: false },
        { id: 's10', suit: 'SPADES', rank: 10 as any, isNaturalJoker: false, isJoker: false },
        { id: 'd4', suit: 'DIAMONDS', rank: 4 as any, isNaturalJoker: false, isJoker: false },
        { id: 'd6', suit: 'DIAMONDS', rank: 6 as any, isNaturalJoker: false, isJoker: false },
        { id: 'd8', suit: 'DIAMONDS', rank: 8 as any, isNaturalJoker: false, isJoker: false },
        { id: 'd10', suit: 'DIAMONDS', rank: 10 as any, isNaturalJoker: false, isJoker: false },
        { id: 'd12', suit: 'DIAMONDS', rank: 12 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c5', suit: 'CLUBS', rank: 5 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c7', suit: 'CLUBS', rank: 7 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c9', suit: 'CLUBS', rank: 9 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c11', suit: 'CLUBS', rank: 11 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c13', suit: 'CLUBS', rank: 13 as any, isNaturalJoker: false, isJoker: false },
      ];

      // Deck 1 has 2 melds (h7, h8, h9) and (c4, c5_alt, c6)
      const deck1: Card[] = [
        { id: 'h7', suit: 'HEARTS', rank: 7 as any, isNaturalJoker: false, isJoker: false },
        { id: 'h8', suit: 'HEARTS', rank: 8 as any, isNaturalJoker: false, isJoker: false },
        { id: 'h9', suit: 'HEARTS', rank: 9 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c4', suit: 'CLUBS', rank: 4 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c5_alt', suit: 'CLUBS', rank: 5 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c6', suit: 'CLUBS', rank: 6 as any, isNaturalJoker: false, isJoker: false },
        { id: 's9', suit: 'SPADES', rank: 9 as any, isNaturalJoker: false, isJoker: false },
        { id: 's11', suit: 'SPADES', rank: 11 as any, isNaturalJoker: false, isJoker: false },
        { id: 'd5', suit: 'DIAMONDS', rank: 5 as any, isNaturalJoker: false, isJoker: false },
        { id: 'd7', suit: 'DIAMONDS', rank: 7 as any, isNaturalJoker: false, isJoker: false },
        { id: 'd9_alt', suit: 'DIAMONDS', rank: 9 as any, isNaturalJoker: false, isJoker: false },
        { id: 'h11', suit: 'HEARTS', rank: 11 as any, isNaturalJoker: false, isJoker: false },
        { id: 'h13', suit: 'HEARTS', rank: 13 as any, isNaturalJoker: false, isJoker: false },
      ];

      state.pukarPool = [deck0, deck1];

      const botConfig = createTestBotConfig();
      const dispatchedActions: any[] = [];
      let currentState = state;
      const stateMap = new Map<number, any>();

      const handleAction = vi.fn((act: any) => {
        dispatchedActions.push(act);
        const res = pukarReducer(currentState, act);
        if (!res.error) {
          currentState = res.state;
          runHook(
            () =>
              useBotGame({
                appMode: 'BOTS',
                gameState: currentState,
                botConfig,
                handleAction,
                turnDelayMs: 250,
                meldDelayMs: 0,
              }),
            stateMap
          );
          return true;
        }
        return false;
      });

      runHook(
        () =>
          useBotGame({
            appMode: 'BOTS',
            gameState: currentState,
            botConfig,
            handleAction,
            turnDelayMs: 250,
            meldDelayMs: 0,
          }),
        stateMap
      );

      // Discard initial card to claim Pukar
      vi.advanceTimersByTime(250);
      expect(dispatchedActions[0]).toEqual({ type: 'DISCARD_CARD', cardId: 'c_discard_mid' });

      // In MELD phase, bot should select deck 1 and meld from deck1 cards
      vi.advanceTimersByTime(250);
      const deckSelectActions = dispatchedActions.filter((a) => a.type === 'SELECT_PUKAR_DECK');
      expect(deckSelectActions.length).toBe(1);
      expect(deckSelectActions[0]).toEqual({ type: 'SELECT_PUKAR_DECK', deckIndex: 1 });

      const meldActions = dispatchedActions.filter((a) => a.type === 'PLAY_NEW_MELD');
      expect(meldActions.length).toBeGreaterThanOrEqual(1);
      const meldedCardIds = meldActions.flatMap((a: any) => a.cardIds);
      expect(meldedCardIds.some((id: string) => id === 'h7' || id === 'c4')).toBe(true);

      // In DISCARD phase, bot should discard 1 card
      vi.advanceTimersByTime(250);
      const discardActions = dispatchedActions.filter((a) => a.type === 'DISCARD_CARD');
      expect(discardActions.length).toBe(2);
    });
  });

  describe('useTableShortcuts listener stabilization', () => {
    it('holds onAction in ref so listener is not re-attached when onAction changes', () => {
      let addCount = 0;
      let removeCount = 0;

      globalThis.window.addEventListener = (_ev: string, _cb: any) => {
        addCount++;
      };
      globalThis.window.removeEventListener = (_ev: string, _cb: any) => {
        removeCount++;
      };

      const stateMap = new Map<number, any>();
      const onAction1 = vi.fn();

      // First render
      runHook(() => useTableShortcuts({ currentScreen: 'GAME', onAction: onAction1 }), stateMap);
      expect(addCount).toBe(1);

      // Re-render with new onAction reference
      const onAction2 = vi.fn();
      runHook(() => useTableShortcuts({ currentScreen: 'GAME', onAction: onAction2 }), stateMap);

      // addEventListener was NOT called again because onAction is stored in a ref
      expect(addCount).toBe(1);
      expect(removeCount).toBe(0);
    });
  });

  describe('Fast Chachi heuristic fix', () => {
    function makeCard(id: string, suit: any, rank: number): Card {
      return {
        id,
        suit,
        rank: rank as any,
        isNaturalJoker: false,
        isJoker: rank === 2 || rank === 0,
      };
    }

    it('requires top card of discard pile to be part of the extreme meld before taking discard', () => {
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1;
      state.phase = 'DRAW';

      // Hand already contains an extreme sequence: A♠-2♠-3♠
      // and another junk card: 7♦
      state.players[1].hand = [
        makeCard('c1', 'SPADES', 14),
        makeCard('c2', 'SPADES', 2),
        makeCard('c3', 'SPADES', 3),
        makeCard('c4', 'DIAMONDS', 7),
      ];

      // Discard pile has only 1 card, and it is a junk card 9♥ (not part of any meld!)
      const topDiscard = makeCard('top1', 'HEARTS', 9);
      state.discardPile = [topDiscard];

      const plan = decideFastChachiTurn(state, 1, {
        cardLog: [],
        bottomPickupsByPlayer: {},
        discardsByPlayer: {},
      });

      // Top card 9♥ is completely unrelated to the extreme meld, so Fast Chachi must DRAW_FROM_STOCK
      expect(plan.drawAction.type).toBe('DRAW_FROM_STOCK');
    });

    it('takes discard when top card completes an extreme meld', () => {
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1;
      state.phase = 'DRAW';

      // Hand has A♠ and 2♠
      state.players[1].hand = [
        makeCard('c1', 'SPADES', 14),
        makeCard('c2', 'SPADES', 2),
        makeCard('c4', 'DIAMONDS', 7),
      ];

      // Discard top card is 3♠, which connects to form extreme run A-2-3!
      const topDiscard = makeCard('top1', 'SPADES', 3);
      state.discardPile = [topDiscard];

      const plan = decideFastChachiTurn(state, 1, {
        cardLog: [],
        bottomPickupsByPlayer: {},
        discardsByPlayer: {},
      });

      // Top card is part of the extreme meld, so Fast Chachi takes it!
      expect(plan.drawAction.type).toBe('TAKE_DISCARD');
    });

    it('does not take discard when top card completes a set (three-of-a-kind) of Kings instead of a sequence run', () => {
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1;
      state.phase = 'DRAW';
      // Hand already opened a pure meld
      state.melds = {
        A: [],
        B: [
          {
            id: 'm_open',
            team: 'B',
            type: 'RUN',
            suit: 'SPADES',
            cards: [makeCard('o1', 'SPADES', 5), makeCard('o2', 'SPADES', 6), makeCard('o3', 'SPADES', 7)],
            slots: [],
            isClean: true,
            isPure: true,
            isPure13: false,
            points: 10,
          },
        ],
      };

      // Hand has K♠ and K♦
      state.players[1].hand = [
        makeCard('k1', 'SPADES', 13),
        makeCard('k2', 'DIAMONDS', 13),
        makeCard('j1', 'CLUBS', 6),
      ];

      // Discard top card is K♣ (completing a SET of Kings, NOT a run)
      state.discardPile = [makeCard('k3', 'CLUBS', 13)];

      const plan = decideFastChachiTurn(state, 1, {
        cardLog: [],
        bottomPickupsByPlayer: {},
        discardsByPlayer: {},
      });

      // A set of Kings is not an extreme run, so Fast Chachi does NOT take it (draws stock)
      expect(plan.drawAction.type).toBe('DRAW_FROM_STOCK');
    });
  });

  describe('useMultiplayerGame memoization stability', () => {
    it('returns the same object reference identity across re-renders when state has not changed', () => {
      const stateMap = new Map<number, any>();

      const { result: firstRender } = runHook(() => useMultiplayerGame({ autoConnect: false }), stateMap);
      const { result: secondRender } = runHook(() => useMultiplayerGame({ autoConnect: false }), stateMap);

      expect(firstRender).toBe(secondRender);
    });
  });

  function setupStatefulReactHooks() {
    const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const stateSlots: any[] = [];
    const refSlots: any[] = [];
    let stateIdx = 0;
    let refIdx = 0;

    const resetIndices = () => {
      stateIdx = 0;
      refIdx = 0;
    };

    if (internals) {
      internals.H = {
        useState: (init: any) => {
          const slot = stateIdx++;
          if (stateSlots[slot] === undefined) {
            stateSlots[slot] = typeof init === 'function' ? init() : init;
          }
          const setter = (val: any) => {
            stateSlots[slot] = typeof val === 'function' ? val(stateSlots[slot]) : val;
          };
          return [stateSlots[slot], setter];
        },
        useEffect: () => {},
        useRef: (init: any) => {
          const slot = refIdx++;
          if (!refSlots[slot]) {
            refSlots[slot] = { current: init };
          }
          return refSlots[slot];
        },
        useCallback: (fn: any) => fn,
        useMemo: (fn: any) => fn(),
        useId: () => 'test-id',
      };
    }

    return { resetIndices, stateSlots, refSlots };
  }

  function findElement(element: any, predicate: (el: any) => boolean): any {
    if (!element || typeof element !== 'object') return null;
    if (predicate(element)) return element;
    if (element.props && element.props.children) {
      const children = Array.isArray(element.props.children)
        ? element.props.children
        : [element.props.children];
      for (const child of children) {
        const found = findElement(child, predicate);
        if (found) return found;
      }
    }
    return null;
  }

  describe('App BOTS mode Uncle Pukar modal isolation', () => {

    it('does not show Uncle Pukar modal when a bot earns Pukar in BOTS mode', () => {
      const harness = setupStatefulReactHooks();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1; // Bot turn
      const botConfig = createTestBotConfig();

      const tree1 = App({
        initialState: state,
        initialMode: 'BOTS',
        initialScreen: 'GAME',
        initialBotConfig: botConfig,
        initialPukarSlamEvent: {
          team: 'B',
          playerName: 'Fast Chachi',
          points: 50,
          playerIndex: 1, // Bot
        },
      });

      const pukarSlam = findElement(
        tree1,
        (el) => Boolean(el.props?.onClose && el.props?.onImpact)
      );
      expect(pukarSlam).not.toBeNull();

      // Trigger slam overlay dismissal
      pukarSlam.props.onClose();

      // Pass 2: Re-render
      harness.resetIndices();
      const tree2 = App({
        initialState: state,
        initialMode: 'BOTS',
        initialScreen: 'GAME',
        initialBotConfig: botConfig,
      });

      // Uncle Pukar modal should NOT be opened for bot
      const modal = findElement(tree2, (el) => el.type === UnclePukarChoiceModal);
      expect(modal).toBeNull();
    });

    it('shows Uncle Pukar modal when human player earns Pukar', () => {
      const harness = setupStatefulReactHooks();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 0; // Human turn
      const botConfig = createTestBotConfig();

      const tree1 = App({
        initialState: state,
        initialMode: 'BOTS',
        initialScreen: 'GAME',
        initialBotConfig: botConfig,
        initialPukarSlamEvent: {
          team: 'A',
          playerName: 'You',
          points: 50,
          playerIndex: 0, // Human
        },
      });

      const pukarSlam = findElement(
        tree1,
        (el) => Boolean(el.props?.onClose && el.props?.onImpact)
      );
      expect(pukarSlam).not.toBeNull();

      // Trigger slam overlay dismissal
      pukarSlam.props.onClose();

      // Pass 2: Re-render
      harness.resetIndices();
      const tree2 = App({
        initialState: state,
        initialMode: 'BOTS',
        initialScreen: 'GAME',
        initialBotConfig: botConfig,
      });

      // Uncle Pukar modal should be opened for human
      const modal = findElement(tree2, (el) => el.type === UnclePukarChoiceModal);
      expect(modal).not.toBeNull();
      expect(modal.props.isOpen).toBe(true);
      expect(modal.props.playerName).toBe('You');
    });

    it('correctly isolates modal to dynamic human seat', () => {
      const state = dealInitialState(4);
      state.currentPlayerIndex = 2;
      // Configure Seat 2 as human instead of Seat 0
      const botConfig: BotGameConfig = {
        playerCount: 4,
        seats: [
          { seatIndex: 0, name: 'Sid', personality: 'smart_chacha', isHuman: false },
          { seatIndex: 1, name: 'Chachi', personality: 'fast_chachi', isHuman: false },
          { seatIndex: 2, name: 'You', personality: 'smart_chacha', isHuman: true },
          { seatIndex: 3, name: 'Harsh', personality: 'the_long_term_guy', isHuman: false },
        ],
      };

      // 1. Bot (Seat 0) earned Pukar -> onClose -> modal must be null
      const harnessBot = setupStatefulReactHooks();
      const treeBot1 = App({
        initialState: state,
        initialMode: 'BOTS',
        initialScreen: 'GAME',
        initialBotConfig: botConfig,
        initialPukarSlamEvent: {
          team: 'A',
          playerName: 'Sid',
          points: 50,
          playerIndex: 0,
        },
      });
      const pukarSlamBot = findElement(
        treeBot1,
        (el) => Boolean(el.props?.onClose && el.props?.onImpact)
      );
      expect(pukarSlamBot).not.toBeNull();
      pukarSlamBot.props.onClose();

      harnessBot.resetIndices();
      const treeBot2 = App({
        initialState: state,
        initialMode: 'BOTS',
        initialScreen: 'GAME',
        initialBotConfig: botConfig,
      });
      expect(findElement(treeBot2, (el) => el.type === UnclePukarChoiceModal)).toBeNull();

      // 2. Human (Seat 2) earned Pukar -> onClose -> modal must be shown
      const harnessHuman = setupStatefulReactHooks();
      const treeHuman1 = App({
        initialState: state,
        initialMode: 'BOTS',
        initialScreen: 'GAME',
        initialBotConfig: botConfig,
        initialPukarSlamEvent: {
          team: 'A',
          playerName: 'You',
          points: 50,
          playerIndex: 2,
        },
      });
      const pukarSlamHuman = findElement(
        treeHuman1,
        (el) => Boolean(el.props?.onClose && el.props?.onImpact)
      );
      expect(pukarSlamHuman).not.toBeNull();
      pukarSlamHuman.props.onClose();

      harnessHuman.resetIndices();
      const treeHuman2 = App({
        initialState: state,
        initialMode: 'BOTS',
        initialScreen: 'GAME',
        initialBotConfig: botConfig,
      });
      const modalHuman = findElement(treeHuman2, (el) => el.type === UnclePukarChoiceModal);
      expect(modalHuman).not.toBeNull();
      expect(modalHuman.props.isOpen).toBe(true);
      expect(modalHuman.props.playerName).toBe('You');
    });
  });

  describe('Bot Pausing on Pukar Claim Modal Flow', () => {
    it('halts bot execution when isPaused is true, not executing any action even after delay', () => {
      vi.useFakeTimers();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1; // Bot turn
      state.phase = 'DRAW';
      const botConfig = createTestBotConfig();
      const handleAction = vi.fn();

      const { result } = runHook(() =>
        useBotGame({
          appMode: 'BOTS',
          gameState: state,
          botConfig,
          handleAction,
          turnDelayMs: 1500,
          isPaused: true,
        })
      );

      // Verify isThinking is false while paused
      expect(result.botStatus?.isThinking).toBe(false);

      // Advance timers by 5,000ms (way beyond 1,500ms delay)
      vi.advanceTimersByTime(5000);

      // Bot did NOT start or take any action
      expect(handleAction).not.toHaveBeenCalled();
    });

    it('resumes bot turn after isPaused transitions to false, with full turnDelayMs pacing before action', () => {
      vi.useFakeTimers();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1; // Bot turn
      state.phase = 'DRAW';
      const botConfig = createTestBotConfig();
      const handleAction = vi.fn();
      const stateMap = new Map<number, any>();

      // Render 1: Paused (user looking at Pukar claim modal)
      const { result: res1 } = runHook(
        () =>
          useBotGame({
            appMode: 'BOTS',
            gameState: state,
            botConfig,
            handleAction,
            turnDelayMs: 1500,
            isPaused: true,
          }),
        stateMap
      );
      expect(res1.botStatus?.isThinking).toBe(false);

      vi.advanceTimersByTime(2000);
      expect(handleAction).not.toHaveBeenCalled();

      // Render 2: Unpaused (user clicked "Continue Playing" on modal)
      const { result: res2 } = runHook(
        () =>
          useBotGame({
            appMode: 'BOTS',
            gameState: state,
            botConfig,
            handleAction,
            turnDelayMs: 1500,
            isPaused: false,
          }),
        stateMap
      );

      // Bot is now thinking, but has NOT started immediately!
      expect(res2.botStatus?.isThinking).toBe(true);
      expect(handleAction).not.toHaveBeenCalled();

      // Advance 1,400ms (still within pacing delay)
      vi.advanceTimersByTime(1400);
      expect(handleAction).not.toHaveBeenCalled();

      // Advance remaining 100ms (1,500ms total)
      vi.advanceTimersByTime(100);
      expect(handleAction).toHaveBeenCalledTimes(1);
    });

    it('passes autoDismissMs=0 to PukarSlamOverlay in BOTS mode so modal stays until user clicks Continue Playing', () => {
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1;
      const botConfig = createTestBotConfig();

      setupStatefulReactHooks();
      const tree = App({
        initialState: state,
        initialMode: 'BOTS',
        initialScreen: 'GAME',
        initialBotConfig: botConfig,
        initialPukarSlamEvent: {
          team: 'B',
          playerName: 'Chachi',
          points: 50,
          playerIndex: 1,
        },
      });

      const pukarSlam = findElement(
        tree,
        (el) => Boolean(el.props?.onClose && el.props?.onImpact)
      );

      expect(pukarSlam).not.toBeNull();
      // In BOTS mode, autoDismissMs is 0 so it does not auto-dismiss
      expect(pukarSlam.props.autoDismissMs).toBe(0);
      expect(pukarSlam.props.playerName).toBe('Chachi');
      expect(pukarSlam.props.points).toBe(50);
    });

    it('Fast Chachi successfully opens table with pure sequence (4♦-5♦-6♦) and secondary dirty run in same turn', () => {
      vi.useFakeTimers();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1; // Fast Chachi (Team B)
      state.phase = 'MELD';
      state.melds = { A: [], B: [] }; // No one has opened

      const fastChachiHand: Card[] = [
        { id: 's8', suit: 'SPADES', rank: 8 as any, isNaturalJoker: false, isJoker: false },
        { id: 'd6', suit: 'DIAMONDS', rank: 6 as any, isNaturalJoker: false, isJoker: false },
        { id: 'sq', suit: 'SPADES', rank: 12 as any, isNaturalJoker: false, isJoker: false },
        { id: 'dj1', suit: 'DIAMONDS', rank: 11 as any, isNaturalJoker: false, isJoker: false },
        { id: 'jk', suit: null, rank: 0 as any, isNaturalJoker: true, isJoker: true },
        { id: 'cj', suit: 'CLUBS', rank: 11 as any, isNaturalJoker: false, isJoker: false },
        { id: 'd2', suit: 'DIAMONDS', rank: 2 as any, isNaturalJoker: false, isJoker: true },
        { id: 'h8', suit: 'HEARTS', rank: 8 as any, isNaturalJoker: false, isJoker: false },
        { id: 'ha', suit: 'HEARTS', rank: 14 as any, isNaturalJoker: false, isJoker: false },
        { id: 'd4', suit: 'DIAMONDS', rank: 4 as any, isNaturalJoker: false, isJoker: false },
        { id: 'dj2', suit: 'DIAMONDS', rank: 11 as any, isNaturalJoker: false, isJoker: false },
        { id: 'd5', suit: 'DIAMONDS', rank: 5 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c3', suit: 'CLUBS', rank: 3 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c7', suit: 'CLUBS', rank: 7 as any, isNaturalJoker: false, isJoker: false },
        { id: 's10', suit: 'SPADES', rank: 10 as any, isNaturalJoker: false, isJoker: false },
        { id: 'h3', suit: 'HEARTS', rank: 3 as any, isNaturalJoker: false, isJoker: false },
        { id: 'h5', suit: 'HEARTS', rank: 5 as any, isNaturalJoker: false, isJoker: false },
        { id: 's4', suit: 'SPADES', rank: 4 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c9', suit: 'CLUBS', rank: 9 as any, isNaturalJoker: false, isJoker: false },
      ];
      state.players[1].hand = [...fastChachiHand];
      state.players[1].team = 'B';

      const botConfig = createTestBotConfig();
      const dispatchedActions: any[] = [];
      let currentState = state;
      const stateMap = new Map<number, any>();

      const handleAction = vi.fn((act: any) => {
        dispatchedActions.push(act);
        const res = pukarReducer(currentState, act);
        if (!res.error) {
          currentState = res.state;
          return true;
        }
        return false;
      });

      runHook(
        () =>
          useBotGame({
            appMode: 'BOTS',
            gameState: currentState,
            botConfig,
            handleAction,
            turnDelayMs: 250,
          }),
        stateMap
      );

      // Execute MELD phase
      vi.advanceTimersByTime(250);

      // Check meld actions dispatched
      const meldActions = dispatchedActions.filter((a) => a.type === 'PLAY_NEW_MELD');
      expect(meldActions.length).toBeGreaterThanOrEqual(1);

      // First meld must be the pure sequence 4♦, 5♦, 6♦
      const firstMeldCards = meldActions[0].cardIds;
      expect(firstMeldCards).toContain('d4');
      expect(firstMeldCards).toContain('d5');
      expect(firstMeldCards).toContain('d6');

      // Check that team B now has melds on the table and the board is open
      expect(currentState.melds.B.length).toBeGreaterThanOrEqual(1);
      expect(currentState.melds.B[0].isPure).toBe(true);
    });

    it('The Long-Term Guy successfully opens table with pure sequence (8♣-9♣-10♣-J♣) and secondary dirty run in same turn', () => {
      vi.useFakeTimers();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 3; // The Long-Term Guy (Team B, seat 3)
      state.phase = 'MELD';
      state.melds = { A: [], B: [] }; // No one has opened

      const longTermHand: Card[] = [
        { id: 'h7', suit: 'HEARTS', rank: 7 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c10', suit: 'CLUBS', rank: 10 as any, isNaturalJoker: false, isJoker: false },
        { id: 'hq', suit: 'HEARTS', rank: 12 as any, isNaturalJoker: false, isJoker: false },
        { id: 'h9', suit: 'HEARTS', rank: 9 as any, isNaturalJoker: false, isJoker: false },
        { id: 'jk', suit: null, rank: 0 as any, isNaturalJoker: true, isJoker: true },
        { id: 'c9', suit: 'CLUBS', rank: 9 as any, isNaturalJoker: false, isJoker: false },
        { id: 'ca', suit: 'CLUBS', rank: 14 as any, isNaturalJoker: false, isJoker: false },
        { id: 'da', suit: 'DIAMONDS', rank: 14 as any, isNaturalJoker: false, isJoker: false },
        { id: 'c8', suit: 'CLUBS', rank: 8 as any, isNaturalJoker: false, isJoker: false },
        { id: 's2', suit: 'SPADES', rank: 2 as any, isNaturalJoker: false, isJoker: true },
        { id: 'ha', suit: 'HEARTS', rank: 14 as any, isNaturalJoker: false, isJoker: false },
        { id: 'cj', suit: 'CLUBS', rank: 11 as any, isNaturalJoker: false, isJoker: false },
        { id: 's3', suit: 'SPADES', rank: 3 as any, isNaturalJoker: false, isJoker: false },
      ];
      state.players[3].hand = [...longTermHand];
      state.players[3].team = 'B';

      const botConfig = createTestBotConfig();
      const dispatchedActions: any[] = [];
      let currentState = state;
      const stateMap = new Map<number, any>();

      const handleAction = vi.fn((act: any) => {
        dispatchedActions.push(act);
        const res = pukarReducer(currentState, act);
        if (!res.error) {
          currentState = res.state;
          return true;
        }
        return false;
      });

      runHook(
        () =>
          useBotGame({
            appMode: 'BOTS',
            gameState: currentState,
            botConfig,
            handleAction,
            turnDelayMs: 250,
          }),
        stateMap
      );

      // Execute MELD phase
      vi.advanceTimersByTime(250);

      // Check meld actions dispatched
      const meldActions = dispatchedActions.filter((a) => a.type === 'PLAY_NEW_MELD');
      expect(meldActions.length).toBeGreaterThanOrEqual(1);

      // First meld must be the pure sequence 8♣, 9♣, 10♣, J♣
      const firstMeldCards = meldActions[0].cardIds;
      expect(firstMeldCards).toContain('c8');
      expect(firstMeldCards).toContain('c9');
      expect(firstMeldCards).toContain('c10');
      expect(firstMeldCards).toContain('cj');

      // Check that team B now has melds on the table and the board is open
      expect(currentState.melds.B.length).toBeGreaterThanOrEqual(1);
      expect(currentState.melds.B[0].isPure).toBe(true);
    });

    it('waits 2 seconds (meldDelayMs) between placing consecutive sequences so human players can process them', () => {
      vi.useFakeTimers();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1; // Chachi
      state.phase = 'MELD';
      state.turnPhase = 'MELD';
      state.melds = { A: [], B: [] }; // Team B opening turn

      // Hand with a Pure sequence (4♠, 5♠, 6♠) AND a Dirty sequence (8♥, 9♥, Natural Joker) + discard card
      const c4s = { id: 'c4s', suit: 'SPADES' as const, rank: 4 as const, isNaturalJoker: false, isJoker: false };
      const c5s = { id: 'c5s', suit: 'SPADES' as const, rank: 5 as const, isNaturalJoker: false, isJoker: false };
      const c6s = { id: 'c6s', suit: 'SPADES' as const, rank: 6 as const, isNaturalJoker: false, isJoker: false };

      const c8h = { id: 'c8h', suit: 'HEARTS' as const, rank: 8 as const, isNaturalJoker: false, isJoker: false };
      const c9h = { id: 'c9h', suit: 'HEARTS' as const, rank: 9 as const, isNaturalJoker: false, isJoker: false };
      const cJoker = { id: 'cJoker', suit: null, rank: 0 as const, isNaturalJoker: true, isJoker: true };

      const cDis = { id: 'cDis', suit: 'CLUBS' as const, rank: 2 as const, isNaturalJoker: false, isJoker: false };

      state.players[1].hand = [c4s, c5s, c6s, c8h, c9h, cJoker, cDis];

      const botConfig = createTestBotConfig();
      const dispatchedActions: any[] = [];
      let currentState = state;

      const handleAction = vi.fn((act: any) => {
        dispatchedActions.push(act);
        const res = pukarReducer(currentState, act);
        if (!res.error) {
          currentState = res.state;
          return true;
        }
        return false;
      });

      const stateMap = new Map<number, any>();
      runHook(
        () =>
          useBotGame({
            appMode: 'BOTS',
            gameState: currentState,
            botConfig,
            handleAction,
            turnDelayMs: 250,
            meldDelayMs: 2000,
          }),
        stateMap
      );

      // Advance initial turn delay into MELD phase
      vi.advanceTimersByTime(250);

      // Sequence 1 (Pure run) must be dispatched
      const meldsAfterFirst = dispatchedActions.filter((a) => a.type === 'PLAY_NEW_MELD');
      expect(meldsAfterFirst.length).toBe(1);

      // Sequence 2 must NOT be dispatched yet!
      expect(dispatchedActions.some((a) => a.type === 'DISCARD_CARD')).toBe(false);

      // Advance 1000ms (< 2000ms)
      vi.advanceTimersByTime(1000);
      expect(dispatchedActions.filter((a) => a.type === 'PLAY_NEW_MELD').length).toBe(1);

      // Advance remaining 1000ms (total 2000ms meldDelayMs elapsed)
      vi.advanceTimersByTime(1000);

      // Sequence 2 (Dirty run) must now be dispatched!
      const meldsAfterSecond = dispatchedActions.filter((a) => a.type === 'PLAY_NEW_MELD');
      expect(meldsAfterSecond.length).toBe(2);

      // Advance turnDelayMs to DISCARD subphase
      vi.advanceTimersByTime(250);
      expect(dispatchedActions.some((a) => a.type === 'DISCARD_CARD')).toBe(true);
    });
  });
});
