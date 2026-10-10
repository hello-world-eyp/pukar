import { describe, it, expect, vi } from 'vitest';
import { sanitizeStateForPlayer } from '../../src/engine/sanitizer';
import { GameState, Card, Meld } from '../../src/engine/types';
import { dealInitialState } from '../../src/engine/deck';

function makeCard(id: string, suit: Card['suit'], rank: Card['rank']): Card {
  return {
    id,
    suit,
    rank,
    isNaturalJoker: rank === 0,
    isJoker: rank === 0 || rank === 2,
  };
}

describe('GameState Sanitizer - Comprehensive Audit & Edge Cases', () => {
  it('masks opponent hands while preserving active viewer hand and card counts', () => {
    const state = dealInitialState(4);
    const viewerId = state.players[0].id;
    const opponentId = state.players[1].id;

    const sanitized = sanitizeStateForPlayer(state, viewerId);

    // Player 0 (viewer) hand is visible and cloned
    const p0 = sanitized.players.find((p) => p.id === viewerId);
    expect(p0?.hand).toBeDefined();
    expect(p0?.hand?.length).toBe(state.players[0].hand.length);
    expect(p0?.cardCount).toBe(state.players[0].hand.length);

    // Player 1 (opponent) hand is masked (undefined) but cardCount is accurate
    const p1 = sanitized.players.find((p) => p.id === opponentId);
    expect(p1?.hand).toBeUndefined();
    expect(p1?.cardCount).toBe(state.players[1].hand.length);
  });

  it('masks newlyPickedUpCardIds when viewer is not the active player', () => {
    const state = dealInitialState(4);
    state.currentPlayerIndex = 1; // Player 2 is active
    state.newlyPickedUpCardIds = ['card-secret-1', 'card-secret-2'];

    // Viewer is Player 1 (index 0, inactive)
    const sanitizedInactive = sanitizeStateForPlayer(state, state.players[0].id);
    expect(sanitizedInactive.newlyPickedUpCardIds).toEqual([]);

    // Viewer is Player 2 (index 1, active)
    const sanitizedActive = sanitizeStateForPlayer(state, state.players[1].id);
    expect(sanitizedActive.newlyPickedUpCardIds).toEqual(['card-secret-1', 'card-secret-2']);
  });

  it('deep clones team melds and card slots for both Team A and Team B', () => {
    const state = dealInitialState(4);
    const cardA1 = makeCard('a1', 'SPADES', 3);
    const cardA2 = makeCard('a2', 'SPADES', 4);
    const cardA3 = makeCard('a3', 'SPADES', 5);

    const meldA: Meld = {
      id: 'meld-A-1',
      team: 'A',
      type: 'RUN',
      suit: 'SPADES',
      cards: [cardA1, cardA2, cardA3],
      slots: [
        { card: cardA1, representedRank: 3, representedSuit: 'SPADES', isWildcard: false },
        { card: cardA2, representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
        { card: cardA3, representedRank: 5, representedSuit: 'SPADES', isWildcard: false },
      ],
    };

    const cardB1 = makeCard('b1', 'HEARTS', 8);
    const cardB2 = makeCard('b2', 'HEARTS', 9);
    const cardB3 = makeCard('b3', 'HEARTS', 10);

    const meldB: Meld = {
      id: 'meld-B-1',
      team: 'B',
      type: 'RUN',
      suit: 'HEARTS',
      cards: [cardB1, cardB2, cardB3],
      slots: [
        { card: cardB1, representedRank: 8, representedSuit: 'HEARTS', isWildcard: false },
        { card: cardB2, representedRank: 9, representedSuit: 'HEARTS', isWildcard: false },
        { card: cardB3, representedRank: 10, representedSuit: 'HEARTS', isWildcard: false },
      ],
    };

    state.melds.A = [meldA];
    state.melds.B = [meldB];

    const sanitized = sanitizeStateForPlayer(state, state.players[0].id);

    expect(sanitized.melds.A.length).toBe(1);
    expect(sanitized.melds.B.length).toBe(1);
    expect(sanitized.melds.A[0].cards.length).toBe(3);
    expect(sanitized.melds.B[0].slots?.length).toBe(3);

    // Verify deep clone mutation safety
    sanitized.melds.A[0].cards[0].rank = 99 as any;
    expect(state.melds.A[0].cards[0].rank).toBe(3);
  });

  it('safely handles nullish or partial state properties', () => {
    const minimalState = {
      playerCount: 4,
      currentPlayerIndex: 0,
      phase: 'MELD',
    } as unknown as GameState;

    const sanitized = sanitizeStateForPlayer(minimalState, 'p1');

    expect(sanitized.playerCount).toBe(4);
    expect(sanitized.players).toEqual([]);
    expect(sanitized.stockDeckCount).toBe(0);
    expect(sanitized.discardPile).toEqual([]);
    expect(sanitized.pukarPoolCount).toBe(0);
    expect(sanitized.melds).toEqual({ A: [], B: [] });
    expect(sanitized.scores).toEqual({ A: 0, B: 0 });
    expect(sanitized.newlyPickedUpCardIds).toEqual([]);
  });

  it('handles lastPickedUpCard and score clones', () => {
    const state = dealInitialState(4);
    state.lastPickedUpCard = makeCard('pick-1', 'CLUBS', 2);
    state.scores = { A: 150, B: 200 };
    state.roundScores = { A: 50, B: 100 };
    state.totalScores = { A: 200, B: 300 };
    state.pukarsClaimed = { A: 1, B: 2 };

    const sanitized = sanitizeStateForPlayer(state, state.players[0].id);

    expect(sanitized.lastPickedUpCard?.id).toBe('pick-1');
    expect(sanitized.scores).toEqual({ A: 150, B: 200 });
    expect(sanitized.roundScores).toEqual({ A: 50, B: 100 });
    expect(sanitized.totalScores).toEqual({ A: 200, B: 300 });
    expect(sanitized.pukarsClaimed).toEqual({ A: 1, B: 2 });
  });

  it('catches unexpected exceptions and returns safe fallback state', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create a throwing object (getter that throws)
    const maliciousState = {
      get players(): any {
        throw new Error('Exploding getter');
      },
      playerCount: 6,
      currentPlayerIndex: 2,
      phase: 'DRAW',
    } as unknown as GameState;

    const fallback = sanitizeStateForPlayer(maliciousState, 'p1');

    expect(fallback).toBeDefined();
    expect(fallback.playerCount).toBe(6);
    expect(fallback.players).toEqual([]);
    expect(fallback.stockDeckCount).toBe(0);
    expect(fallback.discardPile).toEqual([]);
    expect(fallback.melds).toEqual({ A: [], B: [] });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
