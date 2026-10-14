/**
 * Smart Chacha Strategy Engine
 *
 * Characteristics:
 * - Logs all cards picked up from bottom and discarded.
 * - Predicts opponent card needs and strictly avoids discarding wanted cards.
 * - If discard pile does not add value to opponents, lets it slide; otherwise takes it to deny them.
 * - If next opponent is close to Pukar and selective, tries to pass helpful cards to partner through discard.
 */
import { GameAction, GameState, Team, isWildcard } from '../../types';
import { BotMemory, BotTurnPlan } from '../types';
import { canAddCardsToMeld } from '../../meld-validator';
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
          if (card.rank > 3) wants.add(`${card.suit}_${card.rank - 2}`);
        }
        // Set connector (same rank across suits)
        wants.add(`RANK_${card.rank}`);
      }
    }
  });

  // 2. Analyze opponents' table sequences and sets
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
    } else if (meld.type === 'SET' && meld.slots.length > 0) {
      const setRank = meld.slots[0].representedRank;
      wants.add(`RANK_${setRank}`);
    }
  }

  return wants;
}

export function predictPartnerNeeds(
  memory: BotMemory,
  state: GameState,
  botTeam: Team,
  botIndex: number
): { partnerNeeds: Set<string>; partnerDiscards: Set<string> } {
  const partnerNeeds = new Set<string>();
  const partnerDiscards = new Set<string>();

  const partnerIndices: number[] = [];
  state.players.forEach((player, idx) => {
    if (idx !== botIndex && player.team === botTeam) {
      partnerIndices.push(idx);
    }
  });

  for (const partnerIdx of partnerIndices) {
    // 1. Cards partner discarded (deadwood partner does NOT want)
    const discards = memory.discardsByPlayer[partnerIdx] || [];
    for (const card of discards) {
      if (card.suit) {
        partnerDiscards.add(`${card.suit}_${card.rank}`);
      }
      partnerDiscards.add(`RANK_${card.rank}`);
    }

    // 2. Cards partner picked up from bottom (partner is building runs / sets in hand)
    const pickups = memory.bottomPickupsByPlayer[partnerIdx] || [];
    for (const card of pickups) {
      if (card.suit) {
        // Run connectors
        const runRanks = [card.rank - 2, card.rank - 1, card.rank + 1, card.rank + 2];
        for (const r of runRanks) {
          if (r >= 2 && r <= 14) {
            partnerNeeds.add(`${card.suit}_${r}`);
          }
        }
        partnerNeeds.add(`${card.suit}_${card.rank}`);
      }
      // Set connectors
      partnerNeeds.add(`RANK_${card.rank}`);
    }
  }

  // Remove known discards from partner needs
  for (const discardKey of partnerDiscards) {
    partnerNeeds.delete(discardKey);
  }

  return { partnerNeeds, partnerDiscards };
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

  const isDiscardPhase = state.phase === 'DISCARD' || state.turnPhase === 'DISCARD';
  const isCloseToPukar = hand.length <= 3;
  const isFinalTurn =
    state.roundStatus === 'FINAL_TURN' || Boolean(state.lastTurnTriggeredByDeckExhaust);
  const meldPlan = isDiscardPhase
    ? { meldsToPlay: [], additionsToPlay: [], usedCardIds: new Set<string>() }
    : findBestMeldPlan(hand, myTeamMelds, {
        disallowedCardId,
        preserveDiscardCard: true,
        isCloseToPukar,
        isFinalTurn,
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
  const candidatePool = remainingHand.length > 0 ? remainingHand : hand;
  const partnerLikelyWants = new Set<string>();
  const protectedCardIds = new Set<string>();
  const opponentTeam: Team = team === 'A' ? 'B' : 'A';
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

  const partnerIdx = state.players.findIndex((p, idx) => idx !== botIndex && p.team === team);
  const partner = partnerIdx >= 0 ? state.players[partnerIdx] : null;

  // Smart Chacha Passing & Protection Intelligence:
  // 1. Partner needs are predicted from partner's bottom pickups, discards, and table melds.
  // 2. Discard Pile Cleanliness:
  //    For partner to receive a card, partner must pick up the entire discard pile ("the bottom").
  //    If the discard pile already contains >= 2 cards from opponents, passing a card forces partner
  //    to pick up unwanted opponent junk, which is not beneficial for them!
  // 3. Opponent Interception:
  //    The intermediate player (or opponents generally) sit between Smart Chacha and partner.
  //    If opponent can intercept or benefit from a card (opponent table melds or predicted wants),
  //    Smart Chacha MUST NOT give it away; Smart Chacha protects it in hand!
  // 4. Partner hand size (< 3 cards vs >= 3 cards):
  //    - If partner is on < 3 cards: ONLY pass a card if it directly connects to a team table sequence
  //      so partner can scoop and go out cleanly! Never pass a hand card that bloats their hand.
  //    - If partner is on >= 3 cards: Do NOT pass table sequence cards (opponents would pick them up).
  //      Instead, pass hand building cards that partner needs when pile is clean and safe!
  const currentDiscardPileLen = state.discardPile.length;
  const isDiscardPileCleanForPartner = currentDiscardPileLen <= 1;
  const partnerCardCount = partner
    ? ((partner as any).cardCount ?? partner.hand?.length ?? 0)
    : 0;
  const isPartnerOnLessThan3Cards = partnerCardCount > 0 && partnerCardCount < 3;

  const { partnerNeeds } = predictPartnerNeeds(memory, state, team, botIndex);

  for (const card of candidatePool) {
    const cardKey = card.suit ? `${card.suit}_${card.rank}` : `RANK_${card.rank}`;
    const rankKey = `RANK_${card.rank}`;

    // Can opponent intercept or benefit from this card?
    const opponentCanIntercept =
      opponentWants.has(cardKey) ||
      opponentWants.has(rankKey) ||
      (state.melds[opponentTeam] || []).some((m) => canAddCardsToMeld(m, [card]).valid) ||
      (state.melds[opponentTeam] || []).some((m) => {
        if (m.type === 'RUN' && m.suit === card.suit) {
          const ranks = m.slots.map((s) => s.representedRank).sort((a, b) => a - b);
          if (ranks.length > 0) {
            const minR = ranks[0];
            const maxR = ranks[ranks.length - 1];
            return (
              card.rank === minR - 1 ||
              card.rank === maxR + 1 ||
              (card.rank === 14 && minR === 2)
            );
          }
        } else if (m.type === 'SET') {
          const setRank =
            m.rank ??
            m.slots.find((s) => !s.isWildcard)?.representedRank ??
            m.cards?.find((c) => !isWildcard(c))?.rank;
          return setRank !== undefined && card.rank === setRank;
        }
        return false;
      });

    // Does card connect to team table melds?
    const isTeamMeldAdd = myTeamMelds.some((m) => canAddCardsToMeld(m, [card]).valid);
    let isTeamMeldNeighbor = false;
    if (card.suit) {
      for (const tm of myTeamMelds) {
        if (tm.type === 'RUN' && tm.suit === card.suit) {
          const ranks = tm.slots.map((s) => s.representedRank).sort((a, b) => a - b);
          if (ranks.length > 0) {
            const minR = ranks[0];
            const maxR = ranks[ranks.length - 1];
            if (card.rank === minR - 1 || card.rank === maxR + 1) {
              isTeamMeldNeighbor = true;
              break;
            }
          }
        }
      }
    }

    const partnerNeedsCard =
      partnerNeeds.has(cardKey) ||
      partnerNeeds.has(rankKey) ||
      isTeamMeldAdd ||
      isTeamMeldNeighbor;

    if (partnerNeedsCard) {
      if (opponentCanIntercept) {
        // Opponent would intercept: strictly avoid giving it! Hold in hand.
        protectedCardIds.add(card.id);
      } else if (!isDiscardPileCleanForPartner) {
        // Discard pile is dirty (>= 2 opponent cards): avoid giving it!
        protectedCardIds.add(card.id);
      } else if (isPartnerOnLessThan3Cards) {
        // Partner is on < 3 cards: only pass if it can be added to a table sequence so partner goes out!
        if (isTeamMeldAdd && partner) {
          partnerLikelyWants.add(cardKey);
          partnerLikelyWants.add(card.id);
        } else {
          protectedCardIds.add(card.id);
        }
      } else {
        // Partner has >= 3 cards (building hand):
        // If it's a table sequence card, do NOT throw it to partner (protect it so opponents don't scoop).
        // Otherwise, it's a hand card partner needs: pass it to partner!
        if (isTeamMeldAdd || isTeamMeldNeighbor) {
          protectedCardIds.add(card.id);
        } else if (partner) {
          partnerLikelyWants.add(cardKey);
          partnerLikelyWants.add(card.id);
          partnerLikelyWants.add(rankKey);
        }
      }
    } else {
      // Not specifically flagged as partner need:
      // Protect table sequence cards from discard
      if (isTeamMeldAdd || isTeamMeldNeighbor) {
        protectedCardIds.add(card.id);
      }
    }
  }

  const discardEval = evaluateDeadwoodAndDiscard(
    candidatePool,
    new Set(),
    {
      disallowedCardId,
      opponentWants,
      partnerLikelyWants,
      protectedCardIds,
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
    reasoning: 'Smart Chacha: Strategic discard avoidance and opponent denial',
  };
}
