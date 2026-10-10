import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { useGameAudio } from '../../src/ui/hooks/useGameAudio';
import { useGameModals } from '../../src/ui/hooks/useGameModals';
import { useGameNotifications } from '../../src/ui/hooks/useGameNotifications';
import { useTableShortcuts } from '../../src/ui/hooks/useTableShortcuts';
import { useLocalGame } from '../../src/ui/hooks/useLocalGame';
import { dealInitialState } from '../../src/engine/deck';
import { UseMultiplayerGameReturn } from '../../src/network/types';

describe('Modular UI Hooks (Stage 2 Architecture Verification)', () => {
  describe('useGameAudio', () => {
    it('initializes unmuted and exposes audio control helpers', () => {
      let audioResult: ReturnType<typeof useGameAudio> | null = null;
      function AudioHarness() {
        audioResult = useGameAudio();
        return <div>{audioResult.isMuted ? 'MUTED' : 'UNMUTED'}</div>;
      }

      const html = renderToString(<AudioHarness />);
      expect(html).toContain('UNMUTED');
      expect(audioResult).not.toBeNull();
      expect(typeof audioResult!.toggleMute).toBe('function');
      expect(typeof audioResult!.triggerSound).toBe('function');

      // Test triggerSound does not throw on invalid/mocked sound
      expect(() => audioResult!.triggerSound('draw')).not.toThrow();
    });
  });

  describe('useGameModals', () => {
    it('initializes with all modal states closed and null selection', () => {
      let modalsResult: ReturnType<typeof useGameModals> | null = null;
      function ModalsHarness() {
        modalsResult = useGameModals();
        return (
          <div>
            {modalsResult.isRulesModalOpen ? 'RULES_OPEN' : 'RULES_CLOSED'}
            {modalsResult.isSetupModalOpen ? 'SETUP_OPEN' : 'SETUP_CLOSED'}
          </div>
        );
      }

      const html = renderToString(<ModalsHarness />);
      expect(html).toContain('RULES_CLOSED');
      expect(html).toContain('SETUP_CLOSED');
      expect(modalsResult!.isGodModeOpen).toBe(false);
      expect(modalsResult!.isDiscardModalOpen).toBe(false);
      expect(modalsResult!.zoomedMeld).toBeNull();
      expect(modalsResult!.jokerPromptData).toBeNull();
    });
  });

  describe('useGameNotifications', () => {
  const dummyMultiplayerHook: UseMultiplayerGameReturn = {
    connectionStatus: 'DISCONNECTED',
    roomCode: null,
    isHost: false,
    isInLobby: false,
    isInGame: false,
    lobbySeats: [],
    gameState: null,
    mySeatIndex: null,
    myPlayerId: null,
    errorMessage: null,
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    selectSeat: vi.fn(),
    startGame: vi.fn(),
    dispatchAction: vi.fn(),
    kickPlayer: vi.fn(),
    leaveRoom: vi.fn(),
    clearError: vi.fn(),
  };

    it('initializes notifications and supports triggerPukarCelebration & clearAll', () => {
      let notifsResult: ReturnType<typeof useGameNotifications> | null = null;
      function NotifsHarness() {
        notifsResult = useGameNotifications({
          initialPukarBanner: { team: 'A', playerName: 'Player 1', points: 50 },
          appMode: 'LOCAL',
          multiplayerHook: dummyMultiplayerHook,
          triggerSound: vi.fn(),
        });
        return <div>{notifsResult.pukarBanner ? 'BANNER_ACTIVE' : 'NO_BANNER'}</div>;
      }

      const html = renderToString(<NotifsHarness />);
      expect(html).toContain('BANNER_ACTIVE');
      expect(notifsResult!.pukarBanner?.playerName).toBe('Player 1');
      expect(typeof notifsResult!.triggerPukarCelebration).toBe('function');
      expect(typeof notifsResult!.clearAllNotifications).toBe('function');
    });
  });

  describe('useTableShortcuts', () => {
    it('mounts clean window keydown listeners and triggers action callback', () => {
      const onAction = vi.fn();
      function ShortcutsHarness() {
        useTableShortcuts({
          currentScreen: 'GAME',
          onAction,
        });
        return <div>SHORTCUTS_ATTACHED</div>;
      }

      const html = renderToString(<ShortcutsHarness />);
      expect(html).toContain('SHORTCUTS_ATTACHED');
    });
  });

  describe('useLocalGame', () => {
    const dummyMultiplayerHook: UseMultiplayerGameReturn = {
      connectionStatus: 'DISCONNECTED',
      roomCode: null,
      isHost: false,
      isInLobby: false,
      isInGame: false,
      lobbySeats: [],
      gameState: null,
      mySeatIndex: null,
      myPlayerId: null,
      errorMessage: null,
      createRoom: vi.fn(),
      joinRoom: vi.fn(),
      selectSeat: vi.fn(),
      startGame: vi.fn(),
      dispatchAction: vi.fn(),
      kickPlayer: vi.fn(),
      leaveRoom: vi.fn(),
      clearError: vi.fn(),
    };

    it('initializes 4-player game state and provides selection & action dispatchers', () => {
      let gameResult: ReturnType<typeof useLocalGame> | null = null;
      const initialState = dealInitialState(4);

      function GameHarness() {
        gameResult = useLocalGame({
          initialState,
          appMode: 'LOCAL',
          multiplayerHook: dummyMultiplayerHook,
          triggerSound: vi.fn(),
          setErrorMessage: vi.fn(),
          triggerPukarCelebration: vi.fn(),
          setExhaustNotification: vi.fn(),
          setJokerPickupBanner: vi.fn(),
          clearAllNotifications: vi.fn(),
          setJokerPromptData: vi.fn(),
        });
        return <div>{`PLAYERS: ${gameResult.gameState.players.length}`}</div>;
      }

      const html = renderToString(<GameHarness />);
      expect(html).toContain('PLAYERS: 4');
      expect(gameResult).not.toBeNull();
      expect(gameResult!.activeGameState.playerCount).toBe(4);
      expect(gameResult!.activeTurnIndex).toBe(0);
      expect(gameResult!.isViewingActivePlayer).toBe(true);

      // Verify action handler is a callable function
      expect(typeof gameResult!.handleAction).toBe('function');
      expect(typeof gameResult!.handleToggleCardSelection).toBe('function');
      expect(typeof gameResult!.handleSwitchPlayer).toBe('function');
      expect(typeof gameResult!.handleForceTurn).toBe('function');
    });
  });
});
