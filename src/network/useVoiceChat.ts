import { useState, useRef, useEffect, useCallback } from 'react';
import { ClientMessage, ServerMessage } from '../../server/types';

export interface PlayerVoiceState {
  isMuted: boolean;
  isHardMuted: boolean;
  isSpeaking?: boolean;
}

export interface UseVoiceChatOptions {
  myPlayerId: string | null;
  isHost: boolean;
  sendClientMessage?: (msg: ClientMessage) => void;
  onAdminToast?: (msg: string) => void;
}

export interface UseVoiceChatReturn {
  isVoiceSupported: boolean;
  isVoiceActive: boolean;
  isMuted: boolean;
  isHardMuted: boolean;
  toggleMic: () => void;
  playerVoiceStates: Record<string, PlayerVoiceState>;
  adminMutePlayer: (targetPlayerId: string, muteType: 'TEMP' | 'HARD' | 'UNMUTE') => void;
  handleServerMessage: (msg: ServerMessage) => void;
}

// Google Free Public STUN servers
export const GOOGLE_STUN_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useVoiceChat({
  myPlayerId: _myPlayerId,
  isHost,
  sendClientMessage,
  onAdminToast,
}: UseVoiceChatOptions): UseVoiceChatReturn {
  const isSupported =
    typeof window !== 'undefined' &&
    typeof RTCPeerConnection !== 'undefined' &&
    Boolean(navigator?.mediaDevices?.getUserMedia);

  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isHardMuted, setIsHardMuted] = useState<boolean>(false);
  const [playerVoiceStates, setPlayerVoiceStates] = useState<Record<string, PlayerVoiceState>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Stop all local audio tracks and peer connections cleanly
  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {
        // ignore close errors
      }
    });
    peerConnectionsRef.current.clear();

    audioElementsRef.current.forEach((el) => {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch {
        // ignore element removal error
      }
    });
    audioElementsRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Handle incoming server messages regarding voice
  const handleServerMessage = useCallback(
    async (msg: ServerMessage) => {
      switch (msg.type) {
        case 'VOICE_FORCE_MUTED': {
          setIsMuted(true);
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((track) => {
              track.enabled = false;
            });
          }

          if (msg.muteType === 'HARD') {
            setIsHardMuted(true);
            onAdminToast?.('The room host has locked your microphone.');
          } else {
            onAdminToast?.('The room host muted your microphone. You can unmute when ready.');
          }

          sendClientMessage?.({
            type: 'VOICE_STATE_UPDATE',
            isMuted: true,
            isSpeaking: false,
          });
          break;
        }

        case 'VOICE_FORCE_UNMUTED': {
          setIsHardMuted(false);
          onAdminToast?.('The room host unlocked your microphone.');
          break;
        }

        case 'VOICE_STATE_CHANGED': {
          setPlayerVoiceStates((prev) => ({
            ...prev,
            [msg.playerId]: {
              isMuted: msg.isMuted,
              isHardMuted: msg.isHardMuted,
              isSpeaking: msg.isSpeaking,
            },
          }));
          break;
        }

        case 'VOICE_SIGNAL': {
          if (!isSupported) return;
          const { fromPlayerId, signal } = msg;

          try {
            let pc = peerConnectionsRef.current.get(fromPlayerId);
            if (!pc) {
              pc = new RTCPeerConnection(GOOGLE_STUN_CONFIG);
              peerConnectionsRef.current.set(fromPlayerId, pc);

              // Attach local stream tracks if available
              if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                  pc?.addTrack(track, localStreamRef.current!);
                });
              }

              // Send ICE candidates to peer
              pc.onicecandidate = (event) => {
                if (event.candidate && sendClientMessage) {
                  sendClientMessage({
                    type: 'VOICE_SIGNAL',
                    targetPlayerId: fromPlayerId,
                    signal: { candidate: event.candidate },
                  });
                }
              };

              // Handle remote audio stream arrival
              pc.ontrack = (event) => {
                if (event.streams && event.streams[0]) {
                  let audioEl = audioElementsRef.current.get(fromPlayerId);
                  if (!audioEl && typeof document !== 'undefined') {
                    audioEl = document.createElement('audio');
                    audioEl.autoplay = true;
                    audioElementsRef.current.set(fromPlayerId, audioEl);
                  }
                  if (audioEl) {
                    audioEl.srcObject = event.streams[0];
                    audioEl.play().catch(() => {
                      // Autoplay policy fallback
                    });
                  }
                }
              };
            }

            if (signal.sdp) {
              await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
              if (signal.sdp.type === 'offer') {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendClientMessage?.({
                  type: 'VOICE_SIGNAL',
                  targetPlayerId: fromPlayerId,
                  signal: { sdp: pc.localDescription },
                });
              }
            } else if (signal.candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
          } catch (err) {
            console.error('Error handling VOICE_SIGNAL:', err);
          }
          break;
        }

        default:
          break;
      }
    },
    [isSupported, onAdminToast, sendClientMessage]
  );

  // Toggle local mic state
  const toggleMic = useCallback(async () => {
    if (isHardMuted) {
      onAdminToast?.('Your microphone is locked by the room host.');
      return;
    }

    if (!isVoiceActive) {
      // First time activating voice: acquire user media
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Microphone access not supported in this browser');
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setIsVoiceActive(true);
        setIsMuted(false);

        // Notify server that player is unmuted
        sendClientMessage?.({
          type: 'VOICE_STATE_UPDATE',
          isMuted: false,
          isSpeaking: false,
        });
      } catch (err) {
        console.error('Error acquiring microphone:', err);
        onAdminToast?.('Could not access microphone. Please check your browser permissions.');
      }
      return;
    }

    // Toggle mute
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }

    sendClientMessage?.({
      type: 'VOICE_STATE_UPDATE',
      isMuted: nextMuted,
      isSpeaking: false,
    });
  }, [isHardMuted, isVoiceActive, isMuted, onAdminToast, sendClientMessage]);

  // Host action to mute / lock / unlock a player
  const adminMutePlayer = useCallback(
    (targetPlayerId: string, muteType: 'TEMP' | 'HARD' | 'UNMUTE') => {
      if (!isHost) {
        return;
      }
      sendClientMessage?.({
        type: 'ADMIN_MUTE_PLAYER',
        targetPlayerId,
        muteType,
      });
    },
    [isHost, sendClientMessage]
  );

  return {
    isVoiceSupported: isSupported,
    isVoiceActive,
    isMuted,
    isHardMuted,
    toggleMic,
    playerVoiceStates,
    adminMutePlayer,
    handleServerMessage,
  };
}
