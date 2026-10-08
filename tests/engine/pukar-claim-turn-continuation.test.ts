import { describe, it, expect } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';
import { Card } from '../../src/engine/types';

function makeCard(id: string, suit: Card['suit'], rank: Card['rank'], isNaturalJoker = false): Card {
  return {
    id,
    suit,
    rank,
    isNaturalJoker,
    isJoker: isNaturalJoker || rank === 2,
  };
}

describe('Pukar Claim - Turn Continuation & Drop to End Turn', () => {
  it('does NOT end turn when claiming a Pukar upon discard; player receives 13 cards and continues in MELD phase', () => {
    const state = dealInitialState(4);
    state.phase = 'MELD';
    state.currentPlayerIndex = 0;
    expect(state.pukarPool).toHaveLength(2);

    const soloCard = makeCard('solo-card', 'SPADES', 10);
    state.players[0].hand = [soloCard];

    // Discarding the last card claims the 13-card Pukar deck
    const result = pukarReducer(state, {
      type: 'DISCARD_CARD',
      cardId: soloCard.id,
    });

    expect(result.error).toBeUndefined();
    const next = result.state;

    // 1. Receives 13 cards from Pukar
    expect(next.players[0].hand).toHaveLength(13);
    expect(next.pukarPool).toHaveLength(1);
    expect(next.pukarsClaimed?.A).toBe(1);
    expect(next.scores.A).toBe(50);

    // 2. Turn DOES NOT END: remains Player 1's turn
    expect(next.currentPlayerIndex).toBe(0);

    // 3. Phase is MELD (no need to draw because the 13 cards count as their draw)
    expect(next.phase).toBe('MELD');
    expect(next.turnPhase).toBe('MELD');

    // 4. All 13 cards are marked as newly picked up
    expect(next.newlyPickedUpCardIds).toHaveLength(13);

    // 5. Card discarded is in the discard pile
    expect(next.discardPile[next.discardPile.length - 1].id).toBe('solo-card');
  });

  it('ends turn and advances to next player in DRAW phase only when player drops another card after claiming Pukar', () => {
    const state = dealInitialState(4);
    state.phase = 'MELD';
    state.currentPlayerIndex = 0;

    const soloCard = makeCard('solo-card', 'HEARTS', 8);
    state.players[0].hand = [soloCard];

    // Claim Pukar on discard
    const claimResult = pukarReducer(state, {
      type: 'DISCARD_CARD',
      cardId: soloCard.id,
    });
    expect(claimResult.state.currentPlayerIndex).toBe(0);
    expect(claimResult.state.phase).toBe('MELD');

    // Player now has 13 cards and drops 1 card to end turn
    const cardToDrop = claimResult.state.players[0].hand[0];
    const dropResult = pukarReducer(claimResult.state, {
      type: 'DISCARD_CARD',
      cardId: cardToDrop.id,
    });

    expect(dropResult.error).toBeUndefined();
    const finalState = dropResult.state;

    // Player 1 now has 12 cards
    expect(finalState.players[0].hand).toHaveLength(12);

    // Turn has now advanced to Player 2
    expect(finalState.currentPlayerIndex).toBe(1);
    expect(finalState.phase).toBe('DRAW');
  });

  it('allows player to meld cards from claimed Pukar and then drop a card to end turn', () => {
    const state = dealInitialState(4);
    state.phase = 'MELD';
    state.currentPlayerIndex = 0;

    const soloCard = makeCard('c1', 'CLUBS', 9);
    state.players[0].hand = [soloCard];

    // Claim Pukar on discard
    const claimResult = pukarReducer(state, {
      type: 'DISCARD_CARD',
      cardId: soloCard.id,
    });
    let current = claimResult.state;
    expect(current.currentPlayerIndex).toBe(0);
    expect(current.phase).toBe('MELD');

    // Give player a valid 3-card sequence in their claimed hand
    const s7 = makeCard('s7', 'SPADES', 7);
    const s8 = makeCard('s8', 'SPADES', 8);
    const s9 = makeCard('s9', 'SPADES', 9);
    const s10 = makeCard('s10', 'SPADES', 10);
    current.players[0].hand = [s7, s8, s9, s10];

    // Play a 3-card run
    const meldResult = pukarReducer(current, {
      type: 'PLAY_NEW_MELD',
      cardIds: ['s7', 's8', 's9'],
    });
    expect(meldResult.error).toBeUndefined();
    current = meldResult.state;

    // Sequence placed on table, hand has 1 card left
    expect(current.melds.A).toHaveLength(1);
    expect(current.players[0].hand).toHaveLength(1);
    expect(current.currentPlayerIndex).toBe(0);
    expect(current.phase).toBe('MELD');

    // Drop the remaining card to end turn
    const dropResult = pukarReducer(current, {
      type: 'DISCARD_CARD',
      cardId: 's10',
    });
    expect(dropResult.error).toBeUndefined();

    // With 1 Pukar remaining in pool, hand emptying on drop claims Pukar 2 and continues turn!
    expect(dropResult.state.pukarsClaimed?.A).toBe(2);
    expect(dropResult.state.scores.A).toBe(100);
    expect(dropResult.state.currentPlayerIndex).toBe(0);
    expect(dropResult.state.phase).toBe('MELD');
    expect(dropResult.state.players[0].hand).toHaveLength(13);
  });

  it('terminates round immediately and awards +50 pts (counted as Pukar claim with no cards) when hand empties on discard and 0 Pukars remain', () => {
    const state = dealInitialState(4);
    state.phase = 'MELD';
    state.pukarPool = [];
    if (state.pukars) state.pukars = [];
    state.currentPlayerIndex = 0;

    const lastCard = makeCard('last', 'DIAMONDS', 4);
    state.players[0].hand = [lastCard];

    const result = pukarReducer(state, {
      type: 'DISCARD_CARD',
      cardId: lastCard.id,
    });

    expect(result.error).toBeUndefined();
    expect(result.state.isRoundOver).toBe(true);
    expect(result.state.roundStatus).toBe('ROUND_OVER');
    expect(result.state.players[0].hand).toHaveLength(0); // No cards dealt since all Pukars ran out
    expect(result.state.pukarsClaimed?.A).toBe(1); // Counted as claiming a Pukar!
    expect(result.state.scores.A).toBe(50); // Gets 50 points!
    expect(result.state.roundScores?.A).toBe(50);
  });

  it('rejects melding all cards in hand during MELD phase and requires discarding last card to go out (+50 pts) when 0 Pukars remain', () => {
    const state = dealInitialState(4);
    state.phase = 'MELD';
    state.pukarPool = [];
    if (state.pukars) state.pukars = [];
    state.currentPlayerIndex = 0;

    const runCards = [
      makeCard('s4', 'SPADES', 4),
      makeCard('s5', 'SPADES', 5),
      makeCard('s6', 'SPADES', 6),
    ];
    const extraCard = makeCard('c8', 'CLUBS', 8);
    // Player has run cards only
    state.players[0].hand = [...runCards];

    // Attempting to meld all cards without leaving at least 1 card to discard MUST fail
    const invalidResult = pukarReducer(state, {
      type: 'PLAY_NEW_MELD',
      cardIds: runCards.map((c) => c.id),
    });
    expect(invalidResult.error).toBe(
      'Cannot meld all cards: you must keep at least 1 card in hand to discard to the pile'
    );

    // Give player the extra card so 1 card remains to discard
    state.players[0].hand = [...runCards, extraCard];
    const validMeldResult = pukarReducer(state, {
      type: 'PLAY_NEW_MELD',
      cardIds: runCards.map((c) => c.id),
    });
    expect(validMeldResult.error).toBeUndefined();
    expect(validMeldResult.state.players[0].hand).toHaveLength(1);

    // Now discard the final card to the discard pile to end the round!
    const discardResult = pukarReducer(validMeldResult.state, {
      type: 'DISCARD_CARD',
      cardId: extraCard.id,
    });
    expect(discardResult.error).toBeUndefined();
    expect(discardResult.state.isRoundOver).toBe(true);
    expect(discardResult.state.roundStatus).toBe('ROUND_OVER');
    expect(discardResult.state.players[0].hand).toHaveLength(0);
    expect(discardResult.state.pukarsClaimed?.A).toBe(1);
    expect(discardResult.state.scores.A).toBe(50);
  });

  it('does not prematurely end FINAL_TURN when player claims a Pukar on discard', () => {
    const state = dealInitialState(4);
    state.phase = 'MELD';
    state.roundStatus = 'FINAL_TURN';
    state.currentPlayerIndex = 0;
    state.finalTurnPlayerIndex = 0;

    const soloCard = makeCard('solo', 'SPADES', 3);
    state.players[0].hand = [soloCard];

    // Discarding claims Pukar
    const claimResult = pukarReducer(state, {
      type: 'DISCARD_CARD',
      cardId: soloCard.id,
    });

    expect(claimResult.error).toBeUndefined();
    // Round is NOT over yet because player's turn continues to play the Pukar!
    expect(claimResult.state.isRoundOver).toBeFalsy();
    expect(claimResult.state.roundStatus).toBe('FINAL_TURN');
    expect(claimResult.state.currentPlayerIndex).toBe(0);
    expect(claimResult.state.phase).toBe('MELD');

    // Dropping another card concludes the final turn
    const dropResult = pukarReducer(claimResult.state, {
      type: 'DISCARD_CARD',
      cardId: claimResult.state.players[0].hand[0].id,
    });
    expect(dropResult.state.isRoundOver).toBe(true);
    expect(dropResult.state.roundStatus).toBe('ROUND_OVER');
  });
});
