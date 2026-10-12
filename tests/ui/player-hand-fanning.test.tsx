import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Card } from '../../src/engine/types';
import {
  PlayerHand,
  calculateHandOverlap,
} from '../../src/ui/components/PlayerHand';

describe('PlayerHand Adaptive Card Fanning & Overlap', () => {
  const createMockCards = (count: number): Card[] => {
    const suits: Array<'SPADES' | 'HEARTS' | 'CLUBS' | 'DIAMONDS'> = [
      'SPADES',
      'HEARTS',
      'CLUBS',
      'DIAMONDS',
    ];
    return Array.from({ length: count }, (_, i) => ({
      id: `card-${i + 1}`,
      suit: suits[i % 4],
      rank: ((i % 13) + 2) as any,
    }));
  };

  describe('calculateHandOverlap algorithm', () => {
    it('returns zero overlap for small hands that naturally fit within container', () => {
      // 5 cards, cardWidth 96, gap 8 -> total needed = 5*96 + 4*8 = 512px <= 1200px
      const result = calculateHandOverlap({
        cardCount: 5,
        containerWidth: 1200,
        cardWidth: 96,
        naturalGap: 8,
      });

      expect(result.isOverlapping).toBe(false);
      expect(result.overlapMargin).toBe(0);
      expect(result.visibleCardWidth).toBe(96);
    });

    it('returns negative margin for 14-card hand when container is constrained', () => {
      // 14 cards in 1000px container
      const result = calculateHandOverlap({
        cardCount: 14,
        containerWidth: 1000,
        cardWidth: 96,
        naturalGap: 8,
      });

      expect(result.isOverlapping).toBe(true);
      expect(result.overlapMargin).toBeLessThan(0);
      // Verify total width fits within container
      const totalWidth = 96 + 13 * (96 + result.overlapMargin);
      expect(totalWidth).toBeLessThanOrEqual(1005);
      // Ensure visible width is comfortably above min
      expect(result.visibleCardWidth).toBeGreaterThanOrEqual(28);
    });

    it('successfully fans 20 cards within a standard 1200px laptop hand tray', () => {
      const result = calculateHandOverlap({
        cardCount: 20,
        containerWidth: 1200,
        cardWidth: 96,
        naturalGap: 8,
      });

      expect(result.isOverlapping).toBe(true);
      expect(result.overlapMargin).toBeLessThan(0);
      // Total width should be within 1200px
      const totalWidth = 96 + 19 * (96 + result.overlapMargin);
      expect(totalWidth).toBeLessThanOrEqual(1205);
      // Every card should have at least 45px exposed
      expect(result.visibleCardWidth).toBeGreaterThanOrEqual(45);
    });

    it('handles extreme 26-card hand (Royal Pukar + deep bottom pickup) within 1200px', () => {
      const result = calculateHandOverlap({
        cardCount: 26,
        containerWidth: 1200,
        cardWidth: 96,
        naturalGap: 8,
      });

      expect(result.isOverlapping).toBe(true);
      expect(result.overlapMargin).toBeLessThan(0);
      const totalWidth = 96 + 25 * (96 + result.overlapMargin);
      expect(totalWidth).toBeLessThanOrEqual(1205);
      // Suit symbol and rank pip must remain visible (>= 28px)
      expect(result.visibleCardWidth).toBeGreaterThanOrEqual(28);
    });

    it('clamps visible width to minVisibleWidth when container is extremely narrow', () => {
      const result = calculateHandOverlap({
        cardCount: 26,
        containerWidth: 400,
        cardWidth: 96,
        minVisibleWidth: 28,
      });

      expect(result.visibleCardWidth).toBe(28);
      expect(result.overlapMargin).toBe(28 - 96); // -68px
    });
  });

  describe('PlayerHand Component Rendering with Overlap', () => {
    it('applies negative margin-left and staggered z-indexes when hand cards overlap', () => {
      const cards = createMockCards(18);
      const html = renderToString(
        <PlayerHand
          playerName="Alice"
          playerTeam="A"
          cards={cards}
          containerWidth={1100}
        />
      );

      // Verify that cards rendered with negative margin
      expect(html).toContain('margin-left:-');
      // Verify z-index stacking
      expect(html).toContain('z-index:');
      expect(html).toContain('Alice');
      expect(html).toContain('18 cards');
    });

    it('renders normal spacing without negative margin when hand has few cards', () => {
      const cards = createMockCards(4);
      const html = renderToString(
        <PlayerHand
          playerName="Bob"
          playerTeam="B"
          cards={cards}
          containerWidth={1200}
        />
      );

      // Should not apply negative margin on card slots when there is plenty of room
      expect(html).not.toContain('margin-left:-');
      expect(html).toContain('Bob');
      expect(html).toContain('4 cards');
    });
  });
});
