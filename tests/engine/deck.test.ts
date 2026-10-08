import { describe, it, expect } from 'vitest';
import { createDecks, shuffleDeck, dealInitialState } from '../../src/engine/deck';
import { Card } from '../../src/engine/types';

describe('Deck Management', () => {
  describe('createDecks', () => {
    it('creates 110 cards for 4 players (2 decks of 52 + 3 jokers each)', () => {
      const cards = createDecks(4);
      expect(cards.length).toBe(110);

      // 6 natural jokers total
      const jokers = cards.filter((c) => c.isNaturalJoker);
      expect(jokers.length).toBe(6);
      jokers.forEach((joker) => {
        expect(joker.suit).toBeNull();
        expect(joker.rank).toBe(0);
        expect(joker.isJoker).toBe(true);
      });

      // 104 standard cards
      const standardCards = cards.filter((c) => !c.isNaturalJoker);
      expect(standardCards.length).toBe(104);

      // Verify each suit has 2 of each rank (from 2 to 14)
      const suits = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'] as const;
      for (const suit of suits) {
        for (let rank = 2; rank <= 14; rank++) {
          const matching = standardCards.filter((c) => c.suit === suit && c.rank === rank);
          expect(matching.length).toBe(2);
        }
      }

      // Check all card IDs are unique
      const ids = new Set(cards.map((c) => c.id));
      expect(ids.size).toBe(110);
    });

    it('creates 165 cards for 6 players (3 decks of 52 + 3 jokers each)', () => {
      const cards = createDecks(6);
      expect(cards.length).toBe(165);

      // 9 natural jokers total
      const jokers = cards.filter((c) => c.isNaturalJoker);
      expect(jokers.length).toBe(9);
      jokers.forEach((joker) => {
        expect(joker.suit).toBeNull();
        expect(joker.rank).toBe(0);
        expect(joker.isJoker).toBe(true);
      });

      // 156 standard cards
      const standardCards = cards.filter((c) => !c.isNaturalJoker);
      expect(standardCards.length).toBe(156);

      // Verify each suit has 3 of each rank (from 2 to 14)
      const suits = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'] as const;
      for (const suit of suits) {
        for (let rank = 2; rank <= 14; rank++) {
          const matching = standardCards.filter((c) => c.suit === suit && c.rank === rank);
          expect(matching.length).toBe(3);
        }
      }

      // Check all card IDs are unique
      const ids = new Set(cards.map((c) => c.id));
      expect(ids.size).toBe(165);
    });
  });

  describe('shuffleDeck', () => {
    it('returns a new array with all elements shuffled without mutating original', () => {
      const original = createDecks(4);
      const shuffled = shuffleDeck(original);

      expect(shuffled).not.toBe(original);
      expect(shuffled.length).toBe(original.length);

      // Same cards present
      const originalIds = new Set(original.map((c) => c.id));
      const shuffledIds = new Set(shuffled.map((c) => c.id));
      expect(shuffledIds).toEqual(originalIds);

      // Verify order is shuffled (statistically overwhelming probability of differing order)
      const matchesAtSameIndex = shuffled.filter((c, i) => c.id === original[i].id).length;
      expect(matchesAtSameIndex).toBeLessThan(original.length);
    });
  });

  describe('dealInitialState', () => {
    it('deals initial state correctly for 4 players', () => {
      const state = dealInitialState(4);

      // 4 players
      expect(state.players.length).toBe(4);
      expect(state.playerCount).toBe(4);

      // Seating order alternates teams: P1 (Team A), P2 (Team B), P3 (Team A), P4 (Team B)
      expect(state.players[0].team).toBe('A');
      expect(state.players[1].team).toBe('B');
      expect(state.players[2].team).toBe('A');
      expect(state.players[3].team).toBe('B');

      // Exactly 13 cards per player hand
      state.players.forEach((p) => {
        expect(p.hand.length).toBe(13);
      });

      // 2 Pukar decks of 13 cards each
      expect(state.pukarPool.length).toBe(2);
      expect(state.pukarPool[0].length).toBe(13);
      expect(state.pukarPool[1].length).toBe(13);

      // Discard pile starts with exactly 1 card face-up
      expect(state.discardPile.length).toBe(1);

      // Remaining cards go to the stock deck
      // 110 - (4 * 13) - (2 * 13) - 1 = 110 - 52 - 26 - 1 = 31
      expect(state.stockDeck.length).toBe(31);

      // Verify card conservation: 52 + 26 + 1 + 31 = 110 unique cards
      const allDealtCards: Card[] = [
        ...state.players.flatMap((p) => p.hand),
        ...state.pukarPool.flat(),
        ...state.discardPile,
        ...state.stockDeck,
      ];
      expect(allDealtCards.length).toBe(110);
      const uniqueIds = new Set(allDealtCards.map((c) => c.id));
      expect(uniqueIds.size).toBe(110);

      // Initial game turn state
      expect(state.currentPlayerIndex).toBe(0);
      expect(state.phase).toBe('DRAW');
      expect(state.round).toBe(1);
      expect(state.roundStatus).toBe('PLAYING');
      expect(state.scores).toEqual({ A: 0, B: 0 });
      expect(state.melds).toEqual({ A: [], B: [] });
    });

    it('deals initial state correctly for 6 players', () => {
      const state = dealInitialState(6);

      // 6 players
      expect(state.players.length).toBe(6);
      expect(state.playerCount).toBe(6);

      // Seating order alternates teams: A, B, A, B, A, B
      expect(state.players[0].team).toBe('A');
      expect(state.players[1].team).toBe('B');
      expect(state.players[2].team).toBe('A');
      expect(state.players[3].team).toBe('B');
      expect(state.players[4].team).toBe('A');
      expect(state.players[5].team).toBe('B');

      // Exactly 13 cards per player hand
      state.players.forEach((p) => {
        expect(p.hand.length).toBe(13);
      });

      // 3 Pukar decks of 13 cards each
      expect(state.pukarPool.length).toBe(3);
      expect(state.pukarPool[0].length).toBe(13);
      expect(state.pukarPool[1].length).toBe(13);
      expect(state.pukarPool[2].length).toBe(13);

      // Discard pile starts with exactly 1 card face-up
      expect(state.discardPile.length).toBe(1);

      // Remaining cards go to the stock deck
      // 165 - (6 * 13) - (3 * 13) - 1 = 165 - 78 - 39 - 1 = 47
      expect(state.stockDeck.length).toBe(47);

      // Verify card conservation: 78 + 39 + 1 + 47 = 165 unique cards
      const allDealtCards: Card[] = [
        ...state.players.flatMap((p) => p.hand),
        ...state.pukarPool.flat(),
        ...state.discardPile,
        ...state.stockDeck,
      ];
      expect(allDealtCards.length).toBe(165);
      const uniqueIds = new Set(allDealtCards.map((c) => c.id));
      expect(uniqueIds.size).toBe(165);

      // Initial game turn state
      expect(state.currentPlayerIndex).toBe(0);
      expect(state.phase).toBe('DRAW');
      expect(state.round).toBe(1);
      expect(state.roundStatus).toBe('PLAYING');
      expect(state.scores).toEqual({ A: 0, B: 0 });
      expect(state.melds).toEqual({ A: [], B: [] });
    });

    it('assigns custom player names when provided and falls back to defaults for empty slots', () => {
      const customNames = ['Harsh', 'Alex', '', '  '];
      const state = dealInitialState(4, undefined, customNames);

      expect(state.players[0].name).toBe('Harsh');
      expect(state.players[1].name).toBe('Alex');
      expect(state.players[2].name).toBe('Player 3'); // Fallback for empty string
      expect(state.players[3].name).toBe('Player 4'); // Fallback for whitespace
    });

    it('assigns 6 custom player names when provided in 6-player mode', () => {
      const customNames = ['P1-Alice', 'P2-Bob', 'P3-Charlie', 'P4-Diana', 'P5-Eve', 'P6-Frank'];
      const state = dealInitialState(6, undefined, customNames);

      expect(state.players.map((p) => p.name)).toEqual(customNames);
    });
  });
});
