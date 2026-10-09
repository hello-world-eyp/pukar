import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  PlayingCard,
  getRankLabel,
  getSuitSymbol,
  isRedSuit,
} from '../../src/ui/components/PlayingCard';
import { Card, Suit, Rank } from '../../src/engine/types';

function makeCard(suit: Suit | null, rank: number, id?: string): Card {
  const isJoker = rank === 0 && suit === null;
  return {
    id: id ?? `card-${suit}-${rank}`,
    suit,
    rank: rank as Rank,
    isNaturalJoker: isJoker,
    isJoker: isJoker || rank === 2,
  };
}

describe('Comprehensive PlayingCard Component (src/ui/components/PlayingCard.tsx)', () => {
  describe('Helper Functions', () => {
    describe('getRankLabel', () => {
      it('returns "JK" for rank 0 or natural jokers', () => {
        expect(getRankLabel(0)).toBe('JK');
        expect(getRankLabel(0, true)).toBe('JK');
        expect(getRankLabel(5, true)).toBe('JK');
      });

      it('returns "A" for rank 1 or rank 14', () => {
        expect(getRankLabel(1)).toBe('A');
        expect(getRankLabel(14)).toBe('A');
      });

      it('returns face card letters "J", "Q", "K"', () => {
        expect(getRankLabel(11)).toBe('J');
        expect(getRankLabel(12)).toBe('Q');
        expect(getRankLabel(13)).toBe('K');
      });

      it('returns numeric strings for standard number ranks 2 through 10', () => {
        for (let r = 2; r <= 10; r++) {
          expect(getRankLabel(r)).toBe(String(r));
        }
      });
    });

    describe('getSuitSymbol', () => {
      it('returns the exact unicode suit symbols', () => {
        expect(getSuitSymbol('SPADES')).toBe('♠');
        expect(getSuitSymbol('HEARTS')).toBe('♥');
        expect(getSuitSymbol('DIAMONDS')).toBe('♦');
        expect(getSuitSymbol('CLUBS')).toBe('♣');
        expect(getSuitSymbol(null)).toBe('★');
        expect(getSuitSymbol(undefined)).toBe('★');
      });
    });

    describe('isRedSuit', () => {
      it('returns true for Hearts and Diamonds, false for Spades and Clubs', () => {
        expect(isRedSuit('HEARTS')).toBe(true);
        expect(isRedSuit('DIAMONDS')).toBe(true);
        expect(isRedSuit('SPADES')).toBe(false);
        expect(isRedSuit('CLUBS')).toBe(false);
        expect(isRedSuit(null)).toBe(false);
        expect(isRedSuit(undefined)).toBe(false);
      });
    });
  });

  describe('Card Visual Element Rendering', () => {
    it('renders all 4 suits with accurate colors and symbols', () => {
      const suits: Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
      suits.forEach((suit) => {
        const card = makeCard(suit, 10);
        const html = renderToString(<PlayingCard card={card} />);

        expect(html).toContain('10');
        expect(html).toContain(getSuitSymbol(suit));
        if (suit === 'HEARTS' || suit === 'DIAMONDS') {
          expect(html).toContain('text-red-600');
        } else {
          expect(html).toContain('text-slate-900');
        }
      });
    });

    it('renders Natural Joker with star symbol, joker label, and amber styling', () => {
      const card = makeCard(null, 0);
      const html = renderToString(<PlayingCard card={card} />);

      expect(html).toContain('JK');
      expect(html).toContain('★');
      expect(html).toContain('text-amber-600');
      expect(html).toContain('aria-label="Natural Joker (Wild)"');
    });

    it('renders wildcard rank 2 with Wild badge', () => {
      const card = makeCard('SPADES', 2);
      const html = renderToString(<PlayingCard card={card} />);

      expect(html).toContain('Wild');
      expect(html).toContain('2');
      expect(html).toContain('♠');
    });

    it('renders represented rank badge when substituting in a meld: Wild (K♦)', () => {
      const wild2 = makeCard('SPADES', 2);
      const html = renderToString(
        <PlayingCard
          card={wild2}
          isWild={true}
          representedRank={13}
          representedSuit="DIAMONDS"
        />
      );

      expect(html).toContain('Wild (K♦)');
    });

    it('renders custom wildcard label when provided', () => {
      const card = makeCard('HEARTS', 2);
      const html = renderToString(
        <PlayingCard card={card} wildcardLabel="Special Wildcard" />
      );

      expect(html).toContain('Special Wildcard');
    });

    it('renders face-down card with PUKAR back emblem and aria-label', () => {
      const card = makeCard('SPADES', 14);
      const html = renderToString(<PlayingCard card={card} faceDown={true} />);

      expect(html).toContain('PUKAR');
      expect(html).toContain('aria-label="Face-down card"');
      expect(html).toContain('/cards/card_back.png');
      // Should not display front face rank or suit
      expect(html).not.toContain('>A<');
    });

    it('renders selection ring styling when isSelected is true', () => {
      const card = makeCard('CLUBS', 8);
      const unselectedHtml = renderToString(<PlayingCard card={card} isSelected={false} />);
      const selectedHtml = renderToString(<PlayingCard card={card} isSelected={true} />);

      expect(unselectedHtml).not.toContain('ring-4 ring-amber-400');
      expect(unselectedHtml).not.toContain('border-yellow-400');
      expect(unselectedHtml).not.toContain('card-selected-glow');

      expect(selectedHtml).toContain('ring-4 ring-amber-400');
      expect(selectedHtml).toContain('border-2 border-yellow-400');
      expect(selectedHtml).toContain('card-selected-glow');
      expect(selectedHtml).toContain('-translate-y-2.5');
    });

    it('supports size variations: sm, md, and lg', () => {
      const card = makeCard('HEARTS', 7);

      const htmlSm = renderToString(<PlayingCard card={card} size="sm" />);
      expect(htmlSm).toContain('w-12');
      expect(htmlSm).toContain('h-[72px]');

      const htmlMd = renderToString(<PlayingCard card={card} size="md" />);
      expect(htmlMd).toContain('w-20');
      expect(htmlMd).toContain('h-[120px]');

      const htmlLg = renderToString(<PlayingCard card={card} size="lg" />);
      expect(htmlLg).toContain('w-28');
      expect(htmlLg).toContain('h-[168px]');
    });

    it('renders accessible button role and tabIndex when onClick is provided', () => {
      const card = makeCard('SPADES', 5);
      const clickableHtml = renderToString(<PlayingCard card={card} onClick={() => {}} />);
      const nonClickableHtml = renderToString(<PlayingCard card={card} />);

      expect(clickableHtml).toContain('role="button"');
      expect(clickableHtml).toContain('tabindex="0"');
      expect(nonClickableHtml).not.toContain('role="button"');
    });

    it('disables interactions when disabled prop is true', () => {
      const card = makeCard('SPADES', 5);
      const html = renderToString(<PlayingCard card={card} disabled={true} onClick={() => {}} />);

      expect(html).not.toContain('role="button"');
      expect(html).not.toContain('cursor-pointer');
    });

    it('renders King court card with royal crown emblem in fallback layout and image candidates', () => {
      const kingCard = makeCard('CLUBS', 13);
      const html = renderToString(<PlayingCard card={kingCard} />);

      expect(html).toContain('K');
      expect(html).toContain('♣');
      expect(html).toContain('♔');
      expect(html).toContain('src="/cards/Clubs/K.png"');
    });

    it('renders Queen and Jack court cards with respective royalty emblems', () => {
      const queenCard = makeCard('SPADES', 12);
      const queenHtml = renderToString(<PlayingCard card={queenCard} />);
      expect(queenHtml).toContain('♕');

      const jackCard = makeCard('HEARTS', 11);
      const jackHtml = renderToString(<PlayingCard card={jackCard} />);
      expect(jackHtml).toContain('⚔');
    });

    it('renders Joker with candidate image source pointing to /cards/joker.png', () => {
      const jokerCard = makeCard(null, 0);
      const html = renderToString(<PlayingCard card={jokerCard} />);

      expect(html).toContain('src="/cards/joker.png"');
      expect(html).toContain('Joker');
      expect(html).toContain('★');
    });
  });
});

