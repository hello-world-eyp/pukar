import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { JokerPromptModal } from '../../src/ui/components/JokerPromptModal';
import { TableMeldBoard } from '../../src/ui/components/TableMeldBoard';
import { App } from '../../src/App';
import { Card, Meld } from '../../src/engine/types';

function makeCard(id: string, suit: any, rank: number, isNaturalJoker = false): Card {
  return {
    id,
    suit,
    rank: rank as any,
    isNaturalJoker,
    isJoker: isNaturalJoker || rank === 2,
  };
}

describe('JokerPromptModal & UI Integration for Normal Joker', () => {
  const sampleOptions = [
    { rank: 3, suit: 'SPADES' as const, label: '3 of Spades' },
    { rank: 6, suit: 'SPADES' as const, label: '6 of Spades' },
  ];

  it('renders nothing when isOpen is false', () => {
    const html = renderToString(
      <JokerPromptModal
        isOpen={false}
        options={sampleOptions}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('renders nothing when options list is empty', () => {
    const html = renderToString(
      <JokerPromptModal
        isOpen={true}
        options={[]}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('renders all candidate options when isOpen is true', () => {
    const html = renderToString(
      <JokerPromptModal
        isOpen={true}
        options={sampleOptions}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="joker-prompt-modal"');
    expect(html).toContain('Designate Joker Position');
    expect(html).toContain('data-testid="joker-option-3"');
    expect(html).toContain('data-testid="joker-option-6"');
    expect(html).toContain('3 of Spades');
    expect(html).toContain('6 of Spades');
    expect(html).toContain('Plays as 3 of spades');
    expect(html).toContain('Plays as 6 of spades');
    expect(html).toContain('Cancel');
  });

  it('renders positionLabel badges when options specify lowest and highest positions', () => {
    const positionedOptions = [
      { rank: 3, suit: 'SPADES' as const, label: '3 of Spades', positionLabel: 'Lowest Card in Sequence' as const },
      { rank: 6, suit: 'SPADES' as const, label: '6 of Spades', positionLabel: 'Highest Card in Sequence' as const },
    ];
    const html = renderToString(
      <JokerPromptModal
        isOpen={true}
        options={positionedOptions}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="badge-lowest-card"');
    expect(html).toContain('Lowest Card in Sequence');
    expect(html).toContain('data-testid="badge-highest-card"');
    expect(html).toContain('Highest Card in Sequence');
  });

  it('displays "🃏 Picks up Joker!" badge on sequence item when adding natural replacement', () => {
    const card4 = makeCard('c4s', 'SPADES', 4);
    const joker = makeCard('joker', null, 0, true);
    const card6 = makeCard('c6s', 'SPADES', 6);

    const meld: Meld = {
      id: 'meld-1',
      team: 'A',
      type: 'RUN',
      suit: 'SPADES',
      cards: [card4, joker, card6],
      slots: [
        { card: card4, representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
        { card: joker, representedRank: 5, representedSuit: 'SPADES', isWildcard: true },
        { card: card6, representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
      ],
    };

    const card5 = makeCard('c5s', 'SPADES', 5);

    const html = renderToString(
      <TableMeldBoard
        melds={{
          A: [meld],
          B: [],
        }}
        activeTeam="A"
        canAdd={true}
        selectedCards={[card5]}
      />
    );

    expect(html).toContain('data-highlight-yellow="true"');
    expect(html).toContain('Picks up Joker!');
    expect(html).toContain('Click to Auto-Add');
  });

  it('does NOT display "Picks up Joker!" badge when adding a regular card that does not replace Joker', () => {
    const card4 = makeCard('c4s', 'SPADES', 4);
    const joker = makeCard('joker', null, 0, true);
    const card6 = makeCard('c6s', 'SPADES', 6);

    const meld: Meld = {
      id: 'meld-1',
      team: 'A',
      type: 'RUN',
      suit: 'SPADES',
      cards: [card4, joker, card6],
      slots: [
        { card: card4, representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
        { card: joker, representedRank: 5, representedSuit: 'SPADES', isWildcard: true },
        { card: card6, representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
      ],
    };

    // Adding 7♠ extends run; Joker stays at 5♠ and is NOT picked up
    const card7 = makeCard('c7s', 'SPADES', 7);

    const html = renderToString(
      <TableMeldBoard
        melds={{
          A: [meld],
          B: [],
        }}
        activeTeam="A"
        canAdd={true}
        selectedCards={[card7]}
      />
    );

    expect(html).toContain('data-highlight-yellow="true"');
    expect(html).not.toContain('Picks up Joker!');
  });

  it('renders the complete App component cleanly with Joker modal wired', () => {
    const html = renderToString(<App />);
    expect(html).toContain('data-testid="pukar-app"');
    expect(html).toContain('PUKAR');
  });
});
