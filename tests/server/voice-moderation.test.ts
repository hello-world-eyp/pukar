import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { startServer, ServerInstance } from '../../server/server';
import { ServerMessage } from '../../server/types';

interface TestClient {
  ws: WebSocket;
  messages: ServerMessage[];
  waitForMessage: (
    predicate: (msg: ServerMessage) => boolean,
    timeoutMs?: number
  ) => Promise<ServerMessage>;
  close: () => Promise<void>;
}

function connectClient(port: number): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const messages: ServerMessage[] = [];
    const waiters: Array<{
      predicate: (msg: ServerMessage) => boolean;
      resolve: (msg: ServerMessage) => void;
      reject: (err: Error) => void;
      timer: NodeJS.Timeout;
    }> = [];

    ws.on('open', () => {
      resolve({
        ws,
        messages,
        waitForMessage: (predicate, timeoutMs = 4000) => {
          const existing = messages.find(predicate);
          if (existing) {
            return Promise.resolve(existing);
          }

          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              const idx = waiters.findIndex((w) => w.timer === timer);
              if (idx !== -1) {
                waiters.splice(idx, 1);
              }
              rej(
                new Error(
                  `Timeout (${timeoutMs}ms) waiting for message. Received ${messages.length} messages: ${JSON.stringify(
                    messages
                  )}`
                )
              );
            }, timeoutMs);

            waiters.push({ predicate, resolve: res, reject: rej, timer });
          });
        },
        close: () => {
          return new Promise<void>((resClose) => {
            if (ws.readyState === WebSocket.CLOSED) {
              resClose();
              return;
            }
            ws.on('close', () => resClose());
            ws.close();
          });
        },
      });
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as ServerMessage;
        messages.push(msg);

        for (let i = waiters.length - 1; i >= 0; i--) {
          const waiter = waiters[i];
          if (waiter.predicate(msg)) {
            clearTimeout(waiter.timer);
            waiters.splice(i, 1);
            waiter.resolve(msg);
          }
        }
      } catch (err) {
        // ignore parse error
      }
    });

    ws.on('error', (err) => {
      reject(err);
    });
  });
}

describe('Voice Chat Signaling & Admin Moderation Server Integration', () => {
  let serverInstance: ServerInstance;
  let port: number;

  beforeAll(async () => {
    // Port 0 picks an ephemeral available port
    serverInstance = await startServer(0);
    port = serverInstance.port;
  });

  afterAll(async () => {
    await serverInstance.close();
  });

  it('allows host to temporarily mute a player, allowing player to unmute themselves', async () => {
    const host = await connectClient(port);
    const guest = await connectClient(port);

    // 1. Host creates room
    host.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'HostAlice', playerCount: 4 }));
    const joinedHost = (await host.waitForMessage((m) => m.type === 'ROOM_JOINED')) as any;
    const roomCode = joinedHost.roomCode;

    // 2. Guest joins room
    guest.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'GuestBob' }));
    const joinedGuest = (await guest.waitForMessage((m) => m.type === 'ROOM_JOINED')) as any;
    const guestPlayerId = joinedGuest.playerId;

    // 3. Host temporarily mutes GuestBob
    host.ws.send(
      JSON.stringify({
        type: 'ADMIN_MUTE_PLAYER',
        targetPlayerId: guestPlayerId,
        muteType: 'TEMP',
      })
    );

    // Guest receives VOICE_FORCE_MUTED with muteType === 'TEMP'
    const guestForceMuted = (await guest.waitForMessage(
      (m) => m.type === 'VOICE_FORCE_MUTED' && (m as any).muteType === 'TEMP'
    )) as any;
    expect(guestForceMuted.muteType).toBe('TEMP');

    // Both receive broadcast of VOICE_STATE_CHANGED
    const stateChangeOnHost = (await host.waitForMessage(
      (m) => m.type === 'VOICE_STATE_CHANGED' && (m as any).playerId === guestPlayerId && (m as any).isMuted === true
    )) as any;
    expect(stateChangeOnHost.isHardMuted).toBe(false);

    // 4. Since mute was TEMP, guest can unmute themselves
    guest.ws.send(
      JSON.stringify({
        type: 'VOICE_STATE_UPDATE',
        isMuted: false,
      })
    );

    const guestUnmutedOnHost = (await host.waitForMessage(
      (m) => m.type === 'VOICE_STATE_CHANGED' && (m as any).playerId === guestPlayerId && (m as any).isMuted === false
    )) as any;
    expect(guestUnmutedOnHost.isMuted).toBe(false);

    await host.close();
    await guest.close();
  });

  it('allows host to hard-mute (lock) a player, blocking player from unmuting until host unlocks', async () => {
    const host = await connectClient(port);
    const guest = await connectClient(port);

    // 1. Host creates room
    host.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'HostAlice', playerCount: 4 }));
    const joinedHost = (await host.waitForMessage((m) => m.type === 'ROOM_JOINED')) as any;
    const roomCode = joinedHost.roomCode;

    // 2. Guest joins room
    guest.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'GuestBob' }));
    const joinedGuest = (await guest.waitForMessage((m) => m.type === 'ROOM_JOINED')) as any;
    const guestPlayerId = joinedGuest.playerId;

    // 3. Host hard-mutes GuestBob
    host.ws.send(
      JSON.stringify({
        type: 'ADMIN_MUTE_PLAYER',
        targetPlayerId: guestPlayerId,
        muteType: 'HARD',
      })
    );

    // Guest receives VOICE_FORCE_MUTED with muteType === 'HARD'
    const guestForceMuted = (await guest.waitForMessage(
      (m) => m.type === 'VOICE_FORCE_MUTED' && (m as any).muteType === 'HARD'
    )) as any;
    expect(guestForceMuted.muteType).toBe('HARD');

    // Room broadcast confirms isHardMuted === true
    const hostBroadcast = (await host.waitForMessage(
      (m) => m.type === 'VOICE_STATE_CHANGED' && (m as any).playerId === guestPlayerId && (m as any).isHardMuted === true
    )) as any;
    expect(hostBroadcast.isHardMuted).toBe(true);
    expect(hostBroadcast.isMuted).toBe(true);

    // 4. Guest tries to unmute themselves -> server enforces hard lock
    guest.ws.send(
      JSON.stringify({
        type: 'VOICE_STATE_UPDATE',
        isMuted: false,
      })
    );

    // The state remains isMuted: true, isHardMuted: true
    const enforcedMute = (await guest.waitForMessage(
      (m) => m.type === 'VOICE_STATE_CHANGED' && (m as any).playerId === guestPlayerId && (m as any).isHardMuted === true
    )) as any;
    expect(enforcedMute.isMuted).toBe(true);

    // 5. Host unlocks guest
    host.ws.send(
      JSON.stringify({
        type: 'ADMIN_MUTE_PLAYER',
        targetPlayerId: guestPlayerId,
        muteType: 'UNMUTE',
      })
    );

    // Guest receives VOICE_FORCE_UNMUTED
    const unlockedMsg = await guest.waitForMessage((m) => m.type === 'VOICE_FORCE_UNMUTED');
    expect(unlockedMsg.type).toBe('VOICE_FORCE_UNMUTED');

    // Now guest is unmuted and free to toggle mic
    const unlockedBroadcast = (await host.waitForMessage(
      (m) => m.type === 'VOICE_STATE_CHANGED' && (m as any).playerId === guestPlayerId && (m as any).isHardMuted === false
    )) as any;
    expect(unlockedBroadcast.isMuted).toBe(false);
    expect(unlockedBroadcast.isHardMuted).toBe(false);

    await host.close();
    await guest.close();
  });

  it('rejects non-host from moderating other players', async () => {
    const host = await connectClient(port);
    const guest1 = await connectClient(port);
    const guest2 = await connectClient(port);

    host.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'HostAlice', playerCount: 4 }));
    const joinedHost = (await host.waitForMessage((m) => m.type === 'ROOM_JOINED')) as any;
    const roomCode = joinedHost.roomCode;

    guest1.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'GuestBob' }));
    await guest1.waitForMessage((m) => m.type === 'ROOM_JOINED');

    guest2.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'GuestCharlie' }));
    const joinedGuest2 = (await guest2.waitForMessage((m) => m.type === 'ROOM_JOINED')) as any;

    // Non-host (guest1) tries to mute guest2
    guest1.ws.send(
      JSON.stringify({
        type: 'ADMIN_MUTE_PLAYER',
        targetPlayerId: joinedGuest2.playerId,
        muteType: 'HARD',
      })
    );

    const rejection = (await guest1.waitForMessage((m) => m.type === 'ACTION_REJECTED')) as any;
    expect(rejection.error).toContain('Only the room host can moderate voice chat');

    await host.close();
    await guest1.close();
    await guest2.close();
  });

  it('relays WebRTC VOICE_SIGNAL between players in the same room', async () => {
    const clientA = await connectClient(port);
    const clientB = await connectClient(port);

    clientA.ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'PlayerA', playerCount: 4 }));
    const joinedA = (await clientA.waitForMessage((m) => m.type === 'ROOM_JOINED')) as any;
    const roomCode = joinedA.roomCode;
    const playerAId = joinedA.playerId;

    clientB.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, playerName: 'PlayerB' }));
    const joinedB = (await clientB.waitForMessage((m) => m.type === 'ROOM_JOINED')) as any;
    const playerBId = joinedB.playerId;

    // Player A sends signaling data (e.g. SDP offer) to Player B
    const mockOffer = { type: 'offer', sdp: 'v=0...' };
    clientA.ws.send(
      JSON.stringify({
        type: 'VOICE_SIGNAL',
        targetPlayerId: playerBId,
        signal: mockOffer,
      })
    );

    const receivedSignal = (await clientB.waitForMessage((m) => m.type === 'VOICE_SIGNAL')) as any;
    expect(receivedSignal.fromPlayerId).toBe(playerAId);
    expect(receivedSignal.signal).toEqual(mockOffer);

    await clientA.close();
    await clientB.close();
  });
});
