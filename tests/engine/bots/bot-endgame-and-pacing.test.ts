import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { dealInitialState } from '../../../src/engine/deck';
import { pukarReducer } from '../../../src/engine/reducer';
import { decideBotTurn } from '../../../src/engine/bots/bot-player';
import { findBestMeldPlan } from '../../../src/engine/bots/hand-analyzer';
import { createInitialBotMemory } from '../../../src/engine/bots/bot-player';
import { Card, GameAction, Meld } from '../../../src/engine/types';
import { useBotGame } from '../../../src/ui/hooks/useBotGame';
import { BotGameConfig } from '../../../src/engine/bots/types';

describe('Bot End-Game & Pacing Bug Verifications', () => {
  it('does not commit all cards when hand has 2 cards and table additions exist (must keep at least 1 card to discard)', () => {
    // Bot hand has 2 cards: 7♠ and 8♠
    const hand: Card[] = [
      { id: 's7', suit: 'SPADES', rank: 7, isNaturalJoker: false, isJoker: false },
      { id: 's8', suit: 'SPADES', rank: 8, isNaturalJoker: false, isJoker: false },
    ];

    const s4: Card = { id: 's4', suit: 'SPADES', rank: 4, isNaturalJoker: false, isJoker: false };
    const s5: Card = { id: 's5', suit: 'SPADES', rank: 5, isNaturalJoker: false, isJoker: false };
    const s6: Card = { id: 's6', suit: 'SPADES', rank: 6, isNaturalJoker: false, isJoker: false };

    // Table has an existing Spades sequence 4♠-5♠-6♠
    const tableMelds: Meld[] = [
      {
        id: 'meld-r1-A-1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [s4, s5, s6],
        slots: [
          { card: s4, representedRank: 4, isWildcard: false },
          { card: s5, representedRank: 5, isWildcard: false },
          { card: s6, representedRank: 6, isWildcard: false },
        ],
        points: 30,
        isClean: true,
        isPure: true,
        isPure13: false,
      },
    ];

    // With preserveDiscardCard enabled, findBestMeldPlan must NOT commit both cards!
    const plan = findBestMeldPlan(hand, tableMelds, { preserveDiscardCard: true });

    // It should add exactly 1 card (s7), leaving 1 card (s8) in hand to discard
    expect(plan.additionsToPlay.length).toBe(1);
    expect(plan.additionsToPlay[0].cards.length).toBe(1);
    expect(plan.additionsToPlay[0].cards[0].id).toBe('s7');
    expect(plan.usedCardIds.size).toBe(1);
  });

  it('completes game cleanly when bot has 1 card, draws, melds 1 card, discards last card with 0 Pukars left', () => {
    const state = dealInitialState(4);
    // Exhaust Pukar pool and set Player 1 as active bot on Team B
    state.pukarPool = [];
    state.currentPlayerIndex = 1;
    state.phase = 'MELD';
    state.roundStatus = 'PLAYING';

    // Player 1 has 2 cards (1 card left + 1 drawn card)
    state.players[1].team = 'B';
    state.players[1].hand = [
      { id: 'h7', suit: 'HEARTS', rank: 7, isNaturalJoker: false, isJoker: false },
      { id: 'c9', suit: 'CLUBS', rank: 9, isNaturalJoker: false, isJoker: false },
    ];

    const h4: Card = { id: 'h4', suit: 'HEARTS', rank: 4, isNaturalJoker: false, isJoker: false };
    const h5: Card = { id: 'h5', suit: 'HEARTS', rank: 5, isNaturalJoker: false, isJoker: false };
    const h6: Card = { id: 'h6', suit: 'HEARTS', rank: 6, isNaturalJoker: false, isJoker: false };

    // Team B has a sequence of Hearts 4♥-5♥-6♥ on table
    const teamBMeld: Meld = {
      id: 'meld-r1-B-1',
      team: 'B',
      type: 'RUN',
      suit: 'HEARTS',
      cards: [h4, h5, h6],
      slots: [
        { card: h4, representedRank: 4, isWildcard: false },
        { card: h5, representedRank: 5, isWildcard: false },
        { card: h6, representedRank: 6, isWildcard: false },
      ],
      points: 30,
      isClean: true,
      isPure: true,
      isPure13: false,
    };
    state.melds.B = [teamBMeld];

    const memory = createInitialBotMemory();
    const plan = decideBotTurn(state, 1, 'smart_chacha', memory);

    // Verify meld plan leaves 1 card in hand
    expect(plan.meldActions.length).toBe(1);
    expect(plan.meldActions[0].type).toBe('ADD_TO_MELD');

    // Execute the meld action in engine
    const meldRes = pukarReducer(state, plan.meldActions[0]);
    expect(meldRes.error).toBeUndefined();
    expect(meldRes.state.players[1].hand.length).toBe(1);
    expect(meldRes.state.players[1].hand[0].id).toBe('c9');

    // Execute discard action to go out
    const discardRes = pukarReducer(meldRes.state, plan.discardAction);
    expect(discardRes.error).toBeUndefined();

    // Verify round is won and terminated cleanly!
    expect(discardRes.state.isRoundOver).toBe(true);
    expect(discardRes.state.roundStatus).toBe('ROUND_OVER');
    expect(discardRes.state.players[1].hand.length).toBe(0);
    expect(discardRes.state.scores.B).toBeGreaterThanOrEqual(50);
  });

  it('falls back to TAKE_DISCARD when stock deck is empty across all 4 bot strategies', () => {
    const personalities = ['smart_chacha', 'the_jadugar', 'fast_chachi', 'the_long_term_guy'] as const;

    for (const personality of personalities) {
      const state = dealInitialState(4);
      state.stockDeck = [];
      state.pukarPool = [];
      state.discardPile = [
        { id: 'd1', suit: 'DIAMONDS', rank: 10, isNaturalJoker: false, isJoker: false },
      ];
      state.phase = 'DRAW';
      state.currentPlayerIndex = 1;

      const memory = createInitialBotMemory();
      const plan = decideBotTurn(state, 1, personality, memory);

      // Must take discard pile because stock deck is empty
      expect(plan.drawAction.type).toBe('TAKE_DISCARD');
    }
  });

  it('cleanly ends the round if both stockDeck and discardPile are empty in DRAW phase', () => {
    const state = dealInitialState(4);
    state.stockDeck = [];
    state.discardPile = [];
    state.pukarPool = [];
    state.phase = 'DRAW';

    const res = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });
    expect(res.state.isRoundOver).toBe(true);
    expect(res.state.roundStatus).toBe('ROUND_OVER');

    const discardRes = pukarReducer(state, { type: 'TAKE_DISCARD' });
    expect(discardRes.state.isRoundOver).toBe(true);
    expect(discardRes.state.roundStatus).toBe('ROUND_OVER');
  });

  describe('Mid-Turn Pukar Claim Continuation', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

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
        };
      }

      try {
        result = hookFn();
      } finally {
        if (internals) {
          internals.H = oldH;
        }
      }

      return { result, cleanups };
    }

    it('when a bot claims a Pukar mid-turn, it executes melds from the 13 new cards in the same turn before discarding', () => {
      vi.useFakeTimers();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1;
      state.phase = 'DISCARD';
      state.roundStatus = 'PLAYING';
      state.players[1].team = 'B';

      // Bot has 1 card in hand
      state.players[1].hand = [
        { id: 'c_discard_1', suit: 'DIAMONDS', rank: 9, isNaturalJoker: false, isJoker: false },
      ];

      // Team B has a valid pure sequence on table to satisfy initial meld requirement
      const tableMeld: Meld = {
        id: 'meld-init-b',
        team: 'B',
        type: 'RUN',
        suit: 'HEARTS',
        cards: [
          { id: 'h3', suit: 'HEARTS', rank: 3, isNaturalJoker: false, isJoker: false },
          { id: 'h4', suit: 'HEARTS', rank: 4, isNaturalJoker: false, isJoker: false },
          { id: 'h5', suit: 'HEARTS', rank: 5, isNaturalJoker: false, isJoker: false },
        ],
        slots: [
          { card: { id: 'h3', suit: 'HEARTS', rank: 3, isNaturalJoker: false, isJoker: false }, representedRank: 3, isWildcard: false },
          { card: { id: 'h4', suit: 'HEARTS', rank: 4, isNaturalJoker: false, isJoker: false }, representedRank: 4, isWildcard: false },
          { card: { id: 'h5', suit: 'HEARTS', rank: 5, isNaturalJoker: false, isJoker: false }, representedRank: 5, isWildcard: false },
        ],
        points: 30,
        isClean: true,
        isPure: true,
        isPure13: false,
      };
      state.melds.B = [tableMeld];

      // Pukar pool has 13 cards containing a pure sequence of Spades (s4, s5, s6, s7) and 9 deadwood cards
      const pukarDeck: Card[] = [
        { id: 's4', suit: 'SPADES', rank: 4, isNaturalJoker: false, isJoker: false },
        { id: 's5', suit: 'SPADES', rank: 5, isNaturalJoker: false, isJoker: false },
        { id: 's6', suit: 'SPADES', rank: 6, isNaturalJoker: false, isJoker: false },
        { id: 's7', suit: 'SPADES', rank: 7, isNaturalJoker: false, isJoker: false },
        { id: 'd2', suit: 'DIAMONDS', rank: 2, isNaturalJoker: false, isJoker: true },
        { id: 'd4', suit: 'DIAMONDS', rank: 4, isNaturalJoker: false, isJoker: false },
        { id: 'd6', suit: 'DIAMONDS', rank: 6, isNaturalJoker: false, isJoker: false },
        { id: 'd8', suit: 'DIAMONDS', rank: 8, isNaturalJoker: false, isJoker: false },
        { id: 'c2', suit: 'CLUBS', rank: 2, isNaturalJoker: false, isJoker: true },
        { id: 'c5', suit: 'CLUBS', rank: 5, isNaturalJoker: false, isJoker: false },
        { id: 'c7', suit: 'CLUBS', rank: 7, isNaturalJoker: false, isJoker: false },
        { id: 'c9', suit: 'CLUBS', rank: 9, isNaturalJoker: false, isJoker: false },
        { id: 'c11', suit: 'CLUBS', rank: 11, isNaturalJoker: false, isJoker: false },
      ];
      state.pukarPool = [pukarDeck];

      const botConfig: BotGameConfig = {
        playerCount: 4,
        seats: [
          { seatIndex: 0, name: 'You', personality: 'smart_chacha', isHuman: true },
          { seatIndex: 1, name: 'Smart Chacha', personality: 'smart_chacha', isHuman: false },
          { seatIndex: 2, name: 'Partner', personality: 'the_long_term_guy', isHuman: false },
          { seatIndex: 3, name: 'Opponent', personality: 'fast_chachi', isHuman: false },
        ],
      };

      const dispatchedActions: GameAction[] = [];
      let currentState = state;
      const stateMap = new Map<number, any>();

      const handleAction = vi.fn((act: GameAction) => {
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
              }),
            stateMap
          );
          return true;
        }
        return false;
      });

      // Initial mount in DISCARD phase with 1 card in hand
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

      // 1. Advance time for initial discard: Bot discards c_discard_1 and claims Pukar
      vi.advanceTimersByTime(250);
      expect(dispatchedActions[0]).toEqual({ type: 'DISCARD_CARD', cardId: 'c_discard_1' });
      expect(currentState.players[1].hand.length).toBe(13);
      expect(currentState.phase).toBe('MELD');
      expect(currentState.initialHandSizeThisTurn).toBe(0);

      // 2. Advance time for MELD phase of fresh 13 cards
      vi.advanceTimersByTime(250);

      // Verify bot executed melds from the fresh 13 cards before discarding
      const meldActions = dispatchedActions.filter(
        (a) => a.type === 'PLAY_NEW_MELD' || a.type === 'ADD_TO_MELD'
      );
      expect(meldActions.length).toBeGreaterThanOrEqual(1);

      // 3. Advance time for final DISCARD phase of the turn
      vi.advanceTimersByTime(250);
      const discardActions = dispatchedActions.filter((a) => a.type === 'DISCARD_CARD');
      expect(discardActions.length).toBe(2); // First discard (claim) + Second discard (finish turn)
    });

    it('evaluates and executes melds from the chosen Uncle Pukar deck when selected mid-turn', () => {
      vi.useFakeTimers();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1;
      state.phase = 'DISCARD';
      state.roundStatus = 'PLAYING';
      state.players[1].team = 'B';

      state.players[1].hand = [
        { id: 'c_discard_init', suit: 'DIAMONDS', rank: 9, isNaturalJoker: false, isJoker: false },
      ];

      // Table has pure meld
      const tableMeld: Meld = {
        id: 'meld-init-b2',
        team: 'B',
        type: 'RUN',
        suit: 'HEARTS',
        cards: [
          { id: 'h3', suit: 'HEARTS', rank: 3, isNaturalJoker: false, isJoker: false },
          { id: 'h4', suit: 'HEARTS', rank: 4, isNaturalJoker: false, isJoker: false },
          { id: 'h5', suit: 'HEARTS', rank: 5, isNaturalJoker: false, isJoker: false },
        ],
        slots: [
          { card: { id: 'h3', suit: 'HEARTS', rank: 3, isNaturalJoker: false, isJoker: false }, representedRank: 3, isWildcard: false },
          { card: { id: 'h4', suit: 'HEARTS', rank: 4, isNaturalJoker: false, isJoker: false }, representedRank: 4, isWildcard: false },
          { card: { id: 'h5', suit: 'HEARTS', rank: 5, isNaturalJoker: false, isJoker: false }, representedRank: 5, isWildcard: false },
        ],
        points: 30,
        isClean: true,
        isPure: true,
        isPure13: false,
      };
      state.melds.B = [tableMeld];

      // Deck 0 has 0 melds (deadwood cards only)
      const deck0: Card[] = [
        { id: 's4', suit: 'SPADES', rank: 4, isNaturalJoker: false, isJoker: false },
        { id: 's7', suit: 'SPADES', rank: 7, isNaturalJoker: false, isJoker: false },
        { id: 's10', suit: 'SPADES', rank: 10, isNaturalJoker: false, isJoker: false },
        { id: 'd4', suit: 'DIAMONDS', rank: 4, isNaturalJoker: false, isJoker: false },
        { id: 'd6', suit: 'DIAMONDS', rank: 6, isNaturalJoker: false, isJoker: false },
        { id: 'd8', suit: 'DIAMONDS', rank: 8, isNaturalJoker: false, isJoker: false },
        { id: 'd10', suit: 'DIAMONDS', rank: 10, isNaturalJoker: false, isJoker: false },
        { id: 'd12', suit: 'DIAMONDS', rank: 12, isNaturalJoker: false, isJoker: false },
        { id: 'c5', suit: 'CLUBS', rank: 5, isNaturalJoker: false, isJoker: false },
        { id: 'c7', suit: 'CLUBS', rank: 7, isNaturalJoker: false, isJoker: false },
        { id: 'c9', suit: 'CLUBS', rank: 9, isNaturalJoker: false, isJoker: false },
        { id: 'c11', suit: 'CLUBS', rank: 11, isNaturalJoker: false, isJoker: false },
        { id: 'c13', suit: 'CLUBS', rank: 13, isNaturalJoker: false, isJoker: false },
      ];

      // Deck 1 has 2 melds (h7, h8, h9) and (c4, c5, c6)
      const deck1: Card[] = [
        { id: 'h7', suit: 'HEARTS', rank: 7, isNaturalJoker: false, isJoker: false },
        { id: 'h8', suit: 'HEARTS', rank: 8, isNaturalJoker: false, isJoker: false },
        { id: 'h9', suit: 'HEARTS', rank: 9, isNaturalJoker: false, isJoker: false },
        { id: 'c4', suit: 'CLUBS', rank: 4, isNaturalJoker: false, isJoker: false },
        { id: 'c5_alt', suit: 'CLUBS', rank: 5, isNaturalJoker: false, isJoker: false },
        { id: 'c6', suit: 'CLUBS', rank: 6, isNaturalJoker: false, isJoker: false },
        { id: 's9', suit: 'SPADES', rank: 9, isNaturalJoker: false, isJoker: false },
        { id: 's11', suit: 'SPADES', rank: 11, isNaturalJoker: false, isJoker: false },
        { id: 'd5', suit: 'DIAMONDS', rank: 5, isNaturalJoker: false, isJoker: false },
        { id: 'd7', suit: 'DIAMONDS', rank: 7, isNaturalJoker: false, isJoker: false },
        { id: 'd9_alt', suit: 'DIAMONDS', rank: 9, isNaturalJoker: false, isJoker: false },
        { id: 'h11', suit: 'HEARTS', rank: 11, isNaturalJoker: false, isJoker: false },
        { id: 'h13', suit: 'HEARTS', rank: 13, isNaturalJoker: false, isJoker: false },
      ];

      state.pukarPool = [deck0, deck1];

      const botConfig: BotGameConfig = {
        playerCount: 4,
        seats: [
          { seatIndex: 0, name: 'You', personality: 'smart_chacha', isHuman: true },
          { seatIndex: 1, name: 'Smart Chacha', personality: 'smart_chacha', isHuman: false },
          { seatIndex: 2, name: 'Partner', personality: 'the_long_term_guy', isHuman: false },
          { seatIndex: 3, name: 'Opponent', personality: 'fast_chachi', isHuman: false },
        ],
      };

      const dispatchedActions: GameAction[] = [];
      let currentState = state;
      const stateMap = new Map<number, any>();

      const handleAction = vi.fn((act: GameAction) => {
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
          }),
        stateMap
      );

      // Discard initial card to claim Pukar
      vi.advanceTimersByTime(250);
      expect(dispatchedActions[0]).toEqual({ type: 'DISCARD_CARD', cardId: 'c_discard_init' });

      // In MELD phase, bot should select deckIndex 1 and meld from deck1 cards
      vi.advanceTimersByTime(250);

      const deckSelectActions = dispatchedActions.filter((a) => a.type === 'SELECT_PUKAR_DECK');
      expect(deckSelectActions.length).toBe(1);
      expect(deckSelectActions[0]).toEqual({ type: 'SELECT_PUKAR_DECK', deckIndex: 1 });

      const meldActions = dispatchedActions.filter((a) => a.type === 'PLAY_NEW_MELD');
      expect(meldActions.length).toBeGreaterThanOrEqual(1);
      // Melded cards should come from deck1 (e.g. h7, h8, h9 or c4, c5_alt, c6), NOT deck0
      const meldedCardIds = meldActions.flatMap((a: any) => a.cardIds);
      expect(meldedCardIds.some((id: string) => id === 'h7' || id === 'c4')).toBe(true);
      expect(meldedCardIds).not.toContain('s4');
    });

    it('synchronizes botSubPhase to MELD when gameState.phase is MELD and botSubPhase was DISCARD', () => {
      vi.useFakeTimers();
      const state = dealInitialState(4);
      state.currentPlayerIndex = 1;
      state.phase = 'MELD';
      state.roundStatus = 'PLAYING';
      state.players[1].team = 'B';
      state.initialHandSizeThisTurn = 0;

      const tableMeld: Meld = {
        id: 'meld-init-b3',
        team: 'B',
        type: 'RUN',
        suit: 'HEARTS',
        cards: [
          { id: 'h3', suit: 'HEARTS', rank: 3, isNaturalJoker: false, isJoker: false },
          { id: 'h4', suit: 'HEARTS', rank: 4, isNaturalJoker: false, isJoker: false },
          { id: 'h5', suit: 'HEARTS', rank: 5, isNaturalJoker: false, isJoker: false },
        ],
        slots: [
          { card: { id: 'h3', suit: 'HEARTS', rank: 3, isNaturalJoker: false, isJoker: false }, representedRank: 3, isWildcard: false },
          { card: { id: 'h4', suit: 'HEARTS', rank: 4, isNaturalJoker: false, isJoker: false }, representedRank: 4, isWildcard: false },
          { card: { id: 'h5', suit: 'HEARTS', rank: 5, isNaturalJoker: false, isJoker: false }, representedRank: 5, isWildcard: false },
        ],
        points: 30,
        isClean: true,
        isPure: true,
        isPure13: false,
      };
      state.melds.B = [tableMeld];

      // Bot has a meldable run in hand plus a card to discard
      state.players[1].hand = [
        { id: 's4', suit: 'SPADES', rank: 4, isNaturalJoker: false, isJoker: false },
        { id: 's5', suit: 'SPADES', rank: 5, isNaturalJoker: false, isJoker: false },
        { id: 's6', suit: 'SPADES', rank: 6, isNaturalJoker: false, isJoker: false },
        { id: 'd9', suit: 'DIAMONDS', rank: 9, isNaturalJoker: false, isJoker: false },
      ];

      const botConfig: BotGameConfig = {
        playerCount: 4,
        seats: [
          { seatIndex: 0, name: 'You', personality: 'smart_chacha', isHuman: true },
          { seatIndex: 1, name: 'Smart Chacha', personality: 'smart_chacha', isHuman: false },
          { seatIndex: 2, name: 'Partner', personality: 'the_long_term_guy', isHuman: false },
          { seatIndex: 3, name: 'Opponent', personality: 'fast_chachi', isHuman: false },
        ],
      };

      const dispatchedActions: GameAction[] = [];
      const handleAction = vi.fn((act: GameAction) => {
        dispatchedActions.push(act);
        return true;
      });

      // Pre-populate stateMap so botSubPhase is 'DISCARD'
      const stateMap = new Map<number, any>();
      stateMap.set(0, 'DISCARD');

      runHook(
        () =>
          useBotGame({
            appMode: 'BOTS',
            gameState: state,
            botConfig,
            handleAction,
            turnDelayMs: 250,
          }),
        stateMap
      );

      vi.advanceTimersByTime(250);

      // Bot MUST have synced to MELD and executed PLAY_NEW_MELD, NOT directly discarded!
      const meldActions = dispatchedActions.filter((a) => a.type === 'PLAY_NEW_MELD');
      expect(meldActions.length).toBe(1);
      expect(meldActions[0].cardIds).toEqual(['s4', 's5', 's6']);
    });
  });
});
