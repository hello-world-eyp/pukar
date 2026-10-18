/**
 * Hand Analyzer for AI Bots
 * Evaluates candidate runs, sets, table additions, and discard safety.
 * Pure TypeScript with zero DOM dependencies.
 */
import { Card, Meld, Suit, isNaturalJoker, isWildcard } from '../types';
import { canAddCardsToMeld, doesCardMatchRank, evaluateMeldScore, isPureRun, validateNewMeld } from '../meld-validator';

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
  personality?: 'SMART_CHACHA' | 'THE_JADUGAR' | 'FAST_CHACHI' | 'THE_LONG_TERM_GUY' | 'CHEETAH';
  opponentWants?: Set<string>; // set of "SUIT_RANK" keys, e.g. "SPADES_7" or card IDs
  preferredExtremeRuns?: boolean; // For Fast Chachi: bias towards extreme runs
  partnerLikelyWants?: Set<string>; // For Smart Chacha: cards to pass to partner
  protectedCardIds?: Set<string>; // Cards that can be added to team melds: strictly protect from discard
  teamMelds?: Meld[]; // Existing team melds on table
  opponentMelds?: Meld[]; // Opponent melds on table to prevent feeding
  isCloseToPukar?: boolean; // When true (<= 3 cards), relaxing connector holding to allow discarding out
  isFinalTurn?: boolean;
  nextOpponentCardCount?: number; // Opponent card count (lockdown when <= 2)
  opponentNeedsLockdown?: boolean; // Explicit flag when any opponent has <= 2 cards
  discardPile?: Card[]; // Discard pile to detect exposed connectors that need burying
}

export interface HandEvaluation {
  candidateMelds: CandidateMeld[];
  candidateAdditions: CandidateAddition[];
  deadwood: Card[];
  recommendedDiscard: Card | null;
  discardScores: Array<{ card: Card; score: number; reason: string }>;
}

/**
 * Counts the number of rank 2 cards present in a meld (checking unique card IDs across cards and slots).
 */
export function countTwosInMeld(meld: Meld): number {
  const cardSet = new Set<string>();
  let count = 0;
  if (meld.cards) {
    for (const c of meld.cards) {
      if (c && !cardSet.has(c.id)) {
        cardSet.add(c.id);
        if (c.rank === 2) count++;
      }
    }
  }
  if (meld.slots) {
    for (const s of meld.slots) {
      if (s?.card && !cardSet.has(s.card.id)) {
        cardSet.add(s.card.id);
        if (s.card.rank === 2) count++;
      }
    }
  }
  return count;
}

/**
 * Searches for all valid 3+ card runs in a specific suit given suited cards and available wildcards.
 */
export function findCandidateRunsInSuit(
  suitedCards: Card[],
  suit: Suit,
  wildcards: Card[],
  options?: { isCloseToPukar?: boolean; isFinalTurn?: boolean }
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
        // Strategic wildcard suitability for a run in `suit`:
        // Tier 1: Suited 2 (rank 2, same suit) - highest preference (+50 pts)
        // Tier 2: Natural Joker (isNaturalJoker) - second preference (+30 pts, can be retrieved later)
        // Tier 3: Cross-suit 2 (rank 2, different suit) - ONLY permitted when very close to Pukar
        //         AND no suited 2 or natural joker is available (-60 pts)
        const suited2s = wildcards.filter((c) => c.rank === 2 && c.suit === suit);
        const naturalJokers = wildcards.filter((c) => isNaturalJoker(c));
        const crossSuit2s = wildcards.filter((c) => c.rank === 2 && c.suit !== suit);

        const allowCrossSuit2 =
          (Boolean(options?.isCloseToPukar) || Boolean(options?.isFinalTurn)) &&
          suited2s.length === 0 &&
          naturalJokers.length === 0;

        const eligibleWildcards: Array<{ card: Card; bonus: number }> = [
          ...suited2s.map((c) => ({ card: c, bonus: 50 })),
          ...naturalJokers.map((c) => ({ card: c, bonus: 30 })),
          ...(allowCrossSuit2 ? crossSuit2s.map((c) => ({ card: c, bonus: -60 })) : []),
        ];

        for (const { card: wildcard, bonus } of eligibleWildcards) {
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
            // Rule: All bots should refrain from putting 2 2s in the same sequence.
            // That just leads to a permanent hundred and a waste of jokers.
            if (testCards.filter((c) => c.rank === 2).length > 1) {
              continue;
            }
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
                  score: testCards.length * 10 + 15 + bonus,
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
  options?: { requirePure?: boolean; isCloseToPukar?: boolean; isFinalTurn?: boolean }
): CandidateMeld[] {
  const isCloseToPukar = options?.isCloseToPukar ?? (hand.length <= 3);
  const isFinalTurn = options?.isFinalTurn ?? false;
  const wildcards = hand.filter((c) => isWildcard(c));
  const candidateMelds: CandidateMeld[] = [];

  const suits: Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
  for (const suit of suits) {
    const suitedCards = hand.filter((c) => c.suit === suit);
    const runs = findCandidateRunsInSuit(suitedCards, suit, wildcards, { isCloseToPukar, isFinalTurn });
    candidateMelds.push(...runs);
  }

  // Sets are only considered if requirePure is false (Pukar rule: sets cannot be pure opening melds)
  if (!options?.requirePure) {
    const sets = findCandidateSets(hand, wildcards);
    candidateMelds.push(...sets);
  }

  let melds = candidateMelds;
  // Filter if requirePure is requested
  if (options?.requirePure) {
    melds = melds.filter((m) => m.isPure);
  }

  // Rule: All bots should refrain from putting 2 2s in the same sequence.
  // That just leads to a permanent hundred and a waste of jokers.
  return melds.filter((m) => {
    if (m.type === 'RUN') {
      return m.cards.filter((c) => c.rank === 2).length <= 1;
    }
    return true;
  });
}

/**
 * Evaluates whether a candidate new run should be held in hand rather than played as a separate new meld,
 * because the team already has an existing table sequence in the same suit that these cards can extend.
 *
 * Rule: Playing a fragmented new run (e.g. Q♠-K♠-A♠) when the team already has a run in the same suit
 * (e.g. 5♠-10♠) permanently prevents those cards from joining the larger sequence.
 * The bot should only open the separate sequence if:
 * 1. It is the final turn (dumping deadwood), OR
 * 2. Playing it guarantees Pukar on this turn, OR
 * 3. The bot knows partner has a guaranteed connecting card (e.g. Jack/10) AND partner is close to Pukar.
 * Otherwise, the bot keeps the cards in hand and waits for the connecting card to arrive.
 */
export function shouldHoldNewRunToExtendExistingSequence(
  candidateMeld: CandidateMeld,
  tableMelds: Meld[],
  options?: {
    isFinalTurn?: boolean;
    canGuaranteePukar?: boolean;
    partnerCardCount?: number;
    partnerKnownCards?: Card[];
  }
): boolean {
  if (candidateMeld.type !== 'RUN' || !candidateMeld.suit) {
    return false;
  }
  if (options?.isFinalTurn || options?.canGuaranteePukar) {
    return false;
  }

  const existingRunsInSuit = tableMelds.filter(
    (m) => m.type === 'RUN' && m.suit === candidateMeld.suit
  );
  if (existingRunsInSuit.length === 0) {
    return false;
  }

  // Find the largest existing team run in this suit
  const largestRun = existingRunsInSuit.reduce((max, curr) =>
    curr.cards.length > max.cards.length ? curr : max
  );

  // If the largest run is already maxed out (13 cards), it cannot be extended further
  if (largestRun.cards.length >= 13 || (largestRun.slots && largestRun.slots.length >= 13)) {
    return false;
  }

  const runRanks = largestRun.slots
    ? largestRun.slots
        .map((s) => s.representedRank)
        .filter((r) => r >= 2)
        .sort((a, b) => a - b)
    : largestRun.cards
        .map((c) => c.rank)
        .filter((r) => r >= 2)
        .sort((a, b) => a - b);

  if (runRanks.length === 0) return false;

  const minRunRank = runRanks[0];
  const maxRunRank = runRanks[runRanks.length - 1];

  // Get candidate meld ranks (either natural or represented via validation)
  const validation = validateNewMeld(candidateMeld.cards);
  const candidateRanks = validation.valid && validation.slots
    ? validation.slots.map((s) => s.representedRank).sort((a, b) => a - b)
    : candidateMeld.cards
        .map((c) => c.rank)
        .filter((r) => r >= 2)
        .sort((a, b) => a - b);

  if (candidateRanks.length === 0) return false;

  const minCandidateRank = candidateRanks[0];
  const maxCandidateRank = candidateRanks[candidateRanks.length - 1];

  let gap = Infinity;
  const missingRanks: number[] = [];

  if (minCandidateRank > maxRunRank) {
    // Candidate is higher in rank than largestRun (e.g. Q-K-A [12-14] vs 5-10)
    gap = minCandidateRank - maxRunRank - 1;
    for (let r = maxRunRank + 1; r < minCandidateRank; r++) {
      missingRanks.push(r);
    }
  } else if (maxCandidateRank < minRunRank) {
    // Candidate is lower in rank than largestRun (e.g. 3-5 vs 7-10)
    gap = minRunRank - maxCandidateRank - 1;
    for (let r = maxCandidateRank + 1; r < minRunRank; r++) {
      missingRanks.push(r);
    }
  } else {
    // Overlapping ranks: duplicate cards in the same suit
    return false;
  }

  // If gap is 0, cards directly connect to the existing sequence!
  // They should be added via ADD_TO_MELD in additions phase, never as a separate new meld.
  if (gap === 0) {
    return true;
  }

  // If gap is within connecting distance (gap <= 2, or gap <= 3 if existing run is substantial >= 6 cards):
  const maxAllowedGap = largestRun.cards.length >= 6 ? 3 : 2;
  if (gap <= maxAllowedGap) {
    const isPartnerCloseToPukar =
      options?.partnerCardCount !== undefined && options.partnerCardCount <= 3;
    const partnerHasConnectingCard = (options?.partnerKnownCards || []).some(
      (c) =>
        (c.suit === candidateMeld.suit && missingRanks.includes(c.rank)) ||
        isWildcard(c)
    );

    // Only open if partner has guaranteed connecting card AND is close to Pukar
    if (isPartnerCloseToPukar && partnerHasConnectingCard) {
      return false; // Allowed to open
    }

    // Otherwise, hold cards in hand and wait for connecting card
    return true;
  }

  return false;
}

/**
 * Finds cards in hand that can legally be added to existing team melds on table.
 */
export function findPotentialAdditionsToMelds(
  hand: Card[],
  tableMelds: Meld[],
  options?: { isCloseToPukar?: boolean; isFinalTurn?: boolean; canGuaranteePukar?: boolean }
): CandidateAddition[] {
  const isCloseToPukar = options?.isCloseToPukar ?? (hand.length <= 3);
  const isFinalTurn = options?.isFinalTurn ?? false;
  const hasNaturalJokerInHand = hand.some((c) => isNaturalJoker(c));
  const additions: CandidateAddition[] = [];

  for (const meld of tableMelds) {
    const isCleanRun =
      meld.type === 'RUN' &&
      meld.isClean !== false &&
      (!meld.slots || !meld.slots.some((s) => s.isWildcard));

    // 1. Check single card additions
    for (const card of hand) {
      // Rule: All bots should refrain from putting 2 2s in the same sequence.
      // That just leads to a permanent hundred and a waste of jokers.
      if (meld.type === 'RUN' && card.rank === 2 && countTwosInMeld(meld) >= 1) {
        continue;
      }

      // Disallow using cross-suit 2 in a run unless:
      // 1. Very close to Pukar (<= 3 cards) or Pukar guaranteed
      // 2. The run is NOT clean (never taint clean sequences and forfeit Clean 7 / Pure 13)
      // 3. No Natural Joker is available in hand (prefer Natural Joker whenever 2 suit doesn't match)
      if (
        meld.type === 'RUN' &&
        meld.suit &&
        card.rank === 2 &&
        card.suit !== meld.suit
      ) {
        if ((!isCloseToPukar && !options?.canGuaranteePukar && !isFinalTurn) || isCleanRun || hasNaturalJokerInHand) {
          continue;
        }
      }

      // Guard: Do not add wildcards (Natural Jokers or 2s) to clean runs unless close to Pukar or Pukar is guaranteed this turn or in final turn.
      // Preserves 200-pt Clean 7 and 500-pt Pure 13 opportunities.
      if (
        meld.type === 'RUN' &&
        isCleanRun &&
        meld.cards.length >= 5 &&
        !isCloseToPukar &&
        !options?.canGuaranteePukar &&
        !isFinalTurn &&
        isNaturalJoker(card)
      ) {
        continue;
      }

      const validation = canAddCardsToMeld(meld, [card]);
      if (validation.valid && validation.updatedSlots) {
        // Evaluate score impact
        const scoreBefore = evaluateMeldScore(meld).points;
        const updatedMeld: Meld = {
          ...meld,
          cards: [...meld.cards, card],
          slots: validation.updatedSlots,
        };
        const scoreAfter = evaluateMeldScore(updatedMeld).points;

        // Rule: Never reduce a sequence's points (e.g. from 200 to 100 or 500 to 100)
        // unless Pukar / completion is guaranteed this turn.
        if (scoreAfter < scoreBefore && !options?.canGuaranteePukar) {
          continue;
        }

        // If adding this card would make a 5- or 6-card clean run dirty, disallow it
        // unless close to Pukar or Pukar is guaranteed this turn or in final turn
        if (
          meld.type === 'RUN' &&
          isCleanRun &&
          meld.cards.length >= 5 &&
          !isCloseToPukar &&
          !options?.canGuaranteePukar &&
          !isFinalTurn
        ) {
          const wouldMakeDirty = validation.updatedSlots.some((s) => s.isWildcard);
          if (wouldMakeDirty) {
            continue;
          }
        }

        let score = 25;
        if (meld.type === 'RUN' && meld.suit) {
          if (card.rank === 2 && card.suit === meld.suit) {
            score = 50; // Suited 2 highly preferred!
          } else if (isNaturalJoker(card)) {
            score = 35; // Natural Joker preferred over cross-suit
          } else if (card.rank === 2 && card.suit !== meld.suit) {
            score = 5; // Cross-suit 2 given lowest priority
          }
        }
        if (validation.pickedUpCard) {
          score += 150;
        }
        additions.push({
          meldId: meld.id,
          cardIds: [card.id],
          cards: [card],
          score,
        });
      }
    }

    // 2. Check 2-card additions (e.g. extending run by two ranks)
    if (hand.length >= 2) {
      for (let i = 0; i < hand.length; i++) {
        for (let j = i + 1; j < hand.length; j++) {
          const pair = [hand[i], hand[j]];
          // Rule: All bots should refrain from putting 2 2s in the same sequence.
          // That just leads to a permanent hundred and a waste of jokers.
          if (meld.type === 'RUN') {
            const existing2s = countTwosInMeld(meld);
            const added2s = pair.filter((c) => c.rank === 2).length;
            if (existing2s + added2s > 1) {
              continue;
            }
          }

          if (
            meld.type === 'RUN' &&
            meld.suit &&
            pair.some((c) => c.rank === 2 && c.suit !== meld.suit)
          ) {
            if ((!isCloseToPukar && !options?.canGuaranteePukar && !isFinalTurn) || isCleanRun || hasNaturalJokerInHand) {
              continue;
            }
          }

          if (
            meld.type === 'RUN' &&
            isCleanRun &&
            meld.cards.length >= 5 &&
            !isCloseToPukar &&
            !options?.canGuaranteePukar &&
            !isFinalTurn &&
            pair.some((c) => isNaturalJoker(c))
          ) {
            continue;
          }

          const validation = canAddCardsToMeld(meld, pair);
          if (validation.valid && validation.updatedSlots) {
            // Evaluate score impact
            const scoreBefore = evaluateMeldScore(meld).points;
            const updatedMeld: Meld = {
              ...meld,
              cards: [...meld.cards, ...pair],
              slots: validation.updatedSlots,
            };
            const scoreAfter = evaluateMeldScore(updatedMeld).points;

            // Rule: Never reduce a sequence's points (e.g. from 200 to 100 or 500 to 100)
            // unless Pukar / completion is guaranteed this turn.
            if (scoreAfter < scoreBefore && !options?.canGuaranteePukar) {
              continue;
            }

            if (
              meld.type === 'RUN' &&
              isCleanRun &&
              meld.cards.length >= 5 &&
              !isCloseToPukar &&
              !options?.canGuaranteePukar &&
              !isFinalTurn
            ) {
              const wouldMakeDirty = validation.updatedSlots.some((s) => s.isWildcard);
              if (wouldMakeDirty) {
                continue;
              }
            }

            let score = 55;
            if (meld.type === 'RUN' && meld.suit) {
              if (pair.some((c) => c.rank === 2 && c.suit === meld.suit)) {
                score += 25;
              }
              if (pair.some((c) => c.rank === 2 && c.suit !== meld.suit)) {
                score -= 40;
              }
            }
            if (validation.pickedUpCard) {
              score += 150;
            }
            additions.push({
              meldId: meld.id,
              cardIds: pair.map((c) => c.id),
              cards: pair,
              score,
            });
          }
        }
      }
    }
  }

  // Sort by score descending (prefer bigger and strategically suited additions)
  return additions.sort((a, b) => b.score - a.score);
}

/**
 * Recursively searches for a sequence of additions that can bring a team meld to targetCount
 * (e.g. 7 cards for Clean 7 / Dirty 7 completion, or 13 cards for Pure 13).
 */
function findCompletionSequence(
  simMeld: Meld,
  availableCards: Card[],
  fullHand: Card[],
  usedCardIds: Set<string>,
  targetCount: number,
  options?: {
    disallowedCardId?: string;
    preserveDiscardCard?: boolean;
    isCloseToPukar?: boolean;
    isFinalTurn?: boolean;
    canGuaranteePukar?: boolean;
  },
  depth = 0
): CandidateAddition[] | null {
  if (simMeld.cards.length >= targetCount) {
    return [];
  }
  if (depth >= 5) {
    return null;
  }

  const remainingAvailable = availableCards.filter((c) => !usedCardIds.has(c.id));
  if (options?.preserveDiscardCard && remainingAvailable.length <= 1) {
    return null;
  }

  const adds = findPotentialAdditionsToMelds(remainingAvailable, [simMeld], {
    isCloseToPukar: options?.isCloseToPukar,
    isFinalTurn: options?.isFinalTurn,
    canGuaranteePukar: options?.canGuaranteePukar,
  });
  if (adds.length === 0) {
    return null;
  }

  for (const add of adds) {
    if (add.cards.some((c) => usedCardIds.has(c.id))) continue;
    if (add.cards.length >= fullHand.length) continue;

    const potentialUsed = new Set([...usedCardIds, ...add.cards.map((c) => c.id)]);
    const remainingHand = fullHand.filter((c) => !potentialUsed.has(c.id));

    if (options?.preserveDiscardCard && remainingHand.length === 0) {
      continue;
    }
    if (options?.disallowedCardId) {
      const remainingNonDisallowed = remainingHand.filter(
        (c) => c.id !== options.disallowedCardId
      );
      if (remainingNonDisallowed.length === 0 && fullHand.length > 1) {
        continue;
      }
    }

    const validation = canAddCardsToMeld(simMeld, add.cards);
    if (!validation.valid || !validation.updatedSlots) continue;

    const nextMeld: Meld = {
      ...simMeld,
      cards: [...simMeld.cards, ...add.cards],
      slots: validation.updatedSlots,
    };

    const nextUsed = new Set([...usedCardIds, ...add.cards.map((c) => c.id)]);
    const subResult = findCompletionSequence(
      nextMeld,
      availableCards,
      fullHand,
      nextUsed,
      targetCount,
      options,
      depth + 1
    );

    if (subResult !== null) {
      return [add, ...subResult];
    }
  }

  return null;
}

/**
 * Internal implementation of meld and addition plan resolution.
 */
function internalFindBestMeldPlan(
  hand: Card[],
  teamMelds: Meld[],
  options?: {
    disallowedCardId?: string;
    preserveDiscardCard?: boolean;
    isCloseToPukar?: boolean;
    isFinalTurn?: boolean;
    allTableMelds?: Meld[];
    requirePure?: boolean;
    canGuaranteePukar?: boolean;
    partnerKnownCards?: Card[];
    partnerCardCount?: number;
  }
): {
  meldsToPlay: CandidateMeld[];
  additionsToPlay: CandidateAddition[];
  usedCardIds: Set<string>;
} {
  const isCloseToPukar = options?.isCloseToPukar ?? (hand.length <= 3);
  const isFinalTurn = options?.isFinalTurn ?? false;
  const isTeamOpen = teamMelds.length > 0 || teamMelds.some((m) => m.isPure);
  const requirePure = options?.requirePure !== undefined ? options.requirePure : !isTeamOpen;

  const usedCardIds = new Set<string>();
  const meldsToPlay: CandidateMeld[] = [];
  const additionsToPlay: CandidateAddition[] = [];
  const virtualMelds: Meld[] = teamMelds.map((m) => ({
    ...m,
    cards: [...m.cards],
    slots: [...m.slots],
  }));

  // PRIORITY 1: Check if any candidate table additions can bring an existing team run or set
  // to >= 7 cards (or 13 cards for Pure 13). If so, prioritize and commit those additions first (+200 or +500 pts).
  for (let i = 0; i < virtualMelds.length; i++) {
    const currentMeld = virtualMelds[i];
    const initialCount = currentMeld.cards.length;
    let targetCount: number | null = null;
    if (currentMeld.type === 'SET') {
      if (initialCount < 7) {
        targetCount = 7;
      }
    } else if (currentMeld.type === 'RUN') {
      if (initialCount < 7) {
        targetCount = 7;
      } else if (initialCount < 13 && currentMeld.isClean) {
        targetCount = 13;
      }
    }

    if (targetCount === null) continue;

    const completionAdds = findCompletionSequence(
      currentMeld,
      hand,
      hand,
      usedCardIds,
      targetCount,
      options
    );

    if (completionAdds && completionAdds.length > 0) {
      for (const add of completionAdds) {
        additionsToPlay.push(add);
        add.cards.forEach((c) => usedCardIds.add(c.id));

        const targetMeldIndex = virtualMelds.findIndex((m) => m.id === add.meldId);
        if (targetMeldIndex >= 0) {
          const targetMeld = virtualMelds[targetMeldIndex];
          const validation = canAddCardsToMeld(targetMeld, add.cards);
          if (validation.valid && validation.updatedSlots) {
            const meldCardsWithoutPickedUp = validation.pickedUpCard
              ? targetMeld.cards.filter((c) => c.id !== validation.pickedUpCard!.id)
              : targetMeld.cards;
            virtualMelds[targetMeldIndex] = {
              ...targetMeld,
              cards: [...meldCardsWithoutPickedUp, ...add.cards],
              slots: validation.updatedSlots,
            };
          }
        }
      }
    }
  }

  // PRIORITY 2: Form new candidate melds from remaining uncommitted hand cards.
  const stageCandidateMelds = (candidates: CandidateMeld[]) => {
    for (const meld of candidates) {
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

        // Do not open a separate fragmented sequence if the team already has a table run in the same suit
        // that these cards can extend, unless final turn, guaranteed Pukar, or partner is close to Pukar with connecting card.
        if (
          shouldHoldNewRunToExtendExistingSequence(meld, virtualMelds, {
            isFinalTurn,
            canGuaranteePukar: options?.canGuaranteePukar,
            partnerCardCount: options?.partnerCardCount,
            partnerKnownCards: options?.partnerKnownCards,
          })
        ) {
          continue;
        }

        meldsToPlay.push(meld);
        meld.cards.forEach((c) => usedCardIds.add(c.id));
      }
    }
  };

  const remainingHandForMelds = hand.filter((c) => !usedCardIds.has(c.id));
  const potentialMelds = findPotentialNewMelds(remainingHandForMelds, {
    requirePure,
    isCloseToPukar,
    isFinalTurn,
  });
  // Sort candidate melds: pure melds always take precedence over dirty melds, then by score descending
  potentialMelds.sort((a, b) => {
    if (a.isPure && !b.isPure) return -1;
    if (!a.isPure && b.isPure) return 1;
    return b.score - a.score;
  });
  stageCandidateMelds(potentialMelds);

  // If opening turn (requirePure was true) and at least one pure meld was successfully staged,
  // the opening requirement is satisfied! Run a second pass with requirePure = false so remaining
  // uncommitted cards can legally form dirty melds and sets in the same turn.
  if (requirePure && meldsToPlay.some((m) => m.isPure)) {
    const remainingHandForDirty = hand.filter((c) => !usedCardIds.has(c.id));
    const dirtyMelds = findPotentialNewMelds(remainingHandForDirty, {
      requirePure: false,
      isCloseToPukar,
      isFinalTurn,
    });
    dirtyMelds.sort((a, b) => b.score - a.score);
    stageCandidateMelds(dirtyMelds);
  }


  // PRIORITY 3: Now evaluate additions from remaining uncommitted hand cards iteratively
  // so multi-card sequence extensions (e.g. 8♠, 9♠, 10♠) can be played in full
  for (let iter = 0; iter < 10; iter++) {
    const remainingCards = hand.filter((c) => !usedCardIds.has(c.id));
    if (options?.preserveDiscardCard && remainingCards.length <= 1) {
      break;
    }

    const potentialAdditions = findPotentialAdditionsToMelds(
      remainingCards,
      virtualMelds,
      { isCloseToPukar, isFinalTurn, canGuaranteePukar: options?.canGuaranteePukar }
    );
    if (potentialAdditions.length === 0) {
      break;
    }

    let addedInIter = false;
    for (const add of potentialAdditions) {
      const hasOverlap = add.cards.some((c) => usedCardIds.has(c.id));
      if (hasOverlap) continue;

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

      const targetMeldIndex = virtualMelds.findIndex((m) => m.id === add.meldId);
      if (targetMeldIndex >= 0) {
        const targetMeld = virtualMelds[targetMeldIndex];
        // Rule: All bots should refrain from putting 2 2s in the same sequence.
        // That just leads to a permanent hundred and a waste of jokers.
        if (targetMeld.type === 'RUN') {
          const existing2s = countTwosInMeld(targetMeld);
          const added2s = add.cards.filter((c) => c.rank === 2).length;
          if (existing2s + added2s > 1) {
            continue;
          }
        }

        const validation = canAddCardsToMeld(targetMeld, add.cards);
        if (validation.valid && validation.updatedSlots) {
          const scoreBefore = evaluateMeldScore(targetMeld).points;
          const meldCardsWithoutPickedUp = validation.pickedUpCard
            ? targetMeld.cards.filter((c) => c.id !== validation.pickedUpCard!.id)
            : targetMeld.cards;
          const nextVirtualMeld: Meld = {
            ...targetMeld,
            cards: [...meldCardsWithoutPickedUp, ...add.cards],
            slots: validation.updatedSlots,
          };
          const scoreAfter = evaluateMeldScore(nextVirtualMeld).points;
          if (scoreAfter < scoreBefore && !options?.canGuaranteePukar) {
            continue;
          }

          virtualMelds[targetMeldIndex] = nextVirtualMeld;
          additionsToPlay.push(add);
          add.cards.forEach((c) => usedCardIds.add(c.id));
        }
      }

      addedInIter = true;
      break;
    }

    if (!addedInIter) {
      break;
    }
  }

  return {
    meldsToPlay,
    additionsToPlay,
    usedCardIds,
  };
}

/**
 * Greedily resolves non-overlapping meld and addition plan for the turn.
 * Guarantees that no sequence will have its points reduced (e.g. from 200 to 100)
 * unless a Pukar / completion is guaranteed on this turn.
 */
export function findBestMeldPlan(
  hand: Card[],
  teamMelds: Meld[],
  options?: {
    disallowedCardId?: string;
    preserveDiscardCard?: boolean;
    isCloseToPukar?: boolean;
    isFinalTurn?: boolean;
    allTableMelds?: Meld[];
    requirePure?: boolean;
    canGuaranteePukar?: boolean;
    partnerKnownCards?: Card[];
    partnerCardCount?: number;
  }
): {
  meldsToPlay: CandidateMeld[];
  additionsToPlay: CandidateAddition[];
  usedCardIds: Set<string>;
} {
  if (options?.canGuaranteePukar !== undefined) {
    return internalFindBestMeldPlan(hand, teamMelds, options);
  }

  // 1. Safe plan: never reduce points of any sequence (e.g. 200 -> 100 or 500 -> 100)
  const safePlan = internalFindBestMeldPlan(hand, teamMelds, {
    ...options,
    canGuaranteePukar: false,
  });

  const remainingSafeHand = hand.filter((c) => !safePlan.usedCardIds.has(c.id));
  const isSafePukar =
    remainingSafeHand.length === 1 &&
    (!options?.disallowedCardId || remainingSafeHand[0].id !== options.disallowedCardId);

  if (isSafePukar) {
    return safePlan;
  }

  // 2. Speculative Pukar plan: check if allowing point-reducing additions guarantees Pukar this turn
  const pukarPlan = internalFindBestMeldPlan(hand, teamMelds, {
    ...options,
    canGuaranteePukar: true,
  });

  const remainingPukarHand = hand.filter((c) => !pukarPlan.usedCardIds.has(c.id));
  const isPukarGuaranteed =
    remainingPukarHand.length === 1 &&
    (!options?.disallowedCardId || remainingPukarHand[0].id !== options.disallowedCardId);

  if (isPukarGuaranteed) {
    return pukarPlan;
  }

  return safePlan;
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
  const isCloseToPukar = options?.isCloseToPukar ?? (hand.length <= 3);
  const isFinalTurn = options?.isFinalTurn ?? false;

  const isLockdown =
    options?.personality !== 'CHEETAH' &&
    ((options?.nextOpponentCardCount !== undefined && options.nextOpponentCardCount <= 2) ||
      Boolean(options?.opponentNeedsLockdown));

  const topDiscard =
    options?.discardPile && options.discardPile.length > 0
      ? options.discardPile[options.discardPile.length - 1]
      : null;

  const hasConnectingCardOnDiscard = isDiscardPileTopConnecting(
    topDiscard,
    hand,
    options?.teamMelds,
    options?.opponentMelds,
    options?.opponentWants
  );

  const shouldBury = isLockdown || hasConnectingCardOnDiscard;

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

    // 1. Team Table Melds: Can this card be added to an existing team meld or sequence?
    const cardKey = card.suit ? `${card.suit}_${card.rank}` : `RANK_${card.rank}`;
    const isExplicitPartnerPass = Boolean(
      options?.partnerLikelyWants?.has(cardKey) ||
        (card.id && options?.partnerLikelyWants?.has(card.id))
    );

    const isDirectTeamAdd =
      !isExplicitPartnerPass &&
      (options?.protectedCardIds?.has(card.id) ||
        (options?.teamMelds &&
          options.teamMelds.some((m) => {
            if (m.type === 'RUN' && card.rank === 2 && countTwosInMeld(m) >= 1) {
              return false;
            }
            return canAddCardsToMeld(m, [card]).valid;
          })));
    if (isDirectTeamAdd) {
      score += 300;
      reason = 'Can be added to team sequence (protected from discard)';
    }

    // 2. Team Table Melds: Open-end neighbor (adjacent to a team run on table)
    let isTeamMeldNeighbor = false;
    if (!isExplicitPartnerPass && options?.teamMelds && card.suit) {
      for (const meld of options.teamMelds) {
        if (meld.type === 'RUN' && meld.suit === card.suit) {
          const ranks = meld.slots.map((s) => s.representedRank).sort((a, b) => a - b);
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
    if (isTeamMeldNeighbor) {
      score += 180;
      reason = 'Connects to open end of team table sequence';
    }

    // 3. Opponent Table Melds: Does this card feed or extend opponent sequences/sets on table?
    let feedsOpponentMeld = false;
    let completesOpponentPure13 = false;
    let completesOpponentClean7 = false;
    let completesOpponent7 = false;

    if (options?.opponentMelds) {
      for (const oppMeld of options.opponentMelds) {
        const validation = canAddCardsToMeld(oppMeld, [card]);
        if (validation.valid && validation.updatedSlots) {
          feedsOpponentMeld = true;
          const currentScore = evaluateMeldScore(oppMeld);
          const oppMeldCards = oppMeld.cards || oppMeld.slots?.map((s) => s.card) || [];
          const meldCardsWithoutPickedUp = validation.pickedUpCard
            ? oppMeldCards.filter((c) => c.id !== validation.pickedUpCard!.id)
            : oppMeldCards;
          const nextScore = evaluateMeldScore({
            ...oppMeld,
            cards: [...meldCardsWithoutPickedUp, card],
            slots: validation.updatedSlots,
          });

          if (
            (nextScore.points === 500 && currentScore.points < 500) ||
            (validation.updatedSlots.length === 13 && oppMeld.type === 'RUN' && nextScore.isPure13)
          ) {
            completesOpponentPure13 = true;
            break;
          } else if (nextScore.points === 200 && currentScore.points < 200) {
            completesOpponentClean7 = true;
          } else if (nextScore.isComplete7 && !currentScore.isComplete7) {
            completesOpponent7 = true;
          }
        }
        if (oppMeld.type === 'RUN' && card.suit && oppMeld.suit === card.suit) {
          const ranks = oppMeld.slots.map((s) => s.representedRank).sort((a, b) => a - b);
          if (ranks.length > 0) {
            const minR = ranks[0];
            const maxR = ranks[ranks.length - 1];
            if (
              card.rank === minR - 1 ||
              card.rank === maxR + 1 ||
              (card.rank === 14 && minR === 2)
            ) {
              feedsOpponentMeld = true;
              if (ranks.length === 12 && (oppMeld.isClean || !oppMeld.slots.some((s) => s.isWildcard))) {
                completesOpponentPure13 = true;
                break;
              } else if (ranks.length === 6) {
                if (oppMeld.isClean || !oppMeld.slots.some((s) => s.isWildcard)) {
                  completesOpponentClean7 = true;
                } else {
                  completesOpponent7 = true;
                }
              }
            }
          }
        } else if (oppMeld.type === 'SET') {
          const setRank =
            oppMeld.rank ??
            oppMeld.slots.find((s) => !s.isWildcard)?.representedRank ??
            oppMeld.cards?.find((c) => !isWildcard(c))?.rank;
          if (setRank !== undefined && card.rank === setRank) {
            feedsOpponentMeld = true;
            if (oppMeld.slots.length === 6) {
              const hasWildcard = oppMeld.slots.some((s) => s.isWildcard) || isWildcard(card);
              if (hasWildcard) {
                completesOpponent7 = true;
              } else {
                completesOpponentClean7 = true;
              }
            }
          }
        }
      }
    }

    if (completesOpponentPure13) {
      score += 50000;
      reason = 'Critical milestone denial: completes opponent 500-point Pure 13';
    } else if (completesOpponentClean7) {
      score += (options?.personality === 'CHEETAH' && isCloseToPukar) ? 60 : 2500;
      reason = (options?.personality === 'CHEETAH' && isCloseToPukar)
        ? 'Cheetah aggressive rush: completes opponent 200-point Clean 7'
        : 'Milestone denial: completes opponent 200-point Clean 7';
    } else if (completesOpponent7) {
      score += (options?.personality === 'CHEETAH' && isCloseToPukar) ? 30 : 1200;
      reason = (options?.personality === 'CHEETAH' && isCloseToPukar)
        ? 'Cheetah aggressive rush: completes opponent 7-card sequence/set'
        : 'Milestone denial: completes opponent 7-card sequence/set';
    } else if (feedsOpponentMeld) {
      if (isLockdown) {
        score += 500;
        reason = 'Strict lockdown: feeds or connects to opponent table melds';
      } else if (options?.personality === 'CHEETAH' && isCloseToPukar) {
        score += 20;
        reason = 'Cheetah aggressive rush: feeds opponent sequence';
      } else {
        score += 150;
        reason = 'Feeds opponent sequence on table (denial protection)';
      }
    }

    // 4. Opponent Wants prediction (Smart Chacha memory prediction)
    const isOpponentWant = Boolean(
      options?.opponentWants?.has(cardKey) ||
      options?.opponentWants?.has(card.id) ||
      options?.opponentWants?.has(`RANK_${card.rank}`)
    );
    if (isOpponentWant) {
      if (isLockdown) {
        score += 500;
        reason = 'Strict lockdown: opponent on <= 2 cards, predicted want';
      } else if (options?.personality === 'CHEETAH' && isCloseToPukar) {
        score += 20;
        reason = 'Cheetah aggressive rush: opponent want tolerated for Pukar rush';
      } else {
        score += 160;
        reason = 'Opponents predicted to need this card';
      }
    }

    // 5. Connecting Cards in Hand:
    // a. Direct adjacent neighbor (difference 1 in same suit)
    const hasAdjacentNeighbor = hand.some(
      (other) =>
        other.id !== card.id &&
        other.suit === card.suit &&
        Math.abs(other.rank - card.rank) === 1
    );
    if (hasAdjacentNeighbor) {
      score += 70;
      reason = 'Connected to same-suit adjacent card';
    }

    // b. Inside-run gap neighbor (difference 2 in same suit, or Ace with 3)
    const hasGapNeighbor = hand.some(
      (other) =>
        other.id !== card.id &&
        other.suit === card.suit &&
        (Math.abs(other.rank - card.rank) === 2 ||
          (card.rank === 14 && other.rank === 3) ||
          (card.rank === 3 && other.rank === 14))
    );
    if (hasGapNeighbor) {
      score += 45;
      reason = hasAdjacentNeighbor ? reason : 'Connected to same-suit gap card';
    }

    // c. Pair or Triplet in hand (same rank)
    const sameRankCount = hand.filter(
      (other) => other.id !== card.id && other.rank === card.rank && !isWildcard(other)
    ).length;
    if (sameRankCount >= 2) {
      score += 85;
      reason = 'Part of triplet/set in hand';
    } else if (sameRankCount === 1) {
      score += 55;
      reason = hasAdjacentNeighbor ? reason : 'Part of pair in hand';
    }

    // d. Rank 4 low-sequence bridge protection:
    // 4 is a critical connector for low sequences (A-2-3-4-5) and sets of 4s
    if (card.rank === 4) {
      const connectsLowRun = hand.some(
        (other) =>
          other.id !== card.id &&
          other.suit === card.suit &&
          (other.rank === 2 || other.rank === 3 || other.rank === 5 || other.rank === 6)
      );
      if (connectsLowRun) {
        score += 50;
        reason = 'Rank 4 bridge for low sequence';
      }
    }

    // e. Fast Chachi extreme run preference (A-2-3-4-5 and 10-J-Q-K-A):
    if (options?.preferredExtremeRuns) {
      if (
        card.rank === 14 ||
        card.rank === 3 ||
        card.rank === 4 ||
        card.rank === 5 ||
        card.rank === 13 ||
        card.rank === 12 ||
        card.rank === 11
      ) {
        score += 35;
        reason += ' (Extreme run candidate)';
      }
    }

    // 6. Connecting Cards Preservation when NOT close to Pukar:
    // "not giving connecting cards on the discard pile easily unless reaching close to a pukar"
    const hasAnyConnection =
      !isExplicitPartnerPass &&
      (hasAdjacentNeighbor ||
        hasGapNeighbor ||
        sameRankCount > 0 ||
        isDirectTeamAdd ||
        isTeamMeldNeighbor);

    if (!isCloseToPukar && !isFinalTurn && hasAnyConnection) {
      score += 60; // Strong penalty against discarding connecting cards when not close to Pukar!
    }

    // 7. Partner likely wants (Smart Chacha partner assist):
    // Only applied if card is NOT protected from discard
    if (
      !isDirectTeamAdd &&
      !isTeamMeldNeighbor &&
      (options?.partnerLikelyWants?.has(cardKey) || options?.partnerLikelyWants?.has(card.id))
    ) {
      score -= 80;
      reason = 'Passed to partner via discard pile';
    }

    // 8. Completely Irrelevant Deadwood (Buries connectors & safe lockdown discard):
    const isCompletelyIrrelevantDeadwood =
      !isExplicitPartnerPass &&
      !hasAnyConnection &&
      !feedsOpponentMeld &&
      !isOpponentWant &&
      !isWildcard(card);

    if (shouldBury && isCompletelyIrrelevantDeadwood) {
      score -= 60;
      reason = 'Completely irrelevant deadwood (buries connector for partner / lockdown)';
    }

    // 9. Isolated high deadwood (ranks 10-K with zero connections and not feeding opponents):
    if (!hasAnyConnection && !feedsOpponentMeld && !isOpponentWant && card.rank >= 10) {
      score -= 10;
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

/**
 * Checks whether a card adds value to sequences (runs) in hand or on the table.
 * Used by The Long-Term Guy to avoid bloating hand with unhelpful deadwood or cross-suit pairs.
 */
export function isCardValuableForSequences(
  card: Card,
  hand: Card[],
  teamMelds: Meld[] = []
): boolean {
  // Wildcards always add value to sequences
  if (isWildcard(card) || isNaturalJoker(card) || card.rank === 2) {
    return true;
  }

  if (!card.suit) return false;

  // 1. Direct or adjacent extension to existing team RUN melds on table
  for (const meld of teamMelds) {
    if (meld.type === 'RUN' && meld.suit === card.suit) {
      const addCheck = canAddCardsToMeld(meld, [card]);
      if (addCheck.valid) {
        return true;
      }
      const ranks = meld.slots.map((s) => s.representedRank).sort((a, b) => a - b);
      if (ranks.length > 0) {
        const minR = ranks[0];
        const maxR = ranks[ranks.length - 1];
        if (Math.abs(card.rank - minR) <= 2 || Math.abs(card.rank - maxR) <= 2) {
          return true;
        }
        if ((card.rank === 14 && minR <= 3) || (card.rank === 3 && minR === 1)) {
          return true;
        }
      }
    }
  }

  // 2. Same-suit consecutive or near-consecutive connection with cards in hand
  const sameSuitCards = hand.filter((h) => !isWildcard(h) && h.suit === card.suit);
  for (const h of sameSuitCards) {
    if (Math.abs(h.rank - card.rank) === 1) {
      return true;
    }
    if (Math.abs(h.rank - card.rank) === 2) {
      return true;
    }
    if ((h.rank === 14 && card.rank === 3) || (card.rank === 14 && h.rank === 3)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether a card connects with cards in hand or team table melds.
 * Connecting cards form pairs/sets, same-suit runs or near-runs, or directly extend team melds.
 */
export function isCardConnecting(
  card: Card,
  hand: Card[],
  teamMelds: Meld[] = []
): boolean {
  // Wildcards always connect
  if (isWildcard(card) || isNaturalJoker(card) || card.rank === 2) {
    return true;
  }

  // 1. Direct or adjacent extension to team melds on table
  for (const meld of teamMelds) {
    const addCheck = canAddCardsToMeld(meld, [card]);
    if (addCheck.valid) {
      return true;
    }
    if (meld.type === 'RUN' && meld.suit === card.suit) {
      const ranks = meld.slots.map((s) => s.representedRank).sort((a, b) => a - b);
      if (ranks.length > 0) {
        const minR = ranks[0];
        const maxR = ranks[ranks.length - 1];
        if (Math.abs(card.rank - minR) <= 2 || Math.abs(card.rank - maxR) <= 2) {
          return true;
        }
        if ((card.rank === 14 && minR <= 3) || (card.rank === 3 && minR === 1)) {
          return true;
        }
      }
    }
    if (meld.type === 'SET' && meld.rank && doesCardMatchRank(card.rank, meld.rank)) {
      return true;
    }
  }

  // 2. Pair or Run connection with cards in hand
  for (const h of hand) {
    if (isWildcard(h) || isNaturalJoker(h) || h.rank === 2) continue;
    // Same rank forms a pair / potential set
    if (h.rank === card.rank) {
      return true;
    }
    // Same suit consecutive or near-consecutive forms run potential
    if (h.suit && card.suit && h.suit === card.suit) {
      if (Math.abs(h.rank - card.rank) <= 2) {
        return true;
      }
      // Ace with 3 (rank 1-2-3 run)
      if ((h.rank === 14 && card.rank === 3) || (card.rank === 14 && h.rank === 3)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Determines whether the top card of the discard pile is a connecting card or wildcard.
 * When true, bots bury the card under safe deadwood to prevent opponents from scooping it.
 */
export function isDiscardPileTopConnecting(
  topCard: Card | null | undefined,
  hand: Card[] = [],
  teamMelds: Meld[] = [],
  opponentMelds: Meld[] = [],
  opponentWants?: Set<string>
): boolean {
  if (!topCard) return false;
  // Wildcards always connect
  if (isWildcard(topCard) || isNaturalJoker(topCard) || topCard.rank === 2) {
    return true;
  }
  // Connects with hand or team melds
  if (isCardConnecting(topCard, hand, teamMelds)) {
    return true;
  }
  // Connects with opponent wants
  if (opponentWants) {
    const cardKey = topCard.suit ? `${topCard.suit}_${topCard.rank}` : `RANK_${topCard.rank}`;
    if (
      opponentWants.has(cardKey) ||
      opponentWants.has(topCard.id) ||
      opponentWants.has(`RANK_${topCard.rank}`)
    ) {
      return true;
    }
  }
  // Connects with opponent table melds
  for (const oppMeld of opponentMelds) {
    if (canAddCardsToMeld(oppMeld, [topCard]).valid) {
      return true;
    }
    if (oppMeld.type === 'RUN' && topCard.suit && oppMeld.suit === topCard.suit) {
      const ranks = oppMeld.slots.map((s) => s.representedRank).sort((a, b) => a - b);
      if (ranks.length > 0) {
        const minR = ranks[0];
        const maxR = ranks[ranks.length - 1];
        if (
          topCard.rank === minR - 1 ||
          topCard.rank === maxR + 1 ||
          (topCard.rank === 14 && minR === 2)
        ) {
          return true;
        }
      }
    } else if (oppMeld.type === 'SET') {
      const setRank =
        oppMeld.rank ??
        oppMeld.slots.find((s) => !s.isWildcard)?.representedRank ??
        oppMeld.cards?.find((c) => !isWildcard(c))?.rank;
      if (setRank !== undefined && topCard.rank === setRank) {
        return true;
      }
    }
  }
  return false;
}

export interface MilestoneRunTarget {
  meld: Meld;
  targetCount: 7 | 13;
  targetPoints: 100 | 200 | 500;
  missingRanks: number[];
  suit: Suit;
}

/**
 * Identifies active team RUN sequences that are close to completing high-value milestones:
 * - 10-12 cards chasing 13 cards (500 pts for Pure/Dirty 13)
 * - 5-6 cards chasing 7 cards (200 pts for Clean 7 if pure, or 100 pts for 7-card run)
 */
export function getTeamMilestoneRunTargets(teamMelds: Meld[]): MilestoneRunTarget[] {
  const targets: MilestoneRunTarget[] = [];
  if (!teamMelds || teamMelds.length === 0) return targets;

  for (const meld of teamMelds) {
    if (meld.type !== 'RUN' || !meld.suit) continue;
    const cards = meld.cards || meld.slots?.map((s) => s.card) || [];
    const count = cards.length;

    if (count >= 10 && count < 13) {
      const ranksInMeld = new Set(meld.slots.map((s) => s.representedRank));
      const missingRanks: number[] = [];
      for (let r = 1; r <= 14; r++) {
        if (!ranksInMeld.has(r)) {
          missingRanks.push(r);
        }
      }
      targets.push({
        meld,
        targetCount: 13,
        targetPoints: 500,
        missingRanks,
        suit: meld.suit,
      });
    } else if (count >= 5 && count < 7) {
      const ranks = meld.slots.map((s) => s.representedRank).sort((a, b) => a - b);
      const missingRanks: number[] = [];
      if (ranks.length > 0) {
        const minR = ranks[0];
        const maxR = ranks[ranks.length - 1];
        if (minR > 2) missingRanks.push(minR - 1);
        if (maxR < 14) missingRanks.push(maxR + 1);
        if (minR === 2) missingRanks.push(1);
        if (maxR === 13) missingRanks.push(14);
      }
      const isPure = isPureRun(cards, meld.slots);
      targets.push({
        meld,
        targetCount: 7,
        targetPoints: isPure ? 200 : 100,
        missingRanks,
        suit: meld.suit,
      });
    }
  }

  return targets;
}

export interface DiscardPickupOptions {
  personality: 'SMART_CHACHA' | 'THE_JADUGAR' | 'FAST_CHACHI' | 'THE_LONG_TERM_GUY' | 'CHEETAH';
  pukarPoolCount?: number;
  opponentWants?: Set<string>;
  allTableMelds?: Meld[];
  isBoardOpen?: boolean;
  isTeamOpen?: boolean;
  stockDeckCount?: number;
  nextOpponentCardCount?: number;
  lastDiscarderTeam?: import('../types').Team;
  botTeam?: import('../types').Team;
}

/**
 * Checks whether the top discard card (or any card in the discard pile) completes or advances
 * a high-value milestone run (Pure 13 for 500 pts, Clean 7 for 200 pts) for the bot's team,
 * or denies an opponent completing a 500-pt Pure 13 or 200-pt Clean 7.
 */
export function isPotential500or200Card(
  topCard: Card,
  discardPile: Card[],
  teamMelds: Meld[],
  opponentMelds: Meld[],
  opponentWants?: Set<string>
): boolean {
  const cardsToCheck = discardPile.length > 0 ? discardPile : [topCard];

  // 1. Team's own 500 milestone (RUN with 10-12 cards)
  const team13Runs = teamMelds.filter(
    (m) =>
      m.type === 'RUN' &&
      (m.cards?.length ?? m.slots?.length ?? 0) >= 10 &&
      (m.cards?.length ?? m.slots?.length ?? 0) < 13
  );
  if (team13Runs.some((m) => cardsToCheck.some((c) => canAddCardsToMeld(m, [c]).valid))) {
    return true;
  }

  // 2. Team's own 200 milestone (Pure RUN with 5-6 cards or SET with 5-6 cards)
  const team7Melds = teamMelds.filter((m) => {
    const len = m.cards?.length ?? m.slots?.length ?? 0;
    if (len < 5 || len >= 7) return false;
    if (m.type === 'RUN') {
      const cards = m.cards || m.slots?.map((s) => s.card) || [];
      return isPureRun(cards, m.slots);
    }
    if (m.type === 'SET') {
      return !m.slots?.some((s) => s.isWildcard);
    }
    return false;
  });
  if (team7Melds.some((m) => cardsToCheck.some((c) => canAddCardsToMeld(m, [c]).valid))) {
    return true;
  }

  // 3. Opponent's 500 milestone denial (Opponent RUN with 10-12 cards)
  const opp13Runs = opponentMelds.filter(
    (m) =>
      m.type === 'RUN' &&
      (m.cards?.length ?? m.slots?.length ?? 0) >= 10 &&
      (m.cards?.length ?? m.slots?.length ?? 0) < 13
  );
  if (opp13Runs.some((m) => cardsToCheck.some((c) => canAddCardsToMeld(m, [c]).valid))) {
    return true;
  }

  // 4. Opponent's 200 milestone denial (Opponent pure RUN with 5-6 cards or SET with 5-6 cards)
  const opp7Melds = opponentMelds.filter((m) => {
    const len = m.cards?.length ?? m.slots?.length ?? 0;
    if (len < 5 || len >= 7) return false;
    if (m.type === 'RUN') {
      const cards = m.cards || m.slots?.map((s) => s.card) || [];
      return isPureRun(cards, m.slots);
    }
    if (m.type === 'SET') {
      return !m.slots?.some((s) => s.isWildcard);
    }
    return false;
  });
  if (opp7Melds.some((m) => cardsToCheck.some((c) => canAddCardsToMeld(m, [c]).valid))) {
    return true;
  }

  // 5. Opponent wants matching milestone ranks
  if (opponentWants) {
    for (const m of [...opp13Runs, ...opp7Melds]) {
      if (m.type === 'RUN' && m.suit) {
        const ranks = m.slots.map((s) => s.representedRank).sort((a, b) => a - b);
        if (ranks.length > 0) {
          const minR = ranks[0];
          const maxR = ranks[ranks.length - 1];
          if (
            (minR > 2 && opponentWants.has(`${m.suit}_${minR - 1}`)) ||
            (maxR < 14 && opponentWants.has(`${m.suit}_${maxR + 1}`))
          ) {
            if (cardsToCheck.some((c) => c.suit === m.suit && (c.rank === minR - 1 || c.rank === maxR + 1))) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

/**
 * Evaluates whether a bot is very close to declaring Pukar or finishing the round:
 * - Hand length <= 2 (1 or 2 cards left in hand)
 * - Hand length < 7 with high connectivity (deadwood <= 2, or nearly all cards connect towards Pukar)
 */
export function isBotCloseToPukar(
  hand: Card[],
  teamMelds: Meld[],
  requirePure: boolean = false
): boolean {
  if (hand.length >= 7) {
    return false;
  }

  // 1 or 2 cards left is always close to Pukar / endgame
  if (hand.length <= 2) {
    return true;
  }

  // Check if hand cards already form melds or have table additions:
  const meldPlan = findBestMeldPlan(hand, teamMelds, { requirePure });
  const committedCount = meldPlan.usedCardIds.size;
  const deadwoodCount = hand.length - committedCount;

  // If bot has melds formed and only 1 or 2 deadwood cards remaining,
  // it is very close to Pukar! (e.g. 4 cards with 3 melded = 1 deadwood;
  // 5 cards with 3-4 melded = 1-2 deadwood; 6 cards with 4-6 melded = 0-2 deadwood)
  if (committedCount > 0 && deadwoodCount <= 2) {
    return true;
  }

  return false;
}

/**
 * Checks whether picking up the discard pile allows the bot to declare Pukar THIS TURN
 * (i.e. hand + discard pile can meld all cards except exactly 1 card to discard).
 */
export function canDeclareImmediatePukar(
  hand: Card[],
  discardPile: Card[],
  teamMelds: Meld[],
  requirePure: boolean = false,
  options: DiscardPickupOptions
): boolean {
  if ((options.pukarPoolCount ?? 2) === 0) return false;
  const combined = [...hand, ...discardPile];
  const plan = findBestMeldPlan(combined, teamMelds, {
    requirePure,
    canGuaranteePukar: true,
  });
  const uncommitted = combined.filter((c) => !plan.usedCardIds.has(c.id));
  if (uncommitted.length !== 1) return false;

  const discardCard = uncommitted[0];
  if (discardPile.length === 1 && discardCard.id === discardPile[0].id) {
    return false;
  }

  // Defending against opponent 500:
  // Discarding this card must NOT complete an opponent 500-pt Pure 13 sequence!
  const opponentMelds = options.allTableMelds
    ? options.allTableMelds.filter((m) => m.team !== (options.botTeam ?? teamMelds[0]?.team))
    : [];
  const completesOpp500 = opponentMelds.some(
    (m) =>
      m.type === 'RUN' &&
      (m.cards?.length ?? m.slots?.length ?? 0) === 12 &&
      (m.isPure || !m.slots.some((s) => s.isWildcard)) &&
      canAddCardsToMeld(m, [discardCard]).valid
  );
  if (completesOpp500) {
    return false;
  }

  return true;
}

/**
 * Rule 5 Helper: Determines whether a single discard card helps the bot at all:
 * - Is a wildcard / Joker
 * - Directly adds to team table meld
 * - Connects to open ends of team RUN on table
 * - Forms a new valid meld with hand cards
 * - Connects to hand cards (same rank, or same suit within 2 ranks)
 * - Denies an opponent milestone (500/200) or table meld / want
 */
export function doesCardHelpBot(
  card: Card,
  hand: Card[],
  teamMelds: Meld[],
  opponentMelds: Meld[],
  opponentWants?: Set<string>,
  requirePure: boolean = false
): boolean {
  // Wildcard / Joker always helps
  if (isWildcard(card) || isNaturalJoker(card) || card.rank === 2) {
    return true;
  }

  // 1. Can be added directly to an existing team meld on table
  if (teamMelds.some((m) => canAddCardsToMeld(m, [card]).valid)) {
    return true;
  }

  // 2. Open-end neighbor of team RUN on table (distance <= 2 of open end)
  for (const meld of teamMelds) {
    if (meld.type === 'RUN' && card.suit && meld.suit === card.suit) {
      const ranks = meld.slots.map((s) => s.representedRank).sort((a, b) => a - b);
      if (ranks.length > 0) {
        const minR = ranks[0];
        const maxR = ranks[ranks.length - 1];
        if (Math.abs(card.rank - minR) <= 2 || Math.abs(card.rank - maxR) <= 2) {
          return true;
        }
        if ((card.rank === 14 && minR <= 3) || (card.rank === 3 && minR === 1)) {
          return true;
        }
      }
    }
  }

  // 3. Forms a new valid meld with hand cards
  const testHand = [...hand, card];
  const newMelds = findPotentialNewMelds(testHand, { requirePure });
  if (newMelds.some((m) => m.cards.some((c) => c.id === card.id))) {
    return true;
  }

  // 4. Connects to hand cards:
  // - Same rank (pair/set potential)
  // - Same suit within 2 ranks (run potential)
  for (const h of hand) {
    if (isWildcard(h) || isNaturalJoker(h) || h.rank === 2) continue;
    if (h.rank === card.rank) {
      return true;
    }
    if (h.suit && card.suit && h.suit === card.suit) {
      if (Math.abs(h.rank - card.rank) <= 2) {
        return true;
      }
      if ((h.rank === 14 && card.rank === 3) || (card.rank === 14 && h.rank === 3)) {
        return true;
      }
    }
  }

  // 5. Milestone denial or opponent table meld denial
  if (isPotential500or200Card(card, [card], teamMelds, opponentMelds, opponentWants)) {
    return true;
  }
  if (opponentMelds.some((m) => canAddCardsToMeld(m, [card]).valid)) {
    return true;
  }
  if (opponentWants) {
    const cardKey = card.suit ? `${card.suit}_${card.rank}` : `RANK_${card.rank}`;
    if (opponentWants.has(cardKey) || opponentWants.has(card.id) || opponentWants.has(`RANK_${card.rank}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a specific card can be safely discarded without:
 * 1. Hindering own sequences (committed melds, team table additions, or adjacent sequence partners in hand)
 * 2. Giving opponents points (completing 500/200 milestones, feeding opponent table melds, or matching opponent wants)
 */
export function isCardSafeDiscard(
  card: Card,
  allCards: Card[],
  teamMelds: Meld[],
  opponentMelds: Meld[],
  opponentWants?: Set<string>,
  committedCardIds?: Set<string>,
  disallowedCardId?: string
): boolean {
  if (disallowedCardId && card.id === disallowedCardId) return false;
  if (isWildcard(card) || isNaturalJoker(card) || card.rank === 2) return false;
  if (committedCardIds && committedCardIds.has(card.id)) return false;

  // 1. Must not add to our team's table melds (waste of our points)
  if (teamMelds.some((m) => canAddCardsToMeld(m, [card]).valid)) {
    return false;
  }

  // 2. Must not give opponents a lot of points:
  // Completes opponent 500-pt Pure 13, 200-pt Clean 7, 7-card run, or adds directly to open opponent melds
  for (const oppMeld of opponentMelds) {
    if (canAddCardsToMeld(oppMeld, [card]).valid) {
      return false;
    }
    if (oppMeld.type === 'RUN' && card.suit && oppMeld.suit === card.suit) {
      const ranks = oppMeld.slots.map((s) => s.representedRank).sort((a, b) => a - b);
      if (ranks.length > 0) {
        const minR = ranks[0];
        const maxR = ranks[ranks.length - 1];
        if (card.rank === minR - 1 || card.rank === maxR + 1 || (card.rank === 14 && minR === 2)) {
          return false;
        }
      }
    } else if (oppMeld.type === 'SET') {
      const setRank =
        oppMeld.rank ??
        oppMeld.slots.find((s) => !s.isWildcard)?.representedRank ??
        oppMeld.cards?.find((c) => !isWildcard(c))?.rank;
      if (setRank !== undefined && card.rank === setRank) {
        return false;
      }
    }
  }

  // 3. Must not match opponent wants
  if (opponentWants) {
    const cardKey = card.suit ? `${card.suit}_${card.rank}` : `RANK_${card.rank}`;
    if (
      opponentWants.has(cardKey) ||
      opponentWants.has(card.id) ||
      opponentWants.has(`RANK_${card.rank}`)
    ) {
      return false;
    }
  }

  // 4. Must not hinder own sequences:
  // If card is part of a same-suit adjacent pair in hand (e.g. 8♠-9♠),
  // throwing it breaks that sequence!
  const hasAdjacentSequencePartner = allCards.some(
    (other) =>
      other.id !== card.id &&
      (!committedCardIds || !committedCardIds.has(other.id)) &&
      other.suit === card.suit &&
      Math.abs(other.rank - card.rank) === 1
  );
  if (hasAdjacentSequencePartner) {
    return false;
  }

  return true;
}

/**
 * Evaluates whether there is at least one safe card to discard in the given card pool.
 */
export function hasSafeDiscard(
  cards: Card[],
  teamMelds: Meld[],
  opponentMelds: Meld[],
  opponentWants?: Set<string>,
  requirePure: boolean = false,
  disallowedCardId?: string
): boolean {
  const plan = findBestMeldPlan(cards, teamMelds, { requirePure });
  return cards.some((card) =>
    isCardSafeDiscard(
      card,
      cards,
      teamMelds,
      opponentMelds,
      opponentWants,
      plan.usedCardIds,
      disallowedCardId
    )
  );
}

/**
 * Centrally evaluates whether a bot should take the discard pile based on the 5 prioritized rules:
 * 1. If very close to a Pukar and not letting a potential 500-pt or 200-pt card go, prioritize stock deck.
 * 2. If the card helps connect cards (1 to 2 ranks close), pick up ONLY IF bot has a safe discard
 *    that will not hinder its sequences or give opponents a lot of points.
 * 3. If there are 3+ cards, tendency should be pick unless moving close to a Pukar (< 7 cards & connected).
 * 4. If bot doesn't have good cards to discard and there are 2+ cards at bottom, pick (except Fast Chachi).
 * 5. If there is only 1 card in discard which doesn't help at all, NEVER pick it up.
 */
export function evaluateDiscardPilePickup(
  hand: Card[],
  discardPile: Card[],
  teamMelds: Meld[],
  options: DiscardPickupOptions
): boolean {
  if (!discardPile || discardPile.length === 0) {
    return false;
  }

  // Fallback: If stock deck is exhausted and discard pile has cards, must take discard pile
  if (options.stockDeckCount === 0) {
    return true;
  }

  const pileLength = discardPile.length;
  const topCard = discardPile[pileLength - 1];
  const pukarPoolCount = options.pukarPoolCount ?? 2;
  const isTeamOpen = options.isTeamOpen ?? (teamMelds.length > 0 || teamMelds.some((m) => m.isPure));
  const requirePure = !isTeamOpen;

  // Critical Winning / Endgame Guard:
  // If bot has 1 card left and 0 Pukars remain (going out cleanly to win the round),
  // taking a multi-card discard pile bloats the hand and prevents going out this turn!
  if (hand.length === 1 && pukarPoolCount === 0 && pileLength > 1) {
    return false;
  }
  // Or bot has 1 card left, is 1 card away from claiming Pukar, and pile has 5+ cards
  if (hand.length === 1 && pukarPoolCount > 0 && pileLength >= 5) {
    return false;
  }

  const opponentMelds = options.allTableMelds
    ? options.allTableMelds.filter((m) => m.team !== (options.botTeam ?? teamMelds[0]?.team))
    : [];

  // Immediate Winning / Claiming Pukar check:
  if (canDeclareImmediatePukar(hand, discardPile, teamMelds, requirePure, options)) {
    return true;
  }

  // Wildcard / Joker in pile: unconditionally valuable across all bots unless endgame guard triggered above
  const hasJokerInPile = discardPile.some(
    (c) => isWildcard(c) || isNaturalJoker(c) || c.rank === 2
  );
  if (hasJokerInPile) {
    return true;
  }

  // Milestone Sequence Priority:
  // If the team has an active sequence chasing a 500-pt 13-card milestone (10-12 cards),
  // fishing from the stock deck is vastly superior to taking small discard piles of deadwood (< 4 cards).
  const milestone13Melds = teamMelds.filter(
    (m) =>
      m.type === 'RUN' &&
      (m.cards?.length ?? m.slots?.length ?? 0) >= 10 &&
      (m.cards?.length ?? m.slots?.length ?? 0) < 13
  );
  if (
    milestone13Melds.length > 0 &&
    (options.stockDeckCount === undefined || options.stockDeckCount > 0)
  ) {
    const pileAddsToMilestone13 = milestone13Melds.some(
      (m) => canAddCardsToMeld(m, [topCard]).valid || canAddCardsToMeld(m, discardPile).valid
    );
    if (pileAddsToMilestone13) {
      return true;
    }
    if (pileLength < 4) {
      return false;
    }
  }

  // Milestone 500 / 200 card check (completes/advances team or denies opponent 500/200)
  const isMilestoneCard = isPotential500or200Card(
    topCard,
    discardPile,
    teamMelds,
    opponentMelds,
    options.opponentWants
  );

  // Check if bot is close to Pukar
  const closeToPukar = isBotCloseToPukar(hand, teamMelds, requirePure);

  // -------------------------------------------------------------------------
  // PRIORITY RULE 1:
  // "If very close to a pukar and not letting a potential 500 point or a 200 point card go,
  // they should prioritize the deck card as it can help with a pukar."
  // -------------------------------------------------------------------------
  if (closeToPukar) {
    if (isMilestoneCard) {
      // Must not let a potential 500-pt (Pure 13) or 200-pt (Clean 7) card go!
      return true;
    }
    // If top card directly adds to a team table sequence and pile is small (<= 2 cards),
    // it can be immediately laid down on the table to reduce remaining hand!
    const isDirectTableRunAdd = teamMelds.some(
      (m) => m.type === 'RUN' && canAddCardsToMeld(m, [topCard]).valid
    );
    if (isDirectTableRunAdd && pileLength <= 2) {
      const combined = [...hand, ...discardPile];
      const disallowedId = pileLength === 1 ? topCard.id : undefined;
      if (hasSafeDiscard(combined, teamMelds, opponentMelds, options.opponentWants, requirePure, disallowedId)) {
        return true;
      }
    }
    // Otherwise, prioritize drawing from the stock deck!
    return false;
  }

  // -------------------------------------------------------------------------
  // PRIORITY RULE 5:
  // "What a bot should never do is there is only one card in discard which doesn't help them at all
  // and it picks that up to throw a card which might be either trash to them or a more important card to them.
  // That is a wasted oportunity and no bot should be doing that."
  // -------------------------------------------------------------------------
  if (pileLength === 1) {
    const helps = doesCardHelpBot(
      topCard,
      hand,
      teamMelds,
      opponentMelds,
      options.opponentWants,
      requirePure
    );
    if (!helps) {
      return false; // Strictly refuse 1-card junk!
    }
  }

  // Fast Chachi extreme run preference check:
  if (options.personality === 'FAST_CHACHI') {
    const testHand = [...hand, topCard];
    const newMelds = findPotentialNewMelds(testHand, { requirePure });
    const hasExtremeMeld = newMelds.some(
      (m) =>
        m.type === 'RUN' &&
        m.cards.some((c) => c.id === topCard.id) &&
        m.cards.some((c) => c.rank === 14 || c.rank === 3 || c.rank === 13)
    );
    if (hasExtremeMeld) return true;
  }

  // Cheetah specific check: when hand <= 3, stay lean for Pukar
  if (options.personality === 'CHEETAH' && hand.length <= 3) {
    if (!isMilestoneCard) {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // PRIORITY RULE 2:
  // "If the card helps then connect cards - 1 to 2 close to the card then they should pick up.
  // But only if they also have a card that they can discard and will not hinder their sequences
  // or give the opponents a lot of points with the card they drop."
  // -------------------------------------------------------------------------
  const topConnects = isCardConnecting(topCard, hand, teamMelds);
  if (topConnects) {
    // For The Long-Term Guy and Fast Chachi: topCard must add sequence value (same-suit run or table run)
    // (Fast Chachi focuses strictly on sequences / extreme runs, not sets / three-of-a-kind)
    const helpsSequence =
      (options.personality !== 'THE_LONG_TERM_GUY' && options.personality !== 'FAST_CHACHI') ||
      isCardValuableForSequences(topCard, hand, teamMelds);

    // The Jadugar only takes 1-2 connectors on piles <= 2 if it is a tight pair/run or direct add
    const jadugarOk =
      options.personality !== 'THE_JADUGAR' ||
      pileLength <= 2 &&
        (teamMelds.some((m) => canAddCardsToMeld(m, [topCard]).valid) ||
          hand.some(
            (h) =>
              h.rank === topCard.rank ||
              (h.suit === topCard.suit && Math.abs(h.rank - topCard.rank) <= 1)
          ));

    if (helpsSequence && jadugarOk) {
      const combined = [...hand, ...discardPile];
      const disallowedId = pileLength === 1 ? topCard.id : undefined;
      const safeDiscardExists = hasSafeDiscard(
        combined,
        teamMelds,
        opponentMelds,
        options.opponentWants,
        requirePure,
        disallowedId
      );

      if (safeDiscardExists) {
        if (options.personality === 'FAST_CHACHI' && hand.length > 14) {
          // Past 14 cards, Fast Chachi stops taking loose connectors
        } else {
          return true;
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // PRIORITY RULE 3:
  // "If there are three or more cards tendency should be pick unless moving close to a pukar
  // (Less than 7 cards and a lot of connecting which can get them towards pukar)."
  // -------------------------------------------------------------------------
  if (pileLength >= 3) {
    if (closeToPukar) {
      return false;
    }
    if (options.personality === 'FAST_CHACHI') {
      if (hand.length <= 14) return true;
    } else if (options.personality === 'THE_JADUGAR') {
      // The Jadugar requires an immediate meld or direct table add to hoard 3+ cards
    } else {
      // Must have at least 1 connecting card or sequence value in the pile to take 3+ cards
      const hasConnectionInPile = discardPile.some((c) =>
        options.personality === 'THE_LONG_TERM_GUY'
          ? isCardValuableForSequences(c, hand, teamMelds)
          : isCardConnecting(c, hand, teamMelds)
      );
      if (hasConnectionInPile || pileLength >= 4) {
        return true;
      }
    }
  }

  // -------------------------------------------------------------------------
  // PRIORITY RULE 4:
  // "If they don't have good cards to discard and there are 2 or more cards at the bottom then pick
  // (Exception is the Chachi bot, she doesn't do that, she will be a bit more aggresive and doesn't as frequently pick up trash cards)."
  // -------------------------------------------------------------------------
  if (pileLength >= 2) {
    if (options.personality !== 'FAST_CHACHI') {
      const hasGoodDiscardInHand = hasSafeDiscard(
        hand,
        teamMelds,
        opponentMelds,
        options.opponentWants,
        requirePure
      );
      if (!hasGoodDiscardInHand) {
        return true; // Pick up 2+ cards from bottom to find a safe deadwood exit!
      }
    }
  }

  // -------------------------------------------------------------------------
  // Melds / Additions from whole pile check:
  // -------------------------------------------------------------------------
  const testHand = [...hand, ...discardPile];
  const hypMelds = findPotentialNewMelds(testHand, { requirePure });
  const hypAdds = findPotentialAdditionsToMelds(testHand, teamMelds);
  const currMelds = findPotentialNewMelds(hand, { requirePure });
  const currAdds = findPotentialAdditionsToMelds(hand, teamMelds);
  const pileCreatesMelds = hypMelds.length > currMelds.length || hypAdds.length > currAdds.length;

  if (pileCreatesMelds) {
    const disallowedId = pileLength === 1 ? topCard.id : undefined;
    const safeDiscardExists = hasSafeDiscard(
      testHand,
      teamMelds,
      opponentMelds,
      options.opponentWants,
      requirePure,
      disallowedId
    );
    if (safeDiscardExists) {
      if (options.personality === 'THE_LONG_TERM_GUY' || options.personality === 'FAST_CHACHI') {
        const createsNewRun = hypMelds.some(
          (m) => m.type === 'RUN' && m.cards.some((c) => discardPile.some((dp) => dp.id === c.id))
        );
        const createsRunAddition = hypAdds.some((a) => {
          const target = teamMelds.find((m) => m.id === a.meldId);
          return target?.type === 'RUN' && a.cards.some((c) => discardPile.some((dp) => dp.id === c.id));
        });
        if (createsNewRun || createsRunAddition) {
          return true;
        }
      } else {
        return true;
      }
    }
  }

  // Smart Chacha opponent denial for >= 4 cards
  if (options.personality === 'SMART_CHACHA' && options.opponentWants && hand.length > 4) {
    if (pileLength >= 4) {
      const oppWantsCard = discardPile.some((c) => {
        const k = c.suit ? `${c.suit}_${c.rank}` : 'WILD';
        return options.opponentWants?.has(k) || options.opponentWants?.has(c.id);
      });
      if (oppWantsCard) {
        return true;
      }
    }
  }

  return false;
}


