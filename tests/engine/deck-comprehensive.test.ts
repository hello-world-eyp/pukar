import { describe, it, expect } from 'vitest';
import { createDecks, shuffleDeck, dealInitialState } from '../../src/engine/deck';
import { Card, SUITS, STANDARD_RANKS } from '../../src/engine/types';

describe('Comprehensive Deck & Dealing Engine (src/engine/deck.ts)', () => {
  describe('createDecks', () => {
    it('creates exactly 110 cards for 4 players (2 decks x 52 cards + 6 Jokers)', () => {
      const deck = createDecks(4);
      expect(deck).toHaveLength(110);

      // 6 Natural Jokers (3 per deck)
      const jokers = deck.filter((c) => c.isNaturalJoker);
      expect(jokers).toHaveLength(6);
      jokers.forEach((j) => {
        expect(j.rank).toBe(0);
        expect(j.suit).toBeNull();
        expect(j.isJoker).toBe(true);
      });

      // 104 standard cards (52 x 2)
      const standardCards = deck.filter((c) => !c.isNaturalJoker);
      expect(standardCards).toHaveLength(104);

      // Verify each suit has 26 cards (13 ranks x 2 decks)
      SUITS.forEach((suit) => {
        const suitCards = deck.filter((c) => c.suit === suit);
        expect(suitCards).toHaveLength(26);
      });

      // Verify each rank has 8 cards across 4 suits x 2 decks
      STANDARD_RANKS.forEach((rank) => {
        const rankCards = deck.filter((c) => c.rank === rank);
        expect(rankCards).toHaveLength(8);
      });

      // Verify all card IDs are unique
      const ids = new Set(deck.map((c) => c.id));
      expect(ids.size).toBe(110);
    });

    it('creates exactly 165 cards for 6 players (3 decks x 52 cards + 9 Jokers)', () => {
      const deck = createDecks(6);
      expect(deck).toHaveLength(165);

      // 9 Natural Jokers (3 per deck)
      const jokers = deck.filter((c) => c.isNaturalJoker);
      expect(jokers).toHaveLength(9);

      // 156 standard cards (52 x 3)
      const standardCards = deck.filter((c) => !c.isNaturalJoker);
      expect(standardCards).toHaveLength(156);

      // Verify each suit has 39 cards (13 ranks x 3 decks)
      SUITS.forEach((suit) => {
        const suitCards = deck.filter((c) => c.suit === suit);
        expect(suitCards).toHaveLength(39);
      });

      // Verify each rank has 12 cards across 4 suits x 3 decks
      STANDARD_RANKS.forEach((rank) => {
        const rankCards = deck.filter((c) => c.rank === rank);
        expect(rankCards).toHaveLength(12);
      });

      // Verify all card IDs are unique
      const ids = new Set(deck.map((c) => c.id));
      expect(ids.size).toBe(165);
    });

    it('throws when given an invalid player count', () => {
      // @ts-expect-error Testing invalid runtime input
      expect(() => createDecks(2)).toThrow(/Invalid player count: 2/);
      // @ts-expect-error Testing invalid runtime input
      expect(() => createDecks(5)).toThrow(/Invalid player count: 5/);
      // @ts-expect-error Testing invalid runtime input
      expect(() => createDecks(8)).toThrow(/Invalid player count: 8/);
    });
  });

  describe('shuffleDeck', () => {
    it('does not mutate the source array and returns a new array with identical elements', () => {
      const original = createDecks(4);
      const originalSnapshot = [...original];

      const shuffled = shuffleDeck(original);

      expect(shuffled).toHaveLength(original.length);
      expect(shuffled).not.toBe(original);
      // Original remains unchanged
      expect(original).toEqual(originalSnapshot);

      // Shuffled contains all the original IDs
      const originalIds = new Set(original.map((c) => c.id));
      const shuffledIds = new Set(shuffled.map((c) => c.id));
      expect(shuffledIds).toEqual(originalIds);
    });

    it('shuffles cards into a different order with high probability', () => {
      const original = createDecks(4);
      const shuffled1 = shuffleDeck(original);
      const shuffled2 = shuffleDeck(original);

      // At least some card positions should differ
      const samePositions1 = original.filter((card, idx) => shuffled1[idx].id === card.id).length;
      expect(samePositions1).toBeLessThan(original.length / 2);

      const samePositions2 = shuffled1.filter((card, idx) => shuffled2[idx].id === card.id).length;
      expect(samePositions2).toBeLessThan(shuffled1.length / 2);
    });

    it('handles empty and single-element card arrays cleanly', () => {
      expect(shuffleDeck([])).toEqual([]);

      const singleCard: Card = {
        id: 'test-1',
        suit: 'SPADES',
        rank: 14,
        isNaturalJoker: false,
        isJoker: false,
      };
      expect(shuffleDeck([singleCard])).toEqual([singleCard]);
    });
  });

  describe('dealInitialState', () => {
    describe('4-Player Game Initialization', () => {
      it('deals 4 players exactly 13 cards each with alternating teams (A, B, A, B)', () => {
        const state = dealInitialState(4);

        expect(state.playerCount).toBe(4);
        expect(state.players).toHaveLength(4);

        expect(state.players[0].team).toBe('A');
        expect(state.players[1].team).toBe('B');
        expect(state.players[2].team).toBe('A');
        expect(state.players[3].team).toBe('B');

        state.players.forEach((player) => {
          expect(player.hand).toHaveLength(13);
        });
      });

      it('allocates exactly 2 Pukars of 13 cards each for 4 players', () => {
        const state = dealInitialState(4);

        expect(state.pukarPool).toHaveLength(2);
        expect(state.pukarPool[0]).toHaveLength(13);
        expect(state.pukarPool[1]).toHaveLength(13);
        expect(state.pukars).toEqual(state.pukarPool);
      });

      it('initializes discard pile with 1 card and stock deck with exactly 31 cards', () => {
        const state = dealInitialState(4);

        expect(state.discardPile).toHaveLength(1);
        // Total = 4x13 (52) + 2x13 (26) + 1 (discard) + 31 (stock) = 110 cards
        expect(state.stockDeck).toHaveLength(31);
      });

      it('guarantees complete card conservation and zero card duplication across all game partitions', () => {
        const state = dealInitialState(4);

        const allCards: Card[] = [
          ...state.players.flatMap((p) => p.hand),
          ...state.pukarPool.flat(),
          ...state.discardPile,
          ...state.stockDeck,
        ];

        expect(allCards).toHaveLength(110);
        const uniqueIds = new Set(allCards.map((c) => c.id));
        expect(uniqueIds.size).toBe(110);
      });

      it('initializes starting turn phase as DRAW, currentPlayerIndex as 0, and scores as 0', () => {
        const state = dealInitialState(4);

        expect(state.phase).toBe('DRAW');
        expect(state.currentPlayerIndex).toBe(0);
        expect(state.round).toBe(1);
        expect(state.roundStatus).toBe('PLAYING');
        expect(state.finalTurnPlayerIndex).toBeNull();
        expect(state.scores).toEqual({ A: 0, B: 0 });
        expect(state.melds).toEqual({ A: [], B: [] });
      });
    });

    describe('6-Player Game Initialization', () => {
      it('deals 6 players exactly 13 cards each with alternating teams (A, B, A, B, A, B)', () => {
        const state = dealInitialState(6);

        expect(state.playerCount).toBe(6);
        expect(state.players).toHaveLength(6);

        expect(state.players.map((p) => p.team)).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);

        state.players.forEach((player) => {
          expect(player.hand).toHaveLength(13);
        });
      });

      it('allocates exactly 3 Pukars of 13 cards each for 6 players', () => {
        const state = dealInitialState(6);

        expect(state.pukarPool).toHaveLength(3);
        expect(state.pukarPool[0]).toHaveLength(13);
        expect(state.pukarPool[1]).toHaveLength(13);
        expect(state.pukarPool[2]).toHaveLength(13);
      });

      it('initializes discard pile with 1 card and stock deck with exactly 47 cards', () => {
        const state = dealInitialState(6);

        expect(state.discardPile).toHaveLength(1);
        // Total = 6x13 (78) + 3x13 (39) + 1 (discard) + 47 (stock) = 165 cards
        expect(state.stockDeck).toHaveLength(47);
      });

      it('guarantees complete card conservation for 165 cards across all 6-player partitions', () => {
        const state = dealInitialState(6);

        const allCards: Card[] = [
          ...state.players.flatMap((p) => p.hand),
          ...state.pukarPool.flat(),
          ...state.discardPile,
          ...state.stockDeck,
        ];

        expect(allCards).toHaveLength(165);
        const uniqueIds = new Set(allCards.map((c) => c.id));
        expect(uniqueIds.size).toBe(165);
      });
    });

    describe('Deterministic Custom Deck Testing', () => {
      it('distributes predetermined cards when customDeck is provided', () => {
        const customDeck = createDecks(4); // Non-shuffled deterministic deck
        const state = dealInitialState(4, customDeck);

        // Player 1 gets first 13 cards
        expect(state.players[0].hand).toEqual(customDeck.slice(0, 13));
        // Player 2 gets next 13 cards
        expect(state.players[1].hand).toEqual(customDeck.slice(13, 26));
        // Player 3 gets next 13 cards
        expect(state.players[2].hand).toEqual(customDeck.slice(26, 39));
        // Player 4 gets next 13 cards
        expect(state.players[3].hand).toEqual(customDeck.slice(39, 52));
        // Pukar 1 gets cards 52..65
        expect(state.pukarPool[0]).toEqual(customDeck.slice(52, 65));
        // Pukar 2 gets cards 65..78
        expect(state.pukarPool[1]).toEqual(customDeck.slice(65, 78));
        // First discard is card 78
        expect(state.discardPile[0]).toEqual(customDeck[78]);
        // Stock deck is remaining cards 79..110
        expect(state.stockDeck).toEqual(customDeck.slice(79));
      });

      it('throws an error if customDeck has insufficient cards to initialize discard pile', () => {
        // 4 players need 52 (hands) + 26 (pukars) + 1 (discard) = 79 cards min
        const shortDeck = createDecks(4).slice(0, 78);
        expect(() => dealInitialState(4, shortDeck)).toThrow(
          'Insufficient cards in deck to initialize discard pile.'
        );
      });

      it('throws when given an invalid player count for dealInitialState', () => {
        // @ts-expect-error Testing invalid runtime input
        expect(() => dealInitialState(3)).toThrow(/Invalid player count: 3/);
      });
    });
  });
});
