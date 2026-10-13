/**
 * Smart Chacha Strategy Engine
 *
 * Characteristics:
 * - Logs all cards picked up from bottom and discarded.
 * - Predicts opponent card needs and strictly avoids discarding wanted cards.
 * - If discard pile does not add value to opponents, lets it slide; otherwise takes it to deny them.
 * - If next opponent is close to Pukar and selective, tries to pass helpful cards to partner through discard.
 */
import { GameAction, GameState, Team } from '../../types';
import { BotMemory, BotTurnPlan } from '../types';
import {
  findBestMeldPlan,
  evaluateDeadwoodAndDiscard,
  evaluateDiscardPilePickup,
} from '../hand-analyzer';

export function predictOpponentWants(
  memory: BotMemory,
  state: GameState,
  botTeam: Team
): Set<string> {
  const wants = new Set<string>();
  const opponentTeam: Team = botTeam === 'A' ? 'B' : 'A';

  // 1. Analyze cards opponents picked up from the bottom pile
  state.players.forEach((player, pIdx) => {
    if (player.team === opponentTeam) {
      const pickups = memory.bottomPickupsByPlayer[pIdx] || [];
      for (const card of pickups) {
        if (card.suit) {
          // Opponent is building around this card's rank and suit
          wants.add(`${card.suit}_${card.rank}`);
          if (card.rank > 2) wants.add(`${card.suit}_${card.rank - 1}`);
          if (card.rank < 14) wants.add(`${card.suit}_${card.rank + 1}`);
          if (card.rank < 13) wants.add(`${card.suit}_${card.rank + 2}`);
        }
      }
    }
  });

  // 2. Analyze opponents' table sequences (open ends of runs)
  const oppMelds = state.melds[opponentTeam] || [];
  for (const meld of oppMelds) {
    if (meld.type === 'RUN' && meld.suit) {
      const ranks = meld.slots.map((s) => s.representedRank).sort((a, b) => a - b);
      if (ranks.length > 0) {
        const minRank = ranks[0];
        const maxRank = ranks[ranks.length - 1];
        if (minRank > 2) wants.add(`${meld.suit}_${minRank - 1}`);
        if (maxRank < 14) wants.add(`${meld.suit}_${maxRank + 1}`);
      }
    }
  }

  return wants;
}

export function decideSmartChachaTurn(
  state: GameState,
  botIndex: number,
  memory: BotMemory
): BotTurnPlan {
  const player = state.players[botIndex];
  const hand = player.hand || [];
  const team = player.team;
  const myTeamMelds = state.melds[team] || [];
  const opponentWants = predictOpponentWants(memory, state, team);

  // 1. DRAW PHASE DECISION
  let drawAction: { type: 'DRAW_FROM_STOCK' } | { type: 'TAKE_DISCARD' } = {
    type: 'DRAW_FROM_STOCK',
  };

  if (state.phase === 'DRAW' && state.discardPile.length > 0) {
    if (
      evaluateDiscardPilePickup(hand, state.discardPile, myTeamMelds, {
        personality: 'SMART_CHACHA',
        pukarPoolCount: state.pukarPool.length,
        opponentWants,
      })
    ) {
      drawAction = { type: 'TAKE_DISCARD' };
    } else {
      drawAction = { type: 'DRAW_FROM_STOCK' };
    }
  }

  // Fallback: If stock deck is exhausted and discard pile has cards, must take discard pile
  if (state.stockDeck.length === 0 && state.discardPile.length > 0) {
    drawAction = { type: 'TAKE_DISCARD' };
  } else if (state.discardPile.length === 0 && state.stockDeck.length > 0) {
    drawAction = { type: 'DRAW_FROM_STOCK' };
  }

  // 2. MELD PHASE DECISION
  const disallowedCardId =
    (state.cardsPickedUpThisTurn &&
    state.cardsPickedUpThisTurn.length === 1 &&
    state.initialHandSizeThisTurn !== 1
      ? state.cardsPickedUpThisTurn[0]
      : undefined) ??
    (drawAction.type === 'TAKE_DISCARD' && state.discardPile.length === 1 && hand.length !== 1
      ? state.discardPile[0]?.id
      : undefined);

  const meldPlan = findBestMeldPlan(hand, myTeamMelds, {
    disallowedCardId,
    preserveDiscardCard: true,
  });
  const meldActions: GameAction[] = [];

  for (const newMeld of meldPlan.meldsToPlay) {
    meldActions.push({
      type: 'PLAY_NEW_MELD',
      cardIds: newMeld.cards.map((c) => c.id),
    });
  }

  for (const addition of meldPlan.additionsToPlay) {
    meldActions.push({
      type: 'ADD_TO_MELD',
      meldId: addition.meldId,
      cardIds: addition.cardIds,
    });
  }

  // 3. DISCARD PHASE DECISION
  const remainingHand = hand.filter((c) => !meldPlan.usedCardIds.has(c.id));
  const nextPlayerIdx = (botIndex + 1) % state.playerCount;
  const nextPlayer = state.players[nextPlayerIdx];
  const partnerLikelyWants = new Set<string>();

  // If next player is an opponent close to Pukar (<= 3 cards), they won't pick up non-matching cards
  // Smart Chacha can try to pass safe cards that partner might need
  if (nextPlayer.team !== team && nextPlayer.hand.length <= 3) {
    const partnerMelds = myTeamMelds;
    for (const pm of partnerMelds) {
      if (pm.type === 'RUN' && pm.suit) {
        const ranks = pm.slots.map((s) => s.representedRank);
        ranks.forEach((r) => {
          if (r > 2) partnerLikelyWants.add(`${pm.suit}_${r - 1}`);
          if (r < 14) partnerLikelyWants.add(`${pm.suit}_${r + 1}`);
        });
      }
    }
  }

  const discardEval = evaluateDeadwoodAndDiscard(
    remainingHand.length > 0 ? remainingHand : hand,
    new Set(),
    {
      disallowedCardId,
      opponentWants,
      partnerLikelyWants,
    }
  );

  const cardToDiscard =
    discardEval.recommendedDiscard ||
    remainingHand.find((c) => !disallowedCardId || c.id !== disallowedCardId) ||
    hand.find((c) => !disallowedCardId || c.id !== disallowedCardId) ||
    hand[0];

  return {
    drawAction,
    meldActions,
    discardAction: {
      type: 'DISCARD_CARD',
      cardId: cardToDiscard.id,
    },
    pukarDeckIndex: 0,
    reasoning: 'Smart Chacha: Strategic discard avoidance and opponent denial',
  };
}
