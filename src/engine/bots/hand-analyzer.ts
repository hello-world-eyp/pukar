/**
 * Hand Analyzer for AI Bots
 * Evaluates candidate runs, sets, table additions, and discard safety.
 * Pure TypeScript with zero DOM dependencies.
 */
import { Card, Meld, Suit, isNaturalJoker, isWildcard } from '../types';
import { canAddCardsToMeld, validateNewMeld } from '../meld-validator';

export interface CandidateMeld {
  cards: Card[];
  type: 'RUN' | 'SET';
  suit?: Suit;
  rank?: number;
  isPure: boolean;
  score: number;
}

export interface CandidateAddition {
  meldId: string;
  cardIds: string[];
  cards: Card[];
  score: number;
}

export interface DiscardEvaluationOptions {
  disallowedCardId?: string;
  opponentWants?: Set<string>; // set of "SUIT_RANK" keys, e.g. "SPADES_7" or card IDs
  preferredExtremeRuns?: boolean; // For Fast Chachi: bias towards extreme runs
  partnerLikelyWants?: Set<string>; // For Smart Chacha: cards to pass to partner
}

export interface HandEvaluation {
  candidateMelds: CandidateMeld[];
  candidateAdditions: CandidateAddition[];
  deadwood: Card[];
  recommendedDiscard: Card | null;
  discardScores: Array<{ card: Card; score: number; reason: string }>;
}

/**
 * Searches for all valid 3+ card runs in a specific suit given suited cards and available wildcards.
 */
export function findCandidateRunsInSuit(
  suitedCards: Card[],
  suit: Suit,
  wildcards: Card[]
): CandidateMeld[] {
  const candidateMelds: CandidateMeld[] = [];
  const seenCardSets = new Set<string>();

  // Filter out any cards that don't belong to this suit (excluding wildcards)
  const naturalCards = suitedCards.filter((c) => c.suit === suit && !isNaturalJoker(c));
  // Sort by rank ascending
  const uniqueRankCards = new Map<number, Card[]>();
  for (const c of naturalCards) {
    const list = uniqueRankCards.get(c.rank) || [];
    list.push(c);
    uniqueRankCards.set(c.rank, list);
  }

  // 1. Natural runs (no wildcards)
  // Ranks can range from 1 (Ace-low) to 14 (Ace-high)
  const availableRanks = Array.from(uniqueRankCards.keys());
  if (uniqueRankCards.has(14)) {
    availableRanks.push(1); // Represent Ace low as 1
  }
  availableRanks.sort((a, b) => a - b);

  // Generate consecutive windows from length 3 to min(13, availableRanks.length)
  for (let len = 3; len <= 13; len++) {
    for (let start = 1; start <= 14 - len + 1; start++) {
      const windowRanks: number[] = [];
      for (let r = start; r < start + len; r++) {
        windowRanks.push(r);
      }

      // Check if all windowRanks exist in naturalCards
      const matchedCards: Card[] = [];
      let allFound = true;
      for (const r of windowRanks) {
        const actualRank = r === 1 ? 14 : r;
        const cardsWithRank = uniqueRankCards.get(actualRank);
        if (!cardsWithRank || cardsWithRank.length === 0) {
          allFound = false;
          break;
        }
        // Grab one card of this rank not already used
        const available = cardsWithRank.find((c) => !matchedCards.some((mc) => mc.id === c.id));
        if (!available) {
          allFound = false;
          break;
        }
        matchedCards.push(available);
      }

      if (allFound && matchedCards.length >= 3) {
        const validation = validateNewMeld(matchedCards);
        if (validation.valid) {
          const key = matchedCards
            .map((c) => c.id)
            .sort()
            .join(',');
          if (!seenCardSets.has(key)) {
            seenCardSets.add(key);
            candidateMelds.push({
              cards: matchedCards,
              type: 'RUN',
              suit,
              isPure: Boolean(validation.isPure),
              score: matchedCards.length * 10 + (validation.isPure ? 50 : 20),
            });
          }
        }
      }

      // 2. Dirty runs using 1 wildcard
      if (wildcards.length > 0) {
        for (const wildcard of wildcards) {
          // Check if window can be satisfied with exactly 1 wildcard substituting
          let missingRank: number | null = null;
          const dirtyMatched: Card[] = [];
          let possible = true;

          for (const r of windowRanks) {
            const actualRank = r === 1 ? 14 : r;
            const cardsWithRank = uniqueRankCards.get(actualRank);
            const available = cardsWithRank?.find(
              (c) => !dirtyMatched.some((mc) => mc.id === c.id)
            );

            if (available) {
              dirtyMatched.push(available);
            } else {
              if (missingRank === null) {
                missingRank = r;
              } else {
                possible = false;
                break;
              }
            }
          }

          if (possible && missingRank !== null) {
            const testCards = [...dirtyMatched, wildcard];
            const validation = validateNewMeld(testCards, missingRank === 1 ? 1 : missingRank);
            if (validation.valid) {
              const key = testCards
                .map((c) => c.id)
                .sort()
                .join(',');
              if (!seenCardSets.has(key)) {
                seenCardSets.add(key);
                candidateMelds.push({
                  cards: testCards,
                  type: 'RUN',
                  suit,
                  isPure: false,
                  score: testCards.length * 10 + 15,
                });
              }
            }
          }
        }
      }
    }
  }

  return candidateMelds;
}

/**
 * Searches for all valid 7+ card sets in hand.
 */
export function findCandidateSets(hand: Card[], wildcards: Card[]): CandidateMeld[] {
  const candidateSets: CandidateMeld[] = [];
  const rankGroups = new Map<number, Card[]>();

  for (const c of hand) {
    if (!isWildcard(c)) {
      const list = rankGroups.get(c.rank) || [];
      list.push(c);
      rankGroups.set(c.rank, list);
    }
  }

  for (const [rank, naturals] of rankGroups.entries()) {
    // Clean set (7+ natural cards)
    if (naturals.length >= 7) {
      const cards = naturals.slice(0, 7);
      candidateSets.push({
        cards,
        type: 'SET',
        rank,
        isPure: true,
        score: 100,
      });
    }
    // Dirty set (6 natural cards + 1 wildcard)
    else if (naturals.length >= 6 && wildcards.length >= 1) {
      const cards = [...naturals.slice(0, 6), wildcards[0]];
      candidateSets.push({
        cards,
        type: 'SET',
        rank,
        isPure: false,
        score: 75,
      });
    }
  }

  return candidateSets;
}

/**
 * Finds all potential new melds from hand, respecting requirePure rule when applicable.
 */
export function findPotentialNewMelds(
  hand: Card[],
  options?: { requirePure?: boolean }
): CandidateMeld[] {
  const wildcards = hand.filter((c) => isWildcard(c));
  const candidateMelds: CandidateMeld[] = [];

  const suits: Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
  for (const suit of suits) {
    const suitedCards = hand.filter((c) => c.suit === suit);
    const runs = findCandidateRunsInSuit(suitedCards, suit, wildcards);
    candidateMelds.push(...runs);
  }

  // Sets are only considered if requirePure is false (Pukar rule: sets cannot be pure opening melds)
  if (!options?.requirePure) {
    const sets = findCandidateSets(hand, wildcards);
    candidateMelds.push(...sets);
  }

  // Filter if requirePure is requested
  if (options?.requirePure) {
    return candidateMelds.filter((m) => m.isPure);
  }

  return candidateMelds;
}

/**
 * Finds cards in hand that can legally be added to existing team melds on table.
 */
export function findPotentialAdditionsToMelds(
  hand: Card[],
  tableMelds: Meld[]
): CandidateAddition[] {
  const additions: CandidateAddition[] = [];

  for (const meld of tableMelds) {
    // 1. Check single card additions
    for (const card of hand) {
      const validation = canAddCardsToMeld(meld, [card]);
      if (validation.valid) {
        additions.push({
          meldId: meld.id,
          cardIds: [card.id],
          cards: [card],
          score: 25,
        });
      }
    }

    // 2. Check 2-card additions (e.g. extending run by two ranks)
    if (hand.length >= 2) {
      for (let i = 0; i < hand.length; i++) {
        for (let j = i + 1; j < hand.length; j++) {
          const pair = [hand[i], hand[j]];
          const validation = canAddCardsToMeld(meld, pair);
          if (validation.valid) {
            additions.push({
              meldId: meld.id,
              cardIds: pair.map((c) => c.id),
              cards: pair,
              score: 55,
            });
          }
        }
      }
    }
  }

  // Sort by score descending (prefer bigger additions)
  return additions.sort((a, b) => b.score - a.score);
}

/**
 * Greedily resolves non-overlapping meld and addition plan for the turn.
 */
export function findBestMeldPlan(
  hand: Card[],
  teamMelds: Meld[],
  options?: { disallowedCardId?: string; preserveDiscardCard?: boolean }
): {
  meldsToPlay: CandidateMeld[];
  additionsToPlay: CandidateAddition[];
  usedCardIds: Set<string>;
} {
  const requirePure = teamMelds.length === 0;
  const potentialMelds = findPotentialNewMelds(hand, { requirePure });
  // Sort candidate melds by score descending
  potentialMelds.sort((a, b) => b.score - a.score);

  const usedCardIds = new Set<string>();
  const meldsToPlay: CandidateMeld[] = [];

  for (const meld of potentialMelds) {
    const hasOverlap = meld.cards.some((c) => usedCardIds.has(c.id));
    if (!hasOverlap) {
      // A single meld action cannot meld all cards in hand
      if (meld.cards.length >= hand.length) {
        continue;
      }

      const potentialUsed = new Set([...usedCardIds, ...meld.cards.map((c) => c.id)]);
      const remainingHand = hand.filter((c) => !potentialUsed.has(c.id));

      if (options?.preserveDiscardCard && remainingHand.length === 0) {
        continue;
      }

      // If a single picked up card cannot legally be discarded,
      // preserve at least 1 other card in hand to be discarded.
      if (options?.disallowedCardId) {
        const remainingNonDisallowed = remainingHand.filter(
          (c) => c.id !== options.disallowedCardId
        );
        if (remainingNonDisallowed.length === 0 && hand.length > 1) {
          continue;
        }
      }

      meldsToPlay.push(meld);
      meld.cards.forEach((c) => usedCardIds.add(c.id));
    }
  }

  // Now evaluate additions from remaining uncommitted hand cards
  const remainingCards = hand.filter((c) => !usedCardIds.has(c.id));
  const potentialAdditions = findPotentialAdditionsToMelds(remainingCards, teamMelds);
  const additionsToPlay: CandidateAddition[] = [];

  for (const add of potentialAdditions) {
    const hasOverlap = add.cards.some((c) => usedCardIds.has(c.id));
    if (!hasOverlap) {
      // A single addition action cannot meld all cards in hand
      if (add.cards.length >= hand.length) {
        continue;
      }

      const potentialUsed = new Set([...usedCardIds, ...add.cards.map((c) => c.id)]);
      const remainingHand = hand.filter((c) => !potentialUsed.has(c.id));

      if (options?.preserveDiscardCard && remainingHand.length === 0) {
        continue;
      }

      if (options?.disallowedCardId) {
        const remainingNonDisallowed = remainingHand.filter(
          (c) => c.id !== options.disallowedCardId
        );
        if (remainingNonDisallowed.length === 0 && hand.length > 1) {
          continue;
        }
      }

      additionsToPlay.push(add);
      add.cards.forEach((c) => usedCardIds.add(c.id));
    }
  }

  return {
    meldsToPlay,
    additionsToPlay,
    usedCardIds,
  };
}

/**
 * Evaluates hand cards not committed to melds, scoring discard viability.
 * Lower score = safer/better to discard.
 * Higher score = valuable/dangerous to discard.
 */
export function evaluateDeadwoodAndDiscard(
  hand: Card[],
  committedCardIds: Set<string>,
  options?: DiscardEvaluationOptions
): {
  deadwood: Card[];
  recommendedDiscard: Card | null;
  discardScores: Array<{ card: Card; score: number; reason: string }>;
} {
  const deadwood = hand.filter((c) => !committedCardIds.has(c.id));
  const pool = deadwood.length > 0 ? deadwood : hand;

  const discardScores = pool.map((card) => {
    // Disallowed card (e.g. single drawn card this turn): strictly forbidden
    if (options?.disallowedCardId && card.id === options.disallowedCardId) {
      return { card, score: 999999, reason: 'Disallowed from discard by rule' };
    }

    // Natural Jokers and Rank 2 wildcards must NEVER be discarded
    if (isWildcard(card)) {
      return { card, score: 9999, reason: 'Wildcard: never discard' };
    }

    let score = 50;
    let reason = 'Normal deadwood card';

    // 1. Synergy bonus: Does this card have adjacent same-suit neighbors in hand?
    const hasNeighbor = hand.some(
      (other) =>
        other.id !== card.id &&
        other.suit === card.suit &&
        Math.abs(other.rank - card.rank) === 1
    );
    if (hasNeighbor) {
      score += 40;
      reason = 'Connected to same-suit neighbor';
    }

    // 2. Fast Chachi extreme run preference:
    // Prefers keeping A, 2, 3 and A, K, Q cards
    if (options?.preferredExtremeRuns) {
      if (card.rank === 14 || card.rank === 3 || card.rank === 13 || card.rank === 12) {
        score += 25;
        reason += ' (Extreme run candidate)';
      }
    }

    // 3. Opponent wants (Smart Chacha prediction)
    const cardKey = card.suit ? `${card.suit}_${card.rank}` : `RANK_${card.rank}`;
    if (options?.opponentWants?.has(cardKey) || options?.opponentWants?.has(card.id)) {
      score += 150;
      reason = 'Opponents predicted to need this card';
    }

    // 4. Partner likely wants (Smart Chacha partner assist)
    if (options?.partnerLikelyWants?.has(cardKey) || options?.partnerLikelyWants?.has(card.id)) {
      // Discarding to pass to partner: reduces discard score so it is favored to discard!
      score -= 60;
      reason = 'Passed to partner via discard pile';
    }

    // 5. Higher ranks (10, J, Q, K) are slightly preferred to discard over low cards if isolated
    if (card.rank >= 10 && !hasNeighbor) {
      score -= 5;
    }

    return { card, score, reason };
  });

  // Sort by score ascending (lowest score = best to discard)
  discardScores.sort((a, b) => a.score - b.score);

  // Filter out legally disallowed discard if any alternative exists in the pool
  const eligibleCandidates = discardScores.filter(
    (ds) => !options?.disallowedCardId || ds.card.id !== options.disallowedCardId
  );

  const recommendedDiscard =
    eligibleCandidates.length > 0
      ? eligibleCandidates[0].card
      : discardScores.length > 0
      ? discardScores[0].card
      : null;

  return {
    deadwood,
    recommendedDiscard,
    discardScores,
  };
}
