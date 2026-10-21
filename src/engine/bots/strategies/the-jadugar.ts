/**
 * The Jadugar Strategy Engine
 *
 * Characteristics:
 * - Laser-focused on reaching Pukar the fastest.
 * - Strongly prefers drawing from the top (stock deck) rather than discard pile to keep hand lean and fast.
 * - Exception: Takes discard pile only when cards allow her to immediately meld, significantly progress
 *   towards Pukar, or open critical avenues for her partner.
 * - High-tempo melding: plays all valid melds and additions immediately.
 */
import { GameAction, GameState, Team } from '../../types';
import { BotMemory, BotTurnPlan } from '../types';
import {
  findBestMeldPlan,
  evaluateDeadwoodAndDiscard,
  evaluateDiscardPilePickup,
} from '../hand-analyzer';

export function decideTheJadugarTurn(
  state: GameState,
  botIndex: number,
  memory?: BotMemory
): BotTurnPlan {
  const player = state.players[botIndex];
  const hand = player.hand || [];
  const team = player.team;
  const myTeamMelds = state.melds[team] || [];
  const opponentTeam: Team = team === 'A' ? 'B' : 'A';
  const opponentMelds = state.melds[opponentTeam] || [];
  const allTableMelds = [...myTeamMelds, ...opponentMelds];
  const isBoardOpen = allTableMelds.length > 0;
  const isTeamOpen = Boolean(state.hasOpened?.[team] || myTeamMelds.length > 0 || myTeamMelds.some((m) => m.isPure));

  // 1. DRAW PHASE DECISION
  let drawAction: { type: 'DRAW_FROM_STOCK' } | { type: 'TAKE_DISCARD' } = {
    type: 'DRAW_FROM_STOCK',
  };

  if (state.phase === 'DRAW' && state.discardPile.length > 0) {
    if (
      evaluateDiscardPilePickup(hand, state.discardPile, myTeamMelds, {
        personality: 'THE_JADUGAR',
        pukarPoolCount: state.pukarPool.length,
        allTableMelds,
        isBoardOpen,
        isTeamOpen,
        stockDeckCount: state.stockDeck.length,
        botTeam: team,
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

  // 2. MELD PHASE DECISION (High-tempo: play everything valid)
  const isFinishingForPukar = hand.length === 1;
  const disallowedCardId =
    (state.cardsPickedUpThisTurn &&
    state.cardsPickedUpThisTurn.length === 1 &&
    state.initialHandSizeThisTurn !== 1 &&
    !isFinishingForPukar
      ? state.cardsPickedUpThisTurn[0]
      : undefined) ??
    (drawAction.type === 'TAKE_DISCARD' && state.discardPile.length === 1 && !isFinishingForPukar
      ? state.discardPile[0]?.id
      : undefined);

  const partnerIndex = state.players.findIndex(
    (p, idx) => idx !== botIndex && p.team === team
  );
  const partner = partnerIndex >= 0 ? state.players[partnerIndex] : undefined;
  const partnerCardCount = partner
    ? ((partner as any).cardCount ?? partner.hand?.length ?? 0)
    : undefined;
  const partnerPickups = partnerIndex >= 0 && memory ? (memory.bottomPickupsByPlayer[partnerIndex] || []) : [];
  const partnerDiscards = partnerIndex >= 0 && memory ? (memory.discardsByPlayer[partnerIndex] || []) : [];
  const partnerDiscardIds = new Set(partnerDiscards.map((c) => c.id));
  const partnerKnownCards = partnerPickups.filter((c) => !partnerDiscardIds.has(c.id));

  const isCloseToPukar = hand.length <= 3;
  const isFinalTurn =
    state.roundStatus === 'FINAL_TURN' || Boolean(state.lastTurnTriggeredByDeckExhaust);
  const meldPlan = findBestMeldPlan(hand, myTeamMelds, {
    disallowedCardId,
    preserveDiscardCard: true,
    isCloseToPukar,
    isFinalTurn,
    allTableMelds,
    requirePure: !isTeamOpen,
    partnerKnownCards,
    partnerCardCount,
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
  const nextPlayerIndex = (botIndex + 1) % state.playerCount;
  const nextPlayer = state.players[nextPlayerIndex];
  const isNextPlayerOpponent = nextPlayer && nextPlayer.team === opponentTeam;
  const nextOpponentCardCount = isNextPlayerOpponent
    ? ((nextPlayer as any).cardCount ?? nextPlayer.hand?.length ?? 0)
    : undefined;
  const anyOpponentOnTwoOrFewer = state.players.some(
    (p) => p.team === opponentTeam && (((p as any).cardCount ?? p.hand?.length ?? 0) <= 2)
  );
  const opponentNeedsLockdown =
    (nextOpponentCardCount !== undefined && nextOpponentCardCount <= 2) || anyOpponentOnTwoOrFewer;

  const discardEval = evaluateDeadwoodAndDiscard(
    remainingHand.length > 0 ? remainingHand : hand,
    new Set(),
    {
      disallowedCardId,
      teamMelds: myTeamMelds,
      opponentMelds: state.melds[opponentTeam] || [],
      isCloseToPukar,
      isFinalTurn,
      nextOpponentCardCount,
      opponentNeedsLockdown,
      discardPile: state.discardPile,
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
    reasoning: 'Heman: High-velocity Pukar rush with selective stock-first draws',
  };
}
