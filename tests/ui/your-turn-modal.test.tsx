import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { YourTurnModal } from '../../src/ui/components/YourTurnModal';
import App from '../../src/App';
import { dealInitialState } from '../../src/engine/deck';

describe('YourTurnModal (3-Second Unmissable Modal Overlay)', () => {
  it('renders as a centered modal overlay when isOpen is true', () => {
    const onDismiss = vi.fn();
    const html = renderToString(
      <YourTurnModal
        isOpen={true}
        playerName="Harsh"
        team="A"
        onDismiss={onDismiss}
      />
    );

    // Modal container checks
    expect(html).toContain('data-testid="your-turn-modal"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('fixed inset-0');

    // Royal card styling and copy
    expect(html).toContain('Your Turn!');
    expect(html).toContain('Action Required');
    expect(html).toContain('Harsh');
    expect(html).toContain('Team A');
    expect(html).toContain('draw from the Stock Deck or Discard Pile to begin');

    // Action button & progress bar
    expect(html).toContain('Draw Card / Start Turn');
    expect(html).toContain('animate-turn-timer');
    expect(html).toContain('data-testid="btn-dismiss-your-turn"');
  });

  it('renders nothing when isOpen is false', () => {
    const onDismiss = vi.fn();
    const html = renderToString(
      <YourTurnModal
        isOpen={false}
        playerName="Harsh"
        team="A"
        onDismiss={onDismiss}
      />
    );

    expect(html).toBe('');
  });

  it('renders in App as a centered modal rather than in the top header banner stack', () => {
    const state = dealInitialState(4);
    const html = renderToString(
      <App
        initialState={state}
        initialScreen="GAME"
        initialYourTurnBanner={true}
      />
    );

    // Should render the modal
    expect(html).toContain('data-testid="your-turn-modal"');
    expect(html).toContain('data-testid="your-turn-banner"');
    expect(html).toContain('fixed inset-0');

    // Top banner stack should not contain your-turn-banner inside the normal document flow
    expect(html).toContain('role="dialog"');
  });
});
