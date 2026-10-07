import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Card, Meld } from '../../src/engine/types';
import { PlayingCard, getRankLabel, getSuitSymbol, isRedSuit } from '../../src/ui/components/PlayingCard';
import { DiscardPileModal } from '../../src/ui/components/DiscardPileModal';
import { CenterTable } from '../../src/ui/components/CenterTable';
import { TableMeldBoard } from '../../src/ui/components/TableMeldBoard';

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

      expect(html).toContain('45 cards remaining');
      expect(html).toContain('Stock Deck');
      expect(html).toContain('Discard Pile');
      expect(html).toContain('2 cards in pile');
      expect(html).toContain('Peek (2)');
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
      expect(html).toContain('Clean Run - 200 pts');
      expect(html).toContain('Dirty Run - 100 pts');
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

      expect(html).toContain('Run - 3 cards');
      expect(html).toContain('0 pts');
      expect(html).toContain('No melds placed yet');
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
        />
      );

      expect(html).toContain('Pure 2-A Run - 500 pts');
      expect(html).toContain('500 pts');
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

      expect(html).toContain('Selected to add');
      expect(html).toContain('ring-amber-400/50');
    });
  });
});
