import { describe, it, expect } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';
import { sanitizeStateForPlayer } from '../../src/engine/sanitizer';
import { Card, Suit, Rank } from '../../src/engine/types';

function makeCard(suit: Suit | null, rank: number, id?: string): Card {
  const isJoker = rank === 0 && suit === null;
  return {
    id: id ?? `card-${suit}-${rank}-${Math.random()}`,
    suit,
    rank: rank as Rank,
    isNaturalJoker: isJoker,
    isJoker: isJoker || rank === 2,
  };
}

describe('Comprehensive Turn Lifecycle & Reducer State Machine (src/engine/reducer.ts)', () => {
  describe('DRAW Phase Mechanics', () => {
    it('drawing from stock deck transfers exactly 1 card to active player hand and shifts phase to MELD', () => {
      const state = dealInitialState(4);
      const topStockCard = state.stockDeck[0];
      const initialHandSize = state.players[0].hand.length;
      const initialStockSize = state.stockDeck.length;

      const result = pukarReducer(state, { type: 'DRAW_CARD', source: 'DECK' });
      expect(result.error).toBeUndefined();

      const next = result.state;
      expect(next.phase).toBe('MELD');
      expect(next.players[0].hand).toHaveLength(initialHandSize + 1);
      expect(next.players[0].hand.find((c) => c.id === topStockCard.id)).toBeDefined();
      expect(next.stockDeck).toHaveLength(initialStockSize - 1);
    });

    it('drawing from the discard pile (The Bottom) unconditionally picks up the entire pile into hand', () => {
      const state = dealInitialState(4);
      // Simulate discard pile accumulating 5 cards
      const accumulatedDiscards: Card[] = [
        makeCard('SPADES', 3, 'disc-1'),
        makeCard('HEARTS', 4, 'disc-2'),
        makeCard('DIAMONDS', 5, 'disc-3'),
        makeCard('CLUBS', 6, 'disc-4'),
        makeCard('SPADES', 7, 'disc-5'),
      ];
      state.discardPile = [...accumulatedDiscards];
      const initialHandSize = state.players[0].hand.length;

      const result = pukarReducer(state, { type: 'DRAW_CARD', source: 'BOTTOM' });
      expect(result.error).toBeUndefined();

      const next = result.state;
      expect(next.phase).toBe('MELD');
      expect(next.discardPile).toHaveLength(0);
      expect(next.players[0].hand).toHaveLength(initialHandSize + 5);

      accumulatedDiscards.forEach((card) => {
        expect(next.players[0].hand.find((c) => c.id === card.id)).toBeDefined();
      });
    });

    it('rejects drawing from an empty discard pile', () => {
      const state = dealInitialState(4);
      state.discardPile = [];

      const result = pukarReducer(state, { type: 'DRAW_CARD', source: 'BOTTOM' });
      expect(result.error).toMatch(/empty/i);
    });

    it('rejects drawing during MELD or DISCARD phases', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';

      const resMeld = pukarReducer(state, { type: 'DRAW_CARD', source: 'DECK' });
      expect(resMeld.error).toMatch(/cannot draw/i);

      state.phase = 'DISCARD';
      const resDiscard = pukarReducer(state, { type: 'DRAW_CARD', source: 'DECK' });
      expect(resDiscard.error).toMatch(/cannot draw/i);
    });
  });

  describe('Pukar Pool Replenishment on Deck Exhaustion', () => {
    it('replenishes stock deck from Pukar pool when stock becomes empty and Pukars remain in pool', () => {
      const state = dealInitialState(4);
      // Place only 1 card in stock deck
      state.stockDeck = [makeCard('HEARTS', 9, 'last-stock-card')];
      expect(state.pukarPool).toHaveLength(2);

      const result = pukarReducer(state, { type: 'DRAW_CARD', source: 'DECK' });
      expect(result.error).toBeUndefined();

      const next = result.state;
      // Active player drew the 1 card
      expect(next.players[0].hand.find((c) => c.id === 'last-stock-card')).toBeDefined();
      // Pukar 1 (13 cards) became the new stock deck (shuffled)
      expect(next.stockDeck).toHaveLength(13);
      // Pukar pool reduced from 2 to 1
      expect(next.pukarPool).toHaveLength(1);
      expect(next.roundStatus).toBe('PLAYING');
    });

    it('triggers final turn when stock deck exhausts and 0 Pukars remain in pool', () => {
      const state = dealInitialState(4);
      state.stockDeck = [makeCard('HEARTS', 9, 'last-card')];
      state.pukarPool = []; // No Pukars remaining!

      // Step 1: Draw last card
      const step1 = pukarReducer(state, { type: 'DRAW_CARD', source: 'DECK' });
      expect(step1.error).toBeUndefined();
      expect(step1.state.stockDeck).toHaveLength(0);
      expect(step1.state.lastTurnTriggeredByDeckExhaust).toBe(true);

      // Step 2: Discard to advance turn and enter FINAL_TURN
      const discardCard = step1.state.players[0].hand[0];
      const step2 = pukarReducer(step1.state, {
        type: 'DISCARD_CARD',
        cardId: discardCard.id,
      });
      expect(step2.error).toBeUndefined();
      expect(step2.state.roundStatus).toBe('FINAL_TURN');
      expect(step2.state.finalTurnPlayerIndex).toBe(1);
    });
  });

  describe('MELD Phase & Instant Pukar Claim Dynamics', () => {
    it('allows playing a new valid 3-card meld onto the table for active player team', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';

      const runCards = [
        makeCard('SPADES', 4, 'c-4s'),
        makeCard('SPADES', 5, 'c-5s'),
        makeCard('SPADES', 6, 'c-6s'),
      ];
      state.players[0].hand = [...runCards, makeCard('HEARTS', 10, 'other')];

      const result = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: runCards.map((c) => c.id),
      });

      expect(result.error).toBeUndefined();
      const next = result.state;
      expect(next.melds.A).toHaveLength(1);
      expect(next.melds.A[0].type).toBe('RUN');
      expect(next.melds.A[0].slots).toHaveLength(3);
      expect(next.players[0].hand).toHaveLength(1); // Only 'other' card remains
    });

    it('claims a 13-card Pukar deck and awards +50 pts when player empties hand during MELD, keeping phase in MELD', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      expect(state.pukarPool).toHaveLength(2);

      const runCards = [
        makeCard('SPADES', 4, 'c-4s'),
        makeCard('SPADES', 5, 'c-5s'),
        makeCard('SPADES', 6, 'c-6s'),
      ];
      // Hand consists ONLY of these 3 cards
      state.players[0].hand = [...runCards];

      const result = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: runCards.map((c) => c.id),
      });

      expect(result.error).toBeUndefined();
      const next = result.state;
      // Received 13 cards from Pukar
      expect(next.players[0].hand).toHaveLength(13);
      // Pool decreased to 1
      expect(next.pukarPool).toHaveLength(1);
      // Team A awarded +50 points
      expect(next.scores.A).toBe(50);
      expect(next.pukarsClaimed?.A).toBe(1);
      // Player remains in MELD phase so they can keep playing!
      expect(next.phase).toBe('MELD');
      expect(next.roundStatus).toBe('PLAYING');
    });

    it('terminates round immediately (going out) when player empties hand during MELD with 0 Pukars remaining', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      state.pukarPool = []; // No pukars left to claim!

      const runCards = [
        makeCard('SPADES', 4, 'c-4s'),
        makeCard('SPADES', 5, 'c-5s'),
        makeCard('SPADES', 6, 'c-6s'),
      ];
      state.players[0].hand = [...runCards];

      const result = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: runCards.map((c) => c.id),
      });

      expect(result.error).toBeUndefined();
      const next = result.state;
      expect(next.players[0].hand).toHaveLength(0);
      expect(next.isRoundOver).toBe(true);
      expect(next.roundStatus).toBe('ROUND_OVER');
    });

    it('allows adding cards to an existing team meld on table', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';

      const initialRun = [
        makeCard('HEARTS', 4, 'c-4h'),
        makeCard('HEARTS', 5, 'c-5h'),
        makeCard('HEARTS', 6, 'c-6h'),
      ];
      state.melds.A = [
        {
          id: 'meld-r1-A-1',
          team: 'A',
          type: 'RUN',
          suit: 'HEARTS',
          cards: initialRun,
          slots: initialRun.map((c) => ({ card: c, representedRank: c.rank, isWildcard: false })),
        },
      ];

      const card7 = makeCard('HEARTS', 7, 'c-7h');
      state.players[0].hand = [card7, makeCard('SPADES', 12, 'keep')];

      const result = pukarReducer(state, {
        type: 'ADD_TO_MELD',
        meldId: 'meld-r1-A-1',
        cardIds: [card7.id],
      });

      expect(result.error).toBeUndefined();
      const next = result.state;
      expect(next.melds.A[0].slots).toHaveLength(4);
      expect(next.players[0].hand).toHaveLength(1);
    });

    it('rejects adding cards to opponent team melds', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      // Active player 0 is Team A
      expect(state.players[0].team).toBe('A');

      const initialRun = [makeCard('HEARTS', 4), makeCard('HEARTS', 5), makeCard('HEARTS', 6)];
      state.melds.B = [
        {
          id: 'meld-r1-B-1',
          team: 'B',
          type: 'RUN',
          suit: 'HEARTS',
          cards: initialRun,
          slots: initialRun.map((c) => ({ card: c, representedRank: c.rank, isWildcard: false })),
        },
      ];

      const card7 = makeCard('HEARTS', 7, 'c-7h');
      state.players[0].hand = [card7];

      const result = pukarReducer(state, {
        type: 'ADD_TO_MELD',
        meldId: 'meld-r1-B-1',
        cardIds: [card7.id],
      });

      expect(result.error).toMatch(/opponent/i);
    });
  });

  describe('DISCARD Phase & Turn Progression', () => {
    it('discards 1 card to the top of discard pile and advances turn to Player 2 (Team B) in DRAW phase', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';

      const discardCard = state.players[0].hand[0];
      const initialHandCount = state.players[0].hand.length;
      const initialDiscardCount = state.discardPile.length;

      const result = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: discardCard.id,
      });

      expect(result.error).toBeUndefined();
      const next = result.state;
      expect(next.players[0].hand).toHaveLength(initialHandCount - 1);
      expect(next.discardPile[next.discardPile.length - 1].id).toBe(discardCard.id);
      expect(next.discardPile).toHaveLength(initialDiscardCount + 1);

      // Advanced to Player 2
      expect(next.currentPlayerIndex).toBe(1);
      expect(next.phase).toBe('DRAW');
      expect(next.roundStatus).toBe('PLAYING');
    });

    it('claims a Pukar when hand reaches 0 upon discard and keeps turn with player in MELD phase', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      expect(state.pukarPool).toHaveLength(2);

      const onlyCard = makeCard('SPADES', 10, 'last-card');
      state.players[0].hand = [onlyCard];

      const result = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: onlyCard.id,
      });

      expect(result.error).toBeUndefined();
      const next = result.state;
      // Player 1 claimed Pukar into hand
      expect(next.players[0].hand).toHaveLength(13);
      expect(next.pukarPool).toHaveLength(1);
      expect(next.scores.A).toBe(50);
      // Turn does not end: player stays active in MELD phase
      expect(next.currentPlayerIndex).toBe(0);
      expect(next.phase).toBe('MELD');

      // Player drops another card to end their turn
      const secondDiscard = pukarReducer(next, {
        type: 'DISCARD_CARD',
        cardId: next.players[0].hand[0].id,
      });
      expect(secondDiscard.state.currentPlayerIndex).toBe(1);
      expect(secondDiscard.state.phase).toBe('DRAW');
    });

    it('concludes the round when final turn player completes their discard', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      state.roundStatus = 'FINAL_TURN';
      state.lastTurnTriggeredByDeckExhaust = true;
      state.finalTurnPlayerIndex = 0; // Active player 0 is the final player

      const discardCard = state.players[0].hand[0];
      const result = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: discardCard.id,
      });

      expect(result.error).toBeUndefined();
      const next = result.state;
      expect(next.isRoundOver).toBe(true);
      expect(next.roundStatus).toBe('ROUND_OVER');
    });

    it('rejects discarding a card not in the player hand', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';

      const unownedCard = makeCard('SPADES', 14, 'not-in-hand');
      const result = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: unownedCard.id,
      });

      expect(result.error).toMatch(/not in active player hand/i);
    });
  });

  describe('Multi-Round Progression & Match Resets', () => {
    it('START_NEXT_ROUND advances to round 2, preserves cumulative totalScores, and deals fresh hands', () => {
      const state = dealInitialState(4);
      state.round = 1;
      state.roundStatus = 'ROUND_OVER';
      state.isRoundOver = true;
      state.scores = { A: 250, B: 100 };
      state.totalScores = { A: 250, B: 100 };

      const result = pukarReducer(state, { type: 'START_NEXT_ROUND' });
      expect(result.error).toBeUndefined();

      const next = result.state;
      expect(next.round).toBe(2);
      expect(next.roundStatus).toBe('PLAYING');
      expect(next.isRoundOver).toBeFalsy();
      expect(next.totalScores).toEqual({ A: 250, B: 100 });
      expect(next.scores).toEqual({ A: 250, B: 100 });
      expect(next.currentPlayerIndex).toBe(0);
      // Fresh 13-card hands
      next.players.forEach((p) => {
        expect(p.hand).toHaveLength(13);
      });
    });

    it('rejects START_NEXT_ROUND when round is currently active', () => {
      const state = dealInitialState(4);
      state.roundStatus = 'PLAYING';

      const result = pukarReducer(state, { type: 'START_NEXT_ROUND' });
      expect(result.error).toMatch(/round is not over/i);
    });

    it('RESET_GAME resets all match totals and begins fresh game at Round 1', () => {
      const state = dealInitialState(4);
      state.round = 3;
      state.totalScores = { A: 550, B: 300 };

      const result = pukarReducer(state, { type: 'RESET_GAME' });
      expect(result.error).toBeUndefined();

      const next = result.state;
      expect(next.round).toBe(1);
      expect(next.scores).toEqual({ A: 0, B: 0 });
      expect(next.totalScores).toEqual({ A: 0, B: 0 });
      expect(next.roundStatus).toBe('PLAYING');
      expect(next.melds.A).toHaveLength(0);
      expect(next.melds.B).toHaveLength(0);
    });
  });

  describe('Multiplayer State Sanitizer', () => {
    it('masks opponents hands and stock order while preserving card counts and active player visibility', () => {
      const state = dealInitialState(4);
      const sanitized = sanitizeStateForPlayer(state, 'p1');

      // Player 1 (self): cards fully visible
      const p1 = sanitized.players.find((p) => p.id === 'p1');
      expect(p1?.hand).toBeDefined();
      expect(p1?.hand?.length).toBe(13);
      expect(p1?.cardCount).toBe(13);

      // Player 2, 3, 4: hands masked
      const opponents = sanitized.players.filter((p) => p.id !== 'p1');
      opponents.forEach((opp) => {
        expect(opp.hand).toBeUndefined();
        expect(opp.cardCount).toBe(13);
      });

      // Stock deck: count preserved, cards masked
      expect(sanitized.stockDeckCount).toBe(state.stockDeck.length);
      expect((sanitized as unknown as { stockDeck?: Card[] }).stockDeck).toBeUndefined();

      // Pukar pool: count preserved, card details masked
      expect(sanitized.pukarPoolCount).toBe(2);
      expect((sanitized as unknown as { pukarPool?: Card[][] }).pukarPool).toBeUndefined();

      // Discard pile & Melds: public and visible
      expect(sanitized.discardPile).toEqual(state.discardPile);
      expect(sanitized.melds).toEqual(state.melds);
    });
  });
});
