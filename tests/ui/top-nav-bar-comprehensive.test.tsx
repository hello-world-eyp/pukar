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

  describe('Player Roster Consolidation (Horizontal Overflow Management)', () => {
    it('consolidates player roster to show only the active player when consolidatePlayers=true', () => {
      // Bob is the active player (currentPlayerIndex = 1)
      const html = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={() => {}}
          onOpenRules={() => {}}
          players={mockPlayers}
          currentPlayerIndex={1}
          consolidatePlayers={true}
        />
      );

      // Roster container indicates consolidation
      expect(html).toContain('data-testid="nav-players-roster"');
      expect(html).toContain('data-consolidated="true"');
      expect(html).toContain('overflow-x-hidden');

      // Only Bob (index 1) is rendered
      expect(html).toContain('data-testid="nav-player-1"');
      expect(html).toContain('Bob');
      expect(html).toContain('data-testid="nav-player-card-count-1"');
      expect(html).toContain('data-testid="turn-indicator-dot"');

      // Other players are consolidated away
      expect(html).not.toContain('data-testid="nav-player-0"');
      expect(html).not.toContain('data-testid="nav-player-2"');
      expect(html).not.toContain('data-testid="nav-player-3"');
      expect(html).not.toContain('Charlie');
      expect(html).not.toContain('Dave');
    });

    it('renders full player roster when consolidatePlayers=false', () => {
      const html = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={() => {}}
          onOpenRules={() => {}}
          players={mockPlayers}
          currentPlayerIndex={1}
          consolidatePlayers={false}
        />
      );

      expect(html).toContain('data-consolidated="false"');
      expect(html).toContain('overflow-x-auto');
      expect(html).toContain('data-testid="nav-player-0"');
      expect(html).toContain('data-testid="nav-player-1"');
      expect(html).toContain('data-testid="nav-player-2"');
      expect(html).toContain('data-testid="nav-player-3"');
      expect(html).toContain('Alice');
      expect(html).toContain('Bob');
      expect(html).toContain('Charlie');
      expect(html).toContain('Dave');
    });

    it('dynamically switches the single active player displayed when turn advances in consolidated mode', () => {
      // Test Player 0 (Alice)
      const htmlAlice = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={() => {}}
          onOpenRules={() => {}}
          players={mockPlayers}
          currentPlayerIndex={0}
          consolidatePlayers={true}
        />
      );
      expect(htmlAlice).toContain('data-testid="nav-player-0"');
      expect(htmlAlice).toContain('Alice');
      expect(htmlAlice).not.toContain('data-testid="nav-player-1"');

      // Test Player 2 (Charlie)
      const htmlCharlie = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={() => {}}
          onOpenRules={() => {}}
          players={mockPlayers}
          currentPlayerIndex={2}
          consolidatePlayers={true}
        />
      );
      expect(htmlCharlie).toContain('data-testid="nav-player-2"');
      expect(htmlCharlie).toContain('Charlie');
      expect(htmlCharlie).not.toContain('data-testid="nav-player-0"');
      expect(htmlCharlie).not.toContain('data-testid="nav-player-1"');

      // Test Player 3 (Dave)
      const htmlDave = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={() => {}}
          onOpenRules={() => {}}
          players={mockPlayers}
          currentPlayerIndex={3}
          consolidatePlayers={true}
        />
      );
      expect(htmlDave).toContain('data-testid="nav-player-3"');
      expect(htmlDave).toContain('Dave');
      expect(htmlDave).not.toContain('data-testid="nav-player-0"');
    });

    it('safely handles empty player array in consolidated mode without crashing', () => {
      const html = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={() => {}}
          onOpenRules={() => {}}
          players={[]}
          currentPlayerIndex={0}
          consolidatePlayers={true}
        />
      );

      expect(html).toContain('data-testid="nav-players-roster"');
      expect(html).not.toContain('data-testid="nav-player-0"');
    });

    it('safely handles out-of-range currentPlayerIndex by defaulting to player 0', () => {
      const html = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={() => {}}
          onOpenRules={() => {}}
          players={mockPlayers}
          currentPlayerIndex={99}
          consolidatePlayers={true}
        />
      );

      expect(html).toContain('data-testid="nav-player-0"');
      expect(html).toContain('Alice');
      expect(html).not.toContain('data-testid="nav-player-1"');
    });

    it('attaches window resize listener and supports ResizeObserver in browser environment', () => {
      let resizeListener: (() => void) | null = null;
      let observed = false;

      const mockWindow = {
        addEventListener: (event: string, cb: () => void) => {
          if (event === 'resize') resizeListener = cb;
        },
        removeEventListener: (event: string, cb: () => void) => {
          if (event === 'resize' && resizeListener === cb) resizeListener = null;
        },
      };

      class MockResizeObserver {
        observe() {
          observed = true;
        }
        disconnect() {}
      }

      const origWindow = globalThis.window;
      const origResizeObserver = (globalThis as any).ResizeObserver;

      try {
        (globalThis as any).window = mockWindow;
        (globalThis as any).ResizeObserver = MockResizeObserver;

        const html = renderToString(
          <TopNavBar
            activeTab="table"
            onTabChange={() => {}}
            onOpenRules={() => {}}
            players={mockPlayers}
            currentPlayerIndex={0}
          />
        );
        expect(html).toContain('data-testid="top-nav-bar"');
        expect(observed).toBe(false); // In SSR/renderToString, effects do not run
      } finally {
        (globalThis as any).window = origWindow;
        (globalThis as any).ResizeObserver = origResizeObserver;
      }
    });

    it('validates auto-consolidation math: consolidates when scrollWidth > clientWidth and un-consolidates on widen', () => {
      let isAutoConsolidated = false;
      const uncollapsedWidthRef = { current: null as number | null };

      const mockHeader = {
        scrollWidth: 1580,
        clientWidth: 1280,
      };

      const checkOverflow = (isConsolidated: boolean) => {
        if (!isConsolidated) {
          if (mockHeader.scrollWidth - mockHeader.clientWidth > 2) {
            uncollapsedWidthRef.current = mockHeader.scrollWidth;
            isAutoConsolidated = true;
          }
        } else {
          const cached = uncollapsedWidthRef.current;
          if (cached && mockHeader.clientWidth >= cached + 16) {
            isAutoConsolidated = false;
            uncollapsedWidthRef.current = null;
          }
        }
      };

      // 1. Initial overflow detected (1580 > 1280) -> Consolidates
      checkOverflow(false);
      expect(isAutoConsolidated).toBe(true);
      expect(uncollapsedWidthRef.current).toBe(1580);

      // 2. Window widens slightly to 1400 (< 1580 + 16) -> Stays consolidated
      mockHeader.clientWidth = 1400;
      checkOverflow(true);
      expect(isAutoConsolidated).toBe(true);

      // 3. Window widens to 1600 (>= 1580 + 16) -> Restores full roster
      mockHeader.clientWidth = 1600;
      checkOverflow(true);
      expect(isAutoConsolidated).toBe(false);
      expect(uncollapsedWidthRef.current).toBeNull();

      // 4. In expanded state, 1580 <= 1600 -> Stays expanded stably
      mockHeader.scrollWidth = 1580;
      checkOverflow(false);
      expect(isAutoConsolidated).toBe(false);
    });

    it('renders disconnect indicator dot for disconnected players in roster', () => {
      const playersWithDisconnect = [
        { id: 'p0', name: 'Alice', team: 'A' as const, cardCount: 13, isConnected: true },
        { id: 'p1', name: 'Bob', team: 'B' as const, cardCount: 13, isConnected: false },
        { id: 'p2', name: 'Charlie', team: 'A' as const, cardCount: 13, isConnected: true },
        { id: 'p3', name: 'Dana', team: 'B' as const, cardCount: 13, isConnected: false },
      ];

      const html = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={() => {}}
          onOpenRules={() => {}}
          players={playersWithDisconnect}
          currentPlayerIndex={0}
        />
      );

      expect(html).toContain('data-testid="nav-player-disconnect-1"');
      expect(html).toContain('data-testid="nav-player-disconnect-3"');
      expect(html).not.toContain('data-testid="nav-player-disconnect-0"');
      expect(html).not.toContain('data-testid="nav-player-disconnect-2"');
    });
  });
});
