import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Card, Meld } from '../../src/engine/types';
import { PlayingCard, getRankLabel, getSuitSymbol, isRedSuit } from '../../src/ui/components/PlayingCard';
import { DiscardPileModal } from '../../src/ui/components/DiscardPileModal';
import { CenterTable } from '../../src/ui/components/CenterTable';
import { TableMeldBoard, sortMelds } from '../../src/ui/components/TableMeldBoard';

describe('UI Components', () => {
  describe('PlayingCard', () => {
    it('renders standard card correctly (rank, suit symbol, red/black color)', () => {
      const card: Card = { id: 'c1', suit: 'HEARTS', rank: 14 };
      const html = renderToString(<PlayingCard card={card} />);

      expect(html).toContain('A');
      expect(html).toContain('♥');
      expect(html).toContain('text-red-600');
      expect(html).toContain('aria-label="A of HEARTS"');
    });

    it('renders black suit for spades and clubs', () => {
      const spadeCard: Card = { id: 'c2', suit: 'SPADES', rank: 10 };
      const html = renderToString(<PlayingCard card={spadeCard} />);

      expect(html).toContain('10');
      expect(html).toContain('♠');
      expect(html).toContain('text-slate-900');
    });

    it('renders natural joker with star and joker badge', () => {
      const jokerCard: Card = { id: 'j1', suit: null, rank: 0, isNaturalJoker: true };
      const html = renderToString(<PlayingCard card={jokerCard} />);

      expect(html).toContain('JK');
      expect(html).toContain('★');
      expect(html).toContain('Wild');
      expect(html).toContain('text-amber-600');
    });

    it('renders wildcard indicator with represented rank when substituting in meld', () => {
      const wild2Card: Card = { id: 'w1', suit: 'CLUBS', rank: 2 };
      const html = renderToString(
        <PlayingCard
          card={wild2Card}
          isWild={true}
          representedRank={5}
          representedSuit="CLUBS"
        />
      );

      expect(html).toContain('Wild (5♣)');
    });

    it('renders custom wildcard label when provided', () => {
      const wild2Card: Card = { id: 'w2', suit: 'DIAMONDS', rank: 2 };
      const html = renderToString(
        <PlayingCard
          card={wild2Card}
          wildcardLabel="Wild (K♦)"
        />
      );

      expect(html).toContain('Wild (K♦)');
    });

    it('renders face-down card back with PUKAR emblem', () => {
      const card: Card = { id: 'c3', suit: 'SPADES', rank: 7 };
      const html = renderToString(<PlayingCard card={card} faceDown />);

      expect(html).toContain('PUKAR');
      expect(html).toContain('Face-down card');
      expect(html).not.toContain('7 of SPADES');
    });

    it('renders selection ring when selected', () => {
      const card: Card = { id: 'c4', suit: 'HEARTS', rank: 9 };
      const html = renderToString(<PlayingCard card={card} isSelected />);

      expect(html).toContain('ring-amber-400');
    });

    it('helper functions getRankLabel, getSuitSymbol, isRedSuit work as expected', () => {
      expect(getRankLabel(14)).toBe('A');
      expect(getRankLabel(11)).toBe('J');
      expect(getRankLabel(12)).toBe('Q');
      expect(getRankLabel(13)).toBe('K');
      expect(getRankLabel(0, true)).toBe('JK');
      expect(getRankLabel(7)).toBe('7');

      expect(getSuitSymbol('SPADES')).toBe('♠');
      expect(getSuitSymbol('HEARTS')).toBe('♥');
      expect(getSuitSymbol('DIAMONDS')).toBe('♦');
      expect(getSuitSymbol('CLUBS')).toBe('♣');
      expect(getSuitSymbol(null)).toBe('★');

      expect(isRedSuit('HEARTS')).toBe(true);
      expect(isRedSuit('DIAMONDS')).toBe(true);
      expect(isRedSuit('SPADES')).toBe(false);
      expect(isRedSuit('CLUBS')).toBe(false);
    });
  });

  describe('DiscardPileModal', () => {
    it('returns null when isOpen is false', () => {
      const cards: Card[] = [{ id: 'd1', suit: 'SPADES', rank: 8 }];
      const html = renderToString(<DiscardPileModal isOpen={false} onClose={() => {}} cards={cards} />);

      expect(html).toBe('');
    });

    it('renders chronological cards with bottom and top indicators when isOpen is true', () => {
      const cards: Card[] = [
        { id: 'd1', suit: 'HEARTS', rank: 3 },
        { id: 'd2', suit: 'SPADES', rank: 4 },
        { id: 'd3', suit: 'DIAMONDS', rank: 5 },
      ];
      const html = renderToString(<DiscardPileModal isOpen={true} onClose={() => {}} cards={cards} />);

      expect(html).toContain('Discard Pile History');
      expect(html).toContain('3 cards');
      expect(html).toContain('#1 (Bottom)');
      expect(html).toContain('#2');
      expect(html).toContain('#3 (Top)');
    });

    it('renders empty message when pile is empty', () => {
      const html = renderToString(<DiscardPileModal isOpen={true} onClose={() => {}} cards={[]} />);

      expect(html).toContain('The discard pile is currently empty');
    });

    it('renders spacious max-w-6xl container with card size toggle options', () => {
      const cards: Card[] = [{ id: 'd1', suit: 'HEARTS', rank: 11 }];
      const html = renderToString(
        <DiscardPileModal isOpen={true} onClose={() => {}} cards={cards} />
      );

      expect(html).toContain('max-w-6xl');
      expect(html).toContain('data-testid="btn-card-size-lg"');
      expect(html).toContain('data-testid="btn-card-size-xl"');
      // Default size is large (w-28)
      expect(html).toContain('w-28');
    });

    it('renders extra large cards when defaultCardSize is xl', () => {
      const cards: Card[] = [{ id: 'd1', suit: 'HEARTS', rank: 11 }];
      const html = renderToString(
        <DiscardPileModal
          isOpen={true}
          onClose={() => {}}
          cards={cards}
          defaultCardSize="xl"
        />
      );

      // XL size card width (w-36)
      expect(html).toContain('w-36');
    });
  });

  describe('CenterTable', () => {
    it('renders Stock Deck count, Discard Pile count, and Pukar pool count', () => {
      const discardPile: Card[] = [
        { id: 'd1', suit: 'CLUBS', rank: 10 },
        { id: 'd2', suit: 'HEARTS', rank: 11 },
      ];

      const html = renderToString(
        <CenterTable
          stockDeckCount={45}
          discardPile={discardPile}
          pukarPoolCount={2}
          canDraw={true}
        />
      );

      expect(html).toContain('45 cards remaining in deck');
      expect(html).toContain('Stock Deck');
      expect(html).toContain('Discard Pile');
      expect(html).toContain('2 cards in discard pile');
      expect(html).toContain('Zoom (2)');
      expect(html).toContain('2 Pukars Available');
      expect(html).toContain('+50 pts bonus');
    });

    it('displays top card of discard pile face-up', () => {
      const discardPile: Card[] = [
        { id: 'd1', suit: 'CLUBS', rank: 10 },
        { id: 'd2', suit: 'HEARTS', rank: 14 },
      ];

      const html = renderToString(
        <CenterTable
          stockDeckCount={20}
          discardPile={discardPile}
          pukarPoolCount={1}
        />
      );

      expect(html).toContain('A of HEARTS');
    });

    it('renders empty states when stock deck is exhausted or discard pile is empty', () => {
      const html = renderToString(
        <CenterTable
          stockDeckCount={0}
          discardPile={[]}
          pukarPoolCount={0}
        />
      );

      expect(html).toContain('Exhausted');
      expect(html).toContain('Empty Pile');
      expect(html).toContain('0 Pukars');
      expect(html).toContain('Exhaust rule active');
    });
  });

  describe('TableMeldBoard', () => {
    it('renders Team A and Team B columns with clean/dirty/pure badges', () => {
      const cleanRunMeld: Meld = {
        id: 'meld-1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          { id: 's3', suit: 'SPADES', rank: 3 },
          { id: 's4', suit: 'SPADES', rank: 4 },
          { id: 's5', suit: 'SPADES', rank: 5 },
          { id: 's6', suit: 'SPADES', rank: 6 },
          { id: 's7', suit: 'SPADES', rank: 7 },
          { id: 's8', suit: 'SPADES', rank: 8 },
          { id: 's9', suit: 'SPADES', rank: 9 },
        ],
        slots: [
          { card: { id: 's3', suit: 'SPADES', rank: 3 }, representedRank: 3, representedSuit: 'SPADES' },
          { card: { id: 's4', suit: 'SPADES', rank: 4 }, representedRank: 4, representedSuit: 'SPADES' },
          { card: { id: 's5', suit: 'SPADES', rank: 5 }, representedRank: 5, representedSuit: 'SPADES' },
          { card: { id: 's6', suit: 'SPADES', rank: 6 }, representedRank: 6, representedSuit: 'SPADES' },
          { card: { id: 's7', suit: 'SPADES', rank: 7 }, representedRank: 7, representedSuit: 'SPADES' },
          { card: { id: 's8', suit: 'SPADES', rank: 8 }, representedRank: 8, representedSuit: 'SPADES' },
          { card: { id: 's9', suit: 'SPADES', rank: 9 }, representedRank: 9, representedSuit: 'SPADES' },
        ],
      };

      const dirtyRunMeld: Meld = {
        id: 'meld-2',
        team: 'B',
        type: 'RUN',
        suit: 'HEARTS',
        cards: [
          { id: 'h3', suit: 'HEARTS', rank: 3 },
          { id: 'h4', suit: 'HEARTS', rank: 4 },
          { id: 'w2', suit: 'DIAMONDS', rank: 2 },
          { id: 'h6', suit: 'HEARTS', rank: 6 },
          { id: 'h7', suit: 'HEARTS', rank: 7 },
          { id: 'h8', suit: 'HEARTS', rank: 8 },
          { id: 'h9', suit: 'HEARTS', rank: 9 },
        ],
        slots: [
          { card: { id: 'h3', suit: 'HEARTS', rank: 3 }, representedRank: 3, representedSuit: 'HEARTS' },
          { card: { id: 'h4', suit: 'HEARTS', rank: 4 }, representedRank: 4, representedSuit: 'HEARTS' },
          { card: { id: 'w2', suit: 'DIAMONDS', rank: 2 }, representedRank: 5, representedSuit: 'HEARTS', isWildcard: true },
          { card: { id: 'h6', suit: 'HEARTS', rank: 6 }, representedRank: 6, representedSuit: 'HEARTS' },
          { card: { id: 'h7', suit: 'HEARTS', rank: 7 }, representedRank: 7, representedSuit: 'HEARTS' },
          { card: { id: 'h8', suit: 'HEARTS', rank: 8 }, representedRank: 8, representedSuit: 'HEARTS' },
          { card: { id: 'h9', suit: 'HEARTS', rank: 9 }, representedRank: 9, representedSuit: 'HEARTS' },
        ],
      };

      const html = renderToString(
        <TableMeldBoard
          melds={{
            A: [cleanRunMeld],
            B: [dirtyRunMeld],
          }}
          activeTeam="A"
        />
      );

      expect(html).toContain('Team A');
      expect(html).toContain('Team B');
      expect(html).toContain('Pure Sequence - 200 pts');
      expect(html).toContain('Impure Sequence - 100 pts');
      expect(html).toContain('Active Turn');
      expect(html).toContain('200 pts');
      expect(html).toContain('100 pts');
    });

    it('renders incomplete meld badge when fewer than 7 cards', () => {
      const incompleteMeld: Meld = {
        id: 'meld-3',
        team: 'A',
        type: 'RUN',
        suit: 'CLUBS',
        cards: [
          { id: 'c3', suit: 'CLUBS', rank: 3 },
          { id: 'c4', suit: 'CLUBS', rank: 4 },
          { id: 'c5', suit: 'CLUBS', rank: 5 },
        ],
        slots: [
          { card: { id: 'c3', suit: 'CLUBS', rank: 3 }, representedRank: 3, representedSuit: 'CLUBS' },
          { card: { id: 'c4', suit: 'CLUBS', rank: 4 }, representedRank: 4, representedSuit: 'CLUBS' },
          { card: { id: 'c5', suit: 'CLUBS', rank: 5 }, representedRank: 5, representedSuit: 'CLUBS' },
        ],
      };

      const html = renderToString(
        <TableMeldBoard
          melds={{
            A: [incompleteMeld],
            B: [],
          }}
        />
      );

      expect(html).toContain('3c');
      expect(html).toContain('0 pts');
      expect(html).toContain('No sequences placed yet');
    });

    it('renders pure 13-card 2-to-A run badge (500 pts)', () => {
      const pureCards: Card[] = [
        { id: 'p2', suit: 'DIAMONDS', rank: 2 },
        { id: 'p3', suit: 'DIAMONDS', rank: 3 },
        { id: 'p4', suit: 'DIAMONDS', rank: 4 },
        { id: 'p5', suit: 'DIAMONDS', rank: 5 },
        { id: 'p6', suit: 'DIAMONDS', rank: 6 },
        { id: 'p7', suit: 'DIAMONDS', rank: 7 },
        { id: 'p8', suit: 'DIAMONDS', rank: 8 },
        { id: 'p9', suit: 'DIAMONDS', rank: 9 },
        { id: 'p10', suit: 'DIAMONDS', rank: 10 },
        { id: 'p11', suit: 'DIAMONDS', rank: 11 },
        { id: 'p12', suit: 'DIAMONDS', rank: 12 },
        { id: 'p13', suit: 'DIAMONDS', rank: 13 },
        { id: 'p14', suit: 'DIAMONDS', rank: 14 },
      ];

      const pureMeld: Meld = {
        id: 'pure-meld',
        team: 'A',
        type: 'RUN',
        suit: 'DIAMONDS',
        cards: pureCards,
        slots: pureCards.map((c) => ({
          card: c,
          representedRank: c.rank,
          representedSuit: 'DIAMONDS',
          isWildcard: false,
        })),
      };

      const html = renderToString(
        <TableMeldBoard
          melds={{
            A: [pureMeld],
            B: [],
          }}
          onZoomMeld={() => {}}
        />
      );

      expect(html).toContain('Complete Sequence - 500 pts');
      expect(html).toContain('500 pts');
      expect(html).toContain('data-complete="true"');
      expect(html).toContain('grayscale-[45%]');
      expect(html).toContain('cursor-not-allowed');
      expect(html).not.toContain('badge-complete-locked');
      expect(html).not.toContain('Closed');
      expect(html).not.toContain('btn-zoom-meld');
    });

    it('collapses pure vs impure sequence text to points or card count when compactMeldHeaders is enabled', () => {
      const cleanRunMeld: Meld = {
        id: 'meld-compact-1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          { id: 's3', suit: 'SPADES', rank: 3 },
          { id: 's4', suit: 'SPADES', rank: 4 },
          { id: 's5', suit: 'SPADES', rank: 5 },
          { id: 's6', suit: 'SPADES', rank: 6 },
          { id: 's7', suit: 'SPADES', rank: 7 },
          { id: 's8', suit: 'SPADES', rank: 8 },
          { id: 's9', suit: 'SPADES', rank: 9 },
        ],
        slots: [
          { card: { id: 's3', suit: 'SPADES', rank: 3 }, representedRank: 3, representedSuit: 'SPADES' },
          { card: { id: 's4', suit: 'SPADES', rank: 4 }, representedRank: 4, representedSuit: 'SPADES' },
          { card: { id: 's5', suit: 'SPADES', rank: 5 }, representedRank: 5, representedSuit: 'SPADES' },
          { card: { id: 's6', suit: 'SPADES', rank: 6 }, representedRank: 6, representedSuit: 'SPADES' },
          { card: { id: 's7', suit: 'SPADES', rank: 7 }, representedRank: 7, representedSuit: 'SPADES' },
          { card: { id: 's8', suit: 'SPADES', rank: 8 }, representedRank: 8, representedSuit: 'SPADES' },
          { card: { id: 's9', suit: 'SPADES', rank: 9 }, representedRank: 9, representedSuit: 'SPADES' },
        ],
      };

      const dirtyRunMeld: Meld = {
        id: 'meld-compact-2',
        team: 'B',
        type: 'RUN',
        suit: 'HEARTS',
        cards: [
          { id: 'h3', suit: 'HEARTS', rank: 3 },
          { id: 'h4', suit: 'HEARTS', rank: 4 },
          { id: 'w2', suit: 'DIAMONDS', rank: 2 },
          { id: 'h6', suit: 'HEARTS', rank: 6 },
          { id: 'h7', suit: 'HEARTS', rank: 7 },
          { id: 'h8', suit: 'HEARTS', rank: 8 },
          { id: 'h9', suit: 'HEARTS', rank: 9 },
        ],
        slots: [
          { card: { id: 'h3', suit: 'HEARTS', rank: 3 }, representedRank: 3, representedSuit: 'HEARTS' },
          { card: { id: 'h4', suit: 'HEARTS', rank: 4 }, representedRank: 4, representedSuit: 'HEARTS' },
          { card: { id: 'w2', suit: 'DIAMONDS', rank: 2 }, representedRank: 5, representedSuit: 'HEARTS', isWildcard: true },
          { card: { id: 'h6', suit: 'HEARTS', rank: 6 }, representedRank: 6, representedSuit: 'HEARTS' },
          { card: { id: 'h7', suit: 'HEARTS', rank: 7 }, representedRank: 7, representedSuit: 'HEARTS' },
          { card: { id: 'h8', suit: 'HEARTS', rank: 8 }, representedRank: 8, representedSuit: 'HEARTS' },
          { card: { id: 'h9', suit: 'HEARTS', rank: 9 }, representedRank: 9, representedSuit: 'HEARTS' },
        ],
      };

      const incompleteMeld: Meld = {
        id: 'meld-compact-3',
        team: 'A',
        type: 'RUN',
        suit: 'CLUBS',
        cards: [
          { id: 'c3', suit: 'CLUBS', rank: 3 },
          { id: 'c4', suit: 'CLUBS', rank: 4 },
          { id: 'c5', suit: 'CLUBS', rank: 5 },
        ],
        slots: [
          { card: { id: 'c3', suit: 'CLUBS', rank: 3 }, representedRank: 3, representedSuit: 'CLUBS', isWildcard: false },
          { card: { id: 'c4', suit: 'CLUBS', rank: 4 }, representedRank: 4, representedSuit: 'CLUBS', isWildcard: false },
          { card: { id: 'c5', suit: 'CLUBS', rank: 5 }, representedRank: 5, representedSuit: 'CLUBS', isWildcard: false },
        ],
      };

      const html = renderToString(
        <TableMeldBoard
          melds={{
            A: [cleanRunMeld, incompleteMeld],
            B: [dirtyRunMeld],
          }}
          compactMeldHeaders={true}
        />
      );

      // Verify compact flags on headers
      expect(html).toContain('data-testid="meld-header-meld-compact-1"');
      expect(html).toContain('data-compact="true"');

      // The long text "Pure Sequence - 200 pts" is NOT in the visible badge text, but "200 pts" is!
      expect(html).toContain('data-testid="badge-meld-score-meld-compact-1"');
      expect(html).toContain('200 pts');
      expect(html).toContain('title="Pure Sequence - 200 pts"'); // Accessible tooltip preserved

      // The long text "Impure Sequence - 100 pts" is collapsed to "100 pts"
      expect(html).toContain('data-testid="badge-meld-score-meld-compact-2"');
      expect(html).toContain('100 pts');
      expect(html).toContain('title="Impure Sequence - 100 pts"');

      // Incomplete sequence displays number of cards (3c)
      expect(html).toContain('data-testid="badge-meld-score-meld-compact-3"');
      expect(html).toContain('3c');
    });

    it('renders selected meld highlight when selectedMeldId matches', () => {
      const meld: Meld = {
        id: 'sel-1',
        team: 'A',
        type: 'SET',
        rank: 8,
        cards: [
          { id: 's8', suit: 'SPADES', rank: 8 },
          { id: 'h8', suit: 'HEARTS', rank: 8 },
          { id: 'd8', suit: 'DIAMONDS', rank: 8 },
        ],
        slots: [
          { card: { id: 's8', suit: 'SPADES', rank: 8 }, representedRank: 8 },
          { card: { id: 'h8', suit: 'HEARTS', rank: 8 }, representedRank: 8 },
          { card: { id: 'd8', suit: 'DIAMONDS', rank: 8 }, representedRank: 8 },
        ],
      };

      const html = renderToString(
        <TableMeldBoard
          melds={{
            A: [meld],
            B: [],
          }}
          selectedMeldId="sel-1"
          onSelectMeld={() => {}}
        />
      );

      expect(html).toContain('data-selected="true"');
      expect(html).toContain('ring-amber-400/50');
      // Verifies 'Select' and redundant 'High → Low' are removed from sequence item header
      expect(html).not.toContain('>Select<');
      expect(html).not.toContain('Selected to add');
    });

    it('default sorts cards in a meld highest to lowest (descending)', () => {
      // Meld with cards provided in mixed order: 4♠, 6♠, 5♠
      const meld: Meld = {
        id: 'meld-sort-desc',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          { id: 'c4', suit: 'SPADES', rank: 4 },
          { id: 'c6', suit: 'SPADES', rank: 6 },
          { id: 'c5', suit: 'SPADES', rank: 5 },
        ],
        slots: [
          { card: { id: 'c4', suit: 'SPADES', rank: 4 }, representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
          { card: { id: 'c5', suit: 'SPADES', rank: 5 }, representedRank: 5, representedSuit: 'SPADES', isWildcard: false },
          { card: { id: 'c6', suit: 'SPADES', rank: 6 }, representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
        ],
      };

      const html = renderToString(
        <TableMeldBoard
          melds={{
            A: [meld],
            B: [],
          }}
        />
      );

      // Verify sort button is removed and default indicator is rendered
      expect(html).not.toContain('data-testid="btn-toggle-meld-sort"');
      expect(html).not.toContain('Sort: High → Low');
      expect(html).toContain('Sorted Highest to Lowest');

      // Verify cards are rendered in order: 6♠ then 5♠ then 4♠
      const idx6 = html.indexOf('aria-label="6 of SPADES"');
      const idx5 = html.indexOf('aria-label="5 of SPADES"');
      const idx4 = html.indexOf('aria-label="4 of SPADES"');

      expect(idx6).toBeGreaterThan(-1);
      expect(idx5).toBeGreaterThan(-1);
      expect(idx4).toBeGreaterThan(-1);
      // Highest (6) must appear before 5, and 5 must appear before Lowest (4)
      expect(idx6).toBeLessThan(idx5);
      expect(idx5).toBeLessThan(idx4);
    });

    it('supports lowest to highest sorting when defaultSortDirection is asc', () => {
      const meld: Meld = {
        id: 'meld-sort-asc',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          { id: 'c6', suit: 'SPADES', rank: 6 },
          { id: 'c4', suit: 'SPADES', rank: 4 },
          { id: 'c5', suit: 'SPADES', rank: 5 },
        ],
        slots: [
          { card: { id: 'c4', suit: 'SPADES', rank: 4 }, representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
          { card: { id: 'c5', suit: 'SPADES', rank: 5 }, representedRank: 5, representedSuit: 'SPADES', isWildcard: false },
          { card: { id: 'c6', suit: 'SPADES', rank: 6 }, representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
        ],
      };

      const html = renderToString(
        <TableMeldBoard
          melds={{
            A: [meld],
            B: [],
          }}
          defaultSortDirection="asc"
        />
      );

      expect(html).not.toContain('data-testid="btn-toggle-meld-sort"');
      expect(html).not.toContain('Sort: Low → High');
      expect(html).toContain('Sorted Lowest to Highest');

      const idx4 = html.indexOf('aria-label="4 of SPADES"');
      const idx5 = html.indexOf('aria-label="5 of SPADES"');
      const idx6 = html.indexOf('aria-label="6 of SPADES"');

      expect(idx4).toBeGreaterThan(-1);
      expect(idx5).toBeGreaterThan(-1);
      expect(idx6).toBeGreaterThan(-1);
      // Lowest (4) must appear before 5, and 5 must appear before Highest (6)
      expect(idx4).toBeLessThan(idx5);
      expect(idx5).toBeLessThan(idx6);
    });

    it('sortMelds sorts melds by suit in priority: Spades -> Hearts -> Clubs -> Diamonds -> Sets', () => {
      const spadeRun: Meld = {
        id: 'meld-spades',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          { id: 's4', suit: 'SPADES', rank: 4 },
          { id: 's5', suit: 'SPADES', rank: 5 },
          { id: 's6', suit: 'SPADES', rank: 6 },
        ],
        slots: [
          { card: { id: 's4', suit: 'SPADES', rank: 4 }, representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
          { card: { id: 's5', suit: 'SPADES', rank: 5 }, representedRank: 5, representedSuit: 'SPADES', isWildcard: false },
          { card: { id: 's6', suit: 'SPADES', rank: 6 }, representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
        ],
      };

      const heartRun: Meld = {
        id: 'meld-hearts',
        team: 'A',
        type: 'RUN',
        suit: 'HEARTS',
        cards: [
          { id: 'h4', suit: 'HEARTS', rank: 4 },
          { id: 'h5', suit: 'HEARTS', rank: 5 },
          { id: 'h6', suit: 'HEARTS', rank: 6 },
        ],
        slots: [
          { card: { id: 'h4', suit: 'HEARTS', rank: 4 }, representedRank: 4, representedSuit: 'HEARTS', isWildcard: false },
          { card: { id: 'h5', suit: 'HEARTS', rank: 5 }, representedRank: 5, representedSuit: 'HEARTS', isWildcard: false },
          { card: { id: 'h6', suit: 'HEARTS', rank: 6 }, representedRank: 6, representedSuit: 'HEARTS', isWildcard: false },
        ],
      };

      const clubRun: Meld = {
        id: 'meld-clubs',
        team: 'A',
        type: 'RUN',
        suit: 'CLUBS',
        cards: [
          { id: 'c4', suit: 'CLUBS', rank: 4 },
          { id: 'c5', suit: 'CLUBS', rank: 5 },
          { id: 'c6', suit: 'CLUBS', rank: 6 },
        ],
        slots: [
          { card: { id: 'c4', suit: 'CLUBS', rank: 4 }, representedRank: 4, representedSuit: 'CLUBS', isWildcard: false },
          { card: { id: 'c5', suit: 'CLUBS', rank: 5 }, representedRank: 5, representedSuit: 'CLUBS', isWildcard: false },
          { card: { id: 'c6', suit: 'CLUBS', rank: 6 }, representedRank: 6, representedSuit: 'CLUBS', isWildcard: false },
        ],
      };

      const diamondRun: Meld = {
        id: 'meld-diamonds',
        team: 'A',
        type: 'RUN',
        suit: 'DIAMONDS',
        cards: [
          { id: 'd4', suit: 'DIAMONDS', rank: 4 },
          { id: 'd5', suit: 'DIAMONDS', rank: 5 },
          { id: 'd6', suit: 'DIAMONDS', rank: 6 },
        ],
        slots: [
          { card: { id: 'd4', suit: 'DIAMONDS', rank: 4 }, representedRank: 4, representedSuit: 'DIAMONDS', isWildcard: false },
          { card: { id: 'd5', suit: 'DIAMONDS', rank: 5 }, representedRank: 5, representedSuit: 'DIAMONDS', isWildcard: false },
          { card: { id: 'd6', suit: 'DIAMONDS', rank: 6 }, representedRank: 6, representedSuit: 'DIAMONDS', isWildcard: false },
        ],
      };

      const setMeld: Meld = {
        id: 'meld-set',
        team: 'A',
        type: 'SET',
        suit: undefined,
        rank: 9,
        cards: [
          { id: 's9', suit: 'SPADES', rank: 9 },
          { id: 'h9', suit: 'HEARTS', rank: 9 },
          { id: 'd9', suit: 'DIAMONDS', rank: 9 },
        ],
        slots: [
          { card: { id: 's9', suit: 'SPADES', rank: 9 }, representedRank: 9, representedSuit: 'SPADES', isWildcard: false },
          { card: { id: 'h9', suit: 'HEARTS', rank: 9 }, representedRank: 9, representedSuit: 'HEARTS', isWildcard: false },
          { card: { id: 'd9', suit: 'DIAMONDS', rank: 9 }, representedRank: 9, representedSuit: 'DIAMONDS', isWildcard: false },
        ],
      };

      // Input in mixed order: Diamonds, Sets, Clubs, Hearts, Spades
      const mixed = [diamondRun, setMeld, clubRun, heartRun, spadeRun];
      const sorted = sortMelds(mixed);

      expect(sorted.map((m) => m.id)).toEqual([
        'meld-spades',
        'meld-hearts',
        'meld-clubs',
        'meld-diamonds',
        'meld-set',
      ]);
    });

    it('sortMelds groups same-suit melds together and sorts them by rank', () => {
      const spadeLowRun: Meld = {
        id: 'spades-low',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          { id: 's3', suit: 'SPADES', rank: 3 },
          { id: 's4', suit: 'SPADES', rank: 4 },
          { id: 's5', suit: 'SPADES', rank: 5 },
        ],
        slots: [
          { card: { id: 's3', suit: 'SPADES', rank: 3 }, representedRank: 3, representedSuit: 'SPADES', isWildcard: false },
          { card: { id: 's4', suit: 'SPADES', rank: 4 }, representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
          { card: { id: 's5', suit: 'SPADES', rank: 5 }, representedRank: 5, representedSuit: 'SPADES', isWildcard: false },
        ],
      };

      const spadeHighRun: Meld = {
        id: 'spades-high',
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

      const heartRun: Meld = {
        id: 'hearts-run',
        team: 'A',
        type: 'RUN',
        suit: 'HEARTS',
        cards: [
          { id: 'h7', suit: 'HEARTS', rank: 7 },
          { id: 'h8', suit: 'HEARTS', rank: 8 },
          { id: 'h9', suit: 'HEARTS', rank: 9 },
        ],
        slots: [
          { card: { id: 'h7', suit: 'HEARTS', rank: 7 }, representedRank: 7, representedSuit: 'HEARTS', isWildcard: false },
          { card: { id: 'h8', suit: 'HEARTS', rank: 8 }, representedRank: 8, representedSuit: 'HEARTS', isWildcard: false },
          { card: { id: 'h9', suit: 'HEARTS', rank: 9 }, representedRank: 9, representedSuit: 'HEARTS', isWildcard: false },
        ],
      };

      // Default (desc): higher rank meld appears first within Spades, followed by Hearts
      const sortedDesc = sortMelds([spadeLowRun, heartRun, spadeHighRun], 'desc');
      expect(sortedDesc.map((m) => m.id)).toEqual([
        'spades-high',
        'spades-low',
        'hearts-run',
      ]);

      // Ascending: lower rank meld appears first within Spades, followed by Hearts
      const sortedAsc = sortMelds([spadeLowRun, heartRun, spadeHighRun], 'asc');
      expect(sortedAsc.map((m) => m.id)).toEqual([
        'spades-low',
        'spades-high',
        'hearts-run',
      ]);
    });

    it('renders melds on TableMeldBoard sorted by suit and same-suit rank', () => {
      const spadeLow: Meld = {
        id: 'meld-s-low',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          { id: 's3', suit: 'SPADES', rank: 3 },
          { id: 's4', suit: 'SPADES', rank: 4 },
          { id: 's5', suit: 'SPADES', rank: 5 },
        ],
        slots: [
          { card: { id: 's3', suit: 'SPADES', rank: 3 }, representedRank: 3, representedSuit: 'SPADES', isWildcard: false },
          { card: { id: 's4', suit: 'SPADES', rank: 4 }, representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
          { card: { id: 's5', suit: 'SPADES', rank: 5 }, representedRank: 5, representedSuit: 'SPADES', isWildcard: false },
        ],
      };

      const spadeHigh: Meld = {
        id: 'meld-s-high',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [
          { id: 's10', suit: 'SPADES', rank: 10 },
          { id: 'sj', suit: 'SPADES', rank: 11 },
          { id: 'sq', suit: 'SPADES', rank: 12 },
        ],
        slots: [
          { card: { id: 's10', suit: 'SPADES', rank: 10 }, representedRank: 10, representedSuit: 'SPADES', isWildcard: false },
          { card: { id: 'sj', suit: 'SPADES', rank: 11 }, representedRank: 11, representedSuit: 'SPADES', isWildcard: false },
          { card: { id: 'sq', suit: 'SPADES', rank: 12 }, representedRank: 12, representedSuit: 'SPADES', isWildcard: false },
        ],
      };

      const diamondRun: Meld = {
        id: 'meld-d',
        team: 'A',
        type: 'RUN',
        suit: 'DIAMONDS',
        cards: [
          { id: 'd7', suit: 'DIAMONDS', rank: 7 },
          { id: 'd8', suit: 'DIAMONDS', rank: 8 },
          { id: 'd9', suit: 'DIAMONDS', rank: 9 },
        ],
        slots: [
          { card: { id: 'd7', suit: 'DIAMONDS', rank: 7 }, representedRank: 7, representedSuit: 'DIAMONDS', isWildcard: false },
          { card: { id: 'd8', suit: 'DIAMONDS', rank: 8 }, representedRank: 8, representedSuit: 'DIAMONDS', isWildcard: false },
          { card: { id: 'd9', suit: 'DIAMONDS', rank: 9 }, representedRank: 9, representedSuit: 'DIAMONDS', isWildcard: false },
        ],
      };

      // Passed to TableMeldBoard in reverse order: Diamonds, Spades Low, Spades High
      const html = renderToString(
        <TableMeldBoard
          melds={{
            A: [diamondRun, spadeLow, spadeHigh],
            B: [],
          }}
        />
      );

      // Verify DOM render order: Spades High (10-Q) comes before Spades Low (3-5), which comes before Diamonds
      const idxSpadeHigh = html.indexOf('aria-label="Q of SPADES"');
      const idxSpadeLow = html.indexOf('aria-label="5 of SPADES"');
      const idxDiamond = html.indexOf('aria-label="9 of DIAMONDS"');

      expect(idxSpadeHigh).toBeGreaterThan(-1);
      expect(idxSpadeLow).toBeGreaterThan(-1);
      expect(idxDiamond).toBeGreaterThan(-1);

      expect(idxSpadeHigh).toBeLessThan(idxSpadeLow);
      expect(idxSpadeLow).toBeLessThan(idxDiamond);
    });
  });
});
