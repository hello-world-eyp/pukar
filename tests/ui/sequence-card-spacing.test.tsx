import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TableMeldBoard, calculateMeldCardOverlapMargin } from '../../src/ui/components/TableMeldBoard';
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

describe('Compact Sequence Card Spacing (Up to 10+ Cards without Horizontal Scroll)', () => {
  describe('calculateMeldCardOverlapMargin Helper', () => {
    it('returns 0 for 0 or 1 card', () => {
      expect(calculateMeldCardOverlapMargin({ cardCount: 0 })).toBe(0);
      expect(calculateMeldCardOverlapMargin({ cardCount: 1 })).toBe(0);
    });

    it('calculates compact negative margin for 7 cards (user screenshot scenario) well below container width', () => {
      const margin = calculateMeldCardOverlapMargin({
        cardCount: 7,
        cardSize: 'md',
        isSmallScreen: false,
      });

      // Desktop md card width is 96px
      // With margin around -70px, exposed width is 26px
      expect(margin).toBeLessThanOrEqual(-68);
      const exposedWidth = 96 + margin;
      expect(exposedWidth).toBeGreaterThanOrEqual(19); // Corner index (rank + suit) is fully visible
      const totalWidth = 96 + 6 * exposedWidth;
      // Must be well below standard column width (~360px-400px)
      expect(totalWidth).toBeLessThanOrEqual(270);
    });

    it('ensures up to 10 cards fit in standard desktop column (< 320px) without horizontal scroll', () => {
      const margin = calculateMeldCardOverlapMargin({
        cardCount: 10,
        cardSize: 'md',
        isSmallScreen: false,
      });

      // Desktop md card width is 96px
      expect(margin).toBeLessThanOrEqual(-72);
      const exposedWidth = 96 + margin;
      expect(exposedWidth).toBeGreaterThanOrEqual(19); // Corner index visible

      // Total width of all 10 cards: 1 full card (96px) + 9 exposed strips
      const totalWidth = 96 + 9 * exposedWidth;
      expect(totalWidth).toBeLessThanOrEqual(300); // Fits easily in 320px-380px column without scroll
    });

    it('dynamically adapts to measured containerWidth if column is narrower', () => {
      // Narrow column: 275px available width
      const margin = calculateMeldCardOverlapMargin({
        cardCount: 10,
        cardSize: 'md',
        containerWidth: 275,
        isSmallScreen: false,
      });

      const exposedWidth = 96 + margin;
      const totalWidth = 96 + 9 * exposedWidth;
      expect(totalWidth).toBeLessThanOrEqual(275);
    });

    it('scales properly for complete 13-card sequence (500 pts pure run)', () => {
      const margin = calculateMeldCardOverlapMargin({
        cardCount: 13,
        cardSize: 'md',
        containerWidth: 360,
        isSmallScreen: false,
      });

      const exposedWidth = 96 + margin;
      const totalWidth = 96 + 12 * exposedWidth;
      expect(totalWidth).toBeLessThanOrEqual(360);
    });

    it('scales properly on mobile screens (isSmallScreen = true)', () => {
      const margin = calculateMeldCardOverlapMargin({
        cardCount: 10,
        cardSize: 'md',
        isSmallScreen: true,
      });

      // Mobile md card width is 80px
      const exposedWidth = 80 + margin;
      expect(exposedWidth).toBeGreaterThanOrEqual(16); // Corner index visible on mobile
      const totalWidth = 80 + 9 * exposedWidth;
      expect(totalWidth).toBeLessThanOrEqual(250); // Fits easily in mobile viewport
    });
  });

  describe('TableMeldBoard Component 10-Card Sequence Rendering', () => {
    it('renders a 10-card sequence with overflow-x-hidden and compact negative margins', () => {
      // Create a 10-card pure run (Ace through 10 of Clubs)
      const tenCards: Card[] = [
        createCard('c-cA', 'CLUBS', 14),
        createCard('c-cK', 'CLUBS', 13),
        createCard('c-cQ', 'CLUBS', 12),
        createCard('c-cJ', 'CLUBS', 11),
        createCard('c-c10', 'CLUBS', 10),
        createCard('c-c9', 'CLUBS', 9),
        createCard('c-c8', 'CLUBS', 8),
        createCard('c-c7', 'CLUBS', 7),
        createCard('c-c6', 'CLUBS', 6),
        createCard('c-c5', 'CLUBS', 5),
      ];

      const tenCardMeld: Meld = {
        id: 'meld-pure-10',
        team: 'A',
        type: 'RUN',
        suit: 'CLUBS',
        cards: tenCards,
        slots: tenCards.map((c) => ({
          card: c,
          representedRank: c.rank,
          representedSuit: 'CLUBS',
        })),
        points: 200,
        isClean: true,
      };

      const html = renderToString(
        <TableMeldBoard
          melds={{ A: [tenCardMeld], B: [] }}
          activeTeam="A"
        />
      );

      // Verify meld-cards-row has overflow-x-hidden to prevent horizontal scrolling
      expect(html).toContain('overflow-x-hidden');
      expect(html).toContain('data-testid="meld-cards-row"');

      // Verify all 10 cards are rendered
      for (const card of tenCards) {
        expect(html).toContain(`aria-label="${card.rank === 14 ? 'A' : card.rank === 13 ? 'K' : card.rank === 12 ? 'Q' : card.rank === 11 ? 'J' : card.rank} of CLUBS"`);
      }

      // Verify compact negative margin is applied
      expect(html).toMatch(/margin-left:-(7[0-9]|6[8-9])px/);
    });
  });
});
