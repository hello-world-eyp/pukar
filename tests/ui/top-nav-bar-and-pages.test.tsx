import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TopNavBar, PlayerInfo } from '../../src/ui/components/TopNavBar';
import { SequencesPage } from '../../src/ui/components/SequencesPage';
import { ScoreboardPage } from '../../src/ui/components/ScoreboardPage';
import { App } from '../../src/App';
import { GameState, Meld } from '../../src/engine/types';
import { dealInitialState } from '../../src/engine/deck';

describe('Top Navigation Bar, Sequences Page & Scoreboard Page', () => {
  const mockPlayers: PlayerInfo[] = [
    { id: 'p1', name: 'Mayank', team: 'A' },
    { id: 'p2', name: 'Leela', team: 'B' },
    { id: 'p3', name: 'Rohan', team: 'A' },
    { id: 'p4', name: 'Priya', team: 'B' },
  ];

  describe('TopNavBar Component', () => {
    it('renders clean navigation bar with spade logo and pukar branding without random text', () => {
      const html = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={vi.fn()}
          onOpenRules={vi.fn()}
          players={mockPlayers}
          currentPlayerIndex={0}
        />
      );

      // Lime spade badge and lowercase pukar
      expect(html).toContain('♠');
      expect(html).toContain('pukar');
      expect(html).not.toContain('Friday game night');

      // Random text from before is NOT present
      expect(html).not.toContain('Royal Rummy');
      expect(html).not.toContain('In Progress');
      expect(html).not.toContain('Round 1');
    });

    it('renders room code when provided', () => {
      const html = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={vi.fn()}
          onOpenRules={vi.fn()}
          players={mockPlayers}
          currentPlayerIndex={0}
          roomCode="GAME-7788"
        />
      );

      expect(html).toContain('Room GAME-7788');
    });

    it('renders the 4 navigation tabs with active tab highlighted', () => {
      const html = renderToString(
        <TopNavBar
          activeTab="sequences"
          onTabChange={vi.fn()}
          onOpenRules={vi.fn()}
          players={mockPlayers}
          currentPlayerIndex={0}
        />
      );

      expect(html).toContain('data-testid="tab-table"');
      expect(html).toContain('data-testid="tab-sequences"');
      expect(html).toContain('data-testid="tab-scoreboard"');
      expect(html).toContain('data-testid="tab-how-to-play"');

      expect(html).toContain('Table');
      expect(html).toContain('Sequences');
      expect(html).toContain('Scoreboard');
      expect(html).toContain('How to play');
    });

    it('renders player roster on the top right with initial avatars and highlights current turn player', () => {
      const html = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={vi.fn()}
          onOpenRules={vi.fn()}
          players={mockPlayers}
          currentPlayerIndex={1} // Leela's turn
        />
      );

      // Player names & initial badges
      expect(html).toContain('Mayank');
      expect(html).toContain('Leela');
      expect(html).toContain('Rohan');
      expect(html).toContain('Priya');

      // Leela is player index 1: turn highlight dot and active turn ring
      expect(html).toContain('data-testid="nav-player-1"');
      expect(html).toContain('data-testid="turn-indicator-dot"');
    });

    it('renders player hand card counts (X) when cardCount is provided on player info', () => {
      const playersWithCounts: PlayerInfo[] = [
        { id: 'p1', name: 'Mayank', team: 'A', cardCount: 13 },
        { id: 'p2', name: 'Leela', team: 'B', cardCount: 12 },
        { id: 'p3', name: 'Rohan', team: 'A', cardCount: 8 },
        { id: 'p4', name: 'Priya', team: 'B', cardCount: 0 },
      ];

      const html = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={vi.fn()}
          onOpenRules={vi.fn()}
          players={playersWithCounts}
          currentPlayerIndex={0}
        />
      );

      expect(html).toContain('data-testid="nav-player-card-count-0"');
      expect(html).toContain('(13)');
      expect(html).toContain('(12)');
      expect(html).toContain('(8)');
      expect(html).toContain('(0)');
    });

    it('renders sound toggle, new game, and exit to menu buttons', () => {
      const html = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={vi.fn()}
          onOpenRules={vi.fn()}
          players={mockPlayers}
          currentPlayerIndex={0}
          onToggleMute={vi.fn()}
          onNewGame={vi.fn()}
          onExitToMenu={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="btn-sound-toggle"');
      expect(html).toContain('data-testid="btn-restart-game"');
      expect(html).toContain('data-testid="btn-exit-to-menu"');
      expect(html).toContain('New Game');
      expect(html).toContain('Menu');
    });
  });

  describe('SequencesPage Component', () => {
    const mockMeldA: Meld = {
      id: 'meld-a-1',
      type: 'RUN',
      suit: 'SPADES',
      team: 'A',
      cards: [
        { id: 's3', suit: 'SPADES', rank: 3 },
        { id: 's4', suit: 'SPADES', rank: 4 },
        { id: 's5', suit: 'SPADES', rank: 5 },
        { id: 's6', suit: 'SPADES', rank: 6 },
        { id: 's7', suit: 'SPADES', rank: 7 },
        { id: 's8', suit: 'SPADES', rank: 8 },
        { id: 's9', suit: 'SPADES', rank: 9 },
      ],
      slots: [
        { card: { id: 's3', suit: 'SPADES', rank: 3 }, representedRank: 3, isWildcard: false },
        { card: { id: 's4', suit: 'SPADES', rank: 4 }, representedRank: 4, isWildcard: false },
        { card: { id: 's5', suit: 'SPADES', rank: 5 }, representedRank: 5, isWildcard: false },
        { card: { id: 's6', suit: 'SPADES', rank: 6 }, representedRank: 6, isWildcard: false },
        { card: { id: 's7', suit: 'SPADES', rank: 7 }, representedRank: 7, isWildcard: false },
        { card: { id: 's8', suit: 'SPADES', rank: 8 }, representedRank: 8, isWildcard: false },
        { card: { id: 's9', suit: 'SPADES', rank: 9 }, representedRank: 9, isWildcard: false },
      ],
    };

    it('renders enlarged sequence details with points, cards, and team summaries', () => {
      const html = renderToString(
        <SequencesPage
          melds={{ A: [mockMeldA], B: [] }}
          onBackToTable={vi.fn()}
          players={[
            { id: 'p1', name: 'Mayank', team: 'A' },
            { id: 'p2', name: 'Leela', team: 'B' },
          ]}
        />
      );

      expect(html).toContain('data-testid="sequences-page"');
      expect(html).toContain('data-testid="btn-back-to-table"');
      expect(html).toContain('Back to Table');

      // Team A has 1 sequence worth 200 pts (Clean 7-card run)
      expect(html).toContain('Team A Sequences');
      expect(html).toContain('200 pts');
      expect(html).toContain('SPADES');

      // Team B has 0 sequences
      expect(html).toContain('No sequences placed yet by Team B');
    });

    it('renders team filter buttons and sort toggle button', () => {
      const html = renderToString(
        <SequencesPage
          melds={{ A: [mockMeldA], B: [] }}
          onBackToTable={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="filter-all"');
      expect(html).toContain('data-testid="filter-team-a"');
      expect(html).toContain('data-testid="filter-team-b"');
      expect(html).toContain('data-testid="btn-sequences-sort-toggle"');
    });
  });

  describe('ScoreboardPage Component', () => {
    it('renders detailed scoreboard breakdown with total match scores, round points, and matrix guide', () => {
      const state: GameState = dealInitialState(4);
      state.round = 2;
      state.scores = { A: 250, B: 100 };
      state.totalScores = { A: 250, B: 100 };
      state.roundScores = { A: 50, B: 0 };
      state.pukarsClaimed = { A: 1, B: 0 };

      const html = renderToString(
        <ScoreboardPage
          gameState={state}
          onBackToTable={vi.fn()}
          onOpenRules={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="scoreboard-page"');
      expect(html).toContain('data-testid="btn-back-to-table"');
      expect(html).toContain('Round 2');

      // Team A is leader (250 pts vs 100 pts)
      expect(html).toContain('data-testid="scoreboard-card-team-a"');
      expect(html).toContain('data-testid="scoreboard-card-team-b"');
      expect(html).toContain('250');
      expect(html).toContain('100');
      expect(html).toContain('Leader');

      // Round point itemization & Pukars
      expect(html).toContain('data-testid="itemized-team-a"');
      expect(html).toContain('data-testid="itemized-team-b"');
      expect(html).toContain('Pukar Bonuses');

      // Official Scoring Matrix
      expect(html).toContain('Official Pukar Scoring Matrix');
      expect(html).toContain('Pure 13-Card Run (2 to A)');
      expect(html).toContain('500 pts');
      expect(html).toContain('Clean 7-Card Run / Set');
      expect(html).toContain('200 pts');
    });
  });

  describe('App Tab Navigation Integration', () => {
    it('renders Table tab by default with playing arena', () => {
      const html = renderToString(<App initialScreen="GAME" />);

      // Top nav bar is present
      expect(html).toContain('data-testid="top-nav-bar"');
      expect(html).toContain('data-testid="tab-table"');
      expect(html).toContain('data-testid="tab-sequences"');
      expect(html).toContain('data-testid="tab-scoreboard"');

      // Table elements are present in Table tab
      expect(html).toContain('Stock Deck');
      expect(html).toContain('Discard Pile');
      expect(html).toContain('Pukar Pool');
    });

    it('renders player card count (13) in TopNavBar when game is active', () => {
      const html = renderToString(<App initialScreen="GAME" />);

      // At start of fresh game, each player has 13 cards in hand
      expect(html).toContain('data-testid="nav-player-card-count-0"');
      expect(html).toContain('(13)');
    });

    it('omits perimeter player seats around table in App to maximize table width and height', () => {
      const html = renderToString(<App initialScreen="GAME" />);

      // Perimeter seats removed from table area
      expect(html).not.toContain('data-testid="table-seat-top-0"');
      expect(html).not.toContain('data-testid="table-seat-left"');
      expect(html).not.toContain('data-testid="table-seat-right"');

      // But players are actively tracked in TopNavBar
      expect(html).toContain('data-testid="nav-players-roster"');
      expect(html).toContain('data-testid="nav-player-0"');
    });
  });
});
