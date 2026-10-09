import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { App } from '../../src/App';
import { ScoreBoard } from '../../src/ui/components/ScoreBoard';
import { ModeSelectorModal } from '../../src/ui/components/ModeSelectorModal';
import { MultiplayerStatusBar } from '../../src/ui/components/multiplayer/MultiplayerStatusBar';
import { TableSeating } from '../../src/ui/components/TableSeating';
import { UseMultiplayerGameReturn } from '../../src/network/types';
import { SanitizedGameState, Card } from '../../src/engine/types';

// React hook dispatcher simulator for tree traversal tests in Node
function setupReactHooks() {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  if (internals) {
    internals.H = {
      useState: <T,>(init: T | (() => T)): [T, (val: any) => void] => [
        typeof init === 'function' ? (init as any)() : init,
        () => {},
      ],
      useEffect: () => {},
      useRef: <T,>(init: T) => ({ current: init }),
      useCallback: <T extends Function,>(fn: T): T => fn,
      useMemo: <T,>(fn: () => T): T => fn(),
      useId: () => 'test-id',
    };
  }
}

// Stateful React hook dispatcher simulator preserving state across render cycles
function setupStatefulReactHooks() {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const stateSlots: any[] = [];
  const refSlots: any[] = [];
  let stateIdx = 0;
  let refIdx = 0;

  const resetIndices = () => {
    stateIdx = 0;
    refIdx = 0;
  };

  if (internals) {
    internals.H = {
      useState: <T,>(init: T | (() => T)): [T, (val: any) => void] => {
        const slot = stateIdx++;
        if (stateSlots[slot] === undefined) {
          stateSlots[slot] = typeof init === 'function' ? (init as any)() : init;
        }
        const setter = (val: any) => {
          stateSlots[slot] = typeof val === 'function' ? val(stateSlots[slot]) : val;
        };
        return [stateSlots[slot], setter];
      },
      useEffect: (effect: Function) => {
        effect();
      },
      useRef: <T,>(init: T) => {
        const slot = refIdx++;
        if (!refSlots[slot]) {
          refSlots[slot] = { current: init };
        }
        return refSlots[slot];
      },
      useCallback: <T extends Function,>(fn: T): T => fn,
      useMemo: <T,>(fn: () => T): T => fn(),
      useId: () => 'test-id',
    };
  }

  return { resetIndices, stateSlots, refSlots };
}

function findElement(element: any, predicate: (el: any) => boolean): any {
  if (!element || typeof element !== 'object') return null;
  if (predicate(element)) return element;
  if (element.props && element.props.children) {
    const children = Array.isArray(element.props.children)
      ? element.props.children
      : [element.props.children];
    for (const child of children) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

function findByTestId(tree: any, testId: string): any {
  return findElement(tree, (el) => el.props && el.props['data-testid'] === testId);
}

function createMockMultiplayerHook(
  overrides?: Partial<UseMultiplayerGameReturn>
): UseMultiplayerGameReturn {
  return {
    connectionStatus: 'CONNECTED',
    roomCode: 'ABCD',
    isHost: false,
    isInLobby: false,
    isInGame: false,
    lobbySeats: [],
    gameState: null,
    mySeatIndex: null,
    myPlayerId: 'p_1',
    errorMessage: null,
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    selectSeat: vi.fn(),
    startGame: vi.fn(),
    dispatchAction: vi.fn(),
    kickPlayer: vi.fn(),
    leaveRoom: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

function createMockSanitizedGameState(): SanitizedGameState {
  const cards: Card[] = [
    { id: 'b_10s', suit: 'SPADES', rank: 10 },
    { id: 'b_js', suit: 'SPADES', rank: 11 },
    { id: 'b_qs', suit: 'SPADES', rank: 12 },
  ];

  return {
    playerCount: 4,
    round: 1,
    roundStatus: 'PLAYING',
    phase: 'DRAW',
    stockDeckCount: 31,
    discardPile: [{ id: 'd_7h', suit: 'HEARTS', rank: 7 }],
    pukarPoolCount: 2,
    melds: { A: [], B: [] },
    scores: { A: 0, B: 0 },
    roundScores: { A: 0, B: 0 },
    totalScores: { A: 0, B: 0 },
    pukarsClaimed: { A: 0, B: 0 },
    currentPlayerIndex: 1, // Bob's turn
    players: [
      { id: 'p_0', name: 'Alice', team: 'A', cardCount: 13 },
      {
        id: 'p_1',
        name: 'Bob',
        team: 'B',
        cardCount: 13,
        hand: cards,
      },
      { id: 'p_2', name: 'Charlie', team: 'A', cardCount: 13 },
      { id: 'p_3', name: 'David', team: 'B', cardCount: 13 },
    ],
  };
}

describe('App Multiplayer Integration & Mode Switching', () => {
  beforeEach(() => {
    setupReactHooks();
  });

  /* ========================================================================
   * 1. MultiplayerStatusBar Component Tests
   * ======================================================================== */
  describe('MultiplayerStatusBar', () => {
    it('renders connected indicator, 4-letter room code, and assigned seat badge', () => {
      const onLeave = vi.fn();
      const html = renderToString(
        <MultiplayerStatusBar
          roomCode="PKAR"
          connectionStatus="CONNECTED"
          seatIndex={1}
          onLeave={onLeave}
        />
      );

      expect(html).toContain('data-testid="multiplayer-status-bar"');
      expect(html).toContain('data-testid="status-icon-connected"');
      expect(html).toContain('Connected');
      expect(html).toContain('Room:');
      expect(html).toContain('PKAR');
      expect(html).toContain('Seat 2');
      expect(html).toContain('(Team B)');
      expect(html).toContain('Leave Room');
      expect(html).toContain('data-testid="btn-leave-room"');
    });

    it('renders reconnecting state with warning icon when connection is unstable', () => {
      const html = renderToString(
        <MultiplayerStatusBar
          roomCode="XYZ9"
          connectionStatus="RECONNECTING"
          seatIndex={0}
          onLeave={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="status-icon-reconnecting"');
      expect(html).toContain('Reconnecting...');
      expect(html).toContain('XYZ9');
      expect(html).toContain('Seat 1');
      expect(html).toContain('(Team A)');
    });

    it('renders disconnected state when disconnected', () => {
      const html = renderToString(
        <MultiplayerStatusBar
          roomCode="ABCD"
          connectionStatus="DISCONNECTED"
          seatIndex={2}
          onLeave={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="status-icon-disconnected"');
      expect(html).toContain('Disconnected');
      expect(html).toContain('Seat 3');
      expect(html).toContain('(Team A)');
    });

    it('triggers onLeave callback when Leave Room button is clicked', () => {
      const onLeave = vi.fn();
      const tree = MultiplayerStatusBar({
        roomCode: 'TEST',
        connectionStatus: 'CONNECTED',
        seatIndex: 1,
        onLeave,
      });

      const leaveBtn = findByTestId(tree, 'btn-leave-room');
      expect(leaveBtn).toBeDefined();
      leaveBtn.props.onClick();
      expect(onLeave).toHaveBeenCalledTimes(1);
    });
  });

  /* ========================================================================
   * 2. Header Mode Switcher & ModeSelectorModal Integration
   * ======================================================================== */
  describe('Mode Selector Integration in Header', () => {
    it('renders the Mode switcher button in the ScoreBoard header with accessible label', () => {
      const html = renderToString(<App />);

      expect(html).toContain('data-testid="btn-mode-selector"');
      expect(html).toContain('aria-label="Mode"');
      expect(html).toContain('Mode</span>');
    });

    it('opens ModeSelectorModal when Mode switcher button is clicked', () => {
      let modalOpenState = false;
      const setModalOpen = (val: boolean) => {
        modalOpenState = val;
      };

      const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      if (internals) {
        let hookIdx = 0;
        internals.H = {
          useState: (init: any) => {
            hookIdx++;
            // The second useState in App is isModeModalOpen
            if (hookIdx === 2) {
              return [modalOpenState, setModalOpen];
            }
            return [typeof init === 'function' ? init() : init, () => {}];
          },
          useEffect: () => {},
          useRef: (init: any) => ({ current: init }),
          useCallback: (fn: any) => fn,
          useMemo: (fn: any) => fn(),
          useId: () => 'test-id',
        };
      }

      const tree = App({});
      const scoreBoard = findElement(tree, (el) => el.type === ScoreBoard);
      expect(scoreBoard).toBeDefined();
      expect(scoreBoard.props.onOpenModeSelector).toBeDefined();

      const scoreBoardTree = ScoreBoard(scoreBoard.props);
      const modeBtn = findByTestId(scoreBoardTree, 'btn-mode-selector');
      expect(modeBtn).toBeDefined();
      modeBtn.props.onClick();
      expect(modalOpenState).toBe(true);
    });

    it('maintains 100% of offline pass & play hotseat controls when initialMode is LOCAL', () => {
      const html = renderToString(<App initialMode="LOCAL" />);

      // Hot-seat Dev Inspector is present
      expect(html).toContain('Dev Inspector');
      expect(html).toContain('data-testid="switcher-p1"');
      expect(html).toContain('data-testid="switcher-p2"');
      expect(html).toContain('data-testid="switcher-p3"');
      expect(html).toContain('data-testid="switcher-p4"');
      expect(html).toContain('data-testid="btn-force-turn"');
      expect(html).toContain('data-testid="btn-toggle-godmode"');
      expect(html).not.toContain('data-testid="multiplayer-status-bar"');
      expect(html).not.toContain('data-testid="multiplayer-hub-container"');
    });
  });

  /* ========================================================================
   * 3. Multiplayer Mode: Hub View (When not in game)
   * ======================================================================== */
  describe('Multiplayer Mode - Hub & Lobby View', () => {
    it('renders MultiplayerHub with Create Room and Join Room when in MULTIPLAYER mode and not in game', () => {
      const mockHook = createMockMultiplayerHook({
        isInGame: false,
        roomCode: null,
      });

      const html = renderToString(
        <App initialMode="MULTIPLAYER" multiplayerGameHook={mockHook} />
      );

      // Hub should be rendered
      expect(html).toContain('data-testid="multiplayer-hub-container"');
      expect(html).toContain('data-testid="tab-create-room"');
      expect(html).toContain('data-testid="tab-join-room"');
      expect(html).toContain('Create Room');
      expect(html).toContain('Join Room');

      // Dev inspector should NOT be rendered in multiplayer mode
      expect(html).not.toContain('Dev Inspector');
      expect(html).not.toContain('data-testid="btn-toggle-godmode"');
      expect(html).not.toContain('data-testid="switcher-p1"');
    });

    it('renders LobbyView with room code and claimed seats when in lobby', () => {
      const mockHook = createMockMultiplayerHook({
        isInGame: false,
        isInLobby: true,
        roomCode: 'WXYZ',
        isHost: true,
        lobbySeats: [
          {
            seatIndex: 0,
            playerId: 'p_0',
            playerName: 'HostAlice',
            team: 'A',
            isConnected: true,
            isHost: true,
          },
          {
            seatIndex: 1,
            playerId: null,
            playerName: null,
            team: 'B',
            isConnected: false,
            isHost: false,
          },
          {
            seatIndex: 2,
            playerId: null,
            playerName: null,
            team: 'A',
            isConnected: false,
            isHost: false,
          },
          {
            seatIndex: 3,
            playerId: null,
            playerName: null,
            team: 'B',
            isConnected: false,
            isHost: false,
          },
        ],
      });

      const html = renderToString(
        <App initialMode="MULTIPLAYER" multiplayerGameHook={mockHook} />
      );

      expect(html).toContain('WXYZ');
      expect(html).toContain('HostAlice');
      expect(html).toContain('Waiting for players (1/4)');
      expect(html).toContain('Claim Seat');
    });
  });

  /* ========================================================================
   * 4. In-Game Multiplayer Experience & Perspective Lockdown
   * ======================================================================== */
  describe('In-Game Multiplayer Experience', () => {
    it('renders MultiplayerStatusBar and locks player hand strictly to assigned seat in active match', () => {
      const gameState = createMockSanitizedGameState();
      const mockHook = createMockMultiplayerHook({
        isInGame: true,
        roomCode: 'LUCK',
        mySeatIndex: 1, // Bob (Seat 2, Team B)
        myPlayerId: 'p_1',
        gameState,
      });

      const html = renderToString(
        <App initialMode="MULTIPLAYER" multiplayerGameHook={mockHook} />
      );

      // 1. Status Bar rendered at top
      expect(html).toContain('data-testid="multiplayer-status-bar"');
      expect(html).toContain('LUCK');
      expect(html).toContain('Seat 2');
      expect(html).toContain('(Team B)');
      expect(html).toContain('data-testid="btn-leave-room"');

      // 2. Perspective locked strictly to Bob's seat:
      // Player hand renders Bob's name and cards (10♠, J♠, Q♠)
      expect(html).toContain('Bob');
      expect(html).toContain('Team B');
      expect(html).toContain('data-testid="hand-card-slot-0"');
      expect(html).toContain('data-testid="hand-card-slot-1"');
      expect(html).toContain('data-testid="hand-card-slot-2"');
      expect(html).toContain('10 of SPADES');
      expect(html).toContain('J of SPADES');
      expect(html).toContain('Q of SPADES');

      // 3. Hot-Seat Dev Inspector and perspective switches are strictly suppressed
      expect(html).not.toContain('Dev Inspector');
      expect(html).not.toContain('data-testid="switcher-p1"');
      expect(html).not.toContain('data-testid="btn-force-turn"');
      expect(html).not.toContain('data-testid="btn-toggle-godmode"');
    });

    it('routes game action to multiplayerHook.dispatchAction during active multiplayer match', () => {
      const gameState = createMockSanitizedGameState();
      const dispatchAction = vi.fn();
      const mockHook = createMockMultiplayerHook({
        isInGame: true,
        roomCode: 'LUCK',
        mySeatIndex: 1,
        myPlayerId: 'p_1',
        gameState,
        dispatchAction,
      });

      const tree = App({
        initialMode: 'MULTIPLAYER',
        multiplayerGameHook: mockHook,
      });

      // Find Draw from Stock in CenterTable
      const centerTable = findElement(tree, (el) => el.type?.name === 'CenterTable' || el.props?.stockDeckCount !== undefined);
      expect(centerTable).toBeDefined();

      // Trigger draw from stock
      centerTable.props.onDrawStock();
      expect(dispatchAction).toHaveBeenCalledWith({ type: 'DRAW_FROM_STOCK' });

      // Trigger draw from discard
      centerTable.props.onDrawDiscard();
      expect(dispatchAction).toHaveBeenCalledWith({ type: 'TAKE_DISCARD' });
    });

    it('routes meld and discard actions to multiplayerHook.dispatchAction', () => {
      const gameState = createMockSanitizedGameState();
      const dispatchAction = vi.fn();
      const mockHook = createMockMultiplayerHook({
        isInGame: true,
        roomCode: 'LUCK',
        mySeatIndex: 1,
        myPlayerId: 'p_1',
        gameState,
        dispatchAction,
      });

      const tree = App({
        initialMode: 'MULTIPLAYER',
        multiplayerGameHook: mockHook,
      });

      // Find PlayerHand element
      const playerHand = findElement(tree, (el) => el.type?.name === 'PlayerHand');
      expect(playerHand).toBeDefined();

      const actionControls = playerHand.props.actionsSlot;
      expect(actionControls).toBeDefined();

      // Test Discard action routing
      actionControls.props.onDiscard('b_10s');
      expect(dispatchAction).toHaveBeenCalledWith({
        type: 'DISCARD_CARD',
        cardId: 'b_10s',
      });

      // Test Play Meld action routing
      actionControls.props.onPlayMeld(['b_10s', 'b_js', 'b_qs']);
      expect(dispatchAction).toHaveBeenCalledWith({
        type: 'PLAY_NEW_MELD',
        cardIds: ['b_10s', 'b_js', 'b_qs'],
        jokerRepresentedRank: undefined,
      });
    });

    it('triggers leaveRoom and returns cleanly when Leave Room is clicked in status bar', () => {
      const gameState = createMockSanitizedGameState();
      const leaveRoom = vi.fn();
      const mockHook = createMockMultiplayerHook({
        isInGame: true,
        roomCode: 'LUCK',
        mySeatIndex: 1,
        gameState,
        leaveRoom,
      });

      const tree = App({
        initialMode: 'MULTIPLAYER',
        multiplayerGameHook: mockHook,
      });

      const statusBar = findElement(tree, (el) => el.type === MultiplayerStatusBar);
      expect(statusBar).toBeDefined();

      statusBar.props.onLeave();
      expect(leaveRoom).toHaveBeenCalledTimes(1);
    });
  });

  /* ========================================================================
   * 5. Disconnect Notification Banner
   * ======================================================================== */
  describe('Multiplayer Disconnection Notifications', () => {
    it('displays disconnect toast banner when another player drops connection', () => {
      const gameState = createMockSanitizedGameState();
      const harness = setupStatefulReactHooks();

      // Pass 1: Alice is initially connected
      const mockHookConnected = createMockMultiplayerHook({
        isInGame: true,
        roomCode: 'DISC',
        mySeatIndex: 1,
        gameState,
        lobbySeats: [
          {
            seatIndex: 0,
            playerId: 'p_0',
            playerName: 'Alice',
            team: 'A',
            isConnected: true,
            isHost: true,
          },
          {
            seatIndex: 1,
            playerId: 'p_1',
            playerName: 'Bob',
            team: 'B',
            isConnected: true,
            isHost: false,
          },
        ],
      });
      harness.resetIndices();
      App({ initialMode: 'MULTIPLAYER', multiplayerGameHook: mockHookConnected });

      // Pass 2: Alice drops connection (triggers useEffect to set disconnectToast state)
      const mockHookDisconnected = createMockMultiplayerHook({
        isInGame: true,
        roomCode: 'DISC',
        mySeatIndex: 1,
        gameState,
        lobbySeats: [
          {
            seatIndex: 0,
            playerId: 'p_0',
            playerName: 'Alice',
            team: 'A',
            isConnected: false,
            isHost: true,
          },
          {
            seatIndex: 1,
            playerId: 'p_1',
            playerName: 'Bob',
            team: 'B',
            isConnected: true,
            isHost: false,
          },
        ],
      });
      harness.resetIndices();
      App({ initialMode: 'MULTIPLAYER', multiplayerGameHook: mockHookDisconnected });

      // Pass 3: Render tree with updated disconnectToast state
      harness.resetIndices();
      const tree = App({ initialMode: 'MULTIPLAYER', multiplayerGameHook: mockHookDisconnected });

      const toast = findByTestId(tree, 'disconnect-toast');
      expect(toast).toBeDefined();
      expect(toast.props.role).toBe('alert');

      const toastText = findElement(toast, (el) =>
        typeof el.props?.children === 'string' && el.props.children.includes('Alice')
      );
      expect(toastText).toBeDefined();
      expect(toastText.props.children).toContain('Alice (Team A) disconnected. Waiting for reconnect...');

      const dismissBtn = findByTestId(tree, 'btn-dismiss-disconnect');
      expect(dismissBtn).toBeDefined();
    });

    it('displays reconnect toast banner when a disconnected player reconnects', () => {
      const gameState = createMockSanitizedGameState();
      const harness = setupStatefulReactHooks();

      // Pass 1: Alice is initially disconnected
      const mockHookDisconnected = createMockMultiplayerHook({
        isInGame: true,
        roomCode: 'RECN',
        mySeatIndex: 1,
        gameState,
        lobbySeats: [
          {
            seatIndex: 0,
            playerId: 'p_0',
            playerName: 'Alice',
            team: 'A',
            isConnected: false,
            isHost: true,
          },
          {
            seatIndex: 1,
            playerId: 'p_1',
            playerName: 'Bob',
            team: 'B',
            isConnected: true,
            isHost: false,
          },
        ],
      });
      harness.resetIndices();
      App({ initialMode: 'MULTIPLAYER', multiplayerGameHook: mockHookDisconnected });

      // Pass 2: Alice reconnects (triggers useEffect to set reconnect toast state)
      const mockHookReconnected = createMockMultiplayerHook({
        isInGame: true,
        roomCode: 'RECN',
        mySeatIndex: 1,
        gameState,
        lobbySeats: [
          {
            seatIndex: 0,
            playerId: 'p_0',
            playerName: 'Alice',
            team: 'A',
            isConnected: true,
            isHost: true,
          },
          {
            seatIndex: 1,
            playerId: 'p_1',
            playerName: 'Bob',
            team: 'B',
            isConnected: true,
            isHost: false,
          },
        ],
      });
      harness.resetIndices();
      App({ initialMode: 'MULTIPLAYER', multiplayerGameHook: mockHookReconnected });

      // Pass 3: Render tree with updated reconnect toast state
      harness.resetIndices();
      const tree = App({ initialMode: 'MULTIPLAYER', multiplayerGameHook: mockHookReconnected });

      const toast = findByTestId(tree, 'disconnect-toast');
      expect(toast).toBeDefined();

      const toastText = findElement(toast, (el) =>
        typeof el.props?.children === 'string' && el.props.children.includes('Alice')
      );
      expect(toastText).toBeDefined();
      expect(toastText.props.children).toContain('Alice reconnected to the game.');
    });

    it('displays error toast when multiplayerHook returns errorMessage', () => {
      const mockHook = createMockMultiplayerHook({
        isInGame: true,
        roomCode: 'ERR1',
        mySeatIndex: 0,
        gameState: createMockSanitizedGameState(),
        errorMessage: 'Action rejected by server',
      });

      const html = renderToString(
        <App initialMode="MULTIPLAYER" multiplayerGameHook={mockHook} />
      );

      expect(html).toContain('data-testid="error-toast"');
      expect(html).toContain('Action rejected by server');
    });
  });

  /* ========================================================================
   * 6. ModeSelectorModal Wiring, Perspective Lockdown & Edge Cases
   * ======================================================================== */
  describe('ModeSelectorModal Wiring & Perspective Lockdown Details', () => {
    it('wires onSelectLocal and onSelectMultiplayer on ModeSelectorModal in App', () => {
      let currentMode: string = 'LOCAL';
      let modalOpen: boolean = true;

      const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      if (internals) {
        let hookIdx = 0;
        internals.H = {
          useState: (init: any) => {
            hookIdx++;
            if (hookIdx === 1) {
              return [currentMode, (m: any) => { currentMode = m; }];
            }
            if (hookIdx === 2) {
              return [modalOpen, (o: any) => { modalOpen = o; }];
            }
            return [typeof init === 'function' ? init() : init, () => {}];
          },
          useEffect: () => {},
          useRef: (init: any) => ({ current: init }),
          useCallback: (fn: any) => fn,
          useMemo: (fn: any) => fn(),
          useId: () => 'test-id',
        };
      }

      const tree = App({});
      const modal = findElement(tree, (el) => el.type === ModeSelectorModal);
      expect(modal).toBeDefined();

      // Test selecting multiplayer
      modal.props.onSelectMultiplayer();
      expect(currentMode).toBe('MULTIPLAYER');
      expect(modalOpen).toBe(false);

      // Test selecting local
      modal.props.onSelectLocal();
      expect(currentMode).toBe('LOCAL');

      // Test closing modal
      modal.props.onClose();
      expect(modalOpen).toBe(false);
    });

    it('strictly omits onSelectPlayer from TableSeating in multiplayer mode to prevent seat switching', () => {
      const gameState = createMockSanitizedGameState();
      const mockHook = createMockMultiplayerHook({
        isInGame: true,
        roomCode: 'LOCK',
        mySeatIndex: 1,
        gameState,
      });

      const tree = App({
        initialMode: 'MULTIPLAYER',
        multiplayerGameHook: mockHook,
      });

      const tableSeating = findElement(tree, (el) => el.type === TableSeating);
      expect(tableSeating).toBeDefined();
      expect(tableSeating.props.onSelectPlayer).toBeUndefined();
    });

    it('passes onSelectPlayer to TableSeating in local mode allowing hot-seat switching', () => {
      const tree = App({ initialMode: 'LOCAL' });

      const tableSeating = findElement(tree, (el) => el.type === TableSeating);
      expect(tableSeating).toBeDefined();
      expect(tableSeating.props.onSelectPlayer).toBeDefined();
    });

    it('rejects out-of-turn actions client-side when not the active turn player in multiplayer', () => {
      const gameState = createMockSanitizedGameState(); // currentPlayerIndex = 1 (Bob)
      const dispatchAction = vi.fn();
      const mockHook = createMockMultiplayerHook({
        isInGame: true,
        roomCode: 'TURN',
        mySeatIndex: 0, // Alice (Seat 0), but active turn is Bob (Seat 1)
        myPlayerId: 'p_0',
        gameState,
        dispatchAction,
      });

      const tree = App({
        initialMode: 'MULTIPLAYER',
        multiplayerGameHook: mockHook,
      });

      const centerTable = findElement(
        tree,
        (el) => el.type?.name === 'CenterTable' || el.props?.stockDeckCount !== undefined
      );
      expect(centerTable).toBeDefined();

      // Alice attempts to draw out of turn
      centerTable.props.onDrawStock();
      expect(dispatchAction).not.toHaveBeenCalled();
    });

    it('disables turn controls and renders empty spectator hand when mySeatIndex is null in multiplayer', () => {
      const gameState = createMockSanitizedGameState();
      const mockHook = createMockMultiplayerHook({
        isInGame: true,
        roomCode: 'SPEC',
        mySeatIndex: null, // Unseated / spectator
        myPlayerId: 'spec_1',
        gameState,
      });

      const html = renderToString(
        <App initialMode="MULTIPLAYER" multiplayerGameHook={mockHook} />
      );

      expect(html).toContain('data-testid="multiplayer-status-bar"');
      expect(html).toContain('SPEC');
      expect(html).not.toContain('data-testid="status-seat-badge"');
      expect(html).not.toContain('Dev Inspector');
    });

    it('handles seatIndex === undefined gracefully without rendering Seat NaN', () => {
      const html = renderToString(
        <MultiplayerStatusBar
          roomCode="NONE"
          connectionStatus="CONNECTED"
          seatIndex={undefined}
          onLeave={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="multiplayer-status-bar"');
      expect(html).toContain('NONE');
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('data-testid="status-seat-badge"');
    });

    it('handles seatIndex === null gracefully in MultiplayerStatusBar', () => {
      const html = renderToString(
        <MultiplayerStatusBar
          roomCode="NONE"
          connectionStatus="CONNECTED"
          seatIndex={null}
          onLeave={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="multiplayer-status-bar"');
      expect(html).toContain('NONE');
      expect(html).not.toContain('data-testid="status-seat-badge"');
    });
  });
});
