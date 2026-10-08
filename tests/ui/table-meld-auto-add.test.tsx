import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TableMeldBoard } from '../../src/ui/components/TableMeldBoard';
import { App } from '../../src/App';
import { Card, Meld } from '../../src/engine/types';

function makeCard(id: string, suit: Card['suit'], rank: Card['rank'], isNaturalJoker = false): Card {
  return {
    id,
    suit,
    rank,
    isNaturalJoker,
    isJoker: isNaturalJoker || rank === 2,
  };
}

describe('Table Sequences - Yellow Highlight & Auto-Add Visual Indicators', () => {
  const spade7 = makeCard('s7', 'SPADES', 7);
  const spade8 = makeCard('s8', 'SPADES', 8);
  const spade9 = makeCard('s9', 'SPADES', 9);
  const spade10 = makeCard('s10', 'SPADES', 10);
  const spadeJ = makeCard('sj', 'SPADES', 11);

  const teamARunMeld: Meld = {
    id: 'meld-A-run',
    team: 'A',
    type: 'RUN',
    suit: 'SPADES',
    cards: [spade7, spade8, spade9],
    slots: [
      { card: spade7, representedRank: 7, representedSuit: 'SPADES', isWildcard: false },
      { card: spade8, representedRank: 8, representedSuit: 'SPADES', isWildcard: false },
      { card: spade9, representedRank: 9, representedSuit: 'SPADES', isWildcard: false },
    ],
  };

  const heart8 = makeCard('h8', 'HEARTS', 8);
  const diamond8 = makeCard('d8', 'DIAMONDS', 8);
  const club8 = makeCard('c8', 'CLUBS', 8);

  const teamASetMeld: Meld = {
    id: 'meld-A-set',
    team: 'A',
    type: 'SET',
    rank: 8,
    cards: [spade8, heart8, diamond8],
    slots: [
      { card: spade8, representedRank: 8, representedSuit: 'SPADES' },
      { card: heart8, representedRank: 8, representedSuit: 'HEARTS' },
      { card: diamond8, representedRank: 8, representedSuit: 'DIAMONDS' },
    ],
  };

  const teamBRunMeld: Meld = {
    id: 'meld-B-run',
    team: 'B',
    type: 'RUN',
    suit: 'SPADES',
    cards: [spade7, spade8, spade9],
    slots: [
      { card: spade7, representedRank: 7, representedSuit: 'SPADES', isWildcard: false },
      { card: spade8, representedRank: 8, representedSuit: 'SPADES', isWildcard: false },
      { card: spade9, representedRank: 9, representedSuit: 'SPADES', isWildcard: false },
    ],
  };

  it('highlights active team sequence in yellow when 1 card can legally be added', () => {
    const html = renderToString(
      <TableMeldBoard
        melds={{
          A: [teamARunMeld],
          B: [],
        }}
        activeTeam="A"
        canAdd={true}
        selectedCards={[spade10]}
      />
    );

    // Sequence container has yellow highlight attributes and styles
    expect(html).toContain('data-highlight-yellow="true"');
    expect(html).toContain('data-can-add="true"');
    expect(html).toContain('border-yellow-400');
    expect(html).toContain('ring-yellow-400/70');

    // Auto-add banner prompt
    expect(html).toContain('data-testid="auto-add-prompt-meld-A-run"');
    expect(html).toContain('Click sequence to add (1 card)');
    expect(html).toContain('Click to Auto-Add');
  });

  it('highlights active team sequence in yellow when multiple cards can legally be added', () => {
    const html = renderToString(
      <TableMeldBoard
        melds={{
          A: [teamARunMeld],
          B: [],
        }}
        activeTeam="A"
        canAdd={true}
        selectedCards={[spade10, spadeJ]}
      />
    );

    expect(html).toContain('data-highlight-yellow="true"');
    expect(html).toContain('Click sequence to add (2 cards)');
    expect(html).toContain('Click to Auto-Add');
  });

  it('highlights SET sequence in yellow when matching rank card is selected', () => {
    const html = renderToString(
      <TableMeldBoard
        melds={{
          A: [teamASetMeld],
          B: [],
        }}
        activeTeam="A"
        canAdd={true}
        selectedCards={[club8]}
      />
    );

    expect(html).toContain('data-highlight-yellow="true"');
    expect(html).toContain('data-testid="auto-add-prompt-meld-A-set"');
    expect(html).toContain('Click to Auto-Add');
  });

  it('does NOT highlight active team sequence when selected card cannot legally be added', () => {
    const heartKing = makeCard('hk', 'HEARTS', 13);

    const html = renderToString(
      <TableMeldBoard
        melds={{
          A: [teamARunMeld],
          B: [],
        }}
        activeTeam="A"
        canAdd={true}
        selectedCards={[heartKing]}
      />
    );

    expect(html).not.toContain('data-highlight-yellow="true"');
    expect(html).not.toContain('data-can-add="true"');
    expect(html).not.toContain('Click to Auto-Add');
  });

  it('does NOT highlight OPPONENT sequences even if selected cards would legally match them', () => {
    const html = renderToString(
      <TableMeldBoard
        melds={{
          A: [],
          B: [teamBRunMeld],
        }}
        activeTeam="A" // Active team is A, but meld belongs to B!
        canAdd={true}
        selectedCards={[spade10]}
      />
    );

    expect(html).not.toContain('data-highlight-yellow="true"');
    expect(html).not.toContain('data-can-add="true"');
    expect(html).not.toContain('Click to Auto-Add');
  });

  it('does NOT highlight sequences when canAdd is false (e.g. in DRAW or DISCARD phase)', () => {
    const html = renderToString(
      <TableMeldBoard
        melds={{
          A: [teamARunMeld],
          B: [],
        }}
        activeTeam="A"
        canAdd={false} // Turn not in MELD phase or player is not active
        selectedCards={[spade10]}
      />
    );

    expect(html).not.toContain('data-highlight-yellow="true"');
    expect(html).not.toContain('data-can-add="true"');
    expect(html).not.toContain('Click to Auto-Add');
  });

  it('does NOT highlight sequences when no cards are selected', () => {
    const html = renderToString(
      <TableMeldBoard
        melds={{
          A: [teamARunMeld],
          B: [],
        }}
        activeTeam="A"
        canAdd={true}
        selectedCards={[]}
      />
    );

    expect(html).not.toContain('data-highlight-yellow="true"');
    expect(html).not.toContain('data-can-add="true"');
  });

  it('highlights sequence with Joker pickup indicator when contributing natural replacement for Joker', () => {
    const jokerCard = makeCard('joker', null, 0, true);
    const spade4 = makeCard('s4', 'SPADES', 4);
    const spade5 = makeCard('s5', 'SPADES', 5);
    const spade6 = makeCard('s6', 'SPADES', 6);

    const meldWithJoker: Meld = {
      id: 'meld-joker-run',
      team: 'A',
      type: 'RUN',
      suit: 'SPADES',
      cards: [spade4, jokerCard, spade6],
      slots: [
        { card: spade4, representedRank: 4, representedSuit: 'SPADES', isWildcard: false },
        { card: jokerCard, representedRank: 5, representedSuit: 'SPADES', isWildcard: true },
        { card: spade6, representedRank: 6, representedSuit: 'SPADES', isWildcard: false },
      ],
    };

    const html = renderToString(
      <TableMeldBoard
        melds={{
          A: [meldWithJoker],
          B: [],
        }}
        activeTeam="A"
        canAdd={true}
        selectedCards={[spade5]}
      />
    );

    expect(html).toContain('data-highlight-yellow="true"');
    expect(html).toContain('🃏 Picks up Joker!');
    expect(html).toContain('Click to Auto-Add');
  });

  it('supports effectiveSelectedCards resolved from selectedCardIds and allHandCards', () => {
    const html = renderToString(
      <TableMeldBoard
        melds={{
          A: [teamARunMeld],
          B: [],
        }}
        activeTeam="A"
        canAdd={true}
        selectedCardIds={['s10']}
        allHandCards={[spade10, heart8]}
      />
    );

    expect(html).toContain('data-highlight-yellow="true"');
    expect(html).toContain('Click sequence to add (1 card)');
    expect(html).toContain('Click to Auto-Add');
  });

  it('renders Zoom button alongside auto-add prompt without conflict', () => {
    const html = renderToString(
      <TableMeldBoard
        melds={{
          A: [teamARunMeld],
          B: [],
        }}
        activeTeam="A"
        canAdd={true}
        selectedCards={[spade10]}
        onZoomMeld={() => {}}
      />
    );

    expect(html).toContain('data-testid="btn-zoom-meld-meld-A-run"');
    expect(html).toContain('data-highlight-yellow="true"');
  });

  it('renders App cleanly with TableMeldBoard receiving hand selections', () => {
    const html = renderToString(<App />);
    expect(html).toContain('data-testid="pukar-app"');
    expect(html).toContain('Table Sequences');
  });
});
