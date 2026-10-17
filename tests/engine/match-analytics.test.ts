import { describe, it, expect } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';
import {
  createInitialMatchStats,
  calculateMatchMVP,
  getBiggestHeistAward,
  getChiefFeederAward,
} from '../../src/engine/match-analytics';
import { Card } from '../../src/engine/types';

describe('Match Analytics & Awards Engine', () => {
  it('initializes clean matchStats for 4-player game in dealInitialState', () => {
    const state = dealInitialState(4);
    expect(state.matchStats).toBeDefined();
    expect(Object.keys(state.matchStats!.playerStats)).toHaveLength(4);
    expect(state.matchStats!.playerStats[0]).toEqual({
      pointsContributed: 0,
      jokersStolen: 0,
      cardsFedToOpponents: 0,
      pukarsClaimed: 0,
      meldsCreated: 0,
    });
    expect(state.matchStats!.scoreTimeline).toEqual([
      { round: 0, scoreA: 0, scoreB: 0 },
    ]);
  });

  it('updates meldsCreated, pointsContributed, and longestSequence on PLAY_NEW_MELD', () => {
    const state = dealInitialState(4);
    state.phase = 'MELD';
    state.currentPlayerIndex = 0; // Team A

    // Give Player 1 a pure sequence 4♠-5♠-6♠-7♠
    const cards: Card[] = [
      { id: 's4', suit: 'SPADES', rank: 4 },
      { id: 's5', suit: 'SPADES', rank: 5 },
      { id: 's6', suit: 'SPADES', rank: 6 },
      { id: 's7', suit: 'SPADES', rank: 7 },
      { id: 'extra', suit: 'HEARTS', rank: 10 },
    ];
    state.players[0].hand = cards;

    const result = pukarReducer(state, {
      type: 'PLAY_NEW_MELD',
      cardIds: ['s4', 's5', 's6', 's7'],
    });

    expect(result.error).toBeUndefined();
    const nextStats = result.state.matchStats;
    expect(nextStats).toBeDefined();
    expect(nextStats!.playerStats[0].meldsCreated).toBe(1);
    expect(nextStats!.playerStats[0].pointsContributed).toBe(0); // Under 7 cards, sequence is worth 0 points
    expect(nextStats!.longestSequence).toBeDefined();
    expect(nextStats!.longestSequence!.cardCount).toBe(4);
    expect(nextStats!.longestSequence!.team).toBe('A');
  });

  it('records jokersStolen (Heist) on ADD_TO_MELD when replacing a Natural Joker', () => {
    const state = dealInitialState(4);
    state.phase = 'MELD';
    state.currentPlayerIndex = 0; // Team A

    // Existing run on table with a Natural Joker: 5♠ - Joker - 7♠
    const jokerCard: Card = { id: 'joker-1', suit: null, rank: 0, isNaturalJoker: true };
    const meldId = 'm1';
    state.melds.A = [
      {
        id: meldId,
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        isPure: false,
        isClean: false,
        cards: [
          { id: 's5', suit: 'SPADES', rank: 5 },
          jokerCard,
          { id: 's7', suit: 'SPADES', rank: 7 },
        ],
        slots: [
          { card: { id: 's5', suit: 'SPADES', rank: 5 }, representedRank: 5 },
          { card: jokerCard, representedRank: 6, isWildcard: true },
          { card: { id: 's7', suit: 'SPADES', rank: 7 }, representedRank: 7 },
        ],
      },
    ];

    // Player 0 holds the natural 6♠ and an extra discard card
    state.players[0].hand = [
      { id: 's6', suit: 'SPADES', rank: 6 },
      { id: 'extra', suit: 'DIAMONDS', rank: 9 },
    ];

    const result = pukarReducer(state, {
      type: 'ADD_TO_MELD',
      meldId,
      cardIds: ['s6'],
    });

    expect(result.error).toBeUndefined();
    const nextStats = result.state.matchStats;
    expect(nextStats!.playerStats[0].jokersStolen).toBe(1);
    // Player 0 picked up the Joker to hand
    expect(result.state.players[0].hand.some((c) => c.id === 'joker-1')).toBe(true);
  });

  it('increments cardsFedToOpponents on TAKE_DISCARD when previous discarder is opponent', () => {
    const state = dealInitialState(4);
    // Player 0 (Team A) discarded a card
    state.discardPile = [{ id: 's8', suit: 'SPADES', rank: 8 }];
    // Player 1 (Team B) is active in DRAW phase
    state.currentPlayerIndex = 1;
    state.phase = 'DRAW';

    const result = pukarReducer(state, { type: 'TAKE_DISCARD' });
    expect(result.error).toBeUndefined();

    const nextStats = result.state.matchStats;
    // Player 0 fed 1 card to Team B
    expect(nextStats!.playerStats[0].cardsFedToOpponents).toBe(1);
  });

  it('calculates Match MVP with winning team preference and awards Heist and Feeder records', () => {
    const stats = createInitialMatchStats(4);
    // Player 0 (Team A)
    stats.playerStats[0] = {
      pointsContributed: 200,
      jokersStolen: 2,
      cardsFedToOpponents: 0,
      pukarsClaimed: 1,
      meldsCreated: 2,
    };
    // Player 1 (Team B)
    stats.playerStats[1] = {
      pointsContributed: 50,
      jokersStolen: 0,
      cardsFedToOpponents: 3,
      pukarsClaimed: 0,
      meldsCreated: 1,
    };
    // Player 2 (Team A)
    stats.playerStats[2] = {
      pointsContributed: 100,
      jokersStolen: 0,
      cardsFedToOpponents: 1,
      pukarsClaimed: 0,
      meldsCreated: 1,
    };

    const players = [
      { id: 'p1', name: 'Sid', team: 'A' as const, cardCount: 5 },
      { id: 'p2', name: 'Heman', team: 'B' as const, cardCount: 5 },
      { id: 'p3', name: 'Harsh', team: 'A' as const, cardCount: 5 },
      { id: 'p4', name: 'Chachi', team: 'B' as const, cardCount: 5 },
    ];

    const mvp = calculateMatchMVP(stats, players, 'A');
    expect(mvp).toBeDefined();
    expect(mvp!.playerName).toBe('Sid');
    expect(mvp!.playerIndex).toBe(0);

    const heist = getBiggestHeistAward(stats, players);
    expect(heist).toBeDefined();
    expect(heist!.playerName).toBe('Sid');
    expect(heist!.jokersStolen).toBe(2);

    const feeder = getChiefFeederAward(stats, players);
    expect(feeder).toBeDefined();
    expect(feeder!.playerName).toBe('Heman');
    expect(feeder!.cardsFed).toBe(3);
  });

  it('START_NEXT_ROUND preserves matchStats and rotates starting player', () => {
    const state = dealInitialState(4);
    state.round = 1;
    state.roundStatus = 'ROUND_OVER';
    state.isRoundOver = true;
    state.matchStats!.scoreTimeline = [
      { round: 0, scoreA: 0, scoreB: 0 },
      { round: 1, scoreA: 200, scoreB: 50 },
    ];
    state.matchStats!.playerStats[0].meldsCreated = 2;

    const result = pukarReducer(state, { type: 'START_NEXT_ROUND' });
    expect(result.error).toBeUndefined();

    const nextState = result.state;
    expect(nextState.round).toBe(2);
    // Rotating starting player: Round 2 starts with Seat 1
    expect(nextState.currentPlayerIndex).toBe(1);
    // Preserved match stats
    expect(nextState.matchStats!.playerStats[0].meldsCreated).toBe(2);
    // Score timeline preserved without premature duplicate entry for round 2
    expect(nextState.matchStats!.scoreTimeline).toEqual([
      { round: 0, scoreA: 0, scoreB: 0 },
      { round: 1, scoreA: 200, scoreB: 50 },
    ]);
  });
});
