import { describe, it, expect } from 'vitest';
import { Card, Meld, Suit, Rank } from '../../src/engine/types';
import {
  validateNewRun,
  validateNewMeld,
  canAddCardsToMeld,
  evaluateMeldScore,
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

  describe('Dynamic Suited 2 Positioning and 200 vs 100 Point Scoring (User Scenario)', () => {
    const s2 = makeCard('s2', 'SPADES', 2);
    const s3 = makeCard('s3', 'SPADES', 3);
    const s4 = makeCard('s4', 'SPADES', 4);
    const s5 = makeCard('s5', 'SPADES', 5);
    const s6 = makeCard('s6', 'SPADES', 6);
    const s7 = makeCard('s7', 'SPADES', 7);
    const s8 = makeCard('s8', 'SPADES', 8);
    const s9 = makeCard('s9', 'SPADES', 9);
    const s10 = makeCard('s10', 'SPADES', 10);
    const sJ = makeCard('sJ', 'SPADES', 11);

    it('1. places suited 2 at bottom (natural rank 2) for an 8-card sequence [2..9], awarding 200 pts (Clean 7-Card Run)', () => {
      // Regardless of array order (e.g. 2, 9..3 or 3..9, 2)
      const res1 = validateNewRun([s2, s3, s4, s5, s6, s7, s8, s9]);
      expect(res1.valid).toBe(true);
      const s2Slot = res1.slots?.find((s) => s.card.id === 's2');
      expect(s2Slot?.representedRank).toBe(2);
      expect(s2Slot?.isWildcard).toBe(false);

      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [s2, s3, s4, s5, s6, s7, s8, s9],
        slots: res1.slots!,
      };
      const score = evaluateMeldScore(meld);
      expect(score.points).toBe(200);
      expect(score.description).toBe('Clean 7-Card Run');
      expect(score.isComplete7).toBe(true);
    });

    it('2. floats suited 2 to rank 10 when J is added without 10, turning sequence to 100 pts (Dirty 7-Card Run)', () => {
      const initial = validateNewRun([s2, s3, s4, s5, s6, s7, s8, s9]);
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [s2, s3, s4, s5, s6, s7, s8, s9],
        slots: initial.slots!,
      };

      // Add Jack of Spades (no 10)
      const addJResult = canAddCardsToMeld(meld, [sJ]);
      expect(addJResult.valid).toBe(true);

      const s2Slot = addJResult.updatedSlots?.find((s) => s.card.id === 's2');
      expect(s2Slot?.representedRank).toBe(10);
      expect(s2Slot?.isWildcard).toBe(true);

      const meldAfterJ: Meld = {
        ...meld,
        cards: [...meld.cards, sJ],
        slots: addJResult.updatedSlots!,
      };
      const score = evaluateMeldScore(meldAfterJ);
      expect(score.points).toBe(100);
      expect(score.description).toBe('Dirty 7-Card Run');
    });

    it('3. automatically returns suited 2 back to natural rank 2 at bottom when 10 is added, restoring 200 pts (Clean 7-Card Run)', () => {
      // Start from the dirty meld with J and 2 at 10
      const initial = validateNewRun([s2, s3, s4, s5, s6, s7, s8, s9]);
      const addJResult = canAddCardsToMeld(
        {
          id: 'm1',
          team: 'A',
          type: 'RUN',
          suit: 'SPADES',
          cards: [s2, s3, s4, s5, s6, s7, s8, s9],
          slots: initial.slots!,
        },
        [sJ]
      );

      const meldWithJ: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [s2, s3, s4, s5, s6, s7, s8, s9, sJ],
        slots: addJResult.updatedSlots!,
      };

      // Now add 10 of Spades
      const add10Result = canAddCardsToMeld(meldWithJ, [s10]);
      expect(add10Result.valid).toBe(true);

      const s2Slot = add10Result.updatedSlots?.find((s) => s.card.id === 's2');
      expect(s2Slot?.representedRank).toBe(2);
      expect(s2Slot?.isWildcard).toBe(false);

      const meldAfter10: Meld = {
        ...meldWithJ,
        cards: [...meldWithJ.cards, s10],
        slots: add10Result.updatedSlots!,
      };
      const score = evaluateMeldScore(meldAfter10);
      expect(score.points).toBe(200);
      expect(score.description).toBe('Clean 7-Card Run');
    });

    it('4. slides suited 2 down from rank 10 to natural rank 2 when 3 is added to [4..9 + 2(at 10)], upgrading meld to 200 pts', () => {
      // 7-card dirty run [4..9 + 2 at 10]
      const dirty7 = validateNewRun([s4, s5, s6, s7, s8, s9, s2]);
      expect(dirty7.valid).toBe(true);

      const meldDirty7: Meld = {
        id: 'm-dirty',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [s4, s5, s6, s7, s8, s9, s2],
        slots: dirty7.slots!,
      };
      const initialScore = evaluateMeldScore(meldDirty7);
      expect(initialScore.points).toBe(100);

      // Add 3♠ (even though 10 was not added, rank 2 is now open and makes the sequence pure)
      const add3Result = canAddCardsToMeld(meldDirty7, [s3]);
      expect(add3Result.valid).toBe(true);

      const s2Slot = add3Result.updatedSlots?.find((s) => s.card.id === 's2');
      expect(s2Slot?.representedRank).toBe(2);
      expect(s2Slot?.isWildcard).toBe(false);

      const meldAfter3: Meld = {
        ...meldDirty7,
        cards: [...meldDirty7.cards, s3],
        slots: add3Result.updatedSlots!,
      };
      const updatedScore = evaluateMeldScore(meldAfter3);
      expect(updatedScore.points).toBe(200);
      expect(updatedScore.description).toBe('Clean 7-Card Run');
    });

    it('5. keeps suited 2 at natural rank 2 when added to an existing pure sequence [3..9], awarding 200 pts', () => {
      const pure7 = validateNewRun([s3, s4, s5, s6, s7, s8, s9]);
      const meldPure7: Meld = {
        id: 'm-pure',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [s3, s4, s5, s6, s7, s8, s9],
        slots: pure7.slots!,
      };

      const add2Result = canAddCardsToMeld(meldPure7, [s2]);
      expect(add2Result.valid).toBe(true);

      const s2Slot = add2Result.updatedSlots?.find((s) => s.card.id === 's2');
      expect(s2Slot?.representedRank).toBe(2);
      expect(s2Slot?.isWildcard).toBe(false);

      const meldAfter2: Meld = {
        ...meldPure7,
        cards: [...meldPure7.cards, s2],
        slots: add2Result.updatedSlots!,
      };
      const score = evaluateMeldScore(meldAfter2);
      expect(score.points).toBe(200);
      expect(score.description).toBe('Clean 7-Card Run');
    });

    it('6. pukarReducer full integration: melds [2..9] for 200 pts, adds J for 100 pts, then adds 10 to restore 200 pts', () => {
      const state = dealInitialState(4);

      // Give player0 the cards plus existing hand cards
      const testCards = [s2, s3, s4, s5, s6, s7, s8, s9, sJ, s10];

      const stateWithCards = {
        ...state,
        currentPlayerIndex: 0,
        phase: 'MELD' as const,
        turnPhase: 'MELD' as const,
        players: state.players.map((p, idx) =>
          idx === 0
            ? {
                ...p,
                hand: [...testCards, ...p.hand],
              }
            : p
        ),
      };

      // 1. Play new meld [2..9]
      const r1 = pukarReducer(stateWithCards, {
        type: 'PLAY_NEW_MELD',
        cardIds: [s2.id, s3.id, s4.id, s5.id, s6.id, s7.id, s8.id, s9.id],
      });
      expect(r1.error).toBeUndefined();
      const meldId = r1.state.melds.A[0].id;
      const meld1 = r1.state.melds.A[0];
      expect(meld1.points).toBe(200);
      expect(meld1.isClean).toBe(true);
      expect(meld1.isPure).toBe(true);
      const s2Slot1 = meld1.slots.find((s) => s.card.id === s2.id);
      expect(s2Slot1?.representedRank).toBe(2);
      expect(s2Slot1?.isWildcard).toBe(false);

      // 2. Add J to meld (no 10 yet) -> becomes 100 pts dirty run, 2♠ moves to 10
      const r2 = pukarReducer(r1.state, {
        type: 'ADD_TO_MELD',
        meldId,
        cardIds: [sJ.id],
      });
      expect(r2.error).toBeUndefined();
      const meld2 = r2.state.melds.A[0];
      expect(meld2.points).toBe(100);
      expect(meld2.isClean).toBe(false);
      expect(meld2.isPure).toBe(false);
      const s2Slot2 = meld2.slots.find((s) => s.card.id === s2.id);
      expect(s2Slot2?.representedRank).toBe(10);
      expect(s2Slot2?.isWildcard).toBe(true);

      // 3. Add 10 to meld -> 2♠ automatically slides back to rank 2, restoring 200 pts clean/pure run
      const r3 = pukarReducer(r2.state, {
        type: 'ADD_TO_MELD',
        meldId,
        cardIds: [s10.id],
      });
      expect(r3.error).toBeUndefined();
      const meld3 = r3.state.melds.A[0];
      expect(meld3.points).toBe(200);
      expect(meld3.isClean).toBe(true);
      expect(meld3.isPure).toBe(true);
      const s2Slot3 = meld3.slots.find((s) => s.card.id === s2.id);
      expect(s2Slot3?.representedRank).toBe(2);
      expect(s2Slot3?.isWildcard).toBe(false);
    });
  });
});
