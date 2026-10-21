import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlayerHand } from '../../src/ui/components/PlayerHand';
import { Card } from '../../src/engine/types';

describe('PlayerHand Touch Gestures & Tap Selection Verification', () => {
  const c1: Card = { id: 'c1', suit: 'SPADES', rank: 10 };
  const c2: Card = { id: 'c2', suit: 'HEARTS', rank: 5 };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * Helper that executes PlayerHand with a minimal hook dispatcher
   * and returns the top-level JSX element tree and its card slot props.
   */
  function runPlayerHand(props: any) {
    const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const oldH = internals?.H;

    const stateMap = new Map<number, any>();
    const refMap = new Map<number, any>();
    let stateIdx = 0;
    let refIdx = 0;

    let jsx: any;

    try {
      if (internals) {
        internals.H = {
          useState: (init: any) => {
            const idx = stateIdx++;
            if (!stateMap.has(idx)) {
              stateMap.set(idx, typeof init === 'function' ? init() : init);
            }
            const val = stateMap.get(idx);
            const setter = (updater: any) => {
              const nextVal = typeof updater === 'function' ? updater(stateMap.get(idx)) : updater;
              stateMap.set(idx, nextVal);
            };
            return [val, setter];
          },
          useRef: (init: any) => {
            const idx = refIdx++;
            if (!refMap.has(idx)) {
              refMap.set(idx, { current: init });
            }
            return refMap.get(idx);
          },
          useMemo: (factory: any) => factory(),
          useCallback: (fn: any) => fn,
          useEffect: () => {},
        };
      }

      jsx = (PlayerHand as any)(props);
    } finally {
      if (internals && oldH) {
        internals.H = oldH;
      }
    }

    return jsx;
  }

  // Recursive search for a child element matching predicate
  function findElement(element: any, predicate: (el: any) => boolean): any {
    if (!element || typeof element !== 'object') return null;
    if (predicate(element)) return element;

    const children = element.props?.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        const found = findElement(child, predicate);
        if (found) return found;
      }
    } else if (children && typeof children === 'object') {
      const found = findElement(children, predicate);
      if (found) return found;
    }
    return null;
  }

  it('allows tap-to-select on touch devices without suppressing click events', () => {
    const onToggleCardSelection = vi.fn();
    const onSelectCard = vi.fn();

    const tree = runPlayerHand({
      cards: [c1, c2],
      onToggleCardSelection,
      onSelectCard,
    });

    // Locate the first card slot
    const slot0 = findElement(tree, (el) => el.props?.['data-card-index'] === 0);
    expect(slot0).not.toBeNull();

    // The PlayingCard is the child inside slot0
    const playingCard = findElement(slot0, (el) => el.props?.card?.id === 'c1');
    expect(playingCard).not.toBeNull();

    // 1. User touches card slot (touchstart)
    slot0.props.onTouchStart({
      touches: [{ clientX: 100, clientY: 200 }],
      preventDefault: () => {},
    });

    // 2. User releases finger quickly without moving (touchend after 60ms - well under 300ms long-press)
    vi.advanceTimersByTime(60);
    slot0.props.onTouchEnd();

    // 3. Browser fires click event on the PlayingCard
    playingCard.props.onClick();

    // Selection MUST succeed for pure taps!
    expect(onToggleCardSelection).toHaveBeenCalledWith('c1');
    expect(onSelectCard).toHaveBeenCalledWith(c1);
  });

  it('cancels 300ms long-press hold timer if touch moves >10px to allow horizontal scrolling', () => {
    const onToggleCardSelection = vi.fn();

    const tree = runPlayerHand({
      cards: [c1, c2],
      onToggleCardSelection,
    });

    const slot0 = findElement(tree, (el) => el.props?.['data-card-index'] === 0);
    expect(slot0).not.toBeNull();

    // 1. Touch start
    slot0.props.onTouchStart({
      touches: [{ clientX: 100, clientY: 200 }],
      preventDefault: () => {},
    });

    // 2. User scrolls tray horizontally: moves finger 20px at 50ms (before 300ms hold)
    vi.advanceTimersByTime(50);
    slot0.props.onTouchMove({
      touches: [{ clientX: 120, clientY: 200 }],
    });

    // 3. 300ms timer expires while user is still scrolling
    vi.advanceTimersByTime(350);

    // 4. Touch ends
    slot0.props.onTouchEnd();

    // Selection is not triggered by scroll release
    expect(onToggleCardSelection).not.toHaveBeenCalled();
  });

  it('cancels drag hold on multi-touch gestures (e.g. pinch-to-zoom)', () => {
    const onToggleCardSelection = vi.fn();

    const tree = runPlayerHand({
      cards: [c1, c2],
      onToggleCardSelection,
    });

    const slot0 = findElement(tree, (el) => el.props?.['data-card-index'] === 0);

    // Single touch start
    slot0.props.onTouchStart({
      touches: [{ clientX: 100, clientY: 200 }],
      preventDefault: () => {},
    });

    // User pinches (2 touches detected during move)
    slot0.props.onTouchMove({
      touches: [
        { clientX: 100, clientY: 200 },
        { clientX: 150, clientY: 250 },
      ],
    });

    // Touch ends
    slot0.props.onTouchEnd();

    // Drag was cancelled cleanly without error
    expect(onToggleCardSelection).not.toHaveBeenCalled();
  });
});
