import { describe, it, expect } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import {
  validateNewMeld,
  validateNewRun,
  validateNewSet,
  canAddCardsToMeld,
  evaluateMeldScore,
} from '../../src/engine/meld-validator';
import { sanitizeStateForPlayer } from '../../src/engine/sanitizer';
import { dealInitialState } from '../../src/engine/deck';
import { GameAction, Meld } from '../../src/engine/types';

describe('Engine Error Handling & Defensive Try-Catch Protection', () => {
  const normalState = dealInitialState(4);

  describe('pukarReducer error resilience', () => {
    it('returns error object instead of throwing when given unknown action', () => {
      const badAction = { type: 'INVALID_NONEXISTENT_ACTION' } as unknown as GameAction;
      const result = pukarReducer(normalState, badAction);
      expect(result.error).toBeDefined();
      expect(result.state).toBe(normalState);
    });

    it('handles null or missing action gracefully', () => {
      const result = pukarReducer(normalState, null as unknown as GameAction);
      expect(result.error).toBeDefined();
      expect(result.state).toBe(normalState);
    });

    it('handles corrupted state without unhandled exceptions', () => {
      const corruptedState = {} as any;
      const action: GameAction = { type: 'DRAW_FROM_STOCK' };
      const result = pukarReducer(corruptedState, action);
      expect(result.error).toBeDefined();
    });
  });

  describe('meld-validator error resilience', () => {
    it('validateNewRun handles null, empty, or corrupted cards safely', () => {
      expect(validateNewRun(null as any).valid).toBe(false);
      expect(validateNewRun([]).valid).toBe(false);
      expect(validateNewRun([null, undefined, {}] as any).valid).toBe(false);
    });

    it('validateNewSet handles null or corrupted cards safely', () => {
      expect(validateNewSet(null as any).valid).toBe(false);
      expect(validateNewSet([]).valid).toBe(false);
      expect(validateNewSet([null, undefined] as any).valid).toBe(false);
    });

    it('validateNewMeld handles null or corrupted inputs safely', () => {
      expect(validateNewMeld(null as any).valid).toBe(false);
      expect(validateNewMeld([null] as any).valid).toBe(false);
    });

    it('canAddCardsToMeld handles null meld or null cardsToAdd safely', () => {
      expect(canAddCardsToMeld(null as any, []).valid).toBe(false);
      expect(canAddCardsToMeld({} as any, null as any).valid).toBe(false);
    });

    it('evaluateMeldScore returns safe fallback on null or corrupted meld', () => {
      const res = evaluateMeldScore(null as any);
      expect(res.points).toBe(0);
      expect(res.isComplete7).toBe(false);

      const res2 = evaluateMeldScore({ cards: null } as unknown as Meld);
      expect(res2.points).toBe(0);
    });
  });

  describe('sanitizer error resilience', () => {
    it('sanitizeStateForPlayer handles null or missing state safely', () => {
      const res = sanitizeStateForPlayer(null as any, 'p1');
      expect(res).toBeDefined();
      expect(res.players).toEqual([]);
      expect(res.roundStatus).toBe('PLAYING');
    });

    it('sanitizeStateForPlayer handles state with missing players array', () => {
      const partialState = { ...normalState, players: undefined as any };
      const res = sanitizeStateForPlayer(partialState, 'p1');
      expect(res).toBeDefined();
      expect(res.players).toEqual([]);
    });
  });
});
