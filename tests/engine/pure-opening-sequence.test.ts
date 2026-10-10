import { describe, it, expect } from 'vitest';
import { Card, Suit, Rank } from '../../src/engine/types';
import { validateNewMeld, isPureRun } from '../../src/engine/meld-validator';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';

function makeCard(id: string, suit: Suit | null, rank: number, isNaturalJoker = false): Card {
  return {
    id,
    suit,
    rank: rank as Rank,
    isNaturalJoker,
    isJoker: isNaturalJoker || rank === 2,
  };
}

describe('Pure Opening Sequence Rule (Per Team)', () => {
  describe('isPureRun helper', () => {
    it('returns true for pure runs without wildcards', () => {
      const cards = [
        makeCard('4s', 'SPADES', 4),
        makeCard('5s', 'SPADES', 5),
        makeCard('6s', 'SPADES', 6),
      ];
      expect(isPureRun(cards)).toBe(true);
    });

    it('returns true for pure runs with suited 2 at natural rank 2 (A-2-3 and 2-3-4)', () => {
      const runA23 = [
        makeCard('as', 'SPADES', 14),
        makeCard('2s', 'SPADES', 2),
        makeCard('3s', 'SPADES', 3),
      ];
      expect(isPureRun(runA23)).toBe(true);

      const run234 = [
        makeCard('2h', 'HEARTS', 2),
        makeCard('3h', 'HEARTS', 3),
        makeCard('4h', 'HEARTS', 4),
      ];
      expect(isPureRun(run234)).toBe(true);
    });

    it('returns false for runs with Natural Jokers', () => {
      const cards = [
        makeCard('4s', 'SPADES', 4),
        makeCard('joker', null, 0, true),
        makeCard('6s', 'SPADES', 6),
      ];
      expect(isPureRun(cards)).toBe(false);
    });

    it('returns false for runs with 2 substituting for a missing rank', () => {
      const cards = [
        makeCard('3s', 'SPADES', 3),
        makeCard('2s', 'SPADES', 2),
        makeCard('5s', 'SPADES', 5),
      ];
      expect(isPureRun(cards)).toBe(false);
    });

    it('returns false for runs with off-suit 2', () => {
      const cards = [
        makeCard('2h', 'HEARTS', 2),
        makeCard('3s', 'SPADES', 3),
        makeCard('4s', 'SPADES', 4),
      ];
      expect(isPureRun(cards)).toBe(false);
    });
  });

  describe('validateNewMeld with requirePure: true', () => {
    it('approves pure run of natural cards', () => {
      const cards = [
        makeCard('7d', 'DIAMONDS', 7),
        makeCard('8d', 'DIAMONDS', 8),
        makeCard('9d', 'DIAMONDS', 9),
      ];
      const result = validateNewMeld(cards, undefined, { requirePure: true });
      expect(result.valid).toBe(true);
      expect(result.type).toBe('RUN');
      expect(result.isPure).toBe(true);
    });

    it('approves pure run with natural 2 in place', () => {
      const cards = [
        makeCard('ac', 'CLUBS', 14),
        makeCard('2c', 'CLUBS', 2),
        makeCard('3c', 'CLUBS', 3),
      ];
      const result = validateNewMeld(cards, undefined, { requirePure: true });
      expect(result.valid).toBe(true);
      expect(result.type).toBe('RUN');
      expect(result.isPure).toBe(true);
    });

    it('rejects sets with descriptive error when requirePure: true', () => {
      const cards = [
        makeCard('8s', 'SPADES', 8),
        makeCard('8h', 'HEARTS', 8),
        makeCard('8d', 'DIAMONDS', 8),
      ];
      const result = validateNewMeld(cards, undefined, { requirePure: true });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('First sequence on the board must be a pure sequence (sets are not allowed until a pure sequence is established)');
    });

    it('rejects Natural Joker in run when requirePure: true', () => {
      const cards = [
        makeCard('4s', 'SPADES', 4),
        makeCard('5s', 'SPADES', 5),
        makeCard('joker', null, 0, true),
      ];
      const result = validateNewMeld(cards, undefined, { requirePure: true });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('First sequence on the board must be pure: Natural Jokers are not allowed');
    });

    it('rejects card 2 acting as wildcard when requirePure: true', () => {
      const cards = [
        makeCard('3s', 'SPADES', 3),
        makeCard('2s', 'SPADES', 2),
        makeCard('5s', 'SPADES', 5),
      ];
      const result = validateNewMeld(cards, undefined, { requirePure: true });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("First sequence on the board must be pure: card '2' must be at its natural place (rank 2)");
    });
  });

  describe('Game Reducer Turn Enforcement', () => {
    it('enforces pure opening sequence per team on empty boards', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      state.turnPhase = 'MELD';

      // 1. Team A active player attempts to play a SET as opening meld -> REJECTED
      const setCard1 = makeCard('set-8s', 'SPADES', 8);
      const setCard2 = makeCard('set-8h', 'HEARTS', 8);
      const setCard3 = makeCard('set-8d', 'DIAMONDS', 8);
      const extraCard = makeCard('extra-k', 'CLUBS', 13);
      state.players[0].hand = [setCard1, setCard2, setCard3, extraCard];

      const setAttempt = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['set-8s', 'set-8h', 'set-8d'],
      });
      expect(setAttempt.error).toContain('First sequence on the board must be a pure sequence');
      expect(state.melds.A).toHaveLength(0);

      // 2. Team A active player attempts to play a dirty RUN as opening meld -> REJECTED
      const wild2 = makeCard('wild-2s', 'SPADES', 2);
      const natural4 = makeCard('nat-4s', 'SPADES', 4);
      const natural5 = makeCard('nat-5s', 'SPADES', 5);
      state.players[0].hand = [wild2, natural4, natural5, extraCard];

      const dirtyRunAttempt = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['wild-2s', 'nat-4s', 'nat-5s'],
      });
      expect(dirtyRunAttempt.error).toContain("First sequence on the board must be pure: card '2' must be at its natural place");
      expect(state.melds.A).toHaveLength(0);

      // 3. Team A plays a pure RUN with natural 2 -> SUCCEEDS
      const natural2 = makeCard('nat-2s', 'SPADES', 2);
      const natural3 = makeCard('nat-3s', 'SPADES', 3);
      state.players[0].hand = [natural2, natural3, natural4, extraCard];

      const pureRunResult = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['nat-2s', 'nat-3s', 'nat-4s'],
      });
      expect(pureRunResult.error).toBeUndefined();
      expect(pureRunResult.state.melds.A).toHaveLength(1);
      expect(pureRunResult.state.melds.A[0].isPure).toBe(true);

      // 4. Now Team A already has a pure sequence, so Team A can play subsequent sets and dirty runs
      const stateAfterTeamAPure = pureRunResult.state;
      stateAfterTeamAPure.players[0].hand = [setCard1, setCard2, setCard3, extraCard];

      const subsequentSetResult = pukarReducer(stateAfterTeamAPure, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['set-8s', 'set-8h', 'set-8d'],
      });
      expect(subsequentSetResult.error).toBeUndefined();
      expect(subsequentSetResult.state.melds.A).toHaveLength(2);

      // 5. Team B still has NO melds on the board, so Team B cannot play a set until they establish a pure sequence
      const stateForTeamB = {
        ...subsequentSetResult.state,
        currentPlayerIndex: 1, // Player 2 is on Team B
      };
      stateForTeamB.players[1].hand = [setCard1, setCard2, setCard3, extraCard];

      const teamBSetAttempt = pukarReducer(stateForTeamB, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['set-8s', 'set-8h', 'set-8d'],
      });
      expect(teamBSetAttempt.error).toContain('First sequence on the board must be a pure sequence');
      expect(stateForTeamB.melds.B).toHaveLength(0);
    });
  });
});
