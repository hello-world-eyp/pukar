import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CenterTable } from '../../src/ui/components/CenterTable';
import { TableMeldBoard } from '../../src/ui/components/TableMeldBoard';
import { PlayerHand } from '../../src/ui/components/PlayerHand';
import { ActionControls } from '../../src/ui/components/ActionControls';
import { ScoreBoard } from '../../src/ui/components/ScoreBoard';
import { DiscardPileModal } from '../../src/ui/components/DiscardPileModal';
import { RoundSummaryModal } from '../../src/ui/components/RoundSummaryModal';
import { DevInspector } from '../../src/ui/components/DevInspector';
import { Card, Meld, Suit, GameState, Rank } from '../../src/engine/types';
import { dealInitialState } from '../../src/engine/deck';

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

describe('Comprehensive UI Game Elements (src/ui/components/)', () => {
  describe('CenterTable Component', () => {
    it('renders stock deck, discard pile ("The Bottom"), and Pukar pool stacks', () => {
      const discard = [makeCard('SPADES', 10, 'top-disc')];
      const html = renderToString(
        <CenterTable
          stockDeckCount={31}
          discardPile={discard}
          pukarPoolCount={2}
          canDraw={true}
        />
      );

      expect(html).toContain('Stock Deck');
      expect(html).toContain('31');
      expect(html).toContain('The Bottom');
      expect(html).toContain('1 card');
      expect(html).toContain('Pukar Pool');
      expect(html).toContain('2 Pukars Available');
    });

    it('displays top card of discard pile face-up with Peek Pile button', () => {
      const discard = [
        makeCard('HEARTS', 5, 'c1'),
        makeCard('HEARTS', 14, 'c2'), // Ace of Hearts on top
      ];
      const html = renderToString(
        <CenterTable
          stockDeckCount={25}
          discardPile={discard}
          pukarPoolCount={2}
          canDraw={true}
        />
      );

      expect(html).toContain('2 cards');
      expect(html).toContain('Peek Pile');
      expect(html).toContain('A');
      expect(html).toContain('♥');
    });

    it('renders disabled state when canDraw is false', () => {
      const discard = [makeCard('SPADES', 10)];
      const html = renderToString(
        <CenterTable
          stockDeckCount={31}
          discardPile={discard}
          pukarPoolCount={2}
          canDraw={false}
        />
      );

      expect(html).toContain('cursor-not-allowed');
    });

    it('displays empty states when stock deck and discard pile are empty', () => {
      const html = renderToString(
        <CenterTable
          stockDeckCount={0}
          discardPile={[]}
          pukarPoolCount={0}
          canDraw={true}
        />
      );

      expect(html).toContain('Exhausted');
      expect(html).toContain('Empty Pile');
      expect(html).toContain('0 Pukars');
    });
  });

  describe('TableMeldBoard Component', () => {
    it('renders Team A and Team B columns with meld score badges and total team points', () => {
      const clean7Run = [3, 4, 5, 6, 7, 8, 9].map((rank) => makeCard('SPADES', rank));
      const meldsA: Meld[] = [
        {
          id: 'meld-A-1',
          team: 'A',
          type: 'RUN',
          suit: 'SPADES',
          cards: clean7Run,
          slots: clean7Run.map((c) => ({ card: c, representedRank: c.rank, isWildcard: false })),
        },
      ];

      const dirty7Set = Array.from({ length: 6 }, (_, i) => makeCard(i % 2 === 0 ? 'HEARTS' : 'DIAMONDS', 8));
      dirty7Set.push(makeCard(null, 0)); // with joker
      const meldsB: Meld[] = [
        {
          id: 'meld-B-1',
          team: 'B',
          type: 'SET',
          rank: 8,
          cards: dirty7Set,
          slots: dirty7Set.map((c) => ({ card: c, representedRank: 8, isWildcard: c.isNaturalJoker })),
        },
      ];

      const html = renderToString(
        <TableMeldBoard
          melds={{ A: meldsA, B: meldsB }}
          onSelectMeld={() => {}}
        />
      );

      expect(html).toContain('Team A');
      expect(html).toContain('Team B');
      expect(html).toContain('200 pts'); // Clean run 200 pts
      expect(html).toContain('100 pts'); // Dirty set 100 pts
    });

    it('highlights selected meld when selectedMeldId is provided', () => {
      const run = [makeCard('HEARTS', 4), makeCard('HEARTS', 5), makeCard('HEARTS', 6)];
      const meldsA: Meld[] = [
        {
          id: 'target-meld',
          team: 'A',
          type: 'RUN',
          suit: 'HEARTS',
          cards: run,
          slots: run.map((c) => ({ card: c, representedRank: c.rank, isWildcard: false })),
        },
      ];

      const html = renderToString(
        <TableMeldBoard
          melds={{ A: meldsA, B: [] }}
          selectedMeldId="target-meld"
          onSelectMeld={() => {}}
        />
      );

      expect(html).toContain('ring-2 ring-amber-400');
    });

    it('renders empty placeholder when team has 0 melds', () => {
      const html = renderToString(
        <TableMeldBoard melds={{ A: [], B: [] }} onSelectMeld={() => {}} />
      );

      expect(html).toContain('No melds placed yet');
    });
  });

  describe('PlayerHand Component', () => {
    it('renders hand cards, card counter badge, and sorting buttons', () => {
      const cards = [
        makeCard('HEARTS', 7, 'c1'),
        makeCard('SPADES', 14, 'c2'),
        makeCard('CLUBS', 2, 'c3'),
      ];

      const html = renderToString(
        <PlayerHand
          playerName="Player 1"
          cards={cards}
          selectedCardIds={['c1']}
          onToggleCardSelection={() => {}}
        />
      );

      expect(html).toContain('Player 1');
      expect(html).toContain('3 cards');
      expect(html).toContain('Sort by Suit');
      expect(html).toContain('Sort by Rank');
    });

    it('renders empty hand message when cards array is empty', () => {
      const html = renderToString(
        <PlayerHand
          playerName="Player 1"
          cards={[]}
          selectedCardIds={[]}
          onToggleCardSelection={() => {}}
        />
      );

      expect(html).toContain('Hand is empty');
    });
  });

  describe('ActionControls Component', () => {
    const hand = [
      makeCard('SPADES', 4, 'c-4s'),
      makeCard('SPADES', 5, 'c-5s'),
      makeCard('SPADES', 6, 'c-6s'),
      makeCard('HEARTS', 10, 'c-10h'),
    ];

    it('enables Draw Stock and Take Bottom during DRAW phase, disabling meld actions', () => {
      const html = renderToString(
        <ActionControls
          phase="DRAW"
          allHandCards={hand}
          selectedCardIds={[]}
          onDrawStock={() => {}}
          onTakeDiscard={() => {}}
          onPlayMeld={() => {}}
          onAddToMeld={() => {}}
          onDiscard={() => {}}
        />
      );

      expect(html).toContain('Draw Deck');
      expect(html).toContain('Take Bottom');
      expect(html).toContain('DRAW');
    });

    it('shows real-time preview badge when valid 3-card RUN is selected in MELD phase', () => {
      const html = renderToString(
        <ActionControls
          phase="MELD"
          allHandCards={hand}
          selectedCardIds={['c-4s', 'c-5s', 'c-6s']}
          onPlayMeld={() => {}}
          onAddToMeld={() => {}}
          onDiscard={() => {}}
        />
      );

      expect(html).toContain('Meld Selected');
      expect(html).toContain('Valid RUN');
    });

    it('shows validation error preview badge when invalid card selection is made in MELD phase', () => {
      const html = renderToString(
        <ActionControls
          phase="MELD"
          allHandCards={hand}
          selectedCardIds={['c-4s', 'c-10h']} // 2 mismatched cards
          onPlayMeld={() => {}}
          onAddToMeld={() => {}}
          onDiscard={() => {}}
        />
      );

      expect(html).toContain('Need at least 3 cards');
    });

    it('enables Discard Selected Card when exactly 1 card is selected in MELD or DISCARD phase', () => {
      const html = renderToString(
        <ActionControls
          phase="MELD"
          allHandCards={hand}
          selectedCardIds={['c-10h']}
          onPlayMeld={() => {}}
          onAddToMeld={() => {}}
          onDiscard={() => {}}
        />
      );

      expect(html).toContain('Discard 10♥');
    });
  });

  describe('ScoreBoard Component', () => {
    it('displays match total, round number, active player banner, and sound toggle', () => {
      const state: GameState = dealInitialState(4);
      state.scores = { A: 150, B: 200 };
      state.pukarsClaimed = { A: 1, B: 2 };

      const html = renderToString(
        <ScoreBoard
          gameState={state}
        />
      );

      expect(html).toContain('PUKAR');
      expect(html).toContain('Round 1');
      expect(html).toContain('Team A');
      expect(html).toContain('Team B');
      expect(html).toContain('150');
      expect(html).toContain('200');
      expect(html).toContain('Player 1');
    });

    it('renders Final Turn indicator banner when roundStatus is FINAL_TURN', () => {
      const state: GameState = dealInitialState(4);
      state.roundStatus = 'FINAL_TURN';

      const html = renderToString(
        <ScoreBoard gameState={state} />
      );

      expect(html).toContain('Final Turn');
    });
  });

  describe('DiscardPileModal Component', () => {
    it('renders all discarded cards in chronological sequence when open', () => {
      const cards = [
        makeCard('HEARTS', 4, 'bottom-card'),
        makeCard('SPADES', 7, 'mid-card'),
        makeCard('DIAMONDS', 14, 'top-card'),
      ];

      const html = renderToString(
        <DiscardPileModal
          isOpen={true}
          cards={cards}
          onClose={() => {}}
        />
      );

      expect(html).toContain('Discard Pile History');
      expect(html).toContain('3 cards');
      expect(html).toContain('#1 (Bottom)');
      expect(html).toContain('#3 (Top)');
    });

    it('returns null when isOpen is false', () => {
      const html = renderToString(
        <DiscardPileModal
          isOpen={false}
          cards={[makeCard('SPADES', 10)]}
          onClose={() => {}}
        />
      );

      expect(html).toBe('');
    });
  });

  describe('RoundSummaryModal Component', () => {
    it('renders itemized score breakdown and Start Next Round action on round completion', () => {
      const html = renderToString(
        <RoundSummaryModal
          isRoundOver={true}
          round={1}
          roundScores={{ A: 250, B: 100 }}
          totalScores={{ A: 250, B: 100 }}
          pukarsClaimed={{ A: 1, B: 0 }}
          winnerTeam="A"
          onStartNextRound={() => {}}
        />
      );

      expect(html).toContain('Round 1 Completed');
      expect(html).toContain('Wins Round 1!');
      expect(html).toContain('250');
      expect(html).toContain('100');
      expect(html).toContain('Next Round');
    });
  });

  describe('DevInspector Component', () => {
    it('renders player perspective buttons and god-mode toggle', () => {
      const players = dealInitialState(4).players;

      const html = renderToString(
        <DevInspector
          players={players}
          currentPlayerIndex={0}
          onSwitchPlayer={() => {}}
        />
      );

      expect(html).toContain('Player 1');
      expect(html).toContain('Player 2');
      expect(html).toContain('Player 3');
      expect(html).toContain('Player 4');
      expect(html).toContain('God Mode');
    });

    it('displays Force Turn button when viewed player differs from active turn', () => {
      const players = dealInitialState(4).players;

      const html = renderToString(
        <DevInspector
          players={players}
          currentPlayerIndex={1} // Viewed player is Player 2
          activeTurnIndex={0} // Active turn is Player 1
          onSwitchPlayer={() => {}}
          onForceTurn={() => {}}
        />
      );

      expect(html).toContain('Force Turn');
    });
  });
});
