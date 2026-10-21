import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { FrustrationOverlay } from '../../src/ui/components/FrustrationOverlay';
import { ActionControls } from '../../src/ui/components/ActionControls';
import { PlayerHand } from '../../src/ui/components/PlayerHand';
import { CenterTable } from '../../src/ui/components/CenterTable';
import { TableMeldBoard } from '../../src/ui/components/TableMeldBoard';
import { SequencesPage } from '../../src/ui/components/SequencesPage';
import { TopNavBar } from '../../src/ui/components/TopNavBar';
import { UnclePukarChoiceModal } from '../../src/ui/components/UnclePukarChoiceModal';
import { MatchAnalyticsView } from '../../src/ui/components/MatchAnalyticsView';
import { Card, Meld } from '../../src/engine/types';

import { App } from '../../src/App';
import { dealInitialState } from '../../src/engine/deck';

describe('Mobile Responsiveness & Viewport Adaptations', () => {
  const sampleCard: Card = { id: 'c1', rank: 10, suit: 'SPADES' };
  const sampleMeld: Meld = {
    id: 'm1',
    team: 'A',
    type: 'RUN',
    suit: 'SPADES',
    cards: [
      { id: 'c1', rank: 8, suit: 'SPADES' },
      { id: 'c2', rank: 9, suit: 'SPADES' },
      { id: 'c3', rank: 10, suit: 'SPADES' },
    ],
    slots: [
      { card: { id: 'c1', rank: 8, suit: 'SPADES' }, representedRank: 8, representedSuit: 'SPADES' },
      { card: { id: 'c2', rank: 9, suit: 'SPADES' }, representedRank: 9, representedSuit: 'SPADES' },
      { card: { id: 'c3', rank: 10, suit: 'SPADES' }, representedRank: 10, representedSuit: 'SPADES' },
    ],
    points: 30,
  };

  describe('1. FrustrationOverlay Mobile Wrapping', () => {
    it('uses whitespace-normal on small mobile screens and sm:whitespace-nowrap on desktop', () => {
      const html = renderToString(<FrustrationOverlay playerName="Harsh" />);
      expect(html).toContain('whitespace-normal sm:whitespace-nowrap');
      expect(html).toContain('max-w-[92vw]');
      expect(html).toContain('Aap Nahi Samjhoge Meri Duvidha');
    });
  });

  describe('2. ActionControls & Discard Button Accessibility', () => {
    it('renders Discard button with min-w-fit, clean single-line flex-nowrap and responsive text in unifiedMode', () => {
      const html = renderToString(
        <ActionControls
          phase="MELD"
          unifiedMode={true}
          selectedCards={[sampleCard]}
          selectedCardIds={['c1']}
          allHandCards={[sampleCard, { id: 'c2', rank: 5, suit: 'HEARTS' }]}
        />
      );
      expect(html).toContain('data-testid="btn-discard"');
      expect(html).toContain('min-w-fit');
      expect(html).toContain('flex-nowrap');
      expect(html).toContain('sm:hidden');
      expect(html).toContain('hidden sm:inline');
    });

    it('always renders btn-play-meld in unifiedMode during DRAW phase so players know where to play sequences', () => {
      const html = renderToString(
        <ActionControls
          phase="DRAW"
          unifiedMode={true}
          selectedCards={[sampleCard]}
          selectedCardIds={['c1']}
          allHandCards={[sampleCard]}
        />
      );
      expect(html).toContain('data-testid="btn-play-meld"');
      expect(html).toContain('disabled=""');
      expect(html).toContain('Draw First');
    });
  });

  describe('2b. PlayerHand Responsive Single-Line Toolbar', () => {
    it('renders toolbar and actionsSlot in a clean single-line container (flex-nowrap) without wrapping into 2 rows', () => {
      const html = renderToString(
        <PlayerHand
          cards={[sampleCard]}
          actionsSlot={<button data-testid="dummy-action">Action</button>}
        />
      );
      expect(html).toContain('flex-nowrap');
      expect(html).toContain('dummy-action');
    });
  });

  describe('3. CenterTable Arena Compaction', () => {
    it('renders both desktop 3D grid (hidden md:grid) and mobile compact bar (md:hidden)', () => {
      const html = renderToString(
        <CenterTable
          stockDeckCount={25}
          discardPile={[sampleCard]}
          pukarPoolCount={2}
          canDraw={true}
        />
      );
      // Desktop grid
      expect(html).toContain('hidden md:grid md:grid-cols-3');
      // Mobile compact bar (~110px)
      expect(html).toContain('md:hidden');
      expect(html).toContain('h-[110px]');
      expect(html).toContain('data-testid="discard-pile-drop-zone-mobile"');
    });
  });

  describe('4. TableMeldBoard Mobile Team Tabs Switcher', () => {
    it('renders mobile team tab buttons (<640px) while maintaining sm:block for desktop side-by-side view', () => {
      const html = renderToString(
        <TableMeldBoard
          melds={{ A: [sampleMeld], B: [] }}
          activeTeam="A"
        />
      );
      // Mobile switcher
      expect(html).toContain('sm:hidden');
      expect(html).toContain('Team A');
      expect(html).toContain('Team B');
      expect(html).toContain('pts');
      // Desktop block visibility
      expect(html).toContain('sm:block');
    });
  });

  describe('5. SequencesPage Adaptive Card Fitting', () => {
    it('renders enlarged meld cards with responsive padding and adaptive styling', () => {
      const html = renderToString(
        <SequencesPage
          melds={{ A: [sampleMeld], B: [] }}
          activeTeam="A"
          onBackToTable={() => {}}
        />
      );
      expect(html).toContain('data-testid="enlarged-meld-m1"');
      expect(html).toContain('p-3 sm:p-5');
    });
  });

  describe('6. TopNavBar Mobile Header & Hamburger Drawer', () => {
    it('renders mobile bar with hamburger toggle (md:hidden) and preserves desktop navbar (hidden md:flex)', () => {
      const html = renderToString(
        <TopNavBar
          activeTab="table"
          onTabChange={() => {}}
          onOpenRules={() => {}}
          players={[{ id: 'p1', name: 'Player 1', team: 'A', cardCount: 13 }]}
          currentPlayerIndex={0}
        />
      );
      // Mobile header toggle button
      expect(html).toContain('data-testid="btn-mobile-menu-toggle"');
      expect(html).toContain('flex md:hidden');
      // Desktop navbar container
      expect(html).toContain('hidden md:flex');
    });
  });

  describe('7. UnclePukarChoiceModal Above-the-Fold Artwork', () => {
    it('restricts artwork max-height on mobile viewports so deck choices stay above fold', () => {
      const html = renderToString(
        <UnclePukarChoiceModal
          isOpen={true}
          availableDecksCount={2}
          onSelectDeck={() => {}}
        />
      );
      expect(html).toContain('max-h-[110px] sm:max-h-[220px] md:max-h-[300px]');
      expect(html).toContain('data-testid="uncle-cartoon-image"');
      expect(html).toContain('data-testid="btn-select-pukar-deck-0"');
    });
  });

  describe('8. MatchAnalyticsView Progression Chart Responsiveness', () => {
    it('uses fluid responsive container (w-full min-w-0) instead of hardcoded 650px width', () => {
      const html = renderToString(
        <MatchAnalyticsView
          matchStats={{
            scoreTimeline: [
              { round: 1, scoreA: 100, scoreB: 50 },
            ],
            playerStats: {},
          }}
          winnerTeam="A"
        />
      );
      expect(html).toContain('w-full min-w-0');
      expect(html).not.toContain('min-w-[650px]');
    });
  });

  describe('9. App Mobile Hand Docking & Safe Area Spacers', () => {
    it('applies safe-area bottom padding to docked hand container and dynamic spacer', () => {
      const state = dealInitialState(4);
      // Give Team A 3 melds to trigger hand docking
      state.melds.A = [
        { id: 'mA1', team: 'A', type: 'RUN', suit: 'SPADES', cards: [], slots: [] },
        { id: 'mA2', team: 'A', type: 'RUN', suit: 'HEARTS', cards: [], slots: [] },
        { id: 'mA3', team: 'A', type: 'RUN', suit: 'DIAMONDS', cards: [], slots: [] },
      ];
      state.melds.B = [];

      const html = renderToString(<App initialState={state} />);
      expect(html).toContain('pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-3');
      expect(html).toContain('h-[calc(210px+env(safe-area-inset-bottom))] sm:h-[260px]');
      expect(html).toContain('data-testid="hand-dock-spacer"');
    });

    it('hides DevInspector on mobile (<768px) with hidden md:block', () => {
      const state = dealInitialState(4);
      const html = renderToString(<App initialState={state} />);
      expect(html).toContain('aria-label="Hot-Seat Tools &amp; Dev Inspector"');
      expect(html).toContain('hidden md:block shrink-0');
    });
  });
});
