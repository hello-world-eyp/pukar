import { describe, it, expect } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';
import { Card, Rank } from '../../src/engine/types';

describe('Uncle Pukar Deck Selection (Engine Reducer)', () => {
  function makeCard(id: string, suit: 'SPADES' | 'HEARTS', rank: Rank): Card {
    return { id, suit, rank };
  }

  it('keeps default deck 0 when SELECT_PUKAR_DECK has deckIndex 0', () => {
    const state = dealInitialState(4);
    const originalHand = [...state.players[0].hand];

    const result = pukarReducer(state, {
      type: 'SELECT_PUKAR_DECK',
      deckIndex: 0,
    });

    expect(result.error).toBeUndefined();
    expect(result.state.players[0].hand).toEqual(originalHand);
    expect(result.state.pukarPool).toEqual(state.pukarPool);
  });

  it('swaps active player hand with Deck 2 when deckIndex is 1 and 2 pukars were available', () => {
    const state = dealInitialState(4);
    expect(state.pukarPool).toHaveLength(2);

    // Give player a 1-card hand and simulate discard that claims Pukar deck 1
    const soloCard = makeCard('c-solo', 'SPADES', 10);
    state.players[0].hand = [soloCard];
    state.phase = 'MELD';
    state.turnPhase = 'MELD';

    // Discard to claim first Pukar
    const claimResult = pukarReducer(state, {
      type: 'DISCARD_CARD',
      cardId: soloCard.id,
    });

    expect(claimResult.error).toBeUndefined();
    const midState = claimResult.state;

    // Player 1 now has 13 cards (Deck 1) and 1 deck remains in pukarPool (Deck 2)
    const deck1Cards = [...midState.players[0].hand];
    const deck2Cards = [...midState.pukarPool[0]];
    expect(deck1Cards).toHaveLength(13);
    expect(deck2Cards).toHaveLength(13);
    expect(midState.pukarPool).toHaveLength(1);

    // Player selects Deck 2 (index 1)
    const chooseResult = pukarReducer(midState, {
      type: 'SELECT_PUKAR_DECK',
      deckIndex: 1,
    });

    expect(chooseResult.error).toBeUndefined();
    const finalState = chooseResult.state;

    // Player now holds Deck 2's cards!
    expect(finalState.players[0].hand.map((c) => c.id)).toEqual(deck2Cards.map((c) => c.id));

    // And Deck 1 is now stored in pukarPool[0]!
    expect(finalState.pukarPool[0].map((c) => c.id)).toEqual(deck1Cards.map((c) => c.id));
    expect(finalState.pukarPool).toHaveLength(1);

    // Newly picked up card IDs match Deck 2
    expect(finalState.newlyPickedUpCardIds).toEqual(deck2Cards.map((c) => c.id));
  });

  it('rejects invalid deckIndex or non-existent deck', () => {
    const state = dealInitialState(4);

    const negResult = pukarReducer(state, {
      type: 'SELECT_PUKAR_DECK',
      deckIndex: -1,
    });
    expect(negResult.error).toContain('Invalid Pukar deck index');

    const outOfBoundsResult = pukarReducer(state, {
      type: 'SELECT_PUKAR_DECK',
      deckIndex: 99,
    });
    expect(outOfBoundsResult.error).toContain('not available in the Pukar pool');
  });

  it('rejects SELECT_PUKAR_DECK when round or game is over', () => {
    const state = dealInitialState(4);
    state.roundStatus = 'GAME_OVER';

    const result = pukarReducer(state, {
      type: 'SELECT_PUKAR_DECK',
      deckIndex: 1,
    });
    expect(result.error).toContain('Cannot select Pukar deck: round is already over');
  });
});
