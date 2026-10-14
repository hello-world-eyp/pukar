/**
 * Unified Bot Player Orchestrator
 * Dispatches turn decisions to the designated bot personality and maintains bot memory.
 * Pure TypeScript with zero DOM dependencies.
 */
import { GameAction, GameState, isWildcard } from '../types';
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
 * Adheres to realistic fair-play rules: Uncle Pukar decks on the table are face-down.
 * The bot inspects only its own hand (Deck #0 already claimed).
 * - If activePlayer.hand is strong (contains melds or wildcards), bot keeps Deck #0 (returns 0).
 * - If activePlayer.hand is weak (0 melds and 0 wildcards), bot gambles by switching to an alternate deck (Deck 1, or 50/50 if multiple options exist).
 * - Table decks (state.pukarPool) are never peeked or inspected.
 */
export function selectBotPukarDeck(
  state: GameState,
  botIndex: number,
  _personality: BotPersonality
): number {
  const activePlayer = state.players[botIndex];
  if (!activePlayer || !state.pukarPool || state.pukarPool.length === 0) {
    return 0; // default keep Deck #0
  }

  // Fair-play privacy: bot only inspects its own hand (Deck #0 already claimed).
  // Face-down Pukar decks on the table (state.pukarPool) are never inspected.
  const hasWildcards = activePlayer.hand.some((c) => isWildcard(c));
  const handMelds = findPotentialNewMelds(activePlayer.hand);

  // If hand contains a valid meld or wildcard, it is strong enough to keep Deck #0
  if (hasWildcards || handMelds.length > 0) {
    return 0;
  }

  // If hand is weak (0 melds and 0 wildcards), gamble by switching to an alternate deck.
  // When multiple decks exist in pukarPool, choose randomly among available alternate decks (e.g. 50/50).
  return 1 + Math.floor(Math.random() * state.pukarPool.length);
}
