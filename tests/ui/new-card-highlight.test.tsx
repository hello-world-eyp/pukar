import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PlayingCard } from '../../src/ui/components/PlayingCard';
import { PlayerHand } from '../../src/ui/components/PlayerHand';
import { Card, Suit, Rank } from '../../src/engine/types';

function createCard(id: string, suit: Suit, rank: number): Card {
  return {
    id,
    suit,
    rank: rank as Rank,
    isJoker: rank === 2,
    isNaturalJoker: false,
  };
}

describe('New Card Pickup Visual Highlight (Green Border)', () => {
  describe('PlayingCard Component Green Border', () => {
    it('renders green border and ring when isNew is true', () => {
      const card = createCard('c-1', 'HEARTS', 8);
      const html = renderToString(<PlayingCard card={card} isNew={true} />);

      expect(html).toContain('border-2 border-emerald-400');
      expect(html).toContain('ring-emerald-400');
      expect(html).toContain('data-new-card="true"');
      expect(html).toContain('data-is-new="true"');
      expect(html).toContain('New');
      expect(html).toContain('aria-label="8 of HEARTS (New)"');
    });

    it('renders normal border without green classes when isNew is false or undefined', () => {
      const card = createCard('c-2', 'HEARTS', 8);
      const html = renderToString(<PlayingCard card={card} isNew={false} />);

      expect(html).not.toContain('border-emerald-400');
      expect(html).not.toContain('ring-emerald-400');
      expect(html).not.toContain('data-new-card="true"');
      expect(html).toContain('border border-stone-300');
    });

    it('retains green border along with amber ring when isSelected is true', () => {
      const card = createCard('c-3', 'SPADES', 10);
      const html = renderToString(
        <PlayingCard card={card} isNew={true} isSelected={true} />
      );

      // Must have amber selection ring
      expect(html).toContain('ring-4 ring-amber-400');
      // Must also retain emerald border
      expect(html).toContain('border-2 border-emerald-400');
      expect(html).toContain('data-new-card="true"');
    });

    it('highlights wildcard when new while preserving wildcard badge', () => {
      const wild2 = createCard('c-4', 'CLUBS', 2);
      const html = renderToString(<PlayingCard card={card(wild2)} isNew={true} />);

      expect(html).toContain('border-2 border-emerald-400');
      expect(html).toContain('Wild');
    });

    function card(c: Card) {
      return c;
    }
  });

  describe('PlayerHand Component New Card Propagation', () => {
    const sampleHand: Card[] = [
      createCard('h1', 'HEARTS', 5),
      createCard('h2', 'HEARTS', 6),
      createCard('h3', 'HEARTS', 7),
      createCard('s1', 'SPADES', 10),
    ];

    it('highlights only the specified newly picked up card IDs in hand', () => {
      const html = renderToString(
        <PlayerHand cards={sampleHand} newCardIds={['h2']} />
      );

      // h2 should have green border and new badge
      expect(html).toContain('border-2 border-emerald-400');
      expect(html).toContain('data-new-card="true"');
      expect(html).toContain('aria-label="6 of HEARTS (New)"');
      // Other cards should not have (New)
      expect(html).toContain('aria-label="5 of HEARTS"');
      expect(html).toContain('aria-label="7 of HEARTS"');
    });

    it('retains green border when hand is sorted by Suit or Rank', () => {
      const htmlSuit = renderToString(
        <PlayerHand cards={sampleHand} newCardIds={['h3']} sortMode="suit" />
      );
      expect(htmlSuit).toContain('aria-label="7 of HEARTS (New)"');
      expect(htmlSuit).toContain('border-2 border-emerald-400');

      const htmlRank = renderToString(
        <PlayerHand cards={sampleHand} newCardIds={['h3']} sortMode="rank" />
      );
      expect(htmlRank).toContain('aria-label="7 of HEARTS (New)"');
      expect(htmlRank).toContain('border-2 border-emerald-400');
    });

    it('renders empty newCardIds safely without any green highlights', () => {
      const html = renderToString(
        <PlayerHand cards={sampleHand} newCardIds={[]} />
      );
      expect(html).not.toContain('border-2 border-emerald-400');
      expect(html).not.toContain('data-new-card="true"');
    });
  });
});
