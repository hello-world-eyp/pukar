/**
 * Unified Bot Player Orchestrator
 * Dispatches turn decisions to the designated bot personality and maintains bot memory.
 * Pure TypeScript with zero DOM dependencies.
 */
import { GameAction, GameState } from '../types';
import { BotMemory, BotPersonality, BotTurnPlan } from './types';
import { decideSmartChachaTurn } from './strategies/smart-chacha';
import { decideTheJadugarTurn } from './strategies/the-jadugar';
import { decideFastChachiTurn } from './strategies/fast-chachi';
import { decideTheLongTermGuyTurn } from './strategies/the-long-term-guy';
import { findPotentialNewMelds } from './hand-analyzer';

export function createInitialBotMemory(): BotMemory {
  return {
    cardLog: [],
    bottomPickupsByPlayer: {},
    discardsByPlayer: {},
  };
}

export function updateBotMemory(
  memory: BotMemory,
  prevState: GameState,
  _nextState: GameState,
  action: GameAction,
  actorIndex: number
): BotMemory {
  const updatedLog = [...memory.cardLog];
  const updatedPickups = { ...memory.bottomPickupsByPlayer };
  const updatedDiscards = { ...memory.discardsByPlayer };

  const now = Date.now();

  if (action.type === 'DISCARD_CARD') {
    const cardId = action.cardId;
    const actorPlayer = prevState.players[actorIndex];
    const discardedCard =
      _nextState?.discardPile?.find((c) => c.id === cardId) ??
      actorPlayer?.hand?.find((c) => c.id === cardId);

    if (discardedCard) {
      updatedLog.push({
        cardId: discardedCard.id,
        suit: discardedCard.suit,
        rank: discardedCard.rank,
        playerIndex: actorIndex,
        action: 'DISCARD',
        timestamp: now,
      });

      const list = updatedDiscards[actorIndex] || [];
      updatedDiscards[actorIndex] = [...list, discardedCard];
    }
  } else if (action.type === 'TAKE_DISCARD') {
    const pickedCards = [...prevState.discardPile];
    for (const card of pickedCards) {
      updatedLog.push({
        cardId: card.id,
        suit: card.suit,
        rank: card.rank,
        playerIndex: actorIndex,
        action: 'PICKUP_BOTTOM',
        timestamp: now,
      });
    }

    const list = updatedPickups[actorIndex] || [];
    updatedPickups[actorIndex] = [...list, ...pickedCards];
  }

  return {
    cardLog: updatedLog,
    bottomPickupsByPlayer: updatedPickups,
    discardsByPlayer: updatedDiscards,
  };
}

export function decideBotTurn(
  state: GameState,
  botIndex: number,
  personality: BotPersonality,
  memory: BotMemory
): BotTurnPlan {
  switch (personality) {
    case 'smart_chacha':
      return decideSmartChachaTurn(state, botIndex, memory);
    case 'the_jadugar':
      return decideTheJadugarTurn(state, botIndex, memory);
    case 'fast_chachi':
      return decideFastChachiTurn(state, botIndex, memory);
    case 'the_long_term_guy':
      return decideTheLongTermGuyTurn(state, botIndex, memory);
  }
}

/**
 * Chooses a Pukar deck when the bot claims a Pukar and multiple decks exist on the table.
 * Evaluates candidate melds in Deck 1 vs Deck 2 (etc.) to pick the best deck index.
 */
export function selectBotPukarDeck(
  state: GameState,
  botIndex: number,
  _personality: BotPersonality
): number {
  const activePlayer = state.players[botIndex];
  if (!activePlayer || !state.pukarPool || state.pukarPool.length === 0) {
    return 0; // default keep Deck #1
  }

  // Deck #1 is currently in activePlayer.hand (index 0)
  // Alternative decks are in state.pukarPool[0] (deckIndex 1), pukarPool[1] (deckIndex 2)
  const deck0Melds = findPotentialNewMelds(activePlayer.hand);
  let bestScore = deck0Melds.length;
  let bestIndex = 0;

  for (let i = 0; i < state.pukarPool.length; i++) {
    const poolDeck = state.pukarPool[i];
    const poolMelds = findPotentialNewMelds(poolDeck);
    if (poolMelds.length > bestScore) {
      bestScore = poolMelds.length;
      bestIndex = i + 1; // 1-based deckIndex
    }
  }

  return bestIndex;
}
