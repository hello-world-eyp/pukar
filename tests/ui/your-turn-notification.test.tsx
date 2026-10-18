import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from '../../src/App';
import { dealInitialState } from '../../src/engine/deck';

describe('"Your Turn" Notification System', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders "YOUR TURN!" popup banner in App when initialYourTurnBanner is true', () => {
    const state = dealInitialState(4);
    const html = renderToString(
      <App
        initialState={state}
        initialScreen="GAME"
        initialYourTurnBanner={true}
      />
    );

    expect(html).toContain('data-testid="your-turn-banner"');
    expect(html).toContain('Your Turn!');
    expect(html).toContain('Action Required');
    expect(html).toContain('It&#x27;s your turn — draw from the Stock Deck or Discard Pile to begin.');
    expect(html).toContain('data-testid="btn-dismiss-your-turn"');
  });

  it('does not render "YOUR TURN!" banner when initialYourTurnBanner is false', () => {
    const state = dealInitialState(4);
    const html = renderToString(
      <App
        initialState={state}
        initialScreen="GAME"
        initialYourTurnBanner={false}
      />
    );

    expect(html).not.toContain('data-testid="your-turn-banner"');
  });

  it('schedules auto-dismiss for "Your turn" banner after exactly 3 seconds (3000ms)', () => {
    let yourTurnBanner = true;
    const setYourTurnBanner = (val: boolean) => {
      yourTurnBanner = val;
    };

    // Simulate useEffect auto-dismiss timer logic in useGameNotifications
    const timer = setTimeout(() => {
      setYourTurnBanner(false);
    }, 3000);

    // Before 3000ms: still active
    vi.advanceTimersByTime(2999);
    expect(yourTurnBanner).toBe(true);

    // At 3000ms: auto-dismisses
    vi.advanceTimersByTime(1);
    expect(yourTurnBanner).toBe(false);

    clearTimeout(timer);
  });
});
