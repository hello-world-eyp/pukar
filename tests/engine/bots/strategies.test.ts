import { describe, it, expect } from 'vitest';
import { Card, GameState, Rank, Suit } from '../../../src/engine/types';
import { dealInitialState } from '../../../src/engine/deck';
import { BotMemory } from '../../../src/engine/bots/types';
import { decideSmartChachaTurn } from '../../../src/engine/bots/strategies/smart-chacha';
import { decideTheJadugarTurn } from '../../../src/engine/bots/strategies/the-jadugar';
import { decideFastChachiTurn } from '../../../src/engine/bots/strategies/fast-chachi';
import { decideTheLongTermGuyTurn } from '../../../src/engine/bots/strategies/the-long-term-guy';

describe('Bot Personality Strategies', () => {
  function makeCard(id: string, suit: Suit | null, rank: Rank, isNaturalJoker = false): Card {
    return {
      id,
      suit,
      rank,
      isNaturalJoker,
      isJoker: isNaturalJoker || rank === 2 || rank === 0,
    };
  }

  function createTestState(): GameState {
    const state = dealInitialState(4);
    state.currentPlayerIndex = 1; // Bot is player 1 (Team B)
    state.phase = 'DRAW';
    state.turnPhase = 'DRAW';
    return state;
  }

  function createEmptyMemory(): BotMemory {
    return {
      cardLog: [],
      bottomPickupsByPlayer: {},
      discardsByPlayer: {},
    };
  }

  describe('Fast Chachi Strategy', () => {
    it('always takes discard pile when pile has 3 or more cards (hoarder behavior)', () => {
      const state = createTestState();
      state.discardPile = [
        makeCard('dp1', 'SPADES', 4),
        makeCard('dp2', 'HEARTS', 8),
        makeCard('dp3', 'CLUBS', 10),
      ];

      const plan = decideFastChachiTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('TAKE_DISCARD');
    });

    it('prefers drawing stock when pile has fewer than 3 cards and no immediate meld', () => {
      const state = createTestState();
      state.players[1].hand = [
        makeCard('h1', 'HEARTS', 5),
        makeCard('h2', 'HEARTS', 7),
        makeCard('h3', 'HEARTS', 9),
      ];
      state.discardPile = [makeCard('dp1', 'SPADES', 4)];

      const plan = decideFastChachiTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('DRAW_FROM_STOCK');
    });

    it('never discards rank 2 or Natural Joker wildcards', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';
      state.players[1].hand = [
        makeCard('j1', null, 0, true), // Joker
        makeCard('w2', 'HEARTS', 2), // 2 Wildcard
        makeCard('c1', 'CLUBS', 9), // Normal card
      ];

      const plan = decideFastChachiTurn(state, 1, createEmptyMemory());
      expect(plan.discardAction.cardId).toBe('c1');
    });
  });

  describe('The Jadugar Strategy', () => {
    it('prefers drawing from stock to reach Pukar fast without bloating hand', () => {
      const state = createTestState();
      state.players[1].hand = [
        makeCard('h1', 'DIAMONDS', 3),
        makeCard('h2', 'HEARTS', 5),
        makeCard('h3', 'HEARTS', 7),
      ];
      state.discardPile = [
        makeCard('dp1', 'SPADES', 4),
        makeCard('dp2', 'HEARTS', 8),
        makeCard('dp3', 'CLUBS', 10),
      ];

      // Jadugar avoids bloating hand with junk cards from pile
      const plan = decideTheJadugarTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('DRAW_FROM_STOCK');
    });

    it('takes discard pile if top card allows an immediate meld towards Pukar', () => {
      const state = createTestState();
      // Hand has 3♠ and 4♠
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 3),
        makeCard('h2', 'SPADES', 4),
        makeCard('h3', 'HEARTS', 9),
      ];
      // Top of discard pile is 5♠
      state.discardPile = [makeCard('dp1', 'SPADES', 5)];

      const plan = decideTheJadugarTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('TAKE_DISCARD');
    });
  });

  describe('The Long-Term Guy Strategy', () => {
    it('focuses on building one sequence per suit', () => {
      const state = createTestState();
      // Team B already has a Spades run
      state.melds.B = [
        {
          id: 'meld-b-spades',
          team: 'B',
          type: 'RUN',
          suit: 'SPADES',
          cards: [
            makeCard('m1', 'SPADES', 4),
            makeCard('m2', 'SPADES', 5),
            makeCard('m3', 'SPADES', 6),
          ],
          slots: [
            { card: makeCard('m1', 'SPADES', 4), representedRank: 4, isWildcard: false },
            { card: makeCard('m2', 'SPADES', 5), representedRank: 5, isWildcard: false },
            { card: makeCard('m3', 'SPADES', 6), representedRank: 6, isWildcard: false },
          ],
        },
      ];

      // Hand has 3♠ (can add to existing run)
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 3),
        makeCard('h2', 'HEARTS', 9),
      ];
      state.phase = 'MELD';
      state.turnPhase = 'MELD';

      const plan = decideTheLongTermGuyTurn(state, 1, createEmptyMemory());
      // Should prioritize adding to the existing Spades sequence
      expect(plan.meldActions.some((a) => a.type === 'ADD_TO_MELD')).toBe(true);
    });
  });

  describe('Smart Chacha Strategy', () => {
    it('avoids discarding cards that opponents are logged to need', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';
      // Hand has 7♠ and 10♦
      state.players[1].hand = [
        makeCard('c1', 'SPADES', 7),
        makeCard('c2', 'DIAMONDS', 10),
      ];

      // Memory logs that Opponent (Player 0) picked up 6♠ from the bottom recently
      const memory: BotMemory = {
        cardLog: [
          {
            cardId: 'opp-6s',
            suit: 'SPADES',
            rank: 6,
            playerIndex: 0,
            action: 'PICKUP_BOTTOM',
            timestamp: Date.now(),
          },
        ],
        bottomPickupsByPlayer: {
          0: [makeCard('opp-6s', 'SPADES', 6)],
        },
        discardsByPlayer: {},
      };

      const plan = decideSmartChachaTurn(state, 1, memory);
      // Chacha predicts opponent needs 7♠, so Chacha discards 10♦ instead!
      expect(plan.discardAction.cardId).toBe('c2');
    });
  });

  describe('Discard Pile Pickup & Joker Intelligence', () => {
    it('all bots pick up the discard pile if it contains a Joker (rank 2 or Natural Joker)', () => {
      // 1. Jadugar picks up pile with Natural Joker
      const stateJadugar = createTestState();
      stateJadugar.players[1].hand = [
        makeCard('h1', 'CLUBS', 4),
        makeCard('h2', 'HEARTS', 8),
        makeCard('h3', 'DIAMONDS', 10),
      ];
      stateJadugar.discardPile = [
        makeCard('dp1', 'SPADES', 7),
        makeCard('joker', null, 0, true), // Natural Joker
      ];
      const planJadugar = decideTheJadugarTurn(stateJadugar, 1, createEmptyMemory());
      expect(planJadugar.drawAction.type).toBe('TAKE_DISCARD');

      // 2. Smart Chacha picks up pile with 2 Wildcard
      const stateChacha = createTestState();
      stateChacha.players[1].hand = [
        makeCard('h1', 'CLUBS', 4),
        makeCard('h2', 'HEARTS', 8),
      ];
      stateChacha.discardPile = [
        makeCard('dp1', 'SPADES', 7),
        makeCard('twoWild', 'HEARTS', 2), // 2 Wildcard
      ];
      const planChacha = decideSmartChachaTurn(stateChacha, 1, createEmptyMemory());
      expect(planChacha.drawAction.type).toBe('TAKE_DISCARD');

      // 3. Long Term Guy picks up pile with Joker
      const stateLT = createTestState();
      stateLT.players[1].hand = [
        makeCard('h1', 'CLUBS', 4),
        makeCard('h2', 'HEARTS', 8),
      ];
      stateLT.discardPile = [makeCard('joker2', null, 0, true)];
      const planLT = decideTheLongTermGuyTurn(stateLT, 1, createEmptyMemory());
      expect(planLT.drawAction.type).toBe('TAKE_DISCARD');
    });

    it('leaves a pile with a Joker ONLY when bot has 1 card in hand and 0 Pukars left to go out cleanly', () => {
      const state = createTestState();
      state.pukarPool = []; // 0 Pukars remaining
      state.players[1].hand = [makeCard('lastCard', 'SPADES', 9)]; // Exactly 1 card left
      state.discardPile = [
        makeCard('dp1', 'HEARTS', 5),
        makeCard('joker', null, 0, true), // Joker in multi-card pile
      ];

      // Jadugar leaves the multi-card pile to draw 1 card and go out cleanly
      const plan = decideTheJadugarTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('DRAW_FROM_STOCK');
    });

    it('bots pick up discard pile when the top card connects with hand (pair or consecutive rank)', () => {
      // Hand has 7♠. Top of discard pile is 8♠ (consecutive rank in same suit)
      const state = createTestState();
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 7),
        makeCard('h2', 'CLUBS', 4),
        makeCard('h3', 'DIAMONDS', 10),
      ];
      state.discardPile = [
        makeCard('dp1', 'HEARTS', 3),
        makeCard('dp2', 'SPADES', 8), // Connects with 7♠
      ];

      const planChacha = decideSmartChachaTurn(state, 1, createEmptyMemory());
      expect(planChacha.drawAction.type).toBe('TAKE_DISCARD');

      const planLT = decideTheLongTermGuyTurn(state, 1, createEmptyMemory());
      expect(planLT.drawAction.type).toBe('TAKE_DISCARD');
    });

    it('Smart Chacha and The Long-Term Guy pick up discard pile when it has 3 or more cards', () => {
      const state = createTestState();
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 4),
        makeCard('h2', 'HEARTS', 9),
      ];
      state.discardPile = [
        makeCard('dp1', 'CLUBS', 3),
        makeCard('dp2', 'DIAMONDS', 7),
        makeCard('dp3', 'CLUBS', 11),
      ];

      const planChacha = decideSmartChachaTurn(state, 1, createEmptyMemory());
      expect(planChacha.drawAction.type).toBe('TAKE_DISCARD');

      const planLT = decideTheLongTermGuyTurn(state, 1, createEmptyMemory());
      expect(planLT.drawAction.type).toBe('TAKE_DISCARD');
    });

    it('The Jadugar picks up discard pile when it has 4 or more cards', () => {
      const state = createTestState();
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 4),
        makeCard('h2', 'HEARTS', 9),
      ];
      state.discardPile = [
        makeCard('dp1', 'CLUBS', 3),
        makeCard('dp2', 'DIAMONDS', 7),
        makeCard('dp3', 'CLUBS', 11),
        makeCard('dp4', 'HEARTS', 13),
      ];

      const plan = decideTheJadugarTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('TAKE_DISCARD');
    });
  });

  describe('Wildcard 2 Same-Suit Preference', () => {
    it('bots prefer using the suited 2 over cross-suit 2 in runs when not close to Pukar', () => {
      const state = createTestState();
      state.phase = 'MELD';
      state.turnPhase = 'MELD';
      // Hand has 5+ cards (not close to Pukar: hand.length > 4)
      state.players[1].hand = [
        makeCard('s3', 'SPADES', 3),
        makeCard('s4', 'SPADES', 4),
        makeCard('twoDiamonds', 'DIAMONDS', 2), // Cross-suit 2
        makeCard('twoSpades', 'SPADES', 2), // Suited 2
        makeCard('h7', 'HEARTS', 7),
        makeCard('h8', 'HEARTS', 8),
      ];

      const plan = decideSmartChachaTurn(state, 1, createEmptyMemory());
      expect(plan.meldActions.length).toBeGreaterThan(0);
      const newMeldAction = plan.meldActions.find((a) => a.type === 'PLAY_NEW_MELD');
      expect(newMeldAction).toBeDefined();
      if (newMeldAction && 'cardIds' in newMeldAction) {
        // Must contain suited 2 (twoSpades) and NOT cross-suit 2 (twoDiamonds)
        expect(newMeldAction.cardIds).toContain('twoSpades');
        expect(newMeldAction.cardIds).not.toContain('twoDiamonds');
      }
    });
  });
});

