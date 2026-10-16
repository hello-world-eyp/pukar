import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTableShortcutHandler } from '../../src/ui/hooks/useTableShortcuts';
import { dealInitialState } from '../../src/engine/deck';
import * as debugLogger from '../../src/engine/debug-logger';

describe('useTableShortcuts - "qq" Debug Log Trigger & Keyboard Shortcuts', () => {
  let originalWindow: any;
  let originalDocument: any;

  beforeEach(() => {
    originalWindow = globalThis.window;
    originalDocument = globalThis.document;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    vi.restoreAllMocks();
  });

  it('triggers debug log export when "q" is pressed twice within 1.2s', () => {
    const onAction = vi.fn();
    const onNotify = vi.fn();
    const exportSpy = vi.spyOn(debugLogger, 'exportDebugLogFile').mockReturnValue(true);
    const mockState = dealInitialState(4);

    const handler = createTableShortcutHandler({
      currentScreen: 'GAME',
      onAction,
      onNotify,
      gameState: mockState,
    });

    let currentTime = 10000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    // First 'q'
    handler({ key: 'q' });
    expect(exportSpy).not.toHaveBeenCalled();
    expect(onNotify).not.toHaveBeenCalled();

    // Second 'q' within 500ms
    currentTime += 500;
    handler({ key: 'q' });

    expect(exportSpy).toHaveBeenCalledTimes(1);
    expect(exportSpy).toHaveBeenCalledWith(mockState);
    expect(onNotify).toHaveBeenCalledWith(expect.stringContaining('Debug log downloaded'));
  });

  it('works with uppercase "Q" as well', () => {
    const onAction = vi.fn();
    const exportSpy = vi.spyOn(debugLogger, 'exportDebugLogFile').mockReturnValue(true);

    const handler = createTableShortcutHandler({
      currentScreen: 'GAME',
      onAction,
    });

    let currentTime = 20000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    handler({ key: 'Q' });
    currentTime += 300;
    handler({ key: 'q' });

    expect(exportSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT trigger debug log export if the second "q" is pressed after 1.2 seconds', () => {
    const onAction = vi.fn();
    const exportSpy = vi.spyOn(debugLogger, 'exportDebugLogFile').mockReturnValue(true);

    const handler = createTableShortcutHandler({
      currentScreen: 'GAME',
      onAction,
    });

    let currentTime = 30000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    handler({ key: 'q' });
    currentTime += 1300; // 1.3s later (> 1.2s)
    handler({ key: 'q' });

    expect(exportSpy).not.toHaveBeenCalled();
  });

  it('does NOT trigger debug log export if an intervening key is pressed between q presses', () => {
    const onAction = vi.fn();
    const exportSpy = vi.spyOn(debugLogger, 'exportDebugLogFile').mockReturnValue(true);

    const handler = createTableShortcutHandler({
      currentScreen: 'GAME',
      onAction,
    });

    let currentTime = 40000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    handler({ key: 'q' });
    currentTime += 100;
    handler({ key: 'a' }); // Intervening key
    currentTime += 100;
    handler({ key: 'q' });

    expect(exportSpy).not.toHaveBeenCalled();
  });

  it('does NOT trigger when typing "q" inside form inputs or editable areas', () => {
    const onAction = vi.fn();
    const exportSpy = vi.spyOn(debugLogger, 'exportDebugLogFile').mockReturnValue(true);

    const handler = createTableShortcutHandler({
      currentScreen: 'GAME',
      onAction,
    });

    let currentTime = 50000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    handler({ key: 'q', target: { tagName: 'INPUT' } });
    currentTime += 100;
    handler({ key: 'q', target: { tagName: 'INPUT' } });
    expect(exportSpy).not.toHaveBeenCalled();

    handler({ key: 'q', target: { tagName: 'TEXTAREA' } });
    currentTime += 100;
    handler({ key: 'q', target: { tagName: 'TEXTAREA' } });
    expect(exportSpy).not.toHaveBeenCalled();

    handler({ key: 'q', target: { isContentEditable: true } });
    currentTime += 100;
    handler({ key: 'q', target: { isContentEditable: true } });
    expect(exportSpy).not.toHaveBeenCalled();
  });

  it('supports custom onExportDebugLog callback if supplied', () => {
    const onAction = vi.fn();
    const customExport = vi.fn();

    const handler = createTableShortcutHandler({
      currentScreen: 'GAME',
      onAction,
      onExportDebugLog: customExport,
    });

    let currentTime = 60000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    handler({ key: 'q' });
    currentTime += 200;
    handler({ key: 'q' });

    expect(customExport).toHaveBeenCalledTimes(1);
  });

  it('still triggers "jj" deck optimization shortcut as before', () => {
    const onAction = vi.fn();
    const handler = createTableShortcutHandler({
      currentScreen: 'GAME',
      onAction,
    });

    let currentTime = 70000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    handler({ key: 'j' });
    expect(onAction).not.toHaveBeenCalled();

    currentTime += 400;
    handler({ key: 'j' });
    expect(onAction).toHaveBeenCalledWith({ type: 'OPTIMIZE_DECK_ORDER' });
  });
});
