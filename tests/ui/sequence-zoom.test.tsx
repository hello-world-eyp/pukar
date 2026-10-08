import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Meld } from '../../src/engine/types';
import { SequenceZoomModal } from '../../src/ui/components/SequenceZoomModal';

describe('SequenceZoomModal Component', () => {
  const sampleRun: Meld = {
    id: 'meld-zoom-1',
    team: 'A',
    type: 'RUN',
    suit: 'SPADES',
    cards: [
      { id: 's10', suit: 'SPADES', rank: 10 },
      { id: 'sj', suit: 'SPADES', rank: 11 },
      { id: 'sq', suit: 'SPADES', rank: 12 },
      { id: 'sk', suit: 'SPADES', rank: 13 },
      { id: 'sa', suit: 'SPADES', rank: 14 },
    ],
    slots: [
      { card: { id: 's10', suit: 'SPADES', rank: 10 }, representedRank: 10, representedSuit: 'SPADES', isWildcard: false },
      { card: { id: 'sj', suit: 'SPADES', rank: 11 }, representedRank: 11, representedSuit: 'SPADES', isWildcard: false },
      { card: { id: 'sq', suit: 'SPADES', rank: 12 }, representedRank: 12, representedSuit: 'SPADES', isWildcard: false },
      { card: { id: 'sk', suit: 'SPADES', rank: 13 }, representedRank: 13, representedSuit: 'SPADES', isWildcard: false },
      { card: { id: 'sa', suit: 'SPADES', rank: 14 }, representedRank: 14, representedSuit: 'SPADES', isWildcard: false },
    ],
  };

  const sampleWildRun: Meld = {
    id: 'meld-zoom-2',
    team: 'B',
    type: 'RUN',
    suit: 'HEARTS',
    cards: [
      { id: 'h4', suit: 'HEARTS', rank: 4 },
      { id: 'jk', suit: null, rank: 0, isNaturalJoker: true },
      { id: 'h6', suit: 'HEARTS', rank: 6 },
    ],
    slots: [
      { card: { id: 'h4', suit: 'HEARTS', rank: 4 }, representedRank: 4, representedSuit: 'HEARTS', isWildcard: false },
      { card: { id: 'jk', suit: null, rank: 0, isNaturalJoker: true }, representedRank: 5, representedSuit: 'HEARTS', isWildcard: true },
      { card: { id: 'h6', suit: 'HEARTS', rank: 6 }, representedRank: 6, representedSuit: 'HEARTS', isWildcard: false },
    ],
  };

  it('returns null when isOpen is false or meld is null', () => {
    const html1 = renderToString(
      <SequenceZoomModal isOpen={false} meld={sampleRun} onClose={() => {}} />
    );
    expect(html1).toBe('');

    const html2 = renderToString(
      <SequenceZoomModal isOpen={true} meld={null} onClose={() => {}} />
    );
    expect(html2).toBe('');
  });

  it('renders zoomed sequence cards, team badge, and score evaluation when isOpen is true', () => {
    const html = renderToString(
      <SequenceZoomModal isOpen={true} meld={sampleRun} onClose={() => {}} />
    );

    expect(html).toContain('Sequence Zoom Inspection');
    expect(html).toContain('Team A');
    expect(html).toContain('SPADES');
    expect(html).toContain('5 cards');
    expect(html).toContain('10 of SPADES');
    expect(html).toContain('A of SPADES');
  });

  it('renders wildcard substitution details when sequence contains a wildcard', () => {
    const html = renderToString(
      <SequenceZoomModal isOpen={true} meld={sampleWildRun} onClose={() => {}} />
    );

    expect(html).toContain('Team B');
    expect(html).toContain('HEARTS');
    expect(html).toContain('Wild (5♥)');
  });

  it('renders a compact max-w-4xl container with large cards and legible text', () => {
    const html = renderToString(
      <SequenceZoomModal isOpen={true} meld={sampleRun} onClose={() => {}} />
    );

    // Modal is constrained to max-w-4xl to prevent sprawling on wide screens
    expect(html).toContain('max-w-4xl');
    // Cards use large size (w-28 h-[168px])
    expect(html).toContain('w-28');
    // Slot numbers use text-xs (>= 12px)
    expect(html).toContain('text-xs font-bold text-slate-400');
  });
});
