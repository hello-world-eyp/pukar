import React from 'react';
import { GameState, SanitizedGameState, Team, TurnPhase, RoundStatus } from '../../engine/types';
import {
  Trophy,
  Shield,
  AlertTriangle,
  Crown,
  Volume2,
  VolumeX,
  HelpCircle,
  RotateCcw,
  Home,
} from 'lucide-react';

export interface ScoreBoardProps {
  gameState?: GameState | SanitizedGameState;
  round?: number;
  roundStatus?: RoundStatus;
  scores?: { A: number; B: number };
  roundScores?: { A: number; B: number };
  totalScores?: { A: number; B: number };
  pukarsClaimed?: { A: number; B: number };
  currentPlayerIndex?: number;
  currentPlayerName?: string;
  activeTeam?: Team;
  phase?: TurnPhase;
  className?: string;

  // Integrated header quick controls
  playerCount?: 4 | 6;
  onTogglePlayerCount?: (count: 4 | 6) => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onOpenRules?: () => void;
  onRestartGame?: () => void;
  appMode?: 'LOCAL' | 'MULTIPLAYER';
  onOpenModeSelector?: () => void;
  onExitToMenu?: () => void;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  gameState,
  round,
  roundStatus,
  scores,
  roundScores,
  totalScores,
  pukarsClaimed,
  currentPlayerIndex,
  currentPlayerName,
  activeTeam,
  phase,
  className = '',
  playerCount: _playerCount,
  onTogglePlayerCount: _onTogglePlayerCount,
  isMuted = false,
  onToggleMute,
  onOpenRules,
  onRestartGame,
  appMode: _appMode = 'LOCAL',
  onOpenModeSelector: _onOpenModeSelector,
  onExitToMenu,
}) => {
  // Resolve values from props or gameState fallback safely
  let resolvedRound = 1;
  let resolvedStatus: RoundStatus = 'PLAYING';
  let resolvedPhase: TurnPhase = 'DRAW';
  let resolvedRoundScores = { A: 0, B: 0 };
  let resolvedTotalScores = { A: 0, B: 0 };
  let resolvedPukarsClaimed = { A: 0, B: 0 };
  let resolvedPlayerIndex = 0;
  let resolvedPlayerName = 'Player 1';
  let resolvedActiveTeam: Team = 'A';

  try {
    resolvedRound = round ?? gameState?.round ?? 1;
    resolvedStatus = roundStatus ?? gameState?.roundStatus ?? 'PLAYING';
    resolvedPhase = phase ?? gameState?.phase ?? 'DRAW';
    resolvedRoundScores = roundScores ?? gameState?.roundScores ?? { A: 0, B: 0 };

    const rawTotalScores = totalScores ?? gameState?.totalScores;
    const rawScores = scores ?? gameState?.scores;
    resolvedTotalScores = {
      A: Math.max(rawTotalScores?.A ?? 0, rawScores?.A ?? 0),
      B: Math.max(rawTotalScores?.B ?? 0, rawScores?.B ?? 0),
    };
    resolvedPukarsClaimed = pukarsClaimed ?? gameState?.pukarsClaimed ?? { A: 0, B: 0 };

    resolvedPlayerIndex = currentPlayerIndex ?? gameState?.currentPlayerIndex ?? 0;
    const activePlayer = gameState?.players?.[resolvedPlayerIndex];
    resolvedPlayerName = currentPlayerName ?? activePlayer?.name ?? `Player ${resolvedPlayerIndex + 1}`;
    resolvedActiveTeam = activeTeam ?? activePlayer?.team ?? (resolvedPlayerIndex % 2 === 0 ? 'A' : 'B');
  } catch (err) {
    console.error('Error resolving scoreboard metrics:', err);
  }

  const teamALeading = resolvedTotalScores.A > resolvedTotalScores.B;
  const teamBLeading = resolvedTotalScores.B > resolvedTotalScores.A;

  return (
    <header
      data-testid="scoreboard"
      className={`relative w-full bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/80 text-slate-100 px-3 sm:px-6 py-2.5 sm:py-3 shadow-2xl shadow-black/80 z-30 transition-all ${className}`}
    >
      <div className="w-full max-w-[2400px] 2xl:max-w-[2800px] mx-auto px-1 sm:px-2 flex flex-wrap items-center justify-between gap-3">
        {/* ===================================================================
            1. LEFT: BRANDING & ROUND STATUS
        ==================================================================== */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-lg sm:text-xl shadow-md shrink-0">
            ♠
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-base sm:text-lg tracking-tight bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                PUKAR
              </span>
              <span className="text-sm font-extrabold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Royal Rummy
              </span>
              <span className="text-sm font-bold text-slate-200">
                {`Round ${resolvedRound}`}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-400 mt-0.5">
              {resolvedStatus === 'FINAL_TURN' ? (
                <span className="inline-flex items-center gap-1.5 text-amber-400 font-bold bg-amber-950/60 border border-amber-600/40 px-2 py-0.5 rounded text-sm animate-pulse">
                  <AlertTriangle className="w-4 h-4" />
                  Final Turn!
                </span>
              ) : resolvedStatus === 'ROUND_OVER' || resolvedStatus === 'GAME_OVER' ? (
                <span className="text-red-400 font-semibold text-sm bg-red-950/50 border border-red-700/40 px-2 py-0.5 rounded">
                  Round Finished
                </span>
              ) : (
                <span className="text-emerald-400 font-medium text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  In Progress
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ===================================================================
            2. CENTER: COMPACT MATCH SCOREBOARD (TEAM A vs TEAM B)
        ==================================================================== */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 flex-1 max-w-xl mx-auto order-3 md:order-2 w-full md:w-auto">
          {/* TEAM A CARD */}
          <div
            className={`flex-1 flex items-center justify-between gap-3 px-4 py-2 rounded-xl border transition-all ${
              resolvedActiveTeam === 'A'
                ? 'bg-blue-950/90 border-blue-400 shadow-lg shadow-blue-900/50 ring-2 ring-blue-400/60'
                : 'bg-slate-900/80 border-slate-700/80 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-300 border border-blue-400/40 flex items-center justify-center shrink-0 shadow-inner">
                <Shield className="w-4 h-4 text-blue-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-base font-black text-blue-200 tracking-tight truncate">Team A</span>
                  {teamALeading && (
                    <Crown className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0 drop-shadow" />
                  )}
                  {resolvedActiveTeam === 'A' && (
                    <span className="text-sm font-black bg-blue-500 text-white px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
                      Turn
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-300/90">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-white">Pukars: <strong>{resolvedPukarsClaimed.A}</strong></span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-sm">
                {resolvedTotalScores.A}
              </span>
              <span className="text-sm font-bold text-blue-300/80 ml-1.5">
                {`(+${resolvedRoundScores.A})`}
              </span>
            </div>
          </div>

          <span className="text-amber-400/80 font-black text-sm uppercase tracking-widest px-1 drop-shadow">
            VS
          </span>

          {/* TEAM B CARD */}
          <div
            className={`flex-1 flex items-center justify-between gap-3 px-4 py-2 rounded-xl border transition-all ${
              resolvedActiveTeam === 'B'
                ? 'bg-amber-950/90 border-amber-400 shadow-lg shadow-amber-900/50 ring-2 ring-amber-400/60'
                : 'bg-slate-900/80 border-slate-700/80 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-600/30 text-amber-300 border border-amber-400/40 flex items-center justify-center shrink-0 shadow-inner">
                <Shield className="w-4 h-4 text-amber-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-base font-black text-amber-200 tracking-tight truncate">Team B</span>
                  {teamBLeading && (
                    <Crown className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0 drop-shadow" />
                  )}
                  {resolvedActiveTeam === 'B' && (
                    <span className="text-sm font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
                      Turn
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-300/90">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-white">Pukars: <strong>{resolvedPukarsClaimed.B}</strong></span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-sm">
                {resolvedTotalScores.B}
              </span>
              <span className="text-sm font-bold text-amber-300/80 ml-1.5">
                {`(+${resolvedRoundScores.B})`}
              </span>
            </div>
          </div>
        </div>

        {/* ===================================================================
            3. RIGHT: ACTIVE TURN BADGE & QUICK ACTION TOOLS
        ==================================================================== */}
        <div className="flex items-center gap-2 sm:gap-3 order-2 md:order-3 ml-auto md:ml-0">
          {/* Active Turn Pill */}
          <div className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-xl text-sm">
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Active Turn
              </div>
              <div className="font-bold text-slate-200 flex items-center gap-1.5 text-sm">
                <span>{resolvedPlayerName}</span>
                <span
                  className={`text-xs font-black px-1.5 py-0.5 rounded ${
                    resolvedActiveTeam === 'A'
                      ? 'bg-blue-600 text-white'
                      : 'bg-amber-500 text-slate-950'
                  }`}
                >
                  {`Team ${resolvedActiveTeam}`}
                </span>
              </div>
            </div>
            <div className="h-6 w-px bg-slate-700" />
            <span
              data-testid="current-phase-badge"
              className="text-xs font-black uppercase px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40"
            >
              {resolvedPhase}
            </span>
          </div>

          {/* Quick Action Buttons: Sound, Rules, Menu, New Game */}
          <div className="flex items-center gap-2">
            {/* Sound Toggle */}
            {onToggleMute && (
              <button
                type="button"
                data-testid="btn-sound-toggle"
                onClick={onToggleMute}
                className={`p-2 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                  isMuted
                    ? 'bg-red-950/60 text-red-300 border-red-800/80 hover:bg-red-900/60'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
                aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}

            {/* Rules Modal Button */}
            {onOpenRules && (
              <button
                type="button"
                data-testid="btn-rules-modal"
                onClick={onOpenRules}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Game Rules & Guide"
                aria-label="Game Rules & Guide"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="hidden xl:inline">Rules</span>
              </button>
            )}

            {/* Main Menu Button */}
            {onExitToMenu && (
              <button
                type="button"
                data-testid="btn-exit-to-menu"
                onClick={onExitToMenu}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Return to Main Menu"
                aria-label="Main Menu"
              >
                <Home className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Menu</span>
              </button>
            )}

            {/* Restart / New Game Button */}
            {onRestartGame && (
              <button
                type="button"
                data-testid="btn-restart-game"
                onClick={onRestartGame}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600 text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="New Game / Change Configuration"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">New Game</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Luminous Separation Horizon Line between Menu Bar and Game Arena */}
      <div
        data-testid="menu-separation-line"
        className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent pointer-events-none"
      />
    </header>
  );
};
