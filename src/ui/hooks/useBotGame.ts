import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { GameAction, GameState } from '../../engine/types';
import { BotGameConfig, BotMemory } from '../../engine/bots/types';
import {
  createInitialBotMemory,
  decideBotTurn,
  selectBotPukarDeck,
  updateBotMemory,
} from '../../engine/bots/bot-player';

export type BotSubPhase = 'DRAW' | 'MELD' | 'DISCARD';

export interface BotStatus {
  isThinking: boolean;
  botName: string;
  personality: string;
  phase: BotSubPhase;
}

export interface UseBotGameProps {
  appMode: 'LOCAL' | 'MULTIPLAYER' | 'BOTS';
  gameState: GameState;
  botConfig: BotGameConfig | null;
  handleAction: (action: GameAction) => boolean | void;
  turnDelayMs?: number;
}

export function useBotGame({
  appMode,
  gameState,
  botConfig,
  handleAction,
  turnDelayMs = 250,
}: UseBotGameProps) {
  const [botSubPhase, setBotSubPhase] = useState<BotSubPhase>(() =>
    gameState.phase === 'DISCARD' ? 'DISCARD' : gameState.phase === 'MELD' ? 'MELD' : 'DRAW'
  );

  const handleActionRef = useRef(handleAction);
  handleActionRef.current = handleAction;

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const botStatus = useMemo<BotStatus | null>(() => {
    if (appMode !== 'BOTS' || !botConfig || gameState.isRoundOver) return null;
    const currentIdx = gameState.currentPlayerIndex;
    const currentSeat = botConfig.seats.find((s) => s.seatIndex === currentIdx);
    if (!currentSeat || currentSeat.isHuman) return null;
    return {
      isThinking: true,
      botName: currentSeat.name,
      personality: currentSeat.personality,
      phase: botSubPhase,
    };
  }, [appMode, botConfig, gameState.isRoundOver, gameState.currentPlayerIndex, botSubPhase]);

  const botMemoryRef = useRef<BotMemory>(createInitialBotMemory());
  const prevStateRef = useRef<GameState>(gameState);
  const pukarDeckSelectedRef = useRef<boolean>(false);
  const scheduledStepRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPlayerIdxRef = useRef<number>(gameState.currentPlayerIndex);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Reset bot memory when a fresh game starts
  useEffect(() => {
    if (appMode === 'BOTS' && gameState.round === 1 && gameState.phase === 'DRAW' && gameState.currentPlayerIndex === 0) {
      botMemoryRef.current = createInitialBotMemory();
    }
  }, [appMode, gameState.round, gameState.phase, gameState.currentPlayerIndex]);

  // Track memory updates across state transitions
  useEffect(() => {
    const prevState = prevStateRef.current;
    if (prevState !== gameState) {
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

  // Automated 3-stage bot turn execution loop (DRAW -> MELD -> DISCARD)
  useEffect(() => {
    // Only active in BOTS mode when round is ongoing
    if (appMode !== 'BOTS' || !botConfig || gameState.isRoundOver) {
      scheduledStepRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const currentIdx = gameState.currentPlayerIndex;
    const currentSeat = botConfig.seats.find((s) => s.seatIndex === currentIdx);

    // If active player is human, reset and yield control
    if (!currentSeat || currentSeat.isHuman) {
      scheduledStepRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (botSubPhase !== 'DRAW') {
        setBotSubPhase('DRAW');
      }
      lastPlayerIdxRef.current = currentIdx;
      return;
    }

    // Sync subphase whenever a new player takes the turn or engine phase differs
    if (lastPlayerIdxRef.current !== currentIdx) {
      lastPlayerIdxRef.current = currentIdx;
      pukarDeckSelectedRef.current = false;
      const targetSubPhase: BotSubPhase =
        gameState.phase === 'DISCARD' ? 'DISCARD' : gameState.phase === 'MELD' ? 'MELD' : 'DRAW';
      if (botSubPhase !== targetSubPhase) {
        setBotSubPhase(targetSubPhase);
        return;
      }
    } else if (gameState.phase === 'DRAW' && botSubPhase !== 'DRAW') {
      pukarDeckSelectedRef.current = false;
      setBotSubPhase('DRAW');
      return;
    } else if (gameState.phase === 'DISCARD' && botSubPhase !== 'DISCARD') {
      setBotSubPhase('DISCARD');
      return;
    }

    const currentSubPhase = botSubPhase;
    const stepKey = `${gameState.round}-${currentIdx}-${currentSubPhase}-${gameState.phase}`;

    // If this step is already scheduled and ticking, preserve it
    if (scheduledStepRef.current === stepKey) {
      return;
    }

    scheduledStepRef.current = stepKey;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      scheduledStepRef.current = null;
      const currentState = gameStateRef.current;
      if (currentState.isRoundOver) return;

      const seat = botConfig.seats.find((s) => s.seatIndex === currentState.currentPlayerIndex);
      if (!seat || seat.isHuman) return;

      const botIdx = currentState.currentPlayerIndex;
      const botPersonality = seat.personality;

      try {
        if (currentSubPhase === 'DRAW') {
          pukarDeckSelectedRef.current = false;
          const plan = decideBotTurn(currentState, botIdx, botPersonality, botMemoryRef.current);
          let drawAct = plan.drawAction;

          // Safe fallback if stock deck is empty
          if (currentState.stockDeck.length === 0 && currentState.discardPile.length > 0) {
            drawAct = { type: 'TAKE_DISCARD' };
          } else if (currentState.discardPile.length === 0 && currentState.stockDeck.length > 0) {
            drawAct = { type: 'DRAW_FROM_STOCK' };
          }

          const success = handleActionRef.current(drawAct);
          // Bidirectional fallback if rejected
          if (success === false) {
            if (drawAct.type === 'TAKE_DISCARD' && currentState.stockDeck.length > 0) {
              handleActionRef.current({ type: 'DRAW_FROM_STOCK' });
            } else if (drawAct.type === 'DRAW_FROM_STOCK' && currentState.discardPile.length > 0) {
              handleActionRef.current({ type: 'TAKE_DISCARD' });
            }
          }

          setBotSubPhase('MELD');
        } else if (currentSubPhase === 'MELD') {
          const plan = decideBotTurn(currentState, botIdx, botPersonality, botMemoryRef.current);

          // If bot claimed Pukar (initialHandSizeThisTurn === 0) and multiple decks exist, select best deck
          if (
            currentState.initialHandSizeThisTurn === 0 &&
            currentState.pukarPool.length >= 1 &&
            currentState.players[botIdx]?.hand.length === 13 &&
            !pukarDeckSelectedRef.current
          ) {
            pukarDeckSelectedRef.current = true;
            const chosenDeck = selectBotPukarDeck(currentState, botIdx, botPersonality);
            if (chosenDeck > 0) {
              handleActionRef.current({ type: 'SELECT_PUKAR_DECK', deckIndex: chosenDeck });
            }
          }

          // Play meld action(s)
          let meldRejected = false;
          if (plan.meldActions.length > 0) {
            for (const meldAct of plan.meldActions) {
              const success = handleActionRef.current(meldAct);
              if (success === false) {
                meldRejected = true;
                break;
              }
            }
          }

          if (meldRejected) {
            // Meld action was rejected: proceed directly to discard to avoid deadlock
            handleActionRef.current(plan.discardAction);
            setBotSubPhase('DRAW');
          } else {
            // Transition to DISCARD subphase so user sees "is discarding..." and gets full turn duration
            setBotSubPhase('DISCARD');
          }
        } else if (currentSubPhase === 'DISCARD') {
          const plan = decideBotTurn(currentState, botIdx, botPersonality, botMemoryRef.current);
          const success = handleActionRef.current(plan.discardAction);

          if (success === false) {
            // Failsafe discard
            const hand = currentState.players[botIdx]?.hand ?? [];
            const disallowedId =
              currentState.cardsPickedUpThisTurn?.length === 1 &&
              currentState.initialHandSizeThisTurn !== 1
                ? currentState.cardsPickedUpThisTurn[0]
                : null;
            const fallbackCard = hand.find((c) => !disallowedId || c.id !== disallowedId) ?? hand[0];
            if (fallbackCard) {
              handleActionRef.current({ type: 'DISCARD_CARD', cardId: fallbackCard.id });
            }
          }

          setBotSubPhase('DRAW');
        }
      } catch (err) {
        console.error('Error during bot turn execution:', err);
        // Failsafe discard so game never deadlocks
        const hand = currentState.players[botIdx]?.hand ?? [];
        if (hand.length > 0) {
          const disallowedId =
            currentState.cardsPickedUpThisTurn?.length === 1 &&
            currentState.initialHandSizeThisTurn !== 1
              ? currentState.cardsPickedUpThisTurn[0]
              : null;
          const fallbackCard = hand.find((c) => !disallowedId || c.id !== disallowedId) ?? hand[0];
          if (fallbackCard) {
            handleActionRef.current({ type: 'DISCARD_CARD', cardId: fallbackCard.id });
          }
        }
        setBotSubPhase('DRAW');
      }
    }, turnDelayMs);
  }, [
    appMode,
    botConfig,
    gameState.round,
    gameState.currentPlayerIndex,
    gameState.phase,
    gameState.isRoundOver,
    botSubPhase,
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
