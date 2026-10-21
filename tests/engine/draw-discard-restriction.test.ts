import { describe, it, expect } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';
import { Card } from '../../src/engine/types';
import { sanitizeStateForPlayer } from '../../src/engine/sanitizer';

function makeCard(id: string, suit: 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS', rank: any): Card {
  return { id, suit, rank };
}

describe('Rule: Discard restriction on picked up cards', () => {
  it('allows discarding the card drawn from the stock deck on the same turn', () => {
    const initialState = dealInitialState(4);
    const topStockCard = initialState.stockDeck[0];

    // Player 1 draws 1 card from stock
    const drawResult = pukarReducer(initialState, { type: 'DRAW_FROM_STOCK' });
    expect(drawResult.error).toBeUndefined();
    expect(drawResult.state.phase).toBe('MELD');

    // Drawing from the stock deck allows discarding the card just drawn
    const discardResult = pukarReducer(drawResult.state, {
      type: 'DISCARD_CARD',
      cardId: topStockCard.id,
    });

    expect(discardResult.error).toBeUndefined();
    // Turn successfully advances to next player
    expect(discardResult.state.currentPlayerIndex).toBe(1);
    expect(discardResult.state.phase).toBe('DRAW');
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
      'Cannot discard the single card picked up this turn unless you started with only 1 card in hand or are finishing for Pukar'
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

  it('rejects discarding 1 card picked up from discard pile even if player melded cards down to fewer cards, as long as initial hand size was >1', () => {
    let state = dealInitialState(4);
    // Player starts with 4 cards (initial hand size > 1)
    const runCards = [
      makeCard('r1', 'SPADES', 3),
      makeCard('r2', 'SPADES', 4),
      makeCard('r3', 'SPADES', 5),
    ];
    const fillerCard = makeCard('filler', 'HEARTS', 10);
    state.players[0].hand = [...runCards, fillerCard];

    const soloDiscard = makeCard('disc-solo-meld', 'DIAMONDS', 9);
    state.discardPile = [soloDiscard];
    const takeResult = pukarReducer(state, { type: 'TAKE_DISCARD' });
    expect(takeResult.error).toBeUndefined();

    // Player melds the run
    const meldResult = pukarReducer(takeResult.state, {
      type: 'PLAY_NEW_MELD',
      cardIds: ['r1', 'r2', 'r3'],
    });
    expect(meldResult.error).toBeUndefined();
    // Hand now has 2 cards: filler and soloDiscard
    expect(meldResult.state.players[0].hand).toHaveLength(2);

    // Attempting to discard soloDiscard is rejected because initial hand size was 4 (> 1)
    const discardResult = pukarReducer(meldResult.state, {
      type: 'DISCARD_CARD',
      cardId: soloDiscard.id,
    });

    expect(discardResult.error).toBe(
      'Cannot discard the single card picked up this turn unless you started with only 1 card in hand or are finishing for Pukar'
    );

    // Discarding filler succeeds
    const validDiscard = pukarReducer(meldResult.state, {
      type: 'DISCARD_CARD',
      cardId: fillerCard.id,
    });
    expect(validDiscard.error).toBeUndefined();
  });

  it('ALLOWS discarding the single card picked up if player melded all other cards and is finishing for Pukar', () => {
    let state = dealInitialState(4);
    // Player starts with 2 cards (initial hand size was 2 > 1)
    const meldCards = [
      makeCard('r1', 'SPADES', 3),
      makeCard('r2', 'SPADES', 4),
    ];
    state.melds.A = [
      {
        id: 'meld-A-1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [makeCard('s5', 'SPADES', 5), makeCard('s6', 'SPADES', 6), makeCard('s7', 'SPADES', 7)],
        slots: [
          { card: makeCard('s5', 'SPADES', 5), representedRank: 5, representedSuit: 'SPADES', isWildcard: false },
          { card: makeCard('s6', 'SPADES', 6), representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
          { card: makeCard('s7', 'SPADES', 7), representedRank: 7, representedSuit: 'SPADES', isWildcard: false },
        ],
        isClean: false,
        isPure: true,
        isPure13: false,
        points: 0,
      },
    ];
    state.players[0].hand = [...meldCards];

    // Discard pile has 1 card
    const soloDiscard = makeCard('disc-solo-pukar', 'HEARTS', 13);
    state.discardPile = [soloDiscard];

    // Pick up 1 card from discard (initial hand size was 2)
    const takeResult = pukarReducer(state, { type: 'TAKE_DISCARD' });
    expect(takeResult.error).toBeUndefined();
    expect(takeResult.state.players[0].hand).toHaveLength(3);

    // Player melds r1 and r2 onto table meld
    const addResult = pukarReducer(takeResult.state, {
      type: 'ADD_TO_MELD',
      meldId: 'meld-A-1',
      cardIds: ['r1', 'r2'],
    });
    expect(addResult.error).toBeUndefined();
    // Hand now has exactly 1 card: soloDiscard
    expect(addResult.state.players[0].hand).toHaveLength(1);
    expect(addResult.state.players[0].hand[0].id).toBe('disc-solo-pukar');

    // Player discards soloDiscard to finish for Pukar (remainingHand becomes 0)
    const discardResult = pukarReducer(addResult.state, {
      type: 'DISCARD_CARD',
      cardId: soloDiscard.id,
    });

    expect(discardResult.error).toBeUndefined();
    // Hand emptied, Pukar claimed (+50 pts)
    expect(discardResult.state.pukarsClaimed?.A).toBe(1);
  });

  it('sanitizes cardsPickedUpThisTurn and initialHandSizeThisTurn for player perspective', () => {
    let state = dealInitialState(4);
    const soloDiscard = makeCard('disc-solo-san', 'CLUBS', 6);
    state.discardPile = [soloDiscard];
    const takeResult = pukarReducer(state, { type: 'TAKE_DISCARD' });

    const activePlayerId = takeResult.state.players[0].id;
    const opponentPlayerId = takeResult.state.players[1].id;

    const sanitizedForActive = sanitizeStateForPlayer(takeResult.state, activePlayerId);
    expect(sanitizedForActive.cardsPickedUpThisTurn?.length).toBe(1);
    expect(sanitizedForActive.initialHandSizeThisTurn).toBe(13);

    const sanitizedForOpponent = sanitizeStateForPlayer(takeResult.state, opponentPlayerId);
    expect(sanitizedForOpponent.cardsPickedUpThisTurn).toEqual([]);
    expect(sanitizedForOpponent.initialHandSizeThisTurn).toBeUndefined();
  });
});
