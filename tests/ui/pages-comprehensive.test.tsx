import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SequencesPage } from '../../src/ui/components/SequencesPage';
import { ScoreboardPage } from '../../src/ui/components/ScoreboardPage';
import { Card, GameState, Meld } from '../../src/engine/types';
import { dealInitialState } from '../../src/engine/deck';

function makeCard(id: string, suit: Card['suit'], rank: Card['rank'], isNaturalJoker = false): Card {
  return {
    id,
    suit,
    rank,
    isNaturalJoker,
    isJoker: isNaturalJoker || rank === 0 || rank === 2,
  };
}

describe('UI Pages - SequencesPage & ScoreboardPage Comprehensive Test Suite', () => {
  const runCardsTeamA: Card[] = [
    makeCard('s3', 'SPADES', 3),
    makeCard('s4', 'SPADES', 4),
    makeCard('s5', 'SPADES', 5),
    makeCard('s6', 'SPADES', 6),
    makeCard('s7', 'SPADES', 7),
    makeCard('s8', 'SPADES', 8),
    makeCard('s9', 'SPADES', 9),
  ];

  const meldTeamA: Meld = {
    id: 'meld-A1',
    team: 'A',
    type: 'RUN',
    suit: 'SPADES',
    cards: runCardsTeamA,
    slots: runCardsTeamA.map((c) => ({
      card: c,
      representedRank: c.rank,
      representedSuit: 'SPADES',
      isWildcard: false,
    })),
  };

  const meldTeamB: Meld = {
    id: 'meld-B1',
    team: 'B',
    type: 'SET',
    rank: 10,
    cards: [
      makeCard('h10', 'HEARTS', 10),
      makeCard('d10', 'DIAMONDS', 10),
      makeCard('c10', 'CLUBS', 10),
    ],
    slots: [
      { card: makeCard('h10', 'HEARTS', 10), representedRank: 10, representedSuit: 'HEARTS', isWildcard: false },
      { card: makeCard('d10', 'DIAMONDS', 10), representedRank: 10, representedSuit: 'DIAMONDS', isWildcard: false },
      { card: makeCard('c10', 'CLUBS', 10), representedRank: 10, representedSuit: 'CLUBS', isWildcard: false },
    ],
  };

  /* =========================================================================
   * 1. SequencesPage
   * ========================================================================= */
  describe('SequencesPage Component', () => {
    it('renders empty sequence states for both teams when no melds exist', () => {
      const html = renderToString(
        <SequencesPage
          melds={{ A: [], B: [] }}
          onBackToTable={() => {}}
        />
      );

      expect(html).toContain('data-testid="sequences-page"');
      expect(html).toContain('Team A Sequences');
      expect(html).toContain('Team B Sequences');
      expect(html).toContain('No sequences placed yet by Team A');
      expect(html).toContain('No sequences placed yet by Team B');
      expect(html).toContain('Back to Table');
    });

    it('renders melds for Team A and Team B with correct point evaluation tags', () => {
      const html = renderToString(
        <SequencesPage
          melds={{ A: [meldTeamA], B: [meldTeamB] }}
          onBackToTable={() => {}}
          onZoomMeld={() => {}}
          players={[
            { id: 'p1', name: 'Alice', team: 'A' },
            { id: 'p2', name: 'Bob', team: 'B' },
          ]}
        />
      );

      expect(html).toContain('Team A Sequences');
      expect(html).toContain('Pure Sequence');
      expect(html).toContain('200 pts');
      expect(html).toContain('Team B Sequences');
      expect(html).toContain('data-testid="btn-zoom-meld-A1"');
      expect(html).toContain('title="Zoom in modal"');
    });

    it('renders filter pills and team summary statistics', () => {
      const html = renderToString(
        <SequencesPage
          melds={{ A: [meldTeamA], B: [] }}
          onBackToTable={() => {}}
        />
      );

      expect(html).toContain('data-testid="filter-all"');
      expect(html).toContain('data-testid="filter-team-a"');
      expect(html).toContain('data-testid="filter-team-b"');
      expect(html).toContain('All Teams');
    });
  });

  /* =========================================================================
   * 2. ScoreboardPage
   * ========================================================================= */
  describe('ScoreboardPage Component', () => {
    it('renders match scoreboard summary, round numbers, and navigation buttons', () => {
      const state: GameState = {
        ...dealInitialState(4),
        round: 2,
        roundStatus: 'PLAYING',
        scores: { A: 250, B: 150 },
        totalScores: { A: 250, B: 150 },
        roundScores: { A: 200, B: 50 },
        pukarsClaimed: { A: 1, B: 0 },
        melds: { A: [meldTeamA], B: [meldTeamB] },
      };

      const onBack = vi.fn();
      const onRules = vi.fn();

      const html = renderToString(
        <ScoreboardPage
          gameState={state}
          onBackToTable={onBack}
          onOpenRules={onRules}
        />
      );

      expect(html).toContain('Scoreboard &amp; Breakdown');
      expect(html).toContain('Round 2');
      expect(html).toContain('Total Match Points');
      expect(html).toContain('250');
      expect(html).toContain('150');
      expect(html).toContain('Pukars Claimed');
      expect(html).toContain('Scoring Rules Guide');
      expect(html).toContain('Back to Table');
    });

    it('renders leader crown badge for the winning team', () => {
      const state: GameState = {
        ...dealInitialState(4),
        round: 3,
        roundStatus: 'PLAYING',
        scores: { A: 1200, B: 800 },
        totalScores: { A: 1200, B: 800 },
      };

      const html = renderToString(
        <ScoreboardPage
          gameState={state}
          onBackToTable={() => {}}
        />
      );

      expect(html).toContain('Leader');
      expect(html).toContain('1200');
    });

    it('renders round status correctly when ROUND_OVER', () => {
      const state: GameState = {
        ...dealInitialState(4),
        round: 2,
        roundStatus: 'ROUND_OVER',
        scores: { A: 500, B: 400 },
        totalScores: { A: 500, B: 400 },
      };

      const html = renderToString(
        <ScoreboardPage
          gameState={state}
          onBackToTable={() => {}}
        />
      );

      expect(html).toContain('Round Over');
    });
  });
});
