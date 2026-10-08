import { describe, it, expect } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import { sanitizeStateForPlayer } from '../../src/engine/sanitizer';
import { dealInitialState } from '../../src/engine/deck';
import { Card, Meld } from '../../src/engine/types';

function createCard(id: string, suit: Card['suit'], rank: Card['rank']): Card {
  return {
    id,
    suit,
    rank,
    isNaturalJoker: rank === 0,
    isJoker: rank === 0,
  };
}

describe('Turn Lifecycle & Game Reducer', () => {
  describe('DRAW Phase', () => {
    it('drawing from stock deck advances phase from DRAW to MELD and adds card to active player hand', () => {
      const state = dealInitialState(4);
      expect(state.phase).toBe('DRAW');
      const initialStockCount = state.stockDeck.length;
      const initialHandCount = state.players[0].hand.length;
      const expectedDrawnCard = state.stockDeck[0];

      const { state: nextState, error } = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });
      expect(error).toBeUndefined();
      expect(nextState.phase).toBe('MELD');
      expect(nextState.stockDeck.length).toBe(initialStockCount - 1);
      expect(nextState.players[0].hand.length).toBe(initialHandCount + 1);
      expect(nextState.players[0].hand.some((c) => c.id === expectedDrawnCard.id)).toBe(true);
    });

    it('supports DRAW_CARD action with source DECK', () => {
      const state = dealInitialState(4);
      const { state: nextState, error } = pukarReducer(state, { type: 'DRAW_CARD', source: 'DECK' });
      expect(error).toBeUndefined();
      expect(nextState.phase).toBe('MELD');
    });

    it('drawing from discard pile unconditionally takes all cards into hand', () => {
      const state = dealInitialState(4);
      const discardCards = [
        createCard('d1', 'HEARTS', 7),
        createCard('d2', 'SPADES', 10),
        createCard('d3', 'CLUBS', 4),
      ];
      state.discardPile = [...discardCards];
      const initialHandCount = state.players[0].hand.length;

      const { state: nextState, error } = pukarReducer(state, { type: 'TAKE_DISCARD' });
      expect(error).toBeUndefined();
      expect(nextState.phase).toBe('MELD');
      expect(nextState.discardPile.length).toBe(0);
      expect(nextState.players[0].hand.length).toBe(initialHandCount + 3);
      expect(discardCards.every((dc) => nextState.players[0].hand.some((c) => c.id === dc.id))).toBe(true);
    });

    it('supports DRAW_CARD action with source BOTTOM', () => {
      const state = dealInitialState(4);
      const { state: nextState, error } = pukarReducer(state, { type: 'DRAW_CARD', source: 'BOTTOM' });
      expect(error).toBeUndefined();
      expect(nextState.phase).toBe('MELD');
      expect(nextState.discardPile.length).toBe(0);
    });

    it('rejects drawing from an empty discard pile', () => {
      const state = dealInitialState(4);
      state.discardPile = [];
      const { state: nextState, error } = pukarReducer(state, { type: 'TAKE_DISCARD' });
      expect(error).toBeDefined();
      expect(nextState).toBe(state);
    });

    it('rejects draw actions outside of DRAW phase', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      const { state: nextState, error } = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });
      expect(error).toBeDefined();
      expect(nextState).toBe(state);
    });
  });

  describe('MELD Phase', () => {
    it('melds cards from hand onto table for player team', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      const meldCards = [
        createCard('c1', 'SPADES', 7),
        createCard('c2', 'SPADES', 8),
        createCard('c3', 'SPADES', 9),
      ];
      state.players[0].hand = [...meldCards, createCard('c4', 'HEARTS', 5)];

      const { state: nextState, error } = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['c1', 'c2', 'c3'],
      });

      expect(error).toBeUndefined();
      expect(nextState.phase).toBe('MELD');
      expect(nextState.players[0].hand.length).toBe(1);
      expect(nextState.players[0].hand[0].id).toBe('c4');
      expect(nextState.melds.A.length).toBe(1);
      expect(nextState.melds.A[0].id).toBe('meld-r1-A-1');
      expect(nextState.melds.A[0].cards.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    });

    it('rejects playing invalid meld', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      state.players[0].hand = [
        createCard('c1', 'SPADES', 7),
        createCard('c2', 'HEARTS', 8),
        createCard('c3', 'DIAMONDS', 9),
      ];

      const { state: nextState, error } = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['c1', 'c2', 'c3'],
      });

      expect(error).toBeDefined();
      expect(nextState.melds.A.length).toBe(0);
    });

    it('adds cards to an existing team meld and handles movable 2 shift', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      const existingMeld: Meld = {
        id: 'meld-1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          createCard('s3', 'SPADES', 3),
          createCard('s4', 'SPADES', 4),
          createCard('w2', 'SPADES', 2),
          createCard('s6', 'SPADES', 6),
        ],
        slots: [
          { card: createCard('s3', 'SPADES', 3), representedRank: 3, representedSuit: 'SPADES', isWildcard: false },
          { card: createCard('s4', 'SPADES', 4), representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
          { card: createCard('w2', 'SPADES', 2), representedRank: 5, representedSuit: 'SPADES', isWildcard: true },
          { card: createCard('s6', 'SPADES', 6), representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
        ],
      };
      state.melds.A = [existingMeld];
      state.players[0].hand = [
        createCard('s5', 'SPADES', 5),
        createCard('s8', 'SPADES', 8),
        createCard('h10', 'HEARTS', 10),
      ];

      const { state: nextState, error } = pukarReducer(state, {
        type: 'ADD_TO_MELD',
        meldId: 'meld-1',
        cardIds: ['s5', 's8'],
      });

      expect(error).toBeUndefined();
      expect(nextState.melds.A[0].cards.length).toBe(6);
      expect(nextState.players[0].hand.length).toBe(1);
      expect(nextState.players[0].hand[0].id).toBe('h10');

      // 2 should shift upward to 7
      const twoSlot = nextState.melds.A[0].slots.find((s) => s.card.id === 'w2');
      expect(twoSlot?.representedRank).toBe(7);
      expect(twoSlot?.isWildcard).toBe(true);
    });

    it('rejects adding cards to opponent team meld', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      state.currentPlayerIndex = 0; // Player 1 is Team A
      state.melds.B = [
        {
          id: 'meld-b1',
          team: 'B',
          type: 'SET',
          cards: [
            createCard('b1', 'SPADES', 8),
            createCard('b2', 'HEARTS', 8),
            createCard('b3', 'DIAMONDS', 8),
          ],
          slots: [],
        },
      ];
      state.players[0].hand = [createCard('b4', 'CLUBS', 8)];

      const { state: nextState, error } = pukarReducer(state, {
        type: 'ADD_TO_MELD',
        meldId: 'meld-b1',
        cardIds: ['b4'],
      });

      expect(error).toBeDefined();
      expect(nextState).toBe(state);
    });

    it('emptying hand during meld immediately claims next 13-card Pukar (+50 pts) and keeps turn in MELD phase', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      const initialPukarCount = state.pukarPool.length;
      expect(initialPukarCount).toBeGreaterThanOrEqual(1);
      const expectedPukarCards = state.pukarPool[0];

      state.players[0].hand = [
        createCard('c1', 'SPADES', 7),
        createCard('c2', 'SPADES', 8),
        createCard('c3', 'SPADES', 9),
      ];

      const initialScoreA = state.scores.A;
      const { state: nextState, error } = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['c1', 'c2', 'c3'],
      });

      expect(error).toBeUndefined();
      expect(nextState.phase).toBe('MELD'); // Still in MELD phase to continue turn!
      expect(nextState.pukarPool.length).toBe(initialPukarCount - 1);
      expect(nextState.players[0].hand.length).toBe(13);
      expect(nextState.players[0].hand.map((c) => c.id)).toEqual(expectedPukarCards.map((c) => c.id));
      expect(nextState.scores.A).toBe(initialScoreA + 50);
      expect(nextState.pukarsClaimed?.A).toBe(1);
    });

    it('emptying hand during meld with 0 Pukars remaining triggers immediate round completion (going out)', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      state.pukarPool = [];
      if (state.pukars) state.pukars = [];

      state.players[0].hand = [
        createCard('c1', 'SPADES', 7),
        createCard('c2', 'SPADES', 8),
        createCard('c3', 'SPADES', 9),
      ];

      const { state: nextState, error } = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['c1', 'c2', 'c3'],
      });

      expect(error).toBeUndefined();
      expect(nextState.players[0].hand.length).toBe(0);
      expect(nextState.roundStatus).toBe('ROUND_OVER');
      expect(nextState.isRoundOver).toBe(true);
      expect(nextState.totalScores).toBeDefined();
      expect(nextState.totalScores).toEqual(nextState.scores);
    });
  });

  describe('DISCARD Phase & Turn Progression', () => {
    it('mandatory discard removes card from hand, adds to discard pile, and advances turn to next player', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      state.currentPlayerIndex = 0;
      const cardToDiscard = state.players[0].hand[0];
      const initialHandLength = state.players[0].hand.length;
      const initialDiscardCount = state.discardPile.length;

      const { state: nextState, error } = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: cardToDiscard.id,
      });

      expect(error).toBeUndefined();
      expect(nextState.players[0].hand.length).toBe(initialHandLength - 1);
      expect(nextState.players[0].hand.some((c) => c.id === cardToDiscard.id)).toBe(false);
      expect(nextState.discardPile.length).toBe(initialDiscardCount + 1);
      expect(nextState.discardPile[nextState.discardPile.length - 1].id).toBe(cardToDiscard.id);
      expect(nextState.currentPlayerIndex).toBe(1);
      expect(nextState.phase).toBe('DRAW');
    });

    it('emptying hand upon discard when Pukars remain claims Pukar (+50 pts) and continues turn in MELD phase', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      state.currentPlayerIndex = 0;
      const card = createCard('last', 'HEARTS', 4);
      state.players[0].hand = [card];
      const initialPukarCount = state.pukarPool.length;
      const initialScoreA = state.scores.A;

      const { state: nextState, error } = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: 'last',
      });

      expect(error).toBeUndefined();
      expect(nextState.pukarPool.length).toBe(initialPukarCount - 1);
      expect(nextState.players[0].hand.length).toBe(13); // Received 13 cards from Pukar
      expect(nextState.scores.A).toBe(initialScoreA + 50);
      expect(nextState.currentPlayerIndex).toBe(0); // Turn DOES NOT END!
      expect(nextState.phase).toBe('MELD'); // Continues in MELD phase without drawing

      // Player then drops another card after claiming Pukar to end their turn
      const cardToDrop = nextState.players[0].hand[0];
      const { state: turnEndedState } = pukarReducer(nextState, {
        type: 'DISCARD_CARD',
        cardId: cardToDrop.id,
      });

      expect(turnEndedState.players[0].hand.length).toBe(12);
      expect(turnEndedState.currentPlayerIndex).toBe(1); // Now advances to next player
      expect(turnEndedState.phase).toBe('DRAW');
    });

    it('emptying hand upon discard with 0 Pukars remaining triggers immediate round completion', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      state.pukarPool = [];
      if (state.pukars) state.pukars = [];
      state.currentPlayerIndex = 0;
      state.players[0].hand = [createCard('last', 'HEARTS', 4)];

      const { state: nextState, error } = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: 'last',
      });

      expect(error).toBeUndefined();
      expect(nextState.players[0].hand.length).toBe(0);
      expect(nextState.roundStatus).toBe('ROUND_OVER');
      expect(nextState.isRoundOver).toBe(true);
      expect(nextState.totalScores).toBeDefined();
      expect(nextState.totalScores).toEqual(nextState.scores);
    });

    it('rejects discarding card not present in player hand', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      const { state: nextState, error } = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: 'non-existent-card-id',
      });

      expect(error).toBeDefined();
      expect(nextState).toBe(state);
    });

    it('rejects discarding during DRAW phase', () => {
      const state = dealInitialState(4);
      state.phase = 'DRAW';
      const cardToDiscard = state.players[0].hand[0];
      const { state: nextState, error } = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: cardToDiscard.id,
      });

      expect(error).toBeDefined();
      expect(nextState).toBe(state);
    });
  });

  describe('Stock Deck Exhaustion', () => {
    it('stock deck exhaust when Pukars remain converts 1 Pukar to new Stock deck', () => {
      const state = dealInitialState(4);
      const lastStockCard = createCard('last-stock', 'SPADES', 10);
      state.stockDeck = [lastStockCard];
      const pukarDeck = state.pukarPool[0];
      const initialPukarCount = state.pukarPool.length;

      const { state: nextState, error } = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });

      expect(error).toBeUndefined();
      expect(nextState.phase).toBe('MELD');
      expect(nextState.players[0].hand.some((c) => c.id === 'last-stock')).toBe(true);
      expect(nextState.pukarPool.length).toBe(initialPukarCount - 1);
      expect(nextState.stockDeck.length).toBe(13);
      expect([...nextState.stockDeck.map((c) => c.id)].sort()).toEqual([...pukarDeck.map((c) => c.id)].sort());
    });

    it('stock deck exhaust with 0 Pukars triggers final turn for next player, then concludes round', () => {
      const state = dealInitialState(4);
      state.stockDeck = [createCard('last-stock', 'SPADES', 10)];
      state.pukarPool = [];
      if (state.pukars) state.pukars = [];
      state.currentPlayerIndex = 0;

      // 1. Player 0 draws the last card
      const step1 = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });
      expect(step1.error).toBeUndefined();
      expect(step1.state.stockDeck.length).toBe(0);
      expect(step1.state.lastTurnTriggeredByDeckExhaust).toBe(true);
      expect(step1.state.phase).toBe('MELD');

      // 2. Player 0 completes their turn by discarding
      const discardCard = step1.state.players[0].hand[0];
      const step2 = pukarReducer(step1.state, {
        type: 'DISCARD_CARD',
        cardId: discardCard.id,
      });
      expect(step2.error).toBeUndefined();
      // Next player (Player 1) gets the final turn
      expect(step2.state.currentPlayerIndex).toBe(1);
      expect(step2.state.roundStatus).toBe('FINAL_TURN');
      expect(step2.state.phase).toBe('DRAW');

      // 3. Player 1 takes bottom/discard (stock deck is empty)
      const step3 = pukarReducer(step2.state, { type: 'TAKE_DISCARD' });
      expect(step3.error).toBeUndefined();
      expect(step3.state.phase).toBe('MELD');

      // 4. Player 1 completes their final turn by discarding
      const p1Discard = step3.state.players[1].hand[0];
      const step4 = pukarReducer(step3.state, {
        type: 'DISCARD_CARD',
        cardId: p1Discard.id,
      });
      expect(step4.error).toBeUndefined();
      // Round should now conclude!
      expect(step4.state.roundStatus).toBe('ROUND_OVER');
      expect(step4.state.isRoundOver).toBe(true);
    });
  });

  describe('START_NEXT_ROUND & RESET_GAME', () => {
    it('START_NEXT_ROUND preserves total scores and deals fresh round', () => {
      const state = dealInitialState(4);
      state.scores = { A: 250, B: 100 };
      state.round = 1;
      state.roundStatus = 'ROUND_OVER';
      state.isRoundOver = true;
      state.melds.A = [
        {
          id: 'm1',
          team: 'A',
          type: 'RUN',
          cards: [],
          slots: [],
        },
      ];

      const { state: nextState, error } = pukarReducer(state, { type: 'START_NEXT_ROUND' });

      expect(error).toBeUndefined();
      expect(nextState.round).toBe(2);
      expect(nextState.roundStatus).toBe('PLAYING');
      expect(nextState.isRoundOver).toBe(false);
      expect(nextState.phase).toBe('DRAW');
      expect(nextState.scores).toEqual({ A: 250, B: 100 });
      expect(nextState.melds.A).toEqual([]);
      expect(nextState.melds.B).toEqual([]);
      expect(nextState.players.every((p) => p.hand.length === 13)).toBe(true);
      expect(nextState.pukarPool.length).toBe(2);
    });

    it('rejects START_NEXT_ROUND when round is still in progress', () => {
      const state = dealInitialState(4);
      expect(state.roundStatus).toBe('PLAYING');
      expect(state.isRoundOver).toBeFalsy();

      const { state: nextState, error } = pukarReducer(state, { type: 'START_NEXT_ROUND' });
      expect(error).toBeDefined();
      expect(error).toContain('current round is not over');
      expect(nextState).toBe(state);
    });

    it('RESET_GAME resets match scores to 0 and deals fresh game', () => {
      const state = dealInitialState(4);
      state.scores = { A: 500, B: 300 };
      state.round = 3;

      const { state: nextState, error } = pukarReducer(state, { type: 'RESET_GAME' });

      expect(error).toBeUndefined();
      expect(nextState.round).toBe(1);
      expect(nextState.scores).toEqual({ A: 0, B: 0 });
      expect(nextState.roundStatus).toBe('PLAYING');
      expect(nextState.phase).toBe('DRAW');
      expect(nextState.players.every((p) => p.hand.length === 13)).toBe(true);
    });

    it('syncs totalScores (+50) immediately on mid-round Pukar claim during Round 2 and avoids double-counting at round end', () => {
      const state = dealInitialState(4);
      state.round = 2;
      state.scores = { A: 120, B: 85 };
      state.totalScores = { A: 120, B: 85 };
      state.roundScores = { A: 0, B: 0 };
      state.phase = 'MELD';
      state.currentPlayerIndex = 0; // Team A
      const lastCard = createCard('last', 'HEARTS', 4);
      state.players[0].hand = [lastCard];

      // Discard last card while Pukars remain (claims Pukar)
      const { state: step1, error: err1 } = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: 'last',
      });

      expect(err1).toBeUndefined();
      // Live scores and totalScores reflect +50 immediately during Round 2 play
      expect(step1.scores.A).toBe(170);
      expect(step1.totalScores?.A).toBe(170);
      expect(step1.roundScores?.A).toBe(50);
      expect(step1.pukarsClaimed?.A).toBe(1);

      // Now conclude the round by going out (0 Pukars left)
      step1.pukarPool = [];
      if (step1.pukars) step1.pukars = [];
      step1.phase = 'MELD';
      step1.currentPlayerIndex = 0;
      const endCard = createCard('end-card', 'DIAMONDS', 7);
      step1.players[0].hand = [endCard];

      const { state: step2, error: err2 } = pukarReducer(step1, {
        type: 'DISCARD_CARD',
        cardId: 'end-card',
      });

      expect(err2).toBeUndefined();
      expect(step2.roundStatus).toBe('ROUND_OVER');
      // Round 2 score is 100 (from 1 mid-round pukar + 1 going-out pukar claim). Total match score is 120 (R1) + 100 (R2) = 220 (no double count!)
      expect(step2.pukarsClaimed?.A).toBe(2);
      expect(step2.roundScores?.A).toBe(100);
      expect(step2.totalScores?.A).toBe(220);
      expect(step2.scores.A).toBe(220);
    });

    it('scopes meld IDs with round prefix meld-r{round}-{team}-{index}', () => {
      const state = dealInitialState(4);
      state.round = 3;
      state.phase = 'MELD';
      state.currentPlayerIndex = 0; // Team A
      state.players[0].hand = [
        createCard('c1', 'SPADES', 7),
        createCard('c2', 'SPADES', 8),
        createCard('c3', 'SPADES', 9),
        createCard('other', 'CLUBS', 4),
      ];

      const { state: nextState, error } = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['c1', 'c2', 'c3'],
      });

      expect(error).toBeUndefined();
      expect(nextState.melds.A[0].id).toBe('meld-r3-A-1');
    });
  });

  describe('State Sanitization', () => {
    it('sanitizeStateForPlayer masks opponent hands and stock/pukar contents while keeping active player hand visible', () => {
      const state = dealInitialState(4);
      const sanitized = sanitizeStateForPlayer(state, 'p1');

      // Player 1 is the viewer
      const p1 = sanitized.players.find((p) => p.id === 'p1')!;
      expect(p1.hand).toBeDefined();
      expect(p1.hand?.length).toBe(13);
      expect(p1.cardCount).toBe(13);

      // Other players must NOT expose hand cards
      const otherPlayers = sanitized.players.filter((p) => p.id !== 'p1');
      for (const op of otherPlayers) {
        expect(op.hand).toBeUndefined();
        expect(op.cardCount).toBe(13);
      }

      // Stock deck and pukar pool cards should NOT be exposed
      expect((sanitized as any).stockDeck).toBeUndefined();
      expect(sanitized.stockDeckCount).toBe(state.stockDeck.length);
      expect((sanitized as any).pukarPool).toBeUndefined();
      expect(sanitized.pukarPoolCount).toBe(state.pukarPool.length);

      // Discard pile and melds are public
      expect(sanitized.discardPile).toEqual(state.discardPile);
      expect(sanitized.melds).toEqual(state.melds);
      expect(sanitized.scores).toEqual(state.scores);
      expect(sanitized.round).toBe(state.round);
      expect(sanitized.roundStatus).toBe(state.roundStatus);
    });
  });
});
