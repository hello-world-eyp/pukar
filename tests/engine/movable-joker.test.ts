import { describe, it, expect } from 'vitest';
import { Card, Meld, Suit } from '../../src/engine/types';
import {
  canAddCardsToMeld,
  validateRemoveCardFromMeld,
} from '../../src/engine/meld-validator';

function makeCard(id: string, suit: Suit | null, rank: number, isNaturalJoker = false): Card {
  return {
    id,
    suit,
    rank: rank as Card['rank'],
    isNaturalJoker,
    isJoker: isNaturalJoker || rank === 0,
  };
}

describe('Movable "2" Joker Dynamics & Adding Cards to Melds', () => {
  describe('Upward Shift of 2', () => {
    it('shifts 2 upward when replaced by natural card and higher cards are added: [3♠, 4♠, 2♠(sub 5), 6♠] + 5♠ and 8♠ -> [3♠, 4♠, 5♠, 6♠, 2♠(sub 7), 8♠]', () => {
      const card3 = makeCard('c3', 'SPADES', 3);
      const card4 = makeCard('c4', 'SPADES', 4);
      const twoSpades = makeCard('twoSpades', 'SPADES', 2);
      const card6 = makeCard('c6', 'SPADES', 6);

      const meld: Meld = {
        id: 'meld1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [card3, card4, twoSpades, card6],
        slots: [
          { card: card3, representedRank: 3, representedSuit: 'SPADES', isWildcard: false },
          { card: card4, representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
          { card: twoSpades, representedRank: 5, representedSuit: 'SPADES', isWildcard: true },
          { card: card6, representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
        ],
      };

      const card5 = makeCard('c5', 'SPADES', 5);
      const card8 = makeCard('c8', 'SPADES', 8);

      const result = canAddCardsToMeld(meld, [card5, card8]);
      expect(result.valid).toBe(true);
      expect(result.updatedSlots).toBeDefined();

      const slots = result.updatedSlots!;
      expect(slots.length).toBe(6);
      expect(slots.map((s) => s.representedRank)).toEqual([3, 4, 5, 6, 7, 8]);

      // Check slot for 2♠
      const twoSlot = slots.find((s) => s.card.id === 'twoSpades');
      expect(twoSlot).toBeDefined();
      expect(twoSlot?.representedRank).toBe(7);
      expect(twoSlot?.isWildcard).toBe(true);
      expect(twoSlot?.representedSuit).toBe('SPADES');

      // Check slot for natural 5♠
      const slot5 = slots.find((s) => s.card.id === 'c5');
      expect(slot5?.representedRank).toBe(5);
      expect(slot5?.isWildcard).toBe(false);

      // Check slot for natural 8♠
      const slot8 = slots.find((s) => s.card.id === 'c8');
      expect(slot8?.representedRank).toBe(8);
      expect(slot8?.isWildcard).toBe(false);
    });
  });

  describe('Downward Slide of 2', () => {
    it('slides 2 downward to natural 2 when replaced: [3♠, 4♠, 2♠(sub 5), 6♠] + 5♠ -> [2♠(natural 2), 3♠, 4♠, 5♠, 6♠]', () => {
      const card3 = makeCard('c3', 'SPADES', 3);
      const card4 = makeCard('c4', 'SPADES', 4);
      const twoSpades = makeCard('twoSpades', 'SPADES', 2);
      const card6 = makeCard('c6', 'SPADES', 6);

      const meld: Meld = {
        id: 'meld1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [card3, card4, twoSpades, card6],
        slots: [
          { card: card3, representedRank: 3, representedSuit: 'SPADES', isWildcard: false },
          { card: card4, representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
          { card: twoSpades, representedRank: 5, representedSuit: 'SPADES', isWildcard: true },
          { card: card6, representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
        ],
      };

      const card5 = makeCard('c5', 'SPADES', 5);

      const result = canAddCardsToMeld(meld, [card5]);
      expect(result.valid).toBe(true);
      expect(result.updatedSlots).toBeDefined();

      const slots = result.updatedSlots!;
      expect(slots.length).toBe(5);
      expect(slots.map((s) => s.representedRank)).toEqual([2, 3, 4, 5, 6]);

      // 2♠ is now natural 2!
      const twoSlot = slots.find((s) => s.card.id === 'twoSpades');
      expect(twoSlot).toBeDefined();
      expect(twoSlot?.representedRank).toBe(2);
      expect(twoSlot?.isWildcard).toBe(false);
      expect(twoSlot?.representedSuit).toBe('SPADES');

      // 5♠ is now natural 5!
      const slot5 = slots.find((s) => s.card.id === 'c5');
      expect(slot5?.representedRank).toBe(5);
      expect(slot5?.isWildcard).toBe(false);
    });
  });

  describe('Adding cards to clean runs & sets', () => {
    it('extends a clean run at both ends: [4♠, 5♠, 6♠] + 3♠ and 7♠ -> [3♠, 4♠, 5♠, 6♠, 7♠]', () => {
      const card4 = makeCard('c4', 'SPADES', 4);
      const card5 = makeCard('c5', 'SPADES', 5);
      const card6 = makeCard('c6', 'SPADES', 6);

      const meld: Meld = {
        id: 'meld1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [card4, card5, card6],
        slots: [
          { card: card4, representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
          { card: card5, representedRank: 5, representedSuit: 'SPADES', isWildcard: false },
          { card: card6, representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
        ],
      };

      const card3 = makeCard('c3', 'SPADES', 3);
      const card7 = makeCard('c7', 'SPADES', 7);

      const result = canAddCardsToMeld(meld, [card3, card7]);
      expect(result.valid).toBe(true);
      expect(result.updatedSlots?.map((s) => s.representedRank)).toEqual([3, 4, 5, 6, 7]);
    });

    it('adds natural matching rank cards to a set', () => {
      const c1 = makeCard('c1', 'SPADES', 8);
      const c2 = makeCard('c2', 'HEARTS', 8);
      const c3 = makeCard('c3', 'DIAMONDS', 8);

      const meld: Meld = {
        id: 'm1',
        team: 'B',
        type: 'SET',
        rank: 8,
        cards: [c1, c2, c3],
        slots: [
          { card: c1, representedRank: 8, isWildcard: false },
          { card: c2, representedRank: 8, isWildcard: false },
          { card: c3, representedRank: 8, isWildcard: false },
        ],
      };

      const c4 = makeCard('c4', 'CLUBS', 8);
      const result = canAddCardsToMeld(meld, [c4]);
      expect(result.valid).toBe(true);
      expect(result.updatedSlots?.length).toBe(4);
      expect(result.updatedSlots?.every((s) => s.representedRank === 8)).toBe(true);
    });

    it('rejects adding a second wildcard to a dirty set', () => {
      const c1 = makeCard('c1', 'SPADES', 8);
      const c2 = makeCard('c2', 'HEARTS', 8);
      const twoCard = makeCard('twoClubs', 'CLUBS', 2);

      const meld: Meld = {
        id: 'm1',
        team: 'B',
        type: 'SET',
        rank: 8,
        cards: [c1, c2, twoCard],
        slots: [
          { card: c1, representedRank: 8, isWildcard: false },
          { card: c2, representedRank: 8, isWildcard: false },
          { card: twoCard, representedRank: 8, isWildcard: true },
        ],
      };

      const joker = makeCard('j1', null, 0, true);
      const result = canAddCardsToMeld(meld, [joker]);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/wildcard/i);
    });
  });

  describe('Immutability & Table Permanence', () => {
    it('rejects attempts to withdraw a card from a meld', () => {
      const twoSpades = makeCard('twoSpades', 'SPADES', 2);
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          makeCard('c3', 'SPADES', 3),
          makeCard('c4', 'SPADES', 4),
          twoSpades,
          makeCard('c6', 'SPADES', 6),
        ],
        slots: [],
      };

      const result = validateRemoveCardFromMeld(meld, twoSpades.id);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/cannot be removed/i);
    });

    it('guarantees that cards already on table remain in updatedSlots when shifted', () => {
      const card3 = makeCard('c3', 'SPADES', 3);
      const card4 = makeCard('c4', 'SPADES', 4);
      const twoSpades = makeCard('twoSpades', 'SPADES', 2);
      const card6 = makeCard('c6', 'SPADES', 6);

      const meld: Meld = {
        id: 'meld1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [card3, card4, twoSpades, card6],
        slots: [
          { card: card3, representedRank: 3, representedSuit: 'SPADES', isWildcard: false },
          { card: card4, representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
          { card: twoSpades, representedRank: 5, representedSuit: 'SPADES', isWildcard: true },
          { card: card6, representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
        ],
      };

      const card5 = makeCard('c5', 'SPADES', 5);
      const result = canAddCardsToMeld(meld, [card5]);
      expect(result.valid).toBe(true);

      // Verify all original cards are still in updatedSlots
      const originalIds = meld.cards.map((c) => c.id);
      const updatedIds = result.updatedSlots!.map((s) => s.card.id);
      for (const id of originalIds) {
        expect(updatedIds).toContain(id);
      }
    });

    it('rejects adding duplicate cards already in meld', () => {
      const card3 = makeCard('c3', 'SPADES', 3);
      const meld: Meld = {
        id: 'meld1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [card3, makeCard('c4', 'SPADES', 4), makeCard('c5', 'SPADES', 5)],
        slots: [],
      };

      const result = canAddCardsToMeld(meld, [card3]);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/already/i);
    });
  });
});
