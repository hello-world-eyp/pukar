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
        makeCard('8c', 'CLUBS', 8),
        makeCard('8s2', 'SPADES', 8),
        makeCard('8h2', 'HEARTS', 8),
        makeCard('8d2', 'DIAMONDS', 8),
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
      const setCards = [
        makeCard('set-8s', 'SPADES', 8),
        makeCard('set-8h', 'HEARTS', 8),
        makeCard('set-8d', 'DIAMONDS', 8),
        makeCard('set-8c', 'CLUBS', 8),
        makeCard('set-8s2', 'SPADES', 8),
        makeCard('set-8h2', 'HEARTS', 8),
        makeCard('set-8d2', 'DIAMONDS', 8),
      ];
      const setCardIds = setCards.map((c) => c.id);
      const extraCard = makeCard('extra-k', 'CLUBS', 13);
      state.players[0].hand = [...setCards, extraCard];

      const setAttempt = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: setCardIds,
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
      stateAfterTeamAPure.players[0].hand = [...setCards, extraCard];

      const subsequentSetResult = pukarReducer(stateAfterTeamAPure, {
        type: 'PLAY_NEW_MELD',
        cardIds: setCardIds,
      });
      expect(subsequentSetResult.error).toBeUndefined();
      expect(subsequentSetResult.state.melds.A).toHaveLength(2);

      // 5. Team A having established a pure sequence does NOT open Team B!
      // Each team needs to have a pure sequence first before they can open.
      const stateForTeamB = {
        ...subsequentSetResult.state,
        currentPlayerIndex: 1, // Player 2 is on Team B
      };
      stateForTeamB.players[1].hand = [...setCards, extraCard];

      // Team B attempts to play a set as Team B's opening meld -> REJECTED!
      const teamBSetAttempt = pukarReducer(stateForTeamB, {
        type: 'PLAY_NEW_MELD',
        cardIds: setCardIds,
      });
      expect(teamBSetAttempt.error).toContain('First sequence on the board must be a pure sequence');
      expect(teamBSetAttempt.state.melds.B).toHaveLength(0);

      // Team B attempts to play a dirty sequence with a Joker as Team B's opening meld -> REJECTED!
      const dirtyRunCards = [
        makeCard('b-5s', 'SPADES', 5),
        makeCard('b-joker', null, 0, true),
        makeCard('b-7s', 'SPADES', 7),
        makeCard('b-8s', 'SPADES', 8),
      ];
      stateForTeamB.players[1].hand = [...dirtyRunCards, extraCard];
      const teamBDirtyRunAttempt = pukarReducer(stateForTeamB, {
        type: 'PLAY_NEW_MELD',
        cardIds: dirtyRunCards.map((c) => c.id),
      });
      expect(teamBDirtyRunAttempt.error).toContain('First sequence on the board must be pure: Natural Jokers are not allowed');
      expect(teamBDirtyRunAttempt.state.melds.B).toHaveLength(0);

      // Team B attempts to play 2-2-4 (2s where one is a Joker) as Team B's opening meld -> REJECTED!
      const twoTwoFourCards = [
        makeCard('b-2h1', 'HEARTS', 2),
        makeCard('b-2h2', 'HEARTS', 2),
        makeCard('b-4h', 'HEARTS', 4),
      ];
      stateForTeamB.players[1].hand = [...twoTwoFourCards, extraCard];
      const teamBTwoTwoFourAttempt = pukarReducer(stateForTeamB, {
        type: 'PLAY_NEW_MELD',
        cardIds: twoTwoFourCards.map((c) => c.id),
      });
      expect(teamBTwoTwoFourAttempt.error).toContain("First sequence on the board must be pure: card '2' must be at its natural place");
      expect(teamBTwoTwoFourAttempt.state.melds.B).toHaveLength(0);

      // Team B plays a pure sequence (7♣, 8♣, 9♣) -> SUCCEEDS!
      const pureRunCards = [
        makeCard('b-7c', 'CLUBS', 7),
        makeCard('b-8c', 'CLUBS', 8),
        makeCard('b-9c', 'CLUBS', 9),
      ];
      stateForTeamB.players[1].hand = [...pureRunCards, extraCard];
      const teamBPureAttempt = pukarReducer(stateForTeamB, {
        type: 'PLAY_NEW_MELD',
        cardIds: pureRunCards.map((c) => c.id),
      });
      expect(teamBPureAttempt.error).toBeUndefined();
      expect(teamBPureAttempt.state.melds.B).toHaveLength(1);
      expect(teamBPureAttempt.state.melds.B[0].isPure).toBe(true);

      // NOW that Team B has established a pure sequence, Team B can play subsequent dirty runs and sets!
      const stateAfterTeamBPure = teamBPureAttempt.state;
      stateAfterTeamBPure.players[1].hand = [...dirtyRunCards, extraCard];
      const teamBSubsequentDirty = pukarReducer(stateAfterTeamBPure, {
        type: 'PLAY_NEW_MELD',
        cardIds: dirtyRunCards.map((c) => c.id),
      });
      expect(teamBSubsequentDirty.error).toBeUndefined();
      expect(teamBSubsequentDirty.state.melds.B).toHaveLength(2);
    });

    it('allows playing dirty sequences (e.g. 5, 4, and 2) when a pure sequence was established even if existing melds became dirty from wildcard additions', () => {
      const state = dealInitialState(4);
      state.phase = 'MELD';
      state.turnPhase = 'MELD';

      // 1. Team A active player establishes opening pure sequence (8♠-9♠-10♠-11♠)
      const pure8s = makeCard('p0-8s', 'SPADES', 8);
      const pure9s = makeCard('p0-9s', 'SPADES', 9);
      const pure10s = makeCard('p0-10s', 'SPADES', 10);
      const pure11s = makeCard('p0-11s', 'SPADES', 11);
      const wild2s = makeCard('p0-2s', 'SPADES', 2);
      const dirty5s = makeCard('p0-5s', 'SPADES', 5);
      const dirty4s = makeCard('p0-4s', 'SPADES', 4);
      const wild2h = makeCard('p0-2h', 'HEARTS', 2);
      const discardCard = makeCard('p0-3c', 'CLUBS', 3);

      state.players[0].hand = [
        pure8s,
        pure9s,
        pure10s,
        pure11s,
        wild2s,
        dirty5s,
        dirty4s,
        wild2h,
        discardCard,
      ];

      // Play the pure sequence
      const openResult = pukarReducer(state, {
        type: 'PLAY_NEW_MELD',
        cardIds: [pure8s.id, pure9s.id, pure10s.id, pure11s.id],
      });
      expect(openResult.error).toBeUndefined();
      const meldId = openResult.state.melds.A[0].id;
      expect(openResult.state.melds.A[0].isPure).toBe(true);

      // 2. Add wildcard 2♠ to that pure sequence, making it dirty (isPure = false)
      const addWildResult = pukarReducer(openResult.state, {
        type: 'ADD_TO_MELD',
        meldId,
        cardIds: [wild2s.id],
      });
      expect(addWildResult.error).toBeUndefined();
      // Notice: The meld itself is now dirty!
      expect(addWildResult.state.melds.A[0].isPure).toBe(false);
      // And ALL of Team A's table melds are now impure:
      expect(addWildResult.state.melds.A.every((m) => !m.isPure)).toBe(true);

      // 3. Now player attempts to play 5♠, 4♠, and 2♥ (representing 3♠ or 6♠) as a new dirty sequence
      const playDirtyMeldResult = pukarReducer(addWildResult.state, {
        type: 'PLAY_NEW_MELD',
        cardIds: [dirty5s.id, dirty4s.id, wild2h.id],
        jokerRepresentedRank: 3,
      });

      // MUST SUCCEED because Team A has already opened in this round!
      expect(playDirtyMeldResult.error).toBeUndefined();
      expect(playDirtyMeldResult.state.melds.A).toHaveLength(2);
      expect(playDirtyMeldResult.state.melds.A[1].type).toBe('RUN');
      expect(playDirtyMeldResult.state.melds.A[1].isPure).toBe(false);
    });

    it('allows player p1 to play 5♠, 4♠, and 2♥ on liveState from user debug log where all team melds on table are impure', () => {
      const debugState: any = {
        playerCount: 4,
        players: [
          {
            id: 'p1',
            name: 'You',
            team: 'A',
            hand: [
              { id: 'deck-1-SPADES-5', suit: 'SPADES', rank: 5, isNaturalJoker: false, isJoker: false },
              { id: 'deck-1-SPADES-4', suit: 'SPADES', rank: 4, isNaturalJoker: false, isJoker: false },
              { id: 'deck-0-CLUBS-3', suit: 'CLUBS', rank: 3, isNaturalJoker: false, isJoker: false },
              { id: 'deck-1-HEARTS-2', suit: 'HEARTS', rank: 2, isNaturalJoker: false, isJoker: false },
            ],
          },
          { id: 'p2', name: 'Chachi', team: 'B', hand: [] },
          { id: 'p3', name: 'Sid', team: 'A', hand: [] },
          { id: 'p4', name: 'Cheetah', team: 'B', hand: [] },
        ],
        currentPlayerIndex: 0,
        phase: 'MELD',
        turnPhase: 'MELD',
        stockDeck: [],
        discardPile: [],
        pukarPool: [],
        melds: {
          A: [
            { id: 'meld-r2-A-1', team: 'A', type: 'RUN', cards: [], isPure: false },
            { id: 'meld-r2-A-2', team: 'A', type: 'RUN', cards: [], isPure: false },
            { id: 'meld-r2-A-3', team: 'A', type: 'RUN', cards: [], isPure: false },
            { id: 'meld-r2-A-4', team: 'A', type: 'RUN', cards: [], isPure: false },
            { id: 'meld-r2-A-5', team: 'A', type: 'RUN', cards: [], isPure: false },
          ],
          B: [],
        },
        scores: { A: 100, B: 0 },
        round: 2,
        roundStatus: 'PLAYING',
      };

      const result = pukarReducer(debugState, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['deck-1-SPADES-5', 'deck-1-SPADES-4', 'deck-1-HEARTS-2'],
        jokerRepresentedRank: 3,
      });

      expect(result.error).toBeUndefined();
      expect(result.state.melds.A).toHaveLength(6);
      expect(result.state.melds.A[5].cards.map((c: any) => c.id)).toEqual([
        'deck-1-SPADES-5',
        'deck-1-SPADES-4',
        'deck-1-HEARTS-2',
      ]);
    });
  });
});

