import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SocketClient } from './socket-client';
import { LobbySeat, ServerMessage } from '../../server/types';
import { GameAction, SanitizedGameState } from '../engine/types';
import {
  saveSessionCredentials,
  getSessionCredentials,
  clearSessionCredentials,
} from './session-storage';
import { ConnectionStatus, UseMultiplayerGameReturn } from './types';

export interface UseMultiplayerGameOptions {
  client?: SocketClient;
  url?: string;
  autoConnect?: boolean;
}

/**
 * Authoritative React hook managing real-time multiplayer lifecycle, room membership,
 * seating synchronization, game actions, and session resilience.
 */
export function useMultiplayerGame(options?: UseMultiplayerGameOptions): UseMultiplayerGameReturn {
  const clientRef = useRef<SocketClient | null>(null);
  const myPlayerIdRef = useRef<string | null>(null);
  const roomCodeRef = useRef<string | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [lobbySeats, setLobbySeats] = useState<LobbySeat[]>([]);
  const [gameState, setGameState] = useState<SanitizedGameState | null>(null);
  const [mySeatIndex, setMySeatIndex] = useState<number | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInGame, setIsInGame] = useState(false);

  useEffect(() => {
    const isExternalClient = !!options?.client;
    const client = options?.client || new SocketClient(options?.url);
    clientRef.current = client;

    const unsubStatus = client.onStatus((status) => {
      setConnectionStatus(status);
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
            saveSessionCredentials({
              roomCode: msg.roomCode,
              playerId: msg.playerId,
              sessionToken: msg.sessionToken,
              seatIndex: msg.seatIndex,
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
            // Clear stale stored session if server rejected room or token
            if (
              msg.code === 'JOIN_FAILED' ||
              msg.code === 'ROOM_NOT_FOUND' ||
              msg.code === 'NOT_IN_ROOM'
            ) {
              clearSessionCredentials();
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
    ]
  );
}
