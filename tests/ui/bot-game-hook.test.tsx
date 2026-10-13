import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from '../../src/App';
import { UnclePukarChoiceModal } from '../../src/ui/components/UnclePukarChoiceModal';
import { useBotGame } from '../../src/ui/hooks/useBotGame';
import { useTableShortcuts } from '../../src/ui/hooks/useTableShortcuts';
import { useMultiplayerGame } from '../../src/network/useMultiplayerGame';
import { dealInitialState } from '../../src/engine/deck';
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
        { seatIndex: 1, name: 'Fast Chachi', personality: 'fast_chachi', isHuman: false },
        { seatIndex: 2, name: 'Smart Chacha', personality: 'smart_chacha', isHuman: false },
        { seatIndex: 3, name: 'The long-term guy', personality: 'the_long_term_guy', isHuman: false },
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
      expect(result.botStatus?.botName).toBe('Fast Chachi');
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

  describe('App BOTS mode Uncle Pukar modal isolation', () => {
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
          { seatIndex: 0, name: 'Smart Chacha', personality: 'smart_chacha', isHuman: false },
          { seatIndex: 1, name: 'Fast Chachi', personality: 'fast_chachi', isHuman: false },
          { seatIndex: 2, name: 'You', personality: 'smart_chacha', isHuman: true },
          { seatIndex: 3, name: 'The long-term guy', personality: 'the_long_term_guy', isHuman: false },
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
          playerName: 'Smart Chacha',
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
});
