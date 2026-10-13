/**
 * The Long-Term Guy Strategy Engine
 *
 * Characteristics:
 * - Systematic, long-sequence builder.
 * - One sequence per suit discipline: Aims to open at most one sequence of each suit, and
 *   continually feeds and expands that sequence towards Clean 7 (200 pts) and Pure 13 (500 pts).
 * - Second sequence gating: Opens a second sequence of the same suit ONLY if the existing sequence
 *   has already completed 7+ cards (100 or 200 pts) AND his opportunity to make 500 based on his own cards is limited.
 * - Balanced between steady sequence growth and patient completion.
 */
import { GameAction, GameState, Suit } from '../../types';
import { BotMemory, BotTurnPlan } from '../types';
import {
  findPotentialNewMelds,
  findPotentialAdditionsToMelds,
  evaluateDeadwoodAndDiscard,
  evaluateDiscardPilePickup,
} from '../hand-analyzer';

export function decideTheLongTermGuyTurn(
  state: GameState,
  botIndex: number,
  _memory: BotMemory
): BotTurnPlan {
  const player = state.players[botIndex];
  const hand = player.hand || [];
  const team = player.team;
  const myTeamMelds = state.melds[team] || [];

  // Group existing team runs by suit
  const existingRunsBySuit = new Map<Suit, typeof myTeamMelds>();
  for (const meld of myTeamMelds) {
    if (meld.type === 'RUN' && meld.suit) {
      const list = existingRunsBySuit.get(meld.suit) || [];
      list.push(meld);
      existingRunsBySuit.set(meld.suit, list);
    }
  }

  // 1. DRAW PHASE DECISION
  let drawAction: { type: 'DRAW_FROM_STOCK' } | { type: 'TAKE_DISCARD' } = {
    type: 'DRAW_FROM_STOCK',
  };

  if (state.phase === 'DRAW' && state.discardPile.length > 0) {
    if (
      evaluateDiscardPilePickup(hand, state.discardPile, myTeamMelds, {
        personality: 'THE_LONG_TERM_GUY',
        pukarPoolCount: state.pukarPool.length,
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
  // The long-term guy prioritizes ADDING to existing team sequences first!
  const disallowedCardId =
    (state.cardsPickedUpThisTurn &&
    state.cardsPickedUpThisTurn.length === 1 &&
    state.initialHandSizeThisTurn !== 1
      ? state.cardsPickedUpThisTurn[0]
      : undefined) ??
    (drawAction.type === 'TAKE_DISCARD' && state.discardPile.length === 1 && hand.length !== 1
      ? state.discardPile[0]?.id
      : undefined);

  const usedCardIds = new Set<string>();
  const meldActions: GameAction[] = [];

  // Step 2a: Additions to existing team sequences
  const potentialAdditions = findPotentialAdditionsToMelds(hand, myTeamMelds);
  for (const addition of potentialAdditions) {
    const hasOverlap = addition.cards.some((c) => usedCardIds.has(c.id));
    if (!hasOverlap) {
      const potentialUsed = new Set([...usedCardIds, ...addition.cards.map((c) => c.id)]);
      const remainingCards = hand.filter((c) => !potentialUsed.has(c.id));

      // Rule: Must keep at least 1 card in hand to discard
      if (remainingCards.length === 0) {
        continue;
      }

      if (disallowedCardId) {
        const remainingNonDisallowed = remainingCards.filter(
          (c) => c.id !== disallowedCardId
        );
        if (remainingNonDisallowed.length === 0 && hand.length > 1) {
          continue;
        }
      }

      addition.cards.forEach((c) => usedCardIds.add(c.id));
      meldActions.push({
        type: 'ADD_TO_MELD',
        meldId: addition.meldId,
        cardIds: addition.cardIds,
      });
    }
  }

  // Step 2b: New melds from remaining cards
  const remainingHand = hand.filter((c) => !usedCardIds.has(c.id));
  const candidateMelds = findPotentialNewMelds(remainingHand, {
    requirePure: myTeamMelds.length === 0,
  });

  // Filter candidate melds according to the "One sequence per suit" rule:
  for (const meld of candidateMelds) {
    const hasOverlap = meld.cards.some((c) => usedCardIds.has(c.id));
    if (hasOverlap) continue;

    const potentialUsed = new Set([...usedCardIds, ...meld.cards.map((c) => c.id)]);
    const remainingCards = hand.filter((c) => !potentialUsed.has(c.id));

    // Rule: Must keep at least 1 card in hand to discard
    if (remainingCards.length === 0) {
      continue;
    }

    if (disallowedCardId) {
      const remainingNonDisallowed = remainingCards.filter(
        (c) => c.id !== disallowedCardId
      );
      if (remainingNonDisallowed.length === 0 && hand.length > 1) {
        continue;
      }
    }

    if (meld.type === 'RUN' && meld.suit) {
      const existingInSuit = existingRunsBySuit.get(meld.suit) || [];
      if (existingInSuit.length === 0) {
        // Suit not opened yet: Great! Open this suit sequence
        meld.cards.forEach((c) => usedCardIds.add(c.id));
        meldActions.push({
          type: 'PLAY_NEW_MELD',
          cardIds: meld.cards.map((c) => c.id),
        });
        existingRunsBySuit.set(meld.suit, [meld as any]);
      } else {
        // Suit ALREADY has a sequence!
        // Only open a second sequence if existing run has >= 7 cards (100 or 200 made)
        const primaryRun = existingInSuit[0];
        const isComplete7 = (primaryRun.cards?.length ?? 0) >= 7;

        // And check if opportunity to make 500 is limited (e.g. fewer than 10 cards available in that suit)
        const suitedCardsInHand = hand.filter((c) => c.suit === meld.suit).length;
        const oppFor500Limited = suitedCardsInHand < 5;

        if (isComplete7 && oppFor500Limited) {
          meld.cards.forEach((c) => usedCardIds.add(c.id));
          meldActions.push({
            type: 'PLAY_NEW_MELD',
            cardIds: meld.cards.map((c) => c.id),
          });
        }
      }
    } else if (meld.type === 'SET' && myTeamMelds.length > 0) {
      meld.cards.forEach((c) => usedCardIds.add(c.id));
      meldActions.push({
        type: 'PLAY_NEW_MELD',
        cardIds: meld.cards.map((c) => c.id),
      });
    }
  }

  // 3. DISCARD PHASE DECISION
  const finalRemainingHand = hand.filter((c) => !usedCardIds.has(c.id));

  const discardEval = evaluateDeadwoodAndDiscard(
    finalRemainingHand.length > 0 ? finalRemainingHand : hand,
    new Set(),
    { disallowedCardId }
  );

  const cardToDiscard =
    discardEval.recommendedDiscard ||
    finalRemainingHand.find((c) => !disallowedCardId || c.id !== disallowedCardId) ||
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
    reasoning: 'The long-term guy: 1-sequence-per-suit discipline and patient expansion',
  };
}
