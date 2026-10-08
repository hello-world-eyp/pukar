import { describe, it, expect } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';
import { sanitizeStateForPlayer } from '../../src/engine/sanitizer';
import { GameState } from '../../src/engine/types';
import { playSound, setSoundEnabled, resetAudioContext } from '../../src/ui/sound';

describe('Security & Architecture Audit Test Suite', () => {
  describe('Card Duplication & Input Tampering Prevention', () => {
    it('rejects PLAY_NEW_MELD containing duplicate card IDs', () => {
      const state = dealInitialState(4);
      // Advance to MELD phase
      const { state: meldState } = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });
      const activePlayer = meldState.players[meldState.currentPlayerIndex];
      const singleCardId = activePlayer.hand[0].id;

      // Malicious attempt to forge a 3-card meld by duplicating 1 card ID
      const result = pukarReducer(meldState, {
        type: 'PLAY_NEW_MELD',
        cardIds: [singleCardId, singleCardId, singleCardId],
      });

      expect(result.error).toBe('Duplicate card IDs are not allowed');
      // Verify hand was not mutated
      expect(meldState.players[meldState.currentPlayerIndex].hand.length).toBe(
        activePlayer.hand.length
      );
    });

    it('rejects ADD_TO_MELD containing duplicate card IDs', () => {
      const state = dealInitialState(4);
      const { state: meldState } = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });
      const activePlayer = meldState.players[meldState.currentPlayerIndex];
      const singleCardId = activePlayer.hand[0].id;

      // Seed a meld on active team
      const team = activePlayer.team;
      const seededState: GameState = {
        ...meldState,
        melds: {
          ...meldState.melds,
          [team]: [
            {
              id: 'test-meld-1',
              team,
              type: 'SET',
              cards: [
                { id: 'm1', suit: 'SPADES', rank: 7 },
                { id: 'm2', suit: 'HEARTS', rank: 7 },
                { id: 'm3', suit: 'DIAMONDS', rank: 7 },
              ],
              slots: [
                { card: { id: 'm1', suit: 'SPADES', rank: 7 }, representedRank: 7, isWildcard: false },
                { card: { id: 'm2', suit: 'HEARTS', rank: 7 }, representedRank: 7, isWildcard: false },
                { card: { id: 'm3', suit: 'DIAMONDS', rank: 7 }, representedRank: 7, isWildcard: false },
              ],
            },
          ],
        },
      };

      const result = pukarReducer(seededState, {
        type: 'ADD_TO_MELD',
        meldId: 'test-meld-1',
        cardIds: [singleCardId, singleCardId],
      });

      expect(result.error).toBe('Duplicate card IDs are not allowed');
    });

    it('rejects melding cards not belonging to the active player', () => {
      const state = dealInitialState(4);
      const { state: meldState } = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });
      const opponentPlayer = meldState.players[(meldState.currentPlayerIndex + 1) % 4];
      const stolenCardIds = opponentPlayer.hand.slice(0, 3).map((c) => c.id);

      const result = pukarReducer(meldState, {
        type: 'PLAY_NEW_MELD',
        cardIds: stolenCardIds,
      });

      expect(result.error).toContain('Player hand does not contain card');
    });

    it('rejects discarding a card not present in the active player hand', () => {
      const state = dealInitialState(4);
      const { state: meldState } = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });

      const result = pukarReducer(meldState, {
        type: 'DISCARD_CARD',
        cardId: 'non-existent-card-id-xyz',
      });

      expect(result.error).toContain('is not in active player hand');
    });

    it('safely rejects discarding with an empty or non-string cardId', () => {
      const state = dealInitialState(4);
      const { state: meldState } = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });

      const result = pukarReducer(meldState, {
        type: 'DISCARD_CARD',
        cardId: '',
      });

      expect(result.error).toBe('Invalid or missing cardId to discard');
    });
  });

  describe('Architectural State Isolation & Sanitization', () => {
    it('deep-clones melds and cards so caller cannot mutate engine state', () => {
      const state = dealInitialState(4);
      state.melds.A = [
        {
          id: 'meld-A-1',
          team: 'A',
          type: 'SET',
          cards: [{ id: 'card-1', suit: 'SPADES', rank: 10 }],
          slots: [
            {
              card: { id: 'card-1', suit: 'SPADES', rank: 10 },
              representedRank: 10,
              isWildcard: false,
            },
          ],
        },
      ];

      const sanitized = sanitizeStateForPlayer(state, 'p1');

      // Attempt to mutate sanitized meld cards and slots
      sanitized.melds.A[0].cards.push({ id: 'injected-card', suit: 'HEARTS', rank: 10 });
      sanitized.melds.A[0].slots[0].representedRank = 999;

      // Original state must remain untouched
      expect(state.melds.A[0].cards.length).toBe(1);
      expect(state.melds.A[0].slots[0].representedRank).toBe(10);
    });

    it('deep-clones discard pile cards to prevent reference mutations', () => {
      const state = dealInitialState(4);
      const sanitized = sanitizeStateForPlayer(state, 'p1');

      if (sanitized.discardPile.length > 0) {
        const originalRank = state.discardPile[0].rank;
        sanitized.discardPile[0].rank = (originalRank + 1) as any;
        expect(state.discardPile[0].rank).toBe(originalRank);
      }
    });

    it('masks all opponent hands completely (undefined) across all perspectives', () => {
      const state = dealInitialState(4);
      const viewerId = state.players[0].id;
      const sanitized = sanitizeStateForPlayer(state, viewerId);

      expect(sanitized.players[0].hand).toBeDefined();
      expect(sanitized.players[0].hand?.length).toBe(13);

      for (let i = 1; i < 4; i++) {
        expect(sanitized.players[i].hand).toBeUndefined();
        expect(sanitized.players[i].cardCount).toBe(13);
      }
    });
  });

  describe('Engine Boundaries & Error Resilience', () => {
    it('rejects RESET_GAME with invalid playerCount without throwing', () => {
      const state = dealInitialState(4);
      const result = pukarReducer(state, {
        type: 'RESET_GAME',
        playerCount: 5 as any,
      });

      expect(result.error).toContain('Invalid player count: 5');
      // State remains preserved
      expect(result.state.playerCount).toBe(4);
    });

    it('rejects invalid or missing action objects without throwing', () => {
      const state = dealInitialState(4);
      const result1 = pukarReducer(state, null as any);
      expect(result1.error).toBe('Invalid or missing action');

      const result2 = pukarReducer(state, { type: 'UNKNOWN_ACTION' } as any);
      expect(result2.error).toContain('Unknown action type: UNKNOWN_ACTION');
    });

    it('prevents acting on an opponent meld in ADD_TO_MELD', () => {
      const state = dealInitialState(4);
      const { state: meldState } = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });
      const activePlayer = meldState.players[meldState.currentPlayerIndex];
      const opponentTeam = activePlayer.team === 'A' ? 'B' : 'A';

      const seededState: GameState = {
        ...meldState,
        melds: {
          ...meldState.melds,
          [opponentTeam]: [
            {
              id: 'opp-meld-1',
              team: opponentTeam,
              type: 'SET',
              cards: [
                { id: 'c1', suit: 'SPADES', rank: 5 },
                { id: 'c2', suit: 'HEARTS', rank: 5 },
                { id: 'c3', suit: 'DIAMONDS', rank: 5 },
              ],
              slots: [],
            },
          ],
        },
      };

      const result = pukarReducer(seededState, {
        type: 'ADD_TO_MELD',
        meldId: 'opp-meld-1',
        cardIds: [activePlayer.hand[0].id],
      });

      expect(result.error).toContain("Cannot add cards to opponent team's meld");
    });
  });

  describe('Audio Lifecycle & SSR Safety', () => {
    it('safely handles playSound without throwing even when AudioContext is uninitialized', () => {
      resetAudioContext();
      setSoundEnabled(true);

      expect(() => {
        playSound('draw');
        playSound('meld');
        playSound('discard');
        playSound('pukar');
        playSound('roundOver');
        playSound('error');
      }).not.toThrow();
    });
  });
});
