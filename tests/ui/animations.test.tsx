import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PukarSlamOverlay } from '../../src/ui/components/PukarSlamOverlay';
import { PlayerHand } from '../../src/ui/components/PlayerHand';
import { CenterTable } from '../../src/ui/components/CenterTable';
import { TableMeldBoard } from '../../src/ui/components/TableMeldBoard';
import { TableSeating } from '../../src/ui/components/TableSeating';
import { Card, Meld, Suit, Rank } from '../../src/engine/types';
import fs from 'fs';
import path from 'path';

function createCard(id: string, suit: Suit, rank: number): Card {
  return {
    id,
    suit,
    rank: rank as Rank,
    isJoker: rank === 2,
    isNaturalJoker: false,
  };
}

describe('Animation System & Tactile Effects', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('CSS Keyframe Architecture in src/index.css', () => {
    const cssContent = fs.readFileSync(
      path.resolve(__dirname, '../../src/index.css'),
      'utf-8'
    );

    it('defines card deal-in (pick up) keyframes and utility class', () => {
      expect(cssContent).toContain('@keyframes card-deal-in');
      expect(cssContent).toContain('.animate-card-deal-in');
    });

    it('defines discard landing (drop card) keyframes and utility class', () => {
      expect(cssContent).toContain('@keyframes discard-landing');
      expect(cssContent).toContain('.animate-discard-landing');
    });

    it('defines pukar heavy card/deck slam impact keyframes and utility class', () => {
      expect(cssContent).toContain('@keyframes pukar-slam-impact');
      expect(cssContent).toContain('.animate-pukar-slam');
    });

    it('defines golden shockwave ripple expanding ring keyframes and utility class', () => {
      expect(cssContent).toContain('@keyframes shockwave-ring');
      expect(cssContent).toContain('.animate-shockwave');
    });

    it('defines table felt quake tremor keyframes and utility class', () => {
      expect(cssContent).toContain('@keyframes table-quake');
      expect(cssContent).toContain('.animate-table-quake');
    });

    it('defines card ripple jolt keyframes and utility class', () => {
      expect(cssContent).toContain('@keyframes card-ripple-jolt');
      expect(cssContent).toContain('.animate-card-ripple');
    });

    it('defines sequence pop-in and auto-add absorb keyframes', () => {
      expect(cssContent).toContain('@keyframes sequence-pop-in');
      expect(cssContent).toContain('.animate-sequence-pop-in');
      expect(cssContent).toContain('@keyframes sequence-absorb');
      expect(cssContent).toContain('.animate-sequence-absorb');
    });

    it('includes prefers-reduced-motion accessibility media query', () => {
      expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');
      expect(cssContent).toContain('.animate-pukar-slam');
      expect(cssContent).toContain('.animate-card-ripple');
    });
  });

  describe('PukarSlamOverlay Component', () => {
    it('renders dialog with slam title, points badge, and team details', () => {
      const html = renderToString(
        <PukarSlamOverlay
          team="A"
          playerName="Alice"
          points={50}
        />
      );

      expect(html).toContain('data-testid="pukar-slam-overlay"');
      expect(html).toContain('PUKAR SLAM!');
      expect(html).toContain('+50 BONUS POINTS');
      expect(html).toContain('Alice');
      expect(html).toContain('Team A');
      expect(html).toContain('animate-pukar-slam');
      expect(html).toContain('animate-shockwave');
      expect(html).toContain('animate-particle-burst');
    });

    it('renders close button for dismissing', () => {
      const html = renderToString(
        <PukarSlamOverlay
          team="B"
          playerName="Bob"
          points={50}
        />
      );

      expect(html).toContain('data-testid="btn-dismiss-slam-overlay"');
      expect(html).toContain('Continue Playing');
    });
  });

  describe('PlayerHand Pick Up & Ripple Animations', () => {
    const cards = [
      createCard('c-1', 'SPADES', 10),
      createCard('c-2', 'HEARTS', 8),
    ];

    it('applies animate-card-deal-in to newly picked up cards', () => {
      const html = renderToString(
        <PlayerHand
          cards={cards}
          newCardIds={['c-1']}
        />
      );

      expect(html).toContain('animate-card-deal-in');
    });

    it('applies animate-card-ripple when isRippling is true', () => {
      const html = renderToString(
        <PlayerHand
          cards={cards}
          isRippling={true}
        />
      );

      expect(html).toContain('animate-card-ripple');
    });
  });

  describe('CenterTable Discard Landing & Ripple Animations', () => {
    const discardPile = [
      createCard('d-1', 'DIAMONDS', 7),
      createCard('d-2', 'CLUBS', 9),
    ];

    it('renders discard landing animation on top discard card', () => {
      const html = renderToString(
        <CenterTable
          discardPile={discardPile}
          stockDeckCount={50}
        />
      );

      expect(html).toContain('animate-discard-landing');
    });

    it('applies animate-card-ripple to stock deck and discard pile when isRippling is true', () => {
      const html = renderToString(
        <CenterTable
          discardPile={discardPile}
          stockDeckCount={50}
          isRippling={true}
        />
      );

      expect(html).toContain('animate-card-ripple');
    });
  });

  describe('TableMeldBoard Sequence Pop-in & Ripple Animations', () => {
    const sampleMeld: Meld = {
      id: 'm-1',
      type: 'RUN',
      suit: 'SPADES',
      team: 'A',
      cards: [
        createCard('s-3', 'SPADES', 3),
        createCard('s-4', 'SPADES', 4),
        createCard('s-5', 'SPADES', 5),
      ],
      slots: [
        { card: createCard('s-3', 'SPADES', 3), representedRank: 3, isWildcard: false },
        { card: createCard('s-4', 'SPADES', 4), representedRank: 4, isWildcard: false },
        { card: createCard('s-5', 'SPADES', 5), representedRank: 5, isWildcard: false },
      ],
    };

    it('renders sequence cards with pop-in animation', () => {
      const html = renderToString(
        <TableMeldBoard
          melds={{ A: [sampleMeld], B: [] }}
          isRippling={false}
        />
      );

      expect(html).toContain('animate-sequence-pop-in');
    });

    it('renders sequence cards with animate-card-ripple when isRippling is true', () => {
      const html = renderToString(
        <TableMeldBoard
          melds={{ A: [sampleMeld], B: [] }}
          isRippling={true}
        />
      );

      expect(html).toContain('animate-card-ripple');
    });
  });

  describe('TableSeating Seat Ripple Response', () => {
    const players = [
      { id: 'p1', name: 'Player 1', team: 'A' as const, hand: [] },
      { id: 'p2', name: 'Player 2', team: 'B' as const, hand: [] },
      { id: 'p3', name: 'Player 3', team: 'A' as const, hand: [] },
      { id: 'p4', name: 'Player 4', team: 'B' as const, hand: [] },
    ];

    it('applies animate-card-ripple to player seats when isRippling is true', () => {
      const html = renderToString(
        <TableSeating
          players={players}
          viewedPlayerIndex={0}
          activeTurnIndex={0}
          isRippling={true}
        >
          <div>Table Content</div>
        </TableSeating>
      );

      expect(html).toContain('animate-card-ripple');
    });
  });
});
