import React from 'react';
import { Meld, Team } from '../../engine/types';
import { evaluateMeldScore } from '../../engine/meld-validator';
import { Trophy, Crown, ArrowRight, Shield, Sparkles, CheckCircle2 } from 'lucide-react';

export interface RoundSummaryModalProps {
  isOpen?: boolean;
  isRoundOver?: boolean;
  round?: number;
  roundScores?: { A: number; B: number };
  totalScores?: { A: number; B: number };
  melds?: {
    A: Meld[];
    B: Meld[];
  };
  pukarsClaimed?: {
    A: number;
    B: number;
  };
  winnerTeam?: Team | 'TIE' | null;
  winningReason?: string;
  onStartNextRound: () => void;
  onClose?: () => void;
  className?: string;
}

export const RoundSummaryModal: React.FC<RoundSummaryModalProps> = ({
  isOpen,
  isRoundOver,
  round = 1,
  roundScores = { A: 0, B: 0 },
  totalScores = { A: 0, B: 0 },
  melds = { A: [], B: [] },
  pukarsClaimed = { A: 0, B: 0 },
  winnerTeam,
  winningReason,
  onStartNextRound,
  onClose,
  className = '',
}) => {
  // Modal open condition
  const shouldShow = isOpen !== undefined ? isOpen : Boolean(isRoundOver);
  if (!shouldShow) return null;

  // Determine round winner if not explicitly passed
  const determinedWinner: Team | 'TIE' =
    winnerTeam !== undefined && winnerTeam !== null
      ? winnerTeam
      : roundScores.A > roundScores.B
      ? 'A'
      : roundScores.B > roundScores.A
      ? 'B'
      : 'TIE';

  const pukarsA = pukarsClaimed.A ?? 0;
  const pukarsB = pukarsClaimed.B ?? 0;
  const pukarPointsA = pukarsA * 50;
  const pukarPointsB = pukarsB * 50;

  const meldsListA = melds.A ?? [];
  const meldsListB = melds.B ?? [];

  const meldDetailsA = (meldsListA || []).map((m) => {
    try {
      return { meld: m, evaluation: evaluateMeldScore(m) };
    } catch (err) {
      console.error('Error evaluating meld score for Team A:', err);
      return {
        meld: m,
        evaluation: { points: 0, description: 'Evaluation error', isComplete7: false, isPure13: false },
      };
    }
  });

  const meldDetailsB = (meldsListB || []).map((m) => {
    try {
      return { meld: m, evaluation: evaluateMeldScore(m) };
    } catch (err) {
      console.error('Error evaluating meld score for Team B:', err);
      return {
        meld: m,
        evaluation: { points: 0, description: 'Evaluation error', isComplete7: false, isPure13: false },
      };
    }
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="round-summary-title"
      data-testid="round-summary-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className={`relative w-full max-w-2xl game-modal-frame rounded-3xl shadow-2xl overflow-hidden flex flex-col ${className}`}
      >
        {/* HEADER HERO BANNER */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 px-6 py-6 border-b border-slate-800 text-center relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            {`Round ${round} Completed`}
          </div>

          <h2 id="round-summary-title" className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
            {determinedWinner === 'TIE' ? (
              <span className="text-amber-400">Round Tied!</span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Crown className="w-7 h-7 text-amber-400 fill-amber-400" />
                <span>
                  Team <span className={determinedWinner === 'A' ? 'text-blue-400' : 'text-amber-400'}>{determinedWinner}</span>{` Wins Round ${round}!`}
                </span>
              </span>
            )}
          </h2>

          {winningReason && (
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {winningReason}
            </p>
          )}
        </div>

        {/* POINTS BREAKDOWN BODY */}
        <div className="p-6 overflow-y-auto max-h-[60vh] flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TEAM A BREAKDOWN */}
            <div
              data-testid="summary-team-a"
              className={`rounded-2xl p-4 border flex flex-col gap-3 ${
                determinedWinner === 'A'
                  ? 'bg-blue-950/40 border-blue-500/50 ring-1 ring-blue-500/30'
                  : 'bg-slate-800/40 border-slate-700/60'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-700/70 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-extrabold text-blue-300 text-base">Team A</span>
                </div>
                {determinedWinner === 'A' && (
                  <span className="text-[11px] font-bold text-amber-400 bg-amber-950/60 border border-amber-600/40 px-2 py-0.5 rounded-full">
                    Winner
                  </span>
                )}
              </div>

              {/* Itemized List */}
              <div className="flex flex-col gap-2 text-xs">
                <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                  Sequences Itemization:
                </div>
                {meldDetailsA.length === 0 ? (
                  <div className="text-slate-500 italic py-1">No sequences made (0 pts)</div>
                ) : (
                  meldDetailsA.map((item, idx) => (
                    <div key={`meld-a-${item.meld.id || idx}`} className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-1 truncate max-w-[70%]">
                        <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0" />
                        <span className="truncate">{item.evaluation.description}</span>
                      </span>
                      <span className="font-mono font-bold text-blue-300">{`+${item.evaluation.points}`}</span>
                    </div>
                  ))
                )}

                {/* Claimed Pukars */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-700/50 text-slate-300">
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>{`Claimed Pukars (${pukarsA} × 50)`}</span>
                  </span>
                  <span className="font-mono font-bold text-amber-400">{`+${pukarPointsA}`}</span>
                </div>
              </div>

              {/* Totals */}
              <div className="mt-auto pt-3 border-t border-slate-700 flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>{`Round ${round} Points:`}</span>
                  <span className="font-mono font-black text-sm text-slate-100">{`+${roundScores.A}`}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-extrabold text-blue-300">
                  <span>Total Cumulative Score:</span>
                  <span className="font-mono font-black text-base text-blue-200">{`${totalScores.A} pts`}</span>
                </div>
              </div>
            </div>

            {/* TEAM B BREAKDOWN */}
            <div
              data-testid="summary-team-b"
              className={`rounded-2xl p-4 border flex flex-col gap-3 ${
                determinedWinner === 'B'
                  ? 'bg-amber-950/40 border-amber-500/50 ring-1 ring-amber-500/30'
                  : 'bg-slate-800/40 border-slate-700/60'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-700/70 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-extrabold text-amber-300 text-base">Team B</span>
                </div>
                {determinedWinner === 'B' && (
                  <span className="text-[11px] font-bold text-amber-400 bg-amber-950/60 border border-amber-600/40 px-2 py-0.5 rounded-full">
                    Winner
                  </span>
                )}
              </div>

              {/* Itemized List */}
              <div className="flex flex-col gap-2 text-xs">
                <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                  Sequences Itemization:
                </div>
                {meldDetailsB.length === 0 ? (
                  <div className="text-slate-500 italic py-1">No sequences made (0 pts)</div>
                ) : (
                  meldDetailsB.map((item, idx) => (
                    <div key={`meld-b-${item.meld.id || idx}`} className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-1 truncate max-w-[70%]">
                        <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">{item.evaluation.description}</span>
                      </span>
                      <span className="font-mono font-bold text-amber-300">{`+${item.evaluation.points}`}</span>
                    </div>
                  ))
                )}

                {/* Claimed Pukars */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-700/50 text-slate-300">
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>{`Claimed Pukars (${pukarsB} × 50)`}</span>
                  </span>
                  <span className="font-mono font-bold text-amber-400">{`+${pukarPointsB}`}</span>
                </div>
              </div>

              {/* Totals */}
              <div className="mt-auto pt-3 border-t border-slate-700 flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>{`Round ${round} Points:`}</span>
                  <span className="font-mono font-black text-sm text-slate-100">{`+${roundScores.B}`}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-extrabold text-amber-300">
                  <span>Total Cumulative Score:</span>
                  <span className="font-mono font-black text-base text-amber-200">{`${totalScores.B} pts`}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER ACTION */}
        <div className="bg-slate-900/90 border-t border-slate-800 px-6 py-4 flex items-center justify-end gap-3">
          {onClose && (
            <button
              type="button"
              onClick={() => {
                try {
                  onClose();
                } catch (err) {
                  console.error('Error in RoundSummaryModal onClose:', err);
                }
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          )}

          <button
            type="button"
            data-testid="btn-next-round"
            onClick={() => {
              try {
                onStartNextRound();
              } catch (err) {
                console.error('Error in onStartNextRound:', err);
              }
            }}
            className="w-full sm:w-auto h-12 px-7 rounded-xl btn-game-primary font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <span>Next Round</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
