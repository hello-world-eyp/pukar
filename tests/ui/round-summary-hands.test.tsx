import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { RoundSummaryModal } from '../../src/ui/components/RoundSummaryModal';
import { Card, Player } from '../../src/engine/types';

describe('RoundSummaryModal - Remaining Hands Tab', () => {
  const sampleCard1: Card = { id: 'card-1', suit: 'HEARTS', rank: 14 }; // Ace of Hearts (15 pts)
  const sampleCard2: Card = { id: 'card-2', suit: 'SPADES', rank: 10 }; // 10 of Spades (10 pts)
  const sampleCard3: Card = { id: 'card-3', suit: 'CLUBS', rank: 2 }; // Wildcard 2 of Clubs (20 pts)

  const samplePlayers: Player[] = [
    {
      id: 'p1',
      name: 'Alice',
      team: 'A',
      hand: [sampleCard1, sampleCard2], // 15 + 10 = 25 pts
    },
    {
      id: 'p2',
      name: 'Bob',
      team: 'B',
      hand: [sampleCard3], // 20 pts
    },
    {
      id: 'p3',
      name: 'Charlie',
      team: 'A',
      hand: [], // 0 cards (went out)
    },
    {
      id: 'p4',
      name: 'Diana',
      team: 'B',
      hand: [], // 0 cards (went out)
    },
  ];

  it('renders the 3rd tab button for Remaining Hands in the modal header', () => {
    const html = renderToString(
      <RoundSummaryModal
        isOpen={true}
        round={1}
        roundScores={{ A: 100, B: 50 }}
        totalScores={{ A: 100, B: 50 }}
        melds={{ A: [], B: [] }}
        players={samplePlayers}
        onStartNextRound={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="tab-remaining-hands"');
    expect(html).toContain('Remaining Hands');
    expect(html).toContain('data-testid="tab-round-breakdown"');
    expect(html).toContain('data-testid="tab-match-awards"');
  });

  it('renders player hand cards and deadwood points when initialTab is HANDS', () => {
    const html = renderToString(
      <RoundSummaryModal
        isOpen={true}
        initialTab="HANDS"
        round={2}
        roundScores={{ A: 200, B: 150 }}
        totalScores={{ A: 300, B: 200 }}
        melds={{ A: [], B: [] }}
        players={samplePlayers}
        onStartNextRound={vi.fn()}
      />
    );

    // Remaining hands view is displayed
    expect(html).toContain('data-testid="remaining-hands-view"');
    expect(html).toContain('Cards held by players when Round 2 concluded');

    // Both team sections exist
    expect(html).toContain('data-testid="team-a-remaining-hands"');
    expect(html).toContain('data-testid="team-b-remaining-hands"');

    // Alice has 2 cards and 25 pts
    expect(html).toContain('data-testid="player-hand-p1"');
    expect(html).toContain('Alice');
    expect(html).toContain('2 cards');
    expect(html).toContain('25 pts');

    // Bob has 1 card and 20 pts
    expect(html).toContain('data-testid="player-hand-p2"');
    expect(html).toContain('Bob');
    expect(html).toContain('1 card');
    expect(html).toContain('20 pts');

    // Charlie has 0 cards (cleared hand)
    expect(html).toContain('data-testid="player-hand-p3"');
    expect(html).toContain('Charlie');
    expect(html).toContain('Hand Cleared (0 cards)');

    // Diana has 0 cards (cleared hand)
    expect(html).toContain('data-testid="player-hand-p4"');
    expect(html).toContain('Diana');
    expect(html).toContain('Hand Cleared (0 cards)');
  });
});
