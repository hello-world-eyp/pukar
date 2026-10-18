import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { useVoiceChat, GOOGLE_STUN_CONFIG } from '../../src/network/useVoiceChat';
import { ServerMessage } from '../../server/types';

function runHook<T>(hookFn: () => T) {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const oldH = internals?.H;

  const stateMap = new Map<number, any>();
  const stateSetters = new Map<number, (v: any) => void>();
  let stateIdx = 0;

  if (internals) {
    internals.H = {
      useState: (init: any) => {
        const idx = stateIdx++;
        if (!stateMap.has(idx)) {
          stateMap.set(idx, typeof init === 'function' ? init() : init);
        }
        const val = stateMap.get(idx);
        const setter = (updater: any) => {
          const nextVal = typeof updater === 'function' ? updater(stateMap.get(idx)) : updater;
          stateMap.set(idx, nextVal);
        };
        stateSetters.set(idx, setter);
        return [val, setter];
      },
      useEffect: () => {},
      useCallback: (fn: any) => fn,
      useMemo: (fn: any) => fn(),
      useRef: (init: any) => ({ current: init }),
    };
  }

  try {
    hookFn();
  } finally {
    if (internals && oldH) {
      internals.H = oldH;
    }
  }

  return {
    get current() {
      stateIdx = 0;
      if (internals) {
        internals.H = {
          useState: (_init: any) => {
            const idx = stateIdx++;
            const val = stateMap.get(idx);
            const setter = stateSetters.get(idx)!;
            return [val, setter];
          },
          useEffect: () => {},
          useCallback: (fn: any) => fn,
          useMemo: (fn: any) => fn(),
          useRef: (init: any) => ({ current: init }),
        };
      }
      try {
        return hookFn();
      } finally {
        if (internals && oldH) {
          internals.H = oldH;
        }
      }
    },
  };
}

describe('useVoiceChat Hook & WebRTC Signaling Logic', () => {
  it('exports Google STUN configuration with free public STUN servers', () => {
    expect(GOOGLE_STUN_CONFIG.iceServers).toBeDefined();
    const urls = GOOGLE_STUN_CONFIG.iceServers?.flatMap((s) => s.urls);
    expect(urls).toContain('stun:stun.l.google.com:19302');
    expect(urls).toContain('stun:stun1.l.google.com:19302');
  });

  it('initializes in muted and non-voice active state', () => {
    const hook = runHook(() =>
      useVoiceChat({
        myPlayerId: 'p-1',
        isHost: false,
      })
    );

    expect(hook.current.isVoiceActive).toBe(false);
    expect(hook.current.isMuted).toBe(true);
    expect(hook.current.isHardMuted).toBe(false);
    expect(hook.current.playerVoiceStates).toEqual({});
  });

  it('prevents hard-muted players from turning mic on and displays notification', async () => {
    const onAdminToast = vi.fn();
    const sendClientMessage = vi.fn();

    const hook = runHook(() =>
      useVoiceChat({
        myPlayerId: 'p-2',
        isHost: false,
        sendClientMessage,
        onAdminToast,
      })
    );

    // Simulate receiving VOICE_FORCE_MUTED with muteType: 'HARD'
    const hardMuteMsg: ServerMessage = {
      type: 'VOICE_FORCE_MUTED',
      muteType: 'HARD',
      message: 'The room host has locked your microphone.',
    };

    hook.current.handleServerMessage(hardMuteMsg);

    // Verify toast notification and hard mute state
    expect(onAdminToast).toHaveBeenCalledWith('The room host has locked your microphone.');
    expect(hook.current.isHardMuted).toBe(true);

    // Attempt to toggle mic while hard muted
    await hook.current.toggleMic();

    // Still blocked
    expect(onAdminToast).toHaveBeenCalledWith('Your microphone is locked by the room host.');
    expect(sendClientMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'VOICE_STATE_UPDATE', isMuted: false }));
  });

  it('unlocks hard-muted player when receiving VOICE_FORCE_UNMUTED', () => {
    const onAdminToast = vi.fn();

    const hook = runHook(() =>
      useVoiceChat({
        myPlayerId: 'p-2',
        isHost: false,
        onAdminToast,
      })
    );

    // Hard mute
    hook.current.handleServerMessage({
      type: 'VOICE_FORCE_MUTED',
      muteType: 'HARD',
      message: 'The room host has locked your microphone.',
    });
    expect(hook.current.isHardMuted).toBe(true);

    // Admin unlocks
    hook.current.handleServerMessage({
      type: 'VOICE_FORCE_UNMUTED',
      message: 'The room host unlocked your microphone.',
    });

    expect(hook.current.isHardMuted).toBe(false);
    expect(onAdminToast).toHaveBeenCalledWith('The room host unlocked your microphone.');
  });

  it('updates playerVoiceStates when receiving VOICE_STATE_CHANGED', () => {
    const hook = runHook(() =>
      useVoiceChat({
        myPlayerId: 'p-1',
        isHost: false,
      })
    );

    hook.current.handleServerMessage({
      type: 'VOICE_STATE_CHANGED',
      playerId: 'p-3',
      isMuted: false,
      isHardMuted: false,
      isSpeaking: true,
    });

    expect(hook.current.playerVoiceStates['p-3']).toEqual({
      isMuted: false,
      isHardMuted: false,
      isSpeaking: true,
    });
  });

  it('allows room host to dispatch ADMIN_MUTE_PLAYER messages', () => {
    const sendClientMessage = vi.fn();

    const hook = runHook(() =>
      useVoiceChat({
        myPlayerId: 'p-host',
        isHost: true,
        sendClientMessage,
      })
    );

    // 1. Temporary mute
    hook.current.adminMutePlayer('p-target', 'TEMP');
    expect(sendClientMessage).toHaveBeenCalledWith({
      type: 'ADMIN_MUTE_PLAYER',
      targetPlayerId: 'p-target',
      muteType: 'TEMP',
    });

    // 2. Hard mute / lock
    hook.current.adminMutePlayer('p-target', 'HARD');
    expect(sendClientMessage).toHaveBeenCalledWith({
      type: 'ADMIN_MUTE_PLAYER',
      targetPlayerId: 'p-target',
      muteType: 'HARD',
    });

    // 3. Unlock mic
    hook.current.adminMutePlayer('p-target', 'UNMUTE');
    expect(sendClientMessage).toHaveBeenCalledWith({
      type: 'ADMIN_MUTE_PLAYER',
      targetPlayerId: 'p-target',
      muteType: 'UNMUTE',
    });
  });

  it('disallows non-hosts from dispatching ADMIN_MUTE_PLAYER messages', () => {
    const sendClientMessage = vi.fn();

    const hook = runHook(() =>
      useVoiceChat({
        myPlayerId: 'p-guest',
        isHost: false,
        sendClientMessage,
      })
    );

    hook.current.adminMutePlayer('p-target', 'TEMP');
    expect(sendClientMessage).not.toHaveBeenCalled();

    hook.current.adminMutePlayer('p-target', 'HARD');
    expect(sendClientMessage).not.toHaveBeenCalled();
  });
});
