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
import { GameAction, GameState } from '../../types';
import { BotMemory, BotTurnPlan } from '../types';
import {
  findBestMeldPlan,
  evaluateDeadwoodAndDiscard,
  findPotentialNewMelds,
  findPotentialAdditionsToMelds,
} from '../hand-analyzer';

export function decideTheJadugarTurn(
  state: GameState,
  botIndex: number,
  _memory: BotMemory
): BotTurnPlan {
  const player = state.players[botIndex];
  const hand = player.hand || [];
  const team = player.team;
  const myTeamMelds = state.melds[team] || [];

  // 1. DRAW PHASE DECISION
  let drawAction: { type: 'DRAW_FROM_STOCK' } | { type: 'TAKE_DISCARD' } = {
    type: 'DRAW_FROM_STOCK',
  };

  if (state.phase === 'DRAW' && state.discardPile.length > 0) {
    const topCard = state.discardPile[state.discardPile.length - 1];
    // Check if the top discard card immediately completes a meld or addition in hand
    const testWithTop = [...hand, topCard];
    const newMeldsWithTop = findPotentialNewMelds(testWithTop, {
      requirePure: myTeamMelds.length === 0,
    });
    const addsWithTop = findPotentialAdditionsToMelds(testWithTop, myTeamMelds);

    const currentMelds = findPotentialNewMelds(hand, {
      requirePure: myTeamMelds.length === 0,
    });
    const currentAdds = findPotentialAdditionsToMelds(hand, myTeamMelds);

    const immediateProgress =
      newMeldsWithTop.length > currentMelds.length || addsWithTop.length > currentAdds.length;

    // The Jadugar only takes the pile if it gives immediate high-tempo meld progress towards Pukar
    if (immediateProgress) {
      drawAction = { type: 'TAKE_DISCARD' };
    } else {
      // Otherwise, always prefers stock to stay nimble and not bloat hand
      drawAction = { type: 'DRAW_FROM_STOCK' };
    }
  }

  // 2. MELD PHASE DECISION (High-tempo: play everything valid)
  const disallowedCardId =
    (state.cardsPickedUpThisTurn &&
    state.cardsPickedUpThisTurn.length === 1 &&
    state.initialHandSizeThisTurn !== 1
      ? state.cardsPickedUpThisTurn[0]
      : undefined) ??
    (drawAction.type === 'TAKE_DISCARD' && state.discardPile.length === 1 && hand.length !== 1
      ? state.discardPile[0]?.id
      : undefined);

  const meldPlan = findBestMeldPlan(hand, myTeamMelds, { disallowedCardId });
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

  const discardEval = evaluateDeadwoodAndDiscard(
    remainingHand.length > 0 ? remainingHand : hand,
    new Set(),
    { disallowedCardId }
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
    reasoning: 'The Jadugar: High-velocity Pukar rush with selective stock-first draws',
  };
}
