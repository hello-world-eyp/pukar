import React from 'react';
import { GameState, SanitizedGameState, Team, TurnPhase, RoundStatus } from '../../engine/types';
import {
  Trophy,
  Shield,
  AlertTriangle,
  Crown,
  Users,
  Volume2,
  VolumeX,
  HelpCircle,
  RotateCcw,
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
  playerCount,
  onTogglePlayerCount,
  isMuted = false,
  onToggleMute,
  onOpenRules,
  onRestartGame,
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
  let resolvedPlayerCount: 4 | 6 = playerCount ?? (gameState?.playerCount as 4 | 6) ?? 4;

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
    if (!playerCount && gameState?.playerCount) {
      resolvedPlayerCount = gameState.playerCount as 4 | 6;
    }
  } catch (err) {
    console.error('Error resolving scoreboard metrics:', err);
  }

  const teamALeading = resolvedTotalScores.A > resolvedTotalScores.B;
  const teamBLeading = resolvedTotalScores.B > resolvedTotalScores.A;

  return (
    <header
      data-testid="scoreboard"
      className={`w-full bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 text-slate-100 px-3 sm:px-6 py-2 shadow-lg transition-all ${className}`}
    >
      <div className="max-w-[1680px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* ===================================================================
            1. LEFT: BRANDING & ROUND STATUS
        ==================================================================== */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-base sm:text-lg shadow-md shadow-amber-900/30 shrink-0">
            ♠
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-sm sm:text-base tracking-tight bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                PUKAR
              </span>
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Royal Rummy
              </span>
              <span className="text-xs font-bold text-slate-300">
                {`Round ${resolvedRound}`}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              {resolvedStatus === 'FINAL_TURN' ? (
                <span className="inline-flex items-center gap-1 text-amber-400 font-bold bg-amber-950/60 border border-amber-600/40 px-1.5 py-0.2 rounded text-[10px] animate-pulse">
                  <AlertTriangle className="w-3 h-3" />
                  Final Turn!
                </span>
              ) : resolvedStatus === 'ROUND_OVER' || resolvedStatus === 'GAME_OVER' ? (
                <span className="text-red-400 font-semibold text-[10px] bg-red-950/50 border border-red-700/40 px-1.5 py-0.2 rounded">
                  Round Finished
                </span>
              ) : (
                <span className="text-emerald-400 font-medium text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
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
            className={`flex-1 flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl border transition-all ${
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
                  <span className="text-sm font-black text-blue-200 tracking-tight truncate">Team A</span>
                  {teamALeading && (
                    <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0 drop-shadow" />
                  )}
                  {resolvedActiveTeam === 'A' && (
                    <span className="text-[9px] font-black bg-blue-500 text-white px-1.5 py-0.2 rounded uppercase tracking-wider shadow-sm">
                      Turn
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-300/90">
                  <Trophy className="w-3 h-3 text-amber-400" />
                  <span className="text-white">Pukars: <strong>{resolvedPukarsClaimed.A}</strong></span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-sm">
                {resolvedTotalScores.A}
              </span>
              <span className="text-xs font-bold text-blue-300/80 ml-1.5">
                {`(+${resolvedRoundScores.A})`}
              </span>
            </div>
          </div>

          <span className="text-amber-400/80 font-black text-xs uppercase tracking-widest px-1 drop-shadow">
            VS
          </span>

          {/* TEAM B CARD */}
          <div
            className={`flex-1 flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl border transition-all ${
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
                  <span className="text-sm font-black text-amber-200 tracking-tight truncate">Team B</span>
                  {teamBLeading && (
                    <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0 drop-shadow" />
                  )}
                  {resolvedActiveTeam === 'B' && (
                    <span className="text-[9px] font-black bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded uppercase tracking-wider shadow-sm">
                      Turn
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-300/90">
                  <Trophy className="w-3 h-3 text-amber-400" />
                  <span className="text-white">Pukars: <strong>{resolvedPukarsClaimed.B}</strong></span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-sm">
                {resolvedTotalScores.B}
              </span>
              <span className="text-xs font-bold text-amber-300/80 ml-1.5">
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
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-xl text-xs">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">
                Active Turn
              </div>
              <div className="font-bold text-slate-200 flex items-center gap-1">
                <span>{resolvedPlayerName}</span>
                <span
                  className={`text-[8px] font-extrabold px-1 rounded ${
                    resolvedActiveTeam === 'A'
                      ? 'bg-blue-600 text-white'
                      : 'bg-amber-500 text-slate-950'
                  }`}
                >
                  {`Team ${resolvedActiveTeam}`}
                </span>
              </div>
            </div>
            <div className="h-5 w-px bg-slate-700/80" />
            <span
              data-testid="current-phase-badge"
              className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
            >
              {resolvedPhase}
            </span>
          </div>

          {/* Quick Action Buttons (4P/6P, Sound, Rules, Restart) */}
          <div className="flex items-center gap-1.5">
            {/* Player Count Toggle */}
            {onTogglePlayerCount && (
              <div
                className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-xs font-bold"
                role="group"
                aria-label="Player count selector"
              >
                <button
                  type="button"
                  data-testid="btn-toggle-4p"
                  onClick={() => onTogglePlayerCount(4)}
                  className={`px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 text-[11px] ${
                    resolvedPlayerCount === 4
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="4-Player Mode"
                >
                  <Users className="w-3 h-3" />
                  <span>4P</span>
                </button>
                <button
                  type="button"
                  data-testid="btn-toggle-6p"
                  onClick={() => onTogglePlayerCount(6)}
                  className={`px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 text-[11px] ${
                    resolvedPlayerCount === 6
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="6-Player Mode"
                >
                  <Users className="w-3 h-3" />
                  <span>6P</span>
                </button>
              </div>
            )}

            {/* Sound Toggle */}
            {onToggleMute && (
              <button
                type="button"
                data-testid="btn-sound-toggle"
                onClick={onToggleMute}
                className={`p-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                  isMuted
                    ? 'bg-red-950/60 text-red-300 border-red-800/80 hover:bg-red-900/60'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
                aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Rules Modal Button */}
            {onOpenRules && (
              <button
                type="button"
                data-testid="btn-rules-modal"
                onClick={onOpenRules}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-colors flex items-center gap-1"
                title="Game Rules & Guide"
                aria-label="Game Rules & Guide"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="hidden xl:inline text-[11px]">Rules</span>
              </button>
            )}

            {/* Restart / New Game Button */}
            {onRestartGame && (
              <button
                type="button"
                data-testid="btn-restart-game"
                onClick={onRestartGame}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-[11px] font-bold transition-colors flex items-center gap-1"
                title="Start New Game"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">New Game</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
