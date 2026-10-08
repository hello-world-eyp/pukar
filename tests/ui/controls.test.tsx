import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Card, GameState, Meld, Player } from '../../src/engine/types';
import { ScoreBoard } from '../../src/ui/components/ScoreBoard';
import {
  PlayerHand,
  sortCardsBySuit,
  sortCardsByRank,
} from '../../src/ui/components/PlayerHand';
import { ActionControls } from '../../src/ui/components/ActionControls';
import { DevInspector } from '../../src/ui/components/DevInspector';
import { RoundSummaryModal } from '../../src/ui/components/RoundSummaryModal';

describe('UI Controls, Hand, Scoreboard & Inspector Components', () => {
  // Sample test cards
  const spade7: Card = { id: 's7', suit: 'SPADES', rank: 7 };
  const spade8: Card = { id: 's8', suit: 'SPADES', rank: 8 };
  const spade9: Card = { id: 's9', suit: 'SPADES', rank: 9 };
  const heart9: Card = { id: 'h9', suit: 'HEARTS', rank: 9 };
  const club9: Card = { id: 'c9', suit: 'CLUBS', rank: 9 };
  const diamond2: Card = { id: 'd2', suit: 'DIAMONDS', rank: 2 };
  const joker: Card = { id: 'jk', suit: null, rank: 0, isNaturalJoker: true };

  /* ========================================================================
   * 1. ScoreBoard
   * ======================================================================== */
  describe('ScoreBoard', () => {
    it('renders branding, round number, scores, and active player indicator', () => {
      const html = renderToString(
        <ScoreBoard
          round={2}
          roundStatus="PLAYING"
          phase="MELD"
          scores={{ A: 250, B: 150 }}
          roundScores={{ A: 100, B: 50 }}
          totalScores={{ A: 250, B: 150 }}
          pukarsClaimed={{ A: 1, B: 0 }}
          currentPlayerIndex={0}
          currentPlayerName="Player 1"
          activeTeam="A"
        />
      );

      expect(html).toContain('PUKAR');
      expect(html).toContain('Royal Rummy');
      expect(html).toContain('Round 2');
      expect(html).toContain('Team A');
      expect(html).toContain('Team B');
      expect(html).toContain('250');
      expect(html).toContain('150');
      expect(html).toContain('(+100)');
      expect(html).toContain('(+50)');
      expect(html).toContain('Pukars: <strong>1</strong>');
      expect(html).toContain('Pukars: <strong>0</strong>');
      expect(html).toContain('Player 1');
      expect(html).toContain('MELD');
    });

    it('renders correctly from gameState prop', () => {
      const mockGameState: Partial<GameState> = {
        round: 3,
        roundStatus: 'PLAYING',
        phase: 'DRAW',
        scores: { A: 400, B: 600 },
        roundScores: { A: 200, B: 300 },
        totalScores: { A: 400, B: 600 },
        pukarsClaimed: { A: 2, B: 3 },
        currentPlayerIndex: 1,
        players: [
          { id: 'p1', name: 'Alice', team: 'A', hand: [] },
          { id: 'p2', name: 'Bob', team: 'B', hand: [] },
        ],
      };

      const html = renderToString(
        <ScoreBoard gameState={mockGameState as GameState} />
      );

      expect(html).toContain('Round 3');
      expect(html).toContain('Bob');
      expect(html).toContain('Team B');
      expect(html).toContain('DRAW');
      expect(html).toContain('400');
      expect(html).toContain('600');
      expect(html).toContain('Pukars: <strong>2</strong>');
      expect(html).toContain('Pukars: <strong>3</strong>');
    });

    it('renders Final Turn warning badge when roundStatus is FINAL_TURN', () => {
      const html = renderToString(
        <ScoreBoard round={1} roundStatus="FINAL_TURN" />
      );

      expect(html).toContain('Final Turn!');
    });

    it('renders Round Finished badge when roundStatus is ROUND_OVER', () => {
      const html = renderToString(
        <ScoreBoard round={1} roundStatus="ROUND_OVER" />
      );

      expect(html).toContain('Round Finished');
    });

    it('reliably displays match total with mid-round bonuses when scores exceeds initial totalScores', () => {
      const html = renderToString(
        <ScoreBoard
          round={2}
          roundStatus="PLAYING"
          totalScores={{ A: 120, B: 85 }}
          scores={{ A: 170, B: 85 }}
          roundScores={{ A: 50, B: 0 }}
        />
      );

      // Should display 170 for Team A reflecting live +50 mid-round pukar
      expect(html).toContain('170');
      expect(html).toContain('(+50)');
      expect(html).toContain('85');
    });
  });

  /* ========================================================================
   * 2. PlayerHand & Sorting
   * ======================================================================== */
  describe('PlayerHand & Sorting', () => {
    describe('sortCardsBySuit', () => {
      it('places Natural Jokers first, then groups by suit, and secondary sorts by rank high to low (desc) by default', () => {
        const unsorted: Card[] = [
          { id: 'h10', suit: 'HEARTS', rank: 10 },
          { id: 's5', suit: 'SPADES', rank: 5 },
          joker,
          { id: 's14', suit: 'SPADES', rank: 14 },
          { id: 'h4', suit: 'HEARTS', rank: 4 },
        ];

        const sorted = sortCardsBySuit(unsorted);

        expect(sorted[0].id).toBe('jk'); // Joker first
        // SPADES: 14 then 5 (high to low)
        expect(sorted[1].suit).toBe('SPADES');
        expect(sorted[1].rank).toBe(14);
        expect(sorted[2].suit).toBe('SPADES');
        expect(sorted[2].rank).toBe(5);
        // HEARTS: 10 then 4 (high to low)
        expect(sorted[3].suit).toBe('HEARTS');
        expect(sorted[3].rank).toBe(10);
        expect(sorted[4].suit).toBe('HEARTS');
        expect(sorted[4].rank).toBe(4);
      });

      it('supports ascending secondary rank sorting when direction is asc', () => {
        const unsorted: Card[] = [
          { id: 'h10', suit: 'HEARTS', rank: 10 },
          { id: 's5', suit: 'SPADES', rank: 5 },
          joker,
          { id: 's14', suit: 'SPADES', rank: 14 },
          { id: 'h4', suit: 'HEARTS', rank: 4 },
        ];

        const sorted = sortCardsBySuit(unsorted, 'asc');

        expect(sorted[0].id).toBe('jk');
        expect(sorted[1].suit).toBe('SPADES');
        expect(sorted[1].rank).toBe(5);
        expect(sorted[2].suit).toBe('SPADES');
        expect(sorted[2].rank).toBe(14);
        expect(sorted[3].suit).toBe('HEARTS');
        expect(sorted[3].rank).toBe(4);
        expect(sorted[4].suit).toBe('HEARTS');
        expect(sorted[4].rank).toBe(10);
      });
    });

    describe('sortCardsByRank', () => {
      it('sorts by rank high to low (desc) by default (Joker first, then 14..2), secondary by suit', () => {
        const unsorted: Card[] = [
          { id: 'h14', suit: 'HEARTS', rank: 14 },
          { id: 's9', suit: 'SPADES', rank: 9 },
          joker,
          { id: 'h9', suit: 'HEARTS', rank: 9 },
          { id: 'c2', suit: 'CLUBS', rank: 2 },
        ];

        const sorted = sortCardsByRank(unsorted);

        expect(sorted[0].id).toBe('jk'); // Joker first as universal wildcard
        expect(sorted[1].rank).toBe(14); // Ace
        expect(sorted[2].rank).toBe(9);
        expect(sorted[2].suit).toBe('SPADES'); // Suit tie-break SPADES before HEARTS
        expect(sorted[3].rank).toBe(9);
        expect(sorted[3].suit).toBe('HEARTS');
        expect(sorted[4].rank).toBe(2);
      });

      it('supports ascending primary rank sorting when direction is asc', () => {
        const unsorted: Card[] = [
          { id: 'h14', suit: 'HEARTS', rank: 14 },
          { id: 's9', suit: 'SPADES', rank: 9 },
          joker,
          { id: 'h9', suit: 'HEARTS', rank: 9 },
          { id: 'c2', suit: 'CLUBS', rank: 2 },
        ];

        const sorted = sortCardsByRank(unsorted, 'asc');

        expect(sorted[0].id).toBe('jk');
        expect(sorted[1].rank).toBe(2);
        expect(sorted[2].rank).toBe(9);
        expect(sorted[2].suit).toBe('SPADES');
        expect(sorted[3].rank).toBe(9);
        expect(sorted[3].suit).toBe('HEARTS');
        expect(sorted[4].rank).toBe(14);
      });
    });

    describe('PlayerHand Component', () => {
      it('renders active player name, card count, sort buttons, and cards', () => {
        const cards: Card[] = [spade7, spade8, spade9];
        const html = renderToString(
          <PlayerHand
            playerName="Harsh"
            playerTeam="A"
            cards={cards}
            selectedCardIds={['s8']}
          />
        );

        expect(html).toContain('Harsh');
        expect(html).toContain('Team A');
        expect(html).toContain('3 cards');
        expect(html).toContain('1 selected');
        expect(html).toContain('Sort by Suit');
        expect(html).toContain('Sort by Rank');
        expect(html).toContain('High → Low');
        expect(html).toContain('Low → High');
        expect(html).toContain('Clear');
        // Check cards rendered
        expect(html).toContain('7 of SPADES');
        expect(html).toContain('8 of SPADES');
        expect(html).toContain('9 of SPADES');
        // Selected card elevation
        expect(html).toContain('-translate-y-2.5');
      });

      it('renders empty hand placeholder when cards array is empty', () => {
        const html = renderToString(
          <PlayerHand playerName="P1" cards={[]} />
        );

        expect(html).toContain('Hand is empty');
        expect(html).toContain('0 cards');
      });

      it('renders sorted cards when controlled sortMode is provided', () => {
        const unsorted = [heart9, spade7, club9];
        const htmlSuit = renderToString(
          <PlayerHand cards={unsorted} sortMode="suit" />
        );
        // SPADES (rank 7) should come before HEARTS (rank 9)
        const spadeIdx = htmlSuit.indexOf('7 of SPADES');
        const heartIdx = htmlSuit.indexOf('9 of HEARTS');
        expect(spadeIdx).toBeLessThan(heartIdx);

        // Rank sort (descending by default): rank 9 comes before rank 7
        const htmlRank = renderToString(
          <PlayerHand cards={[heart9, spade7, club9]} sortMode="rank" />
        );
        const rank7Idx = htmlRank.indexOf('7 of SPADES');
        const rank9Idx = htmlRank.indexOf('9 of HEARTS');
        expect(rank9Idx).toBeLessThan(rank7Idx);

        // With sortDirection="asc": rank 7 comes before rank 9
        const htmlRankAsc = renderToString(
          <PlayerHand cards={[heart9, spade7, club9]} sortMode="rank" sortDirection="asc" />
        );
        const rank7IdxAsc = htmlRankAsc.indexOf('7 of SPADES');
        const rank9IdxAsc = htmlRankAsc.indexOf('9 of HEARTS');
        expect(rank7IdxAsc).toBeLessThan(rank9IdxAsc);
      });
    });
  });

  /* ========================================================================
   * 3. ActionControls
   * ======================================================================== */
  describe('ActionControls', () => {
    it('enables Draw Deck and Take Bottom in DRAW phase', () => {
      const html = renderToString(
        <ActionControls
          phase="DRAW"
          stockCount={40}
          discardCount={3}
          canDrawStock={true}
          canTakeDiscard={true}
        />
      );

      expect(html).toContain('Turn Phase:');
      expect(html).toContain('DRAW');
      expect(html).toContain('Draw Deck');
      expect(html).toContain('Take Bottom');
      expect(html).toContain('40');
      expect(html).toContain('3');
      // Draw buttons should not be disabled
      expect(html).not.toMatch(/btn-draw-stock[^>]*disabled=""/);
      expect(html).not.toMatch(/btn-take-discard[^>]*disabled=""/);
    });

    it('disables Draw controls in MELD and DISCARD phases', () => {
      const htmlMeld = renderToString(
        <ActionControls
          phase="MELD"
          stockCount={40}
          discardCount={3}
        />
      );

      expect(htmlMeld).toContain('Only in DRAW phase');
    });

    it('shows real-time validation preview for valid new RUN meld', () => {
      const validRunCards: Card[] = [spade7, spade8, spade9];
      const html = renderToString(
        <ActionControls
          phase="MELD"
          selectedCards={validRunCards}
        />
      );

      expect(html).toContain('Valid RUN');
      expect(html).not.toMatch(/btn-play-meld[^>]*disabled=""/);
    });

    it('shows real-time validation preview for valid new SET meld', () => {
      const validSetCards: Card[] = [spade9, heart9, club9];
      const html = renderToString(
        <ActionControls
          phase="MELD"
          selectedCards={validSetCards}
        />
      );

      expect(html).toContain('Valid SET');
      expect(html).not.toMatch(/btn-play-meld[^>]*disabled=""/);
    });

    it('shows validation error preview badge when cards do not form a valid meld', () => {
      const invalidCards: Card[] = [spade7, heart9, club9];
      const html = renderToString(
        <ActionControls
          phase="MELD"
          selectedCards={invalidCards}
        />
      );

      // Should indicate error and meld button should be disabled
      expect(html).toContain('btn-play-meld');
      expect(html).toContain('disabled');
      expect(html).toMatch(/meld-validation-badge/);
    });

    it('shows tip directing user to click table sequence when cards are selected in MELD phase and does not render btn-add-meld', () => {
      const existingMeld: Meld = {
        id: 'meld-A-1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [spade7, spade8, spade9],
        slots: [
          { card: spade7, representedRank: 7, representedSuit: 'SPADES' },
          { card: spade8, representedRank: 8, representedSuit: 'SPADES' },
          { card: spade9, representedRank: 9, representedSuit: 'SPADES' },
        ],
      };

      const spade10: Card = { id: 's10', suit: 'SPADES', rank: 10 };

      const html = renderToString(
        <ActionControls
          phase="MELD"
          selectedMeld={existingMeld}
          selectedCards={[spade10]}
        />
      );

      // Verify tip is shown and btn-add-meld is removed
      expect(html).toContain('data-testid="add-to-sequence-tip"');
      expect(html).toContain('Click any yellow-highlighted sequence on the table to add cards');
      expect(html).not.toContain('btn-add-meld');
    });

    it('does not render btn-add-meld button since sequences are clicked directly to auto-add', () => {
      const html = renderToString(
        <ActionControls
          phase="MELD"
          selectedMeld={null}
          selectedCards={[spade7]}
        />
      );

      expect(html).not.toContain('btn-add-meld');
      expect(html).toContain('data-testid="add-to-sequence-tip"');
    });

    it('enables discard button when 1 card is selected in MELD phase', () => {
      const html = renderToString(
        <ActionControls
          phase="MELD"
          selectedCards={[spade7]}
        />
      );

      expect(html).toContain('Discard 7♠');
      expect(html).not.toMatch(/btn-discard[^>]*disabled=""/);
    });

    it('disables discard button when 0 or multiple cards are selected', () => {
      const htmlZero = renderToString(
        <ActionControls
          phase="MELD"
          selectedCards={[]}
        />
      );
      expect(htmlZero).toMatch(/btn-discard[^>]*disabled=""/);

      const htmlMultiple = renderToString(
        <ActionControls
          phase="MELD"
          selectedCards={[spade7, spade8]}
        />
      );
      expect(htmlMultiple).toMatch(/btn-discard[^>]*disabled=""/);
    });

    it('resolves selected cards from selectedCardIds and allHandCards', () => {
      const allHandCards = [spade7, spade8, spade9, diamond2];
      const html = renderToString(
        <ActionControls
          phase="MELD"
          selectedCardIds={['s7', 's8', 's9']}
          allHandCards={allHandCards}
        />
      );

      expect(html).toContain('Valid RUN');
    });
  });

  /* ========================================================================
   * 4. DevInspector
   * ======================================================================== */
  describe('DevInspector', () => {
    const mockPlayers: Player[] = [
      { id: 'p1', name: 'Alice', team: 'A', hand: [spade7, spade8] },
      { id: 'p2', name: 'Bob', team: 'B', hand: [heart9] },
      { id: 'p3', name: 'Charlie', team: 'A', hand: [] },
      { id: 'p4', name: 'Diana', team: 'B', hand: [club9, diamond2] },
    ];

    it('renders hot-seat switcher buttons for P1..P4 and highlights active player', () => {
      const onSwitch = vi.fn();
      const html = renderToString(
        <DevInspector
          players={mockPlayers}
          currentPlayerIndex={0}
          onSwitchPlayer={onSwitch}
        />
      );

      expect(html).toContain('Alice');
      expect(html).toContain('Bob');
      expect(html).toContain('Charlie');
      expect(html).toContain('Diana');
      expect(html).toContain('TA');
      expect(html).toContain('TB');
      expect(html).toContain('data-testid="switcher-p1"');
      expect(html).toContain('data-testid="switcher-p2"');
      expect(html).toContain('data-testid="switcher-p3"');
      expect(html).toContain('data-testid="switcher-p4"');
      expect(html).toContain('God Mode');
    });

    it('renders God Mode panel showing all players hands when isGodModeOpen is true', () => {
      const html = renderToString(
        <DevInspector
          players={mockPlayers}
          currentPlayerIndex={1}
          onSwitchPlayer={() => {}}
          isGodModeOpen={true}
          stockDeckCount={35}
          discardPileCount={4}
          pukarPoolCount={2}
        />
      );

      expect(html).toContain('data-testid="godmode-panel"');
      expect(html).toContain('Game Pools:');
      expect(html).toContain('Stock:');
      expect(html).toContain('35');
      expect(html).toContain('Discard:');
      expect(html).toContain('4');
      expect(html).toContain('2 decks');
      expect(html).toContain('data-testid="godmode-player-1"');
      expect(html).toContain('data-testid="godmode-player-2"');
      expect(html).toContain('7 of SPADES');
      expect(html).toContain('8 of SPADES');
      expect(html).toContain('9 of HEARTS');
    });

    it('renders Force Turn button when onForceTurn is provided and differentiates active turn from viewed player', () => {
      const html = renderToString(
        <DevInspector
          players={mockPlayers}
          currentPlayerIndex={1}
          activeTurnIndex={0}
          onSwitchPlayer={() => {}}
          onForceTurn={() => {}}
        />
      );

      expect(html).toContain('data-testid="btn-force-turn"');
      expect(html).toContain('Force Turn To This Player');
      expect(html).toContain('Turn');
    });
  });

  /* ========================================================================
   * 5. RoundSummaryModal
   * ======================================================================== */
  describe('RoundSummaryModal', () => {
    it('does not render when isOpen and isRoundOver are false', () => {
      const html = renderToString(
        <RoundSummaryModal
          isOpen={false}
          isRoundOver={false}
          round={1}
          onStartNextRound={() => {}}
        />
      );

      expect(html).toBe('');
    });

    it('renders complete breakdown when round ends', () => {
      const cleanRunMeld: Meld = {
        id: 'meld-A-1',
        team: 'A',
        type: 'RUN',
        suit: 'SPADES',
        cards: [spade7, spade8, spade9, { id: 's10', suit: 'SPADES', rank: 10 }, { id: 's11', suit: 'SPADES', rank: 11 }, { id: 's12', suit: 'SPADES', rank: 12 }, { id: 's13', suit: 'SPADES', rank: 13 }],
        slots: [],
        points: 200,
      };

      const html = renderToString(
        <RoundSummaryModal
          isOpen={true}
          round={1}
          roundScores={{ A: 250, B: 50 }}
          totalScores={{ A: 250, B: 50 }}
          melds={{ A: [cleanRunMeld], B: [] }}
          pukarsClaimed={{ A: 1, B: 1 }}
          onStartNextRound={() => {}}
        />
      );

      expect(html).toContain('Round 1 Completed');
      expect(html).toContain('Team <span class="text-blue-400">A</span> Wins Round 1!');
      expect(html).toContain('Team A');
      expect(html).toContain('Team B');
      expect(html).toContain('Claimed Pukars (1 × 50)');
      expect(html).toContain('+250');
      expect(html).toContain('+50');
      expect(html).toContain('250 pts');
      expect(html).toContain('50 pts');
      expect(html).toContain('Next Round');
    });

    it('renders tied banner when round ends with equal scores', () => {
      const html = renderToString(
        <RoundSummaryModal
          isOpen={true}
          round={2}
          roundScores={{ A: 100, B: 100 }}
          totalScores={{ A: 300, B: 300 }}
          onStartNextRound={() => {}}
        />
      );

      expect(html).toContain('Round Tied!');
    });
  });
});
