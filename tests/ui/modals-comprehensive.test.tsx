import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DiscardPileModal } from '../../src/ui/components/DiscardPileModal';
import { RoundSummaryModal } from '../../src/ui/components/RoundSummaryModal';
import { ModeSelectorModal } from '../../src/ui/components/ModeSelectorModal';
import { SequenceZoomModal } from '../../src/ui/components/SequenceZoomModal';
import { PukarSlamOverlay } from '../../src/ui/components/PukarSlamOverlay';
import { Card, Meld } from '../../src/engine/types';

function makeCard(id: string, suit: Card['suit'], rank: Card['rank']): Card {
  return {
    id,
    suit,
    rank,
    isNaturalJoker: rank === 0,
    isJoker: rank === 0 || rank === 2,
  };
}

describe('UI Modals & Overlays - Comprehensive Audit & Edge Cases', () => {
  /* =========================================================================
   * 1. DiscardPileModal
   * ========================================================================= */
  describe('DiscardPileModal Component', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToString(
        <DiscardPileModal isOpen={false} onClose={() => {}} discardPile={[]} />
      );
      expect(html).toBe('');
    });

    it('renders empty discard pile notice when pile is empty', () => {
      const html = renderToString(
        <DiscardPileModal isOpen={true} onClose={() => {}} discardPile={[]} />
      );
      expect(html).toContain('data-testid="discard-pile-modal"');
      expect(html).toContain('0 cards');
      expect(html).toContain('The discard pile is currently empty.');
    });

    it('renders cards in chronological order with top card badge', () => {
      const pile: Card[] = [
        makeCard('c1', 'SPADES', 10),
        makeCard('c2', 'HEARTS', 5),
        makeCard('c3', 'DIAMONDS', 6),
      ];

      const html = renderToString(
        <DiscardPileModal isOpen={true} onClose={() => {}} discardPile={pile} />
      );

      expect(html).toContain('Discard Pile History');
      expect(html).toContain('3 cards');
      expect(html).toContain('data-testid="btn-card-size-lg"');
      expect(html).toContain('data-testid="btn-card-size-xl"');
      expect(html).toContain('#3 (Top)');
      expect(html).toContain('#1 (Bottom)');
    });

    it('supports cards prop fallback over discardPile prop', () => {
      const pile: Card[] = [makeCard('c1', 'CLUBS', 4)];
      const html = renderToString(
        <DiscardPileModal isOpen={true} onClose={() => {}} cards={pile} />
      );
      expect(html).toContain('1 card');
    });
  });

  /* =========================================================================
   * 2. RoundSummaryModal
   * ========================================================================= */
  describe('RoundSummaryModal Component', () => {
    it('returns null when isOpen is false and isRoundOver is false', () => {
      const html = renderToString(
        <RoundSummaryModal
          isOpen={false}
          isRoundOver={false}
          onStartNextRound={() => {}}
        />
      );
      expect(html).toBe('');
    });

    it('renders winner hero banner for Team A victory', () => {
      const cardsA = [makeCard('s3', 'SPADES', 3), makeCard('s4', 'SPADES', 4), makeCard('s5', 'SPADES', 5)];
      const meldA: Meld = {
        id: 'mA1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: cardsA,
        slots: cardsA.map((c) => ({
          card: c,
          representedRank: c.rank,
          representedSuit: 'SPADES',
          isWildcard: false,
        })),
      };

      const html = renderToString(
        <RoundSummaryModal
          isOpen={true}
          round={2}
          roundScores={{ A: 250, B: 100 }}
          totalScores={{ A: 450, B: 200 }}
          melds={{ A: [meldA], B: [] }}
          pukarsClaimed={{ A: 2, B: 0 }}
          winnerTeam="A"
          winningReason="Team A went out cleanly!"
          onStartNextRound={() => {}}
          onClose={() => {}}
        />
      );

      expect(html).toContain('data-testid="round-summary-modal"');
      expect(html).toContain('Team <span class="text-blue-400">A</span> Wins Round 2!');
      expect(html).toContain('Team A went out cleanly!');
      expect(html).toContain('Claimed Pukars (2 × 50)');
      expect(html).toContain('+100');
      expect(html).toContain('data-testid="btn-next-round"');
    });

    it('renders tie when round scores are equal and no explicit winner is given', () => {
      const html = renderToString(
        <RoundSummaryModal
          isOpen={true}
          round={1}
          roundScores={{ A: 100, B: 100 }}
          totalScores={{ A: 100, B: 100 }}
          melds={{ A: [], B: [] }}
          pukarsClaimed={{ A: 0, B: 0 }}
          onStartNextRound={() => {}}
        />
      );

      expect(html).toContain('Round Tied!');
    });
  });

  /* =========================================================================
   * 3. ModeSelectorModal
   * ========================================================================= */
  describe('ModeSelectorModal Component', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToString(
        <ModeSelectorModal
          isOpen={false}
          onSelectLocal={() => {}}
          onSelectMultiplayer={() => {}}
          onClose={() => {}}
        />
      );
      expect(html).toBe('');
    });

    it('renders local and multiplayer mode selection buttons', () => {
      const html = renderToString(
        <ModeSelectorModal
          isOpen={true}
          onSelectLocal={() => {}}
          onSelectMultiplayer={() => {}}
          onClose={() => {}}
        />
      );

      expect(html).toContain('data-testid="mode-selector-modal"');
      expect(html).toContain('Local Hot-Seat / Pass &amp; Play');
      expect(html).toContain('LAN &amp; Online Multiplayer');
      expect(html).toContain('data-testid="btn-close-modal"');
    });
  });

  /* =========================================================================
   * 4. SequenceZoomModal
   * ========================================================================= */
  describe('SequenceZoomModal Component', () => {
    it('returns null when isOpen is false or meld is null', () => {
      const html1 = renderToString(
        <SequenceZoomModal isOpen={false} meld={null} onClose={() => {}} />
      );
      expect(html1).toBe('');

      const cardsSet = [makeCard('c1', 'SPADES', 9), makeCard('c2', 'HEARTS', 9), makeCard('c3', 'CLUBS', 9)];
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'SET',
        rank: 9,
        cards: cardsSet,
        slots: cardsSet.map((c) => ({
          card: c,
          representedRank: 9,
          representedSuit: c.suit || undefined,
          isWildcard: false,
        })),
      };

      const html2 = renderToString(
        <SequenceZoomModal isOpen={false} meld={meld} onClose={() => {}} />
      );
      expect(html2).toBe('');
    });

    it('renders enlarged sequence cards and points badge', () => {
      const cardsRun = [makeCard('s7', 'SPADES', 7), makeCard('s8', 'SPADES', 8), makeCard('s9', 'SPADES', 9)];
      const meld: Meld = {
        id: 'm1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: cardsRun,
        slots: cardsRun.map((c) => ({
          card: c,
          representedRank: c.rank,
          representedSuit: 'SPADES',
          isWildcard: false,
        })),
      };

      const html = renderToString(
        <SequenceZoomModal isOpen={true} meld={meld} onClose={() => {}} />
      );

      expect(html).toContain('data-testid="sequence-zoom-modal"');
      expect(html).toContain('Sequence Zoom Inspection');
      expect(html).toContain('Team A');
      expect(html).toContain('aria-label="Close modal"');
    });
  });

  /* =========================================================================
   * 5. PukarSlamOverlay
   * ========================================================================= */
  describe('PukarSlamOverlay Component', () => {
    it('renders celebration headline, points badge, and particle burst container', () => {
      const html = renderToString(
        <PukarSlamOverlay
          team="B"
          playerName="Player 2"
          points={50}
          onClose={() => {}}
        />
      );

      expect(html).toContain('data-testid="pukar-slam-overlay"');
      expect(html).toContain('PUKAR SLAM!');
      expect(html).toContain('+50 BONUS POINTS');
      expect(html).toContain('Player 2');
      expect(html).toContain('(Team B)');
      expect(html).toContain('animate-shockwave');
      expect(html).toContain('data-testid="btn-dismiss-slam-overlay"');
    });
  });
});
