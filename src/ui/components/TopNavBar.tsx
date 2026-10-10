import React from 'react';
import { RotateCcw, Volume2, VolumeX, Home } from 'lucide-react';

export interface PlayerInfo {
  id: string;
  name: string;
  team: 'A' | 'B';
  cardCount?: number;
}

export interface TopNavBarProps {
  activeTab: 'table' | 'sequences' | 'scoreboard';
  onTabChange: (tab: 'table' | 'sequences' | 'scoreboard') => void;
  onOpenRules: () => void;
  players: PlayerInfo[];
  currentPlayerIndex: number;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onNewGame?: () => void;
  onExitToMenu?: () => void;
  gameTitle?: string;
  roomCode?: string | null;
}

// Distinctive vibrant avatar colors matching modern design
const AVATAR_PALETTE = [
  { bg: 'bg-cyan-200 text-cyan-950 ring-cyan-400' },
  { bg: 'bg-lime-200 text-lime-950 ring-lime-400' },
  { bg: 'bg-pink-300 text-pink-950 ring-pink-400' },
  { bg: 'bg-amber-300 text-amber-950 ring-amber-400' },
  { bg: 'bg-purple-300 text-purple-950 ring-purple-400' },
  { bg: 'bg-emerald-300 text-emerald-950 ring-emerald-400' },
];

export const TopNavBar: React.FC<TopNavBarProps> = ({
  activeTab,
  onTabChange,
  onOpenRules,
  players,
  currentPlayerIndex,
  isMuted = false,
  onToggleMute,
  onNewGame,
  onExitToMenu,
  gameTitle,
  roomCode,
}) => {
  const displayTitle = roomCode ? `Room ${roomCode}` : gameTitle;

  return (
    <header
      data-testid="top-nav-bar"
      className="w-full min-h-[64px] sm:min-h-[72px] bg-[#0e121d] border-b border-slate-800/80 px-4 sm:px-8 py-3 text-slate-100 flex items-center justify-between gap-4 shadow-xl z-30 overflow-x-auto selection:bg-amber-500/30"
    >
      {/* =====================================================================
          1. LEFT: LOGO, TITLE, AND NAVIGATION PILLS
      ====================================================================== */}
      <div className="flex items-center gap-5 sm:gap-7 shrink-0">
        {/* Branding & Subtitle */}
        <div className="flex items-center gap-3.5 shrink-0">
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-lime-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-md shrink-0">
            ♠
          </div>
          <div className="flex items-center gap-3">
            <span className="font-black text-xl sm:text-2xl tracking-tight text-white lowercase">
              pukar
            </span>
            {displayTitle ? (
              <span className="text-sm text-slate-400 font-semibold truncate max-w-[130px] sm:max-w-[200px] hidden md:inline">
                {displayTitle}
              </span>
            ) : null}
          </div>
        </div>

        {/* Navigation Tabs (Table, Sequences, Scoreboard, How to play) */}
        <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="Game navigation">
          {/* Table Tab */}
          <button
            type="button"
            data-testid="tab-table"
            onClick={() => onTabChange('table')}
            className={`h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-sm font-bold transition-all flex items-center justify-center cursor-pointer ${
              activeTab === 'table'
                ? 'bg-slate-100 text-slate-950 shadow-md scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Table
          </button>

          {/* Sequences Tab (Not Meld) */}
          <button
            type="button"
            data-testid="tab-sequences"
            onClick={() => onTabChange('sequences')}
            className={`h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-sm font-bold transition-all flex items-center justify-center cursor-pointer ${
              activeTab === 'sequences'
                ? 'bg-slate-100 text-slate-950 shadow-md scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Sequences
          </button>

          {/* Scoreboard Tab */}
          <button
            type="button"
            data-testid="tab-scoreboard"
            onClick={() => onTabChange('scoreboard')}
            className={`h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-sm font-bold transition-all flex items-center justify-center cursor-pointer ${
              activeTab === 'scoreboard'
                ? 'bg-slate-100 text-slate-950 shadow-md scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Scoreboard
          </button>

          {/* How to Play Tab */}
          <button
            type="button"
            data-testid="tab-how-to-play"
            id="btn-rules-modal"
            onClick={onOpenRules}
            className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all flex items-center justify-center cursor-pointer"
          >
            How to play
          </button>
        </nav>
      </div>

      {/* =====================================================================
          2. RIGHT: PLAYER AVATARS (WITH CURRENT TURN HIGHLIGHTED) & NEW GAME
      ====================================================================== */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Player Roster with Initials & Active Turn Glow */}
        <div
          data-testid="nav-players-roster"
          className="flex items-center gap-2 sm:gap-2.5 flex-wrap"
          aria-label="Players in game"
        >
          {players.map((player, idx) => {
            const isTurn = idx === currentPlayerIndex;
            const initial = player.name ? player.name.trim().charAt(0).toUpperCase() : `${idx + 1}`;
            const palette = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];

            return (
              <div
                key={player.id || `nav-p-${idx}`}
                data-testid={`nav-player-${idx}`}
                className={`h-10 sm:h-11 flex items-center gap-2 px-2.5 sm:px-3 rounded-xl transition-all ${
                  isTurn
                    ? 'bg-amber-400/15 border border-amber-400/60 shadow-md shadow-amber-400/10 ring-1 ring-amber-400/40 text-white'
                    : 'text-slate-300'
                }`}
                title={`${player.name} (${player.team ? `Team ${player.team}` : ''})${player.cardCount !== undefined ? ` • ${player.cardCount} cards` : ''}${isTurn ? ' • Current Turn' : ''}`}
              >
                {/* Circular Avatar Badge with Initial */}
                <div
                  className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center font-black text-xs sm:text-sm shadow-sm shrink-0 ${
                    palette.bg
                  } ${isTurn ? 'ring-2 ring-amber-400 scale-105' : ''}`}
                >
                  {initial}
                </div>

                {/* Player Name */}
                <span className="text-sm font-bold tracking-tight truncate max-w-[90px] sm:max-w-[130px]">
                  {player.name}
                </span>

                {/* Card Count in Hand */}
                {player.cardCount !== undefined && (
                  <span
                    data-testid={`nav-player-card-count-${idx}`}
                    className={`text-xs font-bold shrink-0 ${
                      isTurn ? 'text-amber-300 font-extrabold' : 'text-slate-400'
                    }`}
                  >
                    {`(${player.cardCount})`}
                  </span>
                )}

                {/* Turn Highlight Indicator Dot */}
                {isTurn && (
                  <span
                    data-testid="turn-indicator-dot"
                    className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse ml-0.5 shrink-0"
                    title="Active Turn"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Sound Toggle */}
        {onToggleMute && (
          <button
            type="button"
            data-testid="btn-sound-toggle"
            onClick={onToggleMute}
            className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl border transition-colors flex items-center justify-center cursor-pointer shrink-0 ${
              isMuted
                ? 'bg-red-950/60 text-red-300 border-red-800/80 hover:bg-red-900/60'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 shadow-sm'
            }`}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        )}

        {/* Menu Button if provided */}
        {onExitToMenu && (
          <button
            type="button"
            data-testid="btn-exit-to-menu"
            onClick={onExitToMenu}
            className="h-10 sm:h-11 px-3.5 sm:px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
            title="Return to Main Menu"
          >
            <Home className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Menu</span>
          </button>
        )}

        {/* Extreme Right: New Game Option */}
        {onNewGame && (
          <button
            type="button"
            data-testid="btn-restart-game"
            onClick={onNewGame}
            className="h-10 sm:h-11 px-4 sm:px-4.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
            title="Start New Game / Change Configuration"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">New Game</span>
          </button>
        )}
      </div>
    </header>
  );
};
