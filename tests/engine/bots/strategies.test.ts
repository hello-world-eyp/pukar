import { describe, it, expect } from 'vitest';
import { Card, GameState, Meld, Rank, Suit } from '../../../src/engine/types';
import { dealInitialState } from '../../../src/engine/deck';
import { BotMemory } from '../../../src/engine/bots/types';
import { decideSmartChachaTurn } from '../../../src/engine/bots/strategies/smart-chacha';
import { decideTheJadugarTurn } from '../../../src/engine/bots/strategies/the-jadugar';
import { decideFastChachiTurn } from '../../../src/engine/bots/strategies/fast-chachi';
import { decideTheLongTermGuyTurn } from '../../../src/engine/bots/strategies/the-long-term-guy';
import { findBestMeldPlan, findPotentialAdditionsToMelds } from '../../../src/engine/bots/hand-analyzer';

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
});

