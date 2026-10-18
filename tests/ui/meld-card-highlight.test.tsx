import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TableMeldBoard } from '../../src/ui/components/TableMeldBoard';
import { SequencesPage } from '../../src/ui/components/SequencesPage';
import { SequenceZoomModal } from '../../src/ui/components/SequenceZoomModal';
import { Card, Meld } from '../../src/engine/types';

function createCard(id: string, suit: 'SPADES' | 'HEARTS' | 'CLUBS' | 'DIAMONDS', rank: number): Card {
  return {
    id,
    suit,
    rank: rank as any,
    isJoker: rank === 2,
    isNaturalJoker: false,
  };
}

describe('Table Meld Cards Visual Highlight (Green Border & New Badge)', () => {
  const sampleMeldA: Meld = {
    id: 'meld-a1',
    team: 'A',
    type: 'RUN',
    suit: 'SPADES',
    cards: [
      createCard('c-s5', 'SPADES', 5),
      createCard('c-s6', 'SPADES', 6),
      createCard('c-s7', 'SPADES', 7),
    ],
    slots: [
      { card: createCard('c-s5', 'SPADES', 5), representedRank: 5 },
      { card: createCard('c-s6', 'SPADES', 6), representedRank: 6 },
      { card: createCard('c-s7', 'SPADES', 7), representedRank: 7 },
    ],
    points: 20,
  };

  const sampleMeldB: Meld = {
    id: 'meld-b1',
    team: 'B',
    type: 'RUN',
    suit: 'HEARTS',
    cards: [
      createCard('c-h8', 'HEARTS', 8),
      createCard('c-h9', 'HEARTS', 9),
      createCard('c-h10', 'HEARTS', 10),
    ],
    slots: [
      { card: createCard('c-h8', 'HEARTS', 8), representedRank: 8 },
      { card: createCard('c-h9', 'HEARTS', 9), representedRank: 9 },
      { card: createCard('c-h10', 'HEARTS', 10), representedRank: 10 },
    ],
    points: 20,
  };

  describe('TableMeldBoard Component', () => {
    it('highlights newly added meld cards with green border, ring, and New badge', () => {
      const html = renderToString(
        <TableMeldBoard
          melds={{ A: [sampleMeldA], B: [sampleMeldB] }}
          newMeldCardIds={['c-s6', 'c-h10']}
        />
      );

      // Cards in newMeldCardIds must receive green border and emerald ring
      expect(html).toContain('border-2 border-emerald-400');
      expect(html).toContain('ring-emerald-400');
      expect(html).toContain('data-new-card="true"');
      expect(html).toContain('New');

      // The label for c-s6 must indicate it is New
      expect(html).toContain('aria-label="6 of SPADES (New)"');
      expect(html).toContain('aria-label="10 of HEARTS (New)"');

      // Non-highlighted cards must not have (New)
      expect(html).toContain('aria-label="5 of SPADES"');
      expect(html).toContain('aria-label="7 of SPADES"');
      expect(html).toContain('aria-label="8 of HEARTS"');
      expect(html).toContain('aria-label="9 of HEARTS"');
    });

    it('renders normal borders without highlights when newMeldCardIds is empty or undefined', () => {
      const html = renderToString(
        <TableMeldBoard
          melds={{ A: [sampleMeldA], B: [sampleMeldB] }}
          newMeldCardIds={[]}
        />
      );

      expect(html).not.toContain('border-2 border-emerald-400');
      expect(html).not.toContain('data-new-card="true"');
      expect(html).not.toContain('aria-label="6 of SPADES (New)"');
    });
  });

  describe('SequencesPage Component', () => {
    it('propagates newMeldCardIds and renders green border on full-page sequence view', () => {
      const html = renderToString(
        <SequencesPage
          melds={{ A: [sampleMeldA], B: [sampleMeldB] }}
          onBackToTable={() => {}}
          newMeldCardIds={['c-s7']}
        />
      );

      expect(html).toContain('border-2 border-emerald-400');
      expect(html).toContain('data-new-card="true"');
      expect(html).toContain('aria-label="7 of SPADES (New)"');
      expect(html).toContain('aria-label="5 of SPADES"');
    });
  });

  describe('SequenceZoomModal Component', () => {
    it('propagates newMeldCardIds and renders green border inside sequence zoom modal', () => {
      const html = renderToString(
        <SequenceZoomModal
          isOpen={true}
          meld={sampleMeldA}
          onClose={() => {}}
          newMeldCardIds={['c-s5']}
        />
      );

      expect(html).toContain('border-2 border-emerald-400');
      expect(html).toContain('data-new-card="true"');
      expect(html).toContain('aria-label="5 of SPADES (New)"');
      expect(html).toContain('aria-label="6 of SPADES"');
    });
  });
});
