import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';
import {
  clearDebugLog,
  getDebugLogData,
  recordGameSnapshot,
  getDebugSnapshotCount,
} from '../../src/engine/debug-logger';
import { createTableShortcutHandler } from '../../src/ui/hooks/useTableShortcuts';
import { GameState, GameAction } from '../../src/engine/types';

describe('Debug Logger Integration with Game State Machine & Shortcuts', () => {
  let gameState: GameState;

  beforeEach(() => {
    clearDebugLog();
    gameState = dealInitialState(4);
  });

  it('records turn progression accurately across draw, meld, and discard', () => {
    // 1. Initial deal snapshot
    recordGameSnapshot(gameState);
    expect(getDebugSnapshotCount()).toBe(1);

    // 2. Player 0 draws a card
    const drawAction: GameAction = { type: 'DRAW_FROM_STOCK' };
    const drawResult = pukarReducer(gameState, drawAction);
    expect(drawResult.error).toBeUndefined();
    gameState = drawResult.state;
    recordGameSnapshot(gameState, drawAction);

    expect(getDebugSnapshotCount()).toBe(2);
    expect(gameState.players[0].hand.length).toBe(14); // 13 + 1 drawn

    // 3. Player 0 discards a card
    const cardToDiscard = gameState.players[0].hand[0];
    const discardAction: GameAction = { type: 'DISCARD_CARD', cardId: cardToDiscard.id };
    const discardResult = pukarReducer(gameState, discardAction);
    expect(discardResult.error).toBeUndefined();
    gameState = discardResult.state;
    recordGameSnapshot(gameState, discardAction);

    expect(getDebugSnapshotCount()).toBe(3);

    // Verify logged history details
    const log = getDebugLogData(gameState);
    expect(log.version).toBe(1);
    expect(log.history.length).toBe(3);

    // Step 1: Initial deal
    expect(log.history[0].stepIndex).toBe(1);
    expect(log.history[0].phase).toBe('DRAW');
    expect(log.history[0].players[0].cardCount).toBe(13);

    // Step 2: Draw
    expect(log.history[1].stepIndex).toBe(2);
    expect(log.history[1].action).toEqual({ type: 'DRAW_FROM_STOCK' });
    expect(log.history[1].players[0].cardCount).toBe(14);
    expect(log.history[1].phase).toBe('MELD');

    // Step 3: Discard
    expect(log.history[2].stepIndex).toBe(3);
    expect(log.history[2].action).toEqual(discardAction);
    expect(log.history[2].players[0].cardCount).toBe(13);
    // Turn advanced to next player
    expect(log.history[2].currentPlayerIndex).toBe(1);
    expect(log.history[2].phase).toBe('DRAW');
  });

  it('exports log via "qq" shortcut with notification and valid JSON format', () => {
    // Setup state and record some actions
    recordGameSnapshot(gameState);
    const drawAction: GameAction = { type: 'DRAW_FROM_STOCK' };
    const drawResult = pukarReducer(gameState, drawAction);
    gameState = drawResult.state;
    recordGameSnapshot(gameState, drawAction);

    const onNotify = vi.fn();
    const onAction = vi.fn();

    // Mock DOM download mechanism
    const mockAnchor = { href: '', download: '', click: vi.fn() };
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;

    globalThis.document = {
      createElement: vi.fn().mockReturnValue(mockAnchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    } as any;
    globalThis.window = {
      URL: {
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      },
    } as any;

    try {
      const handler = createTableShortcutHandler({
        currentScreen: 'GAME',
        onAction,
        onNotify,
        gameState,
      });

      let time = 10000;
      vi.spyOn(Date, 'now').mockImplementation(() => time);

      // Press 'q' then 'q' within 400ms
      handler({ key: 'q' });
      time += 400;
      handler({ key: 'q' });

      // Check notification
      expect(onNotify).toHaveBeenCalledWith('Debug log downloaded! (qq)');

      // Check download anchor triggered
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockAnchor.download).toMatch(/^pukar-debug-log-.*\.json$/);

      // Check log contents
      const logData = getDebugLogData(gameState);
      expect(logData.history.length).toBe(2);
      expect(logData.liveState?.currentPlayerIndex).toBe(gameState.currentPlayerIndex);
    } finally {
      globalThis.document = originalDocument;
      globalThis.window = originalWindow;
    }
  });
});
