import { describe, it, expect } from 'vitest';
import { Card, Meld, Rank, Suit } from '../../../src/engine/types';
import {
  findCandidateRunsInSuit,
  findPotentialNewMelds,
  findPotentialAdditionsToMelds,
  findBestMeldPlan,
  evaluateDeadwoodAndDiscard,
  countTwosInMeld,
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

  describe('Refrain from putting 2 2s in the same sequence', () => {
    it('countTwosInMeld correctly counts cards of rank 2 across cards and slots', () => {
      const meldWithNatural2: Meld = {
        id: 'm1',
        type: 'RUN',
        suit: 'HEARTS',
        cards: [
          makeCard('hA', 'HEARTS', 14),
          makeCard('h2', 'HEARTS', 2),
          makeCard('h3', 'HEARTS', 3),
        ],
        slots: [
          { card: makeCard('hA', 'HEARTS', 14), representedRank: 1, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h2', 'HEARTS', 2), representedRank: 2, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h3', 'HEARTS', 3), representedRank: 3, representedSuit: 'HEARTS', isWildcard: false },
        ],
        team: 'A',
        points: 20,
        isClean: true,
        isPure: true,
        isPure13: false,
      };

      expect(countTwosInMeld(meldWithNatural2)).toBe(1);

      const meldWithout2: Meld = {
        id: 'm2',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          makeCard('s4', 'SPADES', 4),
          makeCard('s5', 'SPADES', 5),
          makeCard('s6', 'SPADES', 6),
        ],
        slots: [],
        team: 'A',
        points: 15,
        isClean: true,
        isPure: true,
        isPure13: false,
      };

      expect(countTwosInMeld(meldWithout2)).toBe(0);
    });

    it('findPotentialAdditionsToMelds does not add a 2 to a sequence that already contains a 2', () => {
      // Sequence has natural 2 (Hearts A-2-3-4-5-6-7, 7 cards, missing 8)
      const existingMeld: Meld = {
        id: 'm-hearts',
        type: 'RUN',
        suit: 'HEARTS',
        cards: [
          makeCard('hA', 'HEARTS', 14),
          makeCard('h2_natural', 'HEARTS', 2),
          makeCard('h3', 'HEARTS', 3),
          makeCard('h4', 'HEARTS', 4),
          makeCard('h5', 'HEARTS', 5),
          makeCard('h6', 'HEARTS', 6),
          makeCard('h7', 'HEARTS', 7),
        ],
        slots: [
          { card: makeCard('hA', 'HEARTS', 14), representedRank: 1, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h2_natural', 'HEARTS', 2), representedRank: 2, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h3', 'HEARTS', 3), representedRank: 3, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h4', 'HEARTS', 4), representedRank: 4, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h5', 'HEARTS', 5), representedRank: 5, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h6', 'HEARTS', 6), representedRank: 6, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h7', 'HEARTS', 7), representedRank: 7, representedSuit: 'HEARTS', isWildcard: false },
        ],
        team: 'B',
        points: 200,
        isClean: true,
        isPure: true,
        isPure13: false,
      };

      // Hand has a second 2♥ and a natural 8♥
      const hand: Card[] = [
        makeCard('h2_second', 'HEARTS', 2),
        makeCard('h8', 'HEARTS', 8),
      ];

      const additions = findPotentialAdditionsToMelds(hand, [existingMeld]);

      // Natural 8♥ should be proposed as an addition
      const add8 = additions.find((a) => a.cardIds.includes('h8'));
      expect(add8).toBeDefined();

      // The second 2♥ should NEVER be proposed as an addition to the same sequence!
      const add2 = additions.find((a) => a.cardIds.includes('h2_second'));
      expect(add2).toBeUndefined();
    });

    it('findCandidateRunsInSuit does not form candidate runs with more than one 2', () => {
      // Hand has A♥, 2♥_1, 3♥, 4♥, missing 5♥, and another 2♥_2 as wildcard
      const suitedCards: Card[] = [
        makeCard('hA', 'HEARTS', 14),
        makeCard('h2_1', 'HEARTS', 2),
        makeCard('h3', 'HEARTS', 3),
        makeCard('h4', 'HEARTS', 4),
        makeCard('h6', 'HEARTS', 6),
      ];
      const wildcards: Card[] = [
        makeCard('h2_2', 'HEARTS', 2),
      ];

      const runs = findCandidateRunsInSuit(suitedCards, 'HEARTS', wildcards);

      // Verify none of the candidate runs contain both 2s
      for (const run of runs) {
        const twosCount = run.cards.filter((c) => c.rank === 2).length;
        expect(twosCount).toBeLessThanOrEqual(1);
      }
    });

    it('findBestMeldPlan refrains from putting 2 2s in the same sequence during turn planning', () => {
      // Existing meld with 2♥
      const teamMeld: Meld = {
        id: 'm-hearts-1',
        type: 'RUN',
        suit: 'HEARTS',
        cards: [
          makeCard('hA', 'HEARTS', 14),
          makeCard('h2_nat', 'HEARTS', 2),
          makeCard('h3', 'HEARTS', 3),
          makeCard('h4', 'HEARTS', 4),
        ],
        slots: [
          { card: makeCard('hA', 'HEARTS', 14), representedRank: 1, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h2_nat', 'HEARTS', 2), representedRank: 2, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h3', 'HEARTS', 3), representedRank: 3, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h4', 'HEARTS', 4), representedRank: 4, representedSuit: 'HEARTS', isWildcard: false },
        ],
        team: 'A',
        points: 20,
        isClean: true,
        isPure: true,
        isPure13: false,
      };

      const hand: Card[] = [
        makeCard('h2_wild', 'SPADES', 2), // cross-suit 2
        makeCard('c9', 'CLUBS', 9),
        makeCard('d10', 'DIAMONDS', 10),
      ];

      const plan = findBestMeldPlan(hand, [teamMeld]);

      // Should not add the second 2 to the Hearts sequence
      const addAction = plan.additionsToPlay.find((a) => a.cardIds.includes('h2_wild'));
      expect(addAction).toBeUndefined();
    });

    it('allows adding a second 2 to a sequence of < 8 cards when very close to Pukar (<= 2 cards)', () => {
      const teamMeld: Meld = {
        id: 'meld-hearts-run',
        type: 'RUN',
        suit: 'HEARTS',
        cards: [
          makeCard('hA', 'HEARTS', 14),
          makeCard('h2_nat', 'HEARTS', 2),
          makeCard('h3', 'HEARTS', 3),
          makeCard('h4', 'HEARTS', 4),
          makeCard('h5', 'HEARTS', 5),
        ],
        slots: [
          { card: makeCard('hA', 'HEARTS', 14), representedRank: 1, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h2_nat', 'HEARTS', 2), representedRank: 2, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h3', 'HEARTS', 3), representedRank: 3, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h4', 'HEARTS', 4), representedRank: 4, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h5', 'HEARTS', 5), representedRank: 5, representedSuit: 'HEARTS', isWildcard: false },
        ],
        team: 'A',
        points: 25,
        isClean: true,
        isPure: true,
        isPure13: false,
      };

      const hand: Card[] = [
        makeCard('s2_wild', 'SPADES', 2), // cross-suit 2
        makeCard('c9', 'CLUBS', 9),
      ];

      const plan = findBestMeldPlan(hand, [teamMeld]);

      // Should add the 2 of Spades to the 5-card Hearts run when holding 2 cards
      const addAction = plan.additionsToPlay.find((a) => a.cardIds.includes('s2_wild'));
      expect(addAction).toBeDefined();
    });

    it('forbids adding a second 2 to a sequence of 10+ cards even when holding 2 cards (protecting 500)', () => {
      const teamMeld: Meld = {
        id: 'meld-hearts-10',
        type: 'RUN',
        suit: 'HEARTS',
        cards: [
          makeCard('h1', 'HEARTS', 14),
          makeCard('h2', 'HEARTS', 2),
          makeCard('h3', 'HEARTS', 3),
          makeCard('h4', 'HEARTS', 4),
          makeCard('h5', 'HEARTS', 5),
          makeCard('h6', 'HEARTS', 6),
          makeCard('h7', 'HEARTS', 7),
          makeCard('h8', 'HEARTS', 8),
          makeCard('h9', 'HEARTS', 9),
          makeCard('h10', 'HEARTS', 10),
        ],
        slots: [
          { card: makeCard('h1', 'HEARTS', 14), representedRank: 1, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h2', 'HEARTS', 2), representedRank: 2, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h3', 'HEARTS', 3), representedRank: 3, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h4', 'HEARTS', 4), representedRank: 4, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h5', 'HEARTS', 5), representedRank: 5, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h6', 'HEARTS', 6), representedRank: 6, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h7', 'HEARTS', 7), representedRank: 7, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h8', 'HEARTS', 8), representedRank: 8, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h9', 'HEARTS', 9), representedRank: 9, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h10', 'HEARTS', 10), representedRank: 10, representedSuit: 'HEARTS', isWildcard: false },
        ],
        team: 'A',
        points: 200,
        isClean: true,
        isPure: true,
        isPure13: false,
      };

      const hand: Card[] = [
        makeCard('s2_wild', 'SPADES', 2), // cross-suit 2
        makeCard('c9', 'CLUBS', 9),
      ];

      const plan = findBestMeldPlan(hand, [teamMeld]);

      // Should strictly forbid tainting the 10-card sequence
      const addAction = plan.additionsToPlay.find((a) => a.cardIds.includes('s2_wild'));
      expect(addAction).toBeUndefined();
    });
  });
});
