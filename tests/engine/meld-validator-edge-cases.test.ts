import { describe, it, expect } from 'vitest';
import {
  validateNewRun,
  validateNewSet,
  canAddCardsToMeld,
  evaluateMeldScore,
} from '../../src/engine/meld-validator';
import { Card, Meld, Suit } from '../../src/engine/types';

function makeCard(id: string, suit: Suit | null, rank: number, isNaturalJoker = false): Card {
  return {
    id,
    suit,
    rank: rank as Card['rank'],
    isNaturalJoker,
    isJoker: isNaturalJoker || rank === 0 || rank === 2,
  };
}

describe('Meld Validator Edge Cases & Multi-Deck Duplicate Protection', () => {
  it('rejects candidate run containing duplicate ranks of the same suit', () => {
    // In multi-deck games, duplicate 5 of Spades could be in hand
    const cards = [
      makeCard('c1', 'SPADES', 4),
      makeCard('c2', 'SPADES', 5),
      makeCard('c3', 'SPADES', 5), // duplicate 5♠
      makeCard('c4', 'SPADES', 6),
    ];

    const result = validateNewRun(cards);
    expect(result.valid).toBe(false);
  });

  it('rejects candidate run containing cards of multiple different suits that are not wildcards', () => {
    const cards = [
      makeCard('c1', 'SPADES', 4),
      makeCard('c2', 'HEARTS', 5),
      makeCard('c3', 'DIAMONDS', 6),
    ];

    const result = validateNewRun(cards);
    expect(result.valid).toBe(false);
  });

  it('rejects candidate run containing more than 1 guaranteed wildcard', () => {
    const cards = [
      makeCard('c1', 'SPADES', 4),
      makeCard('j1', null, 0, true),
      makeCard('j2', null, 0, true),
      makeCard('c4', 'SPADES', 7),
    ];

    const result = validateNewRun(cards);
    expect(result.valid).toBe(false);
  });

  it('rejects wrap-around sequences across Ace (K - A - 2 or K - A - 3)', () => {
    const cards = [
      makeCard('c1', 'SPADES', 13), // K
      makeCard('c2', 'SPADES', 14), // A
      makeCard('c3', 'SPADES', 3),  // 3
    ];

    const result = validateNewRun(cards);
    expect(result.valid).toBe(false);
  });

  it('rejects adding cards to an already complete 13-card pure run (2 through A)', () => {
    // Create a 13-card pure run (2 to 14 in Spades)
    const runCards: Card[] = [];
    for (let r = 2; r <= 14; r++) {
      runCards.push(makeCard(`s${r}`, 'SPADES', r));
    }

    const pure13Meld: Meld = {
      id: 'meld-pure-13',
      team: 'A',
      type: 'RUN',
      suit: 'SPADES',
      cards: runCards,
      slots: runCards.map((c) => ({
        card: c,
        representedRank: c.rank,
        representedSuit: 'SPADES',
        isWildcard: false,
      })),
    };

    // Attempt to add a 14th card (e.g. another card)
    const extraCard = makeCard('extra', 'SPADES', 5);
    const result = canAddCardsToMeld(pure13Meld, [extraCard]);
    expect(result.valid).toBe(false);
  });

  it('rejects adding a second wildcard to an already dirty run meld', () => {
    // Existing dirty run: 4♠, Joker (as 5), 6♠
    const existingMeld: Meld = {
      id: 'meld-dirty',
      team: 'A',
      type: 'RUN',
      suit: 'SPADES',
      cards: [
        makeCard('s4', 'SPADES', 4),
        makeCard('j1', null, 0, true),
        makeCard('s6', 'SPADES', 6),
      ],
      slots: [
        { card: makeCard('s4', 'SPADES', 4), representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
        { card: makeCard('j1', null, 0, true), representedRank: 5, representedSuit: 'SPADES', isWildcard: true },
        { card: makeCard('s6', 'SPADES', 6), representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
      ],
    };

    // Attempt to add another wildcard (e.g. 2 of Hearts)
    const secondWildcard = makeCard('h2', 'HEARTS', 2);
    const result = canAddCardsToMeld(existingMeld, [secondWildcard]);
    expect(result.valid).toBe(false);
  });

  it('correctly scores a 13-card Pure Run as 500 points', () => {
    const runCards: Card[] = [];
    for (let r = 2; r <= 14; r++) {
      runCards.push(makeCard(`s${r}`, 'SPADES', r));
    }

    const pure13Meld: Meld = {
      id: 'meld-pure-13',
      team: 'A',
      type: 'RUN',
      suit: 'SPADES',
      cards: runCards,
      slots: runCards.map((c) => ({
        card: c,
        representedRank: c.rank,
        representedSuit: 'SPADES',
        isWildcard: false,
      })),
    };

    const evaluation = evaluateMeldScore(pure13Meld);
    expect(evaluation.points).toBe(500);
    expect(evaluation.isPure13).toBe(true);
    expect(evaluation.isComplete7).toBe(true);
    expect(evaluation.description).toMatch(/pure/i);
  });

  it('scores a 13-card run with a wildcard as a dirty run (100 points, not 500)', () => {
    const runCards: Card[] = [];
    for (let r = 2; r <= 14; r++) {
      if (r === 7) {
        // Substitute 7 with Natural Joker
        runCards.push(makeCard('j1', null, 0, true));
      } else {
        runCards.push(makeCard(`s${r}`, 'SPADES', r));
      }
    }

    const dirty13Meld: Meld = {
      id: 'meld-dirty-13',
      team: 'A',
      type: 'RUN',
      suit: 'SPADES',
      cards: runCards,
      slots: runCards.map((c, idx) => ({
        card: c,
        representedRank: idx + 2,
        representedSuit: 'SPADES',
        isWildcard: c.isNaturalJoker || false,
      })),
    };

    const evaluation = evaluateMeldScore(dirty13Meld);
    expect(evaluation.points).toBe(100);
    expect(evaluation.isPure13).toBe(false);
    expect(evaluation.isComplete7).toBe(true);
  });

  it('rejects candidate set containing multiple wildcards', () => {
    const cards = [
      makeCard('c1', 'SPADES', 8),
      makeCard('j1', null, 0, true),
      makeCard('j2', null, 0, true),
    ];

    const result = validateNewSet(cards);
    expect(result.valid).toBe(false);
  });
});
