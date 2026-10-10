import { describe, it, expect } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';
import { Card, GameAction, GameState, Meld } from '../../src/engine/types';

function makeCard(id: string, suit: Card['suit'], rank: Card['rank']): Card {
  return {
    id,
    suit,
    rank,
    isNaturalJoker: rank === 0,
    isJoker: rank === 0 || rank === 2,
  };
}

describe('Engine Reducer Edge Cases & Validation Boundaries', () => {
  it('rejects ADD_TO_MELD if adding cards would leave 0 cards in hand (must keep at least 1 card to discard)', () => {
    const initialState = dealInitialState(4);
    // Setup state in MELD phase with an existing meld for Team A
    const existingMeld: Meld = {
      id: 'meld-1',
      team: 'A',
      type: 'RUN',
      suit: 'SPADES',
      cards: [
        makeCard('s3', 'SPADES', 3),
        makeCard('s4', 'SPADES', 4),
        makeCard('s5', 'SPADES', 5),
      ],
      slots: [
        { card: makeCard('s3', 'SPADES', 3), representedRank: 3, representedSuit: 'SPADES', isWildcard: false },
        { card: makeCard('s4', 'SPADES', 4), representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
        { card: makeCard('s5', 'SPADES', 5), representedRank: 5, representedSuit: 'SPADES', isWildcard: false },
      ],
    };

    // Active player (index 0, Team A) has ONLY 1 card: 6 of Spades
    const state: GameState = {
      ...initialState,
      phase: 'MELD',
      currentPlayerIndex: 0,
      melds: { A: [existingMeld], B: [] },
      players: initialState.players.map((p, idx) =>
        idx === 0 ? { ...p, hand: [makeCard('s6', 'SPADES', 6)] } : p
      ),
    };

    const action: GameAction = {
      type: 'ADD_TO_MELD',
      meldId: 'meld-1',
      cardIds: ['s6'],
    };

    const result = pukarReducer(state, action);
    expect(result.error).toMatch(/must keep at least 1 card in hand to discard/i);
    expect(result.state).toBe(state);
  });

  it('rejects ADD_TO_MELD if target meld does not exist on table', () => {
    const state = dealInitialState(4);
    const meldState: GameState = { ...state, phase: 'MELD' };
    const action: GameAction = {
      type: 'ADD_TO_MELD',
      meldId: 'nonexistent-meld-id',
      cardIds: [meldState.players[0].hand[0].id],
    };

    const result = pukarReducer(meldState, action);
    expect(result.error).toMatch(/Meld nonexistent-meld-id not found/i);
  });

  it('rejects ADD_TO_MELD if card IDs are not present in active player hand', () => {
    const initialState = dealInitialState(4);
    const existingMeld: Meld = {
      id: 'meld-1',
      team: 'A',
      type: 'RUN',
      suit: 'SPADES',
      cards: [
        makeCard('s3', 'SPADES', 3),
        makeCard('s4', 'SPADES', 4),
        makeCard('s5', 'SPADES', 5),
      ],
      slots: [
        { card: makeCard('s3', 'SPADES', 3), representedRank: 3, representedSuit: 'SPADES', isWildcard: false },
        { card: makeCard('s4', 'SPADES', 4), representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
        { card: makeCard('s5', 'SPADES', 5), representedRank: 5, representedSuit: 'SPADES', isWildcard: false },
      ],
    };

    const state: GameState = {
      ...initialState,
      phase: 'MELD',
      melds: { A: [existingMeld], B: [] },
    };

    const action: GameAction = {
      type: 'ADD_TO_MELD',
      meldId: 'meld-1',
      cardIds: ['ghost-card-id-123'],
    };

    const result = pukarReducer(state, action);
    expect(result.error).toMatch(/Player hand does not contain card ghost-card-id-123/i);
  });

  it('rejects DISCARD_CARD when round is already marked ROUND_OVER', () => {
    const state: GameState = {
      ...dealInitialState(4),
      roundStatus: 'ROUND_OVER',
      phase: 'DISCARD',
    };

    const action: GameAction = {
      type: 'DISCARD_CARD',
      cardId: state.players[0].hand[0].id,
    };

    const result = pukarReducer(state, action);
    expect(result.error).toMatch(/Cannot discard: round is already over/i);
  });

  it('rejects DISCARD_CARD when cardId is empty or whitespace', () => {
    const state: GameState = {
      ...dealInitialState(4),
      phase: 'DISCARD',
    };

    const action: GameAction = {
      type: 'DISCARD_CARD',
      cardId: '   ',
    };

    const result = pukarReducer(state, action);
    expect(result.error).toMatch(/Invalid or missing cardId to discard/i);
  });

  it('rejects DISCARD_CARD when active player hand does not contain cardId', () => {
    const state: GameState = {
      ...dealInitialState(4),
      phase: 'DISCARD',
    };

    const action: GameAction = {
      type: 'DISCARD_CARD',
      cardId: 'not-in-hand-id',
    };

    const result = pukarReducer(state, action);
    expect(result.error).toMatch(/is not in active player hand/i);
  });

  it('rejects TAKE_DISCARD when discard pile is empty', () => {
    const state: GameState = {
      ...dealInitialState(4),
      phase: 'DRAW',
      discardPile: [],
    };

    const action: GameAction = {
      type: 'TAKE_DISCARD',
    };

    const result = pukarReducer(state, action);
    expect(result.error).toMatch(/Discard pile is empty/i);
  });

  it('rejects PLAY_NEW_MELD when player does not hold the specified card IDs', () => {
    const state: GameState = {
      ...dealInitialState(4),
      phase: 'MELD',
    };

    const action: GameAction = {
      type: 'PLAY_NEW_MELD',
      cardIds: ['fake-c1', 'fake-c2', 'fake-c3'],
    };

    const result = pukarReducer(state, action);
    expect(result.error).toMatch(/Player hand does not contain card/i);
  });

  it('rejects START_NEXT_ROUND when round is currently PLAYING', () => {
    const state: GameState = {
      ...dealInitialState(4),
      roundStatus: 'PLAYING',
    };

    const action: GameAction = {
      type: 'START_NEXT_ROUND',
    };

    const result = pukarReducer(state, action);
    expect(result.error).toMatch(/current round is not over/i);
  });

  it('dealInitialState creates 3 pukars and 6 players when playerCount is 6', () => {
    const state = dealInitialState(6);
    expect(state.playerCount).toBe(6);
    expect(state.players.length).toBe(6);
    expect(state.pukarPool.length).toBe(3);
    expect(state.players[0].team).toBe('A');
    expect(state.players[1].team).toBe('B');
    expect(state.players[2].team).toBe('A');
    expect(state.players[3].team).toBe('B');
    expect(state.players[4].team).toBe('A');
    expect(state.players[5].team).toBe('B');
    for (const player of state.players) {
      expect(player.hand.length).toBe(13);
    }
  });
});
