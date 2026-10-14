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
import { GameAction, GameState, Team } from '../../types';
import { BotMemory, BotTurnPlan } from '../types';
import {
  findBestMeldPlan,
  evaluateDeadwoodAndDiscard,
  evaluateDiscardPilePickup,
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
  const opponentTeam: Team = team === 'A' ? 'B' : 'A';
  const opponentMelds = state.melds[opponentTeam] || [];
  const allTableMelds = [...myTeamMelds, ...opponentMelds];
  const isBoardOpen = allTableMelds.length > 0;

  // 1. DRAW PHASE DECISION
  let drawAction: { type: 'DRAW_FROM_STOCK' } | { type: 'TAKE_DISCARD' } = {
    type: 'DRAW_FROM_STOCK',
  };

  if (state.phase === 'DRAW' && state.discardPile.length > 0) {
    if (
      evaluateDiscardPilePickup(hand, state.discardPile, myTeamMelds, {
        personality: 'FAST_CHACHI',
        pukarPoolCount: state.pukarPool.length,
        allTableMelds,
        isBoardOpen,
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

  const isCloseToPukar = hand.length <= 3;
  const isFinalTurn =
    state.roundStatus === 'FINAL_TURN' || Boolean(state.lastTurnTriggeredByDeckExhaust);
  const meldPlan = findBestMeldPlan(hand, myTeamMelds, {
    disallowedCardId,
    preserveDiscardCard: true,
    isCloseToPukar,
    isFinalTurn,
    allTableMelds,
    requirePure: !isBoardOpen,
  });

  // Sort candidate melds so that extreme runs (containing Ace/3 or Ace/King) come first.
  // On an opening turn (!isBoardOpen), pure runs must always take precedence over dirty melds!
  meldPlan.meldsToPlay.sort((a, b) => {
    if (!isBoardOpen) {
      if (a.isPure && !b.isPure) return -1;
      if (!a.isPure && b.isPure) return 1;
    }
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
      preferredExtremeRuns: true, // bias: protect low sequence (A, 2, 3, 4, 5) and high sequence (10..A)
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
    reasoning: 'Fast Chachi: Reckless hoarder with extreme run (A-2-3/A-K-Q) bias',
  };
}
