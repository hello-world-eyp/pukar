import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ActionControls } from '../../src/ui/components/ActionControls';
import { PlayerHand } from '../../src/ui/components/PlayerHand';
import { Card } from '../../src/engine/types';

function makeCard(id: string, suit: 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS', rank: any): Card {
  return { id, suit, rank };
}

describe('UI: Pick-up and Discard Restriction Controls', () => {
  const drawnCard = makeCard('drawn-1', 'HEARTS', 9);
  const otherCard = makeCard('other-1', 'SPADES', 10);

  it('disables discard button and shows warning label when single drawn card is selected (>1 cards in initial hand)', () => {
    const html = renderToString(
      <ActionControls
        phase="MELD"
        selectedCards={[drawnCard]}
        selectedCardIds={['drawn-1']}
        allHandCards={[drawnCard, otherCard]}
        cardsPickedUpThisTurn={['drawn-1']}
        initialHandSizeThisTurn={5}
        unifiedMode={true}
      />
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain("Can&#x27;t discard drawn card");
    expect(html).toContain(
      'title="Cannot discard the single card picked up this turn unless you started with only 1 card in hand"'
    );
  });

  it('allows discarding other hand cards when single card was drawn', () => {
    const html = renderToString(
      <ActionControls
        phase="MELD"
        selectedCards={[otherCard]}
        selectedCardIds={['other-1']}
        allHandCards={[drawnCard, otherCard]}
        cardsPickedUpThisTurn={['drawn-1']}
        initialHandSizeThisTurn={5}
        unifiedMode={true}
      />
    );

    expect(html).not.toContain("Can&#x27;t discard drawn card");
    expect(html).toContain('Discard 10♠');
  });

  it('EXCEPTION: enables discard button for drawn card if initial hand size was 1 card', () => {
    const html = renderToString(
      <ActionControls
        phase="MELD"
        selectedCards={[drawnCard]}
        selectedCardIds={['drawn-1']}
        allHandCards={[drawnCard]}
        cardsPickedUpThisTurn={['drawn-1']}
        initialHandSizeThisTurn={1}
        unifiedMode={true}
      />
    );

    expect(html).not.toContain("Can&#x27;t discard drawn card");
    expect(html).toContain('Discard 9♥');
  });

  it('allows discarding either card when 2 cards were picked up from discard pile', () => {
    const cardA = makeCard('card-a', 'HEARTS', 4);
    const cardB = makeCard('card-b', 'CLUBS', 5);

    const html = renderToString(
      <ActionControls
        phase="MELD"
        selectedCards={[cardA]}
        selectedCardIds={['card-a']}
        allHandCards={[cardA, cardB]}
        cardsPickedUpThisTurn={['card-a', 'card-b']}
        initialHandSizeThisTurn={4}
        unifiedMode={true}
      />
    );

    expect(html).not.toContain("Can&#x27;t discard drawn card");
    expect(html).toContain('Discard 4♥');
  });

  it('shows informative tooltip in PlayerHand on single card picked up this turn when initialHandSize > 1', () => {
    const html = renderToString(
      <PlayerHand
        cards={[drawnCard, otherCard]}
        cardsPickedUpThisTurn={['drawn-1']}
        initialHandSizeThisTurn={4}
      />
    );

    expect(html).toContain(
      'title="Single card picked up this turn (cannot discard this turn) • Drag to reorder"'
    );
    expect(html).toContain('title="Click to select • Drag to reorder"');
  });

  it('shows normal tooltip in PlayerHand on drawn card if initialHandSize was 1 (exception)', () => {
    const html = renderToString(
      <PlayerHand
        cards={[drawnCard, otherCard]}
        cardsPickedUpThisTurn={['drawn-1']}
        initialHandSizeThisTurn={1}
      />
    );

    expect(html).not.toContain(
      'title="Single card picked up this turn (cannot discard this turn) • Drag to reorder"'
    );
    expect(html).toContain('title="Click to select • Drag to reorder"');
  });
});
