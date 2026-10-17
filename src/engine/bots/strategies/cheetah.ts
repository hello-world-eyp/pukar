/**
 * Cheetah Strategy Engine
 *
 * Characteristics based on player profile:
 * 1. Rush to Pukar / Show:
 *    - "I like to try and get the Pukar as soon as possible"
 *    - "mostly I play to win and rarely do I play a defensive / protected / save the game -style"
 *    - High-tempo, aggressive melding: dumps all valid melds and additions immediately to shrink hand size towards Pukar.
 * 2. Risk-tolerant Discarding:
 *    - "I don't mind giving out a card or two that the opponents want if I see that I am able to do a show in a turn or two by giving out the card they need also by assessing how damaging that card can be ....."
 *    - "There are times when I am giving out a 200/100 card to the opponent in anticipation of getting a Pukar"
 *    - When close to Pukar (hand <= 4), Cheetah relaxes opponent feed penalties and opponent wants penalties,
 *      willing to discard a card that opponents want (or feeds 100/200 runs) if it sheds deadwood to reach Pukar.
 *    - Does NOT play defensive lockdown (plays to win, not save the game).
 *    - Damage assessment: Still strictly protects against catastrophic 500-pt Pure 13 hand-outs unless it's the last card.
 * 3. Discard Pile Assessment & Pivoting:
 *    - "Sometimes depending on the nos of cards or type of cards the opponents have picked up ... I assess and pivot by taking the open cards from below or sometimes continue leaving back to back cards for the player after me."
 *    - Takes discard pile if it contains a Joker or forms immediate melds.
 *    - Takes 1-2 card piles if top card connects tightly with hand to build quick melds.
 *    - If opponents are hoarding cards, pivots to scoop multi-card piles with connectors.
 *    - If close to Pukar (hand <= 3), avoids taking junk piles that bloat hand and delay Pukar.
 */
import { GameAction, GameState, Team } from '../../types';
import { BotMemory, BotTurnPlan } from '../types';
import {
  findBestMeldPlan,
  evaluateDeadwoodAndDiscard,
  evaluateDiscardPilePickup,
} from '../hand-analyzer';

export function decideCheetahTurn(
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
        personality: 'CHEETAH',
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

  // 2. MELD PHASE DECISION (High-tempo: play everything valid to reduce hand size towards Pukar)
  const disallowedCardId =
    (state.cardsPickedUpThisTurn &&
    state.cardsPickedUpThisTurn.length === 1 &&
    state.initialHandSizeThisTurn !== 1
      ? state.cardsPickedUpThisTurn[0]
      : undefined) ??
    (drawAction.type === 'TAKE_DISCARD' && state.discardPile.length === 1 && hand.length !== 1
      ? state.discardPile[0]?.id
      : undefined);

  const isCloseToPukar = hand.length <= 4;
  const isFinalTurn =
    state.roundStatus === 'FINAL_TURN' || Boolean(state.lastTurnTriggeredByDeckExhaust);

  const meldPlan = findBestMeldPlan(hand, myTeamMelds, {
    disallowedCardId,
    preserveDiscardCard: true,
    isCloseToPukar,
    isFinalTurn,
    allTableMelds,
    requirePure: !isTeamOpen,
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

  // 3. DISCARD PHASE DECISION (Aggressive rush to Pukar: ignores defensive lockdown)
  const remainingHand = hand.filter((c) => !meldPlan.usedCardIds.has(c.id));

  // Cheetah does NOT enter defensive lockdown mode:
  const discardEval = evaluateDeadwoodAndDiscard(
    remainingHand.length > 0 ? remainingHand : hand,
    new Set(),
    {
      disallowedCardId,
      teamMelds: myTeamMelds,
      opponentMelds: state.melds[opponentTeam] || [],
      isCloseToPukar: remainingHand.length <= 4,
      isFinalTurn,
      personality: 'CHEETAH',
      nextOpponentCardCount: undefined, // no defensive stall
      opponentNeedsLockdown: false, // plays to win, not defensive
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
    reasoning: `Cheetah offensive rush: ${meldActions.length} melds played, discarding ${cardToDiscard.rank}${cardToDiscard.suit ?? ''} to reach Pukar`,
  };
}
