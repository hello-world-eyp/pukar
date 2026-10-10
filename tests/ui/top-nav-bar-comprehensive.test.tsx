import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TopNavBar } from '../../src/ui/components/TopNavBar';
import { SanitizedPlayer } from '../../src/engine/types';

describe('TopNavBar Component - Comprehensive Audit & Edge Cases', () => {
  const mockPlayers: SanitizedPlayer[] = [
    { id: 'p1', name: 'Alice', team: 'A', cardCount: 13 },
    { id: 'p2', name: 'Bob', team: 'B', cardCount: 13 },
    { id: 'p3', name: 'Charlie', team: 'A', cardCount: 13 },
    { id: 'p4', name: 'Dave', team: 'B', cardCount: 13 },
  ];

  it('renders branding and active tab state for all 3 views', () => {
    // 1. Table active
    const htmlTable = renderToString(
      <TopNavBar
        activeTab="table"
        onTabChange={() => {}}
        onOpenRules={() => {}}
        players={mockPlayers}
        currentPlayerIndex={0}
      />
    );
    expect(htmlTable).toContain('data-testid="top-nav-bar"');
    expect(htmlTable).toContain('pukar');
    expect(htmlTable).toContain('data-testid="tab-table"');
    expect(htmlTable).toContain('data-testid="tab-sequences"');
    expect(htmlTable).toContain('data-testid="tab-scoreboard"');
    expect(htmlTable).toContain('data-testid="tab-how-to-play"');

    // 2. Sequences active
    const htmlSeq = renderToString(
      <TopNavBar
        activeTab="sequences"
        onTabChange={() => {}}
        onOpenRules={() => {}}
        players={mockPlayers}
        currentPlayerIndex={0}
      />
    );
    expect(htmlSeq).toContain('bg-slate-100 text-slate-950');

    // 3. Scoreboard active
    const htmlScore = renderToString(
      <TopNavBar
        activeTab="scoreboard"
        onTabChange={() => {}}
        onOpenRules={() => {}}
        players={mockPlayers}
        currentPlayerIndex={0}
      />
    );
    expect(htmlScore).toContain('bg-slate-100 text-slate-950');
  });

  it('highlights active player turn and initial in avatar roster', () => {
    const html = renderToString(
      <TopNavBar
        activeTab="table"
        onTabChange={() => {}}
        onOpenRules={() => {}}
        players={mockPlayers}
        currentPlayerIndex={1} // Bob's turn
      />
    );

    expect(html).toContain('data-testid="nav-players-roster"');
    expect(html).toContain('data-testid="nav-player-0"');
    expect(html).toContain('data-testid="nav-player-1"');
    expect(html).toContain('data-testid="turn-indicator-dot"');
    expect(html).toContain('Bob');
    expect(html).toContain('(13)');
  });

  it('renders sound mute/unmute state correctly', () => {
    const htmlMuted = renderToString(
      <TopNavBar
        activeTab="table"
        onTabChange={() => {}}
        onOpenRules={() => {}}
        players={mockPlayers}
        currentPlayerIndex={0}
        isMuted={true}
        onToggleMute={() => {}}
      />
    );
    expect(htmlMuted).toContain('data-testid="btn-sound-toggle"');
    expect(htmlMuted).toContain('aria-label="Unmute Sound"');

    const htmlUnmuted = renderToString(
      <TopNavBar
        activeTab="table"
        onTabChange={() => {}}
        onOpenRules={() => {}}
        players={mockPlayers}
        currentPlayerIndex={0}
        isMuted={false}
        onToggleMute={() => {}}
      />
    );
    expect(htmlUnmuted).toContain('aria-label="Mute Sound"');
  });

  it('renders exit to menu and new game buttons when handlers provided', () => {
    const html = renderToString(
      <TopNavBar
        activeTab="table"
        onTabChange={() => {}}
        onOpenRules={() => {}}
        players={mockPlayers}
        currentPlayerIndex={0}
        onExitToMenu={() => {}}
        onNewGame={() => {}}
      />
    );

    expect(html).toContain('data-testid="btn-exit-to-menu"');
    expect(html).toContain('data-testid="btn-restart-game"');
  });

  it('renders displayTitle when gameTitle or roomCode passed', () => {
    const htmlTitle = renderToString(
      <TopNavBar
        activeTab="table"
        onTabChange={() => {}}
        onOpenRules={() => {}}
        players={mockPlayers}
        currentPlayerIndex={0}
        gameTitle="Pukar League"
      />
    );
    expect(htmlTitle).toContain('Pukar League');

    const htmlRoom = renderToString(
      <TopNavBar
        activeTab="table"
        onTabChange={() => {}}
        onOpenRules={() => {}}
        players={mockPlayers}
        currentPlayerIndex={0}
        roomCode="ABCD"
      />
    );
    expect(htmlRoom).toContain('Room ABCD');
  });
});
