import { describe, it, expect } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';
import { Card } from '../../src/engine/types';
import { sanitizeStateForPlayer } from '../../src/engine/sanitizer';

function makeCard(id: string, suit: 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS', rank: any): Card {
  return { id, suit, rank };
}

describe('Rule: Discard restriction on picked up cards', () => {
  it('rejects discarding the drawn card if player picked up only 1 card from stock and had >1 cards in hand', () => {
    const initialState = dealInitialState(4);
    const topStockCard = initialState.stockDeck[0];

    // Player 1 draws 1 card from stock
    const drawResult = pukarReducer(initialState, { type: 'DRAW_FROM_STOCK' });
    expect(drawResult.error).toBeUndefined();
    expect(drawResult.state.phase).toBe('MELD');

    // Attempt to discard the card just drawn
    const discardResult = pukarReducer(drawResult.state, {
      type: 'DISCARD_CARD',
      cardId: topStockCard.id,
    });

    expect(discardResult.error).toBe(
      'Cannot discard the single card picked up this turn unless you started with only 1 card in hand'
    );
    // State remains in active player's turn
    expect(discardResult.state.currentPlayerIndex).toBe(0);
    expect(discardResult.state.phase).toBe('MELD');

    // But discarding another card from original hand succeeds
    const otherCard = drawResult.state.players[0].hand.find((c) => c.id !== topStockCard.id)!;
    const validDiscard = pukarReducer(drawResult.state, {
      type: 'DISCARD_CARD',
      cardId: otherCard.id,
    });
    expect(validDiscard.error).toBeUndefined();
    expect(validDiscard.state.currentPlayerIndex).toBe(1);
    expect(validDiscard.state.phase).toBe('DRAW');
  });

  it('rejects discarding the picked up card if player took 1 card from discard pile and had >1 cards in hand', () => {
    let state = dealInitialState(4);
    const soloDiscard = makeCard('solo-disc-1', 'HEARTS', 8);
    state.discardPile = [soloDiscard];

    // Player 1 takes the 1-card discard pile
    const takeResult = pukarReducer(state, { type: 'TAKE_DISCARD' });
    expect(takeResult.error).toBeUndefined();

    // Attempt to discard the exact card just picked up
    const discardResult = pukarReducer(takeResult.state, {
      type: 'DISCARD_CARD',
      cardId: soloDiscard.id,
    });

    expect(discardResult.error).toBe(
      'Cannot discard the single card picked up this turn unless you started with only 1 card in hand'
    );
  });

  it('allows discarding either card when player picks up 2 cards from discard pile', () => {
    let state = dealInitialState(4);
    const disc1 = makeCard('disc-1', 'HEARTS', 8);
    const disc2 = makeCard('disc-2', 'SPADES', 9);
    state.discardPile = [disc1, disc2];

    const takeResult = pukarReducer(state, { type: 'TAKE_DISCARD' });
    expect(takeResult.error).toBeUndefined();

    // Player can discard disc1
    const discardResult1 = pukarReducer(takeResult.state, {
      type: 'DISCARD_CARD',
      cardId: disc1.id,
    });
    expect(discardResult1.error).toBeUndefined();
    expect(discardResult1.state.currentPlayerIndex).toBe(1);

    // Or player can discard disc2
    const discardResult2 = pukarReducer(takeResult.state, {
      type: 'DISCARD_CARD',
      cardId: disc2.id,
    });
    expect(discardResult2.error).toBeUndefined();
    expect(discardResult2.state.currentPlayerIndex).toBe(1);
  });

  it('allows discarding any picked up card when player takes 3 or more cards from discard pile', () => {
    let state = dealInitialState(4);
    const disc1 = makeCard('disc-1', 'HEARTS', 8);
    const disc2 = makeCard('disc-2', 'SPADES', 9);
    const disc3 = makeCard('disc-3', 'CLUBS', 10);
    state.discardPile = [disc1, disc2, disc3];

    const takeResult = pukarReducer(state, { type: 'TAKE_DISCARD' });
    expect(takeResult.error).toBeUndefined();

    const discardResult = pukarReducer(takeResult.state, {
      type: 'DISCARD_CARD',
      cardId: disc2.id,
    });
    expect(discardResult.error).toBeUndefined();
    expect(discardResult.state.currentPlayerIndex).toBe(1);
  });

  it('EXCEPTION: allows picking up 1 card from stock and discarding it if player had only 1 card in hand', () => {
    let state = dealInitialState(4);
    const singleHandCard = makeCard('hand-solo', 'CLUBS', 3);
    state.players[0].hand = [singleHandCard];
    const topStockCard = state.stockDeck[0];

    // Player 1 starts turn with exactly 1 card in hand and draws 1 card
    const drawResult = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });
    expect(drawResult.error).toBeUndefined();
    expect(drawResult.state.players[0].hand).toHaveLength(2);

    // Player chooses to discard the card just drawn
    const discardResult = pukarReducer(drawResult.state, {
      type: 'DISCARD_CARD',
      cardId: topStockCard.id,
    });

    expect(discardResult.error).toBeUndefined();
    expect(discardResult.state.players[0].hand).toHaveLength(1);
    expect(discardResult.state.players[0].hand[0].id).toBe('hand-solo');
    expect(discardResult.state.currentPlayerIndex).toBe(1);
  });

  it('EXCEPTION: allows taking 1 card from discard pile and discarding it if player had only 1 card in hand', () => {
    let state = dealInitialState(4);
    const singleHandCard = makeCard('hand-solo', 'CLUBS', 3);
    const discCard = makeCard('disc-solo', 'DIAMONDS', 7);
    state.players[0].hand = [singleHandCard];
    state.discardPile = [discCard];

    // Player 1 starts with 1 card and takes the 1-card discard pile
    const takeResult = pukarReducer(state, { type: 'TAKE_DISCARD' });
    expect(takeResult.error).toBeUndefined();
    expect(takeResult.state.players[0].hand).toHaveLength(2);

    // Discarding the picked up card is allowed
    const discardResult = pukarReducer(takeResult.state, {
      type: 'DISCARD_CARD',
      cardId: discCard.id,
    });

    expect(discardResult.error).toBeUndefined();
    expect(discardResult.state.players[0].hand).toHaveLength(1);
    expect(discardResult.state.players[0].hand[0].id).toBe('hand-solo');
    expect(discardResult.state.currentPlayerIndex).toBe(1);
  });

  it('rejects discarding drawn card even if player melded cards down to fewer cards, as long as initial hand size was >1', () => {
    let state = dealInitialState(4);
    // Player starts with 4 cards (initial hand size > 1)
    const runCards = [
      makeCard('r1', 'SPADES', 3),
      makeCard('r2', 'SPADES', 4),
      makeCard('r3', 'SPADES', 5),
    ];
    const fillerCard = makeCard('filler', 'HEARTS', 10);
    state.players[0].hand = [...runCards, fillerCard];

    const topStock = state.stockDeck[0];
    const drawResult = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });
    expect(drawResult.error).toBeUndefined();

    // Player melds the run
    const meldResult = pukarReducer(drawResult.state, {
      type: 'PLAY_NEW_MELD',
      cardIds: ['r1', 'r2', 'r3'],
    });
    expect(meldResult.error).toBeUndefined();
    // Hand now has 2 cards: filler and topStock
    expect(meldResult.state.players[0].hand).toHaveLength(2);

    // Attempting to discard topStock is still rejected because initial hand size was 4 (> 1)
    const discardResult = pukarReducer(meldResult.state, {
      type: 'DISCARD_CARD',
      cardId: topStock.id,
    });

    expect(discardResult.error).toBe(
      'Cannot discard the single card picked up this turn unless you started with only 1 card in hand'
    );

    // Discarding filler succeeds
    const validDiscard = pukarReducer(meldResult.state, {
      type: 'DISCARD_CARD',
      cardId: fillerCard.id,
    });
    expect(validDiscard.error).toBeUndefined();
  });

  it('sanitizes cardsPickedUpThisTurn and initialHandSizeThisTurn for player perspective', () => {
    let state = dealInitialState(4);
    const drawResult = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });

    const activePlayerId = drawResult.state.players[0].id;
    const opponentPlayerId = drawResult.state.players[1].id;

    const sanitizedForActive = sanitizeStateForPlayer(drawResult.state, activePlayerId);
    expect(sanitizedForActive.cardsPickedUpThisTurn?.length).toBe(1);
    expect(sanitizedForActive.initialHandSizeThisTurn).toBe(13);

    const sanitizedForOpponent = sanitizeStateForPlayer(drawResult.state, opponentPlayerId);
    expect(sanitizedForOpponent.cardsPickedUpThisTurn).toEqual([]);
    expect(sanitizedForOpponent.initialHandSizeThisTurn).toBeUndefined();
  });
});
