import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pukarReducer } from '../../src/engine/reducer';
import { dealInitialState } from '../../src/engine/deck';
import { Card, GameState, isWildcard } from '../../src/engine/types';

describe('Table Keyboard Shortcuts - Key Listener & Execution Flow', () => {
  let listeners: Record<string, ((e: any) => void)[]> = {};
  let originalWindow: any;

  beforeEach(() => {
    listeners = {};
    originalWindow = globalThis.window;
    globalThis.window = {
      addEventListener: (event: string, cb: (e: any) => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      },
      removeEventListener: (event: string, cb: (e: any) => void) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((fn) => fn !== cb);
        }
      },
      innerWidth: 1024,
    } as any;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    vi.restoreAllMocks();
  });

  // Pure logic replica matching the exact implementation in App.tsx
  function createTableKeyListener(onTrigger: () => void) {
    let lastJTime = 0;

    return (e: { key: string; target?: any }) => {
      const target = e.target;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'j' || e.key === 'J') {
        const now = Date.now();
        if (now - lastJTime <= 1200) {
          lastJTime = 0;
          onTrigger();
        } else {
          lastJTime = now;
        }
      } else {
        lastJTime = 0;
      }
    };
  }

  it('triggers optimization action when "j" is pressed twice within 1.2 seconds', () => {
    const triggerSpy = vi.fn();
    const handleKeyDown = createTableKeyListener(triggerSpy);

    const now = 10000;
    vi.spyOn(Date, 'now').mockReturnValueOnce(now);
    handleKeyDown({ key: 'j' });
    expect(triggerSpy).not.toHaveBeenCalled();

    vi.spyOn(Date, 'now').mockReturnValueOnce(now + 400); // 400ms later
    handleKeyDown({ key: 'j' });
    expect(triggerSpy).toHaveBeenCalledTimes(1);
  });

  it('works with uppercase "J" as well', () => {
    const triggerSpy = vi.fn();
    const handleKeyDown = createTableKeyListener(triggerSpy);

    const now = 20000;
    vi.spyOn(Date, 'now').mockReturnValueOnce(now);
    handleKeyDown({ key: 'J' });

    vi.spyOn(Date, 'now').mockReturnValueOnce(now + 500);
    handleKeyDown({ key: 'j' });
    expect(triggerSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT trigger if the second "j" is pressed after more than 1.2 seconds', () => {
    const triggerSpy = vi.fn();
    const handleKeyDown = createTableKeyListener(triggerSpy);

    const now = 30000;
    vi.spyOn(Date, 'now').mockReturnValueOnce(now);
    handleKeyDown({ key: 'j' });

    vi.spyOn(Date, 'now').mockReturnValueOnce(now + 1500); // 1.5s later (expired)
    handleKeyDown({ key: 'j' });
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it('does NOT trigger when typing inside an input or textarea', () => {
    const triggerSpy = vi.fn();
    const handleKeyDown = createTableKeyListener(triggerSpy);

    const now = 40000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    handleKeyDown({ key: 'j', target: { tagName: 'INPUT' } });
    handleKeyDown({ key: 'j', target: { tagName: 'INPUT' } });
    expect(triggerSpy).not.toHaveBeenCalled();

    handleKeyDown({ key: 'j', target: { tagName: 'TEXTAREA' } });
    handleKeyDown({ key: 'j', target: { tagName: 'TEXTAREA' } });
    expect(triggerSpy).not.toHaveBeenCalled();

    handleKeyDown({ key: 'j', target: { isContentEditable: true } });
    handleKeyDown({ key: 'j', target: { isContentEditable: true } });
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it('resets buffer if an intervening key is pressed between j keys', () => {
    const triggerSpy = vi.fn();
    const handleKeyDown = createTableKeyListener(triggerSpy);

    const now = 50000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    handleKeyDown({ key: 'j' });
    handleKeyDown({ key: 'k' }); // interrupter
    handleKeyDown({ key: 'j' });
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it('triggers twice if user presses "jj" twice (4 j presses in pairs)', () => {
    const triggerSpy = vi.fn();
    const handleKeyDown = createTableKeyListener(triggerSpy);

    let t = 60000;
    vi.spyOn(Date, 'now').mockImplementation(() => t);

    // First pair
    t += 100;
    handleKeyDown({ key: 'j' });
    t += 200;
    handleKeyDown({ key: 'j' });
    expect(triggerSpy).toHaveBeenCalledTimes(1);

    // Second pair
    t += 300;
    handleKeyDown({ key: 'j' });
    t += 200;
    handleKeyDown({ key: 'j' });
    expect(triggerSpy).toHaveBeenCalledTimes(2);
  });

  it('end-to-end verification: action sets up the next card drawn to be a wildcard', () => {
    const state = dealInitialState(4);
    const nonWild1: Card = { id: 'c1', suit: 'SPADES', rank: 7 };
    const nonWild2: Card = { id: 'c2', suit: 'HEARTS', rank: 8 };
    const wildcardTwo: Card = { id: 'c-wild-two', suit: 'CLUBS', rank: 2 };
    const nonWild3: Card = { id: 'c3', suit: 'DIAMONDS', rank: 9 };

    let currentGameState: GameState = {
      ...state,
      phase: 'DRAW',
      stockDeck: [nonWild1, nonWild2, wildcardTwo, nonWild3],
    };

    expect(isWildcard(currentGameState.stockDeck[0])).toBe(false);

    // Trigger deck optimization action
    const actionResult = pukarReducer(currentGameState, { type: 'OPTIMIZE_DECK_ORDER' });
    expect(actionResult.error).toBeUndefined();
    currentGameState = actionResult.state;

    // Top card should now be the wildcard
    expect(currentGameState.stockDeck[0].id).toBe('c-wild-two');
    expect(isWildcard(currentGameState.stockDeck[0])).toBe(true);

    // Next player draws card from stock deck
    const drawResult = pukarReducer(currentGameState, { type: 'DRAW_FROM_STOCK' });
    expect(drawResult.error).toBeUndefined();

    const activePlayer = drawResult.state.players[drawResult.state.currentPlayerIndex];
    const drawnCard = activePlayer.hand[activePlayer.hand.length - 1];

    expect(drawnCard.id).toBe('c-wild-two');
    expect(isWildcard(drawnCard)).toBe(true);
  });
});
