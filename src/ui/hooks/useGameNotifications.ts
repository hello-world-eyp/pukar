import { useState, useEffect, useRef, useCallback } from 'react';
import { UseMultiplayerGameReturn } from '../../network/types';
import { SanitizedGameState } from '../../engine/types';
import { SoundEffect } from '../sound';

export interface PukarEventData {
  team: 'A' | 'B';
  playerName: string;
  points: number;
  playerIndex?: number;
  playerId?: string;
}

export interface JokerPickupData {
  playerName: string;
}

export interface UseGameNotificationsProps {
  initialPukarBanner?: PukarEventData | null;
  initialPukarSlamEvent?: PukarEventData | null;
  initialJokerPickupBanner?: JokerPickupData | null;
  initialExhaustNotification?: string | null;
  appMode: 'LOCAL' | 'MULTIPLAYER';
  multiplayerHook: UseMultiplayerGameReturn;
  triggerSound: (effect: SoundEffect) => void;
}

export function useGameNotifications({
  initialPukarBanner,
  initialPukarSlamEvent,
  initialJokerPickupBanner,
  initialExhaustNotification,
  appMode,
  multiplayerHook,
  triggerSound,
}: UseGameNotificationsProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [disconnectToast, setDisconnectToast] = useState<string | null>(null);
  const [pukarBanner, setPukarBanner] = useState<PukarEventData | null>(initialPukarBanner ?? null);
  const [pukarSlamEvent, setPukarSlamEvent] = useState<PukarEventData | null>(
    initialPukarSlamEvent ?? initialPukarBanner ?? null
  );
  const [isTableRippling, setIsTableRippling] = useState(false);
  const [exhaustNotification, setExhaustNotification] = useState<string | null>(
    initialExhaustNotification ?? null
  );
  const [jokerPickupBanner, setJokerPickupBanner] = useState<JokerPickupData | null>(
    initialJokerPickupBanner ?? null
  );

  // Auto-dismiss error message after 4.5 seconds
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => {
      setErrorMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  // Sync multiplayer hook errors into UI error banner
  useEffect(() => {
    if (appMode === 'MULTIPLAYER' && multiplayerHook.errorMessage) {
      setErrorMessage(multiplayerHook.errorMessage);
    }
  }, [appMode, multiplayerHook.errorMessage]);

  // Auto-dismiss disconnect notification after 5 seconds
  useEffect(() => {
    if (!disconnectToast) return;
    const timer = setTimeout(() => {
      setDisconnectToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [disconnectToast]);

  // Auto-dismiss Pukar celebration banner after 10 seconds
  useEffect(() => {
    if (!pukarBanner) return;
    const timer = setTimeout(() => {
      setPukarBanner(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [pukarBanner]);

  // Auto-dismiss Joker pickup banner after 10 seconds
  useEffect(() => {
    if (!jokerPickupBanner) return;
    const timer = setTimeout(() => {
      setJokerPickupBanner(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [jokerPickupBanner]);

  // Auto-dismiss deck exhaustion alert after 10 seconds
  useEffect(() => {
    if (!exhaustNotification) return;
    const timer = setTimeout(() => {
      setExhaustNotification(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [exhaustNotification]);

  // Track player disconnections in multiplayer mode
  const prevSeatsConnRef = useRef<Map<number, boolean>>(new Map());
  useEffect(() => {
    if (appMode !== 'MULTIPLAYER' || !multiplayerHook.isInGame) {
      prevSeatsConnRef.current.clear();
      return;
    }

    multiplayerHook.lobbySeats.forEach((seat) => {
      if (seat.seatIndex === multiplayerHook.mySeatIndex) return;

      const prevConn = prevSeatsConnRef.current.get(seat.seatIndex);
      const displayName = seat.playerName?.trim() || `Player ${seat.seatIndex + 1}`;
      if (prevConn === true && !seat.isConnected) {
        setDisconnectToast(
          `${displayName} (${seat.team ? `Team ${seat.team}` : `Seat ${seat.seatIndex + 1}`}) disconnected. Waiting for reconnect...`
        );
      } else if (prevConn === false && seat.isConnected) {
        setDisconnectToast(`${displayName} reconnected to the game.`);
      }
      prevSeatsConnRef.current.set(seat.seatIndex, seat.isConnected);
    });
  }, [appMode, multiplayerHook.isInGame, multiplayerHook.lobbySeats, multiplayerHook.mySeatIndex]);

  // Multiplayer sound & celebration state tracker
  const prevMultiplayerStateRef = useRef<SanitizedGameState | null>(null);
  const isMultiplayerActive =
    appMode === 'MULTIPLAYER' && multiplayerHook.isInGame && !!multiplayerHook.gameState;

  useEffect(() => {
    if (!isMultiplayerActive || !multiplayerHook.gameState) return;
    const current = multiplayerHook.gameState;
    const prev = prevMultiplayerStateRef.current;
    prevMultiplayerStateRef.current = current;

    if (!prev) return;

    // Detect Pukar claim (+50 pts) in multiplayer
    const prevPukarsA = prev.pukarsClaimed?.A ?? 0;
    const prevPukarsB = prev.pukarsClaimed?.B ?? 0;
    const nextPukarsA = current.pukarsClaimed?.A ?? 0;
    const nextPukarsB = current.pukarsClaimed?.B ?? 0;
    if (nextPukarsA > prevPukarsA || nextPukarsB > prevPukarsB) {
      const claimingTeam: 'A' | 'B' = nextPukarsA > prevPukarsA ? 'A' : 'B';
      const claimingPlayerIndex = prev.currentPlayerIndex;
      const actor = current.players[claimingPlayerIndex];
      const pukarInfo: PukarEventData = {
        team: claimingTeam,
        playerName: actor?.name ?? `Player ${claimingPlayerIndex + 1}`,
        points: 50,
        playerIndex: claimingPlayerIndex,
        playerId: actor?.id,
      };
      setPukarBanner(pukarInfo);
      setPukarSlamEvent(pukarInfo);
      setIsTableRippling(true);
      setTimeout(() => setIsTableRippling(false), 1400);
      triggerSound('pukar');
    } else if (current.roundStatus === 'ROUND_OVER' && prev.roundStatus !== 'ROUND_OVER') {
      triggerSound('roundOver');
    } else if (current.lastPickedUpCard && !prev.lastPickedUpCard) {
      const actor = current.players[current.currentPlayerIndex];
      setJokerPickupBanner({
        playerName: actor?.name ?? `Player ${current.currentPlayerIndex + 1}`,
      });
      triggerSound('pukar');
    }
  }, [isMultiplayerActive, multiplayerHook.gameState, triggerSound]);

  const triggerPukarCelebration = useCallback((info: PukarEventData) => {
    setPukarBanner(info);
    setPukarSlamEvent(info);
    setIsTableRippling(true);
    setTimeout(() => setIsTableRippling(false), 1400);
  }, []);

  const clearAllNotifications = useCallback(() => {
    setPukarBanner(null);
    setPukarSlamEvent(null);
    setIsTableRippling(false);
    setExhaustNotification(null);
    setJokerPickupBanner(null);
  }, []);

  return {
    errorMessage,
    setErrorMessage,
    disconnectToast,
    setDisconnectToast,
    pukarBanner,
    setPukarBanner,
    pukarSlamEvent,
    setPukarSlamEvent,
    isTableRippling,
    setIsTableRippling,
    exhaustNotification,
    setExhaustNotification,
    jokerPickupBanner,
    setJokerPickupBanner,
    triggerPukarCelebration,
    clearAllNotifications,
  };
}
