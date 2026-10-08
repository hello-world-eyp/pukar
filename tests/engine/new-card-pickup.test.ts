import { describe, it, expect } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';
import { sanitizeStateForPlayer } from '../../src/engine/sanitizer';
import { Card, GameState, Meld } from '../../src/engine/types';

describe('New Card Pickup Engine State & Lifecycle', () => {
  it('dealInitialState initializes newlyPickedUpCardIds as empty array', () => {
    const initialState = dealInitialState(4);
    expect(initialState.newlyPickedUpCardIds).toEqual([]);
  });

  it('sets newlyPickedUpCardIds to drawn card when DRAW_FROM_STOCK is executed', () => {
    const initialState = dealInitialState(4);
    const topStockCard = initialState.stockDeck[0];

    const result = pukarReducer(initialState, { type: 'DRAW_FROM_STOCK' });
    expect(result.error).toBeUndefined();
    expect(result.state.newlyPickedUpCardIds).toEqual([topStockCard.id]);
    expect(result.state.phase).toBe('MELD');
  });

  it('sets newlyPickedUpCardIds to all taken cards when TAKE_DISCARD is executed', () => {
    const initialState = dealInitialState(4);
    const discardCards: Card[] = [
      { id: 'disc-1', suit: 'HEARTS', rank: 5, isJoker: false, isNaturalJoker: false },
      { id: 'disc-2', suit: 'SPADES', rank: 9, isJoker: false, isNaturalJoker: false },
    ];
    const stateWithDiscard: GameState = {
      ...initialState,
      discardPile: discardCards,
    };

    const result = pukarReducer(stateWithDiscard, { type: 'TAKE_DISCARD' });
    expect(result.error).toBeUndefined();
    expect(result.state.newlyPickedUpCardIds).toEqual(['disc-1', 'disc-2']);
    expect(result.state.phase).toBe('MELD');
  });

  it('clears newlyPickedUpCardIds upon DISCARD_CARD passing to the next player', () => {
    const initialState = dealInitialState(4);
    const drawResult = pukarReducer(initialState, { type: 'DRAW_FROM_STOCK' });
    expect(drawResult.state.newlyPickedUpCardIds?.length).toBe(1);

    const activePlayerHand = drawResult.state.players[drawResult.state.currentPlayerIndex].hand;
    const discardCard = activePlayerHand[0];

    const discardResult = pukarReducer(drawResult.state, {
      type: 'DISCARD_CARD',
      cardId: discardCard.id,
    });

    expect(discardResult.error).toBeUndefined();
    expect(discardResult.state.newlyPickedUpCardIds).toEqual([]);
    expect(discardResult.state.currentPlayerIndex).toBe(1);
    expect(discardResult.state.phase).toBe('DRAW');
  });

  it('includes auto-picked up Joker in newlyPickedUpCardIds when Joker is replaced in meld', () => {
    const initialState = dealInitialState(4);
    const jokerCard: Card = {
      id: 'natural-joker-1',
      suit: null,
      rank: 0,
      isJoker: true,
      isNaturalJoker: true,
    };
    const existingMeld: Meld = {
      id: 'meld-A-1',
      team: 'A',
      type: 'RUN',
      suit: 'HEARTS',
      cards: [
        { id: 'h7', suit: 'HEARTS', rank: 7, isJoker: false, isNaturalJoker: false },
        jokerCard,
        { id: 'h9', suit: 'HEARTS', rank: 9, isJoker: false, isNaturalJoker: false },
      ],
      slots: [
        { card: { id: 'h7', suit: 'HEARTS', rank: 7 }, representedRank: 7, representedSuit: 'HEARTS', isWildcard: false },
        { card: jokerCard, representedRank: 8, representedSuit: 'HEARTS', isWildcard: true },
        { card: { id: 'h9', suit: 'HEARTS', rank: 9 }, representedRank: 9, representedSuit: 'HEARTS', isWildcard: false },
      ],
    };

    const natural8: Card = {
      id: 'h8',
      suit: 'HEARTS',
      rank: 8,
      isJoker: false,
      isNaturalJoker: false,
    };

    const activeIndex = 0; // Team A
    const stateWithMeld: GameState = {
      ...initialState,
      currentPlayerIndex: activeIndex,
      phase: 'MELD',
      melds: {
        A: [existingMeld],
        B: [],
      },
      players: initialState.players.map((p, idx) =>
        idx === activeIndex ? { ...p, hand: [natural8] } : p
      ),
      newlyPickedUpCardIds: [],
    };

    const result = pukarReducer(stateWithMeld, {
      type: 'ADD_TO_MELD',
      meldId: 'meld-A-1',
      cardIds: ['h8'],
    });

    expect(result.error).toBeUndefined();
    // Joker picked up into hand
    expect(result.state.lastPickedUpCard?.id).toBe('natural-joker-1');
    // Joker ID should be present in newlyPickedUpCardIds
    expect(result.state.newlyPickedUpCardIds).toContain('natural-joker-1');
  });

  it('sanitizes newlyPickedUpCardIds: active player sees them, other viewers get empty array', () => {
    const initialState = dealInitialState(4);
    const drawResult = pukarReducer(initialState, { type: 'DRAW_FROM_STOCK' });
    const activePlayerId = drawResult.state.players[drawResult.state.currentPlayerIndex].id;
    const opponentId = drawResult.state.players[(drawResult.state.currentPlayerIndex + 1) % 4].id;

    const sanitizedForActive = sanitizeStateForPlayer(drawResult.state, activePlayerId);
    expect(sanitizedForActive.newlyPickedUpCardIds?.length).toBe(1);

    const sanitizedForOpponent = sanitizeStateForPlayer(drawResult.state, opponentId);
    expect(sanitizedForOpponent.newlyPickedUpCardIds).toEqual([]);
  });
});
