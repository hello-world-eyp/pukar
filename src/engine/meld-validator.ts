import {
  Card,
  Meld,
  MeldSlot,
  MeldType,
  Suit,
  isWildcard,
  isNaturalJoker,
} from './types';

export { isWildcard, isNaturalJoker };

/**
 * Calculates the minimum number of wildcards required if cards form a run of the given suit.
 * A card of rank 2 with matching suit can only be natural if rank 2 can fit in a consecutive
 * sequence containing all fixed natural cards of rank 3..14.
 */
function getMinWildcardsForRun(cards: Card[], runSuit: Suit): number {
  let wildcards = 0;
  // Natural Jokers are always wildcards
  wildcards += cards.filter((c) => isNaturalJoker(c)).length;
  // 2s of a different suit are always wildcards in a run of runSuit
  wildcards += cards.filter((c) => c.rank === 2 && c.suit !== runSuit).length;

  // Suited 2s (suit === runSuit && rank === 2)
  const suited2s = cards.filter((c) => c.rank === 2 && c.suit === runSuit);
  if (suited2s.length > 0) {
    const N = cards.length;
    // Fixed natural cards (ranks 3..13)
    const fixedRanks = cards
      .filter((c) => c.suit === runSuit && c.rank >= 3 && c.rank <= 13)
      .map((c) => c.rank);
    const hasAce = cards.some((c) => c.suit === runSuit && c.rank === 14);

    // Can startRank be 1? Target ranks: 1..N. Rank 2 is included.
    const canFitStart1 =
      fixedRanks.every((r) => r >= 1 && r <= N) &&
      (!hasAce || N >= 1);

    // Can startRank be 2? Target ranks: 2..N+1. Rank 2 is included.
    const canFitStart2 =
      fixedRanks.every((r) => r >= 2 && r <= N + 1) &&
      (!hasAce || N + 1 >= 14);

    if (canFitStart1 || canFitStart2) {
      // Exactly 1 suited 2 can occupy natural rank 2; any additional suited 2s must be wildcards
      wildcards += Math.max(0, suited2s.length - 1);
    } else {
      // Rank 2 cannot be occupied by natural 2 in this sequence, so all suited 2s are wildcards
      wildcards += suited2s.length;
    }
  }

  return wildcards;
}

export interface JokerOption {
  rank: number;
  suit: Suit;
  label: string;
  positionLabel?: 'Lowest Card in Sequence' | 'Highest Card in Sequence';
}

export function getRankDisplayName(rank: number): string {
  if (rank === 1 || rank === 14) return 'Ace';
  if (rank === 11) return 'Jack';
  if (rank === 12) return 'Queen';
  if (rank === 13) return 'King';
  return String(rank);
}

/**
 * Checks whether a natural card's rank matches a target rank,
 * accounting for Ace which naturally has rank 14 but can represent rank 1 (Ace low) or rank 14 (Ace high).
 */
export function doesCardMatchRank(cardRank: number, targetRank: number): boolean {
  if (cardRank === targetRank) return true;
  if ((cardRank === 14 || cardRank === 1) && (targetRank === 1 || targetRank === 14)) {
    return true;
  }
  return false;
}

export function getSuitDisplayName(suit: Suit): string {
  switch (suit) {
    case 'SPADES':
      return 'Spades';
    case 'HEARTS':
      return 'Hearts';
    case 'DIAMONDS':
      return 'Diamonds';
    case 'CLUBS':
      return 'Clubs';
  }
}

/**
 * Returns the candidate rank/suit options that a Normal Joker can represent in a valid run.
 */
export function getRunCandidateOptions(cards: Card[]): JokerOption[] {
  const normalJoker = cards.find((c) => isNaturalJoker(c));
  if (!normalJoker) return [];

  const naturalSuits = Array.from(
    new Set(cards.filter((c) => c.suit !== null && c.rank >= 3).map((c) => c.suit as Suit))
  );
  if (naturalSuits.length > 1) return [];

  const candidateSuits: Suit[] =
    naturalSuits.length === 1
      ? naturalSuits
      : Array.from(new Set(cards.map((c) => c.suit).filter((s): s is Suit => s !== null)));

  if (candidateSuits.length === 0) return [];

  const options: JokerOption[] = [];
  const seenRanks = new Set<number>();

  for (const suit of candidateSuits) {
    const candidates = findRunCandidates(cards, suit);
    for (const cand of candidates) {
      const jokerSlot = cand.find((s) => s.card.id === normalJoker.id && s.isWildcard);
      if (jokerSlot && !seenRanks.has(jokerSlot.representedRank)) {
        seenRanks.add(jokerSlot.representedRank);
        options.push({
          rank: jokerSlot.representedRank,
          suit,
          label: `${getRankDisplayName(jokerSlot.representedRank)} of ${getSuitDisplayName(suit)}`,
        });
      }
    }
  }

  options.sort((a, b) => a.rank - b.rank);
  if (options.length >= 2) {
    options[0].positionLabel = 'Lowest Card in Sequence';
    options[options.length - 1].positionLabel = 'Highest Card in Sequence';
  }

  return options;
}

/**
 * Returns candidate rank options for placing a Normal Joker into an existing RUN meld.
 * If position is implied (only 1 option), length is 1.
 * If multiple positions exist (e.g. lowest vs highest), length > 1 with positionLabels.
 */
export function getAddToRunCandidateOptions(
  meld: Meld,
  cardsToAdd: Card[]
): JokerOption[] {
  try {
    if (!meld || meld.type !== 'RUN' || !cardsToAdd || cardsToAdd.length === 0) {
      return [];
    }

    const normalJoker = cardsToAdd.find((c) => isNaturalJoker(c));
    if (!normalJoker) return [];

    const runSuit =
      meld.suit ??
      meld.slots?.find((s) => s.representedSuit)?.representedSuit ??
      meld.cards?.find((c) => c.suit !== null)?.suit;

    if (!runSuit) return [];

    const meldCards = meld.cards || meld.slots?.map((s) => s.card) || [];
    const allCards = [...meldCards, ...cardsToAdd];

    const candidates = findRunCandidates(allCards, runSuit);
    if (candidates.length === 0) return [];

    // Filter out candidates if existing meld has fixed Joker or natural 2
    const existingNormalJokerSlot = meld.slots?.find(
      (s) => s.isWildcard && isNaturalJoker(s.card) && s.card.id !== normalJoker.id
    );
    let eligible = candidates;
    if (existingNormalJokerSlot) {
      eligible = eligible.filter((cand) => {
        const slot = cand.find((s) => s.card.id === existingNormalJokerSlot.card.id);
        return slot && slot.representedRank === existingNormalJokerSlot.representedRank;
      });
    }

    const existingNatural2Slot = meld.slots?.find(
      (s) => s.card.rank === 2 && !s.isWildcard && s.representedRank === 2
    );
    if (existingNatural2Slot) {
      const nat2Filtered = eligible.filter((cand) => {
        const slot = cand.find((s) => s.card.id === existingNatural2Slot.card.id);
        return slot && slot.representedRank === 2 && !slot.isWildcard;
      });
      if (nat2Filtered.length > 0) {
        eligible = nat2Filtered;
      }
    }

    const options: JokerOption[] = [];
    const seenRanks = new Set<number>();

    for (const cand of eligible) {
      const jokerSlot = cand.find((s) => s.card.id === normalJoker.id && s.isWildcard);
      if (jokerSlot && !seenRanks.has(jokerSlot.representedRank)) {
        seenRanks.add(jokerSlot.representedRank);
        options.push({
          rank: jokerSlot.representedRank,
          suit: runSuit,
          label: `${getRankDisplayName(jokerSlot.representedRank)} of ${getSuitDisplayName(runSuit)}`,
        });
      }
    }

    options.sort((a, b) => a.rank - b.rank);
    if (options.length >= 2) {
      options[0].positionLabel = 'Lowest Card in Sequence';
      options[options.length - 1].positionLabel = 'Highest Card in Sequence';
    }

    return options;
  } catch (err) {
    console.error('Error in getAddToRunCandidateOptions:', err);
    return [];
  }
}

/**
 * Validates whether an array of cards can form a new RUN (sequence).
 * Requirements:
 * - Minimum 3 cards.
 * - Same suit for all natural cards.
 * - Strictly consecutive ranks (Ace can be 1 or 14).
 * - At most 1 wildcard (Natural Joker or any 2).
 * - Optional targetJokerRank to designate what rank the Normal Joker should represent.
 */
export function validateNewRun(
  cards: Card[],
  targetJokerRank?: number
): {
  valid: boolean;
  slots?: MeldSlot[];
  error?: string;
} {
  try {
    if (!cards || cards.length < 3) {
      return { valid: false, error: 'A run requires at least 3 cards' };
    }
    if (cards.length > 14) {
      return { valid: false, error: 'A run cannot exceed 14 cards' };
    }

    // Check for duplicate card instances
    const cardIds = new Set(cards.map((c) => c.id));
    if (cardIds.size !== cards.length) {
      return { valid: false, error: 'Duplicate cards in run' };
    }

    // Check for duplicate ranks among natural cards (ranks 3..13)
    const nonAceNaturalRanks = cards
      .filter((c) => c.rank >= 3 && c.rank <= 13)
      .map((c) => c.rank);
    if (new Set(nonAceNaturalRanks).size !== nonAceNaturalRanks.length) {
      return { valid: false, error: 'A run cannot contain duplicate ranks' };
    }
    const aceCount = cards.filter((c) => c.rank === 14).length;
    if (aceCount > 1 && cards.length < 14) {
      return { valid: false, error: 'A run cannot contain duplicate ranks' };
    }

    // Check natural cards (rank >= 3) suit consistency
    const naturalSuits = Array.from(
      new Set(cards.filter((c) => c.suit !== null && c.rank >= 3).map((c) => c.suit as Suit))
    );
    if (naturalSuits.length > 1) {
      return { valid: false, error: 'All cards in a run must be of the same suit' };
    }

    // Candidate suits: if natural cards of rank >= 3 exist, only their suit is valid
    let candidateSuits: Suit[];
    if (naturalSuits.length === 1) {
      candidateSuits = naturalSuits;
    } else {
      candidateSuits = Array.from(
        new Set(cards.map((c) => c.suit).filter((s): s is Suit => s !== null))
      );
    }

    if (candidateSuits.length === 0) {
      return { valid: false, error: 'A run must contain suited cards' };
    }

    // Check if wildcards exceed 1 for all candidate suits
    const minWildcards = candidateSuits.map((s) => getMinWildcardsForRun(cards, s));
    if (minWildcards.every((count) => count > 1)) {
      return { valid: false, error: 'A run cannot contain more than 1 wildcard' };
    }

    const allCandidates: { suit: Suit; slots: MeldSlot[] }[] = [];

    for (const suit of candidateSuits) {
      const candidates = findRunCandidates(cards, suit);
      for (const cand of candidates) {
        allCandidates.push({ suit, slots: cand });
      }
    }

    if (allCandidates.length === 0) {
      if (minWildcards.some((count) => count > 1)) {
        return { valid: false, error: 'A run cannot contain more than 1 wildcard' };
      }
      return { valid: false, error: 'Cards do not form a valid consecutive sequence' };
    }

    // Select candidate matching chosen suit
    const chosenSuit = allCandidates[0].suit;
    let sameSuitCandidates = allCandidates
      .filter((ac) => ac.suit === chosenSuit)
      .map((ac) => ac.slots);

    // If caller specified a target rank for the Normal Joker, filter for that rank
    if (targetJokerRank !== undefined) {
      const normalJoker = cards.find((c) => isNaturalJoker(c));
      if (normalJoker) {
        const matchingRankCandidates = sameSuitCandidates.filter((cand) => {
          const slot = cand.find((s) => s.card.id === normalJoker.id);
          return slot && slot.representedRank === targetJokerRank;
        });
        if (matchingRankCandidates.length > 0) {
          sameSuitCandidates = matchingRankCandidates;
        }
      }
    }

    const bestCandidate = selectBestCandidate(cards, sameSuitCandidates, chosenSuit);
    return { valid: true, slots: bestCandidate };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Run validation failed: ${msg}` };
  }
}

/**
 * Validates whether an array of cards can form a new SET (group).
 * Requirements in Pukar:
 * - A set can only be added if there are at least 7 cards:
 *   - Clean 7-of-a-kind: 7+ natural cards of the same rank (0 wildcards).
 *   - Dirty 7-of-a-kind: 6+ natural cards of the same rank and 1 wildcard/joker.
 * - Incomplete sets (like 3, 3, 3) cannot be placed on the board.
 * - At most 1 wildcard allowed.
 * - Same rank for all natural cards.
 */
export function validateNewSet(cards: Card[]): {
  valid: boolean;
  slots?: MeldSlot[];
  error?: string;
} {
  try {
    if (!cards || cards.length < 7) {
      return {
        valid: false,
        error: 'A set requires at least 7 cards (7 of the same rank, or 6 of the same rank and a joker)',
      };
    }

    // Check for duplicate card instances
    const cardIds = new Set(cards.map((c) => c.id));
    if (cardIds.size !== cards.length) {
      return { valid: false, error: 'Duplicate cards in set' };
    }

    const wildcards = cards.filter((c) => isWildcard(c));
    if (wildcards.length > 1) {
      return { valid: false, error: 'A set cannot contain more than 1 wildcard' };
    }

    const naturalCards = cards.filter((c) => !isWildcard(c));
    if (naturalCards.length === 0) {
      return { valid: false, error: 'A set must contain natural cards' };
    }

    if (wildcards.length === 1 && naturalCards.length < 6) {
      return {
        valid: false,
        error: 'A set with a joker requires at least 6 natural cards of the same rank',
      };
    }

    if (wildcards.length === 0 && naturalCards.length < 7) {
      return {
        valid: false,
        error: 'A set without a joker requires at least 7 natural cards of the same rank',
      };
    }

    const setRank = naturalCards[0].rank;
    if (naturalCards.some((c) => c.rank !== setRank)) {
      return { valid: false, error: 'All natural cards in a set must have the same rank' };
    }

    const slots: MeldSlot[] = [];
    for (const c of naturalCards) {
      slots.push({
        card: c,
        representedRank: setRank,
        representedSuit: c.suit ?? undefined,
        isWildcard: false,
      });
    }

    if (wildcards.length === 1) {
      const wCard = wildcards[0];
      slots.push({
        card: wCard,
        representedRank: setRank,
        representedSuit: wCard.suit ?? undefined,
        isWildcard: true,
      });
    }

    return { valid: true, slots };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Set validation failed: ${msg}` };
  }
}

/**
 * Checks if an array of cards (and optional slots) forms a pure sequence:
 * - Must be a RUN (consecutive ranks, exact same suit).
 * - Zero wildcards / jokers.
 * - Natural Jokers cannot be present.
 * - If a card of rank 2 is present:
 *   - It must be of the run's suit.
 *   - It must occupy its natural rank 2 position (representedRank === 2).
 *   - It must not be acting as a wildcard (isWildcard === false).
 */
export function isPureRun(cards: Card[], slots?: MeldSlot[]): boolean {
  if (!cards || cards.length < 3) return false;
  // Natural jokers cannot be in a pure run
  if (cards.some((c) => isNaturalJoker(c) || c.rank === 0)) return false;

  if (slots && slots.length > 0) {
    if (slots.some((s) => s.isWildcard)) return false;
    const firstSuit = slots[0].representedSuit ?? slots[0].card.suit;
    if (!firstSuit) return false;
    for (const slot of slots) {
      if (slot.isWildcard) return false;
      const slotSuit = slot.representedSuit ?? slot.card.suit;
      if (slot.card.suit !== firstSuit || slotSuit !== firstSuit) return false;
      if (slot.card.rank === 2) {
        if (slot.representedRank !== 2) return false;
      }
    }
    return true;
  }

  const runResult = validateNewRun(cards);
  if (!runResult.valid || !runResult.slots) return false;
  return isPureRun(cards, runResult.slots);
}

/**
 * Validates a new meld, auto-detecting whether it is a RUN or a SET.
 * Accepts optional targetJokerRank to designate what rank the Normal Joker should represent in a run.
 * Accepts optional options.requirePure: when true, the meld must be a pure sequence (no jokers/sets allowed).
 */
export function validateNewMeld(
  cards: Card[],
  targetJokerRank?: number,
  options?: { requirePure?: boolean }
): {
  valid: boolean;
  type?: MeldType;
  suit?: Suit;
  slots?: MeldSlot[];
  jokerCardId?: string;
  isPure?: boolean;
  error?: string;
} {
  try {
    if (!cards || cards.length < 3) {
      return { valid: false, error: 'A meld requires at least 3 cards' };
    }

    const runResult = validateNewRun(cards, targetJokerRank);
    if (runResult.valid && runResult.slots) {
      const wildcardSlot = runResult.slots.find((s) => s.isWildcard);
      const isPure = isPureRun(cards, runResult.slots);

      if (options?.requirePure && !isPure) {
        if (cards.some((c) => isNaturalJoker(c) || c.rank === 0)) {
          return {
            valid: false,
            error: 'First sequence on the board must be pure: Natural Jokers are not allowed',
          };
        }
        if (cards.some((c) => c.rank === 2)) {
          return {
            valid: false,
            error: "First sequence on the board must be pure: card '2' must be at its natural place (rank 2)",
          };
        }
        return {
          valid: false,
          error: 'First sequence on the board must be a pure sequence (no wildcards or jokers allowed)',
        };
      }

      return {
        valid: true,
        type: 'RUN',
        suit: runResult.slots[0].representedSuit,
        slots: runResult.slots,
        jokerCardId: wildcardSlot?.card.id,
        isPure,
      };
    }

    const setResult = validateNewSet(cards);
    if (setResult.valid && setResult.slots) {
      if (options?.requirePure) {
        return {
          valid: false,
          error: 'First sequence on the board must be a pure sequence (sets are not allowed until a pure sequence is established)',
        };
      }

      const wildcardSlot = setResult.slots.find((s) => s.isWildcard);
      return {
        valid: true,
        type: 'SET',
        slots: setResult.slots,
        jokerCardId: wildcardSlot?.card.id,
        isPure: false,
      };
    }

    const naturalCards = cards.filter((c) => !isWildcard(c));
    const allSameRank =
      naturalCards.length > 0 && naturalCards.every((c) => c.rank === naturalCards[0].rank);
    const chosenError = allSameRank
      ? setResult.error || runResult.error
      : runResult.error || setResult.error;

    return {
      valid: false,
      error: chosenError || 'Cards do not form a valid meld',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Meld validation failed: ${msg}` };
  }
}

/**
 * Evaluates the score and completion status of a meld.
 * Rules:
 * - Melds under 7 cards: 0 points (incomplete).
 * - Clean 7-card run (7+ cards, 0 wildcards/2s): 200 points.
 * - Dirty 7-card run (7+ cards, 1 wildcard or 2): 100 points.
 * - Clean 7-of-a-kind (7+ cards, 0 wildcards): 200 points.
 * - Dirty 7-of-a-kind (7+ cards, 1 wildcard): 100 points.
 * - Pure 13-card 2-to-A run (13 cards, 2 through A, same suit, 0 wildcards/jokers): 500 points.
 */
export function evaluateMeldScore(meld: Meld): {
  points: number;
  description: string;
  isComplete7: boolean;
  isPure13: boolean;
} {
  try {
    if (!meld || (!meld.cards && !meld.slots)) {
      return {
        points: 0,
        description: 'Incomplete Meld',
        isComplete7: false,
        isPure13: false,
      };
    }

    const cards = meld.cards || meld.slots.map((s) => s.card);
    const count = cards.length;

    if (count < 7) {
      return {
        points: 0,
        description: 'Incomplete Meld',
        isComplete7: false,
        isPure13: false,
      };
    }

    // Check Pure 13-Card Run (2 to A)
    if (meld.type === 'RUN' && count === 13) {
      const hasAnyJoker = cards.some((c) => isNaturalJoker(c));
      const allSameSuit = cards.every((c) => c.suit !== null && c.suit === meld.suit);
      const sortedRanks = [...cards].map((c) => c.rank).sort((a, b) => a - b);
      const isExact2to14 = sortedRanks.every((r, idx) => r === idx + 2);
      const hasNoSubstitutingWildcard = meld.slots.length === 0 || meld.slots.every((s) => !s.isWildcard);

      if (!hasAnyJoker && allSameSuit && isExact2to14 && hasNoSubstitutingWildcard) {
        return {
          points: 500,
          description: 'Pure 13-Card Run (2 to A)',
          isComplete7: true,
          isPure13: true,
        };
      }
    }

    if (meld.type === 'RUN') {
      const isClean = isPureRun(cards, meld.slots && meld.slots.length > 0 ? meld.slots : undefined);
      if (isClean) {
        return {
          points: 200,
          description: 'Clean 7-Card Run',
          isComplete7: true,
          isPure13: false,
        };
      }
      return {
        points: 100,
        description: 'Dirty 7-Card Run',
        isComplete7: true,
        isPure13: false,
      };
    }

    // SET meld
    const hasWildcard =
      meld.slots && meld.slots.length > 0
        ? meld.slots.some((s) => s.isWildcard)
        : cards.some((c) => isWildcard(c));
    if (hasWildcard) {
      return {
        points: 100,
        description: 'Dirty 7-of-a-Kind',
        isComplete7: true,
        isPure13: false,
      };
    }
    return {
      points: 200,
      description: 'Clean 7-of-a-Kind',
      isComplete7: true,
      isPure13: false,
    };
  } catch (err) {
    console.error('Error evaluating meld score:', err);
    return {
      points: 0,
      description: 'Evaluation Error',
      isComplete7: false,
      isPure13: false,
    };
  }
}

/**
 * Validates adding cards to an existing meld, implementing Movable "2" Joker Dynamics:
 * - Upward Shift: If natural card replaces 2's slot, 2 can shift upward to substitute for a higher rank.
 * - Downward Slide: If natural card replaces 2's slot and rank 2 is open, 2 slides down to natural 2.
 * - Table Permanence: Cards in existing meld cannot be removed.
 */
export function canAddCardsToMeld(
  meld: Meld,
  cardsToAdd: Card[],
  targetJokerRank?: number
): {
  valid: boolean;
  updatedSlots?: MeldSlot[];
  pickedUpCard?: Card;
  error?: string;
} {
  try {
    if (!meld || !cardsToAdd || cardsToAdd.length === 0) {
      return { valid: false, error: 'Must add at least 1 card' };
    }

    const meldCards = meld.cards || meld.slots?.map((s) => s.card) || [];
    const existingIds = new Set(meldCards.map((c) => c.id));
    for (const c of cardsToAdd) {
      if (existingIds.has(c.id)) {
        return { valid: false, error: 'Card is already in meld' };
      }
    }

    const addIds = new Set(cardsToAdd.map((c) => c.id));
    if (addIds.size !== cardsToAdd.length) {
      return { valid: false, error: 'Duplicate cards in cards to add' };
    }

    if (meld.type === 'SET') {
      const setRank =
        meld.rank ??
        meld.slots.find((s) => !s.isWildcard)?.representedRank ??
        meld.cards.find((c) => !isWildcard(c))?.rank;

      if (!setRank) {
        return { valid: false, error: 'Unable to determine set rank' };
      }

      for (const c of cardsToAdd) {
        if (!isWildcard(c) && !doesCardMatchRank(c.rank, setRank)) {
          return { valid: false, error: 'Cards added to a set must match the set rank' };
        }
      }

      // Check if meld has a Normal Joker that can be replaced and picked up
      const normalJokerSlot = meld.slots.find((s) => s.isWildcard && isNaturalJoker(s.card));
      const hasNaturalCardToAdd = cardsToAdd.some(
        (c) => !isWildcard(c) && doesCardMatchRank(c.rank, setRank)
      );

      if (normalJokerSlot && hasNaturalCardToAdd) {
        // Natural card replaces the Normal Joker in the set!
        // The Normal Joker is auto picked up to the player's hand!
        const pickedUpCard = normalJokerSlot.card;
        const remainingSlots = meld.slots.filter((s) => s.card.id !== pickedUpCard.id);
        const updatedSlots: MeldSlot[] = [...remainingSlots];

        for (const c of cardsToAdd) {
          updatedSlots.push({
            card: c,
            representedRank: setRank,
            representedSuit: c.suit ?? undefined,
            isWildcard: isWildcard(c),
          });
        }

        return { valid: true, updatedSlots, pickedUpCard };
      }

      const existingWildcards = (meld.slots || []).filter((s) => s.isWildcard).length;
      const addedWildcards = cardsToAdd.filter((c) => isWildcard(c)).length;
      if (existingWildcards + addedWildcards > 1) {
        return { valid: false, error: 'A set cannot contain more than 1 wildcard' };
      }

      const updatedSlots: MeldSlot[] = [...meld.slots];
      for (const c of cardsToAdd) {
        updatedSlots.push({
          card: c,
          representedRank: setRank,
          representedSuit: c.suit ?? undefined,
          isWildcard: isWildcard(c),
        });
      }

      return { valid: true, updatedSlots };
    }

    // RUN meld
    const runSuit =
      meld.suit ??
      meld.slots.find((s) => s.representedSuit)?.representedSuit ??
      meld.cards.find((c) => c.suit !== null)?.suit;

    if (!runSuit) {
      return { valid: false, error: 'Unable to determine run suit' };
    }

    for (const c of cardsToAdd) {
      if (!isWildcard(c) && c.suit !== runSuit) {
        return { valid: false, error: 'Cards added to a run must match the run suit' };
      }
    }

    const allCards = [...meldCards, ...cardsToAdd];
    if (allCards.length > 14) {
      return { valid: false, error: 'Run cannot exceed 14 cards' };
    }

    // Check duplicate natural ranks
    const nonAceNaturalRanks = allCards
      .filter((c) => c.rank >= 3 && c.rank <= 13)
      .map((c) => c.rank);
    if (new Set(nonAceNaturalRanks).size !== nonAceNaturalRanks.length) {
      return { valid: false, error: 'A run cannot contain duplicate ranks' };
    }

    // 1. Check if meld currently contains a Normal Joker acting as wildcard
    const normalJokerSlot = meld.slots.find((s) => s.isWildcard && isNaturalJoker(s.card));
    if (normalJokerSlot) {
      const jokerRepresentedRank = normalJokerSlot.representedRank;
      const jokerRepresentedSuit = normalJokerSlot.representedSuit ?? runSuit;

      // Check if cardsToAdd contains the exact card the Normal Joker represents!
      const hasReplacementCard = cardsToAdd.some(
        (c) =>
          !isWildcard(c) &&
          doesCardMatchRank(c.rank, jokerRepresentedRank) &&
          c.suit === jokerRepresentedSuit
      );

      if (hasReplacementCard) {
        // The Normal Joker is being replaced!
        // It is AUTO PICKED UP to the player's hand.
        const pickedUpCard = normalJokerSlot.card;

        // The remaining cards in the meld: meldCards without Joker + cardsToAdd
        const remainingMeldCards = meldCards.filter((c) => c.id !== pickedUpCard.id);
        const newMeldCards = [...remainingMeldCards, ...cardsToAdd];

        if (newMeldCards.length > 14) {
          return { valid: false, error: 'Run cannot exceed 14 cards' };
        }

        const candidates = findRunCandidates(newMeldCards, runSuit);
        if (candidates.length === 0) {
          return { valid: false, error: 'Cards added do not form a valid consecutive run' };
        }

        const bestSlots = selectBestCandidate(newMeldCards, candidates, runSuit);
        return {
          valid: true,
          updatedSlots: bestSlots,
          pickedUpCard,
        };
      } else {
        // The Normal Joker was NOT replaced!
        // Rule: The Normal Joker CANNOT shift up or down!
        // Its representedRank MUST remain unchanged.
        const candidates = findRunCandidates(allCards, runSuit);
        if (candidates.length === 0) {
          if (getMinWildcardsForRun(allCards, runSuit) > 1) {
            return { valid: false, error: 'A run cannot contain more than 1 wildcard' };
          }
          return { valid: false, error: 'Cards added do not form a valid consecutive run' };
        }

        // Filter candidates: Normal Joker MUST retain its exact representedRank!
        const fixedJokerCandidates = candidates.filter((cand) => {
          const slot = cand.find((s) => s.card.id === normalJokerSlot.card.id);
          return slot && slot.representedRank === jokerRepresentedRank && slot.isWildcard;
        });

        if (fixedJokerCandidates.length === 0) {
          return {
            valid: false,
            error: 'The Normal Joker cannot shift up or down; it must remain at its current rank',
          };
        }

        const existingNatural2Slot = meld.slots.find(
          (s) => s.card.rank === 2 && !s.isWildcard && s.representedRank === 2
        );
        let eligibleCandidates = fixedJokerCandidates;
        if (existingNatural2Slot) {
          const natural2Filtered = fixedJokerCandidates.filter((cand) => {
            const slot = cand.find((s) => s.card.id === existingNatural2Slot.card.id);
            return slot && slot.representedRank === 2 && !slot.isWildcard;
          });
          if (natural2Filtered.length > 0) {
            eligibleCandidates = natural2Filtered;
          }
        }

        const bestSlots = selectBestCandidate(allCards, eligibleCandidates, runSuit);
        return {
          valid: true,
          updatedSlots: bestSlots,
        };
      }
    }

    // 2. Movable 2 Wildcard Dynamics (when no Normal Joker is in the meld)
    const candidates = findRunCandidates(allCards, runSuit);
    if (candidates.length === 0) {
      if (getMinWildcardsForRun(allCards, runSuit) > 1) {
        return { valid: false, error: 'A run cannot contain more than 1 wildcard' };
      }
      return { valid: false, error: 'Cards added do not form a valid consecutive run' };
    }

    const existingSub2Slot = meld.slots.find((s) => s.card.rank === 2 && s.isWildcard);
    const previousSubRank = existingSub2Slot?.representedRank;
    const isReplacingSub2 =
      previousSubRank !== undefined &&
      cardsToAdd.some((c) => !isWildcard(c) && doesCardMatchRank(c.rank, previousSubRank));

    // If existing meld had a natural 2, filter candidates to those that preserve 2 at natural rank 2
    const existingNatural2Slot = meld.slots.find(
      (s) => s.card.rank === 2 && !s.isWildcard && s.representedRank === 2
    );
    let eligibleCandidates = candidates;
    if (existingNatural2Slot) {
      const natural2Filtered = candidates.filter((cand) => {
        const slot = cand.find((s) => s.card.id === existingNatural2Slot.card.id);
        return slot && slot.representedRank === 2 && !slot.isWildcard;
      });
      if (natural2Filtered.length > 0) {
        eligibleCandidates = natural2Filtered;
      }
    }

    // Sort/select best candidate honoring Movable 2 priority (Table permanence - 2 is NOT picked up)
    if (isReplacingSub2 && existingSub2Slot) {
      const twoCardId = existingSub2Slot.card.id;
      // 1. Downward slide: if wildcard is a suited 2 and rank 2 is open, 2 takes natural rank 2
      if (existingSub2Slot.card.suit === runSuit) {
        const downwardCandidate = eligibleCandidates.find((cand) => {
          const slot = cand.find((s) => s.card.id === twoCardId);
          return slot && slot.representedRank === 2 && !slot.isWildcard;
        });
        if (downwardCandidate) {
          return { valid: true, updatedSlots: downwardCandidate };
        }
      }

      // 2. Upward shift: 2 shifts higher than previous substituted rank
      const upwardCandidate = eligibleCandidates.find((cand) => {
        const slot = cand.find((s) => s.card.id === twoCardId);
        return slot && slot.representedRank > previousSubRank && slot.isWildcard;
      });
      if (upwardCandidate) {
        return { valid: true, updatedSlots: upwardCandidate };
      }
    }

    // If 2 was not replaced, prefer keeping 2's represented rank unchanged if possible
    if (existingSub2Slot) {
      const twoCardId = existingSub2Slot.card.id;
      const sameRankCandidate = eligibleCandidates.find((cand) => {
        const slot = cand.find((s) => s.card.id === twoCardId);
        return slot && slot.representedRank === previousSubRank;
      });
      if (sameRankCandidate) {
        return { valid: true, updatedSlots: sameRankCandidate };
      }
    }

    // If user specified targetJokerRank for Normal Joker being added:
    if (targetJokerRank !== undefined) {
      const normalJoker = cardsToAdd.find((c) => isNaturalJoker(c));
      if (normalJoker) {
        const matching = eligibleCandidates.filter((cand) => {
          const slot = cand.find((s) => s.card.id === normalJoker.id);
          return slot && slot.representedRank === targetJokerRank;
        });
        if (matching.length > 0) {
          eligibleCandidates = matching;
        }
      }
    }

    // Fallback to best candidate
    const best = selectBestCandidate(allCards, eligibleCandidates, runSuit);
    return { valid: true, updatedSlots: best };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Cannot add cards to meld: ${msg}` };
  }
}

/**
 * Validates that cards cannot be removed from a meld once placed.
 */
export function validateRemoveCardFromMeld(
  _meld: Meld,
  _cardId: string
): { valid: boolean; error: string } {
  return {
    valid: false,
    error: 'Cards cannot be removed from a meld once placed on the table',
  };
}

// ----------------------------------------------------------------------------
// Internal Helper Functions
// ----------------------------------------------------------------------------

/**
 * Finds all valid contiguous run configurations for a given card list and suit.
 */
function findRunCandidates(cards: Card[], runSuit: Suit): MeldSlot[][] {
  const totalCards = cards.length;
  // A card of rank 3..14 with a DIFFERENT suit cannot be in a run of runSuit!
  const wrongSuitNonWildcards = cards.filter(
    (c) => c.suit !== null && c.suit !== runSuit && c.rank !== 2
  );
  if (wrongSuitNonWildcards.length > 0) {
    return [];
  }

  // Cards guaranteed to be wildcards (Jokers and 2s of different suit)
  const guaranteedWildcards = cards.filter(
    (c) => isNaturalJoker(c) || (c.rank === 2 && c.suit !== runSuit)
  );
  if (guaranteedWildcards.length > 1) {
    return [];
  }

  // Check duplicate ranks among non-Ace suited cards of rank 3..13
  const suitedNonAceCards = cards.filter(
    (c) => c.suit === runSuit && c.rank >= 3 && c.rank <= 13
  );
  const ranksSet = new Set(suitedNonAceCards.map((c) => c.rank));
  if (ranksSet.size !== suitedNonAceCards.length) {
    return [];
  }

  const candidates: MeldSlot[][] = [];
  const maxStart = 15 - totalCards;

  for (let startRank = 1; startRank <= maxStart; startRank++) {
    const targetRanks: number[] = [];
    for (let i = 0; i < totalCards; i++) {
      targetRanks.push(startRank + i);
    }

    const assignedSlots = matchCardsToTargetRanks(cards, targetRanks, runSuit);
    if (assignedSlots) {
      candidates.push(assignedSlots);
    }
  }

  return candidates;
}

/**
 * Attempts to map cards 1-to-1 to a target contiguous rank sequence.
 */
function matchCardsToTargetRanks(
  cards: Card[],
  targetRanks: number[],
  runSuit: Suit
): MeldSlot[] | null {
  const targetUsed = new Set<number>();
  const cardAssignment = new Map<string, { rank: number; isWildcard: boolean }>();

  // 1. Assign fixed suited natural cards (ranks 3..13)
  const fixedNaturals = cards.filter(
    (c) => c.suit === runSuit && c.rank >= 3 && c.rank <= 13
  );
  for (const c of fixedNaturals) {
    if (!targetRanks.includes(c.rank) || targetUsed.has(c.rank)) {
      return null;
    }
    cardAssignment.set(c.id, { rank: c.rank, isWildcard: false });
    targetUsed.add(c.rank);
  }

  // 2. Assign suited Aces (rank 14) to 1 or 14
  const suitedAces = cards.filter((c) => c.suit === runSuit && c.rank === 14);
  for (const ace of suitedAces) {
    if (targetRanks.includes(1) && !targetUsed.has(1)) {
      cardAssignment.set(ace.id, { rank: 1, isWildcard: false });
      targetUsed.add(1);
    } else if (targetRanks.includes(14) && !targetUsed.has(14)) {
      cardAssignment.set(ace.id, { rank: 14, isWildcard: false });
      targetUsed.add(14);
    } else {
      return null;
    }
  }

  // 3. Suited 2s (suit === runSuit && rank === 2)
  // If targetRanks contains 2 and 2 is open, map suited 2 to natural rank 2 (isWildcard: false).
  // Any remaining suited 2 will act as a flexible wildcard.
  const suited2s = cards.filter((c) => c.suit === runSuit && c.rank === 2);
  const flexibleWildcards: Card[] = [];

  for (const two of suited2s) {
    if (targetRanks.includes(2) && !targetUsed.has(2)) {
      cardAssignment.set(two.id, { rank: 2, isWildcard: false });
      targetUsed.add(2);
    } else {
      flexibleWildcards.push(two);
    }
  }

  // 4. Collect other flexible wildcards:
  // - Natural Jokers (rank 0 / isNaturalJoker)
  // - 2s of different suit (rank 2 && suit !== runSuit)
  const otherWildcards = cards.filter(
    (c) => isNaturalJoker(c) || (c.rank === 2 && c.suit !== runSuit)
  );
  flexibleWildcards.push(...otherWildcards);

  // 5. Fill remaining open ranks with flexible wildcards
  const openRanks = targetRanks.filter((r) => !targetUsed.has(r));
  if (openRanks.length !== flexibleWildcards.length) {
    return null;
  }

  for (let i = 0; i < flexibleWildcards.length; i++) {
    const wCard = flexibleWildcards[i];
    const r = openRanks[i];
    cardAssignment.set(wCard.id, { rank: r, isWildcard: true });
    targetUsed.add(r);
  }

  // 6. Check total wildcards count (at most 1 wildcard allowed in a run)
  let wildcardCount = 0;
  for (const info of cardAssignment.values()) {
    if (info.isWildcard) {
      wildcardCount++;
    }
  }

  if (wildcardCount > 1) {
    return null;
  }

  // 7. Construct MeldSlot array in order of targetRanks
  const slots: MeldSlot[] = [];
  for (const rank of targetRanks) {
    const entry = [...cardAssignment.entries()].find(([_, info]) => info.rank === rank);
    if (!entry) return null;
    const card = cards.find((c) => c.id === entry[0])!;
    slots.push({
      card,
      representedRank: rank,
      representedSuit: runSuit,
      isWildcard: entry[1].isWildcard,
    });
  }

  return slots;
}

/**
 * Selects the best candidate among multiple valid run configurations.
 */
function selectBestCandidate(cards: Card[], candidates: MeldSlot[][], runSuit: Suit): MeldSlot[] {
  if (candidates.length === 1) return candidates[0];

  // If candidates exist that place suited 2 at natural rank 2, filter to those candidates
  const suited2 = cards.find((c) => c.suit === runSuit && c.rank === 2);
  let eligibleCandidates = candidates;
  if (suited2) {
    const natural2Candidates = candidates.filter((cand) => {
      const slot = cand.find((s) => s.card.id === suited2.id);
      return slot && slot.representedRank === 2 && !slot.isWildcard;
    });
    if (natural2Candidates.length > 0) {
      eligibleCandidates = natural2Candidates;
    }
  }

  if (eligibleCandidates.length === 1) return eligibleCandidates[0];

  // Check card order: if a wildcard was first in cards array, prefer lower startRank
  const firstCard = cards[0];
  const firstCardSlot = eligibleCandidates[0].find((s) => s.card.id === firstCard.id);
  if (firstCardSlot?.isWildcard) {
    return eligibleCandidates[0];
  }

  // Default to higher startRank (appending to end, e.g. 2-3-4 rather than A-2-3 for [2, 3, Joker])
  return eligibleCandidates[eligibleCandidates.length - 1];
}
