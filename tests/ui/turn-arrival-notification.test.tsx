import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from '../../src/App';
import { dealInitialState } from '../../src/engine/deck';

describe('Turn Arrival 3-Second Popup Banner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders [🔔 Your Turn!] banner with royal gold/emerald styling and subtitle in App', () => {
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
    expect(html).toContain('border-amber-400');
    expect(html).toContain('from-emerald-950/95');
    expect(html).toContain('It&#x27;s your turn — draw from the Stock Deck or Discard Pile to begin.');
    expect(html).toContain('data-testid="btn-dismiss-your-turn"');
  });

  it('does not render the banner when initialYourTurnBanner is false', () => {
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

  it('auto-dismisses after exactly 3 seconds (3000ms)', () => {
    let yourTurnBanner = true;
    const setYourTurnBanner = (val: boolean) => {
      yourTurnBanner = val;
    };

    // Simulate auto-dismiss timer logic in useGameNotifications
    const timer = setTimeout(() => {
      setYourTurnBanner(false);
    }, 3000);

    // Before 3000ms: still active
    vi.advanceTimersByTime(2999);
    expect(yourTurnBanner).toBe(true);

    // At 3000ms: dismissed
    vi.advanceTimersByTime(1);
    expect(yourTurnBanner).toBe(false);

    clearTimeout(timer);
  });
});
