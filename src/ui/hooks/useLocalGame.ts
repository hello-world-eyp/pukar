import { useState, useCallback, useMemo } from 'react';
import {
  GameState,
  SanitizedGameState,
  GameAction,
  Meld,
  Card,
  isNaturalJoker,
} from '../../engine/types';
import { dealInitialState } from '../../engine/deck';
import { pukarReducer } from '../../engine/reducer';
import {
  getRunCandidateOptions,
  getAddToRunCandidateOptions,
} from '../../engine/meld-validator';
import { UseMultiplayerGameReturn } from '../../network/types';
import { SoundEffect } from '../sound';
import { PukarEventData, JokerPickupData } from './useGameNotifications';
import { JokerPromptData } from './useGameModals';

export interface UseLocalGameProps {
  initialState?: GameState;
  appMode: 'LOCAL' | 'MULTIPLAYER';
  multiplayerHook: UseMultiplayerGameReturn;
  triggerSound: (effect: SoundEffect) => void;
  setErrorMessage: (msg: string | null) => void;
  triggerPukarCelebration: (info: PukarEventData) => void;
  setExhaustNotification: (msg: string | null) => void;
  setJokerPickupBanner: (info: JokerPickupData | null) => void;
  clearAllNotifications: () => void;
  setJokerPromptData: (data: JokerPromptData | null) => void;
}

export function useLocalGame({
  initialState,
  appMode,
  multiplayerHook,
  triggerSound,
  setErrorMessage,
  triggerPukarCelebration,
  setExhaustNotification,
  setJokerPickupBanner,
  clearAllNotifications,
  setJokerPromptData,
}: UseLocalGameProps) {
  // Core Local Game State
  const [gameState, setGameState] = useState<GameState>(() => initialState ?? dealInitialState(4));

  // Selection state
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectedMeldId, setSelectedMeldId] = useState<string | null>(null);

  // Perspective / Hot-seat view state (null = follow active turn) for LOCAL mode
  const [viewedPlayerIndex, setViewedPlayerIndex] = useState<number | null>(null);

  // Active vs Viewed Player Resolution & State Source
  const isMultiplayerActive =
    appMode === 'MULTIPLAYER' && multiplayerHook.isInGame && !!multiplayerHook.gameState;

  const activeGameState: GameState | SanitizedGameState = isMultiplayerActive
    ? multiplayerHook.gameState!
    : gameState;

  const activeTurnIndex = activeGameState.currentPlayerIndex;
  const activePlayer = activeGameState.players[activeTurnIndex];

  // In multiplayer: perspective is strictly locked to mySeatIndex
  // In local mode: perspective can switch via hotseat controls
  const currentViewIndex = isMultiplayerActive
    ? (multiplayerHook.mySeatIndex ?? 0)
    : (viewedPlayerIndex ?? activeTurnIndex);

  const viewingPlayer =
    isMultiplayerActive && multiplayerHook.mySeatIndex === null
      ? { id: '', name: 'Spectator', team: 'A' as const, hand: [], cardCount: 0 }
      : (activeGameState.players[currentViewIndex] ?? activePlayer);

  const isViewingActivePlayer = isMultiplayerActive
    ? multiplayerHook.mySeatIndex !== null && activeTurnIndex === multiplayerHook.mySeatIndex
    : currentViewIndex === activeTurnIndex;

  // Selected cards in current hand
  const selectedCards: Card[] = useMemo(() => {
    try {
      if (!selectedCardIds || selectedCardIds.length === 0) return [];
      const idSet = new Set(selectedCardIds);
      return (viewingPlayer.hand ?? []).filter((c) => idSet.has(c.id));
    } catch {
      return [];
    }
  }, [selectedCardIds, viewingPlayer.hand]);

  // Selected meld object
  const selectedMeld: Meld | null = useMemo(() => {
    try {
      if (!selectedMeldId) return null;
      const allMelds = [
        ...(activeGameState.melds?.A ?? []),
        ...(activeGameState.melds?.B ?? []),
      ];
      return allMelds.find((m) => m.id === selectedMeldId) ?? null;
    } catch (err) {
      console.error('Error resolving selected meld:', err);
      return null;
    }
  }, [selectedMeldId, activeGameState.melds]);

  // Action Dispatcher with Feedback & Audio Cues
  const handleAction = useCallback(
    (action: GameAction): boolean => {
      try {
        // Route actions through authoritative multiplayer server when in active online game
        if (isMultiplayerActive) {
          if (
            action.type !== 'START_NEXT_ROUND' &&
            action.type !== 'RESET_GAME' &&
            action.type !== 'OPTIMIZE_DECK_ORDER' &&
            !isViewingActivePlayer
          ) {
            setErrorMessage('Not your turn to play');
            triggerSound('error');
            return false;
          }

          multiplayerHook.dispatchAction(action);

          // Immediate responsive audio cues for player's own actions
          if (
            action.type === 'DRAW_FROM_STOCK' ||
            action.type === 'TAKE_DISCARD' ||
            action.type === 'DRAW_CARD'
          ) {
            triggerSound('draw');
          } else if (action.type === 'PLAY_NEW_MELD' || action.type === 'ADD_TO_MELD') {
            triggerSound('meld');
          } else if (action.type === 'DISCARD_CARD') {
            triggerSound('discard');
          }

          // Clean up selection state
          if (action.type === 'PLAY_NEW_MELD' || action.type === 'ADD_TO_MELD') {
            setSelectedCardIds([]);
          } else if (action.type === 'DISCARD_CARD') {
            setSelectedCardIds([]);
            setSelectedMeldId(null);
            setJokerPickupBanner(null);
          } else if (action.type === 'START_NEXT_ROUND' || action.type === 'RESET_GAME') {
            setSelectedCardIds([]);
            setSelectedMeldId(null);
            clearAllNotifications();
          }
          return true;
        }

        // Local Pass & Play Reducer Logic
        const prevPukarsA = gameState.pukarsClaimed?.A ?? 0;
        const prevPukarsB = gameState.pukarsClaimed?.B ?? 0;
        const prevStockCount = gameState.stockDeck?.length ?? 0;
        const prevPukarPoolCount = gameState.pukarPool?.length ?? 0;

        const result = pukarReducer(gameState, action);

        if (result.error) {
          setErrorMessage(result.error);
          triggerSound('error');
          return false;
        }

        const next = result.state;

        // Detect Pukar claim (+50 pts)
        const nextPukarsA = next.pukarsClaimed?.A ?? 0;
        const nextPukarsB = next.pukarsClaimed?.B ?? 0;
        if (nextPukarsA > prevPukarsA || nextPukarsB > prevPukarsB) {
          const claimingTeam: 'A' | 'B' = nextPukarsA > prevPukarsA ? 'A' : 'B';
          const actor = gameState.players[gameState.currentPlayerIndex];
          const pukarInfo: PukarEventData = {
            team: claimingTeam,
            playerName: actor?.name ?? `Player ${gameState.currentPlayerIndex + 1}`,
            points: 50,
          };
          triggerPukarCelebration(pukarInfo);
          triggerSound('pukar');
        }
        // Detect Stock Deck replenishment from Pukar pool
        else if (prevStockCount === 1 && prevPukarPoolCount > (next.pukarPool?.length ?? 0)) {
          setExhaustNotification(
            'Stock deck was empty! 1 Pukar deck (13 cards) was placed into the Stock deck.'
          );
          triggerSound('draw');
        }
        // Detect Final Turn triggered by stock exhaustion
        else if (!gameState.lastTurnTriggeredByDeckExhaust && next.lastTurnTriggeredByDeckExhaust) {
          setExhaustNotification(
            'Stock deck and Pukar pool are both exhausted! Final turn initiated.'
          );
          triggerSound('draw');
        }
        // Normal action sound cues
        else if (
          action.type === 'DRAW_FROM_STOCK' ||
          action.type === 'TAKE_DISCARD' ||
          action.type === 'DRAW_CARD'
        ) {
          triggerSound('draw');
        } else if (action.type === 'PLAY_NEW_MELD' || action.type === 'ADD_TO_MELD') {
          triggerSound('meld');
        } else if (action.type === 'DISCARD_CARD') {
          triggerSound('discard');
        } else if (action.type === 'START_NEXT_ROUND') {
          triggerSound('draw');
        }

        // Detect Round Over
        if (next.roundStatus === 'ROUND_OVER' && gameState.roundStatus !== 'ROUND_OVER') {
          triggerSound('roundOver');
        }

        // Detect Normal Joker pickup into hand
        if (next.lastPickedUpCard) {
          const actor = gameState.players[gameState.currentPlayerIndex];
          setJokerPickupBanner({
            playerName: actor?.name ?? `Player ${gameState.currentPlayerIndex + 1}`,
          });
          triggerSound('pukar');
        }

        // Clean up selection state
        if (action.type === 'PLAY_NEW_MELD' || action.type === 'ADD_TO_MELD') {
          setSelectedCardIds([]);
        } else if (action.type === 'DISCARD_CARD') {
          setSelectedCardIds([]);
          setSelectedMeldId(null);
          setJokerPickupBanner(null);
          setViewedPlayerIndex(null);
        } else if (action.type === 'START_NEXT_ROUND' || action.type === 'RESET_GAME') {
          setSelectedCardIds([]);
          setSelectedMeldId(null);
          setViewedPlayerIndex(null);
          clearAllNotifications();
        }

        setGameState(next);
        setErrorMessage(null);
        return true;
      } catch (err) {
        console.error('Unexpected error in handleAction:', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setErrorMessage(`Game action error: ${errorMsg}`);
        triggerSound('error');
        return false;
      }
    },
    [
      isMultiplayerActive,
      isViewingActivePlayer,
      multiplayerHook,
      gameState,
      triggerSound,
      setErrorMessage,
      triggerPukarCelebration,
      setExhaustNotification,
      setJokerPickupBanner,
      clearAllNotifications,
    ]
  );

  // Card Selection Handlers
  const handleToggleCardSelection = useCallback((cardId: string) => {
    try {
      setSelectedCardIds((prev) =>
        prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
      );
    } catch (err) {
      console.error('Error in handleToggleCardSelection:', err);
    }
  }, []);

  const handleClearSelection = useCallback(() => {
    try {
      setSelectedCardIds([]);
    } catch (err) {
      console.error('Error in handleClearSelection:', err);
    }
  }, []);

  // Custom Card Drag Reordering Handler
  const handleReorderHand = useCallback(
    (newHand: Card[]) => {
      if (isMultiplayerActive) {
        if (multiplayerHook.gameState && multiplayerHook.mySeatIndex !== null) {
          const mySeat = multiplayerHook.mySeatIndex;
          multiplayerHook.gameState.players[mySeat].hand = newHand;
        }
        return;
      }

      setGameState((prev) => {
        const pIdx = currentViewIndex;
        if (pIdx < 0 || pIdx >= prev.players.length) return prev;
        const updatedPlayers = prev.players.map((p, idx) => {
          if (idx === pIdx) {
            return { ...p, hand: newHand };
          }
          return p;
        });
        return {
          ...prev,
          players: updatedPlayers,
        };
      });
    },
    [isMultiplayerActive, multiplayerHook.gameState, multiplayerHook.mySeatIndex, currentViewIndex]
  );

  // Play New Meld Handler with Joker Designation Prompt
  const handlePlayMeld = useCallback(
    (cardIds: string[], jokerRepresentedRank?: number) => {
      try {
        const activeHand = viewingPlayer.hand ?? [];
        const cardsToMeld = cardIds
          .map((id) => activeHand.find((c) => c.id === id))
          .filter((c): c is Card => c !== undefined);

        const candidateOptions = getRunCandidateOptions(cardsToMeld);
        if (jokerRepresentedRank === undefined && candidateOptions.length > 1) {
          setJokerPromptData({
            isOpen: true,
            options: candidateOptions,
            cardIds,
          });
          return;
        }

        handleAction({
          type: 'PLAY_NEW_MELD',
          cardIds,
          jokerRepresentedRank:
            jokerRepresentedRank ??
            (candidateOptions.length === 1 ? candidateOptions[0].rank : undefined),
        });
      } catch (err) {
        console.error('Error in handlePlayMeld:', err);
      }
    },
    [viewingPlayer.hand, handleAction, setJokerPromptData]
  );

  // Add Cards to Meld Handler with Joker Position Prompt
  const handleAddToMeld = useCallback(
    (meldId: string, cardIds: string[], jokerRepresentedRank?: number) => {
      try {
        const activeHand = viewingPlayer.hand ?? [];
        const cardsToAdd = cardIds
          .map((id) => activeHand.find((c) => c.id === id))
          .filter((c): c is Card => c !== undefined);

        const allMelds = [
          ...(activeGameState.melds?.A ?? []),
          ...(activeGameState.melds?.B ?? []),
        ];
        const targetMeld = allMelds.find((m) => m.id === meldId);

        if (
          targetMeld &&
          targetMeld.type === 'RUN' &&
          cardsToAdd.some((c) => isNaturalJoker(c)) &&
          jokerRepresentedRank === undefined
        ) {
          const candidateOptions = getAddToRunCandidateOptions(targetMeld, cardsToAdd);
          if (candidateOptions.length > 1) {
            setJokerPromptData({
              isOpen: true,
              options: candidateOptions,
              cardIds,
              targetMeldId: meldId,
            });
            return;
          }
          if (candidateOptions.length === 1) {
            jokerRepresentedRank = candidateOptions[0].rank;
          }
        }

        handleAction({
          type: 'ADD_TO_MELD',
          meldId,
          cardIds,
          jokerRepresentedRank,
        });
      } catch (err) {
        console.error('Error in handleAddToMeld:', err);
      }
    },
    [viewingPlayer.hand, activeGameState.melds, handleAction, setJokerPromptData]
  );

  // Hot-Seat Perspective Switcher (Local Mode Only)
  const handleSwitchPlayer = useCallback(
    (targetIndex: number) => {
      try {
        if (appMode !== 'LOCAL') return;
        if (targetIndex >= 0 && targetIndex < gameState.players.length) {
          setViewedPlayerIndex(targetIndex);
          setSelectedCardIds([]);
          setSelectedMeldId(null);
        }
      } catch (err) {
        console.error('Error in handleSwitchPlayer:', err);
      }
    },
    [appMode, gameState.players.length]
  );

  const handleForceTurn = useCallback(
    (targetIndex: number) => {
      try {
        if (appMode !== 'LOCAL') return;
        setViewedPlayerIndex(targetIndex);
        setGameState((prev) => ({
          ...prev,
          currentPlayerIndex: targetIndex,
        }));
        setSelectedCardIds([]);
        setSelectedMeldId(null);
      } catch (err) {
        console.error('Error in handleForceTurn:', err);
      }
    },
    [appMode]
  );

  return {
    gameState,
    setGameState,
    activeGameState,
    activeTurnIndex,
    activePlayer,
    currentViewIndex,
    viewingPlayer,
    isViewingActivePlayer,
    isMultiplayerActive,
    selectedCardIds,
    setSelectedCardIds,
    selectedCards,
    selectedMeldId,
    setSelectedMeldId,
    selectedMeld,
    viewedPlayerIndex,
    setViewedPlayerIndex,
    handleAction,
    handleToggleCardSelection,
    handleClearSelection,
    handleReorderHand,
    handlePlayMeld,
    handleAddToMeld,
    handleSwitchPlayer,
    handleForceTurn,
  };
}
