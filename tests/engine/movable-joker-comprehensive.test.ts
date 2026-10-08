import { describe, it, expect } from 'vitest';
import { canAddCardsToMeld, validateNewRun } from '../../src/engine/meld-validator';
import { Card, Meld, Suit, Rank } from '../../src/engine/types';

function makeCard(suit: Suit | null, rank: number, id?: string): Card {
  const isJoker = rank === 0 && suit === null;
  return {
    id: id ?? `card-${suit}-${rank}-${Math.random()}`,
    suit,
    rank: rank as Rank,
    isNaturalJoker: isJoker,
    isJoker: isJoker || rank === 2,
  };
}

describe('Comprehensive Movable "2" Joker Dynamics & Meld Additions (src/engine/meld-validator.ts)', () => {
  describe('Upward Shift Dynamics of 2 in Runs', () => {
    it('shifts substituting 2 upward when replaced by the natural card in an extended run: [3♠, 4♠, 2♠(sub 5), 6♠] + 5♠ and 8♠ -> [3♠, 4♠, 5♠, 6♠, 2♠(sub 7), 8♠]', () => {
      const card3 = makeCard('SPADES', 3, 'card-3s');
      const card4 = makeCard('SPADES', 4, 'card-4s');
      const wild2 = makeCard('SPADES', 2, 'card-2s');
      const card6 = makeCard('SPADES', 6, 'card-6s');

      const initialRun = validateNewRun([card3, card4, wild2, card6]);
      expect(initialRun.valid).toBe(true);

      const meld: Meld = {
        id: 'meld-1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [card3, card4, wild2, card6],
        slots: initialRun.slots!,
      };

      const card5 = makeCard('SPADES', 5, 'card-5s');
      const card8 = makeCard('SPADES', 8, 'card-8s');

      const result = canAddCardsToMeld(meld, [card5, card8]);
      expect(result.valid).toBe(true);
      expect(result.updatedSlots).toBeDefined();

      const slots = result.updatedSlots!;
      expect(slots).toHaveLength(6);
      expect(slots.map((s) => s.representedRank)).toEqual([3, 4, 5, 6, 7, 8]);

      // 2 is now substituting for rank 7
      const slot2 = slots.find((s) => s.card.id === 'card-2s');
      expect(slot2).toBeDefined();
      expect(slot2?.representedRank).toBe(7);
      expect(slot2?.isWildcard).toBe(true);

      // Natural card 5 takes its rightful rank 5
      const slot5 = slots.find((s) => s.card.id === 'card-5s');
      expect(slot5?.representedRank).toBe(5);
      expect(slot5?.isWildcard).toBe(false);
    });

    it('shifts substituting 2 of a different suit upward: [10♥, J♥, 2♣(sub Q), K♥] + Q♥ and A♥ -> [10♥, J♥, Q♥, K♥, 2♣(sub A)] or extended', () => {
      const c10 = makeCard('HEARTS', 10, 'c-10h');
      const cJ = makeCard('HEARTS', 11, 'c-jh');
      const wild2Clubs = makeCard('CLUBS', 2, 'c-2c');
      const cK = makeCard('HEARTS', 13, 'c-kh');

      const initialRun = validateNewRun([c10, cJ, wild2Clubs, cK]);
      expect(initialRun.valid).toBe(true);

      const meld: Meld = {
        id: 'meld-hearts',
        team: 'B',
        type: 'RUN',
        suit: 'HEARTS',
        cards: [c10, cJ, wild2Clubs, cK],
        slots: initialRun.slots!,
      };

      const cQ = makeCard('HEARTS', 12, 'c-qh');
      // Natural Q arrives, replacing 2♣. Since 2 is clubs, it cannot slide to natural 2 of hearts.
      // 2♣ must shift up to rank 14 (Ace)!
      const result = canAddCardsToMeld(meld, [cQ]);
      expect(result.valid).toBe(true);

      const slots = result.updatedSlots!;
      expect(slots).toHaveLength(5);
      expect(slots.map((s) => s.representedRank)).toEqual([10, 11, 12, 13, 14]);

      const slot2 = slots.find((s) => s.card.id === 'c-2c');
      expect(slot2?.representedRank).toBe(14); // Acting as Ace of Hearts
      expect(slot2?.isWildcard).toBe(true);
    });
  });

  describe('Downward Slide Dynamics of 2 in Runs', () => {
    it('slides 2 of matching suit downward to natural 2 when replaced: [3♠, 4♠, 2♠(sub 5), 6♠] + 5♠ -> [2♠(nat 2), 3♠, 4♠, 5♠, 6♠]', () => {
      const card3 = makeCard('SPADES', 3, 'card-3s');
      const card4 = makeCard('SPADES', 4, 'card-4s');
      const wild2 = makeCard('SPADES', 2, 'card-2s');
      const card6 = makeCard('SPADES', 6, 'card-6s');

      const initialRun = validateNewRun([card3, card4, wild2, card6]);
      const meld: Meld = {
        id: 'meld-slide',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [card3, card4, wild2, card6],
        slots: initialRun.slots!,
      };

      const card5 = makeCard('SPADES', 5, 'card-5s');
      const result = canAddCardsToMeld(meld, [card5]);

      expect(result.valid).toBe(true);
      const slots = result.updatedSlots!;
      expect(slots).toHaveLength(5);
      expect(slots.map((s) => s.representedRank)).toEqual([2, 3, 4, 5, 6]);

      // 2 is now natural rank 2 and no longer wildcard
      const slot2 = slots.find((s) => s.card.id === 'card-2s');
      expect(slot2?.representedRank).toBe(2);
      expect(slot2?.isWildcard).toBe(false);
    });
  });

  describe('Adding Cards to Runs', () => {
    it('extends clean run at the lower end', () => {
      const cards = [makeCard('DIAMONDS', 7), makeCard('DIAMONDS', 8), makeCard('DIAMONDS', 9)];
      const initial = validateNewRun(cards);
      const meld: Meld = {
        id: 'm-dia',
        team: 'A',
        type: 'RUN',
        suit: 'DIAMONDS',
        cards,
        slots: initial.slots!,
      };

      const card6 = makeCard('DIAMONDS', 6);
      const res = canAddCardsToMeld(meld, [card6]);
      expect(res.valid).toBe(true);
      expect(res.updatedSlots?.map((s) => s.representedRank)).toEqual([6, 7, 8, 9]);
    });

    it('extends clean run at the higher end', () => {
      const cards = [makeCard('DIAMONDS', 7), makeCard('DIAMONDS', 8), makeCard('DIAMONDS', 9)];
      const initial = validateNewRun(cards);
      const meld: Meld = {
        id: 'm-dia',
        team: 'A',
        type: 'RUN',
        suit: 'DIAMONDS',
        cards,
        slots: initial.slots!,
      };

      const card10 = makeCard('DIAMONDS', 10);
      const res = canAddCardsToMeld(meld, [card10]);
      expect(res.valid).toBe(true);
      expect(res.updatedSlots?.map((s) => s.representedRank)).toEqual([7, 8, 9, 10]);
    });

    it('extends clean run at both ends simultaneously', () => {
      const cards = [makeCard('DIAMONDS', 7), makeCard('DIAMONDS', 8), makeCard('DIAMONDS', 9)];
      const initial = validateNewRun(cards);
      const meld: Meld = {
        id: 'm-dia',
        team: 'A',
        type: 'RUN',
        suit: 'DIAMONDS',
        cards,
        slots: initial.slots!,
      };

      const card6 = makeCard('DIAMONDS', 6);
      const card10 = makeCard('DIAMONDS', 10);
      const res = canAddCardsToMeld(meld, [card6, card10]);
      expect(res.valid).toBe(true);
      expect(res.updatedSlots?.map((s) => s.representedRank)).toEqual([6, 7, 8, 9, 10]);
    });

    it('adds 1 wildcard to a clean run', () => {
      const cards = [makeCard('CLUBS', 4), makeCard('CLUBS', 5), makeCard('CLUBS', 6)];
      const initial = validateNewRun(cards);
      const meld: Meld = {
        id: 'm-clubs',
        team: 'B',
        type: 'RUN',
        suit: 'CLUBS',
        cards,
        slots: initial.slots!,
      };

      const joker = makeCard(null, 0);
      const res = canAddCardsToMeld(meld, [joker]);
      expect(res.valid).toBe(true);
      expect(res.updatedSlots).toHaveLength(4);
    });

    it('rejects adding a second wildcard to a dirty run', () => {
      const cards = [makeCard('CLUBS', 4), makeCard('CLUBS', 5), makeCard(null, 0)];
      const initial = validateNewRun(cards);
      const meld: Meld = {
        id: 'm-dirty-run',
        team: 'B',
        type: 'RUN',
        suit: 'CLUBS',
        cards,
        slots: initial.slots!,
      };

      const secondWild = makeCard('SPADES', 2);
      const res = canAddCardsToMeld(meld, [secondWild]);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/more than 1 wildcard/);
    });

    it('rejects adding a card with the wrong suit to a run', () => {
      const cards = [makeCard('CLUBS', 4), makeCard('CLUBS', 5), makeCard('CLUBS', 6)];
      const initial = validateNewRun(cards);
      const meld: Meld = {
        id: 'm-clubs',
        team: 'B',
        type: 'RUN',
        suit: 'CLUBS',
        cards,
        slots: initial.slots!,
      };

      const wrongSuit = makeCard('HEARTS', 7);
      const res = canAddCardsToMeld(meld, [wrongSuit]);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/run suit/);
    });
  });

  describe('Adding Cards to Sets', () => {
    it('adds natural card of same rank to a set', () => {
      const cards = [makeCard('SPADES', 10), makeCard('HEARTS', 10), makeCard('DIAMONDS', 10)];
      const meld: Meld = {
        id: 'm-set-10',
        team: 'A',
        type: 'SET',
        rank: 10,
        cards,
        slots: cards.map((c) => ({ card: c, representedRank: 10, isWildcard: false })),
      };

      const c10Clubs = makeCard('CLUBS', 10);
      const res = canAddCardsToMeld(meld, [c10Clubs]);
      expect(res.valid).toBe(true);
      expect(res.updatedSlots).toHaveLength(4);
      expect(res.updatedSlots?.every((s) => s.representedRank === 10)).toBe(true);
    });

    it('adds a wildcard to a clean set', () => {
      const cards = [makeCard('SPADES', 10), makeCard('HEARTS', 10), makeCard('DIAMONDS', 10)];
      const meld: Meld = {
        id: 'm-set-10',
        team: 'A',
        type: 'SET',
        rank: 10,
        cards,
        slots: cards.map((c) => ({ card: c, representedRank: 10, isWildcard: false })),
      };

      const joker = makeCard(null, 0);
      const res = canAddCardsToMeld(meld, [joker]);
      expect(res.valid).toBe(true);
      expect(res.updatedSlots).toHaveLength(4);
      const jokerSlot = res.updatedSlots?.find((s) => s.isWildcard);
      expect(jokerSlot).toBeDefined();
      expect(jokerSlot?.representedRank).toBe(10);
    });

    it('rejects adding a second wildcard to a dirty set', () => {
      const cards = [makeCard('SPADES', 10), makeCard('HEARTS', 10), makeCard(null, 0)];
      const meld: Meld = {
        id: 'm-dirty-set',
        team: 'A',
        type: 'SET',
        rank: 10,
        cards,
        slots: [
          { card: cards[0], representedRank: 10, isWildcard: false },
          { card: cards[1], representedRank: 10, isWildcard: false },
          { card: cards[2], representedRank: 10, isWildcard: true },
        ],
      };

      const wild2 = makeCard('HEARTS', 2);
      const res = canAddCardsToMeld(meld, [wild2]);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/more than 1 wildcard/);
    });

    it('rejects adding a card of different rank to a set', () => {
      const cards = [makeCard('SPADES', 10), makeCard('HEARTS', 10), makeCard('DIAMONDS', 10)];
      const meld: Meld = {
        id: 'm-set-10',
        team: 'A',
        type: 'SET',
        rank: 10,
        cards,
        slots: cards.map((c) => ({ card: c, representedRank: 10, isWildcard: false })),
      };

      const cJ = makeCard('CLUBS', 11);
      const res = canAddCardsToMeld(meld, [cJ]);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/match the set rank/);
    });
  });

  describe('Integrity & Validation Guards', () => {
    it('rejects adding 0 cards', () => {
      const cards = [makeCard('SPADES', 7), makeCard('SPADES', 8), makeCard('SPADES', 9)];
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards,
        slots: cards.map((c) => ({ card: c, representedRank: c.rank, isWildcard: false })),
      };

      const res = canAddCardsToMeld(meld, []);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/at least 1 card/);
    });

    it('rejects adding a card already in the meld', () => {
      const card = makeCard('SPADES', 7, 'c-dup');
      const cards = [card, makeCard('SPADES', 8), makeCard('SPADES', 9)];
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards,
        slots: cards.map((c) => ({ card: c, representedRank: c.rank, isWildcard: false })),
      };

      const res = canAddCardsToMeld(meld, [card]);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/already in meld/);
    });

    it('rejects adding duplicate cards in cardsToAdd array', () => {
      const cards = [makeCard('SPADES', 7), makeCard('SPADES', 8), makeCard('SPADES', 9)];
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards,
        slots: cards.map((c) => ({ card: c, representedRank: c.rank, isWildcard: false })),
      };

      const card10 = makeCard('SPADES', 10, 'c10-same');
      const res = canAddCardsToMeld(meld, [card10, card10]);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Duplicate cards/);
    });

    it('preserves all cards originally in the meld (table permanence)', () => {
      const c4 = makeCard('HEARTS', 4, 'c-4');
      const c5 = makeCard('HEARTS', 5, 'c-5');
      const c6 = makeCard('HEARTS', 6, 'c-6');
      const meld: Meld = {
        id: 'm-perm',
        team: 'A',
        type: 'RUN',
        suit: 'HEARTS',
        cards: [c4, c5, c6],
        slots: [
          { card: c4, representedRank: 4, isWildcard: false },
          { card: c5, representedRank: 5, isWildcard: false },
          { card: c6, representedRank: 6, isWildcard: false },
        ],
      };

      const c7 = makeCard('HEARTS', 7, 'c-7');
      const res = canAddCardsToMeld(meld, [c7]);
      expect(res.valid).toBe(true);

      const returnedCardIds = res.updatedSlots!.map((s) => s.card.id);
      expect(returnedCardIds).toContain('c-4');
      expect(returnedCardIds).toContain('c-5');
      expect(returnedCardIds).toContain('c-6');
      expect(returnedCardIds).toContain('c-7');
    });
  });
});
