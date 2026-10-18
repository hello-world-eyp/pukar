import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PlayerHand } from '../../src/ui/components/PlayerHand';
import { TopNavBar } from '../../src/ui/components/TopNavBar';
import { App } from '../../src/App';
import { Card } from '../../src/engine/types';

describe('PlayerHand Collapsible / Hideable Hand Cards', () => {
  const mockCards: Card[] = [
    { id: 'c1', rank: 14, suit: 'SPADES' },
    { id: 'c2', rank: 13, suit: 'SPADES' },
    { id: 'c3', rank: 12, suit: 'SPADES' },
    { id: 'c4', rank: 11, suit: 'HEARTS' },
  ];

  it('renders "Hide Cards" toggle button and full cards tray when visible (default)', () => {
    const html = renderToString(<PlayerHand cards={mockCards} />);

    expect(html).toContain('data-testid="btn-toggle-hand-collapse"');
    expect(html).toContain('aria-label="Hide Cards"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('Hide Cards');

    // Cards tray should be visible, collapsed bar should not, and no random tray hide button
    expect(html).toContain('aria-label="Hand Cards"');
    expect(html).not.toContain('data-testid="btn-tray-quick-collapse"');
    expect(html).not.toContain('data-testid="collapsed-hand-bar"');
  });

  it('renders "Show Cards" toggle button and collapsed bar when isCollapsed is true', () => {
    const html = renderToString(<PlayerHand cards={mockCards} isCollapsed={true} />);

    expect(html).toContain('data-testid="btn-toggle-hand-collapse"');
    expect(html).toContain('aria-label="Show Cards"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Show Cards');

    // Full card tray is hidden, collapsed bar is rendered
    expect(html).not.toContain('aria-label="Hand Cards"');
    expect(html).toContain('data-testid="collapsed-hand-bar"');
    expect(html).toContain('Hand Hidden • Click to show 4 cards');
    expect(html).toContain('Show Hand ▲');
  });

  it('preserves selected count and card counts in collapsed state', () => {
    const html = renderToString(
      <PlayerHand
        cards={mockCards}
        selectedCardIds={['c1', 'c2']}
        isCollapsed={true}
      />
    );

    expect(html).toContain('data-testid="selected-count"');
    expect(html).toContain('2 selected');
    expect(html).toContain('data-testid="card-count"');
    expect(html).toContain('4 cards');
    expect(html).toContain('data-testid="collapsed-hand-bar"');
  });

  it('does not render random quick-collapse button on the tray to save vertical space', () => {
    const html = renderToString(<PlayerHand cards={mockCards} isCollapsed={false} />);
    expect(html).not.toContain('data-testid="btn-tray-quick-collapse"');
  });

  describe('TopNavBar Hand Visibility Toggle', () => {
    const mockPlayers = [
      { id: 'p1', name: 'Player 1', team: 'A' as const, cardCount: 13 },
      { id: 'p2', name: 'Player 2', team: 'B' as const, cardCount: 13 },
    ];

    it('renders "Hide Cards" in TopNavBar when onToggleHandCollapse is provided and hand is expanded', () => {
      const html = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={vi.fn()}
          onOpenRules={vi.fn()}
          players={mockPlayers}
          currentPlayerIndex={0}
          isHandCollapsed={false}
          onToggleHandCollapse={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="btn-top-nav-toggle-hand"');
      expect(html).toContain('aria-label="Hide Cards"');
      expect(html).toContain('Hide Cards');
    });

    it('renders "Show Cards" in TopNavBar when hand is collapsed', () => {
      const html = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={vi.fn()}
          onOpenRules={vi.fn()}
          players={mockPlayers}
          currentPlayerIndex={0}
          isHandCollapsed={true}
          onToggleHandCollapse={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="btn-top-nav-toggle-hand"');
      expect(html).toContain('aria-label="Show Cards"');
      expect(html).toContain('Show Cards');
    });
  });

  describe('App Integration - Hand Collapse across BOTS, LOCAL, and MULTIPLAYER Modes', () => {
    it('renders both TopNavBar and PlayerHand collapse buttons in BOTS mode with zero scrollbars on header', () => {
      const html = renderToString(
        <App initialScreen="GAME" initialMode="BOTS" />
      );

      expect(html).toContain('data-testid="top-nav-bar"');
      expect(html).toContain('data-testid="btn-top-nav-toggle-hand"');
      expect(html).toContain('data-testid="player-hand"');
      expect(html).toContain('data-testid="btn-toggle-hand-collapse"');
      expect(html).not.toContain('data-testid="btn-tray-quick-collapse"');

      // Verify no horizontal scrollbars on header
      expect(html).toContain('overflow-x-hidden');
      expect(html).not.toContain('scrollbar-none');
    });

    it('renders both TopNavBar and PlayerHand collapse buttons in LOCAL Pass & Play mode with zero scrollbars on header', () => {
      const html = renderToString(
        <App initialScreen="GAME" initialMode="LOCAL" />
      );

      expect(html).toContain('data-testid="top-nav-bar"');
      expect(html).toContain('data-testid="btn-top-nav-toggle-hand"');
      expect(html).toContain('data-testid="player-hand"');
      expect(html).toContain('data-testid="btn-toggle-hand-collapse"');
      expect(html).not.toContain('data-testid="btn-tray-quick-collapse"');

      // Verify no horizontal scrollbars on header
      expect(html).toContain('overflow-x-hidden');
      expect(html).not.toContain('scrollbar-none');
    });

    it('renders both TopNavBar and PlayerHand collapse buttons in MULTIPLAYER mode with zero scrollbars on header', () => {
      const mockMultiplayerHook: any = {
        connectionStatus: 'CONNECTED',
        roomCode: 'TEST',
        isHost: true,
        isInLobby: false,
        isInGame: true,
        lobbySeats: [
          { seatIndex: 0, playerId: 'p1', playerName: 'Alice', isHost: true, isConnected: true },
          { seatIndex: 1, playerId: 'p2', playerName: 'Bob', isHost: false, isConnected: true },
          { seatIndex: 2, playerId: 'p3', playerName: 'Charlie', isHost: false, isConnected: true },
          { seatIndex: 3, playerId: 'p4', playerName: 'Dave', isHost: false, isConnected: true },
        ],
        gameState: {
          roundNumber: 1,
          phase: 'DRAW',
          activeTurnIndex: 0,
          currentViewIndex: 0,
          dealerIndex: 3,
          stockDeckCount: 40,
          discardPile: [{ id: 'd1', rank: 7, suit: 'SPADES' }],
          pukarPoolCount: 2,
          roundStatus: 'PLAYING',
          melds: { A: [], B: [] },
          scores: { A: 0, B: 0 },
          turnTimeRemaining: 30,
          players: [
            { id: 'p1', name: 'Alice', team: 'A', hand: [{ id: 'c1', rank: 10, suit: 'SPADES' }], cardCount: 1 },
            { id: 'p2', name: 'Bob', team: 'B', cardCount: 13 },
            { id: 'p3', name: 'Charlie', team: 'A', cardCount: 13 },
            { id: 'p4', name: 'Dave', team: 'B', cardCount: 13 },
          ],
        },
        mySeatIndex: 0,
        myPlayerId: 'p1',
        errorMessage: null,
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        selectSeat: vi.fn(),
        startGame: vi.fn(),
        dispatchAction: vi.fn(),
        kickPlayer: vi.fn(),
        leaveRoom: vi.fn(),
        endGame: vi.fn(),
        clearError: vi.fn(),
      };

      const html = renderToString(
        <App initialScreen="GAME" initialMode="MULTIPLAYER" multiplayerGameHook={mockMultiplayerHook} />
      );

      expect(html).toContain('data-testid="top-nav-bar"');
      expect(html).toContain('data-testid="btn-top-nav-toggle-hand"');
      expect(html).toContain('data-testid="player-hand"');
      expect(html).toContain('data-testid="btn-toggle-hand-collapse"');
      expect(html).not.toContain('data-testid="btn-tray-quick-collapse"');

      // Verify no horizontal scrollbars on header
      expect(html).toContain('overflow-x-hidden');
      expect(html).not.toContain('scrollbar-none');
    });
  });
});
