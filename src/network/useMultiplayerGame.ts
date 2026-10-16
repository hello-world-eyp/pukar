import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SocketClient } from './socket-client';
import { LobbySeat, ServerMessage } from '../../server/types';
import { GameAction, SanitizedGameState } from '../engine/types';
import {
  saveSessionCredentials,
  getSessionCredentials,
  clearSessionCredentials,
  getStoredPlayerName,
  saveStoredPlayerName,
} from './session-storage';
import { ConnectionStatus, UseMultiplayerGameReturn, StoredSession } from './types';

export interface UseMultiplayerGameOptions {
  client?: SocketClient;
  url?: string;
  autoConnect?: boolean;
}

/**
 * Synchronizes browser URL query parameters (?room=ABCD) using window.history.replaceState.
 * Adds or updates ?room=ABCD when inside a room; clears the param when leaving or disconnecting.
 */
export function syncRoomUrl(roomCode: string | null): void {
  try {
    if (typeof window === 'undefined' || !window.history?.replaceState || !window.location) {
      return;
    }
    const href = window.location.href || 'http://localhost/';
    const url = new URL(href);
    if (roomCode) {
      const clean = roomCode.trim().toUpperCase();
      if (url.searchParams.get('room') !== clean) {
        url.searchParams.set('room', clean);
        window.history.replaceState(null, '', url.toString());
      }
    } else {
      if (url.searchParams.has('room')) {
        url.searchParams.delete('room');
        const newSearch = url.searchParams.toString();
        const newUrl = `${url.pathname}${newSearch ? `?${newSearch}` : ''}${url.hash}`;
        window.history.replaceState(null, '', newUrl);
      }
    }
  } catch {
    // Defensive guard against restrictive environments
  }
}

/**
 * Retrieves valid stored session credentials for the current browsing context.
 * If the current URL has a query parameter (?room=XXXX) that contradicts
 * the stored session's roomCode, the stale session is discarded so the user
 * is not incorrectly rejoined to an old room instead of the invited room.
 */
export function getContextualSessionCredentials(): StoredSession | null {
  const stored = getSessionCredentials();
  if (!stored) return null;

  try {
    if (typeof window !== 'undefined' && window.location?.search) {
      const match = window.location.search.match(/[?&]room=([a-zA-Z0-9]{4})/i);
      if (match) {
        const urlRoom = match[1].toUpperCase();
        if (stored.roomCode && stored.roomCode.toUpperCase() !== urlRoom) {
          clearSessionCredentials();
          return null;
        }
      }
    }
  } catch {
    // Ignore URL parsing errors
  }

  return stored;
}

/**
 * Authoritative React hook managing real-time multiplayer lifecycle, room membership,
 * seating synchronization, game actions, and session resilience.
 */
export function useMultiplayerGame(options?: UseMultiplayerGameOptions): UseMultiplayerGameReturn {
  const initialSession = getContextualSessionCredentials();
  const clientRef = useRef<SocketClient | null>(null);
  const myPlayerIdRef = useRef<string | null>(initialSession?.playerId ?? null);
  const roomCodeRef = useRef<string | null>(initialSession?.roomCode ?? null);
  const myPlayerNameRef = useRef<string | null>(initialSession?.playerName || getStoredPlayerName() || null);
  const prevStatusRef = useRef<ConnectionStatus>('DISCONNECTED');

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [roomCode, setRoomCode] = useState<string | null>(initialSession?.roomCode ?? null);
  const [isHost, setIsHost] = useState(false);
  const [lobbySeats, setLobbySeats] = useState<LobbySeat[]>([]);
  const [gameState, setGameState] = useState<SanitizedGameState | null>(null);
  const [mySeatIndex, setMySeatIndex] = useState<number | null>(initialSession?.seatIndex ?? null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(initialSession?.playerId ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInGame, setIsInGame] = useState(false);

  useEffect(() => {
    const isExternalClient = !!options?.client;
    const client = options?.client || new SocketClient(options?.url);
    clientRef.current = client;

    const unsubStatus = client.onStatus((status) => {
      const prevStatus = prevStatusRef.current;
      prevStatusRef.current = status;
      setConnectionStatus(status);

      // Auto-reconnection: when socket transitions to CONNECTED, auto-rejoin with stored sessionToken
      if (status === 'CONNECTED' && prevStatus !== 'CONNECTED') {
        const stored = getContextualSessionCredentials();
        if (stored?.roomCode && stored?.sessionToken) {
          const outbox = client.getOutboxQueue();
          const hasPendingRoomEntry = outbox.some(
            (m) => m.type === 'JOIN_ROOM' || m.type === 'CREATE_ROOM'
          );
          if (!hasPendingRoomEntry) {
            client.send({
              type: 'JOIN_ROOM',
              roomCode: stored.roomCode,
              playerName: stored.playerName || myPlayerNameRef.current || getStoredPlayerName() || 'Player',
              sessionToken: stored.sessionToken,
            });
          }
        }
      }
    });

    const unsubMessage = client.onMessage((msg: ServerMessage) => {
      try {
        switch (msg.type) {
          case 'ROOM_JOINED': {
            setRoomCode(msg.roomCode);
            roomCodeRef.current = msg.roomCode;
            setIsHost(msg.isHost);
            setMyPlayerId(msg.playerId);
            myPlayerIdRef.current = msg.playerId;
            setMySeatIndex(msg.seatIndex);
            syncRoomUrl(msg.roomCode);

            const activeName = myPlayerNameRef.current || getStoredPlayerName() || undefined;
            saveSessionCredentials({
              roomCode: msg.roomCode,
              playerId: msg.playerId,
              sessionToken: msg.sessionToken,
              seatIndex: msg.seatIndex,
              playerName: activeName,
            });
            break;
          }

          case 'LOBBY_UPDATE': {
            setRoomCode(msg.roomCode);
            roomCodeRef.current = msg.roomCode;
            setLobbySeats(msg.seats);
            const currentPid = myPlayerIdRef.current;
            if (currentPid) {
              setIsHost(msg.hostPlayerId === currentPid);
              const foundSeat = msg.seats.find(
                (s) => s.playerId !== null && s.playerId === currentPid
              );
              const updatedSeatIndex = foundSeat ? foundSeat.seatIndex : null;
              setMySeatIndex(updatedSeatIndex);

              // Keep persisted credentials synchronized with active seat assignment
              const existing = getSessionCredentials();
              const activeRoom = roomCodeRef.current || msg.roomCode;
              if (
                existing &&
                existing.roomCode === activeRoom &&
                existing.seatIndex !== updatedSeatIndex
              ) {
                saveSessionCredentials({
                  ...existing,
                  seatIndex: updatedSeatIndex,
                });
              }
            }
            break;
          }

          case 'GAME_STARTED': {
            setGameState(msg.state);
            setMySeatIndex(msg.mySeatIndex);
            setMyPlayerId(msg.myPlayerId);
            myPlayerIdRef.current = msg.myPlayerId;
            setIsInGame(true);

            const activeRoom = roomCodeRef.current;
            const existing = getSessionCredentials();
            if (existing && activeRoom && existing.roomCode === activeRoom) {
              saveSessionCredentials({
                ...existing,
                seatIndex: msg.mySeatIndex,
              });
            }
            break;
          }

          case 'STATE_UPDATE': {
            setGameState(msg.state);
            setIsInGame(true);
            if (msg.lastActionError) {
              setErrorMessage(msg.lastActionError);
            }

            // Synthesize seats if reconnecting mid-game and lobbySeats is empty
            if (msg.state.players && msg.state.players.length > 0) {
              setLobbySeats((prev) => {
                if (prev.length > 0) return prev;
                return msg.state.players.map((p, idx) => ({
                  seatIndex: idx,
                  team: p.team,
                  playerId: p.id,
                  playerName: p.name,
                  isConnected: true,
                  isHost: false,
                }));
              });
            }
            break;
          }

          case 'ACTION_REJECTED': {
            setErrorMessage(msg.error);
            break;
          }

          case 'ERROR': {
            setErrorMessage(msg.message);
            // Clear stale stored session and URL if server rejected room or token
            if (
              msg.code === 'JOIN_FAILED' ||
              msg.code === 'ROOM_NOT_FOUND' ||
              msg.code === 'NOT_IN_ROOM' ||
              msg.code === 'ROOM_FULL'
            ) {
              clearSessionCredentials();
              syncRoomUrl(null);
              setRoomCode(null);
              roomCodeRef.current = null;
              setIsHost(false);
              setLobbySeats([]);
              setGameState(null);
              setIsInGame(false);
              setMySeatIndex(null);
              setMyPlayerId(null);
              myPlayerIdRef.current = null;
            }
            break;
          }

          case 'PLAYER_CONNECTION_CHANGED': {
            setLobbySeats((prev) =>
              prev.map((s) =>
                s.seatIndex === msg.seatIndex ? { ...s, isConnected: msg.isConnected } : s
              )
            );
            break;
          }
        }
      } catch (err) {
        console.error('[useMultiplayerGame] Error processing server frame:', err);
      }
    });


    if (options?.autoConnect !== false && !client.isConnected()) {
      client.connect();
    }

    return () => {
      unsubStatus();
      unsubMessage();
      if (!isExternalClient) {
        client.close();
      }
    };
  }, [options?.client, options?.url, options?.autoConnect]);

  const createRoom = useCallback((playerName: string, playerCount: 4 | 6) => {
    setErrorMessage(null);
    myPlayerNameRef.current = playerName.trim();
    saveStoredPlayerName(playerName);
    clientRef.current?.clearOutbox();
    clientRef.current?.send({
      type: 'CREATE_ROOM',
      playerName,
      playerCount,
    });
  }, []);

  const joinRoom = useCallback((roomCodeInput: string, playerName: string) => {
    setErrorMessage(null);
    if (!roomCodeInput || typeof roomCodeInput !== 'string' || !roomCodeInput.trim()) {
      setErrorMessage('Room code is required');
      return;
    }
    const cleanCode = roomCodeInput.trim().toUpperCase();
    myPlayerNameRef.current = playerName.trim();
    saveStoredPlayerName(playerName);
    const existing = getSessionCredentials();
    const sessionToken = existing?.roomCode === cleanCode ? existing.sessionToken : undefined;

    clientRef.current?.send({
      type: 'JOIN_ROOM',
      roomCode: cleanCode,
      playerName,
      sessionToken,
    });
  }, []);

  const selectSeat = useCallback((seatIndex: number) => {
    setErrorMessage(null);
    clientRef.current?.send({
      type: 'SELECT_SEAT',
      seatIndex,
    });
  }, []);

  const startGame = useCallback(() => {
    setErrorMessage(null);
    clientRef.current?.send({
      type: 'START_GAME',
    });
  }, []);

  const dispatchAction = useCallback((action: GameAction) => {
    setErrorMessage(null);
    clientRef.current?.send({
      type: 'GAME_ACTION',
      action,
    });
  }, []);

  const kickPlayer = useCallback((seatIndex: number) => {
    setErrorMessage(null);
    clientRef.current?.send({
      type: 'KICK_PLAYER',
      seatIndex,
    });
  }, []);

  const leaveRoom = useCallback(() => {
    clearSessionCredentials();
    syncRoomUrl(null);
    clientRef.current?.clearOutbox();
    clientRef.current?.send({ type: 'LEAVE_ROOM' });

    setRoomCode(null);
    roomCodeRef.current = null;
    setIsHost(false);
    setLobbySeats([]);
    setGameState(null);
    setIsInGame(false);
    setMySeatIndex(null);
    setMyPlayerId(null);
    myPlayerIdRef.current = null;
    setErrorMessage(null);
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const claimHost = useCallback(() => {
    setErrorMessage(null);
    clientRef.current?.send({
      type: 'CLAIM_HOST',
    });
  }, []);

  const isInLobby = roomCode !== null && !isInGame;

  return useMemo(
    () => ({
      connectionStatus,
      roomCode,
      isHost,
      isInLobby,
      isInGame,
      lobbySeats,
      gameState,
      mySeatIndex,
      myPlayerId,
      errorMessage,
      createRoom,
      joinRoom,
      selectSeat,
      startGame,
      dispatchAction,
      kickPlayer,
      leaveRoom,
      clearError,
      claimHost,
    }),
    [
      connectionStatus,
      roomCode,
      isHost,
      isInLobby,
      isInGame,
      lobbySeats,
      gameState,
      mySeatIndex,
      myPlayerId,
      errorMessage,
      createRoom,
      joinRoom,
      selectSeat,
      startGame,
      dispatchAction,
      kickPlayer,
      leaveRoom,
      clearError,
      claimHost,
    ]
  );
}

