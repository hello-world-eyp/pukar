import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoomManager } from '../../server/room-manager';
import { GameCoordinator } from '../../server/game-coordinator';
import { serverLogger } from '../../server/logger';
import { Room } from '../../server/types';
import { Card } from '../../src/engine/types';

describe('GameCoordinator', () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
    vi.restoreAllMocks();
  });

  describe('canStartGame', () => {
    it('prevents starting the game when not all seats are claimed', () => {
      const { room } = manager.createRoom('Host', 4, 's1');

      const check = GameCoordinator.canStartGame(room);
      expect(check.canStart).toBe(false);
      expect(check.reason).toContain('Not all seats are filled');
      expect(check.reason).toContain('3 empty');
    });

    it('prevents starting a 6-player game when only 4 seats are claimed', () => {
      const { room } = manager.createRoom('Host', 6, 's1');
      for (let i = 1; i <= 3; i++) {
        const join = manager.joinRoom(room.roomCode, `P${i + 1}`, `s${i + 1}`);
        if (join.success) manager.claimSeat(room.roomCode, join.session.playerId, i);
      }

      const check = GameCoordinator.canStartGame(room);
      expect(check.canStart).toBe(false);
      expect(check.reason).toContain('2 empty');
    });

    it('prevents starting when room is already IN_GAME', () => {
      const { room } = manager.createRoom('P1', 4, 's1');
      for (let i = 1; i <= 3; i++) {
        const join = manager.joinRoom(room.roomCode, `P${i + 1}`, `s${i + 1}`);
        if (join.success) manager.claimSeat(room.roomCode, join.session.playerId, i);
      }
      expect(GameCoordinator.startGame(room)).toBe(true);

      const check = GameCoordinator.canStartGame(room);
      expect(check.canStart).toBe(false);
      expect(check.reason).toContain('already in progress');
    });

    it('allows starting when all 4 seats are claimed in a 4-player room', () => {
      const { room } = manager.createRoom('P1', 4, 's1');
      for (let i = 1; i <= 3; i++) {
        const join = manager.joinRoom(room.roomCode, `P${i + 1}`, `s${i + 1}`);
        if (join.success) manager.claimSeat(room.roomCode, join.session.playerId, i);
      }

      const check = GameCoordinator.canStartGame(room);
      expect(check.canStart).toBe(true);
      expect(check.reason).toBeUndefined();
    });

    it('allows starting when all 6 seats are claimed in a 6-player room', () => {
      const { room } = manager.createRoom('P1', 6, 's1');
      for (let i = 1; i <= 5; i++) {
        const join = manager.joinRoom(room.roomCode, `P${i + 1}`, `s${i + 1}`);
        if (join.success) manager.claimSeat(room.roomCode, join.session.playerId, i);
      }

      const check = GameCoordinator.canStartGame(room);
      expect(check.canStart).toBe(true);
    });

    it('defensively handles null or undefined room', () => {
      const check = GameCoordinator.canStartGame(null as any);
      expect(check.canStart).toBe(false);
      expect(check.reason).toBeDefined();
    });

    it('prevents starting if any seat has whitespace playerId', () => {
      const { room } = manager.createRoom('Host', 4, 's1');
      for (let i = 1; i <= 3; i++) {
        const join = manager.joinRoom(room.roomCode, `P${i + 1}`, `s${i + 1}`);
        if (join.success) manager.claimSeat(room.roomCode, join.session.playerId, i);
      }
      room.seats[2].playerId = '   ';
      const check = GameCoordinator.canStartGame(room);
      expect(check.canStart).toBe(false);
      expect(check.reason).toContain('Not all seats are filled');
    });

    it('prevents starting if seats length does not match playerCount', () => {
      const { room } = manager.createRoom('Host', 4, 's1');
      room.seats.pop();
      const check = GameCoordinator.canStartGame(room);
      expect(check.canStart).toBe(false);
      expect(check.reason).toContain('Invalid seats count');
    });

    it('prevents starting if playerCount is neither 4 nor 6', () => {
      const { room } = manager.createRoom('Host', 4, 's1');
      (room as any).playerCount = 5;
      const check = GameCoordinator.canStartGame(room);
      expect(check.canStart).toBe(false);
      expect(check.reason).toContain('Invalid player count');
    });

    it('prevents starting if room status is ROUND_OVER or GAME_OVER', () => {
      const { room } = manager.createRoom('Host', 4, 's1');
      room.status = 'ROUND_OVER';
      expect(GameCoordinator.canStartGame(room).canStart).toBe(false);
      room.status = 'GAME_OVER';
      expect(GameCoordinator.canStartGame(room).canStart).toBe(false);
    });

    it('prevents starting if duplicate playerIds are assigned to different seats', () => {
      const { room } = manager.createRoom('Host', 4, 's1');
      for (let i = 1; i <= 3; i++) {
        const join = manager.joinRoom(room.roomCode, `P${i + 1}`, `s${i + 1}`);
        if (join.success) manager.claimSeat(room.roomCode, join.session.playerId, i);
      }
      // Assign seat 1 the same playerId as seat 0
      room.seats[1].playerId = room.seats[0].playerId;
      const check = GameCoordinator.canStartGame(room);
      expect(check.canStart).toBe(false);
      expect(check.reason).toContain('Duplicate player IDs found across seats');
    });

    it('prevents starting if seatIndex configuration is invalid or has duplicates', () => {
      const { room } = manager.createRoom('Host', 4, 's1');
      for (let i = 1; i <= 3; i++) {
        const join = manager.joinRoom(room.roomCode, `P${i + 1}`, `s${i + 1}`);
        if (join.success) manager.claimSeat(room.roomCode, join.session.playerId, i);
      }
      // Duplicate seatIndex 0
      room.seats[1].seatIndex = 0;
      const check = GameCoordinator.canStartGame(room);
      expect(check.canStart).toBe(false);
      expect(check.reason).toContain('Duplicate seat index');

      // Out-of-bounds seatIndex
      room.seats[1].seatIndex = 99;
      const check2 = GameCoordinator.canStartGame(room);
      expect(check2.canStart).toBe(false);
      expect(check2.reason).toContain('Invalid seat configuration');
    });
  });

  describe('startGame', () => {
    it('returns false and logs warning when room cannot start', () => {
      const warnSpy = vi.spyOn(serverLogger, 'warn');
      const { room } = manager.createRoom('Host', 4, 's1');

      const started = GameCoordinator.startGame(room);
      expect(started).toBe(false);
      expect(room.status).toBe('LOBBY');
      expect(room.gameState).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot start game'),
        expect.objectContaining({ roomCode: room.roomCode })
      );
    });

    it('starts 4-player game, deals 13 cards each, and remaps player IDs to seat IDs', () => {
      const infoSpy = vi.spyOn(serverLogger, 'info');
      const { room, session: hostSession } = manager.createRoom('Alice', 4, 's1');
      const playerSessions = [hostSession];

      for (let i = 1; i <= 3; i++) {
        const join = manager.joinRoom(room.roomCode, `Bob_${i}`, `s${i + 1}`);
        expect(join.success).toBe(true);
        if (join.success) {
          manager.claimSeat(room.roomCode, join.session.playerId, i);
          playerSessions.push(join.session);
        }
      }

      const started = GameCoordinator.startGame(room);
      expect(started).toBe(true);
      expect(room.status).toBe('IN_GAME');
      expect(room.gameState).not.toBeNull();
      expect(room.gameState?.playerCount).toBe(4);
      expect(room.gameState?.players).toHaveLength(4);

      // Verify hands and ID remapping
      room.gameState?.players.forEach((player, idx) => {
        expect(player.id).toBe(playerSessions[idx].playerId);
        expect(player.name).toBe(playerSessions[idx].playerName);
        expect(player.hand).toHaveLength(13);
        expect(player.team).toBe(idx % 2 === 0 ? 'A' : 'B');
      });

      // Stock deck and discard pile verification for 4 players (110 total cards: 4x13 hands + 2x13 pukars + 1 discard = 79 cards accounted for -> 31 stock)
      expect(room.gameState?.discardPile).toHaveLength(1);
      expect(room.gameState?.pukarPool).toHaveLength(2);
      expect(room.gameState?.stockDeck).toHaveLength(31);
      expect(room.gameState?.currentPlayerIndex).toBe(0);
      expect(room.gameState?.phase).toBe('DRAW');

      expect(infoSpy).toHaveBeenCalledWith(
        'Game started successfully',
        expect.objectContaining({ roomCode: room.roomCode })
      );
    });

    it('starts 6-player game, deals 13 cards each to 6 players', () => {
      const { room, session: hostSession } = manager.createRoom('Host6', 6, 's1');
      const playerSessions = [hostSession];

      for (let i = 1; i <= 5; i++) {
        const join = manager.joinRoom(room.roomCode, `P_${i + 1}`, `s${i + 1}`);
        if (join.success) {
          manager.claimSeat(room.roomCode, join.session.playerId, i);
          playerSessions.push(join.session);
        }
      }

      const started = GameCoordinator.startGame(room);
      expect(started).toBe(true);
      expect(room.status).toBe('IN_GAME');
      expect(room.gameState?.players).toHaveLength(6);
      expect(room.gameState?.pukarPool).toHaveLength(3);
      // 165 total cards: 6x13 + 3x13 + 1 discard = 118 -> 47 stock
      expect(room.gameState?.stockDeck).toHaveLength(47);

      room.gameState?.players.forEach((player, idx) => {
        expect(player.id).toBe(playerSessions[idx].playerId);
        expect(player.hand).toHaveLength(13);
      });
    });

    it('supports customDeck parameter for deterministic game setup', () => {
      const { room } = manager.createRoom('P1', 4, 's1');
      for (let i = 1; i <= 3; i++) {
        const join = manager.joinRoom(room.roomCode, `P${i + 1}`, `s${i + 1}`);
        if (join.success) manager.claimSeat(room.roomCode, join.session.playerId, i);
      }
      const customCards: Card[] = Array.from({ length: 110 }).map((_, idx) => ({
        id: `c_${idx}`,
        suit: 'HEARTS',
        rank: 7,
      }));
      const started = GameCoordinator.startGame(room, customCards);
      expect(started).toBe(true);
      expect(room.gameState?.players[0].hand[0].id).toBe('c_0');
      expect(room.gameState?.players[1].hand[0].id).toBe('c_13');
    });

    it('falls back to default player names if seat playerName is empty or whitespace', () => {
      const { room } = manager.createRoom('   ', 4, 's1');
      for (let i = 1; i <= 3; i++) {
        const join = manager.joinRoom(room.roomCode, '   ', `s${i + 1}`);
        if (join.success) {
          manager.claimSeat(room.roomCode, join.session.playerId, i);
          room.seats[i].playerName = '';
        }
      }
      room.seats[0].playerName = ' ';
      GameCoordinator.startGame(room);
      expect(room.gameState?.players[0].name).toBe('Player 1');
      expect(room.gameState?.players[1].name).toBe('Player 2');
    });

    it('properly maps player seats and names even if room.seats array is not sorted by seatIndex', () => {
      const { room, session: hostSession } = manager.createRoom('Alice', 4, 's1');
      const playerSessions = [hostSession];

      for (let i = 1; i <= 3; i++) {
        const join = manager.joinRoom(room.roomCode, `Player_${i + 1}`, `s${i + 1}`);
        if (join.success) {
          manager.claimSeat(room.roomCode, join.session.playerId, i);
          playerSessions.push(join.session);
        }
      }

      // Reverse seats array in room to simulate unordered seat array
      room.seats.reverse();
      expect(room.seats[0].seatIndex).toBe(3);
      expect(room.seats[3].seatIndex).toBe(0);

      const started = GameCoordinator.startGame(room);
      expect(started).toBe(true);

      // Verify that player index 0 matches seatIndex 0 (Alice), player 1 matches seatIndex 1, etc.
      expect(room.gameState?.players[0].id).toBe(playerSessions[0].playerId);
      expect(room.gameState?.players[0].name).toBe('Alice');
      expect(room.gameState?.players[0].team).toBe('A');

      expect(room.gameState?.players[1].id).toBe(playerSessions[1].playerId);
      expect(room.gameState?.players[1].name).toBe('Player_2');
      expect(room.gameState?.players[1].team).toBe('B');

      expect(room.gameState?.players[3].id).toBe(playerSessions[3].playerId);
      expect(room.gameState?.players[3].name).toBe('Player_4');
      expect(room.gameState?.players[3].team).toBe('B');
    });

    it('defensively handles unexpected errors in startGame', () => {
      const errorSpy = vi.spyOn(serverLogger, 'error');
      const malformedRoom = {
        get roomCode(): string {
          throw new Error('Unexpected memory corruption');
        },
      } as any;
      const started = GameCoordinator.startGame(malformedRoom);
      expect(started).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('getSanitizedStateForPlayer', () => {
    let testRoom: Room;
    let seatedPlayerIds: string[];

    beforeEach(() => {
      const { room, session: hostSession } = manager.createRoom('Alice', 4, 's1');
      testRoom = room;
      seatedPlayerIds = [hostSession.playerId];

      for (let i = 1; i <= 3; i++) {
        const join = manager.joinRoom(room.roomCode, `Player_${i + 1}`, `s${i + 1}`);
        if (join.success) {
          manager.claimSeat(room.roomCode, join.session.playerId, i);
          seatedPlayerIds.push(join.session.playerId);
        }
      }

      GameCoordinator.startGame(testRoom);
    });

    it('strictly exposes viewer hand while masking all opponent hands and card counts', () => {
      const hostId = seatedPlayerIds[0];
      const hostSanitized = GameCoordinator.getSanitizedStateForPlayer(testRoom, hostId);

      expect(hostSanitized).not.toBeNull();
      // Viewer (Alice) hand is fully visible
      expect(hostSanitized!.players[0].hand).toBeDefined();
      expect(hostSanitized!.players[0].hand).toHaveLength(13);
      expect(hostSanitized!.players[0].cardCount).toBe(13);

      // Opponents hands are strictly masked (undefined)
      for (let i = 1; i < 4; i++) {
        expect(hostSanitized!.players[i].hand).toBeUndefined();
        expect(hostSanitized!.players[i].cardCount).toBe(13);
      }
    });

    it('masks hands symmetrically when requested by seat 2 (Bob)', () => {
      const bobId = seatedPlayerIds[1];
      const bobSanitized = GameCoordinator.getSanitizedStateForPlayer(testRoom, bobId);

      expect(bobSanitized).not.toBeNull();
      // Bob (index 1) hand visible
      expect(bobSanitized!.players[1].hand).toBeDefined();
      expect(bobSanitized!.players[1].hand).toHaveLength(13);

      // Seat 0, 2, 3 hands strictly masked
      expect(bobSanitized!.players[0].hand).toBeUndefined();
      expect(bobSanitized!.players[2].hand).toBeUndefined();
      expect(bobSanitized!.players[3].hand).toBeUndefined();
    });

    it('never leaks stock deck or pukar card arrays, only exposes counts', () => {
      const hostId = seatedPlayerIds[0];
      const sanitized = GameCoordinator.getSanitizedStateForPlayer(testRoom, hostId);

      expect(sanitized).not.toBeNull();
      expect((sanitized as any).stockDeck).toBeUndefined();
      expect((sanitized as any).pukarPool).toBeUndefined();
      expect((sanitized as any).pukars).toBeUndefined();

      expect(sanitized!.stockDeckCount).toBe(31);
      expect(sanitized!.pukarPoolCount).toBe(2);
      expect(sanitized!.discardPile).toHaveLength(1);
    });

    it('returns public view with all hands masked for spectators or unknown player IDs', () => {
      const spectatorSanitized = GameCoordinator.getSanitizedStateForPlayer(
        testRoom,
        'spectator_999'
      );

      expect(spectatorSanitized).not.toBeNull();
      spectatorSanitized!.players.forEach((p) => {
        expect(p.hand).toBeUndefined();
        expect(p.cardCount).toBe(13);
      });
    });

    it('returns null when room has no gameState', () => {
      const { room } = manager.createRoom('Empty', 4, 's1');
      const result = GameCoordinator.getSanitizedStateForPlayer(room, 'any_id');
      expect(result).toBeNull();
    });

    it('ensures mutations on sanitized state do not affect server gameState', () => {
      const hostId = seatedPlayerIds[0];
      const sanitized = GameCoordinator.getSanitizedStateForPlayer(testRoom, hostId);
      expect(sanitized).not.toBeNull();

      // Modify sanitized hand
      sanitized!.players[0].hand![0].id = 'hacked_card';
      // Server hand should not be mutated
      expect(testRoom.gameState!.players[0].hand[0].id).not.toBe('hacked_card');
    });

    it('exposes newlyPickedUpCardIds only to active viewer', () => {
      // Simulate card pickup
      testRoom.gameState!.newlyPickedUpCardIds = ['picked_1', 'picked_2'];

      // Active player is player 0 (host)
      const hostSanitized = GameCoordinator.getSanitizedStateForPlayer(
        testRoom,
        seatedPlayerIds[0]
      );
      expect(hostSanitized!.newlyPickedUpCardIds).toEqual(['picked_1', 'picked_2']);

      // Inactive player is player 1
      const p2Sanitized = GameCoordinator.getSanitizedStateForPlayer(
        testRoom,
        seatedPlayerIds[1]
      );
      expect(p2Sanitized!.newlyPickedUpCardIds).toEqual([]);
    });

    it('returns null if room status is LOBBY even when gameState is populated', () => {
      testRoom.status = 'LOBBY';
      const result = GameCoordinator.getSanitizedStateForPlayer(testRoom, seatedPlayerIds[0]);
      expect(result).toBeNull();
    });

    it('returns null if playerId is empty string, whitespace, or invalid', () => {
      expect(GameCoordinator.getSanitizedStateForPlayer(testRoom, '')).toBeNull();
      expect(GameCoordinator.getSanitizedStateForPlayer(testRoom, '   ')).toBeNull();
      expect(GameCoordinator.getSanitizedStateForPlayer(testRoom, null as any)).toBeNull();
    });

    it('defensively catches errors and returns null', () => {
      const errorSpy = vi.spyOn(serverLogger, 'error');
      const malformedRoom = {
        get gameState(): any {
          throw new Error('GameState corrupted in memory');
        },
      } as any;
      const result = GameCoordinator.getSanitizedStateForPlayer(malformedRoom, 'any');
      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('handleAction - Turn verification and dispatch', () => {
    let testRoom: Room;
    let seatedPlayerIds: string[];

    beforeEach(() => {
      const { room, session: hostSession } = manager.createRoom('P1', 4, 's1');
      testRoom = room;
      seatedPlayerIds = [hostSession.playerId];

      for (let i = 1; i <= 3; i++) {
        const join = manager.joinRoom(room.roomCode, `P${i + 1}`, `s${i + 1}`);
        if (join.success) {
          manager.claimSeat(room.roomCode, join.session.playerId, i);
          seatedPlayerIds.push(join.session.playerId);
        }
      }

      GameCoordinator.startGame(testRoom);
    });

    it('rejects action if game is not active (e.g. LOBBY)', () => {
      const { room, session } = manager.createRoom('LobbyHost', 4, 's1');
      const result = GameCoordinator.handleAction(room, session.playerId, {
        type: 'DRAW_CARD',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not currently active');
    });

    it('rejects action if dispatched by an inactive player', () => {
      const warnSpy = vi.spyOn(serverLogger, 'warn');
      const p2Id = seatedPlayerIds[1]; // Seat 1, but active is Seat 0

      const result = GameCoordinator.handleAction(testRoom, p2Id, {
        type: 'DRAW_CARD',
        source: 'DECK',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not your turn');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Not your turn to play'),
        expect.objectContaining({
          roomCode: testRoom.roomCode,
          playerId: p2Id,
          actionType: 'DRAW_CARD',
        })
      );
    });

    it('rejects action if dispatched by an unknown player', () => {
      const result = GameCoordinator.handleAction(testRoom, 'random_stranger', {
        type: 'DRAW_CARD',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not your turn');
    });

    it('executes valid DRAW_CARD move by active player, advancing phase to MELD', () => {
      const infoSpy = vi.spyOn(serverLogger, 'info');
      const activeId = seatedPlayerIds[0];

      const initialHandSize = testRoom.gameState!.players[0].hand.length;
      expect(initialHandSize).toBe(13);
      expect(testRoom.gameState!.phase).toBe('DRAW');

      const result = GameCoordinator.handleAction(testRoom, activeId, {
        type: 'DRAW_CARD',
        source: 'DECK',
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(testRoom.gameState!.phase).toBe('MELD');
      expect(testRoom.gameState!.players[0].hand).toHaveLength(14);
      expect(testRoom.gameState!.stockDeck).toHaveLength(30);

      expect(infoSpy).toHaveBeenCalledWith(
        'Action executed cleanly: DRAW_CARD',
        expect.objectContaining({
          roomCode: testRoom.roomCode,
          playerId: activeId,
        })
      );
    });

    it('executes valid DISCARD_CARD move, advancing turn to next player', () => {
      const activeId = seatedPlayerIds[0];

      // 1. Draw first to enter MELD phase
      GameCoordinator.handleAction(testRoom, activeId, {
        type: 'DRAW_CARD',
        source: 'DECK',
      });
      expect(testRoom.gameState!.phase).toBe('MELD');

      const cardToDiscard = testRoom.gameState!.players[0].hand[0];

      // 2. Discard
      const discardResult = GameCoordinator.handleAction(testRoom, activeId, {
        type: 'DISCARD_CARD',
        cardId: cardToDiscard.id,
      });

      expect(discardResult.success).toBe(true);
      expect(testRoom.gameState!.phase).toBe('DRAW');
      expect(testRoom.gameState!.currentPlayerIndex).toBe(1); // Advanced to P2
      expect(testRoom.gameState!.players[0].hand).toHaveLength(13);
      expect(testRoom.gameState!.discardPile[testRoom.gameState!.discardPile.length - 1].id).toBe(cardToDiscard.id);
    });

    it('rejects illegal move (invalid meld) without mutating gameState', () => {
      const warnSpy = vi.spyOn(serverLogger, 'warn');
      const activeId = seatedPlayerIds[0];

      // Draw first to reach MELD phase
      GameCoordinator.handleAction(testRoom, activeId, {
        type: 'DRAW_CARD',
        source: 'DECK',
      });

      const handBefore = [...testRoom.gameState!.players[0].hand];
      const meldsBeforeA = [...testRoom.gameState!.melds.A];

      // Dispatch invalid meld (only 2 arbitrary cards)
      const invalidCardIds = [handBefore[0].id, handBefore[1].id];
      const meldResult = GameCoordinator.handleAction(testRoom, activeId, {
        type: 'PLAY_NEW_MELD',
        cardIds: invalidCardIds,
      });

      expect(meldResult.success).toBe(false);
      expect(meldResult.error).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Action rejected by rules engine'),
        expect.objectContaining({
          roomCode: testRoom.roomCode,
          playerId: activeId,
          actionType: 'PLAY_NEW_MELD',
        })
      );

      // Game state must remain untouched
      expect(testRoom.gameState!.players[0].hand).toEqual(handBefore);
      expect(testRoom.gameState!.melds.A).toEqual(meldsBeforeA);
      expect(testRoom.gameState!.phase).toBe('MELD');
    });

    it('rejects out-of-phase moves (e.g. discarding in DRAW phase)', () => {
      const activeId = seatedPlayerIds[0];
      const cardId = testRoom.gameState!.players[0].hand[0].id;

      const result = GameCoordinator.handleAction(testRoom, activeId, {
        type: 'DISCARD_CARD',
        cardId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot discard during DRAW phase');
    });

    it('executes valid TAKE_DISCARD / DRAW_CARD from BOTTOM', () => {
      const activeId = seatedPlayerIds[0];
      const discardTop = testRoom.gameState!.discardPile[testRoom.gameState!.discardPile.length - 1];

      const res = GameCoordinator.handleAction(testRoom, activeId, {
        type: 'DRAW_CARD',
        source: 'BOTTOM',
      });

      expect(res.success).toBe(true);
      expect(testRoom.gameState!.phase).toBe('MELD');
      expect(testRoom.gameState!.players[0].hand.some((c) => c.id === discardTop.id)).toBe(true);
    });

    it('executes valid PLAY_NEW_MELD and ADD_TO_MELD on table', () => {
      const activeId = seatedPlayerIds[0];
      // Give active player a valid RUN of 7, 8, 9, 10 Hearts + 1 discard card
      const c7: Card = { id: 'm_h7', suit: 'HEARTS', rank: 7 };
      const c8: Card = { id: 'm_h8', suit: 'HEARTS', rank: 8 };
      const c9: Card = { id: 'm_h9', suit: 'HEARTS', rank: 9 };
      const c10: Card = { id: 'm_h10', suit: 'HEARTS', rank: 10 };
      const discardC: Card = { id: 'm_extra', suit: 'SPADES', rank: 4 };

      testRoom.gameState!.players[0].hand = [c7, c8, c9, c10, discardC];
      testRoom.gameState!.phase = 'MELD';

      // Play 7, 8, 9
      const meldRes = GameCoordinator.handleAction(testRoom, activeId, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['m_h7', 'm_h8', 'm_h9'],
      });
      expect(meldRes.success).toBe(true);
      expect(testRoom.gameState!.melds.A).toHaveLength(1);
      const meldId = testRoom.gameState!.melds.A[0].id;
      expect(testRoom.gameState!.players[0].hand).toHaveLength(2); // c10 and discardC

      // Add 10 to meld
      const addRes = GameCoordinator.handleAction(testRoom, activeId, {
        type: 'ADD_TO_MELD',
        meldId,
        cardIds: ['m_h10'],
      });
      expect(addRes.success).toBe(true);
      expect(testRoom.gameState!.melds.A[0].cards).toHaveLength(4);
      expect(testRoom.gameState!.players[0].hand).toHaveLength(1); // discardC
    });

    it('rejects action with invalid action type', () => {
      const activeId = seatedPlayerIds[0];
      const res = GameCoordinator.handleAction(testRoom, activeId, {
        type: 'INVALID_MOVE_TYPE' as any,
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Unknown action type');
    });

    it('advances turn sequentially through all 4 players and wraps around', () => {
      for (let i = 0; i < 4; i++) {
        const playerId = seatedPlayerIds[i];
        expect(testRoom.gameState!.currentPlayerIndex).toBe(i);

        // Draw
        const drawRes = GameCoordinator.handleAction(testRoom, playerId, {
          type: 'DRAW_CARD',
          source: 'DECK',
        });
        expect(drawRes.success).toBe(true);

        // Discard
        const discardCard = testRoom.gameState!.players[i].hand[0];
        const discardRes = GameCoordinator.handleAction(testRoom, playerId, {
          type: 'DISCARD_CARD',
          cardId: discardCard.id,
        });
        expect(discardRes.success).toBe(true);
      }

      // Wraps around to player 0
      expect(testRoom.gameState!.currentPlayerIndex).toBe(0);
    });

    it('rejects normal turn action when room status is ROUND_OVER', () => {
      testRoom.status = 'ROUND_OVER';
      testRoom.gameState!.roundStatus = 'ROUND_OVER';
      testRoom.gameState!.isRoundOver = true;

      const res = GameCoordinator.handleAction(testRoom, seatedPlayerIds[0], {
        type: 'DRAW_CARD',
        source: 'DECK',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('not currently active');
    });

    it('rejects malformed, null, or empty action payloads', () => {
      const activeId = seatedPlayerIds[0];
      expect(GameCoordinator.handleAction(testRoom, activeId, null as any).success).toBe(false);
      expect(GameCoordinator.handleAction(testRoom, activeId, undefined as any).success).toBe(false);
      expect(GameCoordinator.handleAction(testRoom, activeId, {} as any).success).toBe(false);
      expect(GameCoordinator.handleAction(testRoom, activeId, { type: '' } as any).success).toBe(false);
    });

    it('rejects invalid or whitespace playerIds', () => {
      expect(GameCoordinator.handleAction(testRoom, '', { type: 'DRAW_CARD' }).success).toBe(false);
      expect(GameCoordinator.handleAction(testRoom, '   ', { type: 'DRAW_CARD' }).success).toBe(false);
      expect(GameCoordinator.handleAction(testRoom, null as any, { type: 'DRAW_CARD' }).success).toBe(false);
    });
  });

  describe('Multi-round lifecycle actions', () => {
    let testRoom: Room;
    let seatedPlayerIds: string[];

    beforeEach(() => {
      const { room, session: hostSession } = manager.createRoom('P1', 4, 's1');
      testRoom = room;
      seatedPlayerIds = [hostSession.playerId];

      for (let i = 1; i <= 3; i++) {
        const join = manager.joinRoom(room.roomCode, `P${i + 1}`, `s${i + 1}`);
        if (join.success) {
          manager.claimSeat(room.roomCode, join.session.playerId, i);
          seatedPlayerIds.push(join.session.playerId);
        }
      }

      GameCoordinator.startGame(testRoom);
    });

    it('rejects START_NEXT_ROUND if current round is not over', () => {
      const result = GameCoordinator.handleAction(testRoom, seatedPlayerIds[0], {
        type: 'START_NEXT_ROUND',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('current round is not over');
    });

    it('allows START_NEXT_ROUND when round is over, remapping player IDs and resetting room status to IN_GAME', () => {
      // Simulate round end
      testRoom.gameState!.roundStatus = 'ROUND_OVER';
      testRoom.gameState!.isRoundOver = true;
      testRoom.status = 'ROUND_OVER';
      testRoom.gameState!.scores = { A: 120, B: 50 };

      // Any seated player can advance to next round
      const result = GameCoordinator.handleAction(testRoom, seatedPlayerIds[1], {
        type: 'START_NEXT_ROUND',
      });

      expect(result.success).toBe(true);
      expect(testRoom.status).toBe('IN_GAME');
      expect(testRoom.gameState!.round).toBe(2);
      expect(testRoom.gameState!.roundStatus).toBe('PLAYING');
      expect(testRoom.gameState!.isRoundOver).toBe(false);
      expect(testRoom.gameState!.scores).toEqual({ A: 120, B: 50 });

      // Player IDs must be preserved for sanitization
      testRoom.gameState!.players.forEach((p, idx) => {
        expect(p.id).toBe(seatedPlayerIds[idx]);
        expect(p.hand).toHaveLength(13);
      });

      // Sanitization works seamlessly for round 2
      const hostSanitized = GameCoordinator.getSanitizedStateForPlayer(
        testRoom,
        seatedPlayerIds[0]
      );
      expect(hostSanitized!.round).toBe(2);
      expect(hostSanitized!.players[0].hand).toHaveLength(13);
      expect(hostSanitized!.players[1].hand).toBeUndefined();
    });

    it('handles RESET_GAME, resetting round to 1 and preserving seat IDs', () => {
      testRoom.gameState!.roundStatus = 'GAME_OVER';
      testRoom.status = 'GAME_OVER';

      const result = GameCoordinator.handleAction(testRoom, seatedPlayerIds[0], {
        type: 'RESET_GAME',
      });

      expect(result.success).toBe(true);
      expect(testRoom.status).toBe('IN_GAME');
      expect(testRoom.gameState!.round).toBe(1);
      expect(testRoom.gameState!.scores).toEqual({ A: 0, B: 0 });

      testRoom.gameState!.players.forEach((p, idx) => {
        expect(p.id).toBe(seatedPlayerIds[idx]);
      });
    });

    it('rejects START_NEXT_ROUND from an unseated player', () => {
      testRoom.gameState!.roundStatus = 'ROUND_OVER';
      testRoom.gameState!.isRoundOver = true;
      testRoom.status = 'ROUND_OVER';

      const result = GameCoordinator.handleAction(testRoom, 'unseated_player_xyz', {
        type: 'START_NEXT_ROUND',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Player is not seated in this room');
    });

    it('updates room status to ROUND_OVER / GAME_OVER when action triggers end of round', () => {
      const activeId = seatedPlayerIds[0];
      testRoom.gameState!.phase = 'MELD';
      // Setup state where player has 1 card, discard finishes hand with 0 pukars remaining
      testRoom.gameState!.players[0].hand = [testRoom.gameState!.players[0].hand[0]];
      testRoom.gameState!.pukarPool = []; // 0 pukars left, going out ends round!

      const cardId = testRoom.gameState!.players[0].hand[0].id;
      const result = GameCoordinator.handleAction(testRoom, activeId, {
        type: 'DISCARD_CARD',
        cardId,
      });

      expect(result.success).toBe(true);
      expect(testRoom.gameState!.roundStatus).toBe('ROUND_OVER');
      expect(testRoom.status).toBe('ROUND_OVER');
    });

    it('rejects START_NEXT_ROUND when game status is GAME_OVER', () => {
      testRoom.gameState!.roundStatus = 'GAME_OVER';
      testRoom.status = 'GAME_OVER';
      testRoom.gameState!.isRoundOver = true;

      const result = GameCoordinator.handleAction(testRoom, seatedPlayerIds[0], {
        type: 'START_NEXT_ROUND',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('game is already over');
    });

    it('rejects RESET_GAME from non-host player during active in-progress game', () => {
      expect(testRoom.status).toBe('IN_GAME');
      expect(testRoom.gameState!.roundStatus).toBe('PLAYING');

      // Player 2 is not the host
      const nonHostId = seatedPlayerIds[1];
      const result = GameCoordinator.handleAction(testRoom, nonHostId, {
        type: 'RESET_GAME',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only the host can reset');
    });

    it('allows RESET_GAME by host during active in-progress game', () => {
      expect(testRoom.status).toBe('IN_GAME');
      const hostId = seatedPlayerIds[0];

      const result = GameCoordinator.handleAction(testRoom, hostId, {
        type: 'RESET_GAME',
      });

      expect(result.success).toBe(true);
      expect(testRoom.gameState!.round).toBe(1);
    });

    it('rejects RESET_GAME attempting to change player count', () => {
      const hostId = seatedPlayerIds[0];
      const result = GameCoordinator.handleAction(testRoom, hostId, {
        type: 'RESET_GAME',
        playerCount: 6,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot change room player count');
    });

    it('preserves player names from room seats across RESET_GAME', () => {
      const hostId = seatedPlayerIds[0];
      testRoom.seats[0].playerName = 'CustomAlice';
      testRoom.seats[1].playerName = 'CustomBob';

      const result = GameCoordinator.handleAction(testRoom, hostId, {
        type: 'RESET_GAME',
      });

      expect(result.success).toBe(true);
      expect(testRoom.gameState!.players[0].name).toBe('CustomAlice');
      expect(testRoom.gameState!.players[1].name).toBe('CustomBob');
    });
  });

  describe('Defensive Error Handling and Logger Integration', () => {
    it('catches unexpected exceptions in handleAction without throwing', () => {
      const errorSpy = vi.spyOn(serverLogger, 'error');

      const malformedRoom = {
        roomCode: 'FAIL',
        status: 'IN_GAME',
        seats: [{ seatIndex: 0, playerId: 'p1', playerName: 'P1', team: 'A', isConnected: true, isHost: true }],
        get gameState(): any {
          throw new Error('Database connection dropped unexpectedly');
        },
      } as any;

      const result = GameCoordinator.handleAction(malformedRoom, 'p1', {
        type: 'DRAW_CARD',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal server error processing move');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected exception during action execution'),
        expect.objectContaining({
          roomCode: 'FAIL',
          playerId: 'p1',
          actionType: 'DRAW_CARD',
        })
      );
    });
  });

  describe('Stock Deck Optimization (OPTIMIZE_DECK_ORDER)', () => {
    it('allows seated players to trigger OPTIMIZE_DECK_ORDER at any time even when not their turn', () => {
      const room = manager.createRoom('Host', 4, 's1').room;
      for (let i = 1; i <= 3; i++) {
        const join = manager.joinRoom(room.roomCode, `P${i + 1}`, `s${i + 1}`);
        if (join.success) manager.claimSeat(room.roomCode, join.session.playerId, i);
      }
      expect(GameCoordinator.startGame(room)).toBe(true);

      const nonActivePlayerId = room.seats[1].playerId!;
      expect(room.gameState!.currentPlayerIndex).toBe(0);

      const result = GameCoordinator.handleAction(room, nonActivePlayerId, {
        type: 'OPTIMIZE_DECK_ORDER',
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
