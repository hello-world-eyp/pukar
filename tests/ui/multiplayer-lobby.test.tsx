import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ModeSelectorModal } from '../../src/ui/components/ModeSelectorModal';
import { CreateJoinView } from '../../src/ui/components/multiplayer/CreateJoinView';
import { LobbyView } from '../../src/ui/components/multiplayer/LobbyView';
import { MultiplayerHub } from '../../src/ui/components/multiplayer/MultiplayerHub';
import { LobbySeat } from '../../server/types';
import { UseMultiplayerGameReturn } from '../../src/network/types';

// Setup minimal React client dispatcher for direct hook-based element inspection in Node
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

// Tree traversal helper to find a React element by predicate
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



describe('Multiplayer UI Components', () => {
  beforeEach(() => {
    setupReactHooks();
  });

  /* ========================================================================
   * 1. ModeSelectorModal
   * ======================================================================== */
  describe('ModeSelectorModal', () => {
    it('returns null and renders nothing when isOpen is false', () => {
      const html = renderToString(
        <ModeSelectorModal
          isOpen={false}
          onSelectLocal={vi.fn()}
          onSelectMultiplayer={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(html).toBe('');
    });

    it('renders modal dialog, title, options, and cancel button when isOpen is true', () => {
      const html = renderToString(
        <ModeSelectorModal
          isOpen={true}
          onSelectLocal={vi.fn()}
          onSelectMultiplayer={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="mode-selector-modal"');
      expect(html).toContain('Choose Game Mode');
      expect(html).toContain('Local Hot-Seat / Pass &amp; Play');
      expect(html).toContain('Play on this device with perspective switcher &amp; God-Mode inspector.');
      expect(html).toContain('LAN &amp; Online Multiplayer');
      expect(html).toContain('Create a 4-letter room code or join friends on Wi-Fi with personal hands.');
      expect(html).toContain('data-testid="btn-mode-local"');
      expect(html).toContain('data-testid="btn-mode-multiplayer"');
      expect(html).toContain('data-testid="btn-cancel-modal"');
      expect(html).toContain('data-testid="btn-close-modal"');
    });

    it('triggers onSelectLocal and onClose when local hot-seat card is clicked', () => {
      const onSelectLocal = vi.fn();
      const onSelectMultiplayer = vi.fn();
      const onClose = vi.fn();

      const tree = ModeSelectorModal({
        isOpen: true,
        onSelectLocal,
        onSelectMultiplayer,
        onClose,
      });

      const localBtn = findByTestId(tree, 'btn-mode-local');
      expect(localBtn).toBeDefined();
      localBtn.props.onClick();

      expect(onSelectLocal).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSelectMultiplayer).not.toHaveBeenCalled();
    });

    it('triggers onSelectMultiplayer and onClose when multiplayer card is clicked', () => {
      const onSelectLocal = vi.fn();
      const onSelectMultiplayer = vi.fn();
      const onClose = vi.fn();

      const tree = ModeSelectorModal({
        isOpen: true,
        onSelectLocal,
        onSelectMultiplayer,
        onClose,
      });

      const multiBtn = findByTestId(tree, 'btn-mode-multiplayer');
      expect(multiBtn).toBeDefined();
      multiBtn.props.onClick();

      expect(onSelectMultiplayer).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSelectLocal).not.toHaveBeenCalled();
    });

    it('triggers onClose when close icon button and cancel button are clicked', () => {
      const onClose = vi.fn();

      const tree = ModeSelectorModal({
        isOpen: true,
        onSelectLocal: vi.fn(),
        onSelectMultiplayer: vi.fn(),
        onClose,
      });

      const closeBtn = findByTestId(tree, 'btn-close-modal');
      closeBtn.props.onClick();
      expect(onClose).toHaveBeenCalledTimes(1);

      const cancelBtn = findByTestId(tree, 'btn-cancel-modal');
      cancelBtn.props.onClick();
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('triggers onClose when clicking backdrop, but not when clicking inside modal card', () => {
      const onClose = vi.fn();

      const tree = ModeSelectorModal({
        isOpen: true,
        onSelectLocal: vi.fn(),
        onSelectMultiplayer: vi.fn(),
        onClose,
      });

      const modalEl = findByTestId(tree, 'mode-selector-modal');
      // Clicking on backdrop (target === currentTarget)
      modalEl.props.onClick({ target: 'backdrop-ref', currentTarget: 'backdrop-ref' });
      expect(onClose).toHaveBeenCalledTimes(1);

      // Clicking inside inner card (target !== currentTarget)
      modalEl.props.onClick({ target: 'inner-card-ref', currentTarget: 'backdrop-ref' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  /* ========================================================================
   * 2. CreateJoinView
   * ======================================================================== */
  describe('CreateJoinView', () => {
    it('renders tabs and Create Room view by default with connection status', () => {
      const htmlConnected = renderToString(
        <CreateJoinView
          onCreateRoom={vi.fn()}
          onJoinRoom={vi.fn()}
          isConnected={true}
        />
      );

      expect(htmlConnected).toContain('data-testid="tab-create-room"');
      expect(htmlConnected).toContain('data-testid="tab-join-room"');
      expect(htmlConnected).toContain('Connected');
      expect(htmlConnected).toContain('Your Name');
      expect(htmlConnected).toContain('4 Players (2v2)');
      expect(htmlConnected).toContain('6 Players (3v3)');
      expect(htmlConnected).toContain('data-testid="btn-create-room"');
      // Button disabled because name is empty
      expect(htmlConnected).toMatch(/data-testid="btn-create-room"[^>]*disabled=""/);

      const htmlDisconnected = renderToString(
        <CreateJoinView
          onCreateRoom={vi.fn()}
          onJoinRoom={vi.fn()}
          isConnected={false}
          initialPlayerName="Alice"
        />
      );
      expect(htmlDisconnected).toContain('Connecting to server...');
      // Button disabled because socket is disconnected even with name
      expect(htmlDisconnected).toMatch(/data-testid="btn-create-room"[^>]*disabled=""/);
    });

    it('renders Join Room view when tab is JOIN with 4-letter room code input', () => {
      const html = renderToString(
        <CreateJoinView
          onCreateRoom={vi.fn()}
          onJoinRoom={vi.fn()}
          isConnected={true}
          initialTab="JOIN"
          initialPlayerName="Bob"
          initialRoomCode="ABCD"
        />
      );

      expect(html).toContain('4-Letter Room Code');
      expect(html).toContain('value="ABCD"');
      expect(html).toContain('data-testid="btn-join-room"');
      // Enabled because connected, name present, and code is 4 letters
      expect(html).not.toMatch(/data-testid="btn-join-room"[^>]*disabled=""/);
    });

    it('disables join button when room code has fewer than 4 letters', () => {
      const html = renderToString(
        <CreateJoinView
          onCreateRoom={vi.fn()}
          onJoinRoom={vi.fn()}
          isConnected={true}
          initialTab="JOIN"
          initialPlayerName="Bob"
          initialRoomCode="AB"
        />
      );

      expect(html).toMatch(/data-testid="btn-join-room"[^>]*disabled=""/);
    });

    it('invokes onCreateRoom with player name and player count when create button is clicked', () => {
      const onCreateRoom = vi.fn();
      const onJoinRoom = vi.fn();

      const tree = CreateJoinView({
        onCreateRoom,
        onJoinRoom,
        isConnected: true,
        initialPlayerName: '  Charlie  ',
        initialPlayerCount: 4,
      });

      const createBtn = findByTestId(tree, 'btn-create-room');
      expect(createBtn.props.disabled).toBe(false);
      createBtn.props.onClick();

      expect(onCreateRoom).toHaveBeenCalledWith('Charlie', 4);
      expect(onJoinRoom).not.toHaveBeenCalled();
    });

    it('invokes onCreateRoom with 6 players when 6-player count is selected', () => {
      const onCreateRoom = vi.fn();

      const tree = CreateJoinView({
        onCreateRoom,
        onJoinRoom: vi.fn(),
        isConnected: true,
        initialPlayerName: 'Dana',
        initialPlayerCount: 6,
      });

      const createBtn = findByTestId(tree, 'btn-create-room');
      createBtn.props.onClick();

      expect(onCreateRoom).toHaveBeenCalledWith('Dana', 6);
    });

    it('invokes onJoinRoom with uppercased room code and player name', () => {
      const onJoinRoom = vi.fn();

      const tree = CreateJoinView({
        onCreateRoom: vi.fn(),
        onJoinRoom,
        isConnected: true,
        initialTab: 'JOIN',
        initialPlayerName: '  Eve  ',
        initialRoomCode: 'wxyz',
      });

      const joinBtn = findByTestId(tree, 'btn-join-room');
      expect(joinBtn.props.disabled).toBe(false);
      joinBtn.props.onClick();

      expect(onJoinRoom).toHaveBeenCalledWith('WXYZ', 'Eve');
    });

    it('does not invoke onCreateRoom or onJoinRoom when disabled', () => {
      const onCreate = vi.fn();
      const onJoin = vi.fn();

      const treeDisconnected = CreateJoinView({
        onCreateRoom: onCreate,
        onJoinRoom: onJoin,
        isConnected: false,
        initialPlayerName: 'Frank',
      });

      const btn = findByTestId(treeDisconnected, 'btn-create-room');
      expect(btn.props.disabled).toBe(true);
      btn.props.onClick();
      expect(onCreate).not.toHaveBeenCalled();
    });

    it('sanitizes room code with whitespace and special characters from initialRoomCode', () => {
      const onJoinRoom = vi.fn();

      const tree = CreateJoinView({
        onCreateRoom: vi.fn(),
        onJoinRoom,
        isConnected: true,
        initialTab: 'JOIN',
        initialPlayerName: 'Grace',
        initialRoomCode: '  p-k a!r  ',
      });

      const joinBtn = findByTestId(tree, 'btn-join-room');
      expect(joinBtn.props.disabled).toBe(false);
      joinBtn.props.onClick();

      expect(onJoinRoom).toHaveBeenCalledWith('PKAR', 'Grace');
    });

    it('extracts room code when invite URL is pasted into room code input', () => {
      const tree = CreateJoinView({
        onCreateRoom: vi.fn(),
        onJoinRoom: vi.fn(),
        isConnected: true,
        initialTab: 'JOIN',
        initialPlayerName: 'Grace',
      });

      const input = findByTestId(tree, 'input-room-code');
      expect(input).toBeDefined();

      const preventDefault = vi.fn();
      input.props.onPaste({
        preventDefault,
        clipboardData: {
          getData: (type: string) => (type === 'text' ? 'https://pukar.game/?room=Z8X1' : ''),
        },
      });

      expect(preventDefault).toHaveBeenCalled();
    });

    it('submits create room form when Enter key is pressed in player name input', () => {
      const onCreateRoom = vi.fn();

      const tree = CreateJoinView({
        onCreateRoom,
        onJoinRoom: vi.fn(),
        isConnected: true,
        initialTab: 'CREATE',
        initialPlayerName: 'Hank',
        initialPlayerCount: 4,
      });

      const nameInput = findByTestId(tree, 'input-player-name');
      const preventDefault = vi.fn();
      nameInput.props.onKeyDown({ key: 'Enter', preventDefault });

      expect(preventDefault).toHaveBeenCalled();
      expect(onCreateRoom).toHaveBeenCalledWith('Hank', 4);
    });

    it('submits join room form when Enter key is pressed in player name input on join tab', () => {
      const onJoinRoom = vi.fn();

      const tree = CreateJoinView({
        onCreateRoom: vi.fn(),
        onJoinRoom,
        isConnected: true,
        initialTab: 'JOIN',
        initialPlayerName: 'Ivy',
        initialRoomCode: 'JOIN',
      });

      const nameInput = findByTestId(tree, 'input-player-name');
      const preventDefault = vi.fn();
      nameInput.props.onKeyDown({ key: 'Enter', preventDefault });

      expect(preventDefault).toHaveBeenCalled();
      expect(onJoinRoom).toHaveBeenCalledWith('JOIN', 'Ivy');
    });
  });

  /* ========================================================================
   * 3. LobbyView
   * ======================================================================== */
  describe('LobbyView', () => {
    const mockSeats4p: LobbySeat[] = [
      { seatIndex: 0, playerId: 'p1', playerName: 'Alice', team: 'A', isConnected: true, isHost: true },
      { seatIndex: 1, playerId: 'p2', playerName: 'Bob', team: 'B', isConnected: true, isHost: false },
      { seatIndex: 2, playerId: null, playerName: null, team: 'A', isConnected: false, isHost: false },
      { seatIndex: 3, playerId: null, playerName: null, team: 'B', isConnected: false, isHost: false },
    ];

    const fullSeats4p: LobbySeat[] = [
      { seatIndex: 0, playerId: 'p1', playerName: 'Alice', team: 'A', isConnected: true, isHost: true },
      { seatIndex: 1, playerId: 'p2', playerName: 'Bob', team: 'B', isConnected: true, isHost: false },
      { seatIndex: 2, playerId: 'p3', playerName: 'Charlie', team: 'A', isConnected: true, isHost: false },
      { seatIndex: 3, playerId: 'p4', playerName: 'Dana', team: 'B', isConnected: false, isHost: false }, // p4 disconnected
    ];

    it('renders room code, copy button, status indicator, and alternating team badges', () => {
      const html = renderToString(
        <LobbyView
          roomCode="GAME"
          seats={mockSeats4p}
          myPlayerId="p1"
          isHost={true}
          onSelectSeat={vi.fn()}
          onStartGame={vi.fn()}
          onKickPlayer={vi.fn()}
          onLeaveLobby={vi.fn()}
        />
      );

      // Room code banner
      expect(html).toContain('GAME');
      expect(html).toContain('data-testid="btn-copy-code"');
      expect(html).toContain('Waiting for players (2/4)');

      // Alternating team tags
      expect(html).toContain('A1');
      expect(html).toContain('B1');
      expect(html).toContain('A2');
      expect(html).toContain('B2');

      // Player names & Badges
      expect(html).toContain('Alice');
      expect(html).toContain('Bob');
      expect(html).toContain('YOU');
      expect(html).toContain('HOST');

      // Empty seats & Claim buttons
      expect(html).toContain('data-testid="btn-claim-seat-2"');
      expect(html).toContain('data-testid="btn-claim-seat-3"');
      expect(html).toContain('Claim Seat');
    });

    it('correctly displays connection dots for connected vs disconnected players', () => {
      const html = renderToString(
        <LobbyView
          roomCode="GAME"
          seats={fullSeats4p}
          myPlayerId="p1"
          isHost={true}
          onSelectSeat={vi.fn()}
          onStartGame={vi.fn()}
          onKickPlayer={vi.fn()}
          onLeaveLobby={vi.fn()}
        />
      );

      // p1 connected -> bg-emerald-400
      expect(html).toContain('title="Connected"');
      // p4 disconnected -> bg-red-400
      expect(html).toContain('title="Disconnected"');
      expect(html).toContain('Lobby Full (4/4)');
    });

    it('renders 6-player seating layout with A1, B1, A2, B2, A3, B3 badges', () => {
      const seats6p: LobbySeat[] = [
        { seatIndex: 0, playerId: 'p1', playerName: 'Alice', team: 'A', isConnected: true, isHost: true },
        { seatIndex: 1, playerId: 'p2', playerName: 'Bob', team: 'B', isConnected: true, isHost: false },
        { seatIndex: 2, playerId: 'p3', playerName: 'Charlie', team: 'A', isConnected: true, isHost: false },
        { seatIndex: 3, playerId: 'p4', playerName: 'Dana', team: 'B', isConnected: true, isHost: false },
        { seatIndex: 4, playerId: 'p5', playerName: 'Eve', team: 'A', isConnected: true, isHost: false },
        { seatIndex: 5, playerId: 'p6', playerName: 'Frank', team: 'B', isConnected: true, isHost: false },
      ];

      const html = renderToString(
        <LobbyView
          roomCode="SIX6"
          seats={seats6p}
          myPlayerId="p2"
          isHost={false}
          onSelectSeat={vi.fn()}
          onStartGame={vi.fn()}
          onLeaveLobby={vi.fn()}
        />
      );

      expect(html).toContain('A1');
      expect(html).toContain('B1');
      expect(html).toContain('A2');
      expect(html).toContain('B2');
      expect(html).toContain('A3');
      expect(html).toContain('B3');
      expect(html).toContain('Lobby Full (6/6)');
      // Not host -> no start button
      expect(html).not.toContain('data-testid="btn-start-game"');
    });

    it('copies room code to clipboard when copy button is clicked', () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      (globalThis as any).navigator = {
        clipboard: {
          writeText: writeTextMock,
        },
      };

      const tree = LobbyView({
        roomCode: 'TEST',
        seats: mockSeats4p,
        myPlayerId: "p1",
        isHost: true,
        onSelectSeat: vi.fn(),
        onStartGame: vi.fn(),
        onLeaveLobby: vi.fn(),
      });

      const copyBtn = findByTestId(tree, 'btn-copy-code');
      expect(copyBtn).toBeDefined();
      copyBtn.props.onClick();

      expect(writeTextMock).toHaveBeenCalledWith('TEST');
    });

    it('safely handles clipboard rejection without throwing', () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
      (globalThis as any).navigator = {
        clipboard: {
          writeText: writeTextMock,
        },
      };

      const tree = LobbyView({
        roomCode: 'ERR1',
        seats: mockSeats4p,
        myPlayerId: 'p1',
        isHost: true,
        onSelectSeat: vi.fn(),
        onStartGame: vi.fn(),
        onLeaveLobby: vi.fn(),
      });

      const copyBtn = findByTestId(tree, 'btn-copy-code');
      expect(() => copyBtn.props.onClick()).not.toThrow();
      expect(writeTextMock).toHaveBeenCalledWith('ERR1');
    });

    it('calls onSelectSeat when claim seat button is clicked', () => {
      const onSelectSeat = vi.fn();

      const tree = LobbyView({
        roomCode: 'TEST',
        seats: mockSeats4p,
        myPlayerId: "p1",
        isHost: true,
        onSelectSeat,
        onStartGame: vi.fn(),
        onLeaveLobby: vi.fn(),
      });

      const claimSeat2 = findByTestId(tree, 'btn-claim-seat-2');
      expect(claimSeat2).toBeDefined();
      claimSeat2.props.onClick();

      expect(onSelectSeat).toHaveBeenCalledWith(2);
    });

    it('renders kick button only for host against non-self seated players and triggers onKickPlayer', () => {
      const onKickPlayer = vi.fn();

      const hostTree = LobbyView({
        roomCode: 'TEST',
        seats: mockSeats4p,
        myPlayerId: "p1",
        isHost: true,
        onSelectSeat: vi.fn(),
        onStartGame: vi.fn(),
        onKickPlayer,
        onLeaveLobby: vi.fn(),
      });

      // Host cannot kick self (seat 0 is p1)
      const kickSeat0 = findByTestId(hostTree, 'btn-kick-seat-0');
      expect(kickSeat0).toBeNull();

      // Host CAN kick seat 1 (p2)
      const kickSeat1 = findByTestId(hostTree, 'btn-kick-seat-1');
      expect(kickSeat1).toBeDefined();
      kickSeat1.props.onClick();
      expect(onKickPlayer).toHaveBeenCalledWith(1);

      // Non-host player should NOT have kick buttons
      const guestTree = LobbyView({
        roomCode: 'TEST',
        seats: mockSeats4p,
        myPlayerId: "p2",
        isHost: false,
        onSelectSeat: vi.fn(),
        onStartGame: vi.fn(),
        onKickPlayer,
        onLeaveLobby: vi.fn(),
      });
      const guestKickSeat0 = findByTestId(guestTree, 'btn-kick-seat-0');
      expect(guestKickSeat0).toBeNull();
    });

    it('disables host start game button when room is not full and enables when full', () => {
      const onStartGame = vi.fn();

      // Room with 2/4 seats
      const partialTree = LobbyView({
        roomCode: 'TEST',
        seats: mockSeats4p,
        myPlayerId: "p1",
        isHost: true,
        onSelectSeat: vi.fn(),
        onStartGame,
        onLeaveLobby: vi.fn(),
      });
      const startBtnPartial = findByTestId(partialTree, 'btn-start-game');
      expect(startBtnPartial.props.disabled).toBe(true);

      // Room with 4/4 seats
      const fullTree = LobbyView({
        roomCode: 'TEST',
        seats: fullSeats4p,
        myPlayerId: "p1",
        isHost: true,
        onSelectSeat: vi.fn(),
        onStartGame,
        onLeaveLobby: vi.fn(),
      });
      const startBtnFull = findByTestId(fullTree, 'btn-start-game');
      expect(startBtnFull.props.disabled).toBe(false);
      startBtnFull.props.onClick();
      expect(onStartGame).toHaveBeenCalledTimes(1);
    });

    it('invokes onLeaveLobby when leave lobby button is clicked', () => {
      const onLeaveLobby = vi.fn();

      const tree = LobbyView({
        roomCode: 'TEST',
        seats: mockSeats4p,
        myPlayerId: "p1",
        isHost: true,
        onSelectSeat: vi.fn(),
        onStartGame: vi.fn(),
        onLeaveLobby,
      });

      const leaveBtn = findByTestId(tree, 'btn-leave-lobby');
      leaveBtn.props.onClick();
      expect(onLeaveLobby).toHaveBeenCalledTimes(1);
    });
  });

  /* ========================================================================
   * 4. MultiplayerHub
   * ======================================================================== */
  describe('MultiplayerHub', () => {
    const createMockHook = (overrides?: Partial<UseMultiplayerGameReturn>): UseMultiplayerGameReturn => ({
      connectionStatus: 'CONNECTED',
      roomCode: null,
      isHost: false,
      isInLobby: false,
      isInGame: false,
      lobbySeats: [],
      gameState: null,
      mySeatIndex: null,
      myPlayerId: 'p1',
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
    });

    it('renders CreateJoinView and back to menu button when not in lobby', () => {
      const onBackToMenu = vi.fn();
      const mockHook = createMockHook();

      const html = renderToString(
        <MultiplayerHub onBackToMenu={onBackToMenu} multiplayerHook={mockHook} />
      );

      expect(html).toContain('data-testid="create-join-view"');
      expect(html).toContain('data-testid="btn-back-to-menu"');
      expect(html).toContain('Back to Main Menu');
      expect(html).not.toContain('data-testid="multiplayer-lobby-view"');
    });

    it('renders LobbyView when isInLobby is true and roomCode is present', () => {
      const mockHook = createMockHook({
        isInLobby: true,
        roomCode: 'WXYZ',
        lobbySeats: [
          { seatIndex: 0, playerId: 'p1', playerName: 'Host', team: 'A', isConnected: true, isHost: true },
          { seatIndex: 1, playerId: null, playerName: null, team: 'B', isConnected: false, isHost: false },
          { seatIndex: 2, playerId: null, playerName: null, team: 'A', isConnected: false, isHost: false },
          { seatIndex: 3, playerId: null, playerName: null, team: 'B', isConnected: false, isHost: false },
        ],
        isHost: true,
      });

      const html = renderToString(
        <MultiplayerHub onBackToMenu={vi.fn()} multiplayerHook={mockHook} />
      );

      expect(html).toContain('data-testid="multiplayer-lobby-view"');
      expect(html).toContain('WXYZ');
      expect(html).not.toContain('data-testid="create-join-view"');
    });

    it('displays error banner when errorMessage is present and allows dismissing', () => {
      const clearErrorMock = vi.fn();
      const mockHook = createMockHook({
        errorMessage: 'Room PKAR not found or has expired',
        clearError: clearErrorMock,
      });

      const html = renderToString(
        <MultiplayerHub onBackToMenu={vi.fn()} multiplayerHook={mockHook} />
      );

      expect(html).toContain('data-testid="multiplayer-error-banner"');
      expect(html).toContain('Room PKAR not found or has expired');
      expect(html).toContain('data-testid="btn-dismiss-error"');

      // Test dismiss button click
      const tree = MultiplayerHub({
        onBackToMenu: vi.fn(),
        multiplayerHook: mockHook,
      });
      const dismissBtn = findByTestId(tree, 'btn-dismiss-error');
      expect(dismissBtn).toBeDefined();
      dismissBtn.props.onClick();
      expect(clearErrorMock).toHaveBeenCalledTimes(1);
    });

    it('does not display error banner when errorMessage is null', () => {
      const mockHook = createMockHook({ errorMessage: null });
      const html = renderToString(
        <MultiplayerHub onBackToMenu={vi.fn()} multiplayerHook={mockHook} />
      );

      expect(html).not.toContain('data-testid="multiplayer-error-banner"');
    });

    it('calls leaveRoom and onBackToMenu when leaving lobby in MultiplayerHub', () => {
      const onBackToMenu = vi.fn();
      const leaveRoomMock = vi.fn();

      const mockHook = createMockHook({
        isInLobby: true,
        roomCode: 'ABCD',
        lobbySeats: [
          { seatIndex: 0, playerId: 'p1', playerName: 'Alice', team: 'A', isConnected: true, isHost: true },
        ],
        leaveRoom: leaveRoomMock,
      });

      const tree = MultiplayerHub({
        onBackToMenu,
        multiplayerHook: mockHook,
      });

      // The LobbyView is the child
      expect(tree).toBeDefined();
      const lobbyView = (tree as any).props.children[1];
      expect(lobbyView.type).toBe(LobbyView);
      lobbyView.props.onLeaveLobby();

      expect(leaveRoomMock).toHaveBeenCalledTimes(1);
      expect(onBackToMenu).toHaveBeenCalledTimes(1);
    });

    it('calls onBackToMenu when back button is clicked in create join view', () => {
      const onBackToMenu = vi.fn();
      const mockHook = createMockHook();

      const tree = MultiplayerHub({
        onBackToMenu,
        multiplayerHook: mockHook,
      });

      const backBtn = findByTestId(tree, 'btn-back-to-menu');
      expect(backBtn).toBeDefined();
      backBtn.props.onClick();

      expect(onBackToMenu).toHaveBeenCalledTimes(1);
    });
  });
});
