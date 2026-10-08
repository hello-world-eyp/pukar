import {
  Card,
  Meld,
  MeldSlot,
  MeldType,
  Suit,
  isWildcard,
  isNaturalJoker,
} from './types';

/**
 * Validates whether an array of cards can form a new RUN (sequence).
 * Requirements:
 * - Minimum 3 cards.
 * - Same suit for all natural cards.
 * - Strictly consecutive ranks (Ace can be 1 or 14).
 * - At most 1 wildcard (Natural Joker or any 2).
 */
export function validateNewRun(cards: Card[]): {
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

    const wildcards = cards.filter((c) => isWildcard(c));
    if (wildcards.length > 1) {
      return { valid: false, error: 'A run cannot contain more than 1 wildcard' };
    }

    const naturalCards = cards.filter((c) => !isWildcard(c));
    if (naturalCards.length === 0) {
      return { valid: false, error: 'A run must contain natural cards' };
    }

    // Check suit consistency among natural cards
    const runSuit = naturalCards[0].suit;
    if (!runSuit || naturalCards.some((c) => c.suit !== runSuit)) {
      return { valid: false, error: 'All cards in a run must be of the same suit' };
    }

    // Check for duplicate ranks among natural cards (unless Aces on opposite ends)
    const nonAceRanks = naturalCards.filter((c) => c.rank !== 14).map((c) => c.rank);
    if (new Set(nonAceRanks).size !== nonAceRanks.length) {
      return { valid: false, error: 'A run cannot contain duplicate ranks' };
    }

    const candidates = findRunCandidates(cards, runSuit);
    if (candidates.length === 0) {
      return { valid: false, error: 'Cards do not form a valid consecutive sequence' };
    }

    // Select best candidate
    const bestCandidate = selectBestCandidate(cards, candidates, runSuit);
    return { valid: true, slots: bestCandidate };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Run validation failed: ${msg}` };
  }
}

/**
 * Validates whether an array of cards can form a new SET (group).
 * Requirements:
 * - Minimum 3 cards.
 * - Same rank for all natural cards.
 * - At most 1 wildcard.
 */
export function validateNewSet(cards: Card[]): {
  valid: boolean;
  slots?: MeldSlot[];
  error?: string;
} {
  try {
    if (!cards || cards.length < 3) {
      return { valid: false, error: 'A set requires at least 3 cards' };
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
 * Validates a new meld, auto-detecting whether it is a RUN or a SET.
 */
export function validateNewMeld(cards: Card[]): {
  valid: boolean;
  type?: MeldType;
  suit?: Suit;
  slots?: MeldSlot[];
  jokerCardId?: string;
  error?: string;
} {
  try {
    if (!cards || cards.length < 3) {
      return { valid: false, error: 'A meld requires at least 3 cards' };
    }

    const runResult = validateNewRun(cards);
    if (runResult.valid && runResult.slots) {
      const wildcard = cards.find((c) => isWildcard(c));
      return {
        valid: true,
        type: 'RUN',
        suit: runResult.slots[0].representedSuit,
        slots: runResult.slots,
        jokerCardId: wildcard?.id,
      };
    }

    const setResult = validateNewSet(cards);
    if (setResult.valid && setResult.slots) {
      const wildcard = cards.find((c) => isWildcard(c));
      return {
        valid: true,
        type: 'SET',
        slots: setResult.slots,
        jokerCardId: wildcard?.id,
      };
    }

    return {
      valid: false,
      error: runResult.error || setResult.error || 'Cards do not form a valid meld',
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
    if (!meld || !meld.cards) {
      return {
        points: 0,
        description: 'Incomplete Meld',
        isComplete7: false,
        isPure13: false,
      };
    }

    const cards = meld.cards;
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
      const hasWildcardOr2 = cards.some((c) => isWildcard(c));
      if (hasWildcardOr2) {
        return {
          points: 100,
          description: 'Dirty 7-Card Run',
          isComplete7: true,
          isPure13: false,
        };
      }
      return {
        points: 200,
        description: 'Clean 7-Card Run',
        isComplete7: true,
        isPure13: false,
      };
    }

    // SET meld
    const hasWildcard = cards.some((c) => isWildcard(c));
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
  cardsToAdd: Card[]
): {
  valid: boolean;
  updatedSlots?: MeldSlot[];
  error?: string;
} {
  try {
    if (!meld || !cardsToAdd || cardsToAdd.length === 0) {
      return { valid: false, error: 'Must add at least 1 card' };
    }

    const existingIds = new Set((meld.cards || []).map((c) => c.id));
    for (const c of cardsToAdd) {
      if (existingIds.has(c.id)) {
        return { valid: false, error: 'Card is already in meld' };
      }
    }

    const addIds = new Set(cardsToAdd.map((c) => c.id));
    if (addIds.size !== cardsToAdd.length) {
      return { valid: false, error: 'Duplicate cards in cards to add' };
    }

    const existingWildcards = (meld.cards || []).filter((c) => isWildcard(c));
    const addedWildcards = cardsToAdd.filter((c) => isWildcard(c));
    if (existingWildcards.length + addedWildcards.length > 1) {
      return { valid: false, error: 'A meld cannot contain more than 1 wildcard' };
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
        if (!isWildcard(c) && c.rank !== setRank) {
          return { valid: false, error: 'Cards added to a set must match the set rank' };
        }
      }

      const updatedSlots: MeldSlot[] = [...meld.slots];
      for (const c of cardsToAdd) {
        if (isWildcard(c)) {
          updatedSlots.push({
            card: c,
            representedRank: setRank,
            representedSuit: c.suit ?? undefined,
            isWildcard: true,
          });
        } else {
          updatedSlots.push({
            card: c,
            representedRank: setRank,
            representedSuit: c.suit ?? undefined,
            isWildcard: false,
          });
        }
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

    const allCards = [...meld.cards, ...cardsToAdd];
    if (allCards.length > 14) {
      return { valid: false, error: 'Run cannot exceed 14 cards' };
    }

    // Identify substituting 2 in current meld, if any
    const existingSub2Slot = meld.slots.find((s) => s.card.rank === 2 && s.isWildcard);
    const previousSubRank = existingSub2Slot?.representedRank;
    const isReplacingSub2 =
      previousSubRank !== undefined &&
      cardsToAdd.some((c) => !isWildcard(c) && c.rank === previousSubRank);

    const candidates = findRunCandidates(allCards, runSuit);
    if (candidates.length === 0) {
      return { valid: false, error: 'Cards added do not form a valid consecutive run' };
    }

    // Sort/select best candidate honoring Movable 2 priority
    if (isReplacingSub2 && existingSub2Slot) {
      const twoCardId = existingSub2Slot.card.id;
      // 1. Downward slide: rank 2 is open, 2 takes natural rank 2
      if (existingSub2Slot.card.suit === runSuit) {
        const downwardCandidate = candidates.find((cand) => {
          const slot = cand.find((s) => s.card.id === twoCardId);
          return slot && slot.representedRank === 2 && !slot.isWildcard;
        });
        if (downwardCandidate) {
          return { valid: true, updatedSlots: downwardCandidate };
        }
      }

      // 2. Upward shift: 2 shifts higher than previous substituted rank
      const upwardCandidate = candidates.find((cand) => {
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
      const sameRankCandidate = candidates.find((cand) => {
        const slot = cand.find((s) => s.card.id === twoCardId);
        return slot && slot.representedRank === previousSubRank;
      });
      if (sameRankCandidate) {
        return { valid: true, updatedSlots: sameRankCandidate };
      }
    }

    // Check if existing meld had natural 2
    const existingNatural2Slot = meld.slots.find(
      (s) => s.card.rank === 2 && !s.isWildcard && s.representedRank === 2
    );
    if (existingNatural2Slot) {
      const twoCardId = existingNatural2Slot.card.id;
      const keepNatural2Candidate = candidates.find((cand) => {
        const slot = cand.find((s) => s.card.id === twoCardId);
        return slot && slot.representedRank === 2 && !slot.isWildcard;
      });
      if (keepNatural2Candidate) {
        return { valid: true, updatedSlots: keepNatural2Candidate };
      }
    }

    // Fallback to best candidate
    const best = selectBestCandidate(allCards, candidates, runSuit);
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
  const wildcards = cards.filter((c) => isWildcard(c));
  if (wildcards.length > 1) return [];

  const naturalCards = cards.filter((c) => !isWildcard(c));
  if (naturalCards.some((c) => c.suit !== runSuit)) return [];

  const nonAceRanks = naturalCards.filter((c) => c.rank !== 14).map((c) => c.rank);
  if (new Set(nonAceRanks).size !== nonAceRanks.length) return [];

  const candidates: MeldSlot[][] = [];
  const maxStart = 15 - totalCards;

  for (let startRank = 1; startRank <= maxStart; startRank++) {
    const targetRanks: number[] = [];
    for (let i = 0; i < totalCards; i++) {
      targetRanks.push(startRank + i);
    }

    const assignedSlots = matchCardsToTargetRanks(cards, naturalCards, wildcards, targetRanks, runSuit);
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
  allCards: Card[],
  naturalCards: Card[],
  wildcards: Card[],
  targetRanks: number[],
  runSuit: Suit
): MeldSlot[] | null {
  const assigned = new Map<string, number>(); // cardId -> representedRank
  const targetUsed = new Set<number>();

  // 1. Assign non-Ace natural cards to their exact rank
  for (const c of naturalCards) {
    if (c.rank !== 14) {
      if (!targetRanks.includes(c.rank) || targetUsed.has(c.rank)) {
        return null;
      }
      assigned.set(c.id, c.rank);
      targetUsed.add(c.rank);
    }
  }

  // 2. Assign Ace natural cards (can be 1 or 14)
  const aceCards = naturalCards.filter((c) => c.rank === 14);
  for (const ace of aceCards) {
    if (targetRanks.includes(1) && !targetUsed.has(1)) {
      assigned.set(ace.id, 1);
      targetUsed.add(1);
    } else if (targetRanks.includes(14) && !targetUsed.has(14)) {
      assigned.set(ace.id, 14);
      targetUsed.add(14);
    } else {
      return null;
    }
  }

  // 3. Assign wildcards (if any)
  if (wildcards.length === 0) {
    if (targetUsed.size !== targetRanks.length) return null;
  } else {
    const wCard = wildcards[0];
    const missingRanks = targetRanks.filter((r) => !targetUsed.has(r));
    if (missingRanks.length !== 1) return null;

    const missingRank = missingRanks[0];
    assigned.set(wCard.id, missingRank);
  }

  // Build MeldSlot array in target rank order
  const slots: MeldSlot[] = [];
  for (const rank of targetRanks) {
    const cardId = [...assigned.entries()].find(([_, r]) => r === rank)?.[0];
    if (!cardId) return null;
    const card = allCards.find((c) => c.id === cardId)!;

    const isNaturalRank2 = card.rank === 2 && card.suit === runSuit && rank === 2;
    const isActingWildcard = isWildcard(card) && !isNaturalRank2;

    slots.push({
      card,
      representedRank: rank,
      representedSuit: runSuit,
      isWildcard: isActingWildcard,
    });
  }

  return slots;
}

/**
 * Selects the best candidate among multiple valid run configurations.
 */
function selectBestCandidate(cards: Card[], candidates: MeldSlot[][], runSuit: Suit): MeldSlot[] {
  if (candidates.length === 1) return candidates[0];

  const wildcard = cards.find((c) => isWildcard(c));

  // If wildcard is a 2 of matching suit and one candidate places it at natural rank 2, prefer it
  if (wildcard && wildcard.rank === 2 && wildcard.suit === runSuit) {
    const natural2Cand = candidates.find((cand) => {
      const slot = cand.find((s) => s.card.id === wildcard.id);
      return slot && slot.representedRank === 2 && !slot.isWildcard;
    });
    if (natural2Cand) return natural2Cand;
  }

  // Check card order: if wildcard was first in cards array, prefer lower startRank
  if (wildcard && cards[0].id === wildcard.id) {
    return candidates[0];
  }

  // Default to higher startRank (appending to end)
  return candidates[candidates.length - 1];
}
