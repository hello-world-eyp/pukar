import { describe, it, expect } from 'vitest';
import { Card, Meld, Rank, Suit } from '../../../src/engine/types';
import {
  findCandidateRunsInSuit,
  findPotentialNewMelds,
  findPotentialAdditionsToMelds,
  findBestMeldPlan,
  evaluateDeadwoodAndDiscard,
} from '../../../src/engine/bots/hand-analyzer';

describe('Bot Hand Analyzer', () => {
  function makeCard(id: string, suit: Suit | null, rank: Rank, isNaturalJoker = false): Card {
    return {
      id,
      suit,
      rank,
      isNaturalJoker,
      isJoker: isNaturalJoker || rank === 2 || rank === 0,
    };
  }

  describe('findCandidateRunsInSuit', () => {
    it('finds consecutive natural runs of length 3+', () => {
      const cards: Card[] = [
        makeCard('c1', 'SPADES', 3),
        makeCard('c2', 'SPADES', 4),
        makeCard('c3', 'SPADES', 5),
        makeCard('c4', 'SPADES', 8),
      ];

      const runs = findCandidateRunsInSuit(cards, 'SPADES', []);
      expect(runs.length).toBeGreaterThan(0);
      const run345 = runs.find((r) => r.cards.length === 3);
      expect(run345).toBeDefined();
      expect(run345?.isPure).toBe(true);
    });

    it('identifies Ace-low (A-2-3) and Ace-high (Q-K-A) runs', () => {
      const cardsAceLow: Card[] = [
        makeCard('c1', 'HEARTS', 14),
        makeCard('c2', 'HEARTS', 2),
        makeCard('c3', 'HEARTS', 3),
      ];

      const runsLow = findCandidateRunsInSuit(cardsAceLow, 'HEARTS', []);
      expect(runsLow.some((r) => r.cards.length === 3)).toBe(true);

      const cardsAceHigh: Card[] = [
        makeCard('c4', 'CLUBS', 12),
        makeCard('c5', 'CLUBS', 13),
        makeCard('c6', 'CLUBS', 14),
      ];
      const runsHigh = findCandidateRunsInSuit(cardsAceHigh, 'CLUBS', []);
      expect(runsHigh.some((r) => r.cards.length === 3)).toBe(true);
    });

    it('supports dirty runs using 1 wildcard', () => {
      const suitedCards: Card[] = [
        makeCard('c1', 'DIAMONDS', 6),
        makeCard('c2', 'DIAMONDS', 8),
      ];
      const wildcards: Card[] = [makeCard('w1', null, 0, true)];

      const runs = findCandidateRunsInSuit(suitedCards, 'DIAMONDS', wildcards);
      expect(runs.length).toBeGreaterThan(0);
      const dirtyRun = runs.find((r) => r.cards.length === 3 && !r.isPure);
      expect(dirtyRun).toBeDefined();
    });
  });

  describe('findPotentialNewMelds with requirePure rule', () => {
    it('enforces requirePure when team has 0 table melds', () => {
      const hand: Card[] = [
        makeCard('c1', 'SPADES', 4),
        makeCard('c2', 'SPADES', 6),
        makeCard('w1', null, 0, true), // Natural Joker
        makeCard('c3', 'HEARTS', 7),
        makeCard('c4', 'HEARTS', 8),
        makeCard('c5', 'HEARTS', 9),
      ];

      // Hand has dirty Spades run (4-Joker-6) and pure Hearts run (7-8-9)
      const meldsPureRequired = findPotentialNewMelds(hand, { requirePure: true });
      // The dirty run must be filtered out when requirePure is true
      expect(meldsPureRequired.every((m) => m.isPure)).toBe(true);
      expect(meldsPureRequired.some((m) => m.suit === 'HEARTS')).toBe(true);
      expect(meldsPureRequired.some((m) => m.suit === 'SPADES')).toBe(false);
    });
  });

  describe('findPotentialAdditionsToMelds', () => {
    it('finds cards in hand that can extend an existing table run', () => {
      const tableMeld: Meld = {
        id: 'meld-1',
        team: 'A',
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
      };

      const hand: Card[] = [
        makeCard('h1', 'SPADES', 3), // can prepend to 4-5-6
        makeCard('h2', 'HEARTS', 10), // unrelated
      ];

      const additions = findPotentialAdditionsToMelds(hand, [tableMeld]);
      expect(additions.length).toBeGreaterThan(0);
      expect(additions[0].meldId).toBe('meld-1');
      expect(additions[0].cardIds).toEqual(['h1']);
    });

    it('plans non-overlapping meld deployment prioritizing highest score', () => {
      const hand: Card[] = [
        makeCard('s3', 'SPADES', 3),
        makeCard('s4', 'SPADES', 4),
        makeCard('s5', 'SPADES', 5),
        makeCard('h7', 'HEARTS', 7),
        makeCard('h8', 'HEARTS', 8),
        makeCard('h9', 'HEARTS', 9),
      ];
      const dummyMeld: Meld = {
        id: 'm0',
        type: 'RUN',
        cards: [],
        slots: [],
        team: 'A',
        points: 0,
        isClean: false,
        isPure: false,
        isPure13: false,
      };
      const plan = findBestMeldPlan(hand, [dummyMeld]);
      expect(plan.meldsToPlay.length).toBe(2);
      expect(plan.usedCardIds.size).toBe(6);
    });
  });

  describe('evaluateDeadwoodAndDiscard', () => {
    it('never recommends discarding natural jokers or rank 2 wildcards', () => {
      const hand: Card[] = [
        makeCard('j1', null, 0, true),
        makeCard('w2', 'HEARTS', 2),
        makeCard('c1', 'CLUBS', 9),
      ];

      const evaluation = evaluateDeadwoodAndDiscard(hand, new Set());
      expect(evaluation.recommendedDiscard?.id).toBe('c1');
    });

    it('honors cards disallowed from discard (e.g. single drawn card)', () => {
      const hand: Card[] = [
        makeCard('c1', 'CLUBS', 9),
        makeCard('c2', 'DIAMONDS', 10),
      ];

      const evaluation = evaluateDeadwoodAndDiscard(hand, new Set(), {
        disallowedCardId: 'c1',
      });
      expect(evaluation.recommendedDiscard?.id).toBe('c2');
    });
  });
});
