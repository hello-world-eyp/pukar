import { describe, it, expect } from 'vitest';
import { Card, Meld, Suit, Rank } from '../../src/engine/types';
import {
  validateNewRun,
  validateNewMeld,
  canAddCardsToMeld,
} from '../../src/engine/meld-validator';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';

function makeCard(id: string, suit: Suit | null, rank: number, isNaturalJoker = false): Card {
  return {
    id,
    suit,
    rank: rank as Rank,
    isNaturalJoker,
    isJoker: isNaturalJoker || rank === 2,
  };
}

describe('Suited Rank 2 + Joker Run Validation & Dynamics', () => {
  describe('Suited 2 with Natural Cards and Joker (Valid Runs)', () => {
    it('validates [2♥, 3♥, Joker] where 2♥ retains natural value and Joker is wild', () => {
      const cards = [
        makeCard('twoHearts', 'HEARTS', 2),
        makeCard('threeHearts', 'HEARTS', 3),
        makeCard('joker', null, 0, true),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(true);
      expect(result.slots).toBeDefined();

      const slots = result.slots!;
      expect(slots).toHaveLength(3);

      // 2♥ is natural rank 2
      const slot2 = slots.find((s) => s.card.id === 'twoHearts');
      expect(slot2).toBeDefined();
      expect(slot2?.representedRank).toBe(2);
      expect(slot2?.isWildcard).toBe(false);

      // 3♥ is natural rank 3
      const slot3 = slots.find((s) => s.card.id === 'threeHearts');
      expect(slot3).toBeDefined();
      expect(slot3?.representedRank).toBe(3);
      expect(slot3?.isWildcard).toBe(false);

      // Joker is wildcard at rank 4
      const slotJoker = slots.find((s) => s.card.id === 'joker');
      expect(slotJoker).toBeDefined();
      expect(slotJoker?.representedRank).toBe(4);
      expect(slotJoker?.isWildcard).toBe(true);
    });

    it('validates [2♠, 3♠, Joker] as valid Spades run', () => {
      const cards = [
        makeCard('twoSpades', 'SPADES', 2),
        makeCard('threeSpades', 'SPADES', 3),
        makeCard('joker', null, 0, true),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(true);
      const slot2 = result.slots?.find((s) => s.card.id === 'twoSpades');
      expect(slot2?.isWildcard).toBe(false);
      expect(slot2?.representedRank).toBe(2);
    });

    it('validates [2♦, 3♦, Joker] as valid Diamonds run', () => {
      const cards = [
        makeCard('twoDiamonds', 'DIAMONDS', 2),
        makeCard('threeDiamonds', 'DIAMONDS', 3),
        makeCard('joker', null, 0, true),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(true);
      const slot2 = result.slots?.find((s) => s.card.id === 'twoDiamonds');
      expect(slot2?.isWildcard).toBe(false);
    });

    it('validates [2♣, 3♣, Joker] as valid Clubs run', () => {
      const cards = [
        makeCard('twoClubs', 'CLUBS', 2),
        makeCard('threeClubs', 'CLUBS', 3),
        makeCard('joker', null, 0, true),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(true);
      const slot2 = result.slots?.find((s) => s.card.id === 'twoClubs');
      expect(slot2?.isWildcard).toBe(false);
    });

    it('validates order variation [Joker, 2♥, 3♥] as Ace-low run (A-2-3)', () => {
      const cards = [
        makeCard('joker', null, 0, true),
        makeCard('twoHearts', 'HEARTS', 2),
        makeCard('threeHearts', 'HEARTS', 3),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(true);
      const jokerSlot = result.slots?.find((s) => s.card.id === 'joker');
      expect(jokerSlot?.representedRank).toBe(1);
      expect(jokerSlot?.isWildcard).toBe(true);

      const slot2 = result.slots?.find((s) => s.card.id === 'twoHearts');
      expect(slot2?.representedRank).toBe(2);
      expect(slot2?.isWildcard).toBe(false);
    });

    it('validates [2♥, Joker, 4♥] where Joker substitutes for 3♥', () => {
      const cards = [
        makeCard('twoHearts', 'HEARTS', 2),
        makeCard('joker', null, 0, true),
        makeCard('fourHearts', 'HEARTS', 4),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(true);
      expect(result.slots?.map((s) => s.representedRank)).toEqual([2, 3, 4]);
      expect(result.slots?.[0].isWildcard).toBe(false);
      expect(result.slots?.[1].isWildcard).toBe(true);
      expect(result.slots?.[2].isWildcard).toBe(false);
    });

    it('validates 4-card run [2♥, 3♥, 4♥, Joker] with 2♥ natural and Joker at 5♥', () => {
      const cards = [
        makeCard('twoHearts', 'HEARTS', 2),
        makeCard('threeHearts', 'HEARTS', 3),
        makeCard('fourHearts', 'HEARTS', 4),
        makeCard('joker', null, 0, true),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(true);
      expect(result.slots?.map((s) => s.representedRank)).toEqual([2, 3, 4, 5]);
      expect(result.slots?.[0].isWildcard).toBe(false);
      expect(result.slots?.[3].isWildcard).toBe(true);
    });

    it('validates [A♥, 2♥, 3♥, Joker] as 4-card Ace-low run', () => {
      const cards = [
        makeCard('aceHearts', 'HEARTS', 14),
        makeCard('twoHearts', 'HEARTS', 2),
        makeCard('threeHearts', 'HEARTS', 3),
        makeCard('joker', null, 0, true),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(true);
      expect(result.slots?.map((s) => s.representedRank)).toEqual([1, 2, 3, 4]);
      expect(result.slots?.[0].isWildcard).toBe(false);
      expect(result.slots?.[1].isWildcard).toBe(false);
      expect(result.slots?.[3].isWildcard).toBe(true);
    });

    it('validates [2♥, 3♥, 2♠] where suited 2♥ is natural and mismatched 2♠ is wildcard', () => {
      const cards = [
        makeCard('twoHearts', 'HEARTS', 2),
        makeCard('threeHearts', 'HEARTS', 3),
        makeCard('twoSpades', 'SPADES', 2),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(true);
      const slot2H = result.slots?.find((s) => s.card.id === 'twoHearts');
      expect(slot2H?.representedRank).toBe(2);
      expect(slot2H?.isWildcard).toBe(false);

      const slot2S = result.slots?.find((s) => s.card.id === 'twoSpades');
      expect(slot2S?.isWildcard).toBe(true);
    });
  });

  describe('Cross-Suit Combinations (Strictly Invalid Runs)', () => {
    it('rejects [2♠, 3♣, Joker] because 2 and 3 have different suits (2 wilds)', () => {
      const cards = [
        makeCard('twoSpades', 'SPADES', 2),
        makeCard('threeClubs', 'CLUBS', 3),
        makeCard('joker', null, 0, true),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/wildcard/i);
    });

    it('rejects [2♠, 3♥, Joker] because 2 and 3 have different suits', () => {
      const cards = [
        makeCard('twoSpades', 'SPADES', 2),
        makeCard('threeHearts', 'HEARTS', 3),
        makeCard('joker', null, 0, true),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/wildcard/i);
    });

    it('rejects [2♦, 3♠, Joker] because 2 and 3 have different suits', () => {
      const cards = [
        makeCard('twoDiamonds', 'DIAMONDS', 2),
        makeCard('threeSpades', 'SPADES', 3),
        makeCard('joker', null, 0, true),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/wildcard/i);
    });

    it('rejects [2♣, 3♦, Joker] because 2 and 3 have different suits', () => {
      const cards = [
        makeCard('twoClubs', 'CLUBS', 2),
        makeCard('threeDiamonds', 'DIAMONDS', 3),
        makeCard('joker', null, 0, true),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/wildcard/i);
    });

    it('rejects [2♥, 3♥, 2♠, Joker] because it contains 2 wildcards (2♠ and Joker)', () => {
      const cards = [
        makeCard('twoHearts', 'HEARTS', 2),
        makeCard('threeHearts', 'HEARTS', 3),
        makeCard('twoSpades', 'SPADES', 2),
        makeCard('joker', null, 0, true),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/more than 1 wildcard/i);
    });

    it('rejects [2♠, 2♥, 3♣] because it contains 2 wildcards in a clubs run', () => {
      const cards = [
        makeCard('twoSpades', 'SPADES', 2),
        makeCard('twoHearts', 'HEARTS', 2),
        makeCard('threeClubs', 'CLUBS', 3),
      ];
      const result = validateNewRun(cards);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/more than 1 wildcard/i);
    });
  });

  describe('validateNewMeld Auto-Classification & Joker Identification', () => {
    it('classifies [2♥, 3♥, Joker] as RUN of HEARTS and accurately points jokerCardId to Joker', () => {
      const jokerCard = makeCard('joker-abc', null, 0, true);
      const cards = [
        makeCard('twoHearts', 'HEARTS', 2),
        makeCard('threeHearts', 'HEARTS', 3),
        jokerCard,
      ];
      const result = validateNewMeld(cards);
      expect(result.valid).toBe(true);
      expect(result.type).toBe('RUN');
      expect(result.suit).toBe('HEARTS');
      // Must point to the actual Joker, NOT the natural 2♥
      expect(result.jokerCardId).toBe('joker-abc');
    });

    it('rejects cross-suit [2♠, 3♣, Joker] via validateNewMeld', () => {
      const cards = [
        makeCard('twoSpades', 'SPADES', 2),
        makeCard('threeClubs', 'CLUBS', 3),
        makeCard('joker', null, 0, true),
      ];
      const result = validateNewMeld(cards);
      expect(result.valid).toBe(false);
    });
  });

  describe('canAddCardsToMeld with Suited 2 and Wildcards', () => {
    it('auto picks up Joker when adding 4♥ to replace Joker in [2♥, 3♥, Joker(4♥)]', () => {
      const initialCards = [
        makeCard('twoHearts', 'HEARTS', 2),
        makeCard('threeHearts', 'HEARTS', 3),
        makeCard('joker', null, 0, true),
      ];
      const validation = validateNewRun(initialCards);
      expect(validation.valid).toBe(true);

      const meld: Meld = {
        id: 'meld-1',
        team: 'A',
        type: 'RUN',
        suit: 'HEARTS',
        cards: initialCards,
        slots: validation.slots!,
      };

      const cardToAdd = makeCard('fourHearts', 'HEARTS', 4);
      const addResult = canAddCardsToMeld(meld, [cardToAdd]);
      expect(addResult.valid).toBe(true);
      expect(addResult.pickedUpCard).toBeDefined();
      expect(addResult.pickedUpCard?.id).toBe('joker');

      // Updated meld slots are now [2♥, 3♥, 4♥] - all natural cards
      expect(addResult.updatedSlots).toHaveLength(3);
      expect(addResult.updatedSlots?.map((s) => s.representedRank)).toEqual([2, 3, 4]);
      expect(addResult.updatedSlots?.every((s) => !s.isWildcard)).toBe(true);
    });

    it('allows adding 5♥ to [2♥, 3♥, Joker(4♥)] with Joker remaining fixed at 4♥', () => {
      const initialCards = [
        makeCard('twoHearts', 'HEARTS', 2),
        makeCard('threeHearts', 'HEARTS', 3),
        makeCard('joker', null, 0, true),
      ];
      const validation = validateNewRun(initialCards);
      expect(validation.valid).toBe(true);

      const meld: Meld = {
        id: 'meld-1',
        team: 'A',
        type: 'RUN',
        suit: 'HEARTS',
        cards: initialCards,
        slots: validation.slots!,
      };

      const cardToAdd = makeCard('fiveHearts', 'HEARTS', 5);
      const addResult = canAddCardsToMeld(meld, [cardToAdd]);
      expect(addResult.valid).toBe(true);
      expect(addResult.pickedUpCard).toBeUndefined();
      expect(addResult.updatedSlots).toHaveLength(4);

      // Joker stays locked at rank 4
      const slotJoker = addResult.updatedSlots?.find((s) => s.card.id === 'joker');
      expect(slotJoker?.representedRank).toBe(4);
      expect(slotJoker?.isWildcard).toBe(true);
    });

    it('rejects adding a second wildcard to [2♥, 3♥, Joker(4♥)]', () => {
      const initialCards = [
        makeCard('twoHearts', 'HEARTS', 2),
        makeCard('threeHearts', 'HEARTS', 3),
        makeCard('joker', null, 0, true),
      ];
      const validation = validateNewRun(initialCards);
      const meld: Meld = {
        id: 'meld-1',
        team: 'A',
        type: 'RUN',
        suit: 'HEARTS',
        cards: initialCards,
        slots: validation.slots!,
      };

      // Adding 2♣ (mismatched suit = second wildcard)
      const secondWild = makeCard('twoClubs', 'CLUBS', 2);
      const addResult = canAddCardsToMeld(meld, [secondWild]);
      expect(addResult.valid).toBe(false);
      expect(addResult.error).toMatch(/more than 1 wildcard/i);
    });
  });

  describe('Game Reducer Full Turn Integration', () => {
    it('rejects [2♥, 3♥, Joker] when team has no pure sequence, and executes successfully after pure sequence is established', () => {
      const initialState = dealInitialState(4);

      const twoH = makeCard('card-2h', 'HEARTS', 2);
      const threeH = makeCard('card-3h', 'HEARTS', 3);
      const joker = makeCard('card-joker', null, 0, true);

      // Place cards in active player's hand and set phase to MELD
      const stateWithCards = {
        ...initialState,
        phase: 'MELD' as const,
        turnPhase: 'MELD' as const,
        players: initialState.players.map((p, idx) =>
          idx === 0 ? { ...p, hand: [twoH, threeH, joker, ...p.hand] } : p
        ),
      };

      // 1. Attempting to play [2♥, 3♥, Joker] without a prior pure meld on the board is rejected
      const rejectResult = pukarReducer(stateWithCards, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['card-2h', 'card-3h', 'card-joker'],
      });
      expect(rejectResult.error).toBeDefined();
      expect(rejectResult.error).toContain('First sequence on the board must be pure');

      // 2. Once an initial pure sequence exists on the board for Team A, playing the dirty sequence succeeds
      const existingPureMeld: Meld = {
        id: 'meld-r1-A-1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          makeCard('p-4s', 'SPADES', 4),
          makeCard('p-5s', 'SPADES', 5),
          makeCard('p-6s', 'SPADES', 6),
        ],
        slots: [
          { card: makeCard('p-4s', 'SPADES', 4), representedRank: 4, isWildcard: false, representedSuit: 'SPADES' },
          { card: makeCard('p-5s', 'SPADES', 5), representedRank: 5, isWildcard: false, representedSuit: 'SPADES' },
          { card: makeCard('p-6s', 'SPADES', 6), representedRank: 6, isWildcard: false, representedSuit: 'SPADES' },
        ],
        isClean: true,
        isPure: true,
      };

      const stateWithPureMeld = {
        ...stateWithCards,
        melds: {
          ...stateWithCards.melds,
          A: [existingPureMeld],
        },
      };

      const result = pukarReducer(stateWithPureMeld, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['card-2h', 'card-3h', 'card-joker'],
      });

      expect(result.error).toBeUndefined();
      expect(result.state.melds.A).toHaveLength(2);
      const meld = result.state.melds.A[1];
      expect(meld.type).toBe('RUN');
      expect(meld.suit).toBe('HEARTS');
      expect(meld.slots).toHaveLength(3);
      expect(meld.slots[0].card.id).toBe('card-2h');
      expect(meld.slots[0].isWildcard).toBe(false);
      expect(meld.slots[2].card.id).toBe('card-joker');
      expect(meld.slots[2].isWildcard).toBe(true);
    });
  });
});
