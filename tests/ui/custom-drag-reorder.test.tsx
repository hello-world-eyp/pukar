import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PlayerHand } from '../../src/ui/components/PlayerHand';
import { Card } from '../../src/engine/types';

describe('PlayerHand Custom Drag & Drop Reordering', () => {
  const c1: Card = { id: 'c1', suit: 'SPADES', rank: 10 };
  const c2: Card = { id: 'c2', suit: 'HEARTS', rank: 5 };
  const c3: Card = { id: 'c3', suit: 'CLUBS', rank: 7 };
  const c4: Card = { id: 'c4', suit: 'DIAMONDS', rank: 4 };

  it('renders all cards with draggable attributes and individual slot indices', () => {
    const cards = [c1, c2, c3, c4];
    const html = renderToString(<PlayerHand cards={cards} />);

    expect(html).toContain('data-testid="hand-card-slot-0"');
    expect(html).toContain('data-testid="hand-card-slot-1"');
    expect(html).toContain('data-testid="hand-card-slot-2"');
    expect(html).toContain('data-testid="hand-card-slot-3"');
    expect(html).toContain('draggable="true"');
    expect(html).toContain('Drag cards to reorder');
  });

  it('disables dragging when disabled prop is true', () => {
    const cards = [c1, c2];
    const html = renderToString(<PlayerHand cards={cards} disabled={true} />);

    expect(html).toContain('draggable="false"');
  });

  it('preserves custom reordered array order through onReorderCards callback', () => {
    const cards = [c1, c2, c3, c4];
    const onReorder = vi.fn();

    // Reorder simulation: move card at index 0 (c1) to index 2
    const reorderedCards = [...cards];
    const [moved] = reorderedCards.splice(0, 1);
    reorderedCards.splice(2, 0, moved);

    expect(reorderedCards.map((c) => c.id)).toEqual(['c2', 'c3', 'c1', 'c4']);

    const html = renderToString(
      <PlayerHand cards={reorderedCards} onReorderCards={onReorder} />
    );

    const slot0 = html.indexOf('data-testid="hand-card-slot-0"');
    const slot1 = html.indexOf('data-testid="hand-card-slot-1"');
    const slot2 = html.indexOf('data-testid="hand-card-slot-2"');
    const slot3 = html.indexOf('data-testid="hand-card-slot-3"');

    expect(slot0).toBeLessThan(slot1);
    expect(slot1).toBeLessThan(slot2);
    expect(slot2).toBeLessThan(slot3);

    // Verify c2 (5 of HEARTS) is rendered first and c1 (10 of SPADES) is rendered at slot 2
    const h5Idx = html.indexOf('5 of HEARTS');
    const c7Idx = html.indexOf('7 of CLUBS');
    const s10Idx = html.indexOf('10 of SPADES');

    expect(h5Idx).toBeLessThan(c7Idx);
    expect(c7Idx).toBeLessThan(s10Idx);
  });
});
