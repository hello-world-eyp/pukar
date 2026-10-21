import { describe, it, expect } from 'vitest';
import { createInitialBotMemory } from '../../../src/engine/bots/bot-player';
import { Card, GameState, Meld, Rank } from '../../../src/engine/types';
import { decideSmartChachaTurn, predictOpponentWants } from '../../../src/engine/bots/strategies/smart-chacha';

function makeCard(id: string, suit: Card['suit'], rank: Rank, isJoker = false): Card {
  return {
    id,
    suit,
    rank,
    isNaturalJoker: isJoker,
    isJoker,
  };
}

describe('Discard Pickup Optimization & Incidents (Game 1 & Game 2 Scenarios)', () => {
  it('Scenario 1 (Game 1 Step 85): Sid picks up 10♠ to replace table Joker and retrieve +100 Joker', () => {
    const memory = createInitialBotMemory();
    const tableJoker = makeCard('joker-1', null, 0, true);

    const meldWithJoker: Meld = {
      id: 'meld-teamA-spades',
      team: 'A',
      type: 'RUN',
      suit: 'SPADES',
      cards: [
        makeCard('s9', 'SPADES', 9),
        tableJoker,
        makeCard('s11', 'SPADES', 11),
      ],
      slots: [
        { card: makeCard('s9', 'SPADES', 9), representedRank: 9, representedSuit: 'SPADES', isWildcard: false },
        { card: tableJoker, representedRank: 10, representedSuit: 'SPADES', isWildcard: true },
        { card: makeCard('s11', 'SPADES', 11), representedRank: 11, representedSuit: 'SPADES', isWildcard: false },
      ],
      isClean: false,
      isPure: false,
      isPure13: false,
      points: 0,
    };

    const state: any = {
      round: 1,
      phase: 'DRAW',
      turnPhase: 'DRAW',
      playerCount: 4,
      currentPlayerIndex: 2,
      players: [
        { id: 'p0', name: 'You', team: 'A', hand: [] },
        { id: 'p1', name: 'Chachi', team: 'B', hand: [] },
        {
          id: 'p2',
          name: 'Sid',
          team: 'A',
          hand: [
            makeCard('c4a', 'CLUBS', 4),
            makeCard('d5', 'DIAMONDS', 5),
            makeCard('d4', 'DIAMONDS', 4),
            makeCard('c4b', 'CLUBS', 4),
            makeCard('d10', 'DIAMONDS', 10),
            makeCard('s3', 'SPADES', 3),
          ],
        },
        { id: 'p3', name: 'Harsh', team: 'B', hand: [] },
      ],
      melds: {
        A: [meldWithJoker],
        B: [],
      },
      discardPile: [makeCard('s10', 'SPADES', 10)],
      stockDeck: [makeCard('stock1', 'CLUBS', 5)],
      pukarPool: [makeCard('pukar1', 'HEARTS', 14)],
    };

    const plan = decideSmartChachaTurn(state as GameState, 2, memory);
    expect(plan.drawAction.type).toBe('TAKE_DISCARD');
  });

  it('Scenario 2 (Game 2 Step 86): Sid picks up 14♥ (Ace) to form pure Q-K-A run on table', () => {
    const memory = createInitialBotMemory();

    const state: any = {
      round: 2,
      phase: 'DRAW',
      turnPhase: 'DRAW',
      playerCount: 4,
      currentPlayerIndex: 2,
      players: [
        { id: 'p0', name: 'You', team: 'A', hand: [] },
        { id: 'p1', name: 'Chachi', team: 'B', hand: [] },
        {
          id: 'p2',
          name: 'Sid',
          team: 'A',
          hand: [
            makeCard('h13', 'HEARTS', 13), // K♥
            makeCard('s14', 'SPADES', 14),
            makeCard('d6', 'DIAMONDS', 6),
            makeCard('h10', 'HEARTS', 10),
            makeCard('c8', 'CLUBS', 8),
            makeCard('c6', 'CLUBS', 6),
            makeCard('h12', 'HEARTS', 12), // Q♥
            makeCard('c14', 'CLUBS', 14),
            makeCard('s13', 'SPADES', 13),
          ],
        },
        { id: 'p3', name: 'Harsh', team: 'B', hand: [] },
      ],
      melds: {
        A: [],
        B: [],
      },
      discardPile: [makeCard('h14', 'HEARTS', 14)], // A♥
      stockDeck: [makeCard('stock1', 'CLUBS', 5)],
      pukarPool: [makeCard('pukar1', 'HEARTS', 14)],
    };

    const plan = decideSmartChachaTurn(state as GameState, 2, memory);
    expect(plan.drawAction.type).toBe('TAKE_DISCARD');
  });

  it('Scenario 3 (Game 2 Step 95): Sid picks up 7♠ to extend 8-9-10-11 table sequence', () => {
    const memory = createInitialBotMemory();

    const teamSpadesRun: Meld = {
      id: 'meld-teamA-spades-run',
      team: 'A',
      type: 'RUN',
      suit: 'SPADES',
      cards: [
        makeCard('s8', 'SPADES', 8),
        makeCard('s9', 'SPADES', 9),
        makeCard('s10', 'SPADES', 10),
        makeCard('s11', 'SPADES', 11),
      ],
      slots: [
        { card: makeCard('s8', 'SPADES', 8), representedRank: 8, representedSuit: 'SPADES', isWildcard: false },
        { card: makeCard('s9', 'SPADES', 9), representedRank: 9, representedSuit: 'SPADES', isWildcard: false },
        { card: makeCard('s10', 'SPADES', 10), representedRank: 10, representedSuit: 'SPADES', isWildcard: false },
        { card: makeCard('s11', 'SPADES', 11), representedRank: 11, representedSuit: 'SPADES', isWildcard: false },
      ],
      isClean: false,
      isPure: true,
      isPure13: false,
      points: 0,
    };

    const state: any = {
      round: 2,
      phase: 'DRAW',
      turnPhase: 'DRAW',
      playerCount: 4,
      currentPlayerIndex: 2,
      players: [
        { id: 'p0', name: 'You', team: 'A', hand: [] },
        { id: 'p1', name: 'Chachi', team: 'B', hand: [] },
        {
          id: 'p2',
          name: 'Sid',
          team: 'A',
          hand: [
            makeCard('h13', 'HEARTS', 13),
            makeCard('s14', 'SPADES', 14),
            makeCard('d6', 'DIAMONDS', 6),
            makeCard('h10', 'HEARTS', 10),
            makeCard('c6', 'CLUBS', 6),
            makeCard('h12', 'HEARTS', 12),
            makeCard('s13', 'SPADES', 13),
          ],
        },
        { id: 'p3', name: 'Harsh', team: 'B', hand: [] },
      ],
      melds: {
        A: [teamSpadesRun],
        B: [],
      },
      discardPile: [makeCard('s7', 'SPADES', 7)],
      stockDeck: [makeCard('stock1', 'CLUBS', 5)],
      pukarPool: [makeCard('pukar1', 'HEARTS', 14)],
    };

    const plan = decideSmartChachaTurn(state as GameState, 2, memory);
    expect(plan.drawAction.type).toBe('TAKE_DISCARD');
  });

  it('Opponent table runs do not register generic RANK_r across all suits in opponentWants', () => {
    const memory = createInitialBotMemory();
    const state: any = {
      players: [
        { id: 'p1', name: 'Sid', team: 'A' },
        { id: 'p2', name: 'Opponent', team: 'B' },
      ],
      melds: {
        A: [],
        B: [
          {
            id: 'meld-opp-1',
            type: 'RUN',
            suit: 'SPADES',
            slots: [
              { representedRank: 9, representedSuit: 'SPADES', card: { id: 's9', rank: 9, suit: 'SPADES' } },
              { representedRank: 10, representedSuit: 'SPADES', card: { id: 's10', rank: 10, suit: 'SPADES' } },
              { representedRank: 11, representedSuit: 'SPADES', card: { id: 's11', rank: 11, suit: 'SPADES' } },
            ],
          },
        ],
      },
    };

    const wants = predictOpponentWants(memory, state as GameState, 'A');

    // Should want adjacent Spades
    expect(wants.has('SPADES_8')).toBe(true);
    expect(wants.has('SPADES_12')).toBe(true);

    // Should NOT want rank 9, 10, 11 across all other suits (Hearts, Clubs, Diamonds)
    expect(wants.has('RANK_9')).toBe(false);
    expect(wants.has('RANK_10')).toBe(false);
    expect(wants.has('RANK_11')).toBe(false);
    expect(wants.has('HEARTS_9')).toBe(false);
    expect(wants.has('CLUBS_10')).toBe(false);
    expect(wants.has('DIAMONDS_11')).toBe(false);
  });
});
