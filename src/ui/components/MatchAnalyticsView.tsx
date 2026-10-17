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

  // SVG Chart Dimensions - Expanded for wide cinematic layout
  const chartWidth = 900;
  const chartHeight = 220;
  const paddingX = 60;
  const paddingYTop = 30;
  const paddingYBottom = 45;

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
      paddingYBottom -
      (Math.max(0, score) / Math.max(1, maxScore)) * (chartHeight - paddingYTop - paddingYBottom)
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* MVP AWARD */}
        <div
          data-testid="award-match-mvp"
          className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-amber-950/60 to-slate-900 border-2 border-amber-500/60 p-5 shadow-xl flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between pb-2.5 border-b border-amber-500/30">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-400">
              <Trophy className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>Match MVP</span>
            </div>
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              ★ Top Performer
            </span>
          </div>

          <div className="my-3.5 flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg shrink-0">
              👑
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black text-white truncate">
                {mvp ? mvp.playerName : 'Unclaimed'}
              </div>
              <div className="text-xs font-bold text-amber-300/90 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                <span>Team {mvp?.team ?? 'A'}</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 bg-slate-950/70 rounded-xl p-3 border border-slate-800 flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Points Contributed:</span>
              <span className="font-bold text-emerald-400 font-mono text-xs">{`+${mvp?.pointsContributed ?? 0}`}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Jokers Stolen:</span>
              <span className="font-bold text-amber-300 font-mono text-xs">{mvp?.jokersStolen ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Pukars Claimed:</span>
              <span className="font-bold text-cyan-300 font-mono text-xs">{mvp?.pukarsClaimed ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Sequences Melded:</span>
              <span className="font-bold text-indigo-300 font-mono text-xs">{mvp?.meldsCreated ?? 0}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-800 text-slate-200 font-semibold">
              <span className="text-slate-400">Impact Score:</span>
              <span className="font-black text-amber-300 font-mono text-xs">{mvp?.compositeScore ?? 0} pts</span>
            </div>
          </div>
        </div>

        {/* BIGGEST HEIST AWARD */}
        <div
          data-testid="award-biggest-heist"
          className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-purple-950/60 to-slate-900 border-2 border-purple-500/50 p-5 shadow-xl flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between pb-2.5 border-b border-purple-500/30">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-purple-300">
              <Zap className="w-4 h-4 text-purple-400" />
              <span>Biggest Heist</span>
            </div>
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
              🃏 Joker Thief
            </span>
          </div>

          <div className="my-3.5 flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-400/40 text-purple-300 flex items-center justify-center font-black text-2xl shadow-lg shrink-0">
              🎭
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black text-white truncate">
                {heist ? heist.playerName : 'No Joker Heists'}
              </div>
              <div className="text-xs font-bold text-purple-300/90 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                <span>Team {heist?.team ?? 'A'}</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 bg-slate-950/70 rounded-xl p-3 border border-slate-800 flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Heists:</span>
              <span className="font-bold text-purple-300 font-mono text-xs">
                {heist ? `${heist.jokersStolen} Jokers Snatched` : '0 Jokers'}
              </span>
            </div>
            <p className="text-slate-400 text-[10px] leading-snug pt-1 border-t border-slate-800">
              Replaced Natural Jokers on table sequences to snatch wildcards directly into hand!
            </p>
          </div>
        </div>

        {/* LONGEST SEQUENCE */}
        <div
          data-testid="award-longest-sequence"
          className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-blue-950/60 to-slate-900 border-2 border-blue-500/50 p-5 shadow-xl flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between pb-2.5 border-b border-blue-500/30">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-blue-300">
              <Crown className="w-4 h-4 text-blue-400" />
              <span>Longest Run</span>
            </div>
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
              {longestSeq ? `${longestSeq.cardCount} Cards` : 'None'}
            </span>
          </div>

          <div className="my-3.5 flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center font-black text-2xl shadow-lg shrink-0">
              ♠
            </div>
            <div className="min-w-0">
              <div className="text-base font-black text-white leading-snug">
                {longestSeq ? longestSeq.description : 'No sequence formed'}
              </div>
              <div className="text-xs font-bold text-blue-300/90 flex items-center gap-1 mt-0.5">
                <Shield className="w-3.5 h-3.5" />
                <span>{longestSeq ? `Team ${longestSeq.team} Masterpiece` : 'Keep playing to build!'}</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 bg-slate-950/70 rounded-xl p-3 border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-semibold">
              <span>Sequence Cards</span>
              <span>{longestSeq?.cardCount ?? 0} total</span>
            </div>
            {longestSeq && longestSeq.cards && longestSeq.cards.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap max-h-20 overflow-y-auto scrollbar-thin">
                {longestSeq.cards.map((c, i) => {
                  const isRed = c.suit === 'HEARTS' || c.suit === 'DIAMONDS';
                  const suitIcon =
                    c.suit === 'HEARTS' ? '♥' :
                    c.suit === 'DIAMONDS' ? '♦' :
                    c.suit === 'CLUBS' ? '♣' :
                    c.suit === 'SPADES' ? '♠' : '★';
                  const rankText =
                    c.rank === 0 ? '★' :
                    c.rank === 14 ? 'A' :
                    c.rank === 13 ? 'K' :
                    c.rank === 12 ? 'Q' :
                    c.rank === 11 ? 'J' :
                    c.rank;
                  return (
                    <span
                      key={`${c.id}-${i}`}
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[11px] font-bold shadow-sm ${
                        c.rank === 0
                          ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                          : isRed
                          ? 'bg-rose-950/40 border-rose-500/40 text-rose-400'
                          : 'bg-slate-900 border-slate-700 text-slate-200'
                      }`}
                    >
                      <span>{rankText}</span>
                      <span className="text-[10px]">{suitIcon}</span>
                    </span>
                  );
                })}
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
          className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-rose-950/60 to-slate-900 border-2 border-rose-500/50 p-5 shadow-xl flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between pb-2.5 border-b border-rose-500/30">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-rose-300">
              <Flame className="w-4 h-4 text-rose-400" />
              <span>Chief Feeder</span>
            </div>
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
              🎁 Generous Discarder
            </span>
          </div>

          <div className="my-3.5 flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-400/40 text-rose-300 flex items-center justify-center font-black text-2xl shadow-lg shrink-0">
              🎯
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black text-white truncate">
                {feeder ? feeder.playerName : 'Clean Discards'}
              </div>
              <div className="text-xs font-bold text-rose-300/90 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                <span>Team {feeder?.team ?? 'B'}</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 bg-slate-950/70 rounded-xl p-3 border border-slate-800 flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Cards Scooped:</span>
              <span className="font-bold text-rose-300 font-mono text-xs">
                {feeder ? `${feeder.cardsFed} cards given to opponents` : '0 cards'}
              </span>
            </div>
            <p className="text-slate-400 text-[10px] leading-snug pt-1 border-t border-slate-800">
              Discards that were scooped up by opposing players from the bottom pile.
            </p>
          </div>
        </div>
      </div>

      {/* 2. SCORE PROGRESSION TIMELINE GRAPH */}
      <div
        data-testid="score-timeline-graph"
        className="rounded-2xl bg-slate-900/90 border-2 border-slate-800 p-6 shadow-2xl flex flex-col gap-5"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-black text-white">Score Progression Timeline</h3>
          </div>
          <div className="flex items-center gap-5 text-xs font-bold">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-blue-500 inline-block shadow-sm shadow-blue-500/50" />
              <span className="text-blue-300">Team A</span>
              <span className="text-white font-black ml-1 text-sm font-mono">
                ({totalScores?.A ?? timeline[timeline.length - 1]?.scoreA ?? 0} pts)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-amber-400 inline-block shadow-sm shadow-amber-400/50" />
              <span className="text-amber-300">Team B</span>
              <span className="text-white font-black ml-1 text-sm font-mono">
                ({totalScores?.B ?? timeline[timeline.length - 1]?.scoreB ?? 0} pts)
              </span>
            </div>
          </div>
        </div>

        {/* SVG Chart Container */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[650px]">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-52 overflow-visible"
            >
              {/* Grid Lines */}
              <line
                x1={paddingX}
                y1={paddingYTop}
                x2={chartWidth - paddingX}
                y2={paddingYTop}
                stroke="#334155"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <line
                x1={paddingX}
                y1={(chartHeight - paddingYBottom + paddingYTop) / 2}
                x2={chartWidth - paddingX}
                y2={(chartHeight - paddingYBottom + paddingYTop) / 2}
                stroke="#334155"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <line
                x1={paddingX}
                y1={chartHeight - paddingYBottom}
                x2={chartWidth - paddingX}
                y2={chartHeight - paddingYBottom}
                stroke="#475569"
                strokeWidth="1.5"
              />

              {/* Y Axis Labels */}
              <text x={paddingX - 10} y={paddingYTop + 4} fill="#64748b" fontSize="11" textAnchor="end" fontWeight="bold">
                {maxScore}
              </text>
              <text x={paddingX - 10} y={(chartHeight - paddingYBottom + paddingYTop) / 2 + 4} fill="#64748b" fontSize="11" textAnchor="end" fontWeight="bold">
                {Math.round(maxScore / 2)}
              </text>
              <text x={paddingX - 10} y={chartHeight - paddingYBottom + 4} fill="#64748b" fontSize="11" textAnchor="end" fontWeight="bold">
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
                    <circle cx={cx} cy={cy} r="6" fill="#1d4ed8" stroke="#60a5fa" strokeWidth="2.5" />
                    <text
                      x={cx}
                      y={cy - 12}
                      fill="#93c5fd"
                      fontSize="11"
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
                    <circle cx={cx} cy={cy} r="6" fill="#b45309" stroke="#fcd34d" strokeWidth="2.5" />
                    <text
                      x={cx}
                      y={cy + 18}
                      fill="#fde68a"
                      fontSize="11"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {entry.scoreB}
                    </text>
                  </g>
                );
              })}

              {/* X Axis Round Labels - positioned cleanly below Team B baseline score */}
              {timeline.map((entry, idx) => {
                const cx = getX(idx, timeline.length);
                return (
                  <text
                    key={`round-label-${idx}`}
                    x={cx}
                    y={chartHeight - 12}
                    fill="#94a3b8"
                    fontSize="11"
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

        {/* Round Progression Milestones Cards */}
        {timeline.length > 0 && (
          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Round Progression Milestones
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {timeline.map((entry, idx) => {
                const prevA = idx > 0 ? timeline[idx - 1].scoreA : 0;
                const prevB = idx > 0 ? timeline[idx - 1].scoreB : 0;
                const diffA = entry.scoreA - prevA;
                const diffB = entry.scoreB - prevB;
                const leader = entry.scoreA > entry.scoreB ? 'A' : entry.scoreB > entry.scoreA ? 'B' : 'TIED';
                return (
                  <div
                    key={`round-card-${idx}`}
                    className="bg-slate-950/70 rounded-xl p-3 border border-slate-800 flex flex-col gap-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                      <span className="text-[11px] font-black text-white">Round {entry.round}</span>
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                          leader === 'A'
                            ? 'bg-blue-500/20 text-blue-300'
                            : leader === 'B'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {leader === 'TIED' ? 'Tied' : `Team ${leader}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-blue-300 font-bold">Team A</span>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="font-black text-white">{entry.scoreA}</span>
                        {idx > 0 && (
                          <span className={`text-[10px] ${diffA >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {diffA >= 0 ? `+${diffA}` : diffA}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-300 font-bold">Team B</span>
                      <div className="flex items-center gap-1 font-mono">
                        <span className="font-black text-white">{entry.scoreB}</span>
                        {idx > 0 && (
                          <span className={`text-[10px] ${diffB >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {diffB >= 0 ? `+${diffB}` : diffB}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

