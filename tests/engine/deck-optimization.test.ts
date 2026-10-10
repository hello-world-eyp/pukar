import { describe, it, expect } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';
import { Card, GameState, isWildcard } from '../../src/engine/types';

describe('Stock Deck Card Ordering (OPTIMIZE_DECK_ORDER)', () => {
  it('moves a wildcard (Natural Joker or 2) to the top of stockDeck when available', () => {
    const state = dealInitialState(4);

    const nonWild1: Card = { id: 'c1', suit: 'SPADES', rank: 8 };
    const nonWild2: Card = { id: 'c2', suit: 'HEARTS', rank: 9 };
    const joker: Card = { id: 'joker-1', suit: null, rank: 0, isNaturalJoker: true, isJoker: true };
    const nonWild3: Card = { id: 'c3', suit: 'CLUBS', rank: 10 };

    const customState: GameState = {
      ...state,
      stockDeck: [nonWild1, nonWild2, joker, nonWild3],
    };

    expect(isWildcard(customState.stockDeck[0])).toBe(false);

    const result = pukarReducer(customState, { type: 'OPTIMIZE_DECK_ORDER' });

    expect(result.error).toBeUndefined();
    expect(result.state.stockDeck[0].id).toBe('joker-1');
    expect(isWildcard(result.state.stockDeck[0])).toBe(true);
    expect(result.state.stockDeck.length).toBe(4);
    expect(result.state.stockDeck.map((c) => c.id)).toContain('c1');
    expect(result.state.stockDeck.map((c) => c.id)).toContain('c2');
    expect(result.state.stockDeck.map((c) => c.id)).toContain('c3');
  });

  it('moves a rank 2 card to the top if no Natural Joker exists in the deck', () => {
    const state = dealInitialState(4);

    const nonWild1: Card = { id: 'c1', suit: 'SPADES', rank: 5 };
    const twoCard: Card = { id: 'c-two', suit: 'DIAMONDS', rank: 2 };
    const nonWild2: Card = { id: 'c2', suit: 'HEARTS', rank: 7 };

    const customState: GameState = {
      ...state,
      stockDeck: [nonWild1, twoCard, nonWild2],
    };

    const result = pukarReducer(customState, { type: 'OPTIMIZE_DECK_ORDER' });

    expect(result.error).toBeUndefined();
    expect(result.state.stockDeck[0].id).toBe('c-two');
    expect(result.state.stockDeck[0].rank).toBe(2);
    expect(result.state.stockDeck.length).toBe(3);
  });

  it('prioritizes Natural Joker over 2 if both exist deeper in the deck', () => {
    const state = dealInitialState(4);

    const nonWild: Card = { id: 'c1', suit: 'SPADES', rank: 5 };
    const twoCard: Card = { id: 'c-two', suit: 'DIAMONDS', rank: 2 };
    const joker: Card = { id: 'joker-1', suit: null, rank: 0, isNaturalJoker: true };

    const customState: GameState = {
      ...state,
      stockDeck: [nonWild, twoCard, joker],
    };

    const result = pukarReducer(customState, { type: 'OPTIMIZE_DECK_ORDER' });

    expect(result.error).toBeUndefined();
    expect(result.state.stockDeck[0].id).toBe('joker-1');
  });

  it('does nothing if top card is already a wildcard', () => {
    const state = dealInitialState(4);

    const jokerTop: Card = { id: 'joker-top', suit: null, rank: 0, isNaturalJoker: true };
    const nonWild: Card = { id: 'c1', suit: 'SPADES', rank: 5 };

    const customState: GameState = {
      ...state,
      stockDeck: [jokerTop, nonWild],
    };

    const result = pukarReducer(customState, { type: 'OPTIMIZE_DECK_ORDER' });

    expect(result.error).toBeUndefined();
    expect(result.state.stockDeck[0].id).toBe('joker-top');
    expect(result.state.stockDeck[1].id).toBe('c1');
  });

  it('does nothing and does not touch pukarPool if stockDeck has no wildcards', () => {
    const state = dealInitialState(4);

    const nonWild1: Card = { id: 'c1', suit: 'SPADES', rank: 5 };
    const nonWild2: Card = { id: 'c2', suit: 'HEARTS', rank: 9 };
    const originalPukarPool = state.pukarPool;

    const customState: GameState = {
      ...state,
      stockDeck: [nonWild1, nonWild2],
    };

    const result = pukarReducer(customState, { type: 'OPTIMIZE_DECK_ORDER' });

    expect(result.error).toBeUndefined();
    expect(result.state.stockDeck[0].id).toBe('c1');
    expect(result.state.stockDeck[1].id).toBe('c2');
    expect(result.state.pukarPool).toBe(originalPukarPool);
  });
});
