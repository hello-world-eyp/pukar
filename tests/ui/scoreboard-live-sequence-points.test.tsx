import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ScoreboardPage } from '../../src/ui/components/ScoreboardPage';
import { dealInitialState } from '../../src/engine/deck';
import { Card, GameState, Meld } from '../../src/engine/types';

function makeCard(id: string, suit: 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS', rank: any): Card {
  return { id, suit, rank };
}

describe('ScoreboardPage: Live Sequence Points on Score Cards', () => {
  const cleanRunCards: Card[] = [
    makeCard('s3', 'SPADES', 3),
    makeCard('s4', 'SPADES', 4),
    makeCard('s5', 'SPADES', 5),
    makeCard('s6', 'SPADES', 6),
    makeCard('s7', 'SPADES', 7),
    makeCard('s8', 'SPADES', 8),
    makeCard('s9', 'SPADES', 9),
  ];

  const meld200Pts: Meld = {
    id: 'meld-A1',
    team: 'A',
    type: 'RUN',
    suit: 'SPADES',
    cards: cleanRunCards,
    slots: cleanRunCards.map((c) => ({
      card: c,
      representedRank: c.rank,
      representedSuit: 'SPADES',
      isWildcard: false,
    })),
    points: 200,
    isClean: true,
  };

  it('updates total match points on top right of Team A score card when a 200 pt sequence is melded', () => {
    const state: GameState = dealInitialState(4);
    state.round = 1;
    state.roundStatus = 'PLAYING';
    state.scores = { A: 0, B: 0 };
    state.totalScores = { A: 0, B: 0 };
    state.roundScores = { A: 0, B: 0 };
    state.pukarsClaimed = { A: 0, B: 0 };
    state.melds = { A: [meld200Pts], B: [] };

    const html = renderToString(
      <ScoreboardPage
        gameState={state}
        onBackToTable={vi.fn()}
      />
    );

    // Score card for Team A should show 200 on the top right
    expect(html).toContain('data-testid="scoreboard-card-team-a"');
    // Top right total points
    expect(html).toContain('200');
    // Current round metric should also reflect +200
    expect(html).toContain('+200');
  });

  it('combines sequence points (200 pts) and pukar points (50 pts) on top right of score card (250 pts total)', () => {
    const state: GameState = dealInitialState(4);
    state.round = 1;
    state.roundStatus = 'PLAYING';
    // Mid-round Pukar claim added 50 pts
    state.scores = { A: 50, B: 0 };
    state.totalScores = { A: 50, B: 0 };
    state.roundScores = { A: 50, B: 0 };
    state.pukarsClaimed = { A: 1, B: 0 };
    state.melds = { A: [meld200Pts], B: [] };

    const html = renderToString(
      <ScoreboardPage
        gameState={state}
        onBackToTable={vi.fn()}
      />
    );

    // Total points on top right should be 250 (50 pukar + 200 sequence)
    expect(html).toContain('250');
    expect(html).toContain('+250');
  });

  it('adds active sequence points (100 pts) to cumulative prior round totals (250 pts) in Round 2, showing 350 pts total', () => {
    const state: GameState = dealInitialState(4);
    state.round = 2;
    state.roundStatus = 'PLAYING';
    // Round 1 ended with 250 pts for Team A
    state.roundHistory = [
      {
        round: 1,
        scores: { A: 250, B: 100 },
        totalScores: { A: 250, B: 100 },
        pukarsClaimed: { A: 1, B: 0 },
        meldsCount: { A: 1, B: 1 },
        winner: 'A',
      },
    ];
    state.scores = { A: 250, B: 100 };
    state.totalScores = { A: 250, B: 100 };
    state.roundScores = { A: 0, B: 0 };
    state.pukarsClaimed = { A: 0, B: 0 };

    // In Round 2, Team A melds a 100 pt dirty sequence
    const meld100Pts: Meld = {
      ...meld200Pts,
      points: 100,
      isClean: false,
    };
    state.melds = { A: [meld100Pts], B: [] };

    const html = renderToString(
      <ScoreboardPage
        gameState={state}
        onBackToTable={vi.fn()}
      />
    );

    // Total Match Points on top right should be 350 (250 prior + 100 sequence)
    expect(html).toContain('350');
    expect(html).toContain('+100');
  });
});
