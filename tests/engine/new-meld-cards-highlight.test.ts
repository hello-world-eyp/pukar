import { describe, it, expect } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';
import { sanitizeStateForPlayer, getNewMeldCardIds } from '../../src/engine/sanitizer';
import { Card, GameState, Meld } from '../../src/engine/types';

function createCard(id: string, suit: 'SPADES' | 'HEARTS' | 'CLUBS' | 'DIAMONDS', rank: number): Card {
  return {
    id,
    suit,
    rank: rank as any,
    isJoker: rank === 2,
    isNaturalJoker: false,
  };
}

describe('New Cards on Table Sequences (Melds) - Engine & Sanitizer', () => {
  it('dealInitialState initializes turnCount to 1, meldCardAdditions as empty, and lastTurnEndedAtTurnByPlayer as empty', () => {
    const initialState = dealInitialState(4);
    expect(initialState.turnCount).toBe(1);
    expect(initialState.meldCardAdditions).toEqual([]);
    expect(initialState.lastTurnEndedAtTurnByPlayer).toEqual({});
  });

  it('records cards in meldCardAdditions when PLAY_NEW_MELD is executed', () => {
    const initialState = dealInitialState(4);
    const meldCards = [
      createCard('c-s5', 'SPADES', 5),
      createCard('c-s6', 'SPADES', 6),
      createCard('c-s7', 'SPADES', 7),
    ];
    const discardCard = createCard('c-d10', 'DIAMONDS', 10);

    const testState: GameState = {
      ...initialState,
      currentPlayerIndex: 0,
      phase: 'MELD',
      players: [
        {
          ...initialState.players[0],
          hand: [...meldCards, discardCard],
        },
        ...initialState.players.slice(1),
      ],
    };

    const meldResult = pukarReducer(testState, {
      type: 'PLAY_NEW_MELD',
      cardIds: ['c-s5', 'c-s6', 'c-s7'],
    });

    expect(meldResult.error).toBeUndefined();
    expect(meldResult.state.meldCardAdditions).toBeDefined();
    expect(meldResult.state.meldCardAdditions?.length).toBe(3);
    expect(meldResult.state.meldCardAdditions?.map((a) => a.cardId)).toEqual(['c-s5', 'c-s6', 'c-s7']);
    expect(meldResult.state.meldCardAdditions?.[0].turnNumber).toBe(1);
    expect(meldResult.state.meldCardAdditions?.[0].playerIndex).toBe(0);

    // Player 0 sees them as new during their turn
    const newCardsP0 = getNewMeldCardIds(meldResult.state, 0);
    expect(newCardsP0).toEqual(['c-s5', 'c-s6', 'c-s7']);
  });

  it('records added cards in meldCardAdditions when ADD_TO_MELD is executed', () => {
    const initialState = dealInitialState(4);
    const existingMeld: Meld = {
      id: 'meld-run-1',
      team: 'A',
      type: 'RUN',
      suit: 'SPADES',
      cards: [
        createCard('c-s5', 'SPADES', 5),
        createCard('c-s6', 'SPADES', 6),
        createCard('c-s7', 'SPADES', 7),
      ],
      slots: [
        { card: createCard('c-s5', 'SPADES', 5), representedRank: 5 },
        { card: createCard('c-s6', 'SPADES', 6), representedRank: 6 },
        { card: createCard('c-s7', 'SPADES', 7), representedRank: 7 },
      ],
      points: 20,
    };

    const addCard = createCard('c-s8', 'SPADES', 8);
    const discardCard = createCard('c-d10', 'DIAMONDS', 10);

    const testState: GameState = {
      ...initialState,
      currentPlayerIndex: 0,
      phase: 'MELD',
      turnCount: 2,
      melds: {
        A: [existingMeld],
        B: [],
      },
      meldCardAdditions: [
        { cardId: 'c-s5', turnNumber: 1, playerIndex: 0 },
        { cardId: 'c-s6', turnNumber: 1, playerIndex: 0 },
        { cardId: 'c-s7', turnNumber: 1, playerIndex: 0 },
      ],
      players: [
        {
          ...initialState.players[0],
          hand: [addCard, discardCard],
        },
        ...initialState.players.slice(1),
      ],
    };

    const addResult = pukarReducer(testState, {
      type: 'ADD_TO_MELD',
      meldId: 'meld-run-1',
      cardIds: ['c-s8'],
    });

    expect(addResult.error).toBeUndefined();
    expect(addResult.state.meldCardAdditions?.some((a) => a.cardId === 'c-s8' && a.turnNumber === 2)).toBe(true);
  });

  it('clears highlights when a player ends their turn, and displays new additions from intervening opponent turns', () => {
    const initialState = dealInitialState(4);

    // Turn 1: Player 0 plays meld [c-s5, c-s6, c-s7] and discards
    const meldCards = [
      createCard('c-s5', 'SPADES', 5),
      createCard('c-s6', 'SPADES', 6),
      createCard('c-s7', 'SPADES', 7),
    ];
    const discardCard0 = createCard('c-d10', 'DIAMONDS', 10);

    const stateTurn1: GameState = {
      ...initialState,
      currentPlayerIndex: 0,
      phase: 'MELD',
      turnCount: 1,
      players: [
        { ...initialState.players[0], hand: [...meldCards, discardCard0] },
        ...initialState.players.slice(1),
      ],
    };

    const meldedState = pukarReducer(stateTurn1, {
      type: 'PLAY_NEW_MELD',
      cardIds: ['c-s5', 'c-s6', 'c-s7'],
    }).state;

    // During Turn 1, Player 0 sees them as new
    expect(getNewMeldCardIds(meldedState, 0)).toEqual(['c-s5', 'c-s6', 'c-s7']);

    // Player 0 discards to end turn 1
    const endTurn1State = pukarReducer(meldedState, {
      type: 'DISCARD_CARD',
      cardId: discardCard0.id,
    }).state;

    expect(endTurn1State.turnCount).toBe(2);
    expect(endTurn1State.lastTurnEndedAtTurnByPlayer?.[0]).toBe(1);

    // After Player 0 ends turn: cards from Turn 1 are NO LONGER NEW for Player 0!
    expect(getNewMeldCardIds(endTurn1State, 0)).toEqual([]);

    // But for Player 1 (who is now active in Turn 2), they ARE new!
    expect(getNewMeldCardIds(endTurn1State, 1)).toEqual(['c-s5', 'c-s6', 'c-s7']);

    // Turn 2: Player 1 (Team B) plays a meld [c-h8, c-h9, c-h10]
    const meldB = [
      createCard('c-h8', 'HEARTS', 8),
      createCard('c-h9', 'HEARTS', 9),
      createCard('c-h10', 'HEARTS', 10),
    ];
    const discardCard1 = createCard('c-c4', 'CLUBS', 4);

    const stateTurn2: GameState = {
      ...endTurn1State,
      currentPlayerIndex: 1,
      phase: 'MELD',
      players: endTurn1State.players.map((p, idx) =>
        idx === 1 ? { ...p, hand: [...meldB, discardCard1] } : p
      ),
    };

    const meldedTurn2 = pukarReducer(stateTurn2, {
      type: 'PLAY_NEW_MELD',
      cardIds: ['c-h8', 'c-h9', 'c-h10'],
    }).state;

    // Now, Player 0 (observing while Player 1 plays) sees Player 1's newly added cards!
    expect(getNewMeldCardIds(meldedTurn2, 0)).toEqual(['c-h8', 'c-h9', 'c-h10']);

    // Player 1 discards to end turn 2
    const endTurn2State = pukarReducer(meldedTurn2, {
      type: 'DISCARD_CARD',
      cardId: discardCard1.id,
    }).state;

    expect(endTurn2State.turnCount).toBe(3);
    expect(endTurn2State.lastTurnEndedAtTurnByPlayer?.[1]).toBe(2);

    // For Player 1, meldB is now old
    expect(getNewMeldCardIds(endTurn2State, 1)).toEqual([]);
    // But Player 0 still sees meldB as new because Player 0 hasn't ended their next turn yet!
    expect(getNewMeldCardIds(endTurn2State, 0)).toEqual(['c-h8', 'c-h9', 'c-h10']);

    // Turn 3: Player 2 (Partner of Player 0, Team A) adds c-s8 to Team A meld
    const addCard2 = createCard('c-s8', 'SPADES', 8);
    const discardCard2 = createCard('c-c2', 'CLUBS', 3);
    const extraCard2 = createCard('c-extra2', 'DIAMONDS', 4);
    const stateTurn3: GameState = {
      ...endTurn2State,
      currentPlayerIndex: 2,
      phase: 'MELD',
      players: endTurn2State.players.map((p, idx) =>
        idx === 2 ? { ...p, hand: [addCard2, discardCard2, extraCard2] } : p
      ),
    };

    const addedTurn3 = pukarReducer(stateTurn3, {
      type: 'ADD_TO_MELD',
      meldId: meldedState.melds.A[0].id,
      cardIds: ['c-s8'],
    }).state;

    const endTurn3State = pukarReducer(addedTurn3, {
      type: 'DISCARD_CARD',
      cardId: discardCard2.id,
    }).state;

    // Turn 4: Player 3 (Opponent, Team B) adds c-hJ to Team B meld
    const addCard3 = createCard('c-h11', 'HEARTS', 11);
    const discardCard3 = createCard('c-c5', 'CLUBS', 5);
    const extraCard3 = createCard('c-extra3', 'DIAMONDS', 5);
    const stateTurn4: GameState = {
      ...endTurn3State,
      currentPlayerIndex: 3,
      phase: 'MELD',
      players: endTurn3State.players.map((p, idx) =>
        idx === 3 ? { ...p, hand: [addCard3, discardCard3, extraCard3] } : p
      ),
    };

    const addedTurn4 = pukarReducer(stateTurn4, {
      type: 'ADD_TO_MELD',
      meldId: meldedTurn2.melds.B[0].id,
      cardIds: ['c-h11'],
    }).state;

    const endTurn4State = pukarReducer(addedTurn4, {
      type: 'DISCARD_CARD',
      cardId: discardCard3.id,
    }).state;

    // Turn 5 arrives: It is Player 0's turn again!
    expect(endTurn4State.turnCount).toBe(5);
    expect(endTurn4State.currentPlayerIndex).toBe(0);

    // Player 0 sees exactly what cards were added across the last 3 turns (turns 2, 3, 4):
    // From Turn 2: c-h8, c-h9, c-h10 (by Player 1)
    // From Turn 3: c-s8 (by Player 2)
    // From Turn 4: c-h11 (by Player 3)
    const newCardsWhenP0TurnArrives = getNewMeldCardIds(endTurn4State, 0);
    expect(newCardsWhenP0TurnArrives.sort()).toEqual(
      ['c-h8', 'c-h9', 'c-h10', 'c-s8', 'c-h11'].sort()
    );

    // Turn 1 cards (c-s5, c-s6, c-s7) are NOT in the list for Player 0
    expect(newCardsWhenP0TurnArrives).not.toContain('c-s5');
    expect(newCardsWhenP0TurnArrives).not.toContain('c-s6');
    expect(newCardsWhenP0TurnArrives).not.toContain('c-s7');

    // Player 0 draws, plays, and discards to end turn 5
    const drawnTurn5 = pukarReducer(endTurn4State, {
      type: 'DRAW_FROM_STOCK',
    }).state;
    const discardCardTurn5 = drawnTurn5.players[0].hand[0];
    const endTurn5Result = pukarReducer(drawnTurn5, {
      type: 'DISCARD_CARD',
      cardId: discardCardTurn5.id,
    });
    expect(endTurn5Result.error).toBeUndefined();
    const endTurn5State = endTurn5Result.state;

    // Highlights completely disappear for Player 0!
    expect(getNewMeldCardIds(endTurn5State, 0)).toEqual([]);
  });

  it('sanitizeStateForPlayer computes newMeldCardIds specifically for the requesting player perspective', () => {
    const initialState = dealInitialState(4);
    const meldCards = [
      createCard('c-s5', 'SPADES', 5),
      createCard('c-s6', 'SPADES', 6),
      createCard('c-s7', 'SPADES', 7),
    ];
    const discardCard = createCard('c-d10', 'DIAMONDS', 10);

    const testState: GameState = {
      ...initialState,
      currentPlayerIndex: 0,
      phase: 'MELD',
      players: [
        { ...initialState.players[0], hand: [...meldCards, discardCard] },
        ...initialState.players.slice(1),
      ],
    };

    const meldedState = pukarReducer(testState, {
      type: 'PLAY_NEW_MELD',
      cardIds: ['c-s5', 'c-s6', 'c-s7'],
    }).state;

    // Discard to end turn 1
    const endTurn1 = pukarReducer(meldedState, {
      type: 'DISCARD_CARD',
      cardId: discardCard.id,
    }).state;

    // Sanitized state for Player 0 (whose turn ended) -> newMeldCardIds is empty
    const sanitizedP0 = sanitizeStateForPlayer(endTurn1, 'p1');
    expect(sanitizedP0.newMeldCardIds).toEqual([]);

    // Sanitized state for Player 1 (whose turn is starting) -> sees cards from turn 1
    const sanitizedP1 = sanitizeStateForPlayer(endTurn1, 'p2');
    expect(sanitizedP1.newMeldCardIds).toEqual(['c-s5', 'c-s6', 'c-s7']);
  });
});
