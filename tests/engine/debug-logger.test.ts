import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordGameSnapshot,
  getDebugLogData,
  exportDebugLogFile,
  clearDebugLog,
  setDebugGameMode,
  getDebugSnapshotCount,
  MAX_DEBUG_SNAPSHOTS,
} from '../../src/engine/debug-logger';
import { dealInitialState } from '../../src/engine/deck';
import { GameState } from '../../src/engine/types';

describe('Debug Logger Engine', () => {
  let sampleState: GameState;

  beforeEach(() => {
    clearDebugLog();
    setDebugGameMode('BOTS');
    sampleState = dealInitialState(4);
  });

  it('records a game snapshot with complete turn and table details', () => {
    expect(getDebugSnapshotCount()).toBe(0);

    const snapshot = recordGameSnapshot(sampleState, { type: 'DRAW_FROM_STOCK' });

    expect(snapshot.stepIndex).toBe(1);
    expect(snapshot.action).toEqual({ type: 'DRAW_FROM_STOCK' });
    expect(snapshot.round).toBe(sampleState.round);
    expect(snapshot.currentPlayerIndex).toBe(sampleState.currentPlayerIndex);
    expect(snapshot.phase).toBe(sampleState.phase);
    expect(snapshot.players.length).toBe(4);
    expect(snapshot.players[0].hand.length).toBe(sampleState.players[0].hand.length);
    expect(snapshot.stockDeckCount).toBe(sampleState.stockDeck.length);
    expect(snapshot.discardPile).toEqual(sampleState.discardPile);
    expect(getDebugSnapshotCount()).toBe(1);
  });

  it('stores snapshots immutably so subsequent game mutations do not alter past history', () => {
    recordGameSnapshot(sampleState);

    // Mutate original state hand and discard pile
    sampleState.players[0].hand.pop();
    sampleState.discardPile.push({ id: 'dummy-card', suit: 'SPADES', rank: 10 });

    const log = getDebugLogData(sampleState);
    const recorded = log.history[0];

    // Historical snapshot should still reflect original state before mutation
    expect(recorded.players[0].hand.length).toBe(13);
    expect(recorded.discardPile.length).toBe(1);
    expect(sampleState.discardPile.length).toBe(2);
  });

  it('maintains a ring buffer capping history at MAX_DEBUG_SNAPSHOTS', () => {
    const totalToAdd = MAX_DEBUG_SNAPSHOTS + 20;

    for (let i = 1; i <= totalToAdd; i++) {
      recordGameSnapshot(sampleState, {
        type: 'DISCARD_CARD',
        cardId: `card-${i}`,
      });
    }

    expect(getDebugSnapshotCount()).toBe(MAX_DEBUG_SNAPSHOTS);
    const log = getDebugLogData(sampleState);
    expect(log.history.length).toBe(MAX_DEBUG_SNAPSHOTS);

    // Oldest snapshot should be step 21, newest step should be totalToAdd
    expect(log.history[0].stepIndex).toBe(21);
    expect(log.history[log.history.length - 1].stepIndex).toBe(totalToAdd);
    expect(log.totalSnapshots).toBe(totalToAdd);
  });

  it('produces structured debug log data with liveState and history', () => {
    recordGameSnapshot(sampleState, { type: 'DRAW_FROM_STOCK' });

    const log = getDebugLogData(sampleState);

    expect(log.version).toBe(1);
    expect(log.appName).toBe('Pukar Card Game');
    expect(typeof log.exportedAt).toBe('string');
    expect(log.gameMode).toBe('BOTS');
    expect(log.liveState).toBeDefined();
    expect(log.liveState?.currentPlayerIndex).toBe(sampleState.currentPlayerIndex);
    expect(log.history.length).toBe(1);
  });

  it('clears log history and resets counters upon clearDebugLog()', () => {
    recordGameSnapshot(sampleState);
    recordGameSnapshot(sampleState);
    expect(getDebugSnapshotCount()).toBe(2);

    clearDebugLog();

    expect(getDebugSnapshotCount()).toBe(0);
    const log = getDebugLogData();
    expect(log.history.length).toBe(0);
    expect(log.totalSnapshots).toBe(0);
  });

  it('supports updating gameMode', () => {
    setDebugGameMode('LOCAL');
    let log = getDebugLogData(sampleState);
    expect(log.gameMode).toBe('LOCAL');

    setDebugGameMode('MULTIPLAYER');
    log = getDebugLogData(sampleState);
    expect(log.gameMode).toBe('MULTIPLAYER');
  });

  it('exports debug log file via browser DOM download link', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    };

    const mockDocument = {
      createElement: vi.fn().mockReturnValue(mockAnchor),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };

    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const mockRevokeObjectURL = vi.fn();

    globalThis.document = mockDocument as any;
    globalThis.window = {
      URL: {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      },
    } as any;

    try {
      recordGameSnapshot(sampleState);
      const downloadSpy = vi.fn();

      const success = exportDebugLogFile(sampleState, {
        filename: 'test-debug-log.json',
        onDownload: downloadSpy,
      });

      expect(success).toBe(true);
      expect(mockDocument.createElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.download).toBe('test-debug-log.json');
      expect(mockAnchor.href).toBe('blob:mock-url');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
      expect(downloadSpy).toHaveBeenCalledWith('test-debug-log.json');
    } finally {
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
    }
  });

  it('handles non-browser environments gracefully during export without throwing', () => {
    const originalDocument = globalThis.document;
    delete (globalThis as any).document;

    try {
      recordGameSnapshot(sampleState);
      const downloadSpy = vi.fn();
      const success = exportDebugLogFile(sampleState, {
        onDownload: downloadSpy,
      });

      expect(typeof success).toBe('boolean');
    } finally {
      globalThis.document = originalDocument;
    }
  });
});
