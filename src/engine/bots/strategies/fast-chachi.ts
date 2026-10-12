/**
 * Fast Chachi Strategy Engine
 *
 * Characteristics:
 * - Most reckless player.
 * - Discard Hoarder: Whenever discard pile has 3 or more cards, she unconditionally picks up and hoards them!
 * - Run preference: Strongly favors extreme ends: A-2-3 (or 1-2-3) or A-K-Q (or Q-K-A) over middle sequences.
 * - Aggressive sequence opening: If running low on cards, opens more sequences.
 * - Reckless discard: Might throw cards helpful to opponents, but NEVER throws a wildcard (rank 2 or Natural Joker).
 */
import { GameAction, GameState } from '../../types';
import { BotMemory, BotTurnPlan } from '../types';
import {
  findBestMeldPlan,
  evaluateDeadwoodAndDiscard,
  findPotentialNewMelds,
} from '../hand-analyzer';

export function decideFastChachiTurn(
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

  if (state.phase === 'DRAW') {
    // Hoarder rule: If discard pile has 3 or more cards, hoard them all unconditionally!
    if (state.discardPile.length >= 3) {
      drawAction = { type: 'TAKE_DISCARD' };
    } else if (state.discardPile.length > 0) {
      // Check if top card gives an extreme run (A-2-3 or A-K-Q)
      const top = state.discardPile[state.discardPile.length - 1];
      const testHand = [...hand, top];
      const newMelds = findPotentialNewMelds(testHand, {
        requirePure: myTeamMelds.length === 0,
      });
      const hasExtremeMeld = newMelds.some(
        (m) =>
          m.cards.some((c) => c.id === top.id) &&
          m.cards.some((c) => c.rank === 14 || c.rank === 3 || c.rank === 13)
      );

      if (hasExtremeMeld) {
        drawAction = { type: 'TAKE_DISCARD' };
      } else {
        drawAction = { type: 'DRAW_FROM_STOCK' };
      }
    }
  }

  // 2. MELD PHASE DECISION (Favor extreme runs A-2-3 and A-K-Q)
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

  // Sort candidate melds so that extreme runs (containing Ace/3 or Ace/King) come first
  meldPlan.meldsToPlay.sort((a, b) => {
    const aIsExtreme = a.cards.some((c) => c.rank === 14 || c.rank === 3 || c.rank === 13);
    const bIsExtreme = b.cards.some((c) => c.rank === 14 || c.rank === 3 || c.rank === 13);
    if (aIsExtreme && !bIsExtreme) return -1;
    if (!aIsExtreme && bIsExtreme) return 1;
    return b.score - a.score;
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

  const discardEval = evaluateDeadwoodAndDiscard(
    remainingHand.length > 0 ? remainingHand : hand,
    new Set(),
    {
      disallowedCardId,
      preferredExtremeRuns: true, // bias: protect A, 3, K, Q cards in hand
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
    reasoning: 'Fast Chachi: Reckless hoarder with extreme run (A-2-3/A-K-Q) bias',
  };
}
