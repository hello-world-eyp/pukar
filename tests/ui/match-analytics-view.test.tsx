import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MatchAnalyticsView } from '../../src/ui/components/MatchAnalyticsView';
import { RoundSummaryModal } from '../../src/ui/components/RoundSummaryModal';
import { ScoreboardPage } from '../../src/ui/components/ScoreboardPage';
import { dealInitialState } from '../../src/engine/deck';
import { MatchStats, Player } from '../../src/engine/types';

describe('Match Analytics View & End-Game Summary Awards', () => {
  const samplePlayers: Player[] = [
    { id: 'p0', name: 'Harsh', team: 'A', hand: [] },
    { id: 'p1', name: 'Cheetah AI', team: 'B', hand: [] },
    { id: 'p2', name: 'Sid', team: 'A', hand: [] },
    { id: 'p3', name: 'Chachi', team: 'B', hand: [] },
  ];

  const sampleMatchStats: MatchStats = {
    playerStats: {
      0: {
        pointsContributed: 250,
        jokersStolen: 3,
        cardsFedToOpponents: 1,
        pukarsClaimed: 2,
        meldsCreated: 3,
      },
      1: {
        pointsContributed: 100,
        jokersStolen: 0,
        cardsFedToOpponents: 5,
        pukarsClaimed: 0,
        meldsCreated: 1,
      },
      2: {
        pointsContributed: 150,
        jokersStolen: 1,
        cardsFedToOpponents: 0,
        pukarsClaimed: 1,
        meldsCreated: 2,
      },
      3: {
        pointsContributed: 80,
        jokersStolen: 0,
        cardsFedToOpponents: 4,
        pukarsClaimed: 0,
        meldsCreated: 1,
      },
    },
    longestSequence: {
      team: 'A',
      cardCount: 8,
      description: '4♠ to J♠ (Clean Run)',
      cards: [
        { id: 's4', suit: 'SPADES', rank: 4 },
        { id: 's5', suit: 'SPADES', rank: 5 },
        { id: 's6', suit: 'SPADES', rank: 6 },
        { id: 's7', suit: 'SPADES', rank: 7 },
        { id: 's8', suit: 'SPADES', rank: 8 },
        { id: 's9', suit: 'SPADES', rank: 9 },
        { id: 's10', suit: 'SPADES', rank: 10 },
        { id: 's11', suit: 'SPADES', rank: 11 },
      ],
    },
    scoreTimeline: [
      { round: 1, scoreA: 200, scoreB: 50 },
      { round: 2, scoreA: 400, scoreB: 180 },
    ],
  };

  it('renders all 4 spotlight award cards with correct titles, values, and recipient names', () => {
    const html = renderToString(
      <MatchAnalyticsView
        matchStats={sampleMatchStats}
        players={samplePlayers}
        winnerTeam="A"
        totalScores={{ A: 400, B: 180 }}
      />
    );

    // Root container
    expect(html).toContain('data-testid="match-analytics-view"');

    // 1. MVP Award: Harsh (Player 0) with 250 pts contributed
    expect(html).toContain('data-testid="award-match-mvp"');
    expect(html).toContain('Match MVP');
    expect(html).toContain('Harsh');
    expect(html).toContain('+250');

    // 2. Biggest Heist: Harsh with 3 jokers stolen
    expect(html).toContain('data-testid="award-biggest-heist"');
    expect(html).toContain('Biggest Heist');
    expect(html).toContain('3 Jokers Snatched');

    // 3. Longest Sequence: 8 cards, 4♠ to J♠
    expect(html).toContain('data-testid="award-longest-sequence"');
    expect(html).toContain('Longest Run');
    expect(html).toContain('8 Cards');
    expect(html).toContain('4♠ to J♠ (Clean Run)');

    // 4. Chief Feeder: Cheetah AI with 5 cards fed to opponents
    expect(html).toContain('data-testid="award-chief-feeder"');
    expect(html).toContain('Chief Feeder');
    expect(html).toContain('Cheetah AI');
    expect(html).toContain('5 cards given to opponents');
  });

  it('renders the responsive SVG score progression timeline with points for both teams', () => {
    const html = renderToString(
      <MatchAnalyticsView
        matchStats={sampleMatchStats}
        players={samplePlayers}
        winnerTeam="A"
        totalScores={{ A: 400, B: 180 }}
      />
    );

    expect(html).toContain('data-testid="score-timeline-graph"');
    expect(html).toContain('Score Progression Timeline');
    // Polyline points for Team A and Team B
    expect(html).toContain('<polyline');
    expect(html).toContain('stroke="#3b82f6"'); // Team A blue stroke
    expect(html).toContain('stroke="#f59e0b"'); // Team B amber stroke
  });

  it('deduplicates multiple entries per round so each round appears once and displays Start baseline', () => {
    const duplicateRoundStats: MatchStats = {
      ...sampleMatchStats,
      scoreTimeline: [
        { round: 1, scoreA: 0, scoreB: 0 },
        { round: 1, scoreA: 500, scoreB: 150 },
        { round: 2, scoreA: 500, scoreB: 150 },
        { round: 2, scoreA: 1100, scoreB: 250 },
        { round: 3, scoreA: 1100, scoreB: 250 },
        { round: 3, scoreA: 2600, scoreB: 700 },
      ],
    };

    const html = renderToString(
      <MatchAnalyticsView
        matchStats={duplicateRoundStats}
        players={samplePlayers}
        winnerTeam="A"
        totalScores={{ A: 2600, B: 700 }}
      />
    );

    // Initial baseline labeled Start
    expect(html).toContain('Start');

    // Exactly one card per completed round (Round 1, Round 2, Round 3)
    expect(html).toContain('data-testid="milestone-card-1"');
    expect(html).toContain('data-testid="milestone-card-2"');
    expect(html).toContain('data-testid="milestone-card-3"');

    // Accurate point diffs for each round
    expect(html).toContain('+500'); // Round 1 Team A
    expect(html).toContain('+150'); // Round 1 Team B
    expect(html).toContain('+600'); // Round 2 Team A
    expect(html).toContain('+100'); // Round 2 Team B
    expect(html).toContain('+1500'); // Round 3 Team A
    expect(html).toContain('+450'); // Round 3 Team B

    // Axis labels: count occurrences of "Round 1" in SVG axis text
    const axisRound1Count = (html.match(/Round 1/g) || []).length;
    // 1 in SVG axis + 1 in milestone card = exactly 2 occurrences in the entire view (NOT 3 or 4)
    expect(axisRound1Count).toBe(2);
  });

  it('renders RoundSummaryModal with tabs, next round starting player, and match analytics', () => {
    const onStartNextRound = vi.fn();

    const html = renderToString(
      <RoundSummaryModal
        isOpen={true}
        round={2}
        roundScores={{ A: 200, B: 130 }}
        totalScores={{ A: 400, B: 180 }}
        melds={{ A: [], B: [] }}
        pukarsClaimed={{ A: 1, B: 0 }}
        matchStats={sampleMatchStats}
        players={samplePlayers}
        onStartNextRound={onStartNextRound}
      />
    );

    // Modal container & tabs
    expect(html).toContain('data-testid="round-summary-modal"');
    expect(html).toContain('data-testid="tab-round-breakdown"');
    expect(html).toContain('data-testid="tab-match-awards"');

    // Next round starting player indicator: In Round 2 with 4 players, Round 3 starts at Seat 3 (Player 3: Sid)
    expect(html).toContain('Starting Round 3:');
    expect(html).toContain('Sid (Seat 3)');
  });

  it('defaults to AWARDS tab when isGameOver is true in RoundSummaryModal', () => {
    const html = renderToString(
      <RoundSummaryModal
        isOpen={true}
        isGameOver={true}
        round={4}
        roundScores={{ A: 300, B: 50 }}
        totalScores={{ A: 1000, B: 400 }}
        melds={{ A: [], B: [] }}
        matchStats={sampleMatchStats}
        players={samplePlayers}
        onStartNextRound={vi.fn()}
      />
    );

    // Should immediately display the MatchAnalyticsView inside the modal
    expect(html).toContain('data-testid="match-analytics-view"');
    expect(html).toContain('data-testid="award-match-mvp"');
    expect(html).toContain('data-testid="award-biggest-heist"');
    expect(html).toContain('data-testid="award-longest-sequence"');
    expect(html).toContain('data-testid="award-chief-feeder"');
  });

  it('renders tab switcher between Scores and Match Awards in ScoreboardPage', () => {
    const state = dealInitialState(4);
    state.matchStats = sampleMatchStats;

    const html = renderToString(
      <ScoreboardPage
        gameState={state}
        onBackToTable={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="scoreboard-page"');
    expect(html).toContain('data-testid="tab-scoreboard-overview"');
    expect(html).toContain('data-testid="tab-scoreboard-awards"');
    expect(html).toContain('Scores &amp; Sequences');
    expect(html).toContain('Match Awards &amp; Analytics');
  });
});
