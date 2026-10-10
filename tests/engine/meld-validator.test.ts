import { describe, it, expect } from 'vitest';
import { Card, Meld, MeldSlot, Suit } from '../../src/engine/types';
import {
  validateNewRun,
  validateNewSet,
  validateNewMeld,
  evaluateMeldScore,
} from '../../src/engine/meld-validator';

// Helper to create test cards quickly
function makeCard(id: string, suit: Suit | null, rank: number, isNaturalJoker = false): Card {
  return {
    id,
    suit,
    rank: rank as Card['rank'],
    isNaturalJoker,
    isJoker: isNaturalJoker || rank === 0,
  };
}

describe('Meld Validator', () => {
  describe('validateNewRun', () => {
    it('validates a clean run of 3+ consecutive cards of the same suit', () => {
      const cards = [
        makeCard('c1', 'SPADES', 3),
        makeCard('c2', 'SPADES', 4),
        makeCard('c3', 'SPADES', 5),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(true);
      expect(result.slots).toBeDefined();
      expect(result.slots?.length).toBe(3);
      expect(result.slots?.map((s) => s.representedRank)).toEqual([3, 4, 5]);
      expect(result.slots?.every((s) => !s.isWildcard)).toBe(true);
      expect(result.slots?.every((s) => s.representedSuit === 'SPADES')).toBe(true);
    });

    it('rejects runs with fewer than 3 cards', () => {
      const cards = [makeCard('c1', 'SPADES', 3), makeCard('c2', 'SPADES', 4)];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/at least 3 cards/i);
    });

    it('rejects mixed-suit runs', () => {
      const cards = [
        makeCard('c1', 'SPADES', 3),
        makeCard('c2', 'HEARTS', 4),
        makeCard('c3', 'SPADES', 5),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/same suit/i);
    });

    it('validates a dirty run with 1 Natural Joker filling an interior gap', () => {
      const cards = [
        makeCard('c1', 'SPADES', 3),
        makeCard('joker1', null, 0, true),
        makeCard('c3', 'SPADES', 5),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(true);
      expect(result.slots?.length).toBe(3);
      expect(result.slots?.map((s) => s.representedRank)).toEqual([3, 4, 5]);
      const jokerSlot = result.slots?.find((s) => s.card.id === 'joker1');
      expect(jokerSlot?.representedRank).toBe(4);
      expect(jokerSlot?.representedSuit).toBe('SPADES');
      expect(jokerSlot?.isWildcard).toBe(true);
    });

    it('validates a dirty run with a rank 2 card substituting for a missing rank', () => {
      const cards = [
        makeCard('c1', 'SPADES', 3),
        makeCard('c2', 'SPADES', 4),
        makeCard('twoHearts', 'HEARTS', 2), // 2 of hearts acting as wildcard in spades
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(true);
      const subSlot = result.slots?.find((s) => s.card.id === 'twoHearts');
      expect(subSlot?.isWildcard).toBe(true);
      expect(subSlot?.representedSuit).toBe('SPADES');
    });

    it('validates a run with 2 of matching suit acting as natural rank 2', () => {
      const cards = [
        makeCard('twoSpades', 'SPADES', 2),
        makeCard('c2', 'SPADES', 3),
        makeCard('c3', 'SPADES', 4),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(true);
      expect(result.slots?.map((s) => s.representedRank)).toEqual([2, 3, 4]);
      const slot2 = result.slots?.find((s) => s.card.id === 'twoSpades');
      expect(slot2?.representedRank).toBe(2);
      expect(slot2?.isWildcard).toBe(false);
    });

    it('rejects runs with 2+ wildcards (e.g. 2 natural jokers)', () => {
      const cards = [
        makeCard('c1', 'SPADES', 3),
        makeCard('j1', null, 0, true),
        makeCard('j2', null, 0, true),
        makeCard('c4', 'SPADES', 6),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/wildcard/i);
    });

    it('rejects runs with 1 natural joker and 1 card of rank 2', () => {
      const cards = [
        makeCard('c1', 'SPADES', 3),
        makeCard('twoSpades', 'SPADES', 2),
        makeCard('j1', null, 0, true),
        makeCard('c4', 'SPADES', 6),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/wildcard/i);
    });

    it('rejects runs with two cards of rank 2', () => {
      const cards = [
        makeCard('c1', 'SPADES', 3),
        makeCard('twoSpades', 'SPADES', 2),
        makeCard('twoHearts', 'HEARTS', 2),
        makeCard('c4', 'SPADES', 6),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/wildcard/i);
    });

    it('handles Ace low (A-2-3)', () => {
      const cards = [
        makeCard('aceSpades', 'SPADES', 14),
        makeCard('twoSpades', 'SPADES', 2),
        makeCard('threeSpades', 'SPADES', 3),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(true);
      expect(result.slots?.map((s) => s.representedRank)).toEqual([1, 2, 3]);
      const aceSlot = result.slots?.find((s) => s.card.id === 'aceSpades');
      expect(aceSlot?.representedRank).toBe(1);
    });

    it('handles Ace high (Q-K-A)', () => {
      const cards = [
        makeCard('qSpades', 'SPADES', 12),
        makeCard('kSpades', 'SPADES', 13),
        makeCard('aceSpades', 'SPADES', 14),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(true);
      expect(result.slots?.map((s) => s.representedRank)).toEqual([12, 13, 14]);
      const aceSlot = result.slots?.find((s) => s.card.id === 'aceSpades');
      expect(aceSlot?.representedRank).toBe(14);
    });

    it('rejects non-consecutive cards without wildcards', () => {
      const cards = [
        makeCard('c1', 'SPADES', 3),
        makeCard('c2', 'SPADES', 5),
        makeCard('c3', 'SPADES', 7),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(false);
    });

    it('rejects duplicate ranks in a run', () => {
      const cards = [
        makeCard('c1', 'SPADES', 3),
        makeCard('c2', 'SPADES', 4),
        makeCard('c3', 'SPADES', 4),
        makeCard('c4', 'SPADES', 5),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/duplicate/i);
    });

    it('rejects wrap-around sequences (e.g. K-A-2-3 and K-A-3)', () => {
      const cardsWrap = [
        makeCard('kSpades', 'SPADES', 13),
        makeCard('aceSpades', 'SPADES', 14),
        makeCard('twoSpades', 'SPADES', 2),
        makeCard('threeSpades', 'SPADES', 3),
      ];
      expect(validateNewRun(cardsWrap).valid).toBe(false);

      const cardsWrapClean = [
        makeCard('kSpades', 'SPADES', 13),
        makeCard('aceSpades', 'SPADES', 14),
        makeCard('threeSpades', 'SPADES', 3),
      ];
      expect(validateNewRun(cardsWrapClean).valid).toBe(false);
    });
  });

  describe('validateNewSet', () => {
    it('validates a clean set of same rank (7 cards: 7 of one thing)', () => {
      const cards = [
        makeCard('c1', 'SPADES', 8),
        makeCard('c2', 'HEARTS', 8),
        makeCard('c3', 'DIAMONDS', 8),
        makeCard('c4', 'CLUBS', 8),
        makeCard('c5', 'SPADES', 8),
        makeCard('c6', 'HEARTS', 8),
        makeCard('c7', 'DIAMONDS', 8),
      ];
      const result = validateNewSet(cards);
      expect(result.valid).toBe(true);
      expect(result.slots?.length).toBe(7);
      expect(result.slots?.every((s) => s.representedRank === 8)).toBe(true);
      expect(result.slots?.every((s) => !s.isWildcard)).toBe(true);
    });

    it('validates a clean set of 8 cards of same rank (multi-deck)', () => {
      const cards = [
        makeCard('c1', 'SPADES', 13),
        makeCard('c2', 'HEARTS', 13),
        makeCard('c3', 'DIAMONDS', 13),
        makeCard('c4', 'CLUBS', 13),
        makeCard('c5', 'SPADES', 13),
        makeCard('c6', 'HEARTS', 13),
        makeCard('c7', 'DIAMONDS', 13),
        makeCard('c8', 'CLUBS', 13),
      ];
      const result = validateNewSet(cards);
      expect(result.valid).toBe(true);
      expect(result.slots?.length).toBe(8);
    });

    it('rejects sets with fewer than 7 cards (e.g. 3, 3, 3 or 6 cards)', () => {
      const threeCards = [
        makeCard('c1', 'SPADES', 3),
        makeCard('c2', 'HEARTS', 3),
        makeCard('c3', 'DIAMONDS', 3),
      ];
      const result3 = validateNewSet(threeCards);
      expect(result3.valid).toBe(false);
      expect(result3.error).toMatch(/at least 7 cards/i);

      const sixCards = [
        makeCard('c1', 'SPADES', 8),
        makeCard('c2', 'HEARTS', 8),
        makeCard('c3', 'DIAMONDS', 8),
        makeCard('c4', 'CLUBS', 8),
        makeCard('c5', 'SPADES', 8),
        makeCard('c6', 'HEARTS', 8),
      ];
      const result6 = validateNewSet(sixCards);
      expect(result6.valid).toBe(false);
      expect(result6.error).toMatch(/at least 7 cards/i);
    });

    it('rejects sets with mixed ranks among natural cards', () => {
      const cards = [
        makeCard('c1', 'SPADES', 8),
        makeCard('c2', 'HEARTS', 8),
        makeCard('c3', 'DIAMONDS', 8),
        makeCard('c4', 'CLUBS', 8),
        makeCard('c5', 'SPADES', 8),
        makeCard('c6', 'HEARTS', 8),
        makeCard('c7', 'DIAMONDS', 9),
      ];
      const result = validateNewSet(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/same rank/i);
    });

    it('validates a dirty set with 6 of one thing and 1 Natural Joker (7 cards total)', () => {
      const cards = [
        makeCard('c1', 'SPADES', 8),
        makeCard('c2', 'HEARTS', 8),
        makeCard('c3', 'DIAMONDS', 8),
        makeCard('c4', 'CLUBS', 8),
        makeCard('c5', 'SPADES', 8),
        makeCard('c6', 'HEARTS', 8),
        makeCard('j1', null, 0, true),
      ];
      const result = validateNewSet(cards);
      expect(result.valid).toBe(true);
      expect(result.slots?.length).toBe(7);
      const jokerSlot = result.slots?.find((s) => s.card.id === 'j1');
      expect(jokerSlot?.representedRank).toBe(8);
      expect(jokerSlot?.isWildcard).toBe(true);
    });

    it('validates a dirty set with 6 of one thing and 1 card of rank 2 as wildcard (7 cards total)', () => {
      const cards = [
        makeCard('c1', 'SPADES', 8),
        makeCard('c2', 'HEARTS', 8),
        makeCard('c3', 'DIAMONDS', 8),
        makeCard('c4', 'CLUBS', 8),
        makeCard('c5', 'SPADES', 8),
        makeCard('c6', 'HEARTS', 8),
        makeCard('twoClubs', 'CLUBS', 2),
      ];
      const result = validateNewSet(cards);
      expect(result.valid).toBe(true);
      expect(result.slots?.length).toBe(7);
      const twoSlot = result.slots?.find((s) => s.card.id === 'twoClubs');
      expect(twoSlot?.representedRank).toBe(8);
      expect(twoSlot?.isWildcard).toBe(true);
    });

    it('rejects sets with 2+ wildcards', () => {
      const cards = [
        makeCard('c1', 'SPADES', 8),
        makeCard('c2', 'HEARTS', 8),
        makeCard('c3', 'DIAMONDS', 8),
        makeCard('c4', 'CLUBS', 8),
        makeCard('c5', 'SPADES', 8),
        makeCard('j1', null, 0, true),
        makeCard('twoClubs', 'CLUBS', 2),
      ];
      const result = validateNewSet(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/wildcard/i);
    });

    it('rejects a set with 5 of one thing and 1 joker (6 cards total)', () => {
      const cards = [
        makeCard('c1', 'SPADES', 8),
        makeCard('c2', 'HEARTS', 8),
        makeCard('c3', 'DIAMONDS', 8),
        makeCard('c4', 'CLUBS', 8),
        makeCard('c5', 'SPADES', 8),
        makeCard('j1', null, 0, true),
      ];
      const result = validateNewSet(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/at least 7 cards/i);
    });
  });

  describe('validateNewMeld', () => {
    it('detects and validates a RUN', () => {
      const cards = [
        makeCard('c1', 'SPADES', 3),
        makeCard('c2', 'SPADES', 4),
        makeCard('c3', 'SPADES', 5),
      ];
      const result = validateNewMeld(cards);
      expect(result.valid).toBe(true);
      expect(result.type).toBe('RUN');
      expect(result.suit).toBe('SPADES');
      expect(result.jokerCardId).toBeUndefined();
    });

    it('detects and validates a clean SET of 7 cards (7 of one thing)', () => {
      const cards = [
        makeCard('c1', 'SPADES', 10),
        makeCard('c2', 'HEARTS', 10),
        makeCard('c3', 'DIAMONDS', 10),
        makeCard('c4', 'CLUBS', 10),
        makeCard('c5', 'SPADES', 10),
        makeCard('c6', 'HEARTS', 10),
        makeCard('c7', 'DIAMONDS', 10),
      ];
      const result = validateNewMeld(cards);
      expect(result.valid).toBe(true);
      expect(result.type).toBe('SET');
      expect(result.jokerCardId).toBeUndefined();
    });

    it('identifies jokerCardId in a dirty SET of 7 cards (6 tens + 1 joker)', () => {
      const cards = [
        makeCard('c1', 'SPADES', 10),
        makeCard('c2', 'HEARTS', 10),
        makeCard('c3', 'DIAMONDS', 10),
        makeCard('c4', 'CLUBS', 10),
        makeCard('c5', 'SPADES', 10),
        makeCard('c6', 'HEARTS', 10),
        makeCard('jokerX', null, 0, true),
      ];
      const result = validateNewMeld(cards);
      expect(result.valid).toBe(true);
      expect(result.type).toBe('SET');
      expect(result.jokerCardId).toBe('jokerX');
    });

    it('rejects an incomplete 3-card set like [3, 3, 3] with helpful set error', () => {
      const cards = [
        makeCard('c1', 'SPADES', 3),
        makeCard('c2', 'HEARTS', 3),
        makeCard('c3', 'DIAMONDS', 3),
      ];
      const result = validateNewMeld(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/at least 7 cards/i);
    });

    it('rejects completely invalid combination', () => {
      const cards = [
        makeCard('c1', 'SPADES', 3),
        makeCard('c2', 'HEARTS', 7),
        makeCard('c3', 'DIAMONDS', 11),
      ];
      const result = validateNewMeld(cards);
      expect(result.valid).toBe(false);
    });
  });

  describe('evaluateMeldScore', () => {
    it('scores incomplete melds (< 7 cards) as 0 points', () => {
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          makeCard('c1', 'SPADES', 3),
          makeCard('c2', 'SPADES', 4),
          makeCard('c3', 'SPADES', 5),
        ],
        slots: [
          { card: makeCard('c1', 'SPADES', 3), representedRank: 3 },
          { card: makeCard('c2', 'SPADES', 4), representedRank: 4 },
          { card: makeCard('c3', 'SPADES', 5), representedRank: 5 },
        ],
      };
      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(0);
      expect(score.isComplete7).toBe(false);
      expect(score.isPure13).toBe(false);
    });

    it('scores clean 7-card run as 200 points', () => {
      const cards = [3, 4, 5, 6, 7, 8, 9].map((r) => makeCard(`c${r}`, 'SPADES', r));
      const slots: MeldSlot[] = cards.map((c) => ({
        card: c,
        representedRank: c.rank,
        representedSuit: 'SPADES',
        isWildcard: false,
      }));
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards,
        slots,
      };
      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(200);
      expect(score.isComplete7).toBe(true);
      expect(score.isPure13).toBe(false);
      expect(score.description).toMatch(/clean/i);
    });

    it('scores dirty 7-card run (with natural joker) as 100 points', () => {
      const cards = [
        makeCard('c3', 'SPADES', 3),
        makeCard('c4', 'SPADES', 4),
        makeCard('j1', null, 0, true),
        makeCard('c6', 'SPADES', 6),
        makeCard('c7', 'SPADES', 7),
        makeCard('c8', 'SPADES', 8),
        makeCard('c9', 'SPADES', 9),
      ];
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards,
        slots: [],
      };
      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(100);
      expect(score.isComplete7).toBe(true);
      expect(score.isPure13).toBe(false);
      expect(score.description).toMatch(/dirty/i);
    });

    it('scores clean 7-card run containing natural 2 in natural position as 200 points', () => {
      const cards = [
        makeCard('c2', 'SPADES', 2),
        makeCard('c3', 'SPADES', 3),
        makeCard('c4', 'SPADES', 4),
        makeCard('c5', 'SPADES', 5),
        makeCard('c6', 'SPADES', 6),
        makeCard('c7', 'SPADES', 7),
        makeCard('c8', 'SPADES', 8),
      ];
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards,
        slots: [],
      };
      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(200);
      expect(score.isComplete7).toBe(true);
      expect(score.isPure13).toBe(false);
      expect(score.description).toMatch(/clean/i);
    });

    it('scores dirty 7-card run with 2 acting as a wildcard or different suit as 100 points', () => {
      // 2 of Diamonds acting as wild in Spades run
      const cards = [
        makeCard('c2', 'DIAMONDS', 2),
        makeCard('c3', 'SPADES', 3),
        makeCard('c4', 'SPADES', 4),
        makeCard('c5', 'SPADES', 5),
        makeCard('c6', 'SPADES', 6),
        makeCard('c7', 'SPADES', 7),
        makeCard('c8', 'SPADES', 8),
      ];
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards,
        slots: [],
      };
      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(100);
      expect(score.isComplete7).toBe(true);
      expect(score.isPure13).toBe(false);
      expect(score.description).toMatch(/dirty/i);
    });

    it('scores clean 7-of-a-kind as 200 points', () => {
      const suits: Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES', 'HEARTS', 'DIAMONDS'];
      const cards = suits.map((suit, idx) => makeCard(`c${idx}`, suit, 9));
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'SET',
        rank: 9,
        cards,
        slots: [],
      };
      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(200);
      expect(score.isComplete7).toBe(true);
      expect(score.isPure13).toBe(false);
    });

    it('scores dirty 7-of-a-kind (with wildcard) as 100 points', () => {
      const cards = [
        makeCard('c1', 'SPADES', 9),
        makeCard('c2', 'HEARTS', 9),
        makeCard('c3', 'DIAMONDS', 9),
        makeCard('c4', 'CLUBS', 9),
        makeCard('c5', 'SPADES', 9),
        makeCard('c6', 'HEARTS', 9),
        makeCard('twoWild', 'CLUBS', 2),
      ];
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'SET',
        rank: 9,
        cards,
        slots: [],
      };
      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(100);
      expect(score.isComplete7).toBe(true);
      expect(score.isPure13).toBe(false);
    });

    it('scores Pure 13-card 2-to-A run as 500 points', () => {
      // 13 cards from rank 2 to rank 14 all of suit SPADES
      const cards = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((r) =>
        makeCard(`c${r}`, 'SPADES', r)
      );
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards,
        slots: cards.map((c) => ({
          card: c,
          representedRank: c.rank,
          representedSuit: 'SPADES',
          isWildcard: false,
        })),
      };
      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(500);
      expect(score.isComplete7).toBe(true);
      expect(score.isPure13).toBe(true);
      expect(score.description).toMatch(/pure/i);
    });

    it('scores 13-card run with substituting wildcard as 100 points (not pure 13)', () => {
      // 13 cards, but rank 5 is substituted by 2 of Hearts
      const cards = [
        makeCard('c2', 'SPADES', 2),
        makeCard('c3', 'SPADES', 3),
        makeCard('c4', 'SPADES', 4),
        makeCard('twoHearts', 'HEARTS', 2), // wildcard substitute for 5
        makeCard('c6', 'SPADES', 6),
        makeCard('c7', 'SPADES', 7),
        makeCard('c8', 'SPADES', 8),
        makeCard('c9', 'SPADES', 9),
        makeCard('c10', 'SPADES', 10),
        makeCard('c11', 'SPADES', 11),
        makeCard('c12', 'SPADES', 12),
        makeCard('c13', 'SPADES', 13),
        makeCard('c14', 'SPADES', 14),
      ];
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards,
        slots: [],
      };
      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(100);
      expect(score.isComplete7).toBe(true);
      expect(score.isPure13).toBe(false);
    });
  });
});
