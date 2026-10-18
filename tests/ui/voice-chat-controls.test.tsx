import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TopNavBar, PlayerInfo, VoiceChatControlProps } from '../../src/ui/components/TopNavBar';
import { App } from '../../src/App';
import { UseMultiplayerGameReturn } from '../../src/network/types';
import { SanitizedGameState } from '../../src/engine/types';

describe('Voice Chat Controls in Menu Bar (TopNavBar)', () => {
  const samplePlayers: PlayerInfo[] = [
    { id: 'host-1', name: 'Alice (Host)', team: 'A', cardCount: 13, isConnected: true },
    { id: 'player-2', name: 'Bob', team: 'B', cardCount: 13, isConnected: true },
    { id: 'player-3', name: 'Charlie', team: 'A', cardCount: 13, isConnected: true },
    { id: 'player-4', name: 'Diana', team: 'B', cardCount: 13, isConnected: true },
  ];

  it('does not render voice controls when voiceChat prop is not provided (local or offline mode)', () => {
    const html = renderToString(
      <TopNavBar
        activeTab="table"
        onTabChange={vi.fn()}
        onOpenRules={vi.fn()}
        players={samplePlayers}
        currentPlayerIndex={0}
      />
    );

    expect(html).not.toContain('data-testid="btn-mic-toggle"');
    expect(html).not.toContain('data-testid="btn-mic-locked"');
    expect(html).not.toContain('data-testid="btn-admin-voice-dropdown"');
  });

  it('renders Join Voice button when player is not yet in voice chat', () => {
    const voiceProps: VoiceChatControlProps = {
      isVoiceSupported: true,
      isVoiceActive: false,
      isMuted: true,
      isHardMuted: false,
      onToggleMic: vi.fn(),
      isAdmin: false,
    };

    const html = renderToString(
      <TopNavBar
        activeTab="table"
        onTabChange={vi.fn()}
        onOpenRules={vi.fn()}
        players={samplePlayers}
        currentPlayerIndex={0}
        voiceChat={voiceProps}
      />
    );

    expect(html).toContain('data-testid="btn-mic-toggle"');
    expect(html).toContain('Join Voice');
    expect(html).not.toContain('data-testid="btn-admin-voice-dropdown"');
  });

  it('renders Mic Active with emerald styling when voice is active and unmuted', () => {
    const voiceProps: VoiceChatControlProps = {
      isVoiceSupported: true,
      isVoiceActive: true,
      isMuted: false,
      isHardMuted: false,
      onToggleMic: vi.fn(),
      isAdmin: false,
    };

    const html = renderToString(
      <TopNavBar
        activeTab="table"
        onTabChange={vi.fn()}
        onOpenRules={vi.fn()}
        players={samplePlayers}
        currentPlayerIndex={0}
        voiceChat={voiceProps}
      />
    );

    expect(html).toContain('data-testid="btn-mic-toggle"');
    expect(html).toContain('Mic Active');
    expect(html).toContain('bg-emerald-950');
  });

  it('renders Mic Muted when voice is active but muted', () => {
    const voiceProps: VoiceChatControlProps = {
      isVoiceSupported: true,
      isVoiceActive: true,
      isMuted: true,
      isHardMuted: false,
      onToggleMic: vi.fn(),
      isAdmin: false,
    };

    const html = renderToString(
      <TopNavBar
        activeTab="table"
        onTabChange={vi.fn()}
        onOpenRules={vi.fn()}
        players={samplePlayers}
        currentPlayerIndex={0}
        voiceChat={voiceProps}
      />
    );

    expect(html).toContain('data-testid="btn-mic-toggle"');
    expect(html).toContain('Mic Muted');
  });

  it('renders disabled [Mic Locked] button when player is hard-muted by the admin', () => {
    const voiceProps: VoiceChatControlProps = {
      isVoiceSupported: true,
      isVoiceActive: true,
      isMuted: true,
      isHardMuted: true,
      onToggleMic: vi.fn(),
      isAdmin: false,
    };

    const html = renderToString(
      <TopNavBar
        activeTab="table"
        onTabChange={vi.fn()}
        onOpenRules={vi.fn()}
        players={samplePlayers}
        currentPlayerIndex={0}
        voiceChat={voiceProps}
      />
    );

    expect(html).toContain('data-testid="btn-mic-locked"');
    expect(html).toContain('disabled');
    expect(html).toContain('Mic Locked');
    expect(html).toContain('Microphone locked by room host');
    expect(html).not.toContain('data-testid="btn-mic-toggle"');
  });

  it('renders Admin Moderation Dropdown Caret for room host/admin', () => {
    const voiceProps: VoiceChatControlProps = {
      isVoiceSupported: true,
      isVoiceActive: true,
      isMuted: false,
      isHardMuted: false,
      onToggleMic: vi.fn(),
      isAdmin: true,
      myPlayerId: 'host-1',
      onAdminMutePlayer: vi.fn(),
    };

    const html = renderToString(
      <TopNavBar
        activeTab="table"
        onTabChange={vi.fn()}
        onOpenRules={vi.fn()}
        players={samplePlayers}
        currentPlayerIndex={0}
        voiceChat={voiceProps}
      />
    );

    expect(html).toContain('data-testid="btn-admin-voice-dropdown"');
    expect(html).toContain('Admin Voice Moderation');
  });

  it('displays player voice status badges in the avatar roster', () => {
    const voiceProps: VoiceChatControlProps = {
      isVoiceSupported: true,
      isVoiceActive: true,
      isMuted: false,
      isHardMuted: false,
      onToggleMic: vi.fn(),
      isAdmin: false,
      playerVoiceStates: {
        'host-1': { isMuted: false, isHardMuted: false, isSpeaking: true },
        'player-2': { isMuted: true, isHardMuted: false },
        'player-3': { isMuted: true, isHardMuted: true },
      },
    };

    const html = renderToString(
      <TopNavBar
        activeTab="table"
        onTabChange={vi.fn()}
        onOpenRules={vi.fn()}
        players={samplePlayers}
        currentPlayerIndex={0}
        voiceChat={voiceProps}
      />
    );

    // host-1 is active/speaking
    expect(html).toContain('data-testid="voice-active-0"');
    // player-2 is muted
    expect(html).toContain('data-testid="voice-muted-1"');
    // player-3 is hard-muted / locked
    expect(html).toContain('data-testid="voice-locked-2"');
  });

  it('renders TopNavBar voice chat controls in App when in active multiplayer mode', () => {
    const mockMultiplayerHook: UseMultiplayerGameReturn = {
      connectionStatus: 'CONNECTED',
      roomCode: 'WXYZ',
      isHost: true,
      isInLobby: false,
      isInGame: true,
      lobbySeats: [
        { seatIndex: 0, playerId: 'p1', playerName: 'Alice', team: 'A', isConnected: true, isHost: true },
        { seatIndex: 1, playerId: 'p2', playerName: 'Bob', team: 'B', isConnected: true, isHost: false },
        { seatIndex: 2, playerId: 'p3', playerName: 'Charlie', team: 'A', isConnected: true, isHost: false },
        { seatIndex: 3, playerId: 'p4', playerName: 'Diana', team: 'B', isConnected: true, isHost: false },
      ],
      gameState: {
        roundStatus: 'PLAYING',
        currentTurn: 0,
        playerCount: 4,
        players: [
          { id: 'p1', name: 'Alice', team: 'A', cardCount: 13 },
          { id: 'p2', name: 'Bob', team: 'B', cardCount: 13 },
          { id: 'p3', name: 'Charlie', team: 'A', cardCount: 13 },
          { id: 'p4', name: 'Diana', team: 'B', cardCount: 13 },
        ],
        melds: { A: [], B: [] },
        discardPile: [],
        stockDeckCount: 50,
        pukarPoolCount: 3,
        phase: 'DRAW',
      } as unknown as SanitizedGameState,
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
      claimHost: vi.fn(),
      sendClientMessage: vi.fn(),
      subscribeServerMessage: vi.fn(),
    };

    const html = renderToString(
      <App initialMode="MULTIPLAYER" initialScreen="GAME" multiplayerGameHook={mockMultiplayerHook} />
    );

    // Confirms mic toggle button and admin dropdown caret are rendered on the menu bar
    expect(html).toContain('data-testid="top-nav-bar"');
    expect(html).toContain('data-testid="btn-mic-toggle"');
    expect(html).toContain('data-testid="btn-admin-voice-dropdown"');
  });
});
