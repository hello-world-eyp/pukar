import { describe, it, expect } from 'vitest';
import { Card, GameState, Rank, Suit } from '../../../src/engine/types';
import { dealInitialState } from '../../../src/engine/deck';
import { BotMemory } from '../../../src/engine/bots/types';
import { decideSmartChachaTurn } from '../../../src/engine/bots/strategies/smart-chacha';
import { decideTheJadugarTurn } from '../../../src/engine/bots/strategies/the-jadugar';
import { decideFastChachiTurn } from '../../../src/engine/bots/strategies/fast-chachi';
import { decideTheLongTermGuyTurn } from '../../../src/engine/bots/strategies/the-long-term-guy';

describe('Bot Personality Strategies', () => {
  function makeCard(id: string, suit: Suit | null, rank: Rank, isNaturalJoker = false): Card {
    return {
      id,
      suit,
      rank,
      isNaturalJoker,
      isJoker: isNaturalJoker || rank === 2 || rank === 0,
    };
  }

  function createTestState(): GameState {
    const state = dealInitialState(4);
    state.currentPlayerIndex = 1; // Bot is player 1 (Team B)
    state.phase = 'DRAW';
    state.turnPhase = 'DRAW';
    return state;
  }

  function createEmptyMemory(): BotMemory {
    return {
      cardLog: [],
      bottomPickupsByPlayer: {},
      discardsByPlayer: {},
    };
  }

  describe('Fast Chachi Strategy', () => {
    it('always takes discard pile when pile has 3 or more cards (hoarder behavior)', () => {
      const state = createTestState();
      state.discardPile = [
        makeCard('dp1', 'SPADES', 4),
        makeCard('dp2', 'HEARTS', 8),
        makeCard('dp3', 'CLUBS', 10),
      ];

      const plan = decideFastChachiTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('TAKE_DISCARD');
    });

    it('prefers drawing stock when pile has fewer than 3 cards and no immediate meld', () => {
      const state = createTestState();
      state.discardPile = [makeCard('dp1', 'SPADES', 4)];

      const plan = decideFastChachiTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('DRAW_FROM_STOCK');
    });

    it('never discards rank 2 or Natural Joker wildcards', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';
      state.players[1].hand = [
        makeCard('j1', null, 0, true), // Joker
        makeCard('w2', 'HEARTS', 2), // 2 Wildcard
        makeCard('c1', 'CLUBS', 9), // Normal card
      ];

      const plan = decideFastChachiTurn(state, 1, createEmptyMemory());
      expect(plan.discardAction.cardId).toBe('c1');
    });
  });

  describe('The Jadugar Strategy', () => {
    it('prefers drawing from stock to reach Pukar fast without bloating hand', () => {
      const state = createTestState();
      state.players[1].hand = [
        makeCard('h1', 'DIAMONDS', 3),
        makeCard('h2', 'HEARTS', 5),
        makeCard('h3', 'HEARTS', 7),
      ];
      state.discardPile = [
        makeCard('dp1', 'SPADES', 4),
        makeCard('dp2', 'HEARTS', 8),
        makeCard('dp3', 'CLUBS', 10),
      ];

      // Jadugar avoids bloating hand with junk cards from pile
      const plan = decideTheJadugarTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('DRAW_FROM_STOCK');
    });

    it('takes discard pile if top card allows an immediate meld towards Pukar', () => {
      const state = createTestState();
      // Hand has 3♠ and 4♠
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 3),
        makeCard('h2', 'SPADES', 4),
        makeCard('h3', 'HEARTS', 9),
      ];
      // Top of discard pile is 5♠
      state.discardPile = [makeCard('dp1', 'SPADES', 5)];

      const plan = decideTheJadugarTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('TAKE_DISCARD');
    });
  });

  describe('The Long-Term Guy Strategy', () => {
    it('focuses on building one sequence per suit', () => {
      const state = createTestState();
      // Team B already has a Spades run
      state.melds.B = [
        {
          id: 'meld-b-spades',
          team: 'B',
          type: 'RUN',
          suit: 'SPADES',
          cards: [
            makeCard('m1', 'SPADES', 4),
            makeCard('m2', 'SPADES', 5),
            makeCard('m3', 'SPADES', 6),
          ],
          slots: [
            { card: makeCard('m1', 'SPADES', 4), representedRank: 4, isWildcard: false },
            { card: makeCard('m2', 'SPADES', 5), representedRank: 5, isWildcard: false },
            { card: makeCard('m3', 'SPADES', 6), representedRank: 6, isWildcard: false },
          ],
        },
      ];

      // Hand has 3♠ (can add to existing run)
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 3),
        makeCard('h2', 'HEARTS', 9),
      ];
      state.phase = 'MELD';
      state.turnPhase = 'MELD';

      const plan = decideTheLongTermGuyTurn(state, 1, createEmptyMemory());
      // Should prioritize adding to the existing Spades sequence
      expect(plan.meldActions.some((a) => a.type === 'ADD_TO_MELD')).toBe(true);
    });
  });

  describe('Smart Chacha Strategy', () => {
    it('avoids discarding cards that opponents are logged to need', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';
      // Hand has 7♠ and 10♦
      state.players[1].hand = [
        makeCard('c1', 'SPADES', 7),
        makeCard('c2', 'DIAMONDS', 10),
      ];

      // Memory logs that Opponent (Player 0) picked up 6♠ from the bottom recently
      const memory: BotMemory = {
        cardLog: [
          {
            cardId: 'opp-6s',
            suit: 'SPADES',
            rank: 6,
            playerIndex: 0,
            action: 'PICKUP_BOTTOM',
            timestamp: Date.now(),
          },
        ],
        bottomPickupsByPlayer: {
          0: [makeCard('opp-6s', 'SPADES', 6)],
        },
        discardsByPlayer: {},
      };

      const plan = decideSmartChachaTurn(state, 1, memory);
      // Chacha predicts opponent needs 7♠, so Chacha discards 10♦ instead!
      expect(plan.discardAction.cardId).toBe('c2');
    });
  });
});
