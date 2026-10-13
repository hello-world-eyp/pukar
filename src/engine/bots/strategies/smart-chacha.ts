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

  const partnerIdx = state.players.findIndex((p, idx) => idx !== botIndex && p.team === team);
  const partner = partnerIdx >= 0 ? state.players[partnerIdx] : null;

  // Smart Chacha Passing Intelligence:
  // Understands that for the partner to receive a passed card, the partner must pick up
  // the entire discard pile ("the bottom").
  // If the discard pile already contains 2-3 cards from opponents, that good card comes
  // bundled with 2-3 unhelpful opponent cards, which is NOT beneficial for the partner!
  // Furthermore, if the partner is close to Pukar (<= 4 cards), bloating their hand with
  // opponent cards delays or ruins their Pukar sprint.
  const currentDiscardPileLen = state.discardPile.length;
  const isOpponentSelective = nextPlayer.team !== team && nextPlayer.hand.length <= 3;
  const isPartnerCloseToPukar = partner ? partner.hand.length <= 4 : false;
  const isDiscardPileCleanForPartner = currentDiscardPileLen <= 1;

  if (isOpponentSelective && isDiscardPileCleanForPartner && !isPartnerCloseToPukar && partner) {
    // 1. Partner's logged bottom pickups (partner is building unmelded runs in hand)
    const partnerPickups = memory.bottomPickupsByPlayer[partnerIdx] || [];
    for (const card of partnerPickups) {
      if (card.suit) {
        const ranksToAdd = [card.rank - 1, card.rank + 1, card.rank - 2, card.rank + 2];
        for (const r of ranksToAdd) {
          if (r >= 3 && r <= 14) {
            const key = `${card.suit}_${r}`;
            if (!opponentWants.has(key)) {
              partnerLikelyWants.add(key);
            }
          }
        }
      }
    }

    // 2. Table melds (for cards that connect 1-2 ranks away)
    const partnerMelds = myTeamMelds;
    for (const pm of partnerMelds) {
      if (pm.type === 'RUN' && pm.suit) {
        const ranks = pm.slots.map((s) => s.representedRank);
        ranks.forEach((r) => {
          const lowerRank = r - 1;
          const upperRank = r + 1;
          const lowerKey = `${pm.suit}_${lowerRank}`;
          const upperKey = `${pm.suit}_${upperRank}`;
          if (lowerRank > 2 && !opponentWants.has(lowerKey)) {
            partnerLikelyWants.add(lowerKey);
          }
          if (upperRank < 14 && !opponentWants.has(upperKey)) {
            partnerLikelyWants.add(upperKey);
          }
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
