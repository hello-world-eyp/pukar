import { useMemo, useEffect, useRef, useCallback } from 'react';
import { GameAction, GameState } from '../../engine/types';
import { BotGameConfig, BotMemory } from '../../engine/bots/types';
import {
  createInitialBotMemory,
  decideBotTurn,
  selectBotPukarDeck,
  updateBotMemory,
} from '../../engine/bots/bot-player';

export interface BotStatus {
  isThinking: boolean;
  botName: string;
  personality: string;
  phase: 'DRAW' | 'MELD' | 'DISCARD';
}

export interface UseBotGameProps {
  appMode: 'LOCAL' | 'MULTIPLAYER' | 'BOTS';
  gameState: GameState;
  botConfig: BotGameConfig | null;
  handleAction: (action: GameAction) => void;
  turnDelayMs?: number;
}

export function useBotGame({
  appMode,
  gameState,
  botConfig,
  handleAction,
  turnDelayMs = 250,
}: UseBotGameProps) {
  const handleActionRef = useRef(handleAction);
  handleActionRef.current = handleAction;

  const botStatus = useMemo<BotStatus | null>(() => {
    if (appMode !== 'BOTS' || !botConfig || gameState.isRoundOver) return null;
    const currentIdx = gameState.currentPlayerIndex;
    const currentSeat = botConfig.seats.find((s) => s.seatIndex === currentIdx);
    if (!currentSeat || currentSeat.isHuman) return null;
    return {
      isThinking: true,
      botName: currentSeat.name,
      personality: currentSeat.personality,
      phase: gameState.phase === 'DRAW' ? 'DRAW' : gameState.phase === 'DISCARD' ? 'DISCARD' : 'MELD',
    };
  }, [appMode, botConfig, gameState]);

  const botMemoryRef = useRef<BotMemory>(createInitialBotMemory());
  const prevStateRef = useRef<GameState>(gameState);
  const isExecutingRef = useRef<boolean>(false);

  // Reset bot memory when a fresh game or new match configuration starts
  useEffect(() => {
    if (appMode === 'BOTS' && gameState.round === 1 && gameState.phase === 'DRAW' && gameState.currentPlayerIndex === 0) {
      botMemoryRef.current = createInitialBotMemory();
    }
  }, [appMode, gameState.round, gameState.phase, gameState.currentPlayerIndex]);

  // Track memory updates across state transitions
  useEffect(() => {
    const prevState = prevStateRef.current;
    if (prevState !== gameState) {
      // Check if discard pile changed
      const prevDiscardLen = prevState.discardPile.length;
      const currDiscardLen = gameState.discardPile.length;

      // Discard action occurred: pile grew
      if (currDiscardLen > prevDiscardLen) {
        const discardedCard = gameState.discardPile[gameState.discardPile.length - 1];
        const actorIdx = prevState.currentPlayerIndex;
        if (discardedCard) {
          botMemoryRef.current = updateBotMemory(
            botMemoryRef.current,
            prevState,
            gameState,
            { type: 'DISCARD_CARD', cardId: discardedCard.id },
            actorIdx
          );
        }
      }
      // Pickup bottom action occurred: pile shrank to 0
      else if (prevDiscardLen > 0 && currDiscardLen === 0) {
        const actorIdx = gameState.currentPlayerIndex;
        botMemoryRef.current = updateBotMemory(
          botMemoryRef.current,
          prevState,
          gameState,
          { type: 'TAKE_DISCARD' },
          actorIdx
        );
      }

      prevStateRef.current = gameState;
    }
  }, [gameState]);

  // Automated bot turn execution loop
  useEffect(() => {
    // Only active in BOTS mode
    if (appMode !== 'BOTS' || !botConfig || gameState.isRoundOver) {
      isExecutingRef.current = false;
      return;
    }

    const currentIdx = gameState.currentPlayerIndex;
    const currentSeat = botConfig.seats.find((s) => s.seatIndex === currentIdx);

    // If active player is human, yield control
    if (!currentSeat || currentSeat.isHuman) {
      isExecutingRef.current = false;
      return;
    }

    // Active player is an AI bot
    const personality = currentSeat.personality;
    const currentPhase = gameState.phase;

    // Avoid double execution on re-renders
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;

    const timer = setTimeout(() => {
      try {
        if (currentPhase === 'DRAW') {
          const plan = decideBotTurn(gameState, currentIdx, personality, botMemoryRef.current);
          handleActionRef.current(plan.drawAction);
        } else if (currentPhase === 'MELD') {
          const plan = decideBotTurn(gameState, currentIdx, personality, botMemoryRef.current);

          // If bot claimed Pukar and multiple decks exist, select best deck
          if (gameState.pukarPool.length >= 1 && gameState.players[currentIdx]?.hand.length === 13) {
            const chosenDeck = selectBotPukarDeck(gameState, currentIdx, personality);
            if (chosenDeck > 0) {
              handleActionRef.current({ type: 'SELECT_PUKAR_DECK', deckIndex: chosenDeck });
              isExecutingRef.current = false;
              return;
            }
          }

          // If there are meld actions to play, play the first one
          if (plan.meldActions.length > 0) {
            handleActionRef.current(plan.meldActions[0]);
          } else {
            // No melds left, proceed to discard
            handleActionRef.current(plan.discardAction);
          }
        } else if (currentPhase === 'DISCARD') {
          const plan = decideBotTurn(gameState, currentIdx, personality, botMemoryRef.current);
          handleActionRef.current(plan.discardAction);
        }
      } catch (err) {
        console.error('Error during bot turn execution:', err);
        // Failsafe discard so game never deadlocks
        const hand = gameState.players[currentIdx]?.hand ?? [];
        if (hand.length > 0) {
          handleActionRef.current({ type: 'DISCARD_CARD', cardId: hand[0].id });
        }
      } finally {
        isExecutingRef.current = false;
      }
    }, turnDelayMs);

    return () => {
      clearTimeout(timer);
      isExecutingRef.current = false;
    };
  }, [
    appMode,
    botConfig,
    gameState,
    turnDelayMs,
  ]);

  const resetBotMemory = useCallback(() => {
    botMemoryRef.current = createInitialBotMemory();
  }, []);

  return {
    botStatus,
    botMemory: botMemoryRef.current,
    resetBotMemory,
  };
}
