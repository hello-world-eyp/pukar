import { describe, it, expect } from 'vitest';
import { dealInitialState } from '../../../src/engine/deck';
import { pukarReducer } from '../../../src/engine/reducer';
import { GameAction, GameState } from '../../../src/engine/types';
import {
  createInitialBotMemory,
  decideBotTurn,
  selectBotPukarDeck,
  updateBotMemory,
} from '../../../src/engine/bots/bot-player';
import { BotPersonality } from '../../../src/engine/bots/types';

describe('Bot Match Simulation & Engine Integration', () => {
  it('updates bot memory correctly when players discard and take discard', () => {
    let memory = createInitialBotMemory();
    const state = dealInitialState(4);
    state.phase = 'MELD';
    state.turnPhase = 'MELD';
    const cardToDiscard = state.players[0].hand[0];

    const discardAction: GameAction = {
      type: 'DISCARD_CARD',
      cardId: cardToDiscard.id,
    };

    const discardResult = pukarReducer(state, discardAction);
    expect(discardResult.error).toBeUndefined();

    memory = updateBotMemory(memory, state, discardResult.state, discardAction, 0);
    expect(memory.cardLog.length).toBe(1);
    expect(memory.cardLog[0].action).toBe('DISCARD');
    expect(memory.cardLog[0].cardId).toBe(cardToDiscard.id);
    expect(memory.discardsByPlayer[0]?.length).toBe(1);
  });

  it('runs a full 4-bot match simulation across 40 turns without errors or invalid moves', () => {
    let state: GameState = dealInitialState(4);
    let memory = createInitialBotMemory();

    const botPersonalities: BotPersonality[] = [
      'smart_chacha', // Seat 0 (Team A)
      'the_jadugar', // Seat 1 (Team B)
      'fast_chachi', // Seat 2 (Team A)
      'the_long_term_guy', // Seat 3 (Team B)
    ];

    let turnsCompleted = 0;
    const maxTurns = 40;

    while (turnsCompleted < maxTurns && !state.isRoundOver) {
      const activeIdx = state.currentPlayerIndex;
      const personality = botPersonalities[activeIdx];

      // Step 1: Draw Phase
      if (state.phase === 'DRAW') {
        const plan = decideBotTurn(state, activeIdx, personality, memory);
        const prevState = state;
        const drawResult = pukarReducer(state, plan.drawAction);
        expect(drawResult.error).toBeUndefined();
        state = drawResult.state;
        memory = updateBotMemory(memory, prevState, state, plan.drawAction, activeIdx);
      }

      // Step 2: Meld Phase
      if (state.phase === 'MELD') {
        const plan = decideBotTurn(state, activeIdx, personality, memory);

        // Execute any candidate melds
        for (const meldAction of plan.meldActions) {
          const prevState = state;
          const meldResult = pukarReducer(state, meldAction);
          // If valid, apply and update memory
          if (!meldResult.error) {
            state = meldResult.state;
            memory = updateBotMemory(memory, prevState, state, meldAction, activeIdx);
          }
        }

        // Check if bot emptied hand mid-meld and claimed a Pukar
        if (
          state.initialHandSizeThisTurn === 0 &&
          state.pukarPool.length >= 1 &&
          state.players[activeIdx].hand.length === 13
        ) {
          const chosenIndex = selectBotPukarDeck(state, activeIdx, personality);
          if (chosenIndex > 0) {
            const selectResult = pukarReducer(state, {
              type: 'SELECT_PUKAR_DECK',
              deckIndex: chosenIndex,
            });
            if (!selectResult.error) {
              state = selectResult.state;
            }
          }
        }
      }

      // Step 3: Discard Phase
      if (state.phase === 'MELD' || state.phase === 'DISCARD') {
        const plan = decideBotTurn(state, activeIdx, personality, memory);
        const prevState = state;
        const discardResult = pukarReducer(state, plan.discardAction);
        expect(discardResult.error).toBeUndefined();
        state = discardResult.state;
        memory = updateBotMemory(memory, prevState, state, plan.discardAction, activeIdx);
        turnsCompleted++;
      }
    }

    expect(turnsCompleted).toBeGreaterThan(0);
    expect(state.round).toBeGreaterThanOrEqual(1);
    expect(state.discardPile.length).toBeGreaterThan(0);
  });

  it('runs a 6-bot match simulation across 30 turns without errors', () => {
    let state: GameState = dealInitialState(6);
    let memory = createInitialBotMemory();

    const botPersonalities: BotPersonality[] = [
      'smart_chacha', // Seat 0 (Team A)
      'the_jadugar', // Seat 1 (Team B)
      'fast_chachi', // Seat 2 (Team A)
      'the_long_term_guy', // Seat 3 (Team B)
      'smart_chacha', // Seat 4 (Team A)
      'fast_chachi', // Seat 5 (Team B)
    ];

    let turnsCompleted = 0;
    const maxTurns = 30;

    while (turnsCompleted < maxTurns && !state.isRoundOver) {
      const activeIdx = state.currentPlayerIndex;
      const personality = botPersonalities[activeIdx];

      // Draw
      if (state.phase === 'DRAW') {
        const plan = decideBotTurn(state, activeIdx, personality, memory);
        const prevState = state;
        const drawResult = pukarReducer(state, plan.drawAction);
        expect(drawResult.error).toBeUndefined();
        state = drawResult.state;
        memory = updateBotMemory(memory, prevState, state, plan.drawAction, activeIdx);
      }

      // Discard
      if (state.phase === 'MELD' || state.phase === 'DISCARD') {
        const plan = decideBotTurn(state, activeIdx, personality, memory);
        const prevState = state;
        const discardResult = pukarReducer(state, plan.discardAction);
        expect(discardResult.error).toBeUndefined();
        state = discardResult.state;
        memory = updateBotMemory(memory, prevState, state, plan.discardAction, activeIdx);
        turnsCompleted++;
      }
    }

    expect(turnsCompleted).toBe(30);
  });
});
