import React from 'react';
import { Player, SanitizedPlayer, Team } from '../../engine/types';
import { Shield, Sparkles, User, Layers } from 'lucide-react';

export type SeatPosition = 'left' | 'right' | 'top' | 'top-left' | 'top-right' | 'top-center' | 'bottom';

export interface RelativeSeatConfig {
  player: Player | SanitizedPlayer;
  playerIndex: number;
  seatPosition: SeatPosition;
  isTeammate: boolean;
  isTurn: boolean;
  isViewed: boolean;
}

export interface RelativeTableSeats {
  topSeats: RelativeSeatConfig[];
  leftSeat: RelativeSeatConfig;
  rightSeat: RelativeSeatConfig;
  bottomSeat: RelativeSeatConfig;
}

/**
 * Calculates clockwise seating positions around the table relative to the currently viewed player.
 * Viewed player is always placed at the bottom.
 * In 4-player: Right is next player, Top is partner/across, Left is previous player.
 * In 6-player: Right is next player, Left is previous player, Top contains the 3 players across.
 */
export function getRelativeTableSeats(
  players: Array<Player | SanitizedPlayer>,
  viewedIndex: number,
  activeTurnIndex: number
): RelativeTableSeats {
  try {
    const count = players.length;
    if (count === 0) {
      throw new Error('Players list cannot be empty');
    }

    const viewedPlayer = players[viewedIndex];
    const viewedTeam = viewedPlayer?.team ?? 'A';

    const createSeatConfig = (idx: number, pos: SeatPosition): RelativeSeatConfig => {
      const p = players[idx];
      return {
        player: p,
        playerIndex: idx,
        seatPosition: pos,
        isTeammate: p?.team === viewedTeam,
        isTurn: idx === activeTurnIndex,
        isViewed: idx === viewedIndex,
      };
    };

    const bottomSeat = createSeatConfig(viewedIndex, 'bottom');

    if (count <= 4) {
      const rightIdx = (viewedIndex + 1) % count;
      const topIdx = (viewedIndex + 2) % count;
      const leftIdx = (viewedIndex + 3) % count;

      return {
        bottomSeat,
        rightSeat: createSeatConfig(rightIdx, 'right'),
        topSeats: [createSeatConfig(topIdx, 'top')],
        leftSeat: createSeatConfig(leftIdx, 'left'),
      };
    } else {
      // 6-player table
      const rightIdx = (viewedIndex + 1) % count;
      const topSeatsIndices = [
        (viewedIndex + 4) % count,
        (viewedIndex + 3) % count,
        (viewedIndex + 2) % count,
      ];
      const leftIdx = (viewedIndex + 5) % count;

      return {
        bottomSeat,
        rightSeat: createSeatConfig(rightIdx, 'right'),
        topSeats: topSeatsIndices.map((idx, i) =>
          createSeatConfig(
            idx,
            i === 0 ? 'top-left' : i === 1 ? 'top-center' : 'top-right'
          )
        ),
        leftSeat: createSeatConfig(leftIdx, 'left'),
      };
    }
  } catch (err) {
    console.error('Error calculating relative table seats:', err);
    const fallbackPlayer = players[0] ?? { id: 'p1', name: 'Player 1', team: 'A', hand: [] };
    const fallbackConfig: RelativeSeatConfig = {
      player: fallbackPlayer,
      playerIndex: 0,
      seatPosition: 'bottom',
      isTeammate: true,
      isTurn: false,
      isViewed: true,
    };
    return {
      bottomSeat: fallbackConfig,
      leftSeat: fallbackConfig,
      rightSeat: fallbackConfig,
      topSeats: [fallbackConfig],
    };
  }
}

export interface PlayerSeatProps {
  player: Player | SanitizedPlayer;
  playerIndex: number;
  seatPosition: SeatPosition;
  isTurn: boolean;
  isViewed: boolean;
  isTeammate: boolean;
  onSelectPlayer?: (playerIndex: number) => void;
  className?: string;
  'data-testid'?: string;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  playerIndex,
  seatPosition,
  isTurn,
  isViewed,
  isTeammate,
  onSelectPlayer,
  className = '',
  'data-testid': testId,
}) => {
  const isTeamA = player.team === 'A';
  const cardCount =
    'hand' in player && Array.isArray(player.hand)
      ? player.hand.length
      : 'cardCount' in player && typeof player.cardCount === 'number'
      ? player.cardCount
      : 0;

  const teamBorder = isTeamA
    ? 'border-blue-500/60 bg-gradient-to-b from-blue-950/80 to-slate-900/90'
    : 'border-amber-500/60 bg-gradient-to-b from-amber-950/80 to-slate-900/90';

  const avatarBg = isTeamA
    ? 'bg-blue-600 text-white shadow-blue-900/50'
    : 'bg-amber-500 text-slate-950 shadow-amber-900/50';

  return (
    <div
      data-testid={testId}
      onClick={() => onSelectPlayer?.(playerIndex)}
      role={onSelectPlayer ? 'button' : undefined}
      tabIndex={onSelectPlayer ? 0 : undefined}
      className={`relative rounded-2xl border p-2.5 sm:p-3 shadow-xl backdrop-blur-md transition-all ${teamBorder} ${
        isTurn
          ? 'ring-2 ring-emerald-400 shadow-emerald-500/20 scale-[1.03]'
          : 'hover:border-slate-500'
      } ${onSelectPlayer ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Top Tag: Turn / Role */}
      <div className="flex items-center justify-between gap-1.5 mb-1.5 flex-wrap">
        <div className="flex items-center gap-1">
          <span
            className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider flex items-center gap-1 ${
              isTeammate
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {isTeammate ? (
              <>
                <Shield className="w-3 h-3" />
                <span>Teammate</span>
              </>
            ) : (
              <span>Opponent</span>
            )}
          </span>

          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              isTeamA
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}
          >
            {`Team ${player.team}`}
          </span>
        </div>

        {isTurn && (
          <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
            <span>Current Turn</span>
          </span>
        )}
      </div>

      {/* Main Seat Info */}
      <div className="flex items-center gap-2.5">
        {/* Avatar badge */}
        <div
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-md shrink-0 ${avatarBg}`}
        >
          {player.name ? player.name.charAt(0).toUpperCase() : `P${playerIndex + 1}`}
        </div>

        {/* Name and Card count */}
        <div className="min-w-0 flex-1">
          <div className="text-xs sm:text-sm font-extrabold text-white truncate flex items-center gap-1">
            <span className="truncate">{player.name || `Player ${playerIndex + 1}`}</span>
            {isViewed && (
              <span className="text-[9px] font-bold text-amber-400 px-1 bg-amber-950/60 rounded">
                (You)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-300">
            <div className="flex items-center gap-1 text-slate-400">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-slate-200">{`${cardCount} cards`}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface TableSeatingProps {
  players: Array<Player | SanitizedPlayer>;
  viewedPlayerIndex: number;
  activeTurnIndex: number;
  onSelectPlayer?: (playerIndex: number) => void;
  className?: string;
  children?: React.ReactNode;
}

export const TableSeating: React.FC<TableSeatingProps> = ({
  players,
  viewedPlayerIndex,
  activeTurnIndex,
  onSelectPlayer,
  className = '',
  children,
}) => {
  const seats = getRelativeTableSeats(players, viewedPlayerIndex, activeTurnIndex);

  return (
    <div className={`relative w-full flex flex-col items-center gap-4 ${className}`}>
      {/* 1. TOP / ACROSS SEATS (Teammate / Partners in Front) */}
      <div className="w-full flex items-center justify-center gap-4 z-10 px-4">
        {seats.topSeats.map((seatConfig, index) => (
          <div key={`seat-top-${seatConfig.playerIndex}`} className="max-w-xs w-full">
            <PlayerSeat
              player={seatConfig.player}
              playerIndex={seatConfig.playerIndex}
              seatPosition={seatConfig.seatPosition}
              isTurn={seatConfig.isTurn}
              isViewed={seatConfig.isViewed}
              isTeammate={seatConfig.isTeammate}
              onSelectPlayer={onSelectPlayer}
              data-testid={`table-seat-top-${index}`}
            />
          </div>
        ))}
      </div>

      {/* 2. MIDDLE TABLE SECTION: LEFT WING, TABLE FELT (CHILDREN), RIGHT WING */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Left Seat (Wing) */}
        <div className="lg:col-span-2 flex flex-col justify-center order-2 lg:order-1 px-2">
          <PlayerSeat
            player={seats.leftSeat.player}
            playerIndex={seats.leftSeat.playerIndex}
            seatPosition={seats.leftSeat.seatPosition}
            isTurn={seats.leftSeat.isTurn}
            isViewed={seats.leftSeat.isViewed}
            isTeammate={seats.leftSeat.isTeammate}
            onSelectPlayer={onSelectPlayer}
            data-testid="table-seat-left"
          />
        </div>

        {/* Center Canvas / Table Felt (Holds Center Table + Melds) */}
        <div className="lg:col-span-8 order-1 lg:order-2 w-full">
          {children}
        </div>

        {/* Right Seat (Wing) */}
        <div className="lg:col-span-2 flex flex-col justify-center order-3 px-2">
          <PlayerSeat
            player={seats.rightSeat.player}
            playerIndex={seats.rightSeat.playerIndex}
            seatPosition={seats.rightSeat.seatPosition}
            isTurn={seats.rightSeat.isTurn}
            isViewed={seats.rightSeat.isViewed}
            isTeammate={seats.rightSeat.isTeammate}
            onSelectPlayer={onSelectPlayer}
            data-testid="table-seat-right"
          />
        </div>
      </div>
    </div>
  );
};
