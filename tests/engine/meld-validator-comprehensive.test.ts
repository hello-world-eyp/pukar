import { describe, it, expect } from 'vitest';
import {
  validateNewRun,
  validateNewSet,
  validateNewMeld,
  evaluateMeldScore,
  isWildcard,
} from '../../src/engine/meld-validator';
import { Card, Suit, Meld, Rank } from '../../src/engine/types';

function makeCard(suit: Suit | null, rank: number, id?: string): Card {
  const isJoker = rank === 0 && suit === null;
  return {
    id: id ?? `card-${suit}-${rank}-${Math.random()}`,
    suit,
    rank: rank as Rank,
    isNaturalJoker: isJoker,
    isJoker: isJoker || rank === 2,
  };
}

describe('Comprehensive Meld Validator & Scoring Engine (src/engine/meld-validator.ts)', () => {
  describe('isWildcard helper', () => {
    it('identifies Natural Jokers as wildcards', () => {
      const joker = makeCard(null, 0);
      expect(isWildcard(joker)).toBe(true);
    });

    it('identifies any card of rank 2 as wildcard', () => {
      expect(isWildcard(makeCard('SPADES', 2))).toBe(true);
      expect(isWildcard(makeCard('HEARTS', 2))).toBe(true);
      expect(isWildcard(makeCard('DIAMONDS', 2))).toBe(true);
      expect(isWildcard(makeCard('CLUBS', 2))).toBe(true);
    });

    it('identifies standard non-2 cards as non-wildcard', () => {
      expect(isWildcard(makeCard('SPADES', 3))).toBe(false);
      expect(isWildcard(makeCard('HEARTS', 10))).toBe(false);
      expect(isWildcard(makeCard('DIAMONDS', 12))).toBe(false);
      expect(isWildcard(makeCard('CLUBS', 14))).toBe(false);
    });
  });

  describe('validateNewRun', () => {
    describe('Clean Runs (0 wildcards)', () => {
      it('validates 3-card clean runs across all 4 suits', () => {
        const suits: Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
        suits.forEach((suit) => {
          const cards = [makeCard(suit, 4), makeCard(suit, 5), makeCard(suit, 6)];
          const res = validateNewRun(cards);
          expect(res.valid).toBe(true);
          expect(res.slots).toHaveLength(3);
          expect(res.slots?.every((s) => s.representedSuit === suit)).toBe(true);
          expect(res.slots?.every((s) => !s.isWildcard)).toBe(true);
        });
      });

      it('validates Ace low run (A-2-3-4) when 2 is naturally positioned in the run sequence', () => {
        const cards = [
          makeCard('HEARTS', 14),
          makeCard('HEARTS', 2),
          makeCard('HEARTS', 3),
          makeCard('HEARTS', 4),
        ];
        const res = validateNewRun(cards);
        expect(res.valid).toBe(true);
        expect(res.slots?.map((s) => s.representedRank)).toEqual([1, 2, 3, 4]);
      });

      it('validates Ace high run (10-J-Q-K-A)', () => {
        const cards = [
          makeCard('DIAMONDS', 10),
          makeCard('DIAMONDS', 11),
          makeCard('DIAMONDS', 12),
          makeCard('DIAMONDS', 13),
          makeCard('DIAMONDS', 14),
        ];
        const res = validateNewRun(cards);
        expect(res.valid).toBe(true);
        expect(res.slots?.map((s) => s.representedRank)).toEqual([10, 11, 12, 13, 14]);
      });

      it('rejects wrap-around sequences and Ace in the middle without wildcards (e.g. K-A-3 and Q-K-A-3)', () => {
        const cards1 = [makeCard('SPADES', 13), makeCard('SPADES', 14), makeCard('SPADES', 3)];
        expect(validateNewRun(cards1).valid).toBe(false);

        const cards2 = [
          makeCard('CLUBS', 12),
          makeCard('CLUBS', 13),
          makeCard('CLUBS', 14),
          makeCard('CLUBS', 3),
        ];
        expect(validateNewRun(cards2).valid).toBe(false);

        const cards3 = [
          makeCard('SPADES', 13),
          makeCard('SPADES', 14),
          makeCard('SPADES', 2),
          makeCard('SPADES', 3),
        ];
        expect(validateNewRun(cards3).valid).toBe(false);
      });

      it('rejects runs with fewer than 3 cards', () => {
        const cards = [makeCard('HEARTS', 5), makeCard('HEARTS', 6)];
        const res = validateNewRun(cards);
        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/at least 3 cards/);
      });

      it('rejects runs with mismatched suits among natural cards', () => {
        const cards = [makeCard('HEARTS', 5), makeCard('SPADES', 6), makeCard('HEARTS', 7)];
        const res = validateNewRun(cards);
        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/same suit/);
      });

      it('rejects runs with non-consecutive ranks', () => {
        const cards = [makeCard('DIAMONDS', 5), makeCard('DIAMONDS', 7), makeCard('DIAMONDS', 8)];
        const res = validateNewRun(cards);
        expect(res.valid).toBe(false);
      });

      it('rejects runs with duplicate ranks', () => {
        const cards = [makeCard('CLUBS', 5), makeCard('CLUBS', 5), makeCard('CLUBS', 6)];
        const res = validateNewRun(cards);
        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/duplicate/);
      });
    });

    describe('Dirty Runs with 1 Wildcard', () => {
      it('validates 1 Natural Joker substituting in the middle of a run', () => {
        const cards = [makeCard('SPADES', 4), makeCard(null, 0), makeCard('SPADES', 6)];
        const res = validateNewRun(cards);
        expect(res.valid).toBe(true);
        expect(res.slots?.map((s) => s.representedRank)).toEqual([4, 5, 6]);
        expect(res.slots?.[1].isWildcard).toBe(true);
      });

      it('validates 1 Natural Joker substituting at the end of a run', () => {
        const cards = [makeCard('HEARTS', 8), makeCard('HEARTS', 9), makeCard(null, 0)];
        const res = validateNewRun(cards);
        expect(res.valid).toBe(true);
        expect(res.slots?.map((s) => s.representedRank)).toEqual([8, 9, 10]);
        expect(res.slots?.[2].isWildcard).toBe(true);
      });

      it('validates 1 Natural Joker substituting at the beginning of a run', () => {
        const cards = [makeCard(null, 0), makeCard('CLUBS', 12), makeCard('CLUBS', 13)];
        const res = validateNewRun(cards);
        expect(res.valid).toBe(true);
        expect(res.slots?.map((s) => s.representedRank)).toEqual([11, 12, 13]);
        expect(res.slots?.[0].isWildcard).toBe(true);
      });

      it('validates Rank 2 substituting as wildcard for a missing rank', () => {
        // 2 of Diamonds acting as 5 of Spades in a Spades run
        const cards = [makeCard('SPADES', 4), makeCard('DIAMONDS', 2), makeCard('SPADES', 6)];
        const res = validateNewRun(cards);
        expect(res.valid).toBe(true);
        expect(res.slots?.map((s) => s.representedRank)).toEqual([4, 5, 6]);
        expect(res.slots?.[1].isWildcard).toBe(true);
      });

      it('rejects runs with 2 wildcards (two 2s)', () => {
        const cards = [
          makeCard('SPADES', 4),
          makeCard('HEARTS', 2),
          makeCard('CLUBS', 2),
          makeCard('SPADES', 7),
        ];
        const res = validateNewRun(cards);
        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/more than 1 wildcard/);
      });

      it('rejects runs with 2 wildcards (two Natural Jokers)', () => {
        const cards = [makeCard('SPADES', 4), makeCard(null, 0), makeCard(null, 0)];
        const res = validateNewRun(cards);
        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/more than 1 wildcard/);
      });

      it('rejects runs with 1 Natural Joker AND 1 Rank 2', () => {
        const cards = [makeCard('SPADES', 4), makeCard(null, 0), makeCard('HEARTS', 2)];
        const res = validateNewRun(cards);
        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/more than 1 wildcard/);
      });
    });
  });

  describe('validateNewSet', () => {
    describe('Clean Sets (0 wildcards)', () => {
      it('validates clean set of 7 cards of identical rank across suits', () => {
        const cards = [
          makeCard('SPADES', 8, 'c1'),
          makeCard('HEARTS', 8, 'c2'),
          makeCard('DIAMONDS', 8, 'c3'),
          makeCard('CLUBS', 8, 'c4'),
          makeCard('SPADES', 8, 'c5'),
          makeCard('HEARTS', 8, 'c6'),
          makeCard('DIAMONDS', 8, 'c7'),
        ];
        const res = validateNewSet(cards);
        expect(res.valid).toBe(true);
        expect(res.slots).toHaveLength(7);
        expect(res.slots?.every((s) => s.representedRank === 8)).toBe(true);
        expect(res.slots?.every((s) => !s.isWildcard)).toBe(true);
      });

      it('validates clean set of 8 cards of identical rank', () => {
        const cards = [
          makeCard('SPADES', 11, 'c1'),
          makeCard('HEARTS', 11, 'c2'),
          makeCard('DIAMONDS', 11, 'c3'),
          makeCard('CLUBS', 11, 'c4'),
          makeCard('SPADES', 11, 'c5'),
          makeCard('HEARTS', 11, 'c6'),
          makeCard('DIAMONDS', 11, 'c7'),
          makeCard('CLUBS', 11, 'c8'),
        ];
        const res = validateNewSet(cards);
        expect(res.valid).toBe(true);
        expect(res.slots).toHaveLength(8);
      });

      it('validates clean sets containing duplicate suits (multi-deck game)', () => {
        const cards = [
          makeCard('SPADES', 7, 'deck0-7s'),
          makeCard('SPADES', 7, 'deck1-7s'),
          makeCard('HEARTS', 7, 'deck0-7h'),
          makeCard('HEARTS', 7, 'deck1-7h'),
          makeCard('DIAMONDS', 7, 'deck0-7d'),
          makeCard('DIAMONDS', 7, 'deck1-7d'),
          makeCard('CLUBS', 7, 'deck0-7c'),
        ];
        const res = validateNewSet(cards);
        expect(res.valid).toBe(true);
      });

      it('rejects set of fewer than 7 cards (e.g. 2, 3, or 6 cards)', () => {
        const cards2 = [makeCard('SPADES', 9), makeCard('HEARTS', 9)];
        expect(validateNewSet(cards2).valid).toBe(false);
        expect(validateNewSet(cards2).error).toMatch(/at least 7 cards/);

        const cards3 = [makeCard('SPADES', 3), makeCard('HEARTS', 3), makeCard('DIAMONDS', 3)];
        expect(validateNewSet(cards3).valid).toBe(false);
        expect(validateNewSet(cards3).error).toMatch(/at least 7 cards/);
      });

      it('rejects set with mixed ranks', () => {
        const cards = [
          makeCard('SPADES', 9, 'c1'),
          makeCard('HEARTS', 9, 'c2'),
          makeCard('DIAMONDS', 9, 'c3'),
          makeCard('CLUBS', 9, 'c4'),
          makeCard('SPADES', 9, 'c5'),
          makeCard('HEARTS', 9, 'c6'),
          makeCard('DIAMONDS', 10, 'c7'),
        ];
        const res = validateNewSet(cards);
        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/same rank/);
      });
    });

    describe('Dirty Sets with 1 Wildcard', () => {
      it('validates a dirty set with 6 of one thing and 1 Natural Joker (7 cards total)', () => {
        const cards = [
          makeCard('SPADES', 10, 'c1'),
          makeCard('HEARTS', 10, 'c2'),
          makeCard('DIAMONDS', 10, 'c3'),
          makeCard('CLUBS', 10, 'c4'),
          makeCard('SPADES', 10, 'c5'),
          makeCard('HEARTS', 10, 'c6'),
          makeCard(null, 0, 'j1'),
        ];
        const res = validateNewSet(cards);
        expect(res.valid).toBe(true);
        expect(res.slots?.map((s) => s.representedRank)).toEqual([10, 10, 10, 10, 10, 10, 10]);
        expect(res.slots?.[6].isWildcard).toBe(true);
      });

      it('validates a dirty set with 6 of one thing and 1 Rank 2 as wildcard (7 cards total)', () => {
        const cards = [
          makeCard('SPADES', 14, 'c1'),
          makeCard('CLUBS', 14, 'c2'),
          makeCard('HEARTS', 14, 'c3'),
          makeCard('DIAMONDS', 14, 'c4'),
          makeCard('SPADES', 14, 'c5'),
          makeCard('CLUBS', 14, 'c6'),
          makeCard('DIAMONDS', 2, 'two-d'),
        ];
        const res = validateNewSet(cards);
        expect(res.valid).toBe(true);
        expect(res.slots?.map((s) => s.representedRank)).toEqual([14, 14, 14, 14, 14, 14, 14]);
        expect(res.slots?.[6].isWildcard).toBe(true);
      });

      it('rejects a set with 2+ wildcards', () => {
        const cards = [
          makeCard('SPADES', 5, 'c1'),
          makeCard('HEARTS', 5, 'c2'),
          makeCard('DIAMONDS', 5, 'c3'),
          makeCard('CLUBS', 5, 'c4'),
          makeCard('SPADES', 5, 'c5'),
          makeCard(null, 0, 'j1'),
          makeCard('HEARTS', 2, 'two-h'),
        ];
        const res = validateNewSet(cards);
        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/more than 1 wildcard/);
      });

      it('rejects a dirty set with fewer than 7 cards (e.g. 5 natural + 1 joker)', () => {
        const cards = [
          makeCard('SPADES', 5, 'c1'),
          makeCard('HEARTS', 5, 'c2'),
          makeCard('DIAMONDS', 5, 'c3'),
          makeCard('CLUBS', 5, 'c4'),
          makeCard('SPADES', 5, 'c5'),
          makeCard(null, 0, 'j1'),
        ];
        const res = validateNewSet(cards);
        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/at least 7 cards/);
      });

      it('rejects a set composed only of wildcards', () => {
        const cards = [
          makeCard(null, 0, 'j1'),
          makeCard(null, 0, 'j2'),
          makeCard('HEARTS', 2, 'two-h1'),
          makeCard('SPADES', 2, 'two-s1'),
          makeCard('CLUBS', 2, 'two-c1'),
          makeCard('DIAMONDS', 2, 'two-d1'),
          makeCard('HEARTS', 2, 'two-h2'),
        ];
        const res = validateNewSet(cards);
        expect(res.valid).toBe(false);
      });
    });
  });

  describe('validateNewMeld (Auto-detection)', () => {
    it('detects and classifies a RUN', () => {
      const cards = [makeCard('HEARTS', 7), makeCard('HEARTS', 8), makeCard('HEARTS', 9)];
      const res = validateNewMeld(cards);
      expect(res.valid).toBe(true);
      expect(res.type).toBe('RUN');
      expect(res.suit).toBe('HEARTS');
      expect(res.jokerCardId).toBeUndefined();
    });

    it('detects and classifies a SET of 7 cards (7 of one thing)', () => {
      const cards = [
        makeCard('SPADES', 6, 'c1'),
        makeCard('HEARTS', 6, 'c2'),
        makeCard('DIAMONDS', 6, 'c3'),
        makeCard('CLUBS', 6, 'c4'),
        makeCard('SPADES', 6, 'c5'),
        makeCard('HEARTS', 6, 'c6'),
        makeCard('DIAMONDS', 6, 'c7'),
      ];
      const res = validateNewMeld(cards);
      expect(res.valid).toBe(true);
      expect(res.type).toBe('SET');
      expect(res.jokerCardId).toBeUndefined();
    });

    it('identifies jokerCardId in dirty melds', () => {
      const joker = makeCard(null, 0, 'joker-special-id');
      const cards = [makeCard('CLUBS', 3), joker, makeCard('CLUBS', 5)];
      const res = validateNewMeld(cards);
      expect(res.valid).toBe(true);
      expect(res.type).toBe('RUN');
      expect(res.jokerCardId).toBe('joker-special-id');
    });

    it('rejects arbitrary card combinations that are neither run nor set', () => {
      const cards = [makeCard('SPADES', 3), makeCard('HEARTS', 7), makeCard('CLUBS', 12)];
      const res = validateNewMeld(cards);
      expect(res.valid).toBe(false);
    });
  });

  describe('evaluateMeldScore', () => {
    it('scores incomplete runs (< 7 cards) as 0 bonus points', () => {
      const slots = [
        { card: makeCard('SPADES', 3), representedRank: 3, isWildcard: false },
        { card: makeCard('SPADES', 4), representedRank: 4, isWildcard: false },
        { card: makeCard('SPADES', 5), representedRank: 5, isWildcard: false },
      ];
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: slots.map((s) => s.card),
        slots,
      };
      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(0);
      expect(score.isComplete7).toBe(false);
      expect(score.isPure13).toBe(false);
    });

    it('scores clean 7-card run as 200 points', () => {
      const slots = [3, 4, 5, 6, 7, 8, 9].map((rank) => ({
        card: makeCard('HEARTS', rank),
        representedRank: rank,
        isWildcard: false,
      }));
      const meld: Meld = {
        id: 'm2',
        team: 'A',
        type: 'RUN',
        suit: 'HEARTS',
        cards: slots.map((s) => s.card),
        slots,
      };

      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(200);
      expect(score.isComplete7).toBe(true);
      expect(score.description).toContain('Clean 7-Card Run');
    });

    it('scores dirty 7-card run (with 1 wildcard) as 100 points', () => {
      const slots = [
        { card: makeCard('HEARTS', 3), representedRank: 3, isWildcard: false },
        { card: makeCard(null, 0), representedRank: 4, isWildcard: true },
        { card: makeCard('HEARTS', 5), representedRank: 5, isWildcard: false },
        { card: makeCard('HEARTS', 6), representedRank: 6, isWildcard: false },
        { card: makeCard('HEARTS', 7), representedRank: 7, isWildcard: false },
        { card: makeCard('HEARTS', 8), representedRank: 8, isWildcard: false },
        { card: makeCard('HEARTS', 9), representedRank: 9, isWildcard: false },
      ];
      const meld: Meld = {
        id: 'm3',
        team: 'B',
        type: 'RUN',
        suit: 'HEARTS',
        cards: slots.map((s) => s.card),
        slots,
      };

      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(100);
      expect(score.isComplete7).toBe(true);
      expect(score.description).toContain('Dirty 7-Card Run');
    });

    it('scores clean 7-of-a-kind set as 200 points', () => {
      const slots = Array.from({ length: 7 }, (_, i) => ({
        card: makeCard(i % 2 === 0 ? 'SPADES' : 'HEARTS', 9),
        representedRank: 9,
        isWildcard: false,
      }));
      const meld: Meld = {
        id: 'm4',
        team: 'A',
        type: 'SET',
        cards: slots.map((s) => s.card),
        slots,
      };

      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(200);
      expect(score.isComplete7).toBe(true);
      expect(score.description).toContain('Clean 7-of-a-Kind');
    });

    it('scores dirty 7-of-a-kind set as 100 points', () => {
      const slots = Array.from({ length: 6 }, (_, i) => ({
        card: makeCard(i % 2 === 0 ? 'SPADES' : 'HEARTS', 9),
        representedRank: 9,
        isWildcard: false,
      }));
      slots.push({
        card: makeCard(null, 0),
        representedRank: 9,
        isWildcard: true,
      });
      const meld: Meld = {
        id: 'm5',
        team: 'B',
        type: 'SET',
        cards: slots.map((s) => s.card),
        slots,
      };

      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(100);
      expect(score.isComplete7).toBe(true);
      expect(score.description).toContain('Dirty 7-of-a-Kind');
    });

    it('scores pure 13-card 2-to-A run as 500 points', () => {
      // 13 cards: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 all SPADES, 0 wildcards
      const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
      const slots = ranks.map((rank) => ({
        card: makeCard('SPADES', rank),
        representedRank: rank,
        isWildcard: false,
      }));
      const meld: Meld = {
        id: 'm6',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: slots.map((s) => s.card),
        slots,
      };

      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(500);
      expect(score.isPure13).toBe(true);
      expect(score.isComplete7).toBe(true);
      expect(score.description).toContain('Pure 13-Card Run');
    });

    it('scores 13-card run with wildcard as 100 points (rejects 500 pure bonus)', () => {
      const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
      const slots = ranks.map((rank) => ({
        card: rank === 5 ? makeCard(null, 0) : makeCard('SPADES', rank),
        representedRank: rank,
        isWildcard: rank === 5,
      }));
      const meld: Meld = {
        id: 'm7',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: slots.map((s) => s.card),
        slots,
      };

      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(100);
      expect(score.isPure13).toBe(false);
      expect(score.isComplete7).toBe(true);
    });
  });
});
