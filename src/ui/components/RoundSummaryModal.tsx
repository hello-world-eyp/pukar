import React from 'react';
import { Meld, Team, MatchStats, Player, SanitizedPlayer } from '../../engine/types';
import { evaluateMeldScore } from '../../engine/meld-validator';
import { MatchAnalyticsView } from './MatchAnalyticsView';
import { PlayingCard } from './PlayingCard';
import { Trophy, Crown, ArrowRight, Shield, Sparkles, CheckCircle2 } from 'lucide-react';

export interface RoundSummaryModalProps {
  isOpen?: boolean;
  isRoundOver?: boolean;
  isGameOver?: boolean;
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
  matchStats?: MatchStats;
  players?: Array<Player | SanitizedPlayer>;
  initialTab?: 'ROUND' | 'AWARDS' | 'HANDS';
  onStartNextRound: () => void;
  onClose?: () => void;
  className?: string;
}

export const RoundSummaryModal: React.FC<RoundSummaryModalProps> = ({
  isOpen,
  isRoundOver,
  isGameOver = false,
  round = 1,
  roundScores = { A: 0, B: 0 },
  totalScores = { A: 0, B: 0 },
  melds = { A: [], B: [] },
  pukarsClaimed = { A: 0, B: 0 },
  winnerTeam,
  winningReason,
  matchStats,
  players = [],
  initialTab,
  onStartNextRound,
  onClose,
  className = '',
}) => {
  const [activeTab, setActiveTab] = React.useState<'ROUND' | 'AWARDS' | 'HANDS'>(() =>
    initialTab ?? (isGameOver ? 'AWARDS' : 'ROUND')
  );

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
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 md:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className={`relative w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1450px] max-h-[92vh] sm:max-h-[90vh] game-modal-frame rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col ${className}`}
      >
        {/* HEADER HERO BANNER */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 text-center relative shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {`Round ${round} Completed`}
          </div>

          <h2 id="round-summary-title" className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            {determinedWinner === 'TIE' ? (
              <span className="text-amber-400">Round Tied!</span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 fill-amber-400" />
                <span>
                  Team <span className={determinedWinner === 'A' ? 'text-blue-400' : 'text-amber-400'}>{determinedWinner}</span>{` Wins Round ${round}!`}
                </span>
              </span>
            )}
          </h2>

          {winningReason && (
            <p className="text-xs text-slate-400 mt-0.5 max-w-md mx-auto">
              {winningReason}
            </p>
          )}
        </div>

        {/* TABS SWITCHER */}
        <div className="flex items-center justify-center gap-2 border-b border-slate-800 bg-slate-900/60 px-3 py-2 shrink-0">
          <button
            type="button"
            data-testid="tab-round-breakdown"
            onClick={() => setActiveTab('ROUND')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'ROUND'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            📋 Round Breakdown
          </button>
          <button
            type="button"
            data-testid="tab-match-awards"
            onClick={() => setActiveTab('AWARDS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'AWARDS'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            🏆 Match Awards & Analytics
          </button>
          <button
            type="button"
            data-testid="tab-remaining-hands"
            onClick={() => setActiveTab('HANDS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'HANDS'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            🃏 Remaining Hands
          </button>
        </div>

        {/* BODY (ROUND BREAKDOWN, MATCH AWARDS, OR REMAINING HANDS) */}
        {activeTab === 'HANDS' ? (
          <div
            data-testid="remaining-hands-view"
            className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 flex flex-col gap-5 scrollbar-thin"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-2.5 gap-1">
              <span className="font-bold text-slate-200">
                {`Cards held by players when Round ${round} concluded`}
              </span>
              <span className="text-slate-400 italic">
                Revealed for all players at round end
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* TEAM A REMAINING HANDS */}
              <div
                data-testid="team-a-remaining-hands"
                className="rounded-2xl p-4 sm:p-5 border bg-blue-950/20 border-blue-500/30 flex flex-col gap-4"
              >
                <div className="flex items-center justify-between border-b border-blue-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-extrabold text-blue-300 text-base">Team A Players</span>
                  </div>
                  <span className="text-xs font-bold text-blue-400/80">
                    {`${players.filter((p) => p.team === 'A').length} Players`}
                  </span>
                </div>

                <div className="flex flex-col gap-3.5">
                  {players
                    .filter((p) => p.team === 'A')
                    .map((player, pIdx) => {
                      const hand = player.hand || [];
                      const deadwoodPts = hand.reduce((sum, c) => {
                        if (c.isNaturalJoker || c.rank === 0 || c.rank === 2) return sum + 20;
                        if (c.rank === 14) return sum + 15;
                        if (c.rank >= 10) return sum + 10;
                        return sum + c.rank;
                      }, 0);

                      return (
                        <div
                          key={player.id || `team-a-player-${pIdx}`}
                          data-testid={`player-hand-${player.id}`}
                          className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col gap-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-100 text-sm">
                                {player.name}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                {`Seat ${players.indexOf(player) + 1}`}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {hand.length === 0 ? (
                                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-600/40 px-2.5 py-0.5 rounded-full">
                                  ✨ Hand Cleared (0 cards)
                                </span>
                              ) : (
                                <>
                                  <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                                    {`${hand.length} card${hand.length === 1 ? '' : 's'}`}
                                  </span>
                                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-600/30">
                                    {`${deadwoodPts} pts`}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {hand.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 sm:gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 min-h-[76px] items-center">
                              {hand.map((card, cIdx) => (
                                <PlayingCard
                                  key={card.id || `card-${player.id}-${cIdx}`}
                                  card={card}
                                  size="sm"
                                  disabled
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 italic py-2 px-1">
                              Went out / claimed Pukar — no cards remaining in hand.
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* TEAM B REMAINING HANDS */}
              <div
                data-testid="team-b-remaining-hands"
                className="rounded-2xl p-4 sm:p-5 border bg-amber-950/20 border-amber-500/30 flex flex-col gap-4"
              >
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-extrabold text-amber-300 text-base">Team B Players</span>
                  </div>
                  <span className="text-xs font-bold text-amber-400/80">
                    {`${players.filter((p) => p.team === 'B').length} Players`}
                  </span>
                </div>

                <div className="flex flex-col gap-3.5">
                  {players
                    .filter((p) => p.team === 'B')
                    .map((player, pIdx) => {
                      const hand = player.hand || [];
                      const deadwoodPts = hand.reduce((sum, c) => {
                        if (c.isNaturalJoker || c.rank === 0 || c.rank === 2) return sum + 20;
                        if (c.rank === 14) return sum + 15;
                        if (c.rank >= 10) return sum + 10;
                        return sum + c.rank;
                      }, 0);

                      return (
                        <div
                          key={player.id || `team-b-player-${pIdx}`}
                          data-testid={`player-hand-${player.id}`}
                          className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col gap-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-100 text-sm">
                                {player.name}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                {`Seat ${players.indexOf(player) + 1}`}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {hand.length === 0 ? (
                                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-600/40 px-2.5 py-0.5 rounded-full">
                                  ✨ Hand Cleared (0 cards)
                                </span>
                              ) : (
                                <>
                                  <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                                    {`${hand.length} card${hand.length === 1 ? '' : 's'}`}
                                  </span>
                                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-600/30">
                                    {`${deadwoodPts} pts`}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {hand.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 sm:gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 min-h-[76px] items-center">
                              {hand.map((card, cIdx) => (
                                <PlayingCard
                                  key={card.id || `card-${player.id}-${cIdx}`}
                                  card={card}
                                  size="sm"
                                  disabled
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 italic py-2 px-1">
                              Went out / claimed Pukar — no cards remaining in hand.
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'AWARDS' ? (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
            <MatchAnalyticsView
              matchStats={matchStats}
              players={players}
              winnerTeam={determinedWinner}
              roundScores={roundScores}
              totalScores={totalScores}
            />
          </div>
        ) : (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 flex flex-col gap-5 scrollbar-thin">
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
                  <span className="text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-600/40 px-2.5 py-0.5 rounded-full">
                    Winner
                  </span>
                )}
              </div>

              {/* Itemized List */}
              <div className="flex flex-col gap-2 text-xs">
                <div className="font-semibold text-slate-400 uppercase tracking-wider text-xs">
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
                  <span className="text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-600/40 px-2.5 py-0.5 rounded-full">
                    Winner
                  </span>
                )}
              </div>

              {/* Itemized List */}
              <div className="flex flex-col gap-2 text-xs">
                <div className="font-semibold text-slate-400 uppercase tracking-wider text-xs">
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
        )}

        {/* MODAL FOOTER ACTION */}
        <div className="bg-slate-900/95 border-t border-slate-800 px-4 sm:px-6 py-2.5 sm:py-3 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="text-xs text-slate-400 font-medium truncate w-full sm:w-auto">
            <span>{`Starting Round ${round + 1}: `}</span>
            <span className="font-bold text-amber-300">
              {`${players[(round) % (players.length || 4)]?.name || `Player ${((round) % (players.length || 4)) + 1}`} (Seat ${((round) % (players.length || 4)) + 1})`}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
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
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
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
              className="w-full sm:w-auto h-10 sm:h-11 px-6 rounded-xl btn-game-primary font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <span>Next Round</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
