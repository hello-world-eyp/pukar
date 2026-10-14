import { describe, it, expect } from 'vitest';
import { Card, GameState, Meld, Rank, Suit } from '../../../src/engine/types';
import { dealInitialState } from '../../../src/engine/deck';
import { pukarReducer } from '../../../src/engine/reducer';
import { BotMemory } from '../../../src/engine/bots/types';
import {
  decideSmartChachaTurn,
  predictOpponentWants,
  predictPartnerNeeds,
} from '../../../src/engine/bots/strategies/smart-chacha';
import { decideTheJadugarTurn } from '../../../src/engine/bots/strategies/the-jadugar';
import { decideFastChachiTurn } from '../../../src/engine/bots/strategies/fast-chachi';
import { decideTheLongTermGuyTurn } from '../../../src/engine/bots/strategies/the-long-term-guy';
import {
  findBestMeldPlan,
  findPotentialAdditionsToMelds,
  evaluateDeadwoodAndDiscard,
} from '../../../src/engine/bots/hand-analyzer';
import { createInitialBotMemory, selectBotPukarDeck } from '../../../src/engine/bots/bot-player';

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

    it('leaves a 3-card pile of disconnected junk to draw from stock deck when holding over 14 cards (hoarding ceiling)', () => {
      const state = createTestState();
      // 16 cards in hand (disconnected deadwood, no melds, no 2s, no Jokers)
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 4),
        makeCard('h2', 'HEARTS', 8),
        makeCard('h3', 'CLUBS', 12),
        makeCard('h4', 'DIAMONDS', 6),
        makeCard('h5', 'SPADES', 10),
        makeCard('h6', 'HEARTS', 4),
        makeCard('h7', 'CLUBS', 7),
        makeCard('h8', 'DIAMONDS', 11),
        makeCard('h9', 'SPADES', 13),
        makeCard('h10', 'HEARTS', 6),
        makeCard('h11', 'CLUBS', 9),
        makeCard('h12', 'DIAMONDS', 4),
        makeCard('h13', 'SPADES', 7),
        makeCard('h14', 'HEARTS', 11),
        makeCard('h15', 'CLUBS', 5),
        makeCard('h16', 'DIAMONDS', 9),
      ];
      // 3-card pile of disconnected junk
      state.discardPile = [
        makeCard('dp1', 'CLUBS', 3),
        makeCard('dp2', 'DIAMONDS', 8),
        makeCard('dp3', 'HEARTS', 10),
      ];

      const plan = decideFastChachiTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('DRAW_FROM_STOCK');
    });

    it('still takes a 3-card pile when holding over 14 cards if it contains a Joker or forms an immediate meld', () => {
      const state = createTestState();
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 4),
        makeCard('h2', 'HEARTS', 8),
        makeCard('h3', 'CLUBS', 12),
        makeCard('h4', 'DIAMONDS', 6),
        makeCard('h5', 'SPADES', 10),
        makeCard('h6', 'HEARTS', 4),
        makeCard('h7', 'CLUBS', 7),
        makeCard('h8', 'DIAMONDS', 11),
        makeCard('h9', 'SPADES', 13),
        makeCard('h10', 'HEARTS', 6),
        makeCard('h11', 'CLUBS', 9),
        makeCard('h12', 'DIAMONDS', 8),
        makeCard('h13', 'SPADES', 7),
        makeCard('h14', 'HEARTS', 11),
        makeCard('h15', 'CLUBS', 5),
        makeCard('h16', 'DIAMONDS', 9),
      ];

      // Case A: 3-card pile containing a Joker
      state.discardPile = [
        makeCard('dp1', 'CLUBS', 3),
        makeCard('joker', null, 0, true),
        makeCard('dp3', 'HEARTS', 10),
      ];
      let plan = decideFastChachiTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('TAKE_DISCARD');

      // Case B: 3-card pile creating an immediate meld (8♦ + 9♦ + 10♦ pure run)
      state.discardPile = [
        makeCard('dp1', 'CLUBS', 3),
        makeCard('dp2', 'SPADES', 5),
        makeCard('dp3', 'DIAMONDS', 10),
      ];
      plan = decideFastChachiTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('TAKE_DISCARD');
    });

    it('still takes a 3-card pile of junk when holding 12 cards (standard hoarding when <= 14 cards)', () => {
      const state = createTestState();
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 4),
        makeCard('h2', 'HEARTS', 8),
        makeCard('h3', 'CLUBS', 12),
        makeCard('h4', 'DIAMONDS', 6),
        makeCard('h5', 'SPADES', 10),
        makeCard('h6', 'HEARTS', 4),
        makeCard('h7', 'CLUBS', 7),
        makeCard('h8', 'DIAMONDS', 11),
        makeCard('h9', 'SPADES', 13),
        makeCard('h10', 'HEARTS', 6),
        makeCard('h11', 'CLUBS', 9),
        makeCard('h12', 'DIAMONDS', 4),
      ];
      state.discardPile = [
        makeCard('dp1', 'CLUBS', 3),
        makeCard('dp2', 'DIAMONDS', 8),
        makeCard('dp3', 'HEARTS', 10),
      ];

      const plan = decideFastChachiTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('TAKE_DISCARD');
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

    it('leaves a 3-card discard pile with loose gap-2 connectors and draws from stock deck instead', () => {
      const state = createTestState();
      // Hand has 7♠ (gap-2 connector to 5♠)
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 7),
        makeCard('h2', 'HEARTS', 10),
        makeCard('h3', 'DIAMONDS', 13),
      ];
      // 3-card discard pile with top card 5♠ (gap-2 connector, not tight pair/run) and no immediate meld
      state.discardPile = [
        makeCard('dp1', 'CLUBS', 3),
        makeCard('dp2', 'DIAMONDS', 8),
        makeCard('dp3', 'SPADES', 5),
      ];

      const plan = decideTheJadugarTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('DRAW_FROM_STOCK');
    });

    it('leaves a 3-card discard pile with multiple loose connectors and draws from stock deck instead', () => {
      const state = createTestState();
      // Hand has 7♠
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 7),
        makeCard('h2', 'HEARTS', 10),
        makeCard('h3', 'DIAMONDS', 13),
      ];
      // Pile has 9♠ (gap-2) and 5♠ (gap-2) - totalConnectingInPile = 2, but no immediate meld
      state.discardPile = [
        makeCard('dp1', 'SPADES', 9),
        makeCard('dp2', 'CLUBS', 3),
        makeCard('dp3', 'SPADES', 5),
      ];

      const plan = decideTheJadugarTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('DRAW_FROM_STOCK');
    });

    it('leaves a 4-card discard pile of disconnected deadwood and draws from stock deck', () => {
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
      expect(plan.drawAction.type).toBe('DRAW_FROM_STOCK');
    });

    it('takes a 1- or 2-card pile with a tight connector (pair or adjacent run connector)', () => {
      const state = createTestState();
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 7),
        makeCard('h2', 'HEARTS', 10),
        makeCard('h3', 'DIAMONDS', 13),
      ];

      // 1-card pile with adjacent rank 8♠
      state.discardPile = [makeCard('dp1', 'SPADES', 8)];
      let plan = decideTheJadugarTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('TAKE_DISCARD');

      // 2-card pile with adjacent rank 8♠
      state.discardPile = [
        makeCard('dp0', 'CLUBS', 3),
        makeCard('dp1', 'SPADES', 8),
      ];
      plan = decideTheJadugarTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('TAKE_DISCARD');

      // 2-card pile with rank pair (7♥ with 7♠)
      state.discardPile = [
        makeCard('dp0', 'CLUBS', 3),
        makeCard('dp1', 'HEARTS', 7),
      ];
      plan = decideTheJadugarTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('TAKE_DISCARD');
    });

    it('still takes any pile containing a Joker or creating an immediate meld', () => {
      const state = createTestState();
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 7),
        makeCard('h2', 'HEARTS', 10),
        makeCard('h3', 'DIAMONDS', 13),
      ];

      // Multi-card pile containing a Joker (even if otherwise disconnected)
      state.discardPile = [
        makeCard('dp1', 'CLUBS', 3),
        makeCard('dp2', 'DIAMONDS', 8),
        makeCard('joker', null, 0, true),
        makeCard('dp3', 'HEARTS', 4),
      ];
      let plan = decideTheJadugarTurn(state, 1, createEmptyMemory());
      expect(plan.drawAction.type).toBe('TAKE_DISCARD');

      // Multi-card pile creating an immediate meld (hand has 7♠, 8♠, pile top is 9♠)
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 7),
        makeCard('h2', 'SPADES', 8),
        makeCard('h3', 'HEARTS', 10),
      ];
      state.discardPile = [
        makeCard('dp1', 'CLUBS', 3),
        makeCard('dp2', 'DIAMONDS', 8),
        makeCard('dp3', 'SPADES', 9),
      ];
      plan = decideTheJadugarTurn(state, 1, createEmptyMemory());
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

    it('adds cards to existing table sequences with hand [10♦, K♥, 9♦, Q♥, Q♥] without emitting duplicate rank additions', () => {
      const state = createTestState();
      state.phase = 'MELD';
      state.turnPhase = 'MELD';
      // Hand matches user screenshot
      state.players[1].hand = [
        makeCard('d10', 'DIAMONDS', 10),
        makeCard('hk', 'HEARTS', 13),
        makeCard('d9', 'DIAMONDS', 9),
        makeCard('hq1', 'HEARTS', 12),
        makeCard('hq2', 'HEARTS', 12),
      ];

      // Table has Hearts run [9♥, 10♥, J♥]
      state.melds.B = [
        {
          id: 'meld-b-hearts',
          team: 'B',
          type: 'RUN',
          suit: 'HEARTS',
          cards: [
            makeCard('h9', 'HEARTS', 9),
            makeCard('h10', 'HEARTS', 10),
            makeCard('hj', 'HEARTS', 11),
          ],
          slots: [
            { card: makeCard('h9', 'HEARTS', 9), representedRank: 9, isWildcard: false },
            { card: makeCard('h10', 'HEARTS', 10), representedRank: 10, isWildcard: false },
            { card: makeCard('hj', 'HEARTS', 11), representedRank: 11, isWildcard: false },
          ],
        },
      ];

      const plan = decideTheLongTermGuyTurn(state, 1, createEmptyMemory());
      // Should add K♥ and Q♥_1 to the Hearts sequence
      expect(plan.meldActions.length).toBe(1);
      expect(plan.meldActions[0].type).toBe('ADD_TO_MELD');
      const addAct = plan.meldActions[0] as { type: 'ADD_TO_MELD'; meldId: string; cardIds: string[] };
      expect(addAct.cardIds).toContain('hk');
      expect(addAct.cardIds.filter((id) => id === 'hq1' || id === 'hq2').length).toBe(1);
      // Must NOT attempt to add the second Queen (which causes duplicate rank error)
      expect(plan.meldActions.some((a, idx) => idx > 0 && a.type === 'ADD_TO_MELD')).toBe(false);
    });

    it('iteratively melds all multi-card sequence additions (e.g. 8♦, 9♦, 10♦ to J♦-Q♦-K♦) on the table', () => {
      const state = createTestState();
      state.phase = 'MELD';
      state.turnPhase = 'MELD';
      // Table has J♦, Q♦, K♦
      state.melds.B = [
        {
          id: 'meld-b-diamonds',
          team: 'B',
          type: 'RUN',
          suit: 'DIAMONDS',
          cards: [
            makeCard('dj', 'DIAMONDS', 11),
            makeCard('dq', 'DIAMONDS', 12),
            makeCard('dk', 'DIAMONDS', 13),
          ],
          slots: [
            { card: makeCard('dj', 'DIAMONDS', 11), representedRank: 11, isWildcard: false },
            { card: makeCard('dq', 'DIAMONDS', 12), representedRank: 12, isWildcard: false },
            { card: makeCard('dk', 'DIAMONDS', 13), representedRank: 13, isWildcard: false },
          ],
        },
      ];

      // Hand has 8♦, 9♦, 10♦, plus 2 junk cards (e.g. Q♥, Q♥)
      state.players[1].hand = [
        makeCard('d8', 'DIAMONDS', 8),
        makeCard('d9', 'DIAMONDS', 9),
        makeCard('d10', 'DIAMONDS', 10),
        makeCard('hq1', 'HEARTS', 12),
        makeCard('hq2', 'HEARTS', 12),
      ];

      const plan = decideTheLongTermGuyTurn(state, 1, createEmptyMemory());
      // All 3 diamonds cards (8♦, 9♦, 10♦) should be added across the turn
      const addedCardIds = plan.meldActions.flatMap((a: any) => a.cardIds || []);
      expect(addedCardIds).toContain('d8');
      expect(addedCardIds).toContain('d9');
      expect(addedCardIds).toContain('d10');
    });

    it('plays a new sequence even if a sequence in that suit already exists on the table', () => {
      const state = createTestState();
      state.phase = 'MELD';
      state.turnPhase = 'MELD';
      // Table already has a Spades run 3♠-4♠-5♠
      state.melds.B = [
        {
          id: 'meld-b-spades',
          team: 'B',
          type: 'RUN',
          suit: 'SPADES',
          cards: [
            makeCard('s3', 'SPADES', 3),
            makeCard('s4', 'SPADES', 4),
            makeCard('s5', 'SPADES', 5),
          ],
          slots: [
            { card: makeCard('s3', 'SPADES', 3), representedRank: 3, isWildcard: false },
            { card: makeCard('s4', 'SPADES', 4), representedRank: 4, isWildcard: false },
            { card: makeCard('s5', 'SPADES', 5), representedRank: 5, isWildcard: false },
          ],
        },
      ];

      // Hand has 9♠, 10♠, J♠ and 1 deadwood card
      state.players[1].hand = [
        makeCard('s9', 'SPADES', 9),
        makeCard('s10', 'SPADES', 10),
        makeCard('sj', 'SPADES', 11),
        makeCard('hk', 'HEARTS', 13),
      ];

      const plan = decideTheLongTermGuyTurn(state, 1, createEmptyMemory());
      // Must NOT sit on 9♠-10♠-J♠ just because 3♠-4♠-5♠ already exists!
      expect(plan.meldActions.some((a) => a.type === 'PLAY_NEW_MELD')).toBe(true);
      const newMeldAct = plan.meldActions.find((a) => a.type === 'PLAY_NEW_MELD') as any;
      expect(newMeldAct.cardIds).toContain('s9');
      expect(newMeldAct.cardIds).toContain('s10');
      expect(newMeldAct.cardIds).toContain('sj');
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
        makeCard('h4', 'HEARTS', 12),
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

    it('The Long-Term Guy and Smart Chacha both leave unhelpful opponent junk in discard (zero sequence value)', () => {
      const state = createTestState();
      // Player has hand [4♠, 9♥]
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 4),
        makeCard('h2', 'HEARTS', 9),
      ];
      // Discard pile is 3 unhelpful opponent cards: 3♣, 7♦, 11♣
      state.discardPile = [
        makeCard('dp1', 'CLUBS', 3),
        makeCard('dp2', 'DIAMONDS', 7),
        makeCard('dp3', 'CLUBS', 11),
      ];

      // Smart Chacha understands that taking 3 unhelpful opponent cards bloats his hand and hurts the team
      const planChacha = decideSmartChachaTurn(state, 1, createEmptyMemory());
      expect(planChacha.drawAction.type).toBe('DRAW_FROM_STOCK');

      // The Long-Term Guy also refuses to take discard pile when cards add zero value to his sequence!
      const planLT = decideTheLongTermGuyTurn(state, 1, createEmptyMemory());
      expect(planLT.drawAction.type).toBe('DRAW_FROM_STOCK');
    });

    it('The Long-Term Guy leaves a single-card discard that adds zero sequence value (e.g. cross-suit pair)', () => {
      const state = createTestState();
      // Hand has 4♠ and 9♥
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 4),
        makeCard('h2', 'HEARTS', 9),
      ];
      // Discard is 4♦ (same rank, different suit - adds zero sequence value!)
      state.discardPile = [makeCard('dp1', 'DIAMONDS', 4)];

      const planLT = decideTheLongTermGuyTurn(state, 1, createEmptyMemory());
      expect(planLT.drawAction.type).toBe('DRAW_FROM_STOCK');
    });

    it('The Long-Term Guy takes discard pile when top card extends a team table sequence', () => {
      const state = createTestState();
      state.players[1].hand = [
        makeCard('h1', 'HEARTS', 9),
        makeCard('h2', 'CLUBS', 12),
      ];
      // Table has Spades run 3♠-4♠-5♠
      state.melds.B = [
        {
          id: 'meld-b-spades',
          team: 'B',
          type: 'RUN',
          suit: 'SPADES',
          cards: [
            makeCard('s3', 'SPADES', 3),
            makeCard('s4', 'SPADES', 4),
            makeCard('s5', 'SPADES', 5),
          ],
          slots: [
            { card: makeCard('s3', 'SPADES', 3), representedRank: 3, isWildcard: false },
            { card: makeCard('s4', 'SPADES', 4), representedRank: 4, isWildcard: false },
            { card: makeCard('s5', 'SPADES', 5), representedRank: 5, isWildcard: false },
          ],
        },
      ];
      // Discard is 6♠ (directly extends table sequence)
      state.discardPile = [makeCard('dp1', 'SPADES', 6)];

      const planLT = decideTheLongTermGuyTurn(state, 1, createEmptyMemory());
      expect(planLT.drawAction.type).toBe('TAKE_DISCARD');
    });

    it('Smart Chacha avoids passing cards through discard pile when pile already has 2+ cards from opponents', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';

      // Player 1 is Smart Chacha (Team B). Player 2 is Opponent (Team A). Player 3 is Partner (Team B).
      state.currentPlayerIndex = 1;
      state.players[1].team = 'B';
      state.players[2].team = 'A';
      state.players[2].hand = [makeCard('opp1', 'HEARTS', 5), makeCard('opp2', 'DIAMONDS', 9)]; // Opponent close to Pukar (2 cards)
      state.players[3].team = 'B';
      state.players[3].hand = [
        makeCard('p1', 'SPADES', 4),
        makeCard('p2', 'SPADES', 5),
        makeCard('p3', 'HEARTS', 10),
        makeCard('p4', 'CLUBS', 8),
        makeCard('p5', 'DIAMONDS', 6),
      ]; // Partner has 5 cards

      // Team B has a Spades run on table: 3♠, 4♠, 5♠
      state.melds.B = [
        {
          id: 'meld-b-spades',
          team: 'B',
          type: 'RUN',
          suit: 'SPADES',
          cards: [
            makeCard('m1', 'SPADES', 3),
            makeCard('m2', 'SPADES', 4),
            makeCard('m3', 'SPADES', 5),
          ],
          slots: [
            { card: makeCard('m1', 'SPADES', 3), representedRank: 3, isWildcard: false },
            { card: makeCard('m2', 'SPADES', 4), representedRank: 4, isWildcard: false },
            { card: makeCard('m3', 'SPADES', 5), representedRank: 5, isWildcard: false },
          ],
        },
      ];

      // Smart Chacha has 6♠ (which would extend Spades run) and safe junk 9♦
      state.players[1].hand = [
        makeCard('c1', 'SPADES', 6),
        makeCard('c2', 'DIAMONDS', 9),
      ];

      // Discard pile already contains 2 cards from opponents
      state.discardPile = [
        makeCard('dp1', 'HEARTS', 8),
        makeCard('dp2', 'CLUBS', 12),
      ];

      // Smart Chacha realizes passing 6♠ now forces partner to pick up 2 other unhelpful opponent cards!
      // So Smart Chacha does NOT pass 6♠, and discards 9♦ instead!
      const plan = decideSmartChachaTurn(state, 1, createEmptyMemory());
      expect(plan.discardAction.cardId).toBe('c2');
    });

    it('Smart Chacha avoids passing cards through discard pile when partner is close to Pukar (<= 4 cards)', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';

      state.currentPlayerIndex = 1;
      state.players[1].team = 'B';
      state.players[2].team = 'A';
      state.players[2].hand = [makeCard('opp1', 'HEARTS', 5), makeCard('opp2', 'DIAMONDS', 9)]; // Opponent 2 cards
      state.players[3].team = 'B';
      state.players[3].hand = [
        makeCard('p1', 'SPADES', 4),
        makeCard('p2', 'SPADES', 5),
        makeCard('p3', 'CLUBS', 9),
      ]; // Partner has 3 cards (>= 3 cards: do not pass sequence card)

      state.melds.B = [
        {
          id: 'meld-b-spades',
          team: 'B',
          type: 'RUN',
          suit: 'SPADES',
          cards: [
            makeCard('m1', 'SPADES', 3),
            makeCard('m2', 'SPADES', 4),
            makeCard('m3', 'SPADES', 5),
          ],
          slots: [
            { card: makeCard('m1', 'SPADES', 3), representedRank: 3, isWildcard: false },
            { card: makeCard('m2', 'SPADES', 4), representedRank: 4, isWildcard: false },
            { card: makeCard('m3', 'SPADES', 5), representedRank: 5, isWildcard: false },
          ],
        },
      ];

      // Smart Chacha has 6♠ and safe junk 9♦
      state.players[1].hand = [
        makeCard('c1', 'SPADES', 6),
        makeCard('c2', 'DIAMONDS', 9),
      ];

      // Discard pile has 1 card
      state.discardPile = [makeCard('dp1', 'HEARTS', 8)];

      // Partner is close to Pukar (2 cards), so bloating them with extra cards ruins their sprint!
      // Smart Chacha does not pass 6♠; discards 9♦ instead!
      const plan = decideSmartChachaTurn(state, 1, createEmptyMemory());
      expect(plan.discardAction.cardId).toBe('c2');
    });

    it('Smart Chacha safely passes a helpful card when discard pile is clean (<= 1 card) and partner has room', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';

      state.currentPlayerIndex = 1;
      state.players[1].team = 'B';
      state.players[2].team = 'A';
      state.players[2].hand = [makeCard('opp1', 'HEARTS', 5), makeCard('opp2', 'DIAMONDS', 9)]; // Opponent 2 cards (selective)
      state.players[3].team = 'B';
      state.players[3].hand = [
        makeCard('p1', 'CLUBS', 4),
        makeCard('p2', 'CLUBS', 5),
        makeCard('p3', 'HEARTS', 10),
        makeCard('p4', 'CLUBS', 8),
        makeCard('p5', 'DIAMONDS', 6),
      ]; // Partner has 5 cards (building hand)

      state.melds.B = []; // No Spades meld on table yet

      // Memory logs that partner (Player 3) picked up 5♠ from the bottom recently
      const memory: BotMemory = {
        cardLog: [
          {
            cardId: 'p-5s',
            suit: 'SPADES',
            rank: 5,
            playerIndex: 3,
            action: 'PICKUP_BOTTOM',
            timestamp: Date.now(),
          },
        ],
        bottomPickupsByPlayer: {
          3: [makeCard('p-5s', 'SPADES', 5)],
        },
        discardsByPlayer: {},
      };

      // Smart Chacha has 6♠ (connects with partner's 5♠) and 9♦
      state.players[1].hand = [
        makeCard('c1', 'SPADES', 6),
        makeCard('c2', 'DIAMONDS', 9),
      ];

      // Discard pile is completely empty (clean pile!)
      state.discardPile = [];

      // Since pile is clean and partner has room, Smart Chacha passes 6♠ to partner!
      const plan = decideSmartChachaTurn(state, 1, memory);
      expect(plan.discardAction.cardId).toBe('c1');
    });

    it('Smart Chacha avoids giving a card partner needs when intermediate opponent can intercept it', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';

      state.currentPlayerIndex = 1;
      state.players[1].team = 'B';
      state.players[2].team = 'A'; // Intermediate opponent sitting between Chacha and Partner
      state.players[2].hand = [
        makeCard('opp1', 'HEARTS', 5),
        makeCard('opp2', 'DIAMONDS', 9),
        makeCard('opp3', 'CLUBS', 4),
        makeCard('opp4', 'HEARTS', 11),
      ];
      state.players[3].team = 'B'; // Partner
      state.players[3].hand = [
        makeCard('p1', 'CLUBS', 4),
        makeCard('p2', 'CLUBS', 5),
        makeCard('p3', 'HEARTS', 10),
        makeCard('p4', 'CLUBS', 8),
        makeCard('p5', 'DIAMONDS', 6),
      ];

      // Opponent table meld contains 7♠, 8♠, 9♠ -> 6♠ can be added to opponent run!
      state.melds.A = [
        {
          id: 'meld-a-spades',
          team: 'A',
          type: 'RUN',
          suit: 'SPADES',
          cards: [
            makeCard('s7', 'SPADES', 7),
            makeCard('s8', 'SPADES', 8),
            makeCard('s9', 'SPADES', 9),
          ],
          slots: [
            { card: makeCard('s7', 'SPADES', 7), representedRank: 7, isWildcard: false },
            { card: makeCard('s8', 'SPADES', 8), representedRank: 8, isWildcard: false },
            { card: makeCard('s9', 'SPADES', 9), representedRank: 9, isWildcard: false },
          ],
        },
      ];

      // Memory shows partner picked up 5♠
      const memory: BotMemory = {
        cardLog: [],
        bottomPickupsByPlayer: {
          3: [makeCard('p-5s', 'SPADES', 5)],
        },
        discardsByPlayer: {},
      };

      // Chacha has 6♠ (partner wants, but opponent can intercept!) and 9♦ (unrelated deadwood)
      state.players[1].hand = [
        makeCard('c1', 'SPADES', 6),
        makeCard('c2', 'DIAMONDS', 9),
      ];
      state.discardPile = [];

      // Smart Chacha MUST protect 6♠ from discard because opponent would intercept it!
      const plan = decideSmartChachaTurn(state, 1, memory);
      expect(plan.discardAction.cardId).toBe('c2');
    });

    it('Smart Chacha passes card partner needs even if opponent has normal hand size (> 3 cards), as long as opponent cannot intercept and pile is clean', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';

      state.currentPlayerIndex = 1;
      state.players[1].team = 'B';
      state.players[2].team = 'A'; // Opponent has 6 cards (not <= 3 cards!)
      state.players[2].hand = [
        makeCard('opp1', 'HEARTS', 5),
        makeCard('opp2', 'DIAMONDS', 9),
        makeCard('opp3', 'CLUBS', 4),
        makeCard('opp4', 'HEARTS', 11),
        makeCard('opp5', 'CLUBS', 12),
        makeCard('opp6', 'HEARTS', 3),
      ];
      state.players[3].team = 'B'; // Partner
      state.players[3].hand = [
        makeCard('p1', 'CLUBS', 4),
        makeCard('p2', 'CLUBS', 5),
        makeCard('p3', 'HEARTS', 10),
        makeCard('p4', 'CLUBS', 8),
        makeCard('p5', 'DIAMONDS', 6),
      ];

      // Opponent has no Spades meld
      state.melds.A = [];

      const memory: BotMemory = {
        cardLog: [],
        bottomPickupsByPlayer: {
          3: [makeCard('p-5s', 'SPADES', 5)],
        },
        discardsByPlayer: {},
      };

      // Chacha has 6♠ (partner wants, opponent cannot intercept) and K♦ (rank 13 deadwood, score 40)
      state.players[1].hand = [
        makeCard('c1', 'SPADES', 6),
        makeCard('c2', 'DIAMONDS', 13),
      ];
      state.discardPile = [];

      // Opponent cannot intercept and pile is clean, so Smart Chacha actively passes 6♠ (score -10 vs K♦ score 40)!
      const plan = decideSmartChachaTurn(state, 1, memory);
      expect(plan.discardAction.cardId).toBe('c1');
    });

    it('Smart Chacha avoids giving a card partner needs when intermediate opponent logged to want it from pickups', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';

      state.currentPlayerIndex = 1;
      state.players[1].team = 'B';
      state.players[2].team = 'A'; // Opponent
      state.players[2].hand = [
        makeCard('opp1', 'HEARTS', 5),
        makeCard('opp2', 'DIAMONDS', 9),
        makeCard('opp3', 'CLUBS', 4),
        makeCard('opp4', 'HEARTS', 11),
      ];
      state.players[3].team = 'B'; // Partner
      state.players[3].hand = [
        makeCard('p1', 'CLUBS', 4),
        makeCard('p2', 'CLUBS', 5),
        makeCard('p3', 'HEARTS', 10),
        makeCard('p4', 'CLUBS', 8),
        makeCard('p5', 'DIAMONDS', 6),
      ];
      state.melds.A = [];
      state.melds.B = [];

      // Memory logs that:
      // - Partner picked up 5♠ (needs 6♠)
      // - BUT Opponent picked up 7♠ (also needs 6♠!)
      const memory: BotMemory = {
        cardLog: [],
        bottomPickupsByPlayer: {
          2: [makeCard('opp-7s', 'SPADES', 7)],
          3: [makeCard('p-5s', 'SPADES', 5)],
        },
        discardsByPlayer: {},
      };

      state.players[1].hand = [
        makeCard('c1', 'SPADES', 6),
        makeCard('c2', 'DIAMONDS', 13), // Deadwood K♦
      ];
      state.discardPile = [];

      // Because opponent wants 6♠ (intercept risk!), Smart Chacha protects 6♠ and discards K♦!
      const plan = decideSmartChachaTurn(state, 1, memory);
      expect(plan.discardAction.cardId).toBe('c2');
    });

    it('Smart Chacha identifies partner needs for a SET and safely passes rank match when safe', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';

      state.currentPlayerIndex = 1;
      state.players[1].team = 'B';
      state.players[2].team = 'A';
      state.players[2].hand = [
        makeCard('opp1', 'HEARTS', 5),
        makeCard('opp2', 'DIAMONDS', 9),
        makeCard('opp3', 'CLUBS', 4),
        makeCard('opp4', 'HEARTS', 11),
      ];
      state.players[3].team = 'B'; // Partner
      state.players[3].hand = [
        makeCard('p1', 'CLUBS', 4),
        makeCard('p2', 'CLUBS', 5),
        makeCard('p3', 'HEARTS', 10),
        makeCard('p4', 'CLUBS', 8),
        makeCard('p5', 'DIAMONDS', 6),
      ];
      state.melds.A = [];
      state.melds.B = [];

      // Partner picked up 8♦ (building 8s or diamonds)
      const memory: BotMemory = {
        cardLog: [],
        bottomPickupsByPlayer: {
          3: [makeCard('p-8d', 'DIAMONDS', 8)],
        },
        discardsByPlayer: {},
      };

      // Chacha has 8♣ (matches partner's 8 rank for a set) and K♠ (rank 13 deadwood)
      state.players[1].hand = [
        makeCard('c1', 'CLUBS', 8),
        makeCard('c2', 'SPADES', 13),
      ];
      state.discardPile = [];

      // Clean pile, opponent doesn't want 8s, so Chacha passes 8♣ to help partner's set!
      const plan = decideSmartChachaTurn(state, 1, memory);
      expect(plan.discardAction.cardId).toBe('c1');
    });

    it('The Jadugar leaves a 4-card discard pile of deadwood and draws from stock deck', () => {
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
      expect(plan.drawAction.type).toBe('DRAW_FROM_STOCK');
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

  describe('Smart Chacha Sequence Protection & Multi-Card Iterative Melds', () => {
    it('Smart Chacha does NOT discard a card that can be added to an existing team sequence when partner has >= 3 cards, discarding deadwood instead', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';

      state.currentPlayerIndex = 1;
      state.players[1].team = 'B';
      state.players[2].team = 'A';
      state.players[2].hand = [makeCard('opp1', 'HEARTS', 5), makeCard('opp2', 'DIAMONDS', 9)]; // Opponent selective (2 cards)
      state.players[3].team = 'B';
      state.players[3].hand = [
        makeCard('p1', 'HEARTS', 4),
        makeCard('p2', 'CLUBS', 7),
        makeCard('p3', 'DIAMONDS', 10),
        makeCard('p4', 'SPADES', 12),
      ]; // Partner has 4 cards (>= 3 cards!)

      // Team B has Spades run on table: 3♠, 4♠, 5♠
      state.melds.B = [
        {
          id: 'meld-b-spades',
          team: 'B',
          type: 'RUN',
          suit: 'SPADES',
          cards: [
            makeCard('m1', 'SPADES', 3),
            makeCard('m2', 'SPADES', 4),
            makeCard('m3', 'SPADES', 5),
          ],
          slots: [
            { card: makeCard('m1', 'SPADES', 3), representedRank: 3, isWildcard: false },
            { card: makeCard('m2', 'SPADES', 4), representedRank: 4, isWildcard: false },
            { card: makeCard('m3', 'SPADES', 5), representedRank: 5, isWildcard: false },
          ],
        },
      ];

      // Hand has 6♠ (can add to team sequence) and 9♦ (unrelated deadwood)
      state.players[1].hand = [
        makeCard('c1', 'SPADES', 6),
        makeCard('c2', 'DIAMONDS', 9),
      ];

      // Discard pile is empty (clean)
      state.discardPile = [];

      // When partner has >= 3 cards, Smart Chacha must NEVER throw sequence cards into discard pile!
      // Opponents would simply pick it up. Discards 9♦ instead of 6♠.
      const plan = decideSmartChachaTurn(state, 1, createEmptyMemory());
      expect(plan.discardAction.cardId).toBe('c2');
    });

    it('Smart Chacha protects sequence-connecting cards (within 1 rank) from discard when partner has >= 3 cards', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';

      state.currentPlayerIndex = 1;
      state.players[1].team = 'B';
      state.players[2].team = 'A';
      state.players[2].hand = [makeCard('opp1', 'HEARTS', 5), makeCard('opp2', 'DIAMONDS', 9)]; // Opponent selective
      state.players[3].team = 'B';
      state.players[3].hand = [
        makeCard('p1', 'HEARTS', 4),
        makeCard('p2', 'CLUBS', 7),
        makeCard('p3', 'DIAMONDS', 10),
      ]; // Partner has 3 cards (>= 3 cards!)

      // Team B has Spades run on table: 4♠, 5♠, 6♠
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

      // Hand has 3♠ (connects to sequence at rank 4 - 1) and 9♦ (deadwood)
      state.players[1].hand = [
        makeCard('c1', 'SPADES', 3),
        makeCard('c2', 'DIAMONDS', 9),
      ];

      state.discardPile = [];

      // Since partner has >= 3 cards, 3♠ is protected from discard to deny opponents!
      const plan = decideSmartChachaTurn(state, 1, createEmptyMemory());
      expect(plan.discardAction.cardId).toBe('c2');
    });

    it('findBestMeldPlan iteratively melds all multi-card sequence additions (e.g. 8♠, 9♠, 10♠ to 5♠-6♠-7♠) so cards are placed on the table', () => {
      const tableMeld = {
        id: 'meld-spades',
        team: 'B' as const,
        type: 'RUN' as const,
        suit: 'SPADES' as const,
        cards: [
          makeCard('m5', 'SPADES', 5),
          makeCard('m6', 'SPADES', 6),
          makeCard('m7', 'SPADES', 7),
        ],
        slots: [
          { card: makeCard('m5', 'SPADES', 5), representedRank: 5, isWildcard: false },
          { card: makeCard('m6', 'SPADES', 6), representedRank: 6, isWildcard: false },
          { card: makeCard('m7', 'SPADES', 7), representedRank: 7, isWildcard: false },
        ],
      };

      const hand = [
        makeCard('s4', 'SPADES', 4), // 4♠ (lower addition)
        makeCard('s8', 'SPADES', 8), // 8♠ (upper addition)
        makeCard('s9', 'SPADES', 9), // 9♠ (upper addition extending 8♠)
        makeCard('hk', 'HEARTS', 13), // 1 deadwood card to preserve for discard
      ];

      const plan = findBestMeldPlan(hand, [tableMeld], { preserveDiscardCard: true });

      // All 3 spades cards (4♠, 8♠, 9♠) should be added to the sequence!
      expect(plan.usedCardIds.has('s4')).toBe(true);
      expect(plan.usedCardIds.has('s8')).toBe(true);
      expect(plan.usedCardIds.has('s9')).toBe(true);
      // Deadwood card is preserved for discard
      expect(plan.usedCardIds.has('hk')).toBe(false);
      expect(plan.additionsToPlay.length).toBeGreaterThanOrEqual(1);
    });

    it('prioritizes completing a Clean 7 table run (+200 pts) over opening a new 3-card meld', () => {
      // 5-card table run: 3♠, 4♠, 5♠, 6♠, 7♠
      const tableMeld: Meld = {
        id: 'meld-clean-5-spades',
        team: 'B',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          makeCard('m3', 'SPADES', 3),
          makeCard('m4', 'SPADES', 4),
          makeCard('m5', 'SPADES', 5),
          makeCard('m6', 'SPADES', 6),
          makeCard('m7', 'SPADES', 7),
        ],
        slots: [
          { card: makeCard('m3', 'SPADES', 3), representedRank: 3, isWildcard: false },
          { card: makeCard('m4', 'SPADES', 4), representedRank: 4, isWildcard: false },
          { card: makeCard('m5', 'SPADES', 5), representedRank: 5, isWildcard: false },
          { card: makeCard('m6', 'SPADES', 6), representedRank: 6, isWildcard: false },
          { card: makeCard('m7', 'SPADES', 7), representedRank: 7, isWildcard: false },
        ],
        points: 0,
        isClean: true,
        isPure: true,
        isPure13: false,
      };

      // Bot holds 8♠, 9♠, 10♠ (which could form a new 3-card run 8♠-9♠-10♠)
      // plus K♥ as deadwood to preserve for discard.
      // Completing the 5-card run to 7 cards scores Clean 7 (+200 pts).
      const hand = [
        makeCard('s8', 'SPADES', 8),
        makeCard('s9', 'SPADES', 9),
        makeCard('s10', 'SPADES', 10),
        makeCard('hk', 'HEARTS', 13),
      ];

      const plan = findBestMeldPlan(hand, [tableMeld], { preserveDiscardCard: true });

      // The bot must prioritize completing the Clean 7 run on table rather than opening a new 3-card run
      expect(plan.meldsToPlay.length).toBe(0);
      expect(plan.additionsToPlay.length).toBeGreaterThan(0);
      expect(plan.usedCardIds.has('s8')).toBe(true);
      expect(plan.usedCardIds.has('s9')).toBe(true);
      expect(plan.usedCardIds.has('hk')).toBe(false);
    });

    it('prioritizes completing a 6-card table run to 7 cards over opening a new 3-card meld', () => {
      // 6-card table run: 3♠, 4♠, 5♠, 6♠, 7♠, 8♠
      const tableMeld: Meld = {
        id: 'meld-6-spades',
        team: 'B',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          makeCard('m3', 'SPADES', 3),
          makeCard('m4', 'SPADES', 4),
          makeCard('m5', 'SPADES', 5),
          makeCard('m6', 'SPADES', 6),
          makeCard('m7', 'SPADES', 7),
          makeCard('m8', 'SPADES', 8),
        ],
        slots: [
          { card: makeCard('m3', 'SPADES', 3), representedRank: 3, isWildcard: false },
          { card: makeCard('m4', 'SPADES', 4), representedRank: 4, isWildcard: false },
          { card: makeCard('m5', 'SPADES', 5), representedRank: 5, isWildcard: false },
          { card: makeCard('m6', 'SPADES', 6), representedRank: 6, isWildcard: false },
          { card: makeCard('m7', 'SPADES', 7), representedRank: 7, isWildcard: false },
          { card: makeCard('m8', 'SPADES', 8), representedRank: 8, isWildcard: false },
        ],
        points: 0,
        isClean: true,
        isPure: true,
        isPure13: false,
      };

      // Bot holds 9♠, 10♠, J♠ (which could form 9♠-10♠-J♠) + K♥ as deadwood
      const hand = [
        makeCard('s9', 'SPADES', 9),
        makeCard('s10', 'SPADES', 10),
        makeCard('sj', 'SPADES', 11),
        makeCard('hk', 'HEARTS', 13),
      ];

      const plan = findBestMeldPlan(hand, [tableMeld], { preserveDiscardCard: true });
      expect(plan.meldsToPlay.length).toBe(0);
      expect(plan.additionsToPlay.length).toBeGreaterThan(0);
      expect(plan.usedCardIds.has('s9')).toBe(true);
      expect(plan.usedCardIds.has('hk')).toBe(false);
    });

    it('prioritizes completing a 12-card run to Pure 13 (+500 pts) over opening a new 3-card meld', () => {
      // 12-card Pure Spades run (2♠ to K♠)
      const tableCards: Card[] = [];
      const tableSlots = [];
      for (let r = 2; r <= 13; r++) {
        const c = makeCard(`spade_${r}`, 'SPADES', r as Rank);
        tableCards.push(c);
        tableSlots.push({ card: c, representedRank: r, isWildcard: false });
      }

      const tableMeld: Meld = {
        id: 'meld-pure-12-spades',
        team: 'B',
        type: 'RUN',
        suit: 'SPADES',
        cards: tableCards,
        slots: tableSlots,
        points: 200,
        isClean: true,
        isPure: true,
        isPure13: false,
      };

      // Hand has A♠ (completes Pure 13 for +500 pts!) and 8♥-9♥-10♥ (new candidate run) + K♦
      const hand = [
        makeCard('s_ace', 'SPADES', 14),
        makeCard('h8', 'HEARTS', 8),
        makeCard('h9', 'HEARTS', 9),
        makeCard('h10', 'HEARTS', 10),
        makeCard('kd', 'DIAMONDS', 13),
      ];

      const plan = findBestMeldPlan(hand, [tableMeld], { preserveDiscardCard: true });
      // A♠ must be added to table meld to complete Pure 13
      expect(plan.usedCardIds.has('s_ace')).toBe(true);
      expect(plan.additionsToPlay.some((a) => a.cardIds.includes('s_ace'))).toBe(true);
      // And the independent meld 8♥-9♥-10♥ can also be melded!
      expect(plan.meldsToPlay.length).toBe(1);
      expect(plan.usedCardIds.has('kd')).toBe(false);
    });

    it('Smart Chacha passes a sequence card ONLY when partner is on less than 3 cards (< 3 cards) and conditions are clean', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';

      state.currentPlayerIndex = 1;
      state.players[1].team = 'B';
      state.players[2].team = 'A';
      state.players[2].hand = [makeCard('opp1', 'HEARTS', 5), makeCard('opp2', 'DIAMONDS', 9)]; // Opponent selective (2 cards)
      state.players[3].team = 'B';
      state.players[3].hand = [
        makeCard('p1', 'HEARTS', 4),
        makeCard('p2', 'CLUBS', 7),
      ]; // Partner only has 2 cards (< 3 cards!)

      // Team B has Spades run on table: 3♠, 4♠, 5♠
      state.melds.B = [
        {
          id: 'meld-b-spades',
          team: 'B',
          type: 'RUN',
          suit: 'SPADES',
          cards: [
            makeCard('m1', 'SPADES', 3),
            makeCard('m2', 'SPADES', 4),
            makeCard('m3', 'SPADES', 5),
          ],
          slots: [
            { card: makeCard('m1', 'SPADES', 3), representedRank: 3, isWildcard: false },
            { card: makeCard('m2', 'SPADES', 4), representedRank: 4, isWildcard: false },
            { card: makeCard('m3', 'SPADES', 5), representedRank: 5, isWildcard: false },
          ],
        },
      ];

      // Hand has 6♠ and 9♦
      state.players[1].hand = [
        makeCard('c1', 'SPADES', 6),
        makeCard('c2', 'DIAMONDS', 9),
      ];

      // Discard pile is empty (clean)
      state.discardPile = [];

      // Partner is on less than 3 cards (< 3), so passing 6♠ allows partner to scoop and go out!
      const plan = decideSmartChachaTurn(state, 1, createEmptyMemory());
      expect(plan.discardAction.cardId).toBe('c1');
    });
  });

  describe('Bot Strategic Optimizations Audit', () => {
    it('all bots refuse to discard connecting cards (pairs, adjacent ranks, gap connectors) when isolated deadwood exists', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';
      state.players[1].hand = [
        makeCard('s5', 'SPADES', 5),
        makeCard('s6', 'SPADES', 6), // Connected adjacent pair
        makeCard('h8', 'HEARTS', 8),
        makeCard('d8', 'DIAMONDS', 8), // Rank pair
        makeCard('ck', 'CLUBS', 13), // Isolated high deadwood
      ];

      // Smart Chacha discards isolated deadwood (ck) over connecting cards
      const chachaPlan = decideSmartChachaTurn(state, 1, createEmptyMemory());
      expect(chachaPlan.discardAction.cardId).toBe('ck');

      // Fast Chachi discards isolated deadwood (ck) over connecting cards
      const chachiPlan = decideFastChachiTurn(state, 1, createEmptyMemory());
      expect(chachiPlan.discardAction.cardId).toBe('ck');

      // The Jadugar discards isolated deadwood (ck) over connecting cards
      const jadugarPlan = decideTheJadugarTurn(state, 1, createEmptyMemory());
      expect(jadugarPlan.discardAction.cardId).toBe('ck');

      // The Long-Term Guy discards isolated deadwood (ck) over connecting cards
      const ltPlan = decideTheLongTermGuyTurn(state, 1, createEmptyMemory());
      expect(ltPlan.discardAction.cardId).toBe('ck');
    });

    it('bots do not casually discard rank 4 cards when 4 connects to low sequence (e.g. 2, 3, 5) or pairs', () => {
      const state = createTestState();
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';
      state.players[1].hand = [
        makeCard('s4', 'SPADES', 4),
        makeCard('s3', 'SPADES', 3), // 4 connects to 3 for low run
        makeCard('d10', 'DIAMONDS', 10), // Isolated deadwood
      ];

      // Fast Chachi preserves 4♠ and 3♠, discarding d10
      const chachiPlan = decideFastChachiTurn(state, 1, createEmptyMemory());
      expect(chachiPlan.discardAction.cardId).toBe('d10');

      // Smart Chacha preserves 4♠ and 3♠, discarding d10
      const chachaPlan = decideSmartChachaTurn(state, 1, createEmptyMemory());
      expect(chachaPlan.discardAction.cardId).toBe('d10');
    });

    it('bots strictly prefer suited 2s over cross-suit 2s when building sequences', () => {
      const hand = [
        makeCard('s4', 'SPADES', 4),
        makeCard('s5', 'SPADES', 5),
        makeCard('s2', 'SPADES', 2), // Suited 2
        makeCard('d2', 'DIAMONDS', 2), // Cross-suit 2
        makeCard('c9', 'CLUBS', 9),
      ];
      const dummyMeld: Meld = {
        id: 'm0',
        type: 'RUN',
        cards: [],
        slots: [],
        team: 'A',
        points: 0,
        isClean: false,
        isPure: false,
        isPure13: false,
      };

      const plan = findBestMeldPlan(hand, [dummyMeld]);
      expect(plan.meldsToPlay.length).toBeGreaterThan(0);
      const playedMeld = plan.meldsToPlay[0];
      // Must use suited 2 (s2), NOT cross-suit 2 (d2)
      expect(playedMeld.cards.some((c) => c.id === 's2')).toBe(true);
      expect(playedMeld.cards.some((c) => c.id === 'd2')).toBe(false);
    });

    it('bots strictly prefer Natural Jokers over cross-suit 2s when 2 suit does not match', () => {
      const hand = [
        makeCard('s4', 'SPADES', 4),
        makeCard('s5', 'SPADES', 5),
        makeCard('joker', null, 0, true), // Natural Joker
        makeCard('d2', 'DIAMONDS', 2), // Cross-suit 2
        makeCard('c9', 'CLUBS', 9),
      ];
      const dummyMeld: Meld = {
        id: 'm0',
        type: 'RUN',
        cards: [],
        slots: [],
        team: 'A',
        points: 0,
        isClean: false,
        isPure: false,
        isPure13: false,
      };

      const plan = findBestMeldPlan(hand, [dummyMeld]);
      expect(plan.meldsToPlay.length).toBeGreaterThan(0);
      const playedMeld = plan.meldsToPlay[0];
      // Must prefer Natural Joker over cross-suit 2
      expect(playedMeld.cards.some((c) => c.id === 'joker')).toBe(true);
      expect(playedMeld.cards.some((c) => c.id === 'd2')).toBe(false);
    });

    it('cross-suit 2 is never added to a sequence when not close to Pukar', () => {
      const tableMeld: Meld = {
        id: 'm-spades',
        type: 'RUN',
        suit: 'SPADES',
        team: 'B',
        cards: [
          makeCard('s4', 'SPADES', 4),
          makeCard('s5', 'SPADES', 5),
          makeCard('s6', 'SPADES', 6),
        ],
        slots: [
          { card: makeCard('s4', 'SPADES', 4), representedRank: 4, isWildcard: false },
          { card: makeCard('s5', 'SPADES', 5), representedRank: 5, isWildcard: false },
          { card: makeCard('s6', 'SPADES', 6), representedRank: 6, isWildcard: false },
        ],
        isClean: true,
        points: 0,
      };

      const hand = [
        makeCard('d2', 'DIAMONDS', 2), // Cross-suit 2
        makeCard('h7', 'HEARTS', 7),
        makeCard('h8', 'HEARTS', 8),
        makeCard('c10', 'CLUBS', 10),
        makeCard('cj', 'CLUBS', 11),
      ];

      // Hand has 5 cards (not close to Pukar)
      const additions = findPotentialAdditionsToMelds(hand, [tableMeld], { isCloseToPukar: false });
      // Cross-suit 2 must NOT be added to table meld
      expect(additions.some((a) => a.cardIds.includes('d2'))).toBe(false);
    });

    it('protects 5- and 6-card clean runs from premature wildcard tainting when not close to Pukar', () => {
      // 5-card clean run on table: 4♠-5♠-6♠-7♠-8♠
      const tableMeld: Meld = {
        id: 'meld-5-clean-spades',
        type: 'RUN',
        suit: 'SPADES',
        team: 'B',
        cards: [
          makeCard('s4', 'SPADES', 4),
          makeCard('s5', 'SPADES', 5),
          makeCard('s6', 'SPADES', 6),
          makeCard('s7', 'SPADES', 7),
          makeCard('s8', 'SPADES', 8),
        ],
        slots: [
          { card: makeCard('s4', 'SPADES', 4), representedRank: 4, isWildcard: false },
          { card: makeCard('s5', 'SPADES', 5), representedRank: 5, isWildcard: false },
          { card: makeCard('s6', 'SPADES', 6), representedRank: 6, isWildcard: false },
          { card: makeCard('s7', 'SPADES', 7), representedRank: 7, isWildcard: false },
          { card: makeCard('s8', 'SPADES', 8), representedRank: 8, isWildcard: false },
        ],
        isClean: true,
        points: 0,
      };

      // 1. Bot has > 4 cards (5 cards) with a Natural Joker and deadwood cards
      const handWithJoker = [
        makeCard('nj1', null, 0, true), // Natural Joker
        makeCard('h10', 'HEARTS', 10),
        makeCard('hj', 'HEARTS', 11),
        makeCard('d4', 'DIAMONDS', 4),
        makeCard('c6', 'CLUBS', 6),
      ];

      // Hand has > 4 cards (not close to Pukar) - Bot must NOT add the wildcard to the clean run
      const additionsJoker = findPotentialAdditionsToMelds(handWithJoker, [tableMeld]);
      expect(additionsJoker.some((a) => a.cardIds.includes('nj1'))).toBe(false);

      // 2. Bot has > 4 cards with a suited 2 (acting as wildcard at 3♠ or 9♠) and deadwood
      const handWithSuited2 = [
        makeCard('s2', 'SPADES', 2), // Suited 2 acting as wildcard
        makeCard('h10', 'HEARTS', 10),
        makeCard('hj', 'HEARTS', 11),
        makeCard('d4', 'DIAMONDS', 4),
        makeCard('c6', 'CLUBS', 6),
      ];

      const additionsSuited2 = findPotentialAdditionsToMelds(handWithSuited2, [tableMeld]);
      expect(additionsSuited2.some((a) => a.cardIds.includes('s2'))).toBe(false);

      // 3. When bot IS close to Pukar (isCloseToPukar = true), wildcards CAN be added
      const additionsClose = findPotentialAdditionsToMelds(handWithJoker, [tableMeld], { isCloseToPukar: true });
      expect(additionsClose.some((a) => a.cardIds.includes('nj1'))).toBe(true);

      // 4. In FINAL_TURN, wildcards CAN be added to secure points
      const additionsFinal = findPotentialAdditionsToMelds(handWithJoker, [tableMeld], {
        isCloseToPukar: false,
        isFinalTurn: true,
      });
      expect(additionsFinal.some((a) => a.cardIds.includes('nj1'))).toBe(true);
    });

    it('bots do not randomly leave a 4-card discard pile when it contains connecting cards or sequence value', () => {
      const state = createTestState();
      state.players[1].hand = [
        makeCard('h1', 'SPADES', 5),
        makeCard('h2', 'HEARTS', 9),
        makeCard('h3', 'CLUBS', 10),
      ];
      // Discard pile has 4 cards, and 6♠ connects with hand 5♠
      state.discardPile = [
        makeCard('dp1', 'CLUBS', 2),
        makeCard('dp2', 'DIAMONDS', 7),
        makeCard('dp3', 'DIAMONDS', 9),
        makeCard('dp4', 'SPADES', 6), // Connects with 5♠
      ];

      // Smart Chacha does NOT leave the 4-card pile with a connector
      const planChacha = decideSmartChachaTurn(state, 1, createEmptyMemory());
      expect(planChacha.drawAction.type).toBe('TAKE_DISCARD');

      // Fast Chachi also takes the 4-card pile
      const planChachi = decideFastChachiTurn(state, 1, createEmptyMemory());
      expect(planChachi.drawAction.type).toBe('TAKE_DISCARD');

      // The Long-Term Guy also takes the 4-card pile because 6♠ adds sequence value
      const planLT = decideTheLongTermGuyTurn(state, 1, createEmptyMemory());
      expect(planLT.drawAction.type).toBe('TAKE_DISCARD');
    });
  });

  describe('Bot Information Privacy & Cold-Start Hidden Information', () => {
    it('at the start of the game, bot memory has zero cards logged and prediction sets are completely empty', () => {
      const memory = createInitialBotMemory();
      expect(memory.cardLog).toEqual([]);
      expect(Object.keys(memory.bottomPickupsByPlayer)).toHaveLength(0);
      expect(Object.keys(memory.discardsByPlayer)).toHaveLength(0);

      const state = createTestState();
      const oppWants = predictOpponentWants(memory, state, 'B');
      expect(oppWants.size).toBe(0);

      const { partnerNeeds, partnerDiscards } = predictPartnerNeeds(memory, state, 'B', 1);
      expect(partnerNeeds.size).toBe(0);
      expect(partnerDiscards.size).toBe(0);
    });

    it('all 4 bots execute cleanly without inspecting or depending on other players secret hand cards', () => {
      const state = createTestState();
      state.phase = 'MELD';
      state.turnPhase = 'MELD';

      // Set Player 1 (the bot) hand
      state.players[1].hand = [
        makeCard('s3', 'SPADES', 3),
        makeCard('s4', 'SPADES', 4),
        makeCard('s5', 'SPADES', 5),
        makeCard('c8', 'CLUBS', 8),
      ];

      // MASK all other players hands (simulate strict hidden state / SanitizedGameState)
      state.players[0].hand = undefined as any;
      (state.players[0] as any).cardCount = 13;
      state.players[2].hand = undefined as any;
      (state.players[2] as any).cardCount = 13;
      state.players[3].hand = undefined as any;
      (state.players[3] as any).cardCount = 13;

      const memory = createInitialBotMemory();

      // 1. Smart Chacha
      expect(() => decideSmartChachaTurn(state, 1, memory)).not.toThrow();
      const planChacha = decideSmartChachaTurn(state, 1, memory);
      expect(planChacha.discardAction.cardId).toBeDefined();

      // 2. The Jadugar
      expect(() => decideTheJadugarTurn(state, 1, memory)).not.toThrow();
      const planJadugar = decideTheJadugarTurn(state, 1, memory);
      expect(planJadugar.discardAction.cardId).toBeDefined();

      // 3. Fast Chachi
      expect(() => decideFastChachiTurn(state, 1, memory)).not.toThrow();
      const planChachi = decideFastChachiTurn(state, 1, memory);
      expect(planChachi.discardAction.cardId).toBeDefined();

      // 4. The Long-Term Guy
      expect(() => decideTheLongTermGuyTurn(state, 1, memory)).not.toThrow();
      const planLT = decideTheLongTermGuyTurn(state, 1, memory);
      expect(planLT.discardAction.cardId).toBeDefined();
    });
  });

  describe('Multi-Meld Opening Turns (Pure + Dirty in the Same Turn)', () => {
    it('findBestMeldPlan stages both Pure Run and Dirty Run in the same opening turn', () => {
      const hand = [
        makeCard('s3', 'SPADES', 3),
        makeCard('s4', 'SPADES', 4),
        makeCard('s5', 'SPADES', 5),
        makeCard('h8', 'HEARTS', 8),
        makeCard('h9', 'HEARTS', 9),
        makeCard('j1', null, 0, true), // Natural Joker
        makeCard('kd', 'DIAMONDS', 13), // 1 deadwood card to preserve for discard
      ];

      // Opening turn: teamMelds on table is empty
      const plan = findBestMeldPlan(hand, [], { preserveDiscardCard: true });

      // Both the pure meld and dirty meld must be staged
      expect(plan.meldsToPlay.length).toBe(2);
      expect(plan.meldsToPlay[0].isPure).toBe(true);
      expect(plan.meldsToPlay[0].cards.map((c) => c.id).sort()).toEqual(['s3', 's4', 's5']);
      expect(plan.meldsToPlay[1].isPure).toBe(false);
      expect(plan.meldsToPlay[1].cards.map((c) => c.id).sort()).toEqual(['h8', 'h9', 'j1']);

      // Deadwood card is preserved for discard
      expect(plan.usedCardIds.has('kd')).toBe(false);
    });

    it('bots (Smart Chacha, The Jadugar, and The Long-Term Guy) play both Pure Run and Dirty Run in the same opening turn', () => {
      const state = createTestState();
      state.phase = 'MELD';
      state.turnPhase = 'MELD';
      state.melds['B'] = []; // 0 team melds on table

      state.players[1].hand = [
        makeCard('s3', 'SPADES', 3),
        makeCard('s4', 'SPADES', 4),
        makeCard('s5', 'SPADES', 5),
        makeCard('h8', 'HEARTS', 8),
        makeCard('h9', 'HEARTS', 9),
        makeCard('j1', null, 0, true),
        makeCard('kd', 'DIAMONDS', 13),
      ];

      const memory = createEmptyMemory();

      // 1. Smart Chacha
      const planChacha = decideSmartChachaTurn(state, 1, memory);
      const chachaMelds = planChacha.meldActions.filter((a) => a.type === 'PLAY_NEW_MELD');
      expect(chachaMelds.length).toBe(2);

      // 2. The Jadugar
      const planJadugar = decideTheJadugarTurn(state, 1, memory);
      const jadugarMelds = planJadugar.meldActions.filter((a) => a.type === 'PLAY_NEW_MELD');
      expect(jadugarMelds.length).toBe(2);

      // 3. The Long-Term Guy
      const planLT = decideTheLongTermGuyTurn(state, 1, memory);
      const ltMelds = planLT.meldActions.filter((a) => a.type === 'PLAY_NEW_MELD');
      expect(ltMelds.length).toBe(2);
    });

    it('pukarReducer executes Pure Run then Dirty Run staged in the same turn without error', () => {
      const state = createTestState();
      state.phase = 'MELD';
      state.turnPhase = 'MELD';
      state.melds['B'] = []; // 0 team melds on table initially

      state.players[1].hand = [
        makeCard('s3', 'SPADES', 3),
        makeCard('s4', 'SPADES', 4),
        makeCard('s5', 'SPADES', 5),
        makeCard('h8', 'HEARTS', 8),
        makeCard('h9', 'HEARTS', 9),
        makeCard('j1', null, 0, true),
        makeCard('kd', 'DIAMONDS', 13),
      ];

      const memory = createEmptyMemory();
      const plan = decideSmartChachaTurn(state, 1, memory);

      let currentState = state;
      for (const action of plan.meldActions) {
        const result = pukarReducer(currentState, action);
        expect(result.error).toBeUndefined();
        currentState = result.state;
      }

      // Both melds are on table for Team B
      expect(currentState.melds['B'].length).toBe(2);
      expect(currentState.melds['B'][0].isPure).toBe(true);
      expect(currentState.melds['B'][1].isPure).toBe(false);
    });

    it('does NOT stage dirty melds when no pure run exists on opening turn', () => {
      const hand = [
        makeCard('h8', 'HEARTS', 8),
        makeCard('h9', 'HEARTS', 9),
        makeCard('j1', null, 0, true), // Dirty run only
        makeCard('c4', 'CLUBS', 4),
        makeCard('d6', 'DIAMONDS', 6),
        makeCard('kd', 'DIAMONDS', 13),
      ];

      // Opening turn with no pure run
      const plan = findBestMeldPlan(hand, [], { preserveDiscardCard: true });
      expect(plan.meldsToPlay.length).toBe(0);
      expect(plan.usedCardIds.size).toBe(0);
    });

    it('Fast Chachi prioritizes non-extreme pure run over extreme dirty run on opening turn', () => {
      const state = createTestState();
      state.phase = 'MELD';
      state.turnPhase = 'MELD';
      state.melds['B'] = []; // 0 team melds on table (opening turn)

      state.players[1].hand = [
        makeCard('s4', 'SPADES', 4),
        makeCard('s5', 'SPADES', 5),
        makeCard('s6', 'SPADES', 6), // Non-extreme pure run
        makeCard('hq', 'HEARTS', 12),
        makeCard('hk', 'HEARTS', 13), // Extreme card (rank 13)
        makeCard('j1', null, 0, true), // Joker
        makeCard('c8', 'CLUBS', 8), // Discard card
      ];

      const memory = createEmptyMemory();
      const plan = decideFastChachiTurn(state, 1, memory);
      const meldActions = plan.meldActions.filter((a) => a.type === 'PLAY_NEW_MELD');
      expect(meldActions.length).toBe(2);

      // The FIRST meld played MUST be the pure run (s4, s5, s6), NOT the dirty extreme run!
      const firstMeldCardIds = (meldActions[0] as { type: 'PLAY_NEW_MELD'; cardIds: string[] }).cardIds;
      expect(firstMeldCardIds.sort()).toEqual(['s4', 's5', 's6']);

      // Also verify reducer accepts it
      let currentState = state;
      for (const action of meldActions) {
        const result = pukarReducer(currentState, action);
        expect(result.error).toBeUndefined();
        currentState = result.state;
      }
      expect(currentState.melds['B'].length).toBe(2);
      expect(currentState.melds['B'][0].isPure).toBe(true);
    });
  });

  describe('Natural Joker Retrieval Priority (Task 4)', () => {
    it('findPotentialAdditionsToMelds assigns high priority (+150) when validation.pickedUpCard is present', () => {
      const meldWithJoker: Meld = {
        id: 'meld-run-joker',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          makeCard('s4', 'SPADES', 4),
          makeCard('joker-1', null, 0, true),
          makeCard('s6', 'SPADES', 6),
        ],
        slots: [
          { card: makeCard('s4', 'SPADES', 4), representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
          { card: makeCard('joker-1', null, 0, true), representedRank: 5, representedSuit: 'SPADES', isWildcard: true },
          { card: makeCard('s6', 'SPADES', 6), representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
        ],
        isClean: false,
        isPure: false,
        isPure13: false,
        points: 0,
        team: 'B',
      };

      const hand = [
        makeCard('s5', 'SPADES', 5), // replaces joker-1
        makeCard('s7', 'SPADES', 7), // normal addition
      ];

      const additions = findPotentialAdditionsToMelds(hand, [meldWithJoker]);
      expect(additions.length).toBeGreaterThanOrEqual(2);

      const jokerRetrievalAddition = additions.find((a) => a.cardIds.length === 1 && a.cardIds[0] === 's5');
      const normalAddition = additions.find((a) => a.cardIds.length === 1 && a.cardIds[0] === 's7');

      expect(jokerRetrievalAddition).toBeDefined();
      expect(normalAddition).toBeDefined();

      // Joker retrieval gets +150 bonus (standard score 25 + 150 = 175)
      expect(jokerRetrievalAddition!.score).toBeGreaterThanOrEqual(175);
      expect(normalAddition!.score).toBeLessThan(100);

      // Must be sorted highest priority first
      // Pair [s5, s7] has score 205 (55 + 150) and single s5 has score 175, both retrieve the Joker!
      expect(additions[0].cardIds).toContain('s5');
    });

    it('bot strategy prioritizes substituting the natural card to retrieve the Joker over a normal addition', () => {
      const state = createTestState();
      state.phase = 'MELD';
      state.turnPhase = 'MELD';

      const meldWithJoker: Meld = {
        id: 'meld-joker',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          makeCard('s4', 'SPADES', 4),
          makeCard('joker-1', null, 0, true),
          makeCard('s6', 'SPADES', 6),
        ],
        slots: [
          { card: makeCard('s4', 'SPADES', 4), representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
          { card: makeCard('joker-1', null, 0, true), representedRank: 5, representedSuit: 'SPADES', isWildcard: true },
          { card: makeCard('s6', 'SPADES', 6), representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
        ],
        isClean: false,
        isPure: false,
        isPure13: false,
        points: 0,
        team: 'B',
      };

      const normalMeld: Meld = {
        id: 'meld-normal',
        type: 'RUN',
        suit: 'HEARTS',
        cards: [
          makeCard('h7', 'HEARTS', 7),
          makeCard('h8', 'HEARTS', 8),
          makeCard('h9', 'HEARTS', 9),
        ],
        slots: [
          { card: makeCard('h7', 'HEARTS', 7), representedRank: 7, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h8', 'HEARTS', 8), representedRank: 8, representedSuit: 'HEARTS', isWildcard: false },
          { card: makeCard('h9', 'HEARTS', 9), representedRank: 9, representedSuit: 'HEARTS', isWildcard: false },
        ],
        isClean: true,
        isPure: true,
        isPure13: false,
        points: 0,
        team: 'B',
      };

      // Place normalMeld first in array so normalMeld would be evaluated first without score boost
      state.melds['B'] = [normalMeld, meldWithJoker];

      state.players[1].hand = [
        makeCard('h10', 'HEARTS', 10), // normal addition to normalMeld
        makeCard('s5', 'SPADES', 5),    // joker retrieval on meldWithJoker
        makeCard('c3', 'CLUBS', 3),     // deadwood
      ];

      const plan = decideSmartChachaTurn(state, 1, createEmptyMemory());
      expect(plan.meldActions.length).toBeGreaterThan(0);

      // The FIRST meld action must be the Joker retrieval addition on meldWithJoker!
      const firstAction = plan.meldActions[0];
      expect(firstAction.type).toBe('ADD_TO_MELD');
      if (firstAction.type === 'ADD_TO_MELD') {
        expect(firstAction.meldId).toBe('meld-joker');
        expect(firstAction.cardIds).toEqual(['s5']);
      }
    });
  });

  describe('Final Turn All-Out Dump Mode (Task 8)', () => {
    it('when roundStatus is FINAL_TURN with hand length > 4, a bot adds a cross-suit 2 to a dirty table run', () => {
      const state = createTestState();
      state.roundStatus = 'FINAL_TURN';
      state.phase = 'MELD';
      state.turnPhase = 'MELD';

      const dirtyTableRun: Meld = {
        id: 'meld-dirty-run',
        type: 'RUN',
        suit: 'SPADES',
        team: 'B',
        cards: [
          makeCard('s4', 'SPADES', 4),
          makeCard('s5', 'SPADES', 5),
          makeCard('s6', 'SPADES', 6),
        ],
        slots: [
          { card: makeCard('s4', 'SPADES', 4), representedRank: 4, isWildcard: false },
          { card: makeCard('s5', 'SPADES', 5), representedRank: 5, isWildcard: false },
          { card: makeCard('s6', 'SPADES', 6), representedRank: 6, isWildcard: false },
        ],
        isClean: false,
        isPure: false,
        points: 0,
      };
      state.melds['B'] = [dirtyTableRun];

      // Bot hand has 5 cards (> 4, so not close to Pukar under normal rules)
      state.players[1].hand = [
        makeCard('d2', 'DIAMONDS', 2), // cross-suit 2
        makeCard('c8', 'CLUBS', 8),
        makeCard('h10', 'HEARTS', 10),
        makeCard('cj', 'CLUBS', 11),
        makeCard('c4', 'CLUBS', 4),
      ];

      const memory = createEmptyMemory();
      const plan = decideSmartChachaTurn(state, 1, memory);

      // Must add the cross-suit 2 to the dirty table run
      const addAction = plan.meldActions.find(
        (a) => a.type === 'ADD_TO_MELD' && (a as any).meldId === 'meld-dirty-run'
      );
      expect(addAction).toBeDefined();
      expect((addAction as any).cardIds).toContain('d2');
    });

    it('when roundStatus is FINAL_TURN, a bot can form a new dirty run using a cross-suit 2', () => {
      const state = createTestState();
      state.roundStatus = 'FINAL_TURN';
      state.phase = 'MELD';
      state.turnPhase = 'MELD';

      // Team B already has a pure run on table so opening requirement is satisfied
      const existingPureRun: Meld = {
        id: 'meld-pure-run',
        type: 'RUN',
        suit: 'HEARTS',
        team: 'B',
        cards: [
          makeCard('h7', 'HEARTS', 7),
          makeCard('h8', 'HEARTS', 8),
          makeCard('h9', 'HEARTS', 9),
        ],
        slots: [
          { card: makeCard('h7', 'HEARTS', 7), representedRank: 7, isWildcard: false },
          { card: makeCard('h8', 'HEARTS', 8), representedRank: 8, isWildcard: false },
          { card: makeCard('h9', 'HEARTS', 9), representedRank: 9, isWildcard: false },
        ],
        isClean: true,
        isPure: true,
        points: 0,
      };
      state.melds['B'] = [existingPureRun];

      // Bot hand has 5 cards: s4, s5, and d2 (cross-suit 2), plus 2 deadwood cards
      state.players[1].hand = [
        makeCard('s4', 'SPADES', 4),
        makeCard('s5', 'SPADES', 5),
        makeCard('d2', 'DIAMONDS', 2), // cross-suit 2
        makeCard('c8', 'CLUBS', 8),
        makeCard('h12', 'HEARTS', 12),
      ];

      const memory = createEmptyMemory();
      const plan = decideSmartChachaTurn(state, 1, memory);

      // Must form the new dirty run [s4, s5, d2]
      const newMeldAction = plan.meldActions.find((a) => a.type === 'PLAY_NEW_MELD');
      expect(newMeldAction).toBeDefined();
      expect((newMeldAction as any).cardIds.sort()).toEqual(['d2', 's4', 's5']);
    });

    it('when lastTurnTriggeredByDeckExhaust is true, bots also dump cross-suit 2 into table runs and new dirty runs', () => {
      const state = createTestState();
      state.roundStatus = 'PLAYING';
      state.lastTurnTriggeredByDeckExhaust = true;
      state.phase = 'MELD';
      state.turnPhase = 'MELD';

      const dirtyTableRun: Meld = {
        id: 'meld-dirty-run',
        type: 'RUN',
        suit: 'SPADES',
        team: 'B',
        cards: [
          makeCard('s4', 'SPADES', 4),
          makeCard('s5', 'SPADES', 5),
          makeCard('s6', 'SPADES', 6),
        ],
        slots: [
          { card: makeCard('s4', 'SPADES', 4), representedRank: 4, isWildcard: false },
          { card: makeCard('s5', 'SPADES', 5), representedRank: 5, isWildcard: false },
          { card: makeCard('s6', 'SPADES', 6), representedRank: 6, isWildcard: false },
        ],
        isClean: false,
        isPure: false,
        points: 0,
      };
      state.melds['B'] = [dirtyTableRun];

      state.players[1].hand = [
        makeCard('d2', 'DIAMONDS', 2),
        makeCard('c8', 'CLUBS', 8),
        makeCard('h10', 'HEARTS', 10),
        makeCard('cj', 'CLUBS', 11),
        makeCard('c4', 'CLUBS', 4),
      ];

      const plan = decideTheJadugarTurn(state, 1, createEmptyMemory());
      const addAction = plan.meldActions.find(
        (a) => a.type === 'ADD_TO_MELD' && (a as any).meldId === 'meld-dirty-run'
      );
      expect(addAction).toBeDefined();
      expect((addAction as any).cardIds).toContain('d2');
    });

    it('The Long-Term Guy and Fast Chachi also dump cross-suit 2s during FINAL_TURN', () => {
      const state = createTestState();
      state.roundStatus = 'FINAL_TURN';
      state.phase = 'MELD';
      state.turnPhase = 'MELD';

      const existingPureRun: Meld = {
        id: 'meld-pure-run',
        type: 'RUN',
        suit: 'HEARTS',
        team: 'B',
        cards: [
          makeCard('h7', 'HEARTS', 7),
          makeCard('h8', 'HEARTS', 8),
          makeCard('h9', 'HEARTS', 9),
        ],
        slots: [
          { card: makeCard('h7', 'HEARTS', 7), representedRank: 7, isWildcard: false },
          { card: makeCard('h8', 'HEARTS', 8), representedRank: 8, isWildcard: false },
          { card: makeCard('h9', 'HEARTS', 9), representedRank: 9, isWildcard: false },
        ],
        isClean: true,
        isPure: true,
        points: 0,
      };
      state.melds['B'] = [existingPureRun];

      state.players[1].hand = [
        makeCard('s4', 'SPADES', 4),
        makeCard('s5', 'SPADES', 5),
        makeCard('d2', 'DIAMONDS', 2),
        makeCard('c8', 'CLUBS', 8),
        makeCard('h12', 'HEARTS', 12),
      ];

      const ltgPlan = decideTheLongTermGuyTurn(state, 1, createEmptyMemory());
      const ltgMeldAction = ltgPlan.meldActions.find((a) => a.type === 'PLAY_NEW_MELD');
      expect(ltgMeldAction).toBeDefined();
      expect((ltgMeldAction as any).cardIds.sort()).toEqual(['d2', 's4', 's5']);

      const fcPlan = decideFastChachiTurn(state, 1, createEmptyMemory());
      const fcMeldAction = fcPlan.meldActions.find((a) => a.type === 'PLAY_NEW_MELD');
      expect(fcMeldAction).toBeDefined();
      expect((fcMeldAction as any).cardIds.sort()).toEqual(['d2', 's4', 's5']);
    });

    it('relaxes connecting cards preservation penalty during evaluateDeadwoodAndDiscard when isFinalTurn is true', () => {
      const hand = [
        makeCard('s8', 'SPADES', 8),
        makeCard('s9', 'SPADES', 9), // Connected cards (adjacent ranks)
        makeCard('c4', 'CLUBS', 4),
        makeCard('d6', 'DIAMONDS', 6),
        makeCard('h10', 'HEARTS', 10),
      ];

      // Normal turn (isCloseToPukar = false, isFinalTurn = false):
      // Connected cards receive +60 preservation penalty
      const normalEval = evaluateDeadwoodAndDiscard(hand, new Set(), {
        isCloseToPukar: false,
        isFinalTurn: false,
      });
      const normalS8Score = normalEval.discardScores.find((ds) => ds.card.id === 's8')!.score;

      // Final turn (isCloseToPukar = false, isFinalTurn = true):
      // Connected cards do NOT receive +60 preservation penalty
      const finalTurnEval = evaluateDeadwoodAndDiscard(hand, new Set(), {
        isCloseToPukar: false,
        isFinalTurn: true,
      });
      const finalS8Score = finalTurnEval.discardScores.find((ds) => ds.card.id === 's8')!.score;

      // Exactly 60 point difference from the relaxed connector penalty
      expect(normalS8Score - finalS8Score).toBe(60);
    });
  });

  describe('Realistic Uncle Pukar Deck Selection (Fair-Play Information Privacy)', () => {
    it('keeps Deck 0 when activePlayer.hand contains a valid meld even if alternative deck has more melds', () => {
      const state = createTestState();
      // Active player hand (Deck 0) contains 1 valid pure meld (SPADES 7, 8, 9) and disconnected deadwood
      state.players[1].hand = [
        makeCard('s7', 'SPADES', 7),
        makeCard('s8', 'SPADES', 8),
        makeCard('s9', 'SPADES', 9),
        makeCard('c4', 'CLUBS', 4),
        makeCard('h6', 'HEARTS', 6),
        makeCard('d11', 'DIAMONDS', 11),
      ];

      // pukarPool[0] has 2 valid melds (in the cheating implementation, the bot would peek and choose deckIndex 1)
      state.pukarPool = [
        [
          makeCard('p1', 'HEARTS', 3),
          makeCard('p2', 'HEARTS', 4),
          makeCard('p3', 'HEARTS', 5),
          makeCard('p4', 'CLUBS', 10),
          makeCard('p5', 'CLUBS', 11),
          makeCard('p6', 'CLUBS', 12),
        ],
      ];

      // Under fair play, bot cannot peek at pukarPool; its own hand already has a valid meld, so it keeps Deck 0
      const chosenDeck = selectBotPukarDeck(state, 1, 'smart_chacha');
      expect(chosenDeck).toBe(0);
    });

    it('keeps Deck 0 when activePlayer.hand contains a wildcard even if no melds are formed', () => {
      const state = createTestState();
      // Active player hand has a wildcard (rank 2) and deadwood (0 completed melds)
      state.players[1].hand = [
        makeCard('w2', 'HEARTS', 2),
        makeCard('c4', 'CLUBS', 4),
        makeCard('s7', 'SPADES', 7),
        makeCard('d11', 'DIAMONDS', 11),
        makeCard('h13', 'HEARTS', 13),
      ];

      // pukarPool has alternative decks with melds
      state.pukarPool = [
        [
          makeCard('p1', 'HEARTS', 3),
          makeCard('p2', 'HEARTS', 4),
          makeCard('p3', 'HEARTS', 5),
        ],
      ];

      // Bot values holding a wildcard and keeps Deck 0
      const chosenDeck = selectBotPukarDeck(state, 1, 'smart_chacha');
      expect(chosenDeck).toBe(0);
    });

    it('can switch to an alternate deck when activePlayer.hand contains 0 melds and 0 wildcards', () => {
      const state = createTestState();
      // Completely disconnected cards: 0 melds, 0 wildcards
      state.players[1].hand = [
        makeCard('c3', 'CLUBS', 3),
        makeCard('s5', 'SPADES', 5),
        makeCard('h7', 'HEARTS', 7),
        makeCard('d9', 'DIAMONDS', 9),
        makeCard('c11', 'CLUBS', 11),
        makeCard('s13', 'SPADES', 13),
      ];

      state.pukarPool = [
        [makeCard('p1', 'HEARTS', 4), makeCard('p2', 'CLUBS', 6)],
      ];

      // With a weak hand (0 melds, 0 wildcards), human player gambles and switches to alternate deck
      const chosenDeck = selectBotPukarDeck(state, 1, 'smart_chacha');
      expect(chosenDeck).toBe(1);
    });

    it('works without reading pukarPool contents (e.g. proxying or freezing pukarPool cards)', () => {
      const state = createTestState();
      // Hand with a meld
      state.players[1].hand = [
        makeCard('s7', 'SPADES', 7),
        makeCard('s8', 'SPADES', 8),
        makeCard('s9', 'SPADES', 9),
      ];

      // Proxy pukarPool cards so any access to card contents throws an error
      const forbiddenDeck = new Proxy([] as Card[], {
        get(_target, prop) {
          if (prop === 'length') return 13;
          throw new Error(`Cheating attempt: inspected face-down pukarPool card property "${String(prop)}"`);
        },
      });

      state.pukarPool = [forbiddenDeck];

      // Must complete without reading face-down cards
      expect(() => {
        const choice = selectBotPukarDeck(state, 1, 'smart_chacha');
        expect(choice).toBe(0);
      }).not.toThrow();
    });
  });

  describe('Strict Lockdown Defense & Burying Connecting Cards (Task 10)', () => {
    it('strictly refuses to discard open-end neighbor or card feeding opponent meld when next opponent has 1 card left', () => {
      const state = createTestState();
      // Bot is player 1 (Team B), next player is player 2 (Team A, opponent)
      state.players[2].hand = [makeCard('opp1', 'HEARTS', 8)]; // opponent on 1 card!

      // Opponent Team A has an existing meld on table: SPADES 5, 6, 7
      state.melds.A = [
        {
          id: 'meld_opp_1',
          team: 'A',
          type: 'RUN',
          suit: 'SPADES',
          cards: [
            makeCard('s5', 'SPADES', 5),
            makeCard('s6', 'SPADES', 6),
            makeCard('s7', 'SPADES', 7),
          ],
          slots: [
            { card: makeCard('s5', 'SPADES', 5), representedRank: 5 },
            { card: makeCard('s6', 'SPADES', 6), representedRank: 6 },
            { card: makeCard('s7', 'SPADES', 7), representedRank: 7 },
          ],
          isPure: true,
        },
      ];

      // Bot hand: 8♠ (max + 1 open end neighbor to opponent run),
      // 4♠ (min - 1 open end neighbor to opponent run),
      // 10♦ (completely safe isolated deadwood with zero connections)
      state.players[1].hand = [
        makeCard('s8', 'SPADES', 8),
        makeCard('s4', 'SPADES', 4),
        makeCard('d10', 'DIAMONDS', 10),
      ];
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';

      const plan = decideSmartChachaTurn(state, 1, createEmptyMemory());
      // Must discard safe isolated deadwood (d10), never 8♠ or 4♠
      expect(plan.discardAction.cardId).toBe('d10');

      // Verify evaluateDeadwoodAndDiscard gives 8♠ and 4♠ massive penalty (+500)
      const evalResult = evaluateDeadwoodAndDiscard(state.players[1].hand, new Set(), {
        opponentMelds: state.melds.A,
        nextOpponentCardCount: 1,
      });
      const s8Score = evalResult.discardScores.find((ds) => ds.card.id === 's8')!.score;
      const s4Score = evalResult.discardScores.find((ds) => ds.card.id === 's4')!.score;
      const d10Score = evalResult.discardScores.find((ds) => ds.card.id === 'd10')!.score;

      expect(s8Score).toBeGreaterThanOrEqual(550);
      expect(s4Score).toBeGreaterThanOrEqual(550);
      expect(d10Score).toBeLessThan(100);
    });

    it('ensures all bot strategies avoid discarding connecting cards to an opponent on <= 2 cards', () => {
      const state = createTestState();
      // Next player (player 2, Team A) has 2 cards left
      state.players[2].hand = [
        makeCard('opp1', 'HEARTS', 8),
        makeCard('opp2', 'DIAMONDS', 8),
      ];

      // Opponent has a SET of 9s on table
      state.melds.A = [
        {
          id: 'meld_opp_set',
          team: 'A',
          type: 'SET',
          rank: 9,
          cards: [
            makeCard('s9', 'SPADES', 9),
            makeCard('h9', 'HEARTS', 9),
            makeCard('d9', 'DIAMONDS', 9),
          ],
          slots: [
            { card: makeCard('s9', 'SPADES', 9), representedRank: 9 },
            { card: makeCard('h9', 'HEARTS', 9), representedRank: 9 },
            { card: makeCard('d9', 'DIAMONDS', 9), representedRank: 9 },
          ],
        },
      ];

      // Bot hand: 9♣ (matches opponent's SET of 9s), and isolated deadwood K♦
      state.players[1].hand = [
        makeCard('c9', 'CLUBS', 9),
        makeCard('d13', 'DIAMONDS', 13),
      ];
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';

      const memory = createEmptyMemory();

      // All 4 bots must discard d13 (safe deadwood) and avoid c9 (feeding opponent set)
      expect(decideSmartChachaTurn(state, 1, memory).discardAction.cardId).toBe('d13');
      expect(decideFastChachiTurn(state, 1, memory).discardAction.cardId).toBe('d13');
      expect(decideTheJadugarTurn(state, 1, memory).discardAction.cardId).toBe('d13');
      expect(decideTheLongTermGuyTurn(state, 1, memory).discardAction.cardId).toBe('d13');

      // Verify evaluateDeadwoodAndDiscard gives c9 massive penalty (+500) for matching opponent SET
      const evalResult = evaluateDeadwoodAndDiscard(state.players[1].hand, new Set(), {
        opponentMelds: state.melds.A,
        nextOpponentCardCount: 2,
      });
      const c9Score = evalResult.discardScores.find((ds) => ds.card.id === 'c9')!.score;
      expect(c9Score).toBeGreaterThanOrEqual(550);
    });

    it('discards irrelevant deadwood to bury a connecting card in the discard pile without breaking own hand', () => {
      const state = createTestState();
      // Discard pile has a wildcard 2 on top (exposed connector)
      state.discardPile = [makeCard('dp_w2', 'HEARTS', 2)];

      // Next player is opponent (Player 2)
      state.players[2].hand = [
        makeCard('opp1', 'SPADES', 10),
        makeCard('opp2', 'SPADES', 11),
        makeCard('opp3', 'SPADES', 12),
      ];

      // Bot hand has:
      // - Pair in hand: 7♣, 7♦ (building bot's hand)
      // - 2-card consecutive run: 8♠, 9♠ (building bot's hand)
      // - Isolated irrelevant deadwood: Q♥ (zero connections to hand, table melds, or opponents)
      state.players[1].hand = [
        makeCard('c7', 'CLUBS', 7),
        makeCard('d7', 'DIAMONDS', 7),
        makeCard('s8', 'SPADES', 8),
        makeCard('s9', 'SPADES', 9),
        makeCard('h12', 'HEARTS', 12),
      ];
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';

      const plan = decideSmartChachaTurn(state, 1, createEmptyMemory());
      // Bot preserves its pair (c7, d7) and run (s8, s9), choosing the irrelevant deadwood h12 to bury the wildcard
      expect(plan.discardAction.cardId).toBe('h12');

      // Verify evaluateDeadwoodAndDiscard assigns discount to irrelevant deadwood
      const evalResult = evaluateDeadwoodAndDiscard(state.players[1].hand, new Set(), {
        discardPile: state.discardPile,
        nextOpponentCardCount: 3,
      });
      expect(evalResult.recommendedDiscard?.id).toBe('h12');
      const h12Score = evalResult.discardScores.find((ds) => ds.card.id === 'h12')!.score;
      const c7Score = evalResult.discardScores.find((ds) => ds.card.id === 'c7')!.score;
      const s8Score = evalResult.discardScores.find((ds) => ds.card.id === 's8')!.score;

      // h12 is chosen because it is safe junk, while c7 (pair) and s8 (consecutive run) are preserved
      expect(h12Score).toBeLessThanOrEqual(0);
      expect(h12Score).toBeLessThan(c7Score);
      expect(h12Score).toBeLessThan(s8Score);
    });

    it('assigns +500 lockdown penalty to predicted opponent wants from memory when next opponent has <= 2 cards', () => {
      const state = createTestState();
      state.players[2].hand = [makeCard('opp1', 'HEARTS', 10)]; // opponent on 1 card
      state.phase = 'DISCARD';
      state.turnPhase = 'DISCARD';

      const memory = createEmptyMemory();
      // Memory recorded player 2 picking up HEARTS 9 from bottom, so wants HEARTS 10
      memory.bottomPickupsByPlayer[2] = [makeCard('h9', 'HEARTS', 9)];

      state.players[1].hand = [
        makeCard('h10', 'HEARTS', 10), // Opponent predicted want
        makeCard('c4', 'CLUBS', 4), // Safe isolated deadwood
      ];

      const plan = decideSmartChachaTurn(state, 1, memory);
      // Smart Chacha strictly refuses to discard h10, discarding c4
      expect(plan.discardAction.cardId).toBe('c4');

      const oppWants = predictOpponentWants(memory, state, 'B');
      const evalResult = evaluateDeadwoodAndDiscard(state.players[1].hand, new Set(), {
        opponentWants: oppWants,
        nextOpponentCardCount: 1,
      });
      const h10Score = evalResult.discardScores.find((ds) => ds.card.id === 'h10')!.score;
      expect(h10Score).toBeGreaterThanOrEqual(550);
    });
    it('all bots meld obvious dirty runs (e.g. 5♠-Joker-7♠-8♠ and 4♣-5♣-2♣-7♣) when opponent team has opened a pure sequence on the board', () => {
      const state = createTestState();
      // Smart Chacha is Player 1 (Team B) or Player 2 (Team A)
      // Let Team B have a pure sequence on the board:
      state.melds.B = [
        {
          id: 'meld-pure-b',
          team: 'B',
          type: 'RUN',
          suit: 'HEARTS',
          cards: [
            makeCard('h5', 'HEARTS', 5),
            makeCard('h6', 'HEARTS', 6),
            makeCard('h7', 'HEARTS', 7),
          ],
          slots: [
            { card: makeCard('h5', 'HEARTS', 5), representedRank: 5, isWildcard: false, representedSuit: 'HEARTS' },
            { card: makeCard('h6', 'HEARTS', 6), representedRank: 6, isWildcard: false, representedSuit: 'HEARTS' },
            { card: makeCard('h7', 'HEARTS', 7), representedRank: 7, isWildcard: false, representedSuit: 'HEARTS' },
          ],
          isClean: true,
          isPure: true,
        },
      ];
      // Team A has 0 melds on the board
      state.melds.A = [];

      // Team A bot (Player 0) holds the exact cards from the user's report:
      // 5♠, 7♠, 8♠, Natural Joker (can make 5♠-Joker-7♠-8♠)
      // 4♣, 5♣, 7♣, 2♣ (can make 4♣-5♣-2♣-7♣)
      // plus deadwood: 9♦, J♣, K♠, Natural Joker 2
      const botHand = [
        makeCard('j1', null, 0, true),
        makeCard('s5', 'SPADES', 5),
        makeCard('j2', null, 0, true),
        makeCard('d9', 'DIAMONDS', 9),
        makeCard('c2', 'CLUBS', 2),
        makeCard('s7', 'SPADES', 7),
        makeCard('c5', 'CLUBS', 5),
        makeCard('cj', 'CLUBS', 11),
        makeCard('c7', 'CLUBS', 7),
        makeCard('c4', 'CLUBS', 4),
        makeCard('sk', 'SPADES', 13),
        makeCard('s8', 'SPADES', 8),
      ];
      state.players[0].hand = [...botHand];
      state.players[0].team = 'A';
      state.phase = 'MELD';
      state.turnPhase = 'MELD';

      // Test Smart Chacha:
      const planChacha = decideSmartChachaTurn(state, 0, createEmptyMemory());
      const chachaMeldCards = planChacha.meldActions
        .filter((a) => a.type === 'PLAY_NEW_MELD')
        .map((a: any) => a.cardIds.sort().join(','));
      // Must meld both the Spades run (s5, s7, s8, j1/j2) and Clubs run (c4, c5, c7, c2)
      expect(chachaMeldCards.some((key) => key.includes('s5') && key.includes('s7') && key.includes('s8'))).toBe(true);
      expect(chachaMeldCards.some((key) => key.includes('c4') && key.includes('c5') && key.includes('c7'))).toBe(true);

      // Test Fast Chachi:
      const planChachi = decideFastChachiTurn(state, 0, createEmptyMemory());
      const chachiMeldCards = planChachi.meldActions
        .filter((a) => a.type === 'PLAY_NEW_MELD')
        .map((a: any) => a.cardIds.sort().join(','));
      expect(chachiMeldCards.some((key) => key.includes('s5') && key.includes('s7') && key.includes('s8'))).toBe(true);

      // Test The Jadugar:
      const planJadugar = decideTheJadugarTurn(state, 0, createEmptyMemory());
      const jadugarMeldCards = planJadugar.meldActions
        .filter((a) => a.type === 'PLAY_NEW_MELD')
        .map((a: any) => a.cardIds.sort().join(','));
      expect(jadugarMeldCards.some((key) => key.includes('s5') && key.includes('s7') && key.includes('s8'))).toBe(true);

      // Test The Long-Term Guy:
      const planLT = decideTheLongTermGuyTurn(state, 0, createEmptyMemory());
      const ltMeldCards = planLT.meldActions
        .filter((a) => a.type === 'PLAY_NEW_MELD')
        .map((a: any) => a.cardIds.sort().join(','));
      expect(ltMeldCards.some((key) => key.includes('s5') && key.includes('s7') && key.includes('s8'))).toBe(true);
    });
  });
});



