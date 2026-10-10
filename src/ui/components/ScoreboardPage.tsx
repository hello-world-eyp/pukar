import React from 'react';
import { GameState, SanitizedGameState, RoundStatus } from '../../engine/types';
import { evaluateMeldScore } from '../../engine/meld-validator';
import {
  Trophy,
  Shield,
  Crown,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Award,
  Layers,
} from 'lucide-react';

export interface ScoreboardPageProps {
  gameState: GameState | SanitizedGameState;
  onBackToTable: () => void;
  onOpenRules?: () => void;
  className?: string;
}

export const ScoreboardPage: React.FC<ScoreboardPageProps> = ({
  gameState,
  onBackToTable,
  onOpenRules,
  className = '',
}) => {
  const round = gameState.round ?? 1;
  const roundStatus: RoundStatus = gameState.roundStatus ?? 'PLAYING';

  // Total scores
  const rawTotalScores = gameState.totalScores ?? gameState.scores ?? { A: 0, B: 0 };
  const rawRoundScores = gameState.roundScores ?? { A: 0, B: 0 };

  const totalScores = {
    A: Math.max(rawTotalScores.A ?? 0, (gameState.scores?.A ?? 0)),
    B: Math.max(rawTotalScores.B ?? 0, (gameState.scores?.B ?? 0)),
  };

  const roundScores = {
    A: rawRoundScores.A ?? 0,
    B: rawRoundScores.B ?? 0,
  };

  const pukarsClaimed = gameState.pukarsClaimed ?? { A: 0, B: 0 };
  const pukarPointsA = (pukarsClaimed.A ?? 0) * 50;
  const pukarPointsB = (pukarsClaimed.B ?? 0) * 50;

  // Sequences
  const listA = gameState.melds?.A ?? [];
  const listB = gameState.melds?.B ?? [];

  const meldDetailsA = listA.map((m) => {
    try {
      return { meld: m, evaluation: evaluateMeldScore(m) };
    } catch {
      return {
        meld: m,
        evaluation: { points: 0, description: 'Evaluation error', isComplete7: false, isPure13: false },
      };
    }
  });

  const meldDetailsB = listB.map((m) => {
    try {
      return { meld: m, evaluation: evaluateMeldScore(m) };
    } catch {
      return {
        meld: m,
        evaluation: { points: 0, description: 'Evaluation error', isComplete7: false, isPure13: false },
      };
    }
  });

  const meldPointsA = meldDetailsA.reduce((sum, item) => sum + item.evaluation.points, 0);
  const meldPointsB = meldDetailsB.reduce((sum, item) => sum + item.evaluation.points, 0);

  // Teams & Players
  const players = gameState.players ?? [];
  const teamAPlayers = players.filter((p) => p.team === 'A');
  const teamBPlayers = players.filter((p) => p.team === 'B');

  const teamALeading = totalScores.A > totalScores.B;
  const teamBLeading = totalScores.B > totalScores.A;

  return (
    <div
      data-testid="scoreboard-page"
      className={`w-full max-w-[2400px] 2xl:max-w-[2800px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col gap-6 text-slate-100 ${className}`}
    >
      {/* =====================================================================
          1. HEADER CONTROLS BAR
      ====================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            data-testid="btn-back-to-table"
            onClick={onBackToTable}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-700 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            title="Return to Table"
          >
            <ArrowLeft className="w-4 h-4 text-lime-400" />
            <span>Back to Table</span>
          </button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white">
                Scoreboard & Breakdown
              </h1>
              <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-300">
                {`Round ${round}`}
              </span>
              {roundStatus === 'ROUND_OVER' ? (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800">
                  Round Over
                </span>
              ) : roundStatus === 'FINAL_TURN' ? (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                  Final Turn
                </span>
              ) : (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  In Progress
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400 font-medium hidden sm:block mt-0.5">
              Comprehensive point tallies, round performance, and scoring breakdown.
            </p>
          </div>
        </div>

        {onOpenRules && (
          <button
            type="button"
            data-testid="btn-open-rules-from-scoreboard"
            onClick={onOpenRules}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs sm:text-sm font-bold transition-all cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>Scoring Rules Guide</span>
          </button>
        )}
      </div>

      {/* =====================================================================
          2. HERO MATCH STANDINGS (TEAM A VS TEAM B)
      ====================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* TEAM A HERO CARD */}
        <div
          data-testid="scoreboard-card-team-a"
          className={`rounded-2xl p-5 sm:p-6 border flex flex-col gap-4 shadow-xl transition-all ${
            teamALeading
              ? 'bg-gradient-to-br from-blue-950/70 via-slate-900/90 to-blue-950/40 border-blue-400/60 ring-2 ring-blue-500/30'
              : 'bg-slate-900/85 border-blue-500/30'
          }`}
        >
          {/* Card Top */}
          <div className="flex items-center justify-between border-b border-blue-500/30 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 text-blue-300 border border-blue-400/50 flex items-center justify-center font-black">
                <Shield className="w-5 h-5 text-blue-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-blue-200">Team A</h2>
                  {teamALeading && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black shadow-sm">
                      <Crown className="w-3.5 h-3.5 fill-slate-950" />
                      Leader
                    </span>
                  )}
                </div>
                <div className="text-xs text-blue-300/80 font-medium">
                  {teamAPlayers.map((p) => p.name).join(' & ') || 'Players 1 & 3'}
                </div>
              </div>
            </div>

            {/* Total Points */}
            <div className="text-right">
              <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {totalScores.A}
              </div>
              <div className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                Total Match Points
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold">Current Round</div>
              <div className="text-base sm:text-lg font-black text-blue-300">
                +{roundScores.A}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold">Pukars Claimed</div>
              <div className="text-base sm:text-lg font-black text-amber-300 flex items-center justify-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                {pukarsClaimed.A} ({pukarPointsA} pts)
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold">Sequences</div>
              <div className="text-base sm:text-lg font-black text-slate-100 flex items-center justify-center gap-1">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                {listA.length} ({meldPointsA} pts)
              </div>
            </div>
          </div>
        </div>

        {/* TEAM B HERO CARD */}
        <div
          data-testid="scoreboard-card-team-b"
          className={`rounded-2xl p-5 sm:p-6 border flex flex-col gap-4 shadow-xl transition-all ${
            teamBLeading
              ? 'bg-gradient-to-br from-amber-950/70 via-slate-900/90 to-amber-950/40 border-amber-400/60 ring-2 ring-amber-500/30'
              : 'bg-slate-900/85 border-amber-500/30'
          }`}
        >
          {/* Card Top */}
          <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600/30 text-amber-300 border border-amber-400/50 flex items-center justify-center font-black">
                <Shield className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-amber-200">Team B</h2>
                  {teamBLeading && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black shadow-sm">
                      <Crown className="w-3.5 h-3.5 fill-slate-950" />
                      Leader
                    </span>
                  )}
                </div>
                <div className="text-xs text-amber-300/80 font-medium">
                  {teamBPlayers.map((p) => p.name).join(' & ') || 'Players 2 & 4'}
                </div>
              </div>
            </div>

            {/* Total Points */}
            <div className="text-right">
              <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {totalScores.B}
              </div>
              <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                Total Match Points
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold">Current Round</div>
              <div className="text-base sm:text-lg font-black text-amber-300">
                +{roundScores.B}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold">Pukars Claimed</div>
              <div className="text-base sm:text-lg font-black text-amber-300 flex items-center justify-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                {pukarsClaimed.B} ({pukarPointsB} pts)
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold">Sequences</div>
              <div className="text-base sm:text-lg font-black text-slate-100 flex items-center justify-center gap-1">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                {listB.length} ({meldPointsB} pts)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. CURRENT ROUND DETAILED ITEMIZED BREAKDOWN
      ====================================================================== */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">
              {`Round ${round} Point Itemization`}
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Active in-progress sequence tallies + Pukar claims
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Team A Itemized */}
          <div
            data-testid="itemized-team-a"
            className="rounded-2xl p-4 sm:p-5 bg-slate-900/80 border border-blue-500/30 flex flex-col gap-3 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-extrabold text-blue-300 text-sm sm:text-base">
                Team A Sequences & Pukars
              </span>
              <span className="text-xs font-black px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
                +{roundScores.A} pts
              </span>
            </div>

            <div className="flex flex-col gap-2 text-xs sm:text-sm">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Sequences ({listA.length}):
              </div>
              {meldDetailsA.length === 0 ? (
                <div className="text-slate-500 italic py-1">No completed sequences (0 pts)</div>
              ) : (
                meldDetailsA.map((item, idx) => (
                  <div
                    key={`score-meld-a-${item.meld.id || idx}`}
                    className="flex items-center justify-between py-1 border-b border-slate-800/60 text-slate-300"
                  >
                    <span className="flex items-center gap-1.5 truncate max-w-[75%]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{item.evaluation.description}</span>
                    </span>
                    <span className="font-mono font-bold text-blue-300 shrink-0">
                      +{item.evaluation.points} pts
                    </span>
                  </div>
                ))
              )}

              {/* Pukars */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Pukar Bonuses ({pukarsClaimed.A} × 50 pts)</span>
                </span>
                <span className="font-mono font-bold text-amber-400 shrink-0">
                  +{pukarPointsA} pts
                </span>
              </div>
            </div>
          </div>

          {/* Team B Itemized */}
          <div
            data-testid="itemized-team-b"
            className="rounded-2xl p-4 sm:p-5 bg-slate-900/80 border border-amber-500/30 flex flex-col gap-3 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-extrabold text-amber-300 text-sm sm:text-base">
                Team B Sequences & Pukars
              </span>
              <span className="text-xs font-black px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50">
                +{roundScores.B} pts
              </span>
            </div>

            <div className="flex flex-col gap-2 text-xs sm:text-sm">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Sequences ({listB.length}):
              </div>
              {meldDetailsB.length === 0 ? (
                <div className="text-slate-500 italic py-1">No completed sequences (0 pts)</div>
              ) : (
                meldDetailsB.map((item, idx) => (
                  <div
                    key={`score-meld-b-${item.meld.id || idx}`}
                    className="flex items-center justify-between py-1 border-b border-slate-800/60 text-slate-300"
                  >
                    <span className="flex items-center gap-1.5 truncate max-w-[75%]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{item.evaluation.description}</span>
                    </span>
                    <span className="font-mono font-bold text-amber-300 shrink-0">
                      +{item.evaluation.points} pts
                    </span>
                  </div>
                ))
              )}

              {/* Pukars */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Pukar Bonuses ({pukarsClaimed.B} × 50 pts)</span>
                </span>
                <span className="font-mono font-bold text-amber-400 shrink-0">
                  +{pukarPointsB} pts
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          4. OFFICIAL SCORING MATRIX CHEAT SHEET
      ====================================================================== */}
      <div className="rounded-2xl p-4 sm:p-5 bg-slate-950/70 border border-slate-800 flex flex-col gap-3 shadow-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
            Official Pukar Scoring Matrix
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-900 border border-yellow-500/30 flex items-center justify-between">
            <div>
              <div className="font-bold text-yellow-300">Complete Sequence</div>
              <div className="text-slate-400 text-[11px]">Same suit (2 to A), 0 wildcards/jokers</div>
            </div>
            <span className="font-black text-sm text-yellow-400 font-mono">500 pts</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <div className="font-bold text-emerald-300">Pure Sequence / Set</div>
              <div className="text-slate-400 text-[11px]">7+ cards, 0 wildcards/2s</div>
            </div>
            <span className="font-black text-sm text-emerald-400 font-mono">200 pts</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-blue-500/30 flex items-center justify-between">
            <div>
              <div className="font-bold text-blue-300">Impure Sequence / Set</div>
              <div className="text-slate-400 text-[11px]">7+ cards, 1 wildcard used</div>
            </div>
            <span className="font-black text-sm text-blue-400 font-mono">100 pts</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center justify-between">
            <div>
              <div className="font-bold text-amber-300">Claiming a Pukar Deck</div>
              <div className="text-slate-400 text-[11px]">Hand emptied while Pukar exists</div>
            </div>
            <span className="font-black text-sm text-amber-400 font-mono">50 pts</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-300">Incomplete Sequences</div>
              <div className="text-slate-400 text-[11px]">Fewer than 7 cards</div>
            </div>
            <span className="font-black text-sm text-slate-400 font-mono">0 pts</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-300">Unmelded Hand Cards</div>
              <div className="text-slate-400 text-[11px]">No point deduction in Pukar</div>
            </div>
            <span className="font-black text-sm text-emerald-400 font-mono">0 penalty</span>
          </div>
        </div>
      </div>
    </div>
  );
};
