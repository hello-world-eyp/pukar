import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TableMeldBoard } from '../../src/ui/components/TableMeldBoard';
import { SequencesPage } from '../../src/ui/components/SequencesPage';
import { Meld, Card } from '../../src/engine/types';

describe('Global Vertical Page Scroll: No Sequence Scroll Trapping', () => {
  const sampleCards: Card[] = [
    { id: 'c1', rank: 7, suit: 'SPADES' },
    { id: 'c2', rank: 8, suit: 'SPADES' },
    { id: 'c3', rank: 9, suit: 'SPADES' },
  ];

  const sampleMeld: Meld = {
    id: 'meld-1',
    team: 'A',
    type: 'RUN',
    suit: 'SPADES',
    cards: sampleCards,
    slots: sampleCards.map((c) => ({ card: c, representedRank: c.rank, representedSuit: c.suit ?? undefined })),
    isPure13: false,
    points: 0,
  };

  it('TableMeldBoard meld-cards-row does NOT contain horizontal or vertical scroll trap classes', () => {
    const html = renderToString(
      <TableMeldBoard
        melds={{ A: [sampleMeld], B: [] }}
        activeTeam="A"
      />
    );

    expect(html).toContain('data-testid="meld-cards-row"');

    // Extract the class attribute of meld-cards-row
    const match = html.match(/data-testid="meld-cards-row"[^>]*class="([^"]*)"/);
    expect(match).not.toBeNull();
    const classNames = match![1];

    // Must NOT have scroll trap classes that block wheel scrolling on parent page
    expect(classNames).not.toContain('overflow-x-auto');
    expect(classNames).not.toContain('overflow-y-hidden');
    expect(classNames).not.toContain('overscroll-y-contain');
    expect(classNames).not.toContain('scrollbar-thin');
  });

  it('SequencesPage enlarged cards row does NOT contain scroll trap classes', () => {
    const html = renderToString(
      <SequencesPage
        melds={{ A: [sampleMeld], B: [] }}
        activeTeam="A"
        onBackToTable={() => {}}
      />
    );

    expect(html).toContain('data-testid="enlarged-cards-row-meld-1"');

    // Extract class attribute
    const match = html.match(/data-testid="enlarged-cards-row-meld-1"[^>]*class="([^"]*)"/);
    expect(match).not.toBeNull();
    const classNames = match![1];

    // Must NOT have scroll trap classes
    expect(classNames).not.toContain('overflow-x-auto');
    expect(classNames).not.toContain('overflow-y-hidden');
    expect(classNames).not.toContain('overscroll-y-contain');
    expect(classNames).not.toContain('scrollbar-thin');
  });

  it('calculates adaptive negative margin for long sequences to fit within board', () => {
    const longCards: Card[] = Array.from({ length: 13 }, (_, i) => ({
      id: `c-${i}`,
      rank: ((i % 13) + 2) as any,
      suit: 'HEARTS',
    }));

    const longMeld: Meld = {
      id: 'long-meld',
      team: 'A',
      type: 'RUN',
      suit: 'HEARTS',
      cards: longCards,
      slots: longCards.map((c) => ({ card: c, representedRank: c.rank, representedSuit: c.suit ?? undefined })),
      isPure13: true,
      points: 500,
    };

    const html = renderToString(
      <TableMeldBoard
        melds={{ A: [longMeld], B: [] }}
        activeTeam="A"
      />
    );

    // Verify tighter negative margin is applied so long sequences fit without horizontal scroll
    expect(html).toMatch(/margin-left:-(8[0-9]|7[0-9]|6[8-9])px/);
  });
});
