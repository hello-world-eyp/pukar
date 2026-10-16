import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { RoomManager } from '../../server/room-manager';
import { serverLogger } from '../../server/logger';

describe('RoomManager', () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
    vi.restoreAllMocks();
  });

  describe('Room creation', () => {
    it('creates a 4-player room with alternating team seats', () => {
      const { room, session } = manager.createRoom('Alice', 4, 'sock_1');
      expect(room.roomCode).toMatch(/^[A-Z0-9]{4}$/);
      expect(room.playerCount).toBe(4);
      expect(room.status).toBe('LOBBY');
      expect(room.seats).toHaveLength(4);
      expect(room.seats[0].team).toBe('A');
      expect(room.seats[1].team).toBe('B');
      expect(room.seats[2].team).toBe('A');
      expect(room.seats[3].team).toBe('B');

      // Host is automatically assigned to seat 0
      expect(room.seats[0].playerName).toBe('Alice');
      expect(room.seats[0].playerId).toBe(session.playerId);
      expect(room.seats[0].isHost).toBe(true);
      expect(room.seats[0].isConnected).toBe(true);

      // Other seats are empty
      expect(room.seats[1].playerId).toBeNull();
      expect(room.seats[1].playerName).toBeNull();
      expect(room.seats[1].isConnected).toBe(false);

      expect(room.hostPlayerId).toBe(session.playerId);
      expect(session.seatIndex).toBe(0);
      expect(session.roomCode).toBe(room.roomCode);
    });

    it('creates a 6-player room with 6 alternating team seats', () => {
      const { room } = manager.createRoom('Host6', 6, 'sock_1');
      expect(room.seats).toHaveLength(6);
      expect(room.playerCount).toBe(6);
      expect(room.seats.map((s) => s.team)).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
      expect(room.seats[0].playerName).toBe('Host6');
      expect(room.seats[0].isHost).toBe(true);
    });

    it('defaults host name to "Host" if whitespace or empty string is provided', () => {
      const { room, session } = manager.createRoom('   ', 4, 'sock_host');
      expect(session.playerName).toBe('Host');
      expect(room.seats[0].playerName).toBe('Host');
    });

    it('generates 4-character codes avoiding ambiguous characters (I, 1, O, 0)', () => {
      const generatedCodes = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const code = manager.generateRoomCode();
        expect(code).toHaveLength(4);
        expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
        expect(code).not.toMatch(/[I1O0]/);
        generatedCodes.add(code);
      }
      expect(generatedCodes.size).toBeGreaterThan(1);
    });

    it('falls back deterministically without ambiguous characters if 1000 random attempts collide', () => {
      // Force randomInt to always produce 0, so random code is 'AAAA'
      const randomSpy = vi.spyOn(crypto, 'randomInt').mockImplementation((() => 0) as any);
      // Pre-occupy 'AAAA'
      manager['rooms'].set('AAAA', {} as any);

      const code = manager.generateRoomCode();
      expect(code).toHaveLength(4);
      expect(code).not.toMatch(/[I1O0]/);
      expect(code).not.toBe('AAAA');
      randomSpy.mockRestore();
    });

    it('throws an error if invalid playerCount is provided', () => {
      expect(() => {
        // @ts-expect-error Testing runtime invalid player count
        manager.createRoom('Alice', 5, 'sock_1');
      }).toThrow('Player count must be 4 or 6');
    });

    it('cleans up existing socket association when creating a new room to prevent ghost connections', () => {
      const { room: r1, session: s1 } = manager.createRoom('Alice', 4, 'sock_shared');
      expect(manager.getSessionBySocket('sock_shared')?.playerId).toBe(s1.playerId);

      // Same socket creates a second room
      const { room: r2, session: s2 } = manager.createRoom('Bob', 4, 'sock_shared');
      expect(manager.getSessionBySocket('sock_shared')?.playerId).toBe(s2.playerId);

      // Previous room session in r1 should be marked disconnected
      expect(r1.seats[0].isConnected).toBe(false);
      expect(s1.isConnected).toBe(false);
      expect(r2.seats[0].isConnected).toBe(true);
    });
  });

  describe('Joining room', () => {
    it('allows players to join and select seats', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      const joinResult = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      expect(joinResult.success).toBe(true);
      if (!joinResult.success) return;

      expect(joinResult.isReconnect).toBe(false);
      expect(joinResult.session.seatIndex).toBeNull();
      expect(joinResult.session.playerName).toBe('Bob');

      const seatResult = manager.claimSeat(room.roomCode, joinResult.session.playerId, 1);
      expect(seatResult.success).toBe(true);
      expect(room.seats[1].playerName).toBe('Bob');
      expect(room.seats[1].team).toBe('B');
      expect(room.seats[1].isConnected).toBe(true);
    });

    it('handles case-insensitive room codes with surrounding whitespace', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      const lowerCodeWithSpaces = `  ${room.roomCode.toLowerCase()}  `;
      const joinResult = manager.joinRoom(lowerCodeWithSpaces, 'Bob', 'sock_2');
      expect(joinResult.success).toBe(true);
      if (joinResult.success) {
        expect(joinResult.room.roomCode).toBe(room.roomCode);
      }
    });

    it('defaults player name to "Player" if empty or whitespace', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      const joinResult = manager.joinRoom(room.roomCode, '   ', 'sock_2');
      expect(joinResult.success).toBe(true);
      if (joinResult.success) {
        expect(joinResult.session.playerName).toBe('Player');
      }
    });

    it('returns error when joining a non-existent room', () => {
      const joinResult = manager.joinRoom('ZZZZ', 'Bob', 'sock_2');
      expect(joinResult.success).toBe(false);
      if (!joinResult.success) {
        expect(joinResult.error).toContain('does not exist');
      }
    });

    it('prevents new players without sessionToken from joining an IN_GAME room', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      room.status = 'IN_GAME';

      const joinResult = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      expect(joinResult.success).toBe(false);
      if (!joinResult.success) {
        expect(joinResult.error).toContain('in progress');
      }
    });

    it('cleans up previous socket association when joining a different room', () => {
      const { room: r1, session: s1 } = manager.createRoom('Alice', 4, 'sock_reuse');
      const { room: r2 } = manager.createRoom('Charlie', 4, 'sock_charlie');

      // sock_reuse joins r2 as a new player
      const joinResult = manager.joinRoom(r2.roomCode, 'David', 'sock_reuse');
      expect(joinResult.success).toBe(true);

      // Session in r1 should now be disconnected
      expect(s1.isConnected).toBe(false);
      expect(r1.seats[0].isConnected).toBe(false);
    });
  });

  describe('Seat claiming, swapping, and assigning', () => {
    it('prevents selecting an already occupied seat', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      if (!bob.success) return;

      const seatResult = manager.claimSeat(room.roomCode, bob.session.playerId, 0); // seat 0 taken by Alice
      expect(seatResult.success).toBe(false);
      expect(seatResult.error).toContain('already occupied');
    });

    it('allows a player to switch seats, vacating the previously occupied seat', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      if (!bob.success) return;

      // Bob claims seat 1
      const claim1 = manager.claimSeat(room.roomCode, bob.session.playerId, 1);
      expect(claim1.success).toBe(true);
      expect(room.seats[1].playerId).toBe(bob.session.playerId);

      // Bob moves to seat 2
      const claim2 = manager.claimSeat(room.roomCode, bob.session.playerId, 2);
      expect(claim2.success).toBe(true);
      expect(bob.session.seatIndex).toBe(2);

      // Seat 1 is now vacated
      expect(room.seats[1].playerId).toBeNull();
      expect(room.seats[1].playerName).toBeNull();
      expect(room.seats[1].isConnected).toBe(false);

      // Seat 2 is now Bob's
      expect(room.seats[2].playerId).toBe(bob.session.playerId);
      expect(room.seats[2].playerName).toBe('Bob');
      expect(room.seats[2].isConnected).toBe(true);
    });

    it('returns success if player claims the seat they already occupy', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      if (!bob.success) return;

      manager.claimSeat(room.roomCode, bob.session.playerId, 1);
      const repeatClaim = manager.claimSeat(room.roomCode, bob.session.playerId, 1);
      expect(repeatClaim.success).toBe(true);
      expect(room.seats[1].playerId).toBe(bob.session.playerId);
    });

    it('supports assignSeat as an alias returning boolean', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      if (!bob.success) return;

      expect(manager.assignSeat(room.roomCode, bob.session.playerId, 1)).toBe(true);
      expect(room.seats[1].playerId).toBe(bob.session.playerId);
      expect(manager.assignSeat(room.roomCode, bob.session.playerId, 0)).toBe(false);
    });

    it('rejects claim for invalid seat indices', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      if (!bob.success) return;

      expect(manager.claimSeat(room.roomCode, bob.session.playerId, -1).success).toBe(false);
      expect(manager.claimSeat(room.roomCode, bob.session.playerId, 4).success).toBe(false);
      expect(manager.claimSeat(room.roomCode, bob.session.playerId, 99).success).toBe(false);
      expect(manager.claimSeat(room.roomCode, bob.session.playerId, 1.5).success).toBe(false);
    });

    it('rejects claim for unknown room or unknown player', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      expect(manager.claimSeat('INVALID', 'p_test', 1).success).toBe(false);
      expect(manager.claimSeat(room.roomCode, 'unknown_player', 1).success).toBe(false);
    });

    it('rejects seat claims when room status is IN_GAME', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      if (!bob.success) return;

      room.status = 'IN_GAME';
      const claimResult = manager.claimSeat(room.roomCode, bob.session.playerId, 1);
      expect(claimResult.success).toBe(false);
      expect(claimResult.error).toContain('in progress');
    });

    it('allows a player to voluntarily vacate their seat via vacateSeat', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      if (!bob.success) return;

      manager.claimSeat(room.roomCode, bob.session.playerId, 1);
      expect(room.seats[1].playerId).toBe(bob.session.playerId);

      const vacateResult = manager.vacateSeat(room.roomCode, bob.session.playerId);
      expect(vacateResult).toBe(true);
      expect(room.seats[1].playerId).toBeNull();
      expect(bob.session.seatIndex).toBeNull();

      // Vacating again returns false
      expect(manager.vacateSeat(room.roomCode, bob.session.playerId)).toBe(false);
    });
  });

  describe('Disconnection and Session Resilience', () => {
    it('preserves seat on disconnect and restores on reconnect with sessionToken', () => {
      const { room, session } = manager.createRoom('Alice', 4, 'sock_1');

      // Disconnect Alice
      const disResult = manager.handleDisconnect('sock_1');
      expect(disResult.found).toBe(true);
      expect(disResult.roomCode).toBe(room.roomCode);
      expect(disResult.seatIndex).toBe(0);
      expect(disResult.playerName).toBe('Alice');
      expect(disResult.playerId).toBe(session.playerId);
      expect(room.seats[0].isConnected).toBe(false);
      expect(session.isConnected).toBe(false);

      // Reconnect Alice with sessionToken
      const reconResult = manager.joinRoom(
        room.roomCode,
        'Alice',
        'sock_new',
        session.sessionToken
      );
      expect(reconResult.success).toBe(true);
      if (!reconResult.success) return;

      expect(reconResult.isReconnect).toBe(true);
      expect(reconResult.session.seatIndex).toBe(0);
      expect(reconResult.session.socketId).toBe('sock_new');
      expect(room.seats[0].isConnected).toBe(true);
      expect(reconResult.session.isConnected).toBe(true);

      // Lookup by new socket works
      const lookedUpSession = manager.getSessionBySocket('sock_new');
      expect(lookedUpSession?.playerId).toBe(session.playerId);
    });

    it('returns found: false when disconnecting unknown socket', () => {
      const res = manager.handleDisconnect('unknown_socket');
      expect(res.found).toBe(false);
    });

    it('allows reconnecting even if game is IN_GAME', () => {
      const { room, session } = manager.createRoom('Alice', 4, 'sock_1');
      room.status = 'IN_GAME';

      manager.handleDisconnect('sock_1');
      expect(room.seats[0].isConnected).toBe(false);

      const recon = manager.joinRoom(room.roomCode, 'Alice', 'sock_2', session.sessionToken);
      expect(recon.success).toBe(true);
      if (recon.success) {
        expect(recon.isReconnect).toBe(true);
        expect(room.seats[0].isConnected).toBe(true);
      }
    });

    it('handles player reconnecting when unseated', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      if (!bob.success) return;

      manager.handleDisconnect('sock_2');
      expect(bob.session.isConnected).toBe(false);

      const recon = manager.joinRoom(room.roomCode, 'Bob', 'sock_3', bob.session.sessionToken);
      expect(recon.success).toBe(true);
      if (recon.success) {
        expect(recon.isReconnect).toBe(true);
        expect(recon.session.seatIndex).toBeNull();
      }
    });

    it('handles rapid socket reconnect before disconnect event fires without losing mapping', () => {
      const { room, session } = manager.createRoom('Alice', 4, 'sock_old');
      // Reconnect with sock_new before sock_old fires disconnect
      const recon = manager.joinRoom(room.roomCode, 'Alice', 'sock_new', session.sessionToken);
      expect(recon.success).toBe(true);
      expect(manager.getSessionBySocket('sock_new')?.playerId).toBe(session.playerId);
      expect(manager.getSessionBySocket('sock_old')).toBeUndefined();

      // Later, delayed disconnect for sock_old arrives
      const dis = manager.handleDisconnect('sock_old');
      expect(dis.found).toBe(false);
      // sock_new is still connected and active
      expect(session.isConnected).toBe(true);
      expect(room.seats[0].isConnected).toBe(true);
    });
  });

  describe('Host kick functionality', () => {
    it('allows the host to kick an abandoned seat in lobby', () => {
      const { room, session: hostSession } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      if (!bob.success) return;
      manager.claimSeat(room.roomCode, bob.session.playerId, 1);

      const kickResult = manager.kickPlayer(room.roomCode, hostSession.playerId, 1);
      expect(kickResult).toBe(true);
      expect(room.seats[1].playerId).toBeNull();
      expect(room.seats[1].playerName).toBeNull();
      expect(bob.session.seatIndex).toBeNull();
    });

    it('rejects kick when initiated by non-host', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      const charlie = manager.joinRoom(room.roomCode, 'Charlie', 'sock_3');
      if (!bob.success || !charlie.success) return;

      manager.claimSeat(room.roomCode, charlie.session.playerId, 2);

      // Bob tries to kick Charlie
      const kickResult = manager.kickPlayer(room.roomCode, bob.session.playerId, 2);
      expect(kickResult).toBe(false);
      expect(room.seats[2].playerId).toBe(charlie.session.playerId);
    });

    it('prevents host from kicking themselves', () => {
      const { room, session: hostSession } = manager.createRoom('Alice', 4, 'sock_1');
      const kickResult = manager.kickPlayer(room.roomCode, hostSession.playerId, 0);
      expect(kickResult).toBe(false);
      expect(room.seats[0].playerId).toBe(hostSession.playerId);
    });

    it('rejects kick on an already empty seat', () => {
      const { room, session: hostSession } = manager.createRoom('Alice', 4, 'sock_1');
      const kickResult = manager.kickPlayer(room.roomCode, hostSession.playerId, 1);
      expect(kickResult).toBe(false);
    });

    it('rejects kick with out-of-bounds seat index', () => {
      const { room, session: hostSession } = manager.createRoom('Alice', 4, 'sock_1');
      expect(manager.kickPlayer(room.roomCode, hostSession.playerId, -1)).toBe(false);
      expect(manager.kickPlayer(room.roomCode, hostSession.playerId, 10)).toBe(false);
    });

    it('rejects kick when game status is IN_GAME', () => {
      const { room, session: hostSession } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      if (!bob.success) return;
      manager.claimSeat(room.roomCode, bob.session.playerId, 1);

      room.status = 'IN_GAME';
      const kickResult = manager.kickPlayer(room.roomCode, hostSession.playerId, 1);
      expect(kickResult).toBe(false);
      expect(room.seats[1].playerId).toBe(bob.session.playerId);
    });
  });

  describe('Host transfer functionality', () => {
    it('allows host to transfer host status to another player and updates seat flags', () => {
      const { room, session: hostSession } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      if (!bob.success) return;
      manager.claimSeat(room.roomCode, bob.session.playerId, 1);

      expect(room.hostPlayerId).toBe(hostSession.playerId);
      expect(room.seats[0].isHost).toBe(true);
      expect(room.seats[1].isHost).toBe(false);

      const transferred = manager.transferHost(
        room.roomCode,
        hostSession.playerId,
        bob.session.playerId
      );
      expect(transferred).toBe(true);
      expect(room.hostPlayerId).toBe(bob.session.playerId);
      expect(room.seats[0].isHost).toBe(false);
      expect(room.seats[1].isHost).toBe(true);
    });

    it('rejects host transfer initiated by a non-host player', () => {
      const { room, session: hostSession } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      if (!bob.success) return;

      const transferred = manager.transferHost(
        room.roomCode,
        bob.session.playerId, // Bob is not host
        hostSession.playerId
      );
      expect(transferred).toBe(false);
      expect(room.hostPlayerId).toBe(hostSession.playerId);
    });

    it('rejects host transfer to a player not in the room', () => {
      const { room, session: hostSession } = manager.createRoom('Alice', 4, 'sock_1');
      const transferred = manager.transferHost(
        room.roomCode,
        hostSession.playerId,
        'non_existent_player_id'
      );
      expect(transferred).toBe(false);
      expect(room.hostPlayerId).toBe(hostSession.playerId);
    });

    it('is idempotent when host transfers to themselves', () => {
      const { room, session: hostSession } = manager.createRoom('Alice', 4, 'sock_1');
      expect(
        manager.transferHost(room.roomCode, hostSession.playerId, hostSession.playerId)
      ).toBe(true);
      expect(room.hostPlayerId).toBe(hostSession.playerId);
    });
  });

  describe('Voluntary Leave (leaveRoom) and Empty Room Cleanup', () => {
    it('allows a seated player to leave room, vacating seat and clearing session', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      if (!bob.success) return;
      manager.claimSeat(room.roomCode, bob.session.playerId, 1);

      expect(room.seats[1].playerId).toBe(bob.session.playerId);
      expect(manager.getSessionBySocket('sock_2')).toBeDefined();

      const left = manager.leaveRoom(room.roomCode, bob.session.playerId);
      expect(left).toBe(true);
      expect(room.seats[1].playerId).toBeNull();
      expect(room.sessions.has(bob.session.playerId)).toBe(false);
      expect(room.tokenToPlayerId.has(bob.session.sessionToken)).toBe(false);
      expect(manager.getSessionBySocket('sock_2')).toBeUndefined();
    });

    it('automatically transfers host when the current host leaves and other players remain', () => {
      const { room, session: hostSession } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      if (!bob.success) return;
      manager.claimSeat(room.roomCode, bob.session.playerId, 1);

      const left = manager.leaveRoom(room.roomCode, hostSession.playerId);
      expect(left).toBe(true);
      expect(room.hostPlayerId).toBe(bob.session.playerId);
      expect(room.seats[0].playerId).toBeNull();
      expect(room.seats[1].isHost).toBe(true);
    });

    it('destroys room when the sole remaining player leaves', () => {
      const { room, session } = manager.createRoom('Alice', 4, 'sock_1');
      const left = manager.leaveRoom(room.roomCode, session.playerId);
      expect(left).toBe(true);
      expect(manager.getRoom(room.roomCode)).toBeUndefined();
    });

    it('cleans up empty rooms via destroyRoomIfEmpty', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      manager.handleDisconnect('sock_1');

      // Alice is disconnected
      expect(manager.destroyRoomIfEmpty(room.roomCode)).toBe(true);
      expect(manager.getRoom(room.roomCode)).toBeUndefined();
    });

    it('does not destroy room via destroyRoomIfEmpty if players are connected', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      expect(manager.destroyRoomIfEmpty(room.roomCode)).toBe(false);
      expect(manager.getRoom(room.roomCode)).toBeDefined();
    });
  });

  describe('Room Lifecycle & Queries', () => {
    it('retrieves room by room code case-insensitively', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      expect(manager.getRoom(room.roomCode)).toBe(room);
      expect(manager.getRoom(room.roomCode.toLowerCase())).toBe(room);
      expect(manager.getRoom(`  ${room.roomCode}  `)).toBe(room);
    });

    it('destroys room and clears socket associations', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      expect(bob.success).toBe(true);
      expect(manager.getSessionBySocket('sock_1')).toBeDefined();
      expect(manager.getSessionBySocket('sock_2')).toBeDefined();

      const destroyed = manager.destroyRoom(room.roomCode);
      expect(destroyed).toBe(true);
      expect(manager.getRoom(room.roomCode)).toBeUndefined();
      expect(manager.getSessionBySocket('sock_1')).toBeUndefined();
      expect(manager.getSessionBySocket('sock_2')).toBeUndefined();

      // Second destruction returns false
      expect(manager.destroyRoom(room.roomCode)).toBe(false);
    });

    it('cleans up socket-to-player mappings properly on socket change', () => {
      const { room, session } = manager.createRoom('Alice', 4, 'sock_old');
      expect(manager.getSessionBySocket('sock_old')?.playerId).toBe(session.playerId);

      // Reconnect with sock_new
      manager.joinRoom(room.roomCode, 'Alice', 'sock_new', session.sessionToken);

      expect(manager.getSessionBySocket('sock_old')).toBeUndefined();
      expect(manager.getSessionBySocket('sock_new')?.playerId).toBe(session.playerId);
    });

    it('retrieves room by socket ID', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      expect(manager.getRoomBySocket('sock_1')).toBe(room);
      expect(manager.getRoomBySocket('unknown_sock')).toBeUndefined();
    });
  });

  describe('Defensive Logging and Error Handling', () => {
    it('logs structured context with serverLogger on create, join, seat claim, and disconnect', () => {
      const infoSpy = vi.spyOn(serverLogger, 'info');
      const warnSpy = vi.spyOn(serverLogger, 'warn');

      const { room, session } = manager.createRoom('Alice', 4, 'sock_1');
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Room created'),
        expect.objectContaining({ roomCode: room.roomCode, playerId: session.playerId })
      );

      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_2');
      if (bob.success) {
        expect(infoSpy).toHaveBeenCalledWith(
          expect.stringContaining('joined room'),
          expect.objectContaining({ roomCode: room.roomCode, playerId: bob.session.playerId })
        );

        manager.claimSeat(room.roomCode, bob.session.playerId, 1);
        expect(infoSpy).toHaveBeenCalledWith(
          expect.stringContaining('claimed seat 1'),
          expect.objectContaining({ roomCode: room.roomCode, playerId: bob.session.playerId })
        );
      }

      manager.handleDisconnect('sock_2');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('disconnected'),
        expect.objectContaining({ roomCode: room.roomCode })
      );
    });

    it('handles unexpected exceptions defensively and logs error without crashing', () => {
      const errorSpy = vi.spyOn(serverLogger, 'error');

      // Passing undefined as roomCode to joinRoom handled gracefully
      // @ts-expect-error Testing invalid runtime input
      const res = manager.joinRoom(null, 'Alice', 'sock_1');
      expect(res.success).toBe(false);

      // Out of bounds or malformed inputs to claimSeat handled gracefully
      // @ts-expect-error Testing invalid runtime input
      const claimRes = manager.claimSeat(null, null, null);
      expect(claimRes.success).toBe(false);

      // Unexpected exception thrown inside try block is caught, logged, and does not crash
      // @ts-expect-error Access private member for fault injection test
      vi.spyOn(manager.rooms, 'get').mockImplementationOnce(() => {
        throw new Error('Unexpected memory fault');
      });

      const faultRes = manager.joinRoom('ABCD', 'Alice', 'sock_1');
      expect(faultRes.success).toBe(false);
      if (!faultRes.success) {
        expect(faultRes.error).toBe('Internal error joining room');
      }
      expect(errorSpy).toHaveBeenCalledWith(
        'Error joining room',
        expect.objectContaining({ roomCode: 'ABCD' })
      );
    });
  });

  describe('Security & Lifecycle Garbage Collection', () => {
    it('sanitizes player names, removes control characters, and enforces length limits', () => {
      // 50-character name should be truncated to 24
      const longName = 'A'.repeat(50);
      const { room } = manager.createRoom(longName, 4, 'sock_1');
      expect(room.seats[0].playerName).toHaveLength(24);
      expect(room.seats[0].playerName).toBe('A'.repeat(24));

      // Control characters stripped
      const controlCharName = 'Bob\x00\x1F\x7FActor';
      const join = manager.joinRoom(room.roomCode, controlCharName, 'sock_2');
      expect(join.success).toBe(true);
      if (join.success) {
        expect(join.session.playerName).toBe('BobActor');
      }

      // Empty or whitespace falls back to default
      const { room: emptyRoom } = manager.createRoom('   ', 4, 'sock_3');
      expect(emptyRoom.seats[0].playerName).toBe('Host');
    });

    it('cleans up stale rooms that have been abandoned past maxIdleMs', () => {
      const { room: activeRoom } = manager.createRoom('Alice', 4, 'sock_1');
      const { room: staleRoom } = manager.createRoom('Bob', 4, 'sock_2');

      // Disconnect Bob so staleRoom is abandoned
      manager.handleDisconnect('sock_2');

      // Simulate stale idle time
      staleRoom.lastActivityAt = Date.now() - 20 * 60 * 1000; // 20 mins ago
      activeRoom.lastActivityAt = Date.now(); // active now

      const cleaned = manager.cleanupStaleRooms(15 * 60 * 1000); // 15 min threshold
      expect(cleaned).toContain(staleRoom.roomCode);
      expect(cleaned).not.toContain(activeRoom.roomCode);

      expect(manager.getRoom(staleRoom.roomCode)).toBeUndefined();
      expect(manager.getRoom(activeRoom.roomCode)).toBeDefined();
    });

    it('cleans up completed games (GAME_OVER) after 5 minutes of inactivity', () => {
      const { room } = manager.createRoom('Alice', 4, 'sock_1');
      room.status = 'GAME_OVER';
      room.lastActivityAt = Date.now() - 6 * 60 * 1000; // 6 mins ago

      const cleaned = manager.cleanupStaleRooms();
      expect(cleaned).toContain(room.roomCode);
      expect(manager.getRoom(room.roomCode)).toBeUndefined();
    });
  });

  describe('Lobby Host Migration & Room Capacity', () => {
    it('automatically migrates host to next connected seated player after timeout in lobby', () => {
      const { room, session: hostSession } = manager.createRoom('HostAlice', 4, 'sock_host');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_bob');
      expect(bob.success).toBe(true);
      if (!bob.success) return;
      manager.claimSeat(room.roomCode, bob.session.playerId, 1);

      // Disconnect host
      manager.handleDisconnect('sock_host');
      expect(room.hostDisconnectedAt).toBeDefined();

      // Check migration before 30s threshold -> should not migrate yet
      const noMigrate = manager.checkLobbyHostMigration(30000);
      expect(noMigrate).toHaveLength(0);
      expect(room.hostPlayerId).toBe(hostSession.playerId);

      // Simulate 35 seconds elapsed since disconnect
      room.hostDisconnectedAt = Date.now() - 35000;
      const migrated = manager.checkLobbyHostMigration(30000);

      expect(migrated).toHaveLength(1);
      expect(migrated[0].newHostId).toBe(bob.session.playerId);
      expect(room.hostPlayerId).toBe(bob.session.playerId);
      expect(room.seats[1].isHost).toBe(true);
      expect(room.seats[0].isHost).toBe(false);
    });

    it('does not migrate host if current host is still connected', () => {
      const { room } = manager.createRoom('HostAlice', 4, 'sock_host');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_bob');
      expect(bob.success).toBe(true);

      const migrated = manager.checkLobbyHostMigration(1000);
      expect(migrated).toHaveLength(0);
    });

    it('allows a connected player to claim host role if current host is disconnected', () => {
      const { room } = manager.createRoom('HostAlice', 4, 'sock_host');
      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_bob');
      expect(bob.success).toBe(true);
      if (!bob.success) return;

      // Bob tries to claim host while Alice is still connected -> rejected
      const failClaim = manager.claimHost(room.roomCode, bob.session.playerId);
      expect(failClaim.success).toBe(false);
      expect(failClaim.error).toBe('Current host is still connected');

      // Alice disconnects
      manager.handleDisconnect('sock_host');

      // Bob claims host -> succeeds
      const claimResult = manager.claimHost(room.roomCode, bob.session.playerId);
      expect(claimResult.success).toBe(true);
      expect(room.hostPlayerId).toBe(bob.session.playerId);

      // Bob claiming again is idempotent
      const claimAgain = manager.claimHost(room.roomCode, bob.session.playerId);
      expect(claimAgain.success).toBe(true);
    });

    it('migrates host to the clockwise next seated player around table relative to host seat', () => {
      const { room } = manager.createRoom('HostAlice', 4, 'sock_host');
      // Alice moves to seat 2
      manager.claimSeat(room.roomCode, room.hostPlayerId, 2);

      const bob = manager.joinRoom(room.roomCode, 'Bob', 'sock_bob');
      if (bob.success) manager.claimSeat(room.roomCode, bob.session.playerId, 0);

      const charlie = manager.joinRoom(room.roomCode, 'Charlie', 'sock_charlie');
      if (charlie.success) manager.claimSeat(room.roomCode, charlie.session.playerId, 3);

      // Alice disconnects from seat 2
      manager.handleDisconnect('sock_host');
      room.hostDisconnectedAt = Date.now() - 35000;

      // Clockwise from seat 2 is seat 3 (Charlie), NOT seat 0 (Bob)
      const migrated = manager.checkLobbyHostMigration(30000);
      expect(migrated).toHaveLength(1);
      if (charlie.success) {
        expect(migrated[0].newHostId).toBe(charlie.session.playerId);
        expect(room.hostPlayerId).toBe(charlie.session.playerId);
        expect(room.seats[3].isHost).toBe(true);
        expect(room.seats[0].isHost).toBe(false);
      }
    });

    it('prioritizes connected seated players over unseated spectators when host leaves', () => {
      const { room, session: hostSession } = manager.createRoom('HostAlice', 4, 'sock_host');
      const spectator = manager.joinRoom(room.roomCode, 'Spectator', 'sock_spec');
      const seatedGuest = manager.joinRoom(room.roomCode, 'SeatedBob', 'sock_seated');

      expect(spectator.success).toBe(true);
      expect(seatedGuest.success).toBe(true);
      if (seatedGuest.success) {
        manager.claimSeat(room.roomCode, seatedGuest.session.playerId, 1);
      }

      // Host leaves
      manager.leaveRoom(room.roomCode, hostSession.playerId);

      // SeatedBob should become host, NOT the unseated spectator
      if (seatedGuest.success) {
        expect(room.hostPlayerId).toBe(seatedGuest.session.playerId);
        expect(room.seats[1].isHost).toBe(true);
      }
    });

    it('rejects new players with ROOM_FULL code when maxRoomSessions capacity is reached', () => {
      manager.maxRoomSessions = 2; // Host + 1 guest
      const { room } = manager.createRoom('HostAlice', 4, 'sock_host');

      const guest1 = manager.joinRoom(room.roomCode, 'Guest1', 'sock_g1');
      expect(guest1.success).toBe(true);

      const guest2 = manager.joinRoom(room.roomCode, 'Guest2', 'sock_g2');
      expect(guest2.success).toBe(false);
      if (!guest2.success) {
        expect(guest2.code).toBe('ROOM_FULL');
        expect(guest2.error).toBe('Room is full');
      }
    });
  });
});
