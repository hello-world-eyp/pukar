import { describe, it, expect } from 'vitest';
import { dealInitialState } from '../../../src/engine/deck';
import { pukarReducer } from '../../../src/engine/reducer';
import { decideBotTurn } from '../../../src/engine/bots/bot-player';
import { findBestMeldPlan } from '../../../src/engine/bots/hand-analyzer';
import { createInitialBotMemory } from '../../../src/engine/bots/bot-player';
import { Card, Meld } from '../../../src/engine/types';

describe('Bot End-Game & Pacing Bug Verifications', () => {
  it('does not commit all cards when hand has 2 cards and table additions exist (must keep at least 1 card to discard)', () => {
    // Bot hand has 2 cards: 7♠ and 8♠
    const hand: Card[] = [
      { id: 's7', suit: 'SPADES', rank: 7, isNaturalJoker: false, isJoker: false },
      { id: 's8', suit: 'SPADES', rank: 8, isNaturalJoker: false, isJoker: false },
    ];

    const s4: Card = { id: 's4', suit: 'SPADES', rank: 4, isNaturalJoker: false, isJoker: false };
    const s5: Card = { id: 's5', suit: 'SPADES', rank: 5, isNaturalJoker: false, isJoker: false };
    const s6: Card = { id: 's6', suit: 'SPADES', rank: 6, isNaturalJoker: false, isJoker: false };

    // Table has an existing Spades sequence 4♠-5♠-6♠
    const tableMelds: Meld[] = [
      {
        id: 'meld-r1-A-1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [s4, s5, s6],
        slots: [
          { card: s4, representedRank: 4, isWildcard: false },
          { card: s5, representedRank: 5, isWildcard: false },
          { card: s6, representedRank: 6, isWildcard: false },
        ],
        points: 30,
        isClean: true,
        isPure: true,
        isPure13: false,
      },
    ];

    // With preserveDiscardCard enabled, findBestMeldPlan must NOT commit both cards!
    const plan = findBestMeldPlan(hand, tableMelds, { preserveDiscardCard: true });

    // It should add exactly 1 card (s7), leaving 1 card (s8) in hand to discard
    expect(plan.additionsToPlay.length).toBe(1);
    expect(plan.additionsToPlay[0].cards.length).toBe(1);
    expect(plan.additionsToPlay[0].cards[0].id).toBe('s7');
    expect(plan.usedCardIds.size).toBe(1);
  });

  it('completes game cleanly when bot has 1 card, draws, melds 1 card, discards last card with 0 Pukars left', () => {
    const state = dealInitialState(4);
    // Exhaust Pukar pool and set Player 1 as active bot on Team B
    state.pukarPool = [];
    state.currentPlayerIndex = 1;
    state.phase = 'MELD';
    state.roundStatus = 'PLAYING';

    // Player 1 has 2 cards (1 card left + 1 drawn card)
    state.players[1].team = 'B';
    state.players[1].hand = [
      { id: 'h7', suit: 'HEARTS', rank: 7, isNaturalJoker: false, isJoker: false },
      { id: 'c9', suit: 'CLUBS', rank: 9, isNaturalJoker: false, isJoker: false },
    ];

    const h4: Card = { id: 'h4', suit: 'HEARTS', rank: 4, isNaturalJoker: false, isJoker: false };
    const h5: Card = { id: 'h5', suit: 'HEARTS', rank: 5, isNaturalJoker: false, isJoker: false };
    const h6: Card = { id: 'h6', suit: 'HEARTS', rank: 6, isNaturalJoker: false, isJoker: false };

    // Team B has a sequence of Hearts 4♥-5♥-6♥ on table
    const teamBMeld: Meld = {
      id: 'meld-r1-B-1',
      team: 'B',
      type: 'RUN',
      suit: 'HEARTS',
      cards: [h4, h5, h6],
      slots: [
        { card: h4, representedRank: 4, isWildcard: false },
        { card: h5, representedRank: 5, isWildcard: false },
        { card: h6, representedRank: 6, isWildcard: false },
      ],
      points: 30,
      isClean: true,
      isPure: true,
      isPure13: false,
    };
    state.melds.B = [teamBMeld];

    const memory = createInitialBotMemory();
    const plan = decideBotTurn(state, 1, 'smart_chacha', memory);

    // Verify meld plan leaves 1 card in hand
    expect(plan.meldActions.length).toBe(1);
    expect(plan.meldActions[0].type).toBe('ADD_TO_MELD');

    // Execute the meld action in engine
    const meldRes = pukarReducer(state, plan.meldActions[0]);
    expect(meldRes.error).toBeUndefined();
    expect(meldRes.state.players[1].hand.length).toBe(1);
    expect(meldRes.state.players[1].hand[0].id).toBe('c9');

    // Execute discard action to go out
    const discardRes = pukarReducer(meldRes.state, plan.discardAction);
    expect(discardRes.error).toBeUndefined();

    // Verify round is won and terminated cleanly!
    expect(discardRes.state.isRoundOver).toBe(true);
    expect(discardRes.state.roundStatus).toBe('ROUND_OVER');
    expect(discardRes.state.players[1].hand.length).toBe(0);
    expect(discardRes.state.scores.B).toBeGreaterThanOrEqual(50);
  });

  it('falls back to TAKE_DISCARD when stock deck is empty across all 4 bot strategies', () => {
    const personalities = ['smart_chacha', 'the_jadugar', 'fast_chachi', 'the_long_term_guy'] as const;

    for (const personality of personalities) {
      const state = dealInitialState(4);
      state.stockDeck = [];
      state.pukarPool = [];
      state.discardPile = [
        { id: 'd1', suit: 'DIAMONDS', rank: 10, isNaturalJoker: false, isJoker: false },
      ];
      state.phase = 'DRAW';
      state.currentPlayerIndex = 1;

      const memory = createInitialBotMemory();
      const plan = decideBotTurn(state, 1, personality, memory);

      // Must take discard pile because stock deck is empty
      expect(plan.drawAction.type).toBe('TAKE_DISCARD');
    }
  });

  it('cleanly ends the round if both stockDeck and discardPile are empty in DRAW phase', () => {
    const state = dealInitialState(4);
    state.stockDeck = [];
    state.discardPile = [];
    state.pukarPool = [];
    state.phase = 'DRAW';

    const res = pukarReducer(state, { type: 'DRAW_FROM_STOCK' });
    expect(res.state.isRoundOver).toBe(true);
    expect(res.state.roundStatus).toBe('ROUND_OVER');

    const discardRes = pukarReducer(state, { type: 'TAKE_DISCARD' });
    expect(discardRes.state.isRoundOver).toBe(true);
    expect(discardRes.state.roundStatus).toBe('ROUND_OVER');
  });
});
