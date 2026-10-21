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
  shouldHoldNewRunToExtendExistingSequence,
  CandidateMeld,
  countTwosInMeld,
} from '../hand-analyzer';
import { canAddCardsToMeld, evaluateMeldScore } from '../../meld-validator';

export function decideTheLongTermGuyTurn(
  state: GameState,
  botIndex: number,
  memory: BotMemory
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

  const isDiscardPhase = state.phase === 'DISCARD' || state.turnPhase === 'DISCARD';
  const isCloseToPukar = hand.length <= 3;
  const isFinalTurn =
    state.roundStatus === 'FINAL_TURN' || Boolean(state.lastTurnTriggeredByDeckExhaust);

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

  let meldActions: GameAction[] = [];
  let usedCardIds = new Set<string>();

  if (!isDiscardPhase) {
    const computeMeldActions = (canGuaranteePukar: boolean) => {
      const planUsedCardIds = new Set<string>();
      const planMeldActions: GameAction[] = [];

      // Step 2a: Additions to existing team sequences (iterative multi-pass with virtualMelds)
      // Feeds and expands existing team sequences towards Clean 7 and Pure 13 first!
      const virtualMelds: Meld[] = myTeamMelds.map((m) => ({
        ...m,
        cards: [...m.cards],
        slots: [...m.slots],
      }));

      for (let iter = 0; iter < 10; iter++) {
        const remainingCards = hand.filter((c) => !planUsedCardIds.has(c.id));
        if (remainingCards.length <= 1) break;

        const potentialAdditions = findPotentialAdditionsToMelds(
          remainingCards,
          virtualMelds,
          { isCloseToPukar, isFinalTurn, canGuaranteePukar }
        );
        if (potentialAdditions.length === 0) break;

        let addedInIter = false;
        for (const addition of potentialAdditions) {
          const hasOverlap = addition.cards.some((c) => planUsedCardIds.has(c.id));
          if (hasOverlap) continue;

          const potentialUsed = new Set([...planUsedCardIds, ...addition.cards.map((c) => c.id)]);
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
            // Rule: All bots should refrain from putting 2 2s in the same sequence.
            // That just leads to a permanent hundred and a waste of jokers.
            // Minor exception: If the bot is very close to Pukar (<= 2 cards in hand or guaranteed Pukar),
            // adding a second 2 to a sequence of less than 8 cards is allowed.
            if (targetMeld.type === 'RUN') {
              const existing2s = countTwosInMeld(targetMeld);
              const added2s = addition.cards.filter((c) => c.rank === 2).length;
              const meldLen = targetMeld.cards.length;
              const isVeryClose = remainingHand.length <= 1 || canGuaranteePukar;
              const canAllowSecondTwo =
                existing2s + added2s === 2 &&
                meldLen < 8 &&
                isVeryClose;
              if (existing2s + added2s > 1 && !canAllowSecondTwo) {
                continue;
              }
            }

            const validation = canAddCardsToMeld(targetMeld, addition.cards);
            if (validation.valid && validation.updatedSlots) {
              // Safety guard: ensure no sequence's points are reduced unless canGuaranteePukar is true
              const scoreBefore = evaluateMeldScore(targetMeld).points;
              const nextVirtualMeld: Meld = {
                ...targetMeld,
                cards: [...targetMeld.cards, ...addition.cards],
                slots: validation.updatedSlots,
              };
              const scoreAfter = evaluateMeldScore(nextVirtualMeld).points;
              if (scoreAfter < scoreBefore && !canGuaranteePukar) {
                continue;
              }

              virtualMelds[targetMeldIndex] = nextVirtualMeld;
              addition.cards.forEach((c) => planUsedCardIds.add(c.id));
              planMeldActions.push({
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
          const hasOverlap = meld.cards.some((c) => planUsedCardIds.has(c.id));
          if (hasOverlap) continue;

          const potentialUsed = new Set([...planUsedCardIds, ...meld.cards.map((c) => c.id)]);
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

          // Do not open a separate fragmented sequence if the team already has a table run in the same suit
          // that these cards can extend, unless final turn, guaranteed Pukar, or partner is close to Pukar with connecting card.
          if (
            shouldHoldNewRunToExtendExistingSequence(meld, virtualMelds, {
              isFinalTurn,
              isCloseToPukar,
              canGuaranteePukar,
              partnerCardCount,
              partnerKnownCards,
            })
          ) {
            continue;
          }

          meld.cards.forEach((c) => planUsedCardIds.add(c.id));
          planMeldActions.push({
            type: 'PLAY_NEW_MELD',
            cardIds: meld.cards.map((c) => c.id),
          });
        }
      };

      const remainingHand = hand.filter((c) => !planUsedCardIds.has(c.id));
      const requirePure = !isTeamOpen && planMeldActions.length === 0;
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
      if (requirePure && planMeldActions.length > 0) {
        const remainingHandAfterPure = hand.filter((c) => !planUsedCardIds.has(c.id));
        const dirtyMelds = findPotentialNewMelds(remainingHandAfterPure, {
          requirePure: false,
          isCloseToPukar,
          isFinalTurn,
        });
        dirtyMelds.sort((a, b) => b.score - a.score);
        tryAddMelds(dirtyMelds);
      }

      return { meldActions: planMeldActions, usedCardIds: planUsedCardIds };
    };

    // 1. Safe plan: never reduce any meld's points (e.g. 200 -> 100 or 500 -> 100)
    const safePlan = computeMeldActions(false);
    const remainingSafe = hand.filter((c) => !safePlan.usedCardIds.has(c.id));
    const isSafePukar =
      remainingSafe.length === 1 &&
      (!disallowedCardId || remainingSafe[0].id !== disallowedCardId);

    if (isSafePukar) {
      meldActions = safePlan.meldActions;
      usedCardIds = safePlan.usedCardIds;
    } else {
      // 2. Speculative Pukar plan: check if allowing point-reducing additions guarantees Pukar this turn
      const pukarPlan = computeMeldActions(true);
      const remainingPukar = hand.filter((c) => !pukarPlan.usedCardIds.has(c.id));
      const isPukarGuaranteed =
        remainingPukar.length === 1 &&
        (!disallowedCardId || remainingPukar[0].id !== disallowedCardId);

      if (isPukarGuaranteed) {
        meldActions = pukarPlan.meldActions;
        usedCardIds = pukarPlan.usedCardIds;
      } else {
        meldActions = safePlan.meldActions;
        usedCardIds = safePlan.usedCardIds;
      }
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
