/**
 * The Long-Term Guy Strategy Engine
 *
 * Characteristics:
 * - Systematic, long-sequence builder.
 * - Sequence expansion first: Prioritizes adding to existing team sequences to feed and
 *   expand them iteratively towards Clean 7 (200 pts) and Pure 13 (500 pts).
 * - Opens new valid sequences from remaining cards to advance towards Pukar.
 * - Balanced between steady sequence growth and patient completion.
 */
import { GameAction, GameState, Meld, Team } from '../../types';
import { BotMemory, BotTurnPlan } from '../types';
import {
  findPotentialNewMelds,
  findPotentialAdditionsToMelds,
  evaluateDeadwoodAndDiscard,
  evaluateDiscardPilePickup,
  CandidateMeld,
} from '../hand-analyzer';
import { canAddCardsToMeld } from '../../meld-validator';

export function decideTheLongTermGuyTurn(
  state: GameState,
  botIndex: number,
  _memory: BotMemory
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
        personality: 'THE_LONG_TERM_GUY',
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

  const isDiscardPhase = state.phase === 'DISCARD' || state.turnPhase === 'DISCARD';
  const isCloseToPukar = hand.length <= 3;
  const isFinalTurn =
    state.roundStatus === 'FINAL_TURN' || Boolean(state.lastTurnTriggeredByDeckExhaust);
  const usedCardIds = new Set<string>();
  const meldActions: GameAction[] = [];

  if (!isDiscardPhase) {
    // Step 2a: Additions to existing team sequences (iterative multi-pass with virtualMelds)
    // Feeds and expands existing team sequences towards Clean 7 and Pure 13 first!
    const virtualMelds: Meld[] = myTeamMelds.map((m) => ({
      ...m,
      cards: [...m.cards],
      slots: [...m.slots],
    }));

    for (let iter = 0; iter < 10; iter++) {
      const remainingCards = hand.filter((c) => !usedCardIds.has(c.id));
      if (remainingCards.length <= 1) break;

      const potentialAdditions = findPotentialAdditionsToMelds(
        remainingCards,
        virtualMelds,
        { isCloseToPukar, isFinalTurn }
      );
      if (potentialAdditions.length === 0) break;

      let addedInIter = false;
      for (const addition of potentialAdditions) {
        const hasOverlap = addition.cards.some((c) => usedCardIds.has(c.id));
        if (hasOverlap) continue;

        const potentialUsed = new Set([...usedCardIds, ...addition.cards.map((c) => c.id)]);
        const remainingHand = hand.filter((c) => !potentialUsed.has(c.id));

        // Rule: Must keep at least 1 card in hand to discard
        if (remainingHand.length === 0) continue;

        if (disallowedCardId) {
          const remainingNonDisallowed = remainingHand.filter(
            (c) => c.id !== disallowedCardId
          );
          if (remainingNonDisallowed.length === 0 && hand.length > 1) {
            continue;
          }
        }

        const targetMeldIndex = virtualMelds.findIndex((m) => m.id === addition.meldId);
        if (targetMeldIndex >= 0) {
          const targetMeld = virtualMelds[targetMeldIndex];
          const validation = canAddCardsToMeld(targetMeld, addition.cards);
          if (validation.valid && validation.updatedSlots) {
            virtualMelds[targetMeldIndex] = {
              ...targetMeld,
              cards: [...targetMeld.cards, ...addition.cards],
              slots: validation.updatedSlots,
            };
            addition.cards.forEach((c) => usedCardIds.add(c.id));
            meldActions.push({
              type: 'ADD_TO_MELD',
              meldId: addition.meldId,
              cardIds: addition.cardIds,
            });
            addedInIter = true;
            break;
          }
        }
      }

      if (!addedInIter) break;
    }

    // Step 2b: New melds from remaining uncommitted cards
    const tryAddMelds = (melds: CandidateMeld[]) => {
      for (const meld of melds) {
        const hasOverlap = meld.cards.some((c) => usedCardIds.has(c.id));
        if (hasOverlap) continue;

        const potentialUsed = new Set([...usedCardIds, ...meld.cards.map((c) => c.id)]);
        const remainingCards = hand.filter((c) => !potentialUsed.has(c.id));

        // Rule: Must keep at least 1 card in hand to discard
        if (remainingCards.length === 0) continue;

        if (disallowedCardId) {
          const remainingNonDisallowed = remainingCards.filter(
            (c) => c.id !== disallowedCardId
          );
          if (remainingNonDisallowed.length === 0 && hand.length > 1) {
            continue;
          }
        }

        meld.cards.forEach((c) => usedCardIds.add(c.id));
        meldActions.push({
          type: 'PLAY_NEW_MELD',
          cardIds: meld.cards.map((c) => c.id),
        });
      }
    };

    const remainingHand = hand.filter((c) => !usedCardIds.has(c.id));
    const requirePure = !isTeamOpen && meldActions.length === 0;
    const candidateMelds = findPotentialNewMelds(remainingHand, {
      requirePure,
      isCloseToPukar,
      isFinalTurn,
    });
    candidateMelds.sort((a, b) => {
      if (a.isPure && !b.isPure) return -1;
      if (!a.isPure && b.isPure) return 1;
      return b.score - a.score;
    });
    tryAddMelds(candidateMelds);

    // If opening turn (requirePure was true) and a pure meld was staged, evaluate dirty melds
    // from remaining uncommitted cards in the same turn.
    if (requirePure && meldActions.length > 0) {
      const remainingHandAfterPure = hand.filter((c) => !usedCardIds.has(c.id));
      const dirtyMelds = findPotentialNewMelds(remainingHandAfterPure, {
        requirePure: false,
        isCloseToPukar,
        isFinalTurn,
      });
      dirtyMelds.sort((a, b) => b.score - a.score);
      tryAddMelds(dirtyMelds);
    }
  }

  // 3. DISCARD PHASE DECISION
  const finalRemainingHand = hand.filter((c) => !usedCardIds.has(c.id));
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
    finalRemainingHand.length > 0 ? finalRemainingHand : hand,
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
    reasoning: 'Harsh: sequence expansion first and patient completion',
  };
}
