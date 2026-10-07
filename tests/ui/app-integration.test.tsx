import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '../../src/App';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';
import { Card } from '../../src/engine/types';
import { DevInspector } from '../../src/ui/components/DevInspector';

function makeCard(id: string, suit: Card['suit'], rank: Card['rank']): Card {
  return {
    id,
    suit,
    rank,
    isNaturalJoker: rank === 0,
    isJoker: rank === 0,
  };
}

describe('Pukar Card Game - End-to-End Application Integration', () => {
  /* ========================================================================
   * 1. Application Mounting & UI Structure
   * ======================================================================== */
  describe('Application Mount & Initial Layout', () => {
    it('renders the complete application shell without crashing', () => {
      const html = renderToString(<App />);

      // App Container
      expect(html).toContain('data-testid="pukar-app"');

      // Header branding
      expect(html).toContain('PUKAR');
      expect(html).toContain('Royal Rummy');
      expect(html).toContain('Round 1');

      // Quick Controls in Header
      expect(html).toContain('data-testid="btn-toggle-4p"');
      expect(html).toContain('data-testid="btn-toggle-6p"');
      expect(html).toContain('data-testid="btn-sound-toggle"');
      expect(html).toContain('data-testid="btn-rules-modal"');
      expect(html).toContain('data-testid="btn-restart-game"');

      // ScoreBoard
      expect(html).toContain('Team A');
      expect(html).toContain('Team B');
      expect(html).toContain('Player 1');
      expect(html).toContain('DRAW');

      // Table Arena & Decks
      expect(html).toContain('The Bottom');
      expect(html).toContain('Stock Deck');
      expect(html).toContain('Pukar Pool');

      // Hot-Seat Dev Inspector
      expect(html).toContain('Dev Inspector');
      expect(html).toContain('data-testid="switcher-p1"');
      expect(html).toContain('data-testid="switcher-p2"');
      expect(html).toContain('data-testid="switcher-p3"');
      expect(html).toContain('data-testid="switcher-p4"');
      expect(html).toContain('data-testid="btn-force-turn"');
      expect(html).toContain('data-testid="btn-toggle-godmode"');
    });

    it('deals exactly 13 cards to all 4 players and 2 Pukar decks in pool', () => {
      const initialState = dealInitialState(4);
      expect(initialState.players).toHaveLength(4);
      initialState.players.forEach((p) => {
        expect(p.hand).toHaveLength(13);
      });
      expect(initialState.pukarPool).toHaveLength(2);
      initialState.pukarPool.forEach((pukar) => {
        expect(pukar).toHaveLength(13);
      });
      // 2 decks * 55 cards (52 standard + 3 jokers) = 110 cards total
      // 4 * 13 (players) + 2 * 13 (pukars) + 1 (initial discard) = 52 + 26 + 1 = 79 cards dealt
      // Stock deck = 110 - 79 = 31 cards
      expect(initialState.stockDeck).toHaveLength(31);
      expect(initialState.discardPile).toHaveLength(1);
    });
  });

  /* ========================================================================
   * 2. Full Turn Loop: Draw -> Meld -> Discard -> Turn Advance
   * ======================================================================== */
  describe('Full Play Loop Lifecycle', () => {
    it('executes a complete turn: draw from stock, meld 3-card run, and discard to advance turn', () => {
      let state = dealInitialState(4);
      expect(state.phase).toBe('DRAW');
      expect(state.currentPlayerIndex).toBe(0);

      // 1. Draw from stock
      const drawResult = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });
      expect(drawResult.error).toBeUndefined();
      state = drawResult.state;
      expect(state.phase).toBe('MELD');
      expect(state.players[0].hand).toHaveLength(14); // 13 + 1 drawn

      // 2. Give Player 1 a valid run to meld (7♠, 8♠, 9♠)
      const run7 = makeCard('p1-s7', 'SPADES', 7);
      const run8 = makeCard('p1-s8', 'SPADES', 8);
      const run9 = makeCard('p1-s9', 'SPADES', 9);
      state.players[0].hand.push(run7, run8, run9);

      const meldResult = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['p1-s7', 'p1-s8', 'p1-s9'],
      });
      expect(meldResult.error).toBeUndefined();
      state = meldResult.state;
      expect(state.melds.A).toHaveLength(1);
      expect(state.melds.A[0].type).toBe('RUN');
      expect(state.melds.A[0].suit).toBe('SPADES');
      expect(state.melds.A[0].cards).toHaveLength(3);
      expect(state.melds.A[0].points).toBe(0); // Incomplete melds (<7 cards) have 0 pts until 7+ cards
      expect(state.phase).toBe('MELD'); // stays in MELD phase until discard

      // 3. Discard 1 card to bottom
      const discardCard = state.players[0].hand[0];
      const discardResult = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: discardCard.id,
      });
      expect(discardResult.error).toBeUndefined();
      state = discardResult.state;

      // 4. Verify turn transitioned to Player 2 (Team B) in DRAW phase
      expect(state.currentPlayerIndex).toBe(1);
      expect(state.players[1].name).toBe('Player 2');
      expect(state.players[1].team).toBe('B');
      expect(state.phase).toBe('DRAW');
      expect(state.discardPile[state.discardPile.length - 1].id).toBe(discardCard.id);
    });

    it('allows Player 2 to draw all cards from discard pile (The Bottom)', () => {
      let state = dealInitialState(4);
      // Give discard pile 3 known cards
      state.discardPile = [
        makeCard('disc-1', 'HEARTS', 5),
        makeCard('disc-2', 'DIAMONDS', 8),
        makeCard('disc-3', 'CLUBS', 12),
      ];
      const initialP1HandCount = state.players[0].hand.length;

      // Draw from discard
      const takeResult = pukarReducer(state, { type: 'TAKE_DISCARD' });
      expect(takeResult.error).toBeUndefined();
      state = takeResult.state;

      expect(state.phase).toBe('MELD');
      expect(state.discardPile).toHaveLength(0);
      expect(state.players[0].hand).toHaveLength(initialP1HandCount + 3);
      expect(state.players[0].hand.some((c) => c.id === 'disc-1')).toBe(true);
      expect(state.players[0].hand.some((c) => c.id === 'disc-2')).toBe(true);
      expect(state.players[0].hand.some((c) => c.id === 'disc-3')).toBe(true);
    });

    it('allows adding cards to an existing team meld on the board', () => {
      let state = dealInitialState(4);
      // Create existing meld on Team A board: 7♠, 8♠, 9♠
      state.melds.A = [
        {
          id: 'meld-A-1',
          team: 'A',
          type: 'RUN',
          suit: 'SPADES',
          cards: [
            makeCard('s7', 'SPADES', 7),
            makeCard('s8', 'SPADES', 8),
            makeCard('s9', 'SPADES', 9),
          ],
          slots: [
            { card: makeCard('s7', 'SPADES', 7), representedRank: 7, representedSuit: 'SPADES' },
            { card: makeCard('s8', 'SPADES', 8), representedRank: 8, representedSuit: 'SPADES' },
            { card: makeCard('s9', 'SPADES', 9), representedRank: 9, representedSuit: 'SPADES' },
          ],
          points: 24,
        },
      ];

      // Give Player 1 (Team A) the 10♠ and advance to MELD phase
      const spade10 = makeCard('s10', 'SPADES', 10);
      state.players[0].hand.push(spade10);
      state.phase = 'MELD';

      // Add 10♠ to meld-A-1
      const addResult = pukarReducer(state, {
        type: 'ADD_TO_MELD',
        meldId: 'meld-A-1',
        cardIds: ['s10'],
      });
      expect(addResult.error).toBeUndefined();
      state = addResult.state;

      expect(state.melds.A[0].cards).toHaveLength(4);
      expect(state.melds.A[0].cards.some((c) => c.id === 's10')).toBe(true);
      expect(state.players[0].hand.some((c) => c.id === 's10')).toBe(false);
    });
  });

  /* ========================================================================
   * 3. Pukar Claim (+50 pts) Flow
   * ======================================================================== */
  describe('Pukar Claim Flow', () => {
    it('claims a 13-card Pukar deck and awards +50 pts when player empties hand during MELD', () => {
      let state = dealInitialState(4);
      expect(state.pukarPool).toHaveLength(2);
      expect(state.pukarsClaimed?.A ?? 0).toBe(0);

      // Set Player 1's hand to exactly 3 cards that form a valid set
      const c1 = makeCard('h5-1', 'HEARTS', 5);
      const c2 = makeCard('d5-1', 'DIAMONDS', 5);
      const c3 = makeCard('s5-1', 'SPADES', 5);
      state.players[0].hand = [c1, c2, c3];
      state.phase = 'MELD';

      // Melding all 3 cards empties hand
      const meldResult = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['h5-1', 'd5-1', 's5-1'],
      });
      expect(meldResult.error).toBeUndefined();
      state = meldResult.state;

      // Player 1 claims 1st Pukar deck (13 cards) into hand
      expect(state.players[0].hand).toHaveLength(13);
      expect(state.pukarPool).toHaveLength(1);
      expect(state.pukarsClaimed?.A).toBe(1);
      expect(state.scores.A).toBe(50);
      expect(state.roundScores?.A).toBe(50);
      // Turn continues in MELD phase!
      expect(state.phase).toBe('MELD');
      expect(state.roundStatus).toBe('PLAYING');
    });

    it('claims a Pukar deck upon discard when hand reaches 0', () => {
      let state = dealInitialState(4);
      // Give Player 1 exactly 1 card
      const soloCard = makeCard('solo-1', 'CLUBS', 4);
      state.players[0].hand = [soloCard];
      state.phase = 'MELD';

      const discardResult = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: 'solo-1',
      });
      expect(discardResult.error).toBeUndefined();
      state = discardResult.state;

      // Hand is refilled with 13 cards from Pukar for next turn
      expect(state.players[0].hand).toHaveLength(13);
      expect(state.pukarPool).toHaveLength(1);
      expect(state.pukarsClaimed?.A).toBe(1);
      expect(state.scores.A).toBe(50);
      // Turn advances to Player 2
      expect(state.currentPlayerIndex).toBe(1);
      expect(state.phase).toBe('DRAW');
    });
  });

  /* ========================================================================
   * 4. Stock Deck Exhaustion & Final Turn Handling
   * ======================================================================== */
  describe('Stock Deck Exhaustion', () => {
    it('replenishes stock deck from Pukar pool when stock becomes empty during draw', () => {
      let state = dealInitialState(4);
      // Force stock deck to have exactly 1 card remaining, and 2 Pukars in pool
      const lastStockCard = makeCard('last-stock', 'HEARTS', 10);
      state.stockDeck = [lastStockCard];
      expect(state.pukarPool).toHaveLength(2);

      const drawResult = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });
      expect(drawResult.error).toBeUndefined();
      state = drawResult.state;

      // Player received the last card
      expect(state.players[0].hand.some((c) => c.id === 'last-stock')).toBe(true);
      // 1 Pukar was popped to become new Stock deck (13 cards)
      expect(state.stockDeck).toHaveLength(13);
      expect(state.pukarPool).toHaveLength(1);
      expect(state.lastTurnTriggeredByDeckExhaust).toBeFalsy();
    });

    it('triggers final turn when stock deck exhausts with 0 Pukars in pool', () => {
      let state = dealInitialState(4);
      // Force stock to 1 card, 0 Pukars in pool
      state.stockDeck = [makeCard('last-card', 'SPADES', 3)];
      state.pukarPool = [];

      const drawResult = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });
      expect(drawResult.error).toBeUndefined();
      state = drawResult.state;

      expect(state.stockDeck).toHaveLength(0);
      expect(state.pukarPool).toHaveLength(0);
      expect(state.lastTurnTriggeredByDeckExhaust).toBe(true);

      // Player discards to end turn
      const discCard = state.players[0].hand[0];
      const discardResult = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: discCard.id,
      });
      state = discardResult.state;

      // Status should become FINAL_TURN for Player 2
      expect(state.roundStatus).toBe('FINAL_TURN');
      expect(state.finalTurnPlayerIndex).toBe(1);
      expect(state.currentPlayerIndex).toBe(1);

      // When Player 2 completes their final turn, round concludes
      state.phase = 'MELD'; // simulated draw
      const p2Disc = state.players[1].hand[0];
      const p2DiscardResult = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: p2Disc.id,
      });
      state = p2DiscardResult.state;

      expect(state.roundStatus).toBe('ROUND_OVER');
      expect(state.isRoundOver).toBe(true);
    });
  });

  /* ========================================================================
   * 5. Round End, Modal & Multi-Round Score Preservation
   * ======================================================================== */
  describe('Round End & Multi-Round Scoring', () => {
    it('triggers ROUND_OVER when player empties hand with 0 Pukars remaining', () => {
      let state = dealInitialState(4);
      state.pukarPool = []; // pool exhausted
      const soloCard = makeCard('last-hand-card', 'DIAMONDS', 9);
      state.players[0].hand = [soloCard];
      state.phase = 'MELD';

      const discardResult = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: 'last-hand-card',
      });
      expect(discardResult.error).toBeUndefined();
      state = discardResult.state;

      expect(state.roundStatus).toBe('ROUND_OVER');
      expect(state.isRoundOver).toBe(true);
      expect(state.players[0].hand).toHaveLength(0);
    });

    it('advances to Round 2 with START_NEXT_ROUND while preserving cumulative totals', () => {
      let state = dealInitialState(4);
      // Simulate Round 1 finished with scores
      state.roundStatus = 'ROUND_OVER';
      state.isRoundOver = true;
      state.round = 1;
      state.scores = { A: 120, B: 85 };
      state.totalScores = { A: 120, B: 85 };
      state.roundScores = { A: 120, B: 85 };

      const nextRoundResult = pukarReducer(state, { type: 'START_NEXT_ROUND' });
      expect(nextRoundResult.error).toBeUndefined();
      state = nextRoundResult.state;

      // Round 2 started
      expect(state.round).toBe(2);
      expect(state.roundStatus).toBe('PLAYING');
      expect(state.isRoundOver).toBe(false);
      expect(state.phase).toBe('DRAW');
      // Round scores reset to 0
      expect(state.roundScores).toEqual({ A: 0, B: 0 });
      // Total scores preserved from Round 1
      expect(state.totalScores).toEqual({ A: 120, B: 85 });
      expect(state.scores).toEqual({ A: 120, B: 85 });
      // All players dealt fresh 13 cards
      state.players.forEach((p) => {
        expect(p.hand).toHaveLength(13);
      });
      // 2 Pukars in pool
      expect(state.pukarPool).toHaveLength(2);
    });
  });

  /* ========================================================================
   * 6. Hot-Seat & Dev Inspector Integration
   * ======================================================================== */
  describe('Hot-Seat Perspective & Dev Inspector', () => {
    it('renders hot-seat switcher buttons and God Mode panel', () => {
      const state = dealInitialState(4);
      const html = renderToString(
        <DevInspector
          players={state.players}
          currentPlayerIndex={0}
          onSwitchPlayer={() => {}}
          stockDeckCount={state.stockDeck.length}
          discardPileCount={state.discardPile.length}
          pukarPoolCount={state.pukarPool.length}
          isGodModeOpen={true}
        />
      );

      // Switcher tabs for 4 players
      expect(html).toContain('data-testid="switcher-p1"');
      expect(html).toContain('data-testid="switcher-p2"');
      expect(html).toContain('data-testid="switcher-p3"');
      expect(html).toContain('data-testid="switcher-p4"');

      // God Mode panel
      expect(html).toContain('data-testid="godmode-panel"');
      expect(html).toContain('data-testid="godmode-player-1"');
      expect(html).toContain('data-testid="godmode-player-2"');
      expect(html).toContain('data-testid="godmode-player-3"');
      expect(html).toContain('data-testid="godmode-player-4"');
    });

    it('supports 6-player mode dealing 6 players and 3 decks', () => {
      const state6 = dealInitialState(6);
      expect(state6.playerCount).toBe(6);
      expect(state6.players).toHaveLength(6);
      // Teams alternate: A, B, A, B, A, B
      expect(state6.players[0].team).toBe('A');
      expect(state6.players[1].team).toBe('B');
      expect(state6.players[2].team).toBe('A');
      expect(state6.players[3].team).toBe('B');
      expect(state6.players[4].team).toBe('A');
      expect(state6.players[5].team).toBe('B');
      // Each player has 13 cards
      state6.players.forEach((p) => {
        expect(p.hand).toHaveLength(13);
      });
      // 3 Pukars for 6 players
      expect(state6.pukarPool).toHaveLength(3);

      const html = renderToString(
        <DevInspector
          players={state6.players}
          currentPlayerIndex={2}
          onSwitchPlayer={() => {}}
        />
      );
      expect(html).toContain('data-testid="switcher-p5"');
      expect(html).toContain('data-testid="switcher-p6"');
    });
  });

  /* ========================================================================
   * 7. Validation & Error Handling
   * ======================================================================== */
  describe('Move Validation & Error Handling', () => {
    it('rejects an invalid meld with fewer than 3 cards', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      const c1 = state.players[0].hand[0].id;
      const c2 = state.players[0].hand[1].id;

      const result = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: [c1, c2],
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('at least 3 cards');
      // State is untouched
      expect(result.state).toBe(state);
    });

    it('rejects discard during DRAW phase', () => {
      const state = dealInitialState(4);
      expect(state.phase).toBe('DRAW');
      const c1 = state.players[0].hand[0].id;

      const result = pukarReducer(state, {
        type: 'DISCARD_CARD',
        cardId: c1,
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Cannot discard during DRAW phase');
    });

    it('rejects adding cards to opponent team meld', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      // Opponent Team B meld
      state.melds.B = [
        {
          id: 'meld-B-1',
          team: 'B',
          type: 'RUN',
          suit: 'CLUBS',
          cards: [],
          slots: [],
        },
      ];

      const result = pukarReducer(state, {
        type: 'ADD_TO_MELD',
        meldId: 'meld-B-1',
        cardIds: [state.players[0].hand[0].id],
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain("opponent team's meld");
    });
  });
});
