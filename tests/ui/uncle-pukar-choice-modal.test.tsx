import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { UnclePukarChoiceModal } from '../../src/ui/components/UnclePukarChoiceModal';

describe('UnclePukarChoiceModal Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when isOpen is false', () => {
    const html = renderToString(
      <UnclePukarChoiceModal
        isOpen={false}
        availableDecksCount={2}
        onSelectDeck={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('renders live clock, Uncle cartoon image, and joke reference header when open', () => {
    const html = renderToString(
      <UnclePukarChoiceModal
        isOpen={true}
        availableDecksCount={2}
        playerName="Chacha Ji"
        team="A"
        onSelectDeck={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="uncle-pukar-choice-modal"');
    expect(html).toContain('Auspicious Pukar Time');
    expect(html).toContain('data-testid="uncle-live-clock"');
    expect(html).toContain('data-testid="uncle-cartoon-image"');
    expect(html).toContain('src="/uncle-pukar.png"');
    expect(html).toContain('Chacha Ji (Team A) claimed a Pukar!');
    expect(html).toContain('Wait, let me see what time it is before taking the Pukar');
  });

  it('renders 2 deck selection buttons when availableDecksCount is 2', () => {
    const html = renderToString(
      <UnclePukarChoiceModal
        isOpen={true}
        availableDecksCount={2}
        onSelectDeck={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="btn-select-pukar-deck-0"');
    expect(html).toContain('data-testid="btn-select-pukar-deck-1"');
    expect(html).not.toContain('data-testid="btn-select-pukar-deck-2"');
    expect(html).toContain('Pukar Deck #1');
    expect(html).toContain('Pukar Deck #2');
    expect(html).toContain('13 Cards');
  });

  it('renders 3 deck selection buttons when availableDecksCount is 3', () => {
    const html = renderToString(
      <UnclePukarChoiceModal
        isOpen={true}
        availableDecksCount={3}
        onSelectDeck={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="btn-select-pukar-deck-0"');
    expect(html).toContain('data-testid="btn-select-pukar-deck-1"');
    expect(html).toContain('data-testid="btn-select-pukar-deck-2"');
    expect(html).toContain('Pukar Deck #3');
  });
});
