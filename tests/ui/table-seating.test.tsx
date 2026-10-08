import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Player } from '../../src/engine/types';
import { getRelativeTableSeats, TableSeating, PlayerSeat } from '../../src/ui/components/TableSeating';

describe('Table Seating & Relative Positioning', () => {
  const players4: Player[] = [
    { id: 'p1', name: 'Player 1', team: 'A', hand: new Array(13).fill({ id: 'c', suit: 'SPADES', rank: 7 }) },
    { id: 'p2', name: 'Player 2', team: 'B', hand: new Array(13).fill({ id: 'c', suit: 'HEARTS', rank: 8 }) },
    { id: 'p3', name: 'Player 3', team: 'A', hand: new Array(13).fill({ id: 'c', suit: 'CLUBS', rank: 9 }) },
    { id: 'p4', name: 'Player 4', team: 'B', hand: new Array(13).fill({ id: 'c', suit: 'DIAMONDS', rank: 10 }) },
  ];

  const players6: Player[] = [
    { id: 'p1', name: 'Player 1', team: 'A', hand: new Array(13).fill({ id: 'c', suit: 'SPADES', rank: 7 }) },
    { id: 'p2', name: 'Player 2', team: 'B', hand: new Array(13).fill({ id: 'c', suit: 'HEARTS', rank: 8 }) },
    { id: 'p3', name: 'Player 3', team: 'A', hand: new Array(13).fill({ id: 'c', suit: 'CLUBS', rank: 9 }) },
    { id: 'p4', name: 'Player 4', team: 'B', hand: new Array(13).fill({ id: 'c', suit: 'DIAMONDS', rank: 10 }) },
    { id: 'p5', name: 'Player 5', team: 'A', hand: new Array(13).fill({ id: 'c', suit: 'SPADES', rank: 4 }) },
    { id: 'p6', name: 'Player 6', team: 'B', hand: new Array(13).fill({ id: 'c', suit: 'HEARTS', rank: 5 }) },
  ];

  describe('getRelativeTableSeats', () => {
    it('correctly maps 4-player positions when viewing Player 1 (index 0)', () => {
      const seats = getRelativeTableSeats(players4, 0, 0);

      expect(seats.bottomSeat.player.name).toBe('Player 1');
      expect(seats.bottomSeat.isViewed).toBe(true);
      expect(seats.bottomSeat.isTurn).toBe(true);

      // Player 2 should be on the Right (clockwise next)
      expect(seats.rightSeat.player.name).toBe('Player 2');
      expect(seats.rightSeat.isTeammate).toBe(false);

      // Player 3 should be on the Top/Across (teammate)
      expect(seats.topSeats).toHaveLength(1);
      expect(seats.topSeats[0].player.name).toBe('Player 3');
      expect(seats.topSeats[0].isTeammate).toBe(true);

      // Player 4 should be on the Left (clockwise previous)
      expect(seats.leftSeat.player.name).toBe('Player 4');
      expect(seats.leftSeat.isTeammate).toBe(false);
    });

    it('correctly rotates positions when viewing Player 2 (index 1)', () => {
      const seats = getRelativeTableSeats(players4, 1, 0);

      expect(seats.bottomSeat.player.name).toBe('Player 2');
      expect(seats.rightSeat.player.name).toBe('Player 3');
      expect(seats.topSeats[0].player.name).toBe('Player 4');
      expect(seats.topSeats[0].isTeammate).toBe(true); // P4 is P2's teammate
      expect(seats.leftSeat.player.name).toBe('Player 1');
    });

    it('correctly maps 6-player positions with multiple top seats', () => {
      const seats = getRelativeTableSeats(players6, 0, 1);

      expect(seats.bottomSeat.player.name).toBe('Player 1');
      expect(seats.rightSeat.player.name).toBe('Player 2');
      expect(seats.rightSeat.isTurn).toBe(true); // Active turn on P2
      expect(seats.leftSeat.player.name).toBe('Player 6');

      // Top seats contains players 3, 4, 5
      expect(seats.topSeats).toHaveLength(3);
      expect(seats.topSeats[0].player.name).toBe('Player 5');
      expect(seats.topSeats[1].player.name).toBe('Player 4');
      expect(seats.topSeats[2].player.name).toBe('Player 3');
    });
  });

  describe('PlayerSeat & TableSeating Components', () => {
    it('renders player seat with avatar, team badge, card count, and turn indicator', () => {
      const html = renderToString(
        <PlayerSeat
          player={players4[1]}
          playerIndex={1}
          isTurn={true}
          isViewed={false}
          isTeammate={false}
          seatPosition="right"
        />
      );

      expect(html).toContain('Player 2');
      expect(html).toContain('Team B');
      expect(html).toContain('Opponent');
      expect(html).toContain('13 cards');
      expect(html).toContain('Current Turn');
    });

    it('renders partner badge when isTeammate is true', () => {
      const html = renderToString(
        <PlayerSeat
          player={players4[2]}
          playerIndex={2}
          isTurn={false}
          isViewed={false}
          isTeammate={true}
          seatPosition="top"
        />
      );

      expect(html).toContain('Player 3');
      expect(html).toContain('Teammate');
      expect(html).toContain('Team A');
    });

    it('renders complete TableSeating perimeter for 4 players', () => {
      const html = renderToString(
        <TableSeating
          players={players4}
          viewedPlayerIndex={0}
          activeTurnIndex={0}
        />
      );

      expect(html).toContain('data-testid="table-seat-top-0"');
      expect(html).toContain('data-testid="table-seat-left"');
      expect(html).toContain('data-testid="table-seat-right"');
      expect(html).toContain('Player 3');
      expect(html).toContain('Player 4');
      expect(html).toContain('Player 2');
    });
  });
});
