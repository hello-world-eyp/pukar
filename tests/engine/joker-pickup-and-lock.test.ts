import { describe, it, expect } from 'vitest';
import { Card, Meld, Suit, Rank } from '../../src/engine/types';
import {
  canAddCardsToMeld,
  validateNewRun,
  getRunCandidateOptions,
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

describe('Normal Joker Pickup & Immutability vs "2" Wildcard', () => {
  describe('Normal Joker Auto Pickup in Runs', () => {
    it('auto picks up the Normal Joker into hand when replaced by the natural card it represents', () => {
      const card5 = makeCard('c5s', 'SPADES', 5);
      const joker = makeCard('joker1', null, 0, true);
      const card7 = makeCard('c7s', 'SPADES', 7);

      const meld: Meld = {
        id: 'meld-run-joker',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [card5, joker, card7],
        slots: [
          { card: card5, representedRank: 5, representedSuit: 'SPADES', isWildcard: false },
          { card: joker, representedRank: 6, representedSuit: 'SPADES', isWildcard: true },
          { card: card7, representedRank: 7, representedSuit: 'SPADES', isWildcard: false },
        ],
      };

      const card6 = makeCard('c6s', 'SPADES', 6);
      const result = canAddCardsToMeld(meld, [card6]);

      expect(result.valid).toBe(true);
      expect(result.pickedUpCard).toBeDefined();
      expect(result.pickedUpCard?.id).toBe('joker1');

      // Updated meld slots contain [5♠, 6♠, 7♠] - all natural, 0 wildcards!
      expect(result.updatedSlots).toHaveLength(3);
      expect(result.updatedSlots?.map((s) => s.representedRank)).toEqual([5, 6, 7]);
      expect(result.updatedSlots?.every((s) => !s.isWildcard)).toBe(true);
      expect(result.updatedSlots?.some((s) => s.card.id === 'joker1')).toBe(false);
    });

    it('replaces Normal Joker and extends run when multiple cards are added simultaneously', () => {
      const card5 = makeCard('c5s', 'SPADES', 5);
      const joker = makeCard('joker1', null, 0, true);
      const card7 = makeCard('c7s', 'SPADES', 7);

      const meld: Meld = {
        id: 'meld-run-joker',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [card5, joker, card7],
        slots: [
          { card: card5, representedRank: 5, representedSuit: 'SPADES', isWildcard: false },
          { card: joker, representedRank: 6, representedSuit: 'SPADES', isWildcard: true },
          { card: card7, representedRank: 7, representedSuit: 'SPADES', isWildcard: false },
        ],
      };

      // Adding 6♠ (replacing Joker) and 8♠ (extending run)
      const card6 = makeCard('c6s', 'SPADES', 6);
      const card8 = makeCard('c8s', 'SPADES', 8);
      const result = canAddCardsToMeld(meld, [card6, card8]);

      expect(result.valid).toBe(true);
      expect(result.pickedUpCard?.id).toBe('joker1');
      expect(result.updatedSlots?.map((s) => s.representedRank)).toEqual([5, 6, 7, 8]);
      expect(result.updatedSlots?.every((s) => !s.isWildcard)).toBe(true);
    });

    it('auto picks up the Normal Joker when replaced by an Ace (rank 14) representing low Ace (representedRank: 1)', () => {
      const card2 = makeCard('c2d', 'DIAMONDS', 2);
      const card3 = makeCard('c3d', 'DIAMONDS', 3);
      const card4 = makeCard('c4d', 'DIAMONDS', 4);
      const card5 = makeCard('c5d', 'DIAMONDS', 5);
      const card6 = makeCard('c6d', 'DIAMONDS', 6);
      const joker = makeCard('joker1', null, 0, true);

      const meld: Meld = {
        id: 'meld-run-joker-ace',
        team: 'A',
        type: 'RUN',
        suit: 'DIAMONDS',
        cards: [card6, card5, card4, card3, card2, joker],
        slots: [
          { card: joker, representedRank: 1, representedSuit: 'DIAMONDS', isWildcard: true },
          { card: card2, representedRank: 2, representedSuit: 'DIAMONDS', isWildcard: false },
          { card: card3, representedRank: 3, representedSuit: 'DIAMONDS', isWildcard: false },
          { card: card4, representedRank: 4, representedSuit: 'DIAMONDS', isWildcard: false },
          { card: card5, representedRank: 5, representedSuit: 'DIAMONDS', isWildcard: false },
          { card: card6, representedRank: 6, representedSuit: 'DIAMONDS', isWildcard: false },
        ],
      };

      const aceCard = makeCard('cAd', 'DIAMONDS', 14);
      const result = canAddCardsToMeld(meld, [aceCard]);

      expect(result.valid).toBe(true);
      expect(result.pickedUpCard).toBeDefined();
      expect(result.pickedUpCard?.id).toBe('joker1');
      expect(result.updatedSlots).toHaveLength(6);
      expect(result.updatedSlots?.map((s) => s.representedRank)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(result.updatedSlots?.every((s) => !s.isWildcard)).toBe(true);
      expect(result.updatedSlots?.find((s) => s.representedRank === 1)?.card.id).toBe('cAd');
    });
  });

  describe('Normal Joker Immutability (Cannot Shift Up or Down)', () => {
    it('allows extending run when the Normal Joker stays at its designated rank', () => {
      const card5 = makeCard('c5s', 'SPADES', 5);
      const joker = makeCard('joker1', null, 0, true);
      const card7 = makeCard('c7s', 'SPADES', 7);

      const meld: Meld = {
        id: 'meld-run-joker',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [card5, joker, card7],
        slots: [
          { card: card5, representedRank: 5, representedSuit: 'SPADES', isWildcard: false },
          { card: joker, representedRank: 6, representedSuit: 'SPADES', isWildcard: true },
          { card: card7, representedRank: 7, representedSuit: 'SPADES', isWildcard: false },
        ],
      };

      // Adding 8♠: Joker remains at 6♠
      const card8 = makeCard('c8s', 'SPADES', 8);
      const result8 = canAddCardsToMeld(meld, [card8]);
      expect(result8.valid).toBe(true);
      expect(result8.pickedUpCard).toBeUndefined(); // Joker is not replaced
      const jokerSlot8 = result8.updatedSlots?.find((s) => s.card.id === 'joker1');
      expect(jokerSlot8?.representedRank).toBe(6);

      // Adding 4♠: Joker remains at 6♠
      const card4 = makeCard('c4s', 'SPADES', 4);
      const result4 = canAddCardsToMeld(meld, [card4]);
      expect(result4.valid).toBe(true);
      const jokerSlot4 = result4.updatedSlots?.find((s) => s.card.id === 'joker1');
      expect(jokerSlot4?.representedRank).toBe(6);
    });

    it('rejects adding cards that would force the Normal Joker to shift without playing its replacement', () => {
      // Meld has [4♠, 5♠, Joker(as 6♠)]
      const card4 = makeCard('c4s', 'SPADES', 4);
      const card5 = makeCard('c5s', 'SPADES', 5);
      const joker = makeCard('joker1', null, 0, true);

      const meld: Meld = {
        id: 'meld-fixed-joker',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [card4, card5, joker],
        slots: [
          { card: card4, representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
          { card: card5, representedRank: 5, representedSuit: 'SPADES', isWildcard: false },
          { card: joker, representedRank: 6, representedSuit: 'SPADES', isWildcard: true },
        ],
      };

      // Attempt to add 2♠ while expecting Joker to shift from 6♠ down to 3♠:
      // Since Joker was placed as 6♠, it cannot shift to 3♠ unless 6♠ is played!
      const card2 = makeCard('c2s', 'SPADES', 2);
      const result = canAddCardsToMeld(meld, [card2]);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/cannot shift/i);
    });
  });

  describe('Normal Joker Auto Pickup in Sets', () => {
    it('auto picks up the Normal Joker into hand when replaced by a matching natural card in a set', () => {
      const c8s = makeCard('c8s', 'SPADES', 8);
      const c8h = makeCard('c8h', 'HEARTS', 8);
      const joker = makeCard('joker1', null, 0, true);

      const meld: Meld = {
        id: 'meld-set-joker',
        team: 'B',
        type: 'SET',
        rank: 8,
        cards: [c8s, c8h, joker],
        slots: [
          { card: c8s, representedRank: 8, isWildcard: false },
          { card: c8h, representedRank: 8, isWildcard: false },
          { card: joker, representedRank: 8, isWildcard: true },
        ],
      };

      const c8d = makeCard('c8d', 'DIAMONDS', 8);
      const result = canAddCardsToMeld(meld, [c8d]);

      expect(result.valid).toBe(true);
      expect(result.pickedUpCard?.id).toBe('joker1');
      expect(result.updatedSlots).toHaveLength(3);
      expect(result.updatedSlots?.every((s) => !s.isWildcard)).toBe(true);
    });
  });

  describe('Contrast: "2" Wildcard is NEVER Picked Up', () => {
    it('shifts a "2" wildcard on table and does NOT pick it up into hand', () => {
      const card3 = makeCard('c3', 'SPADES', 3);
      const card4 = makeCard('c4', 'SPADES', 4);
      const twoSpades = makeCard('twoSpades', 'SPADES', 2);
      const card6 = makeCard('c6', 'SPADES', 6);

      const meld: Meld = {
        id: 'meld-two-wild',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [card3, card4, twoSpades, card6],
        slots: [
          { card: card3, representedRank: 3, representedSuit: 'SPADES', isWildcard: false },
          { card: card4, representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
          { card: twoSpades, representedRank: 5, representedSuit: 'SPADES', isWildcard: true },
          { card: card6, representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
        ],
      };

      const card5 = makeCard('c5', 'SPADES', 5);
      const result = canAddCardsToMeld(meld, [card5]);

      expect(result.valid).toBe(true);
      // "2" is permanent on table and NOT picked up to hand!
      expect(result.pickedUpCard).toBeUndefined();
      // "2" slid down to natural rank 2
      const slot2 = result.updatedSlots?.find((s) => s.card.id === 'twoSpades');
      expect(slot2?.representedRank).toBe(2);
      expect(slot2?.isWildcard).toBe(false);
    });
  });

  describe('Prompt Options & Designation for New Runs with Normal Joker', () => {
    it('generates options [3♠, 6♠] when forming a run of 3: [4♠, 5♠, Joker]', () => {
      const cards = [
        makeCard('c4s', 'SPADES', 4),
        makeCard('c5s', 'SPADES', 5),
        makeCard('joker', null, 0, true),
      ];

      const options = getRunCandidateOptions(cards);
      expect(options).toHaveLength(2);
      expect(options[0].rank).toBe(3);
      expect(options[0].label).toContain('3 of Spades');
      expect(options[1].rank).toBe(6);
      expect(options[1].label).toContain('6 of Spades');
    });

    it('generates options [A♥, 4♥] when forming run [2♥, 3♥, Joker]', () => {
      const cards = [
        makeCard('c2h', 'HEARTS', 2),
        makeCard('c3h', 'HEARTS', 3),
        makeCard('joker', null, 0, true),
      ];

      const options = getRunCandidateOptions(cards);
      expect(options).toHaveLength(2);
      expect(options[0].rank).toBe(1);
      expect(options[0].label).toContain('Ace of Hearts');
      expect(options[1].rank).toBe(4);
      expect(options[1].label).toContain('4 of Hearts');
    });

    it('generates single option [6♠] for sandwiched Joker: [5♠, Joker, 7♠]', () => {
      const cards = [
        makeCard('c5s', 'SPADES', 5),
        makeCard('joker', null, 0, true),
        makeCard('c7s', 'SPADES', 7),
      ];

      const options = getRunCandidateOptions(cards);
      expect(options).toHaveLength(1);
      expect(options[0].rank).toBe(6);
      expect(options[0].label).toContain('6 of Spades');
    });

    it('honors targetJokerRank to designate Joker at rank 3 for [4♠, 5♠, Joker]', () => {
      const cards = [
        makeCard('c4s', 'SPADES', 4),
        makeCard('c5s', 'SPADES', 5),
        makeCard('joker', null, 0, true),
      ];

      const result = validateNewRun(cards, 3);
      expect(result.valid).toBe(true);
      expect(result.slots?.map((s) => s.representedRank)).toEqual([3, 4, 5]);
      const jokerSlot = result.slots?.find((s) => s.card.id === 'joker');
      expect(jokerSlot?.representedRank).toBe(3);
    });

    it('honors targetJokerRank to designate Joker at rank 6 for [4♠, 5♠, Joker]', () => {
      const cards = [
        makeCard('c4s', 'SPADES', 4),
        makeCard('c5s', 'SPADES', 5),
        makeCard('joker', null, 0, true),
      ];

      const result = validateNewRun(cards, 6);
      expect(result.valid).toBe(true);
      expect(result.slots?.map((s) => s.representedRank)).toEqual([4, 5, 6]);
      const jokerSlot = result.slots?.find((s) => s.card.id === 'joker');
      expect(jokerSlot?.representedRank).toBe(6);
    });
  });

  describe('Full Reducer Turn Integration: Pick Up Joker & Drop Down in Another Meld', () => {
    it('picks up Joker into hand when ADD_TO_MELD plays natural replacement, then allows playing that Joker in another meld', () => {
      const initialState = dealInitialState(4);
      const card5 = makeCard('card-5s', 'SPADES', 5);
      const joker = makeCard('card-joker', null, 0, true);
      const card7 = makeCard('card-7s', 'SPADES', 7);

      const tableMeld: Meld = {
        id: 'meld-team-a-1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [card5, joker, card7],
        slots: [
          { card: card5, representedRank: 5, representedSuit: 'SPADES', isWildcard: false },
          { card: joker, representedRank: 6, representedSuit: 'SPADES', isWildcard: true },
          { card: card7, representedRank: 7, representedSuit: 'SPADES', isWildcard: false },
        ],
      };

      // Player 1 has 6♠ (to replace the Joker) and [10♥, J♥] in hand
      const card6 = makeCard('card-6s', 'SPADES', 6);
      const card10h = makeCard('card-10h', 'HEARTS', 10);
      const cardJh = makeCard('card-jh', 'HEARTS', 11);

      const stateWithMeld = {
        ...initialState,
        phase: 'MELD' as const,
        turnPhase: 'MELD' as const,
        melds: {
          ...initialState.melds,
          A: [tableMeld],
        },
        players: initialState.players.map((p, idx) =>
          idx === 0 ? { ...p, hand: [card6, card10h, cardJh, ...p.hand] } : p
        ),
      };

      // 1. Player adds 6♠ to the meld
      const addResult = pukarReducer(stateWithMeld, {
        type: 'ADD_TO_MELD',
        meldId: 'meld-team-a-1',
        cardIds: ['card-6s'],
      });

      expect(addResult.error).toBeUndefined();
      const afterAddState = addResult.state;

      // Table meld now has [5♠, 6♠, 7♠]
      const updatedTableMeld = afterAddState.melds.A[0];
      expect(updatedTableMeld.cards.some((c) => c.id === 'card-joker')).toBe(false);
      expect(updatedTableMeld.cards.some((c) => c.id === 'card-6s')).toBe(true);
      expect(updatedTableMeld.slots.every((s) => !s.isWildcard)).toBe(true);

      // Player's hand lost 6♠ and GAINED the Joker!
      const playerHand = afterAddState.players[0].hand;
      expect(playerHand.some((c) => c.id === 'card-6s')).toBe(false);
      expect(playerHand.some((c) => c.id === 'card-joker')).toBe(true);
      expect(afterAddState.lastPickedUpCard?.id).toBe('card-joker');

      // 2. Player now uses the picked-up Joker to drop down in a new meld: [10♥, J♥, Joker]
      const meldResult = pukarReducer(afterAddState, {
        type: 'PLAY_NEW_MELD',
        cardIds: ['card-10h', 'card-jh', 'card-joker'],
        jokerRepresentedRank: 12, // Queen of Hearts
      });

      expect(meldResult.error).toBeUndefined();
      expect(meldResult.state.melds.A).toHaveLength(2);
      const newMeld = meldResult.state.melds.A[1];
      expect(newMeld.type).toBe('RUN');
      expect(newMeld.suit).toBe('HEARTS');
      const jokerSlot = newMeld.slots.find((s) => s.card.id === 'card-joker');
      expect(jokerSlot?.representedRank).toBe(12);
      expect(jokerSlot?.isWildcard).toBe(true);
    });

    it('picks up Joker into hand when ADD_TO_MELD replaces low Ace (rank 1 Joker) with Ace of Diamonds (rank 14 card)', () => {
      const initialState = dealInitialState(4);
      const card2d = makeCard('card-2d', 'DIAMONDS', 2);
      const card3d = makeCard('card-3d', 'DIAMONDS', 3);
      const card4d = makeCard('card-4d', 'DIAMONDS', 4);
      const card5d = makeCard('card-5d', 'DIAMONDS', 5);
      const card6d = makeCard('card-6d', 'DIAMONDS', 6);
      const joker = makeCard('card-joker-d', null, 0, true);

      const tableMeld: Meld = {
        id: 'meld-diamonds-impure',
        team: 'A',
        type: 'RUN',
        suit: 'DIAMONDS',
        cards: [card6d, card5d, card4d, card3d, card2d, joker],
        slots: [
          { card: card6d, representedRank: 6, representedSuit: 'DIAMONDS', isWildcard: false },
          { card: card5d, representedRank: 5, representedSuit: 'DIAMONDS', isWildcard: false },
          { card: card4d, representedRank: 4, representedSuit: 'DIAMONDS', isWildcard: false },
          { card: card3d, representedRank: 3, representedSuit: 'DIAMONDS', isWildcard: false },
          { card: card2d, representedRank: 2, representedSuit: 'DIAMONDS', isWildcard: false },
          { card: joker, representedRank: 1, representedSuit: 'DIAMONDS', isWildcard: true },
        ],
      };

      const aceCard = makeCard('card-ad', 'DIAMONDS', 14);

      // Player 3 (index 2 in 4-player game, Team A) has Ace of Diamonds in hand
      const stateWithMeld = {
        ...initialState,
        currentPlayerIndex: 2,
        phase: 'MELD' as const,
        turnPhase: 'MELD' as const,
        melds: {
          ...initialState.melds,
          A: [tableMeld],
        },
        players: initialState.players.map((p, idx) =>
          idx === 2 ? { ...p, hand: [aceCard, ...p.hand] } : p
        ),
      };

      const addResult = pukarReducer(stateWithMeld, {
        type: 'ADD_TO_MELD',
        meldId: 'meld-diamonds-impure',
        cardIds: ['card-ad'],
      });

      expect(addResult.error).toBeUndefined();
      const updatedMeld = addResult.state.melds.A[0];
      // Joker was removed from table
      expect(updatedMeld.cards.some((c) => c.id === 'card-joker-d')).toBe(false);
      // Ace was added to table
      expect(updatedMeld.cards.some((c) => c.id === 'card-ad')).toBe(true);
      // Run is now natural 1-6 Diamonds
      expect(updatedMeld.slots.map((s) => s.representedRank)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(updatedMeld.slots.every((s) => !s.isWildcard)).toBe(true);

      // Player's hand lost Ace and GAINED the Joker
      const playerHand = addResult.state.players[2].hand;
      expect(playerHand.some((c) => c.id === 'card-ad')).toBe(false);
      expect(playerHand.some((c) => c.id === 'card-joker-d')).toBe(true);
      expect(addResult.state.lastPickedUpCard?.id).toBe('card-joker-d');
    });
  });
});
