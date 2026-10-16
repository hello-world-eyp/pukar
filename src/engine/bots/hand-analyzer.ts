/**
 * Hand Analyzer for AI Bots
 * Evaluates candidate runs, sets, table additions, and discard safety.
 * Pure TypeScript with zero DOM dependencies.
 */
import { Card, Meld, Suit, isNaturalJoker, isWildcard } from '../types';
import { canAddCardsToMeld, doesCardMatchRank, validateNewMeld } from '../meld-validator';

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
  tableMelds: Meld[],
  options?: { isCloseToPukar?: boolean; isFinalTurn?: boolean }
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
      // Disallow using cross-suit 2 in a run unless:
      // 1. Very close to Pukar (<= 3 cards)
      // 2. The run is NOT clean (never taint clean sequences and forfeit Clean 7 / Pure 13)
      // 3. No Natural Joker is available in hand (prefer Natural Joker whenever 2 suit doesn't match)
      if (
        meld.type === 'RUN' &&
        meld.suit &&
        card.rank === 2 &&
        card.suit !== meld.suit
      ) {
        if ((!isCloseToPukar && !isFinalTurn) || isCleanRun || hasNaturalJokerInHand) {
          continue;
        }
      }

      // Guard: Do not add wildcards (Natural Jokers or 2s) to 5- or 6-card clean runs unless close to Pukar or in final turn.
      // Preserves 200-pt Clean 7 and 500-pt Pure 13 opportunities.
      if (
        meld.type === 'RUN' &&
        isCleanRun &&
        meld.cards.length >= 5 &&
        !isCloseToPukar &&
        !isFinalTurn &&
        isNaturalJoker(card)
      ) {
        continue;
      }

      const validation = canAddCardsToMeld(meld, [card]);
      if (validation.valid) {
        // If adding this card would make a 5- or 6-card clean run dirty, disallow it unless close to Pukar or in final turn
        if (
          meld.type === 'RUN' &&
          isCleanRun &&
          meld.cards.length >= 5 &&
          !isCloseToPukar &&
          !isFinalTurn
        ) {
          const wouldMakeDirty = validation.updatedSlots
            ? validation.updatedSlots.some((s) => s.isWildcard)
            : isWildcard(card);
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
          if (
            meld.type === 'RUN' &&
            meld.suit &&
            pair.some((c) => c.rank === 2 && c.suit !== meld.suit)
          ) {
            if ((!isCloseToPukar && !isFinalTurn) || isCleanRun || hasNaturalJokerInHand) {
              continue;
            }
          }

          if (
            meld.type === 'RUN' &&
            isCleanRun &&
            meld.cards.length >= 5 &&
            !isCloseToPukar &&
            !isFinalTurn &&
            pair.some((c) => isNaturalJoker(c))
          ) {
            continue;
          }

          const validation = canAddCardsToMeld(meld, pair);
          if (validation.valid) {
            if (
              meld.type === 'RUN' &&
              isCleanRun &&
              meld.cards.length >= 5 &&
              !isCloseToPukar &&
              !isFinalTurn
            ) {
              const wouldMakeDirty = validation.updatedSlots
                ? validation.updatedSlots.some((s) => s.isWildcard)
                : pair.some((c) => isWildcard(c));
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
 * Greedily resolves non-overlapping meld and addition plan for the turn.
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
  }
): {
  meldsToPlay: CandidateMeld[];
  additionsToPlay: CandidateAddition[];
  usedCardIds: Set<string>;
} {
  const isCloseToPukar = options?.isCloseToPukar ?? (hand.length <= 3);
  const isFinalTurn = options?.isFinalTurn ?? false;
  const isTeamOpen = teamMelds.some((m) => m.isPure);
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
      } else if (initialCount < 13) {
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
      { isCloseToPukar, isFinalTurn }
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
    (options?.nextOpponentCardCount !== undefined && options.nextOpponentCardCount <= 2) ||
    Boolean(options?.opponentNeedsLockdown);

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
        (options?.teamMelds && options.teamMelds.some((m) => canAddCardsToMeld(m, [card]).valid)));
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
    if (options?.opponentMelds) {
      for (const oppMeld of options.opponentMelds) {
        if (canAddCardsToMeld(oppMeld, [card]).valid) {
          feedsOpponentMeld = true;
          break;
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
              break;
            }
          }
        } else if (oppMeld.type === 'SET') {
          const setRank =
            oppMeld.rank ??
            oppMeld.slots.find((s) => !s.isWildcard)?.representedRank ??
            oppMeld.cards?.find((c) => !isWildcard(c))?.rank;
          if (setRank !== undefined && card.rank === setRank) {
            feedsOpponentMeld = true;
            break;
          }
        }
      }
    }
    if (feedsOpponentMeld) {
      if (isLockdown) {
        score += 500;
        reason = 'Strict lockdown: feeds or connects to opponent table melds';
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

export interface DiscardPickupOptions {
  personality: 'SMART_CHACHA' | 'THE_JADUGAR' | 'FAST_CHACHI' | 'THE_LONG_TERM_GUY';
  pukarPoolCount?: number;
  opponentWants?: Set<string>;
  allTableMelds?: Meld[];
  isBoardOpen?: boolean;
  isTeamOpen?: boolean;
}

/**
 * Centrally evaluates whether a bot should take the discard pile based on its personality,
 * card volume, connecting cards, wildcard presence, and opponent denial.
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

  const pileLength = discardPile.length;
  const topCard = discardPile[pileLength - 1];
  const pukarPoolCount = options.pukarPoolCount ?? 2;
  const isTeamOpen = options.isTeamOpen ?? teamMelds.some((m) => m.isPure);
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

  // 1. Wildcard / Joker Rule (Issue 3: "If a joker is at the bottom, they should not just leave it unless there is a good reason to")
  const hasJokerInPile = discardPile.some(
    (c) => isWildcard(c) || isNaturalJoker(c) || c.rank === 2
  );

  if (hasJokerInPile) {
    return true;
  }

  // 2. Fast Chachi specific personality rule:
  // Discard hoarder with a ceiling at 14 cards.
  // When <= 14 cards, hoards 3+ card piles unconditionally.
  // On smaller piles (or when > 14 cards), takes if top card forms an extreme run (A-2-3 or A-K-Q).
  // If > 14 cards, she stops blind-hoarding and falls through to Section 3 (immediate melds / table additions).
  if (options.personality === 'FAST_CHACHI') {
    if (hand.length <= 14 && pileLength >= 3) return true;
    const testHand = [...hand, topCard];
    const newMelds = findPotentialNewMelds(testHand, {
      requirePure,
    });
    const hasExtremeMeld = newMelds.some(
      (m) =>
        m.type === 'RUN' &&
        m.cards.some((c) => c.id === topCard.id) &&
        m.cards.some((c) => c.rank === 14 || c.rank === 3 || c.rank === 13)
    );
    if (hasExtremeMeld) return true;
    if (hand.length <= 14) return false;
  }

  // 3. Melds / Additions from whole pile
  const testHand = [...hand, ...discardPile];
  const hypMelds = findPotentialNewMelds(testHand, { requirePure });
  const hypAdds = findPotentialAdditionsToMelds(testHand, teamMelds);
  const currMelds = findPotentialNewMelds(hand, { requirePure });
  const currAdds = findPotentialAdditionsToMelds(hand, teamMelds);
  const pileCreatesMelds = hypMelds.length > currMelds.length || hypAdds.length > currAdds.length;

  if (pileCreatesMelds) {
    if (options.personality === 'THE_LONG_TERM_GUY') {
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

  // Fast Chachi: past hoarding ceiling (> 14 cards), does not hoard or take loose connectors
  if (options.personality === 'FAST_CHACHI') {
    return false;
  }

  // 4. The Long-Term Guy: Sequence Value Specific Evaluation
  if (options.personality === 'THE_LONG_TERM_GUY') {
    const topAddsSeqValue = isCardValuableForSequences(topCard, hand, teamMelds);
    const seqValuableInPile = discardPile.filter((c) =>
      isCardValuableForSequences(c, hand, teamMelds)
    );
    const valuableCount = seqValuableInPile.length;

    // Do not leave 4+ card piles if they contain sequence builders!
    if (pileLength >= 4 && valuableCount >= 1 && hand.length > 1) {
      return true;
    }

    if (topAddsSeqValue) {
      // Top card directly adds value to a sequence
      if (pileLength <= 2) {
        return true;
      }
      // If pile has 3+ cards, only take if multiple cards add sequence value
      // or top card directly extends a table run and pile isn't bloated
      const isDirectTableRunAdd = teamMelds.some(
        (m) => m.type === 'RUN' && canAddCardsToMeld(m, [topCard]).valid
      );
      if (valuableCount >= 2 || (pileLength === 3 && isDirectTableRunAdd)) {
        return true;
      }
    } else {
      // Top card does not add sequence value:
      // Only take if multiple cards in the pile add sequence value and it is not mostly junk
      if (valuableCount >= 2 && valuableCount >= Math.ceil(pileLength / 2)) {
        return true;
      }
    }

    return false;
  }

  // 5. Connecting Cards analysis (Issue 2: "Leaving more connecting cards at the bottom when they should not")
  const topConnects = isCardConnecting(topCard, hand, teamMelds);
  const totalConnectingInPile = discardPile.filter((c) => isCardConnecting(c, hand, teamMelds)).length;

  if (topConnects) {
    if (options.personality === 'THE_JADUGAR') {
      const isDirectAdd = teamMelds.some((m) => canAddCardsToMeld(m, [topCard]).valid);
      const isTightPairOrRun = hand.some(
        (h) => h.rank === topCard.rank || (h.suit === topCard.suit && Math.abs(h.rank - topCard.rank) <= 1)
      );
      if (isDirectAdd || (isTightPairOrRun && pileLength <= 2)) {
        return true;
      }
    } else if (options.personality === 'SMART_CHACHA') {
      // Smart Chacha evaluates connecting cards:
      // - If pile is small (<= 2 cards), taking it is clean and beneficial
      // - If pile has 3+ cards with 2+ connectors and hand has room
      // - If pile has 4+ cards and top card connects, take it (do not leave 4 cards easily!)
      if (pileLength <= 2 && hand.length > 3) {
        return true;
      }
      if (pileLength >= 3 && totalConnectingInPile >= 2 && hand.length > 4) {
        return true;
      }
      if (pileLength >= 4 && hand.length > 1) {
        return true;
      }
    } else {
      return true;
    }
  }

  if (totalConnectingInPile >= 2) {
    if (options.personality === 'SMART_CHACHA') {
      if (hand.length > 4 || pileLength >= 4) {
        return true;
      }
    }
  }

  // 6. Opponent Denial (Smart Chacha)
  if (options.personality === 'SMART_CHACHA' && options.opponentWants) {
    const topKey = topCard.suit ? `${topCard.suit}_${topCard.rank}` : 'WILD';
    if (options.opponentWants.has(topKey) || options.opponentWants.has(topCard.id)) {
      return true;
    }
    // If pile has >= 4 cards and opponents want any card in the pile, deny them!
    if (pileLength >= 4 && hand.length > 1) {
      const oppWantsCard = discardPile.some((c) => {
        const k = c.suit ? `${c.suit}_${c.rank}` : 'WILD';
        return options.opponentWants?.has(k) || options.opponentWants?.has(c.id);
      });
      if (oppWantsCard) {
        return true;
      }
    }
  }

  // 7. Card Volume / Hoarding (Issue: "not randomly leaving 4 cards also that easily")
  switch (options.personality) {
    case 'SMART_CHACHA':
      // If pile has 4+ cards and at least 1 connecting card, take it!
      if (pileLength >= 4 && totalConnectingInPile >= 1 && hand.length > 1) {
        return true;
      }
      // If pile reaches 5+ cards, high volume card advantage unless close to going out
      if (pileLength >= 5 && hand.length >= 4) {
        return true;
      }
      break;
  }

  return false;
}

