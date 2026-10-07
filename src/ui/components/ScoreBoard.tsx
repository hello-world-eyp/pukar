import React from 'react';
import { GameState, SanitizedGameState, Team, TurnPhase, RoundStatus } from '../../engine/types';
import { Trophy, Shield, AlertTriangle, Crown } from 'lucide-react';

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
}) => {
  // Resolve values from props or gameState fallback
  const resolvedRound = round ?? gameState?.round ?? 1;
  const resolvedStatus: RoundStatus = roundStatus ?? gameState?.roundStatus ?? 'PLAYING';
  const resolvedPhase: TurnPhase = phase ?? gameState?.phase ?? 'DRAW';

  const resolvedRoundScores = roundScores ?? gameState?.roundScores ?? { A: 0, B: 0 };
  const resolvedTotalScores = totalScores ?? gameState?.totalScores ?? scores ?? gameState?.scores ?? { A: 0, B: 0 };
  const resolvedPukarsClaimed = pukarsClaimed ?? gameState?.pukarsClaimed ?? { A: 0, B: 0 };

  const resolvedPlayerIndex = currentPlayerIndex ?? gameState?.currentPlayerIndex ?? 0;
  const activePlayer = gameState?.players?.[resolvedPlayerIndex];
  const resolvedPlayerName = currentPlayerName ?? activePlayer?.name ?? `Player ${resolvedPlayerIndex + 1}`;
  const resolvedActiveTeam: Team = activeTeam ?? activePlayer?.team ?? (resolvedPlayerIndex % 2 === 0 ? 'A' : 'B');

  const teamALeading = resolvedTotalScores.A > resolvedTotalScores.B;
  const teamBLeading = resolvedTotalScores.B > resolvedTotalScores.A;

  return (
    <header
      data-testid="scoreboard"
      className={`w-full bg-slate-900/95 backdrop-blur-md border border-slate-800 text-slate-100 rounded-2xl p-3 md:p-4 shadow-xl ${className}`}
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6">
        {/* GAME BRANDING & ROUND INFO */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black text-xl tracking-tight">
              P
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-wider text-base text-amber-400">PUKAR</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                  Royal Rummy
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="font-semibold text-slate-200">{`Round ${resolvedRound}`}</span>
                <span className="text-slate-600">•</span>
                {resolvedStatus === 'FINAL_TURN' ? (
                  <span className="inline-flex items-center gap-1 text-amber-400 font-bold bg-amber-950/60 border border-amber-600/40 px-1.5 py-0.2 rounded text-[11px] animate-pulse">
                    <AlertTriangle className="w-3 h-3" />
                    Final Turn!
                  </span>
                ) : resolvedStatus === 'ROUND_OVER' || resolvedStatus === 'GAME_OVER' ? (
                  <span className="text-red-400 font-semibold text-[11px] bg-red-950/50 border border-red-700/40 px-1.5 py-0.2 rounded">
                    Round Finished
                  </span>
                ) : (
                  <span className="text-emerald-400 font-medium text-[11px]">In Progress</span>
                )}
              </div>
            </div>
          </div>

          {/* ACTIVE TURN INDICATOR (Mobile view compact) */}
          <div className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-medium text-slate-200">{resolvedPlayerName}</span>
          </div>
        </div>

        {/* TEAM SCORES & PUKARS DISPLAY */}
        <div className="flex items-center justify-center gap-3 sm:gap-6 w-full md:w-auto">
          {/* TEAM A CARD */}
          <div
            className={`flex-1 md:flex-none flex items-center gap-3 px-3.5 py-2 rounded-xl transition-all border ${
              resolvedActiveTeam === 'A'
                ? 'bg-blue-950/60 border-blue-500/70 shadow-md shadow-blue-900/30 ring-1 ring-blue-500/40'
                : 'bg-slate-800/40 border-slate-700/50'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-blue-300">Team A</span>
                {teamALeading && (
                  <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                )}
                {resolvedActiveTeam === 'A' && (
                  <span className="text-[9px] font-semibold bg-blue-500 text-white px-1 rounded uppercase tracking-wider">
                    Turn
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black text-slate-100 tracking-tight">
                  {resolvedTotalScores.A} <span className="text-[10px] font-normal text-slate-400">pts</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {`(+${resolvedRoundScores.A})`}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-blue-300/80 mt-0.5">
                <Trophy className="w-3 h-3 text-blue-400" />
                <span>Pukars: <strong>{resolvedPukarsClaimed.A}</strong></span>
              </div>
            </div>
          </div>

          <div className="text-slate-500 font-bold text-xs uppercase tracking-widest hidden sm:block">
            VS
          </div>

          {/* TEAM B CARD */}
          <div
            className={`flex-1 md:flex-none flex items-center gap-3 px-3.5 py-2 rounded-xl transition-all border ${
              resolvedActiveTeam === 'B'
                ? 'bg-amber-950/60 border-amber-500/70 shadow-md shadow-amber-900/30 ring-1 ring-amber-500/40'
                : 'bg-slate-800/40 border-slate-700/50'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-sm">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-amber-300">Team B</span>
                {teamBLeading && (
                  <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                )}
                {resolvedActiveTeam === 'B' && (
                  <span className="text-[9px] font-semibold bg-amber-500 text-slate-950 px-1 rounded uppercase tracking-wider">
                    Turn
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black text-slate-100 tracking-tight">
                  {resolvedTotalScores.B} <span className="text-[10px] font-normal text-slate-400">pts</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {`(+${resolvedRoundScores.B})`}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-amber-300/80 mt-0.5">
                <Trophy className="w-3 h-3 text-amber-400" />
                <span>Pukars: <strong>{resolvedPukarsClaimed.B}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* CURRENT TURN & PHASE BADGE (Desktop view) */}
        <div className="hidden md:flex items-center gap-3 bg-slate-800/70 border border-slate-700/80 px-3.5 py-2 rounded-xl">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
              Active Player
            </div>
            <div className="text-sm font-bold text-slate-100 flex items-center justify-end gap-1.5">
              <span>{resolvedPlayerName}</span>
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                  resolvedActiveTeam === 'A'
                    ? 'bg-blue-600 text-white'
                    : 'bg-amber-500 text-slate-950'
                }`}
              >
                {`Team ${resolvedActiveTeam}`}
              </span>
            </div>
          </div>
          <div className="h-7 w-px bg-slate-700" />
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Phase
            </div>
            <div className="text-xs font-extrabold text-amber-400 uppercase tracking-wide">
              {resolvedPhase}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
