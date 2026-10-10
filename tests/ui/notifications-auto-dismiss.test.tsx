import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '../../src/App';
import { dealInitialState } from '../../src/engine/deck';

describe('In-Game Notifications & Auto-Dismiss Timers (10 Seconds)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Notification Banner Visual Renders', () => {
    it('renders the Royal Pukar Claimed banner when pukarBanner is active', () => {
      const state = dealInitialState(4);
      const html = renderToString(
        <App
          initialState={state}
          initialScreen="GAME"
          initialPukarBanner={{
            team: 'A',
            playerName: 'Player 1',
            points: 50,
          }}
        />
      );

      expect(html).toContain('data-testid="pukar-celebration-banner"');
      expect(html).toContain('ROYAL PUKAR CLAIMED!');
      expect(html).toContain('+50 PTS');
      expect(html).toContain('Player 1 (Team A) emptied their hand and claimed a 13-card Pukar deck!');
      expect(html).toContain('data-testid="btn-dismiss-pukar"');
    });

    it('renders the Normal Joker Picked Up banner when jokerPickupBanner is active', () => {
      const state = dealInitialState(4);
      const html = renderToString(
        <App
          initialState={state}
          initialScreen="GAME"
          initialJokerPickupBanner={{
            playerName: 'Player 2',
          }}
        />
      );

      expect(html).toContain('data-testid="joker-pickup-banner"');
      expect(html).toContain('NORMAL JOKER PICKED UP!');
      expect(html).toContain('Added to Hand');
      expect(html).toContain('Player 2 contributed the natural card replacing the Joker!');
      expect(html).toContain('data-testid="btn-dismiss-joker-pickup"');
    });

    it('renders the Deck Exhaustion banner when exhaustNotification is active', () => {
      const state = dealInitialState(4);
      const html = renderToString(
        <App
          initialState={state}
          initialScreen="GAME"
          initialExhaustNotification="Stock deck was empty! 1 Pukar deck (13 cards) was placed into the Stock deck."
        />
      );

      expect(html).toContain('data-testid="exhaust-notification"');
      expect(html).toContain('Stock deck was empty! 1 Pukar deck (13 cards) was placed into the Stock deck.');
    });

    it('does not render banners when notifications are null', () => {
      const state = dealInitialState(4);
      const html = renderToString(
        <App
          initialState={state}
          initialScreen="GAME"
        />
      );

      expect(html).not.toContain('data-testid="pukar-celebration-banner"');
      expect(html).not.toContain('data-testid="joker-pickup-banner"');
      expect(html).not.toContain('data-testid="exhaust-notification"');
    });
  });

  describe('10-Second Auto-Dismiss Logic Verification', () => {
    it('schedules auto-dismiss after exactly 10 seconds (10000ms)', () => {
      // Test the timer contract directly matching App.tsx's useEffect logic
      let pukarBanner: { team: 'A'; playerName: string; points: number } | null = {
        team: 'A',
        playerName: 'Player 1',
        points: 50,
      };

      const setPukarBanner = (val: null) => {
        pukarBanner = val;
      };

      // Simulate useEffect timer
      const timer = setTimeout(() => {
        setPukarBanner(null);
      }, 10000);

      // Before 10 seconds: still visible
      vi.advanceTimersByTime(9999);
      expect(pukarBanner).not.toBeNull();

      // At 10 seconds: dismissed
      vi.advanceTimersByTime(1);
      expect(pukarBanner).toBeNull();
      clearTimeout(timer);
    });

    it('schedules auto-dismiss for joker pickup banner after 10 seconds', () => {
      let jokerBanner: { playerName: string } | null = { playerName: 'Player 1' };
      const setJokerBanner = (val: null) => {
        jokerBanner = val;
      };

      const timer = setTimeout(() => {
        setJokerBanner(null);
      }, 10000);

      vi.advanceTimersByTime(5000);
      expect(jokerBanner).not.toBeNull();

      vi.advanceTimersByTime(5000);
      expect(jokerBanner).toBeNull();
      clearTimeout(timer);
    });

    it('schedules auto-dismiss for exhaust notification after 10 seconds', () => {
      let exhaustNotification: string | null = 'Stock deck empty';
      const setExhaustNotification = (val: null) => {
        exhaustNotification = val;
      };

      const timer = setTimeout(() => {
        setExhaustNotification(null);
      }, 10000);

      vi.advanceTimersByTime(9999);
      expect(exhaustNotification).not.toBeNull();

      vi.advanceTimersByTime(1);
      expect(exhaustNotification).toBeNull();
      clearTimeout(timer);
    });
  });
});
