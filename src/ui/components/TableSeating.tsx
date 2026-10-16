import React from 'react';
import { Player, SanitizedPlayer } from '../../engine/types';
import { Shield, Layers, WifiOff } from 'lucide-react';

export type SeatPosition = 'left' | 'right' | 'top' | 'top-left' | 'top-right' | 'top-center' | 'bottom';

export interface RelativeSeatConfig {
  player: Player | SanitizedPlayer;
  playerIndex: number;
  seatPosition: SeatPosition;
  isTeammate: boolean;
  isTurn: boolean;
  isViewed: boolean;
  isConnected: boolean;
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
  activeTurnIndex: number,
  playerConnections?: Record<number, boolean> | boolean[]
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
      const isConnected =
        playerConnections !== undefined
          ? (Array.isArray(playerConnections)
              ? playerConnections[idx] !== false
              : (playerConnections as Record<number, boolean>)[idx] !== false)
          : (p as any)?.isConnected !== false;

      return {
        player: p,
        playerIndex: idx,
        seatPosition: pos,
        isTeammate: p?.team === viewedTeam,
        isTurn: idx === activeTurnIndex,
        isViewed: idx === viewedIndex,
        isConnected,
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
      isConnected: true,
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
  isConnected?: boolean;
  onSelectPlayer?: (playerIndex: number) => void;
  className?: string;
  'data-testid'?: string;
  isRippling?: boolean;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  playerIndex,
  seatPosition,
  isTurn,
  isViewed,
  isTeammate,
  isConnected,
  onSelectPlayer,
  className = '',
  'data-testid': testId,
  isRippling = false,
}) => {
  const isTeamA = player.team === 'A';
  const cardCount =
    'hand' in player && Array.isArray(player.hand)
      ? player.hand.length
      : 'cardCount' in player && typeof player.cardCount === 'number'
      ? player.cardCount
      : 0;

  const connected =
    isConnected !== undefined ? isConnected : (player as any)?.isConnected !== false;

  const rippleClass = isRippling ? 'animate-card-ripple' : '';

  // 1. TOP SEATS: Compact horizontal partner pill
  if (seatPosition === 'top' || seatPosition.startsWith('top')) {
    return (
      <div
        data-testid={testId}
        data-position={seatPosition}
        onClick={() => onSelectPlayer?.(playerIndex)}
        role={onSelectPlayer ? 'button' : undefined}
        tabIndex={onSelectPlayer ? 0 : undefined}
        className={`relative rounded-2xl border-2 px-3 py-1.5 shadow-md backdrop-blur-md transition-all bg-white/95 ${
          isTeamA ? 'border-sky-300' : 'border-amber-300'
        } ${rippleClass} ${
          isTurn
            ? 'ring-4 ring-emerald-500 shadow-emerald-500/20 scale-[1.02]'
            : 'hover:border-stone-400'
        } ${onSelectPlayer ? 'cursor-pointer' : ''} ${className}`}
      >
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-1.5 mb-1 flex-wrap">
          <div className="flex items-center gap-1">
            <span
              className={`text-xs font-black uppercase px-2 py-0.5 rounded tracking-wider flex items-center gap-1 ${
                isTeammate
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : 'bg-stone-100 text-stone-700 border border-stone-300'
              }`}
            >
              {isTeammate ? (
                <>
                  <Shield className="w-3 h-3 text-emerald-700" />
                  <span>Teammate</span>
                </>
              ) : (
                <span>Opponent</span>
              )}
            </span>

            <span
              className={`text-xs font-black px-1.5 py-0.5 rounded border ${
                isTeamA
                  ? 'bg-blue-100 text-blue-900 border-blue-300'
                  : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}
            >
              {`Team ${player.team}`}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {!connected && (
              <span
                data-testid={`seat-disconnect-badge-${playerIndex}`}
                className="text-xs font-black uppercase px-2 py-0.5 rounded bg-red-950/90 text-red-400 border border-red-600/60 flex items-center gap-1 shadow-sm animate-pulse"
                title="Player Disconnected"
              >
                <WifiOff className="w-3 h-3 text-red-400" />
                <span>Disconnected</span>
              </span>
            )}

            {isTurn && (
              <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-emerald-500 text-slate-950 flex items-center gap-1 shadow-sm animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                <span>Current Turn</span>
              </span>
            )}
          </div>
        </div>

        {/* Player Row: Avatar + Name + Card Count */}
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-md shrink-0 border-2 border-white ring-2 ${
                isTeamA
                  ? 'ring-sky-300 bg-gradient-to-br from-sky-500 to-blue-600 text-white'
                  : 'ring-amber-300 bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950'
              }`}
            >
              {player.name ? player.name.charAt(0).toUpperCase() : `P${playerIndex + 1}`}
            </div>
            {!connected && (
              <span
                data-testid={`avatar-disconnect-dot-${playerIndex}`}
                className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-red-600 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm"
                title="Disconnected"
              >
                !
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
            <div className="text-sm font-black text-stone-900 truncate flex items-center gap-1">
              <span className="truncate">{player.name || `Player ${playerIndex + 1}`}</span>
              {isViewed && (
                <span className="text-[11px] font-black text-amber-900 px-1 bg-amber-100 border border-amber-300 rounded">
                  (You)
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-sm font-extrabold text-stone-800 shrink-0">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>{`${cardCount} cards`}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. SIDE SEATS (Left / Right): Sleek Circular Avatar Capsules embedded on table rail
  return (
    <div
      data-testid={testId}
      data-position={seatPosition}
      onClick={() => onSelectPlayer?.(playerIndex)}
      role={onSelectPlayer ? 'button' : undefined}
      tabIndex={onSelectPlayer ? 0 : undefined}
      className={`relative rounded-2xl border-2 p-2 sm:p-2.5 shadow-md backdrop-blur-md transition-all bg-white/95 ${
        isTeamA ? 'border-sky-300' : 'border-amber-300'
      } ${rippleClass} ${
        isTurn
          ? 'ring-4 ring-emerald-500 shadow-emerald-500/20 scale-[1.03]'
          : 'hover:border-stone-400 hover:scale-[1.01]'
      } ${onSelectPlayer ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Top Tag: Role & Team */}
      <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
        <div className="flex items-center gap-1">
          <span
            className={`text-xs font-black uppercase px-1.5 py-0.5 rounded tracking-wider flex items-center gap-1 ${
              isTeammate
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-stone-100 text-stone-700 border border-stone-300'
            }`}
          >
            {isTeammate ? (
              <>
                <Shield className="w-3 h-3 text-emerald-700" />
                <span>Teammate</span>
              </>
            ) : (
              <span>Opponent</span>
            )}
          </span>

          <span
            className={`text-xs font-black px-1.5 py-0.5 rounded border ${
              isTeamA
                ? 'bg-blue-100 text-blue-900 border-blue-300'
                : 'bg-amber-100 text-amber-900 border-amber-300'
            }`}
          >
            {`Team ${player.team}`}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {!connected && (
            <span
              data-testid={`seat-disconnect-badge-${playerIndex}`}
              className="text-xs font-black uppercase px-1.5 py-0.5 rounded bg-red-950/90 text-red-400 border border-red-600/60 flex items-center gap-1 shadow-sm animate-pulse"
              title="Player Disconnected"
            >
              <WifiOff className="w-3 h-3 text-red-400" />
              <span>Disconnected</span>
            </span>
          )}

          {isTurn && (
            <span className="text-xs font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 flex items-center gap-1 shadow-sm animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
              <span>Current Turn</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Seat Info: Avatar Circle + Name + Large Bold Card Count */}
      <div className="flex items-center gap-2.5">
        {/* Avatar circle */}
        <div className="relative shrink-0">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-sm sm:text-base shadow-md shrink-0 border-2 border-white ring-2 sm:ring-4 ${
              isTeamA
                ? 'ring-sky-400 bg-gradient-to-br from-sky-500 to-blue-600 text-white'
                : 'ring-amber-400 bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950'
            }`}
          >
            {player.name ? player.name.charAt(0).toUpperCase() : `P${playerIndex + 1}`}
          </div>
          {!connected && (
            <span
              data-testid={`avatar-disconnect-dot-${playerIndex}`}
              className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-red-600 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm"
              title="Disconnected"
            >
              !
            </span>
          )}
        </div>

        {/* Name and Card count */}
        <div className="min-w-0 flex-1">
          <div className="text-sm sm:text-base font-black text-stone-900 truncate flex items-center gap-1">
            <span className="truncate">{player.name || `Player ${playerIndex + 1}`}</span>
            {isViewed && (
              <span className="text-[11px] font-black text-amber-900 px-1 bg-amber-100 border border-amber-300 rounded">
                (You)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-0.5 text-stone-700">
            <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-extrabold text-stone-900 text-sm sm:text-base tracking-tight">
              {`${cardCount} cards`}
            </span>
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
  playerConnections?: Record<number, boolean> | boolean[];
  onSelectPlayer?: (playerIndex: number) => void;
  className?: string;
  children?: React.ReactNode;
  isRippling?: boolean;
  hidePerimeterSeats?: boolean;
}

export const TableSeating: React.FC<TableSeatingProps> = ({
  players,
  viewedPlayerIndex,
  activeTurnIndex,
  playerConnections,
  onSelectPlayer,
  className = '',
  children,
  isRippling = false,
  hidePerimeterSeats = false,
}) => {
  if (hidePerimeterSeats) {
    return (
      <div className={`relative w-full flex flex-col items-center justify-start ${className}`}>
        <div className="w-full min-w-0">
          {children}
        </div>
      </div>
    );
  }

  const seats = getRelativeTableSeats(players, viewedPlayerIndex, activeTurnIndex, playerConnections);

  return (
    <div className={`relative w-full flex flex-col items-center gap-1.5 sm:gap-2 ${className}`}>
      {/* 1. TOP / ACROSS SEATS (Teammate / Partners in Front) */}
      <div className="w-full flex items-center justify-center gap-2 sm:gap-3 z-10 px-2 sm:px-4">
        {seats.topSeats.map((seatConfig, index) => (
          <div key={`seat-top-${seatConfig.playerIndex}`} className="max-w-xs sm:max-w-sm w-full">
            <PlayerSeat
              player={seatConfig.player}
              playerIndex={seatConfig.playerIndex}
              seatPosition={seatConfig.seatPosition}
              isTurn={seatConfig.isTurn}
              isViewed={seatConfig.isViewed}
              isTeammate={seatConfig.isTeammate}
              isConnected={seatConfig.isConnected}
              onSelectPlayer={onSelectPlayer}
              data-testid={`table-seat-top-${index}`}
              isRippling={isRippling}
            />
          </div>
        ))}
      </div>

      {/* 2. MIDDLE TABLE SECTION: LEFT OPPONENT WING, MAIN BOARD (FELT), RIGHT OPPONENT WING */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[13rem_1fr_13rem] xl:grid-cols-[15rem_1fr_15rem] 2xl:grid-cols-[16.5rem_1fr_16.5rem] gap-2.5 sm:gap-3.5 xl:gap-4 items-center">
        {/* Left Seat (Opponent on Left Wing) */}
        <div className="w-full order-2 lg:order-1 flex flex-col justify-center">
          <PlayerSeat
            player={seats.leftSeat.player}
            playerIndex={seats.leftSeat.playerIndex}
            seatPosition={seats.leftSeat.seatPosition}
            isTurn={seats.leftSeat.isTurn}
            isViewed={seats.leftSeat.isViewed}
            isTeammate={seats.leftSeat.isTeammate}
            isConnected={seats.leftSeat.isConnected}
            onSelectPlayer={onSelectPlayer}
            data-testid="table-seat-left"
            isRippling={isRippling}
          />
        </div>

        {/* Center Canvas / Table Felt (Holds Center Table + Melds) */}
        <div className="w-full sm:col-span-2 lg:col-span-1 min-w-0 order-1 lg:order-2">
          {children}
        </div>

        {/* Right Seat (Opponent on Right Wing) */}
        <div className="w-full order-3 flex flex-col justify-center">
          <PlayerSeat
            player={seats.rightSeat.player}
            playerIndex={seats.rightSeat.playerIndex}
            seatPosition={seats.rightSeat.seatPosition}
            isTurn={seats.rightSeat.isTurn}
            isViewed={seats.rightSeat.isViewed}
            isTeammate={seats.rightSeat.isTeammate}
            isConnected={seats.rightSeat.isConnected}
            onSelectPlayer={onSelectPlayer}
            data-testid="table-seat-right"
            isRippling={isRippling}
          />
        </div>
      </div>
    </div>
  );
};

