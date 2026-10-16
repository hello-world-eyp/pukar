import React from 'react';
import {
  MatchStats,
  Player,
  SanitizedPlayer,
  Team,
} from '../../engine/types';
import {
  calculateMatchMVP,
  getBiggestHeistAward,
  getChiefFeederAward,
} from '../../engine/match-analytics';
import { Trophy, Crown, TrendingUp, Shield, Zap, Flame } from 'lucide-react';

export interface MatchAnalyticsViewProps {
  matchStats?: MatchStats;
  players?: Array<Player | SanitizedPlayer>;
  winnerTeam?: Team | 'TIE' | null;
  roundScores?: { A: number; B: number };
  totalScores?: { A: number; B: number };
  className?: string;
}

export const MatchAnalyticsView: React.FC<MatchAnalyticsViewProps> = ({
  matchStats,
  players = [],
  winnerTeam,
  roundScores: _roundScores,
  totalScores,
  className = '',
}) => {
  const mvp = calculateMatchMVP(matchStats, players, winnerTeam);
  const heist = getBiggestHeistAward(matchStats, players);
  const feeder = getChiefFeederAward(matchStats, players);
  const longestSeq = matchStats?.longestSequence;
  const timeline = matchStats?.scoreTimeline || [];

  // SVG Chart Dimensions
  const chartWidth = 600;
  const chartHeight = 180;
  const paddingX = 45;
  const paddingY = 25;

  const maxScore = Math.max(
    100,
    ...timeline.map((t) => Math.max(t.scoreA, t.scoreB)),
    totalScores?.A ?? 0,
    totalScores?.B ?? 0
  );

  const getX = (idx: number, total: number) => {
    if (total <= 1) return chartWidth / 2;
    return paddingX + (idx / (total - 1)) * (chartWidth - paddingX * 2);
  };

  const getY = (score: number) => {
    return (
      chartHeight -
      paddingY -
      (Math.max(0, score) / Math.max(1, maxScore)) * (chartHeight - paddingY * 2)
    );
  };

  // Build SVG Points for Team A and Team B
  const pointsA = timeline.map((entry, idx) => `${getX(idx, timeline.length)},${getY(entry.scoreA)}`).join(' ');
  const pointsB = timeline.map((entry, idx) => `${getX(idx, timeline.length)},${getY(entry.scoreB)}`).join(' ');

  return (
    <div
      data-testid="match-analytics-view"
      className={`flex flex-col gap-6 text-slate-100 ${className}`}
    >
      {/* 1. SPOTLIGHT AWARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MVP AWARD */}
        <div
          data-testid="award-match-mvp"
          className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-amber-950/60 to-slate-900 border-2 border-amber-500/60 p-4 shadow-xl flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 -mr-4 -mt-4 w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between pb-2 border-b border-amber-500/30">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-400">
              <Trophy className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>Match MVP</span>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              ★ Top Performer
            </span>
          </div>

          <div className="my-3 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shrink-0">
              👑
            </div>
            <div className="min-w-0">
              <div className="text-base font-black text-white truncate">
                {mvp ? mvp.playerName : 'Unclaimed'}
              </div>
              <div className="text-xs font-bold text-amber-300/90 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                <span>Team {mvp?.team ?? 'A'}</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 bg-slate-950/60 rounded-xl p-2.5 border border-slate-800 flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Points Contributed:</span>
              <span className="font-bold text-emerald-400">{`+${mvp?.pointsContributed ?? 0}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Jokers Stolen:</span>
              <span className="font-bold text-amber-300">{mvp?.jokersStolen ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Pukars Claimed:</span>
              <span className="font-bold text-cyan-300">{mvp?.pukarsClaimed ?? 0}</span>
            </div>
          </div>
        </div>

        {/* BIGGEST HEIST AWARD */}
        <div
          data-testid="award-biggest-heist"
          className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-purple-950/60 to-slate-900 border-2 border-purple-500/50 p-4 shadow-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-2 border-b border-purple-500/30">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-purple-300">
              <Zap className="w-4 h-4 text-purple-400" />
              <span>Biggest Heist</span>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
              🃏 Joker Thief
            </span>
          </div>

          <div className="my-3 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-400/40 text-purple-300 flex items-center justify-center font-black text-xl shadow-lg shrink-0">
              🎭
            </div>
            <div className="min-w-0">
              <div className="text-base font-black text-white truncate">
                {heist ? heist.playerName : 'No Joker Heists'}
              </div>
              <div className="text-xs font-bold text-purple-300/90">
                {heist ? `${heist.jokersStolen} Jokers Snatched` : 'Zero Jokers retrieved'}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 bg-slate-950/60 rounded-xl p-2.5 border border-slate-800">
            <p className="text-slate-400 leading-snug">
              Replaced Natural Jokers on table sequences to snatch them directly into hand!
            </p>
          </div>
        </div>

        {/* LONGEST SEQUENCE */}
        <div
          data-testid="award-longest-sequence"
          className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-blue-950/60 to-slate-900 border-2 border-blue-500/50 p-4 shadow-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-2 border-b border-blue-500/30">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-blue-300">
              <Crown className="w-4 h-4 text-blue-400" />
              <span>Longest Run</span>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
              {longestSeq ? `${longestSeq.cardCount} Cards` : 'None'}
            </span>
          </div>

          <div className="my-3 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center font-black text-xl shadow-lg shrink-0">
              ♠
            </div>
            <div className="min-w-0">
              <div className="text-base font-black text-white truncate">
                {longestSeq ? longestSeq.description : 'No sequence formed'}
              </div>
              <div className="text-xs font-bold text-blue-300/90">
                {longestSeq ? `Team ${longestSeq.team} Masterpiece` : 'Keep playing to build!'}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 bg-slate-950/60 rounded-xl p-2.5 border border-slate-800">
            {longestSeq && longestSeq.cards && longestSeq.cards.length > 0 ? (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                {longestSeq.cards.slice(0, 7).map((c, i) => (
                  <span
                    key={`${c.id}-${i}`}
                    className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-200"
                  >
                    {c.rank === 0 ? '★' : c.rank === 14 ? 'A' : c.rank === 13 ? 'K' : c.rank === 12 ? 'Q' : c.rank === 11 ? 'J' : c.rank}
                  </span>
                ))}
                {longestSeq.cards.length > 7 && (
                  <span className="text-[10px] text-slate-400 font-bold">
                    +{longestSeq.cards.length - 7}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-slate-400 leading-snug">
                Construct sequences of 7 to 13 cards to earn 200–500 bonus points.
              </p>
            )}
          </div>
        </div>

        {/* CHIEF FEEDER AWARD */}
        <div
          data-testid="award-chief-feeder"
          className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-rose-950/60 to-slate-900 border-2 border-rose-500/50 p-4 shadow-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-2 border-b border-rose-500/30">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-rose-300">
              <Flame className="w-4 h-4 text-rose-400" />
              <span>Chief Feeder</span>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
              🎁 Generous Discarder
            </span>
          </div>

          <div className="my-3 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 flex items-center justify-center font-black text-xl shadow-lg shrink-0">
              🎯
            </div>
            <div className="min-w-0">
              <div className="text-base font-black text-white truncate">
                {feeder ? feeder.playerName : 'Clean Discards'}
              </div>
              <div className="text-xs font-bold text-rose-300/90">
                {feeder ? `${feeder.cardsFed} cards given to opponents` : 'No cards fed to opponents'}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 bg-slate-950/60 rounded-xl p-2.5 border border-slate-800">
            <p className="text-slate-400 leading-snug">
              Discards that were scooped up by opposing players from the bottom pile.
            </p>
          </div>
        </div>
      </div>

      {/* 2. SCORE PROGRESSION TIMELINE GRAPH */}
      <div
        data-testid="score-timeline-graph"
        className="rounded-2xl bg-slate-900/90 border-2 border-slate-800 p-5 shadow-2xl flex flex-col gap-4"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-black text-white">Score Progression Timeline</h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block shadow-sm shadow-blue-500/50" />
              <span className="text-blue-300">Team A</span>
              <span className="text-white font-black ml-1">
                ({totalScores?.A ?? timeline[timeline.length - 1]?.scoreA ?? 0} pts)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block shadow-sm shadow-amber-400/50" />
              <span className="text-amber-300">Team B</span>
              <span className="text-white font-black ml-1">
                ({totalScores?.B ?? timeline[timeline.length - 1]?.scoreB ?? 0} pts)
              </span>
            </div>
          </div>
        </div>

        {/* SVG Chart Container */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[500px]">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-44 overflow-visible"
            >
              {/* Grid Lines */}
              <line
                x1={paddingX}
                y1={paddingY}
                x2={chartWidth - paddingX}
                y2={paddingY}
                stroke="#334155"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <line
                x1={paddingX}
                y1={chartHeight / 2}
                x2={chartWidth - paddingX}
                y2={chartHeight / 2}
                stroke="#334155"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <line
                x1={paddingX}
                y1={chartHeight - paddingY}
                x2={chartWidth - paddingX}
                y2={chartHeight - paddingY}
                stroke="#475569"
                strokeWidth="1.5"
              />

              {/* Y Axis Labels */}
              <text x={paddingX - 8} y={paddingY + 4} fill="#64748b" fontSize="10" textAnchor="end" fontWeight="bold">
                {maxScore}
              </text>
              <text x={paddingX - 8} y={chartHeight / 2 + 3} fill="#64748b" fontSize="10" textAnchor="end" fontWeight="bold">
                {Math.round(maxScore / 2)}
              </text>
              <text x={paddingX - 8} y={chartHeight - paddingY + 3} fill="#64748b" fontSize="10" textAnchor="end" fontWeight="bold">
                0
              </text>

              {/* Team A Polyline & Markers */}
              {timeline.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pointsA}
                />
              )}
              {timeline.map((entry, idx) => {
                const cx = getX(idx, timeline.length);
                const cy = getY(entry.scoreA);
                return (
                  <g key={`marker-a-${idx}`}>
                    <circle cx={cx} cy={cy} r="5" fill="#1d4ed8" stroke="#60a5fa" strokeWidth="2" />
                    <text
                      x={cx}
                      y={cy - 10}
                      fill="#93c5fd"
                      fontSize="10"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {entry.scoreA}
                    </text>
                  </g>
                );
              })}

              {/* Team B Polyline & Markers */}
              {timeline.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pointsB}
                />
              )}
              {timeline.map((entry, idx) => {
                const cx = getX(idx, timeline.length);
                const cy = getY(entry.scoreB);
                return (
                  <g key={`marker-b-${idx}`}>
                    <circle cx={cx} cy={cy} r="5" fill="#b45309" stroke="#fcd34d" strokeWidth="2" />
                    <text
                      x={cx}
                      y={cy + 18}
                      fill="#fde68a"
                      fontSize="10"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {entry.scoreB}
                    </text>
                  </g>
                );
              })}

              {/* X Axis Round Labels */}
              {timeline.map((entry, idx) => {
                const cx = getX(idx, timeline.length);
                return (
                  <text
                    key={`round-label-${idx}`}
                    x={cx}
                    y={chartHeight - 6}
                    fill="#94a3b8"
                    fontSize="10"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    Round {entry.round}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
