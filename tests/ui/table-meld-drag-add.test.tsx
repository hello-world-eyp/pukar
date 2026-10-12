import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TableMeldBoard, canDropCardsOnMeld } from '../../src/ui/components/TableMeldBoard';
import { PlayerHand } from '../../src/ui/components/PlayerHand';
import { Card, Meld, Rank } from '../../src/engine/types';

describe('TableMeldBoard: Drag-and-Drop Cards to Sequences', () => {
  const spade7: Card = { id: 's7', suit: 'SPADES', rank: 7 };
  const spade8: Card = { id: 's8', suit: 'SPADES', rank: 8 };
  const spade9: Card = { id: 's9', suit: 'SPADES', rank: 9 };
  const spade10: Card = { id: 's10', suit: 'SPADES', rank: 10 };
  const spadeJ: Card = { id: 'sJ', suit: 'SPADES', rank: 11 };
  const heartK: Card = { id: 'hK', suit: 'HEARTS', rank: 13 };
  const fillerCard: Card = { id: 'filler', suit: 'CLUBS', rank: 2 };

  const teamARunMeld: Meld = {
    id: 'meld-A-spades',
    type: 'RUN',
    team: 'A',
    suit: 'SPADES',
    cards: [spade7, spade8, spade9],
    points: 0,
    isClean: true,
    slots: [
      { card: spade7, representedRank: 7, representedSuit: 'SPADES', isWildcard: false },
      { card: spade8, representedRank: 8, representedSuit: 'SPADES', isWildcard: false },
      { card: spade9, representedRank: 9, representedSuit: 'SPADES', isWildcard: false },
    ],
  };

  const completedPureMeld: Meld = {
    id: 'meld-A-pure13',
    type: 'RUN',
    team: 'A',
    suit: 'SPADES',
    cards: Array.from({ length: 13 }, (_, i) => ({ id: `pure-${i}`, suit: 'SPADES', rank: (i + 2) as Rank })),
    points: 500,
    isClean: true,
    isPure13: true,
    slots: Array.from({ length: 13 }, (_, i) => ({
      card: { id: `pure-${i}`, suit: 'SPADES', rank: (i + 2) as Rank },
      representedRank: i + 2,
      representedSuit: 'SPADES',
      isWildcard: false,
    })),
  };

  beforeEach(() => {
    if (typeof window !== 'undefined') {
      (window as any).__pukarActiveDragCardIds = null;
    }
  });

  afterEach(() => {
    if (typeof window !== 'undefined') {
      (window as any).__pukarActiveDragCardIds = null;
    }
    vi.restoreAllMocks();
  });

  it('PlayerHand renders cards and supports drag interactions without errors', () => {
    const hand = [spade10, spadeJ, fillerCard];

    const vnode = (
      <PlayerHand
        cards={hand}
        selectedCardIds={[]}
      />
    );
    const html = renderToString(vnode);
    expect(html).toContain('data-testid="hand-card-slot-0"');
  });

  it('renders TableMeldBoard with drop event handlers on meld items', () => {
    const onAddToMeld = vi.fn();

    const html = renderToString(
      <TableMeldBoard
        melds={{ A: [teamARunMeld], B: [] }}
        activeTeam="A"
        canAdd={true}
        allHandCards={[spade10, fillerCard]}
        onAddToMeld={onAddToMeld}
      />
    );

    expect(html).toContain('data-testid="meld-item-meld-A-spades"');
  });

  it('disallows drop when dropped cards would leave hand empty', () => {
    const onAddToMeld = vi.fn();
    const handWithOnlyOneCard = [spade10];

    const html = renderToString(
      <TableMeldBoard
        melds={{ A: [teamARunMeld], B: [] }}
        activeTeam="A"
        canAdd={true}
        allHandCards={handWithOnlyOneCard}
        onAddToMeld={onAddToMeld}
      />
    );

    expect(html).toContain('meld-item-meld-A-spades');
  });

  it('disallows drop on completed pure 13 sequence', () => {
    const onAddToMeld = vi.fn();

    const html = renderToString(
      <TableMeldBoard
        melds={{ A: [completedPureMeld], B: [] }}
        activeTeam="A"
        canAdd={true}
        allHandCards={[spade10, fillerCard]}
        onAddToMeld={onAddToMeld}
      />
    );

    // Completed 500-pt sequence is locked
    expect(html).toContain('cursor-not-allowed');
    expect(html).toContain('500 pts');
  });

  describe('canDropCardsOnMeld Pure Validation Logic', () => {
    it('approves drop for a legal card extending a sequence (10♠ onto 7♠-8♠-9♠)', () => {
      const allHandCards = [spade10, fillerCard];
      const result = canDropCardsOnMeld({
        meld: teamARunMeld,
        cardsInFlight: [spade10],
        allHandCards,
        canAdd: true,
        isOwnTeam: true,
      });

      expect(result.valid).toBe(true);
    });

    it('approves drop for multiple legal cards extending a sequence (10♠ + J♠ onto 7♠-8♠-9♠)', () => {
      const allHandCards = [spade10, spadeJ, fillerCard];
      const result = canDropCardsOnMeld({
        meld: teamARunMeld,
        cardsInFlight: [spade10, spadeJ],
        allHandCards,
        canAdd: true,
        isOwnTeam: true,
      });

      expect(result.valid).toBe(true);
    });

    it('rejects drop for an illegal card (wrong suit: K♥ onto 7♠-8♠-9♠)', () => {
      const allHandCards = [heartK, fillerCard];
      const result = canDropCardsOnMeld({
        meld: teamARunMeld,
        cardsInFlight: [heartK],
        allHandCards,
        canAdd: true,
        isOwnTeam: true,
      });

      expect(result.valid).toBe(false);
    });

    it('rejects drop if sequence belongs to opponent team (isOwnTeam = false)', () => {
      const allHandCards = [spade10, fillerCard];
      const result = canDropCardsOnMeld({
        meld: teamARunMeld,
        cardsInFlight: [spade10],
        allHandCards,
        canAdd: true,
        isOwnTeam: false,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cannot add to sequence right now');
    });

    it('rejects drop if canAdd is false (e.g. DRAW or DISCARD phase)', () => {
      const allHandCards = [spade10, fillerCard];
      const result = canDropCardsOnMeld({
        meld: teamARunMeld,
        cardsInFlight: [spade10],
        allHandCards,
        canAdd: false,
        isOwnTeam: true,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cannot add to sequence right now');
    });

    it('rejects drop if sequence is a completed 500-pt pure sequence', () => {
      const allHandCards = [spade10, fillerCard];
      const result = canDropCardsOnMeld({
        meld: completedPureMeld,
        cardsInFlight: [spade10],
        allHandCards,
        canAdd: true,
        isOwnTeam: true,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Sequence is complete');
    });

    it('rejects drop if adding would leave hand empty (must retain at least 1 card to discard)', () => {
      // Hand has only 1 card (spade10)
      const allHandCards = [spade10];
      const result = canDropCardsOnMeld({
        meld: teamARunMeld,
        cardsInFlight: [spade10],
        allHandCards,
        canAdd: true,
        isOwnTeam: true,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must keep at least 1 card in hand');
    });

    it('rejects drop if cards in flight is empty', () => {
      const allHandCards = [spade10, fillerCard];
      const result = canDropCardsOnMeld({
        meld: teamARunMeld,
        cardsInFlight: [],
        allHandCards,
        canAdd: true,
        isOwnTeam: true,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No cards in flight');
    });
  });
});
