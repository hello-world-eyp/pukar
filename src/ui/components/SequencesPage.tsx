import React, { useState, useMemo } from 'react';
import { Meld, Team } from '../../engine/types';
import { evaluateMeldScore } from '../../engine/meld-validator';
import { PlayingCard, getRankLabel, getSuitSymbol } from './PlayingCard';
import { sortMelds, MeldSortDirection } from './TableMeldBoard';
import {
  Shield,
  Sparkles,
  CheckCircle2,
  ArrowDownUp,
  ArrowLeft,
  Layers,
  ZoomIn,
} from 'lucide-react';

export interface SequencesPageProps {
  melds: {
    A: Meld[];
    B: Meld[];
  };
  activeTeam?: Team;
  onBackToTable: () => void;
  onZoomMeld?: (meld: Meld) => void;
  players?: { id: string; name: string; team: Team }[];
  className?: string;
}

export const SequencesPage: React.FC<SequencesPageProps> = ({
  melds,
  activeTeam: _activeTeam,
  onBackToTable,
  onZoomMeld,
  players = [],
  className = '',
}) => {
  const [sortDirection, setSortDirection] = useState<MeldSortDirection>('desc');
  const [teamFilter, setTeamFilter] = useState<'ALL' | 'A' | 'B'>('ALL');

  const listA = melds?.A ?? [];
  const listB = melds?.B ?? [];

  const calculatePoints = (meldList: Meld[]) => {
    return (meldList || []).reduce((sum, m) => {
      try {
        return sum + evaluateMeldScore(m).points;
      } catch {
        return sum;
      }
    }, 0);
  };

  const pointsA = calculatePoints(listA);
  const pointsB = calculatePoints(listB);

  const teamAPlayers = players.filter((p) => p.team === 'A');
  const teamBPlayers = players.filter((p) => p.team === 'B');

  const sortedA = useMemo(() => sortMelds(listA, sortDirection), [listA, sortDirection]);
  const sortedB = useMemo(() => sortMelds(listB, sortDirection), [listB, sortDirection]);

  return (
    <div
      data-testid="sequences-page"
      className={`w-full max-w-[2400px] 2xl:max-w-[2800px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col gap-6 text-slate-100 ${className}`}
    >
      {/* =====================================================================
          1. HEADER CONTROLS BAR
      ====================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl backdrop-blur-md">
        {/* Left: Back Button & Title */}
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
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-lime-400" />
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white">
                Sequences
              </h1>
              <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                Enlarged View
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 font-medium hidden sm:block mt-0.5">
              Detailed inspection of all card sequences laid down on the table.
            </p>
          </div>
        </div>

        {/* Right: Filter Pills & Sort Toggle */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* Team Filter Pills */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              data-testid="filter-all"
              onClick={() => setTeamFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                teamFilter === 'ALL'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Teams
            </button>
            <button
              type="button"
              data-testid="filter-team-a"
              onClick={() => setTeamFilter('A')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                teamFilter === 'A'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-blue-300'
              }`}
            >
              Team A ({listA.length})
            </button>
            <button
              type="button"
              data-testid="filter-team-b"
              onClick={() => setTeamFilter('B')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                teamFilter === 'B'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              Team B ({listB.length})
            </button>
          </div>

          {/* Sort Direction Toggle */}
          <button
            type="button"
            data-testid="btn-sequences-sort-toggle"
            onClick={() => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-bold text-slate-200 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Toggle sequence card order"
          >
            <ArrowDownUp className="w-3.5 h-3.5 text-lime-400" />
            <span>{sortDirection === 'desc' ? 'High → Low' : 'Low → High'}</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          2. SUMMARY SCORE BAR
      ====================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Team A Summary Pill */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-blue-950/40 border border-blue-500/40 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-300 border border-blue-400/50 flex items-center justify-center font-black">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-sm sm:text-base text-blue-200">
                Team A Sequences
              </div>
              <div className="text-xs text-blue-300/80">
                {teamAPlayers.length > 0
                  ? teamAPlayers.map((p) => p.name).join(' & ')
                  : 'Players 1 & 3'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl sm:text-2xl font-black text-white">
              {pointsA} pts
            </span>
            <div className="text-xs font-bold text-blue-300">
              {listA.length} {listA.length === 1 ? 'sequence' : 'sequences'}
            </div>
          </div>
        </div>

        {/* Team B Summary Pill */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-600/30 text-amber-300 border border-amber-400/50 flex items-center justify-center font-black">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-sm sm:text-base text-amber-200">
                Team B Sequences
              </div>
              <div className="text-xs text-amber-300/80">
                {teamBPlayers.length > 0
                  ? teamBPlayers.map((p) => p.name).join(' & ')
                  : 'Players 2 & 4'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl sm:text-2xl font-black text-white">
              {pointsB} pts
            </span>
            <div className="text-xs font-bold text-amber-300">
              {listB.length} {listB.length === 1 ? 'sequence' : 'sequences'}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. SEQUENCES SECTIONS (TEAM A & TEAM B)
      ====================================================================== */}
      <div className="flex flex-col gap-8">
        {/* TEAM A SECTION */}
        {(teamFilter === 'ALL' || teamFilter === 'A') && (
          <section data-testid="section-team-a-sequences" className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-blue-500/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <h2 className="text-base sm:text-lg font-black text-blue-300 uppercase tracking-wider">
                  Team A Sequences ({listA.length})
                </h2>
              </div>
              <span className="text-xs sm:text-sm font-bold text-blue-400">
                Total Score: {pointsA} pts
              </span>
            </div>

            {sortedA.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/40 border-2 border-dashed border-slate-800 text-center flex flex-col items-center justify-center gap-2">
                <Layers className="w-8 h-8 text-slate-600" />
                <div className="font-bold text-slate-400 text-sm">
                  No sequences placed yet by Team A
                </div>
                <div className="text-xs text-slate-500">
                  Melds placed during the game will be enlarged here with full details.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {sortedA.map((meld) => (
                  <EnlargedMeldCard
                    key={meld.id}
                    meld={meld}
                    sortDirection={sortDirection}
                    onZoom={onZoomMeld}
                    team="A"
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* TEAM B SECTION */}
        {(teamFilter === 'ALL' || teamFilter === 'B') && (
          <section data-testid="section-team-b-sequences" className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <h2 className="text-base sm:text-lg font-black text-amber-300 uppercase tracking-wider">
                  Team B Sequences ({listB.length})
                </h2>
              </div>
              <span className="text-xs sm:text-sm font-bold text-amber-400">
                Total Score: {pointsB} pts
              </span>
            </div>

            {sortedB.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/40 border-2 border-dashed border-slate-800 text-center flex flex-col items-center justify-center gap-2">
                <Layers className="w-8 h-8 text-slate-600" />
                <div className="font-bold text-slate-400 text-sm">
                  No sequences placed yet by Team B
                </div>
                <div className="text-xs text-slate-500">
                  Melds placed during the game will be enlarged here with full details.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {sortedB.map((meld) => (
                  <EnlargedMeldCard
                    key={meld.id}
                    meld={meld}
                    sortDirection={sortDirection}
                    onZoom={onZoomMeld}
                    team="B"
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

interface EnlargedMeldCardProps {
  meld: Meld;
  sortDirection: MeldSortDirection;
  onZoom?: (meld: Meld) => void;
  team: 'A' | 'B';
}

const EnlargedMeldCard: React.FC<EnlargedMeldCardProps> = ({
  meld,
  sortDirection,
  onZoom,
  team,
}) => {
  const evaluation = evaluateMeldScore(meld);
  const { isComplete7, isPure13, points, description } = evaluation;

  // Determine Badge Styling
  let badgeText = description;
  let badgeClass = 'bg-slate-800 text-slate-200 border-slate-700';

  if (isPure13) {
    badgeText = 'Pure 2-to-A Run (500 pts)';
    badgeClass =
      'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black border-yellow-300 shadow-md';
  } else if (isComplete7) {
    const isClean = !meld.cards.some((c) => c.isNaturalJoker || c.rank === 0 || c.rank === 2);
    if (meld.type === 'RUN') {
      badgeText = isClean ? 'Clean Run (200 pts)' : 'Dirty Run (100 pts)';
      badgeClass = isClean
        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60 font-black shadow-sm'
        : 'bg-blue-950/90 text-blue-300 border-blue-500/60 font-black shadow-sm';
    } else {
      badgeText = isClean ? 'Clean 7-of-a-Kind (200 pts)' : 'Dirty 7-of-a-Kind (100 pts)';
      badgeClass = isClean
        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60 font-black shadow-sm'
        : 'bg-blue-950/90 text-blue-300 border-blue-500/60 font-black shadow-sm';
    }
  }

  // Sorted slots
  const sortedSlots = useMemo(() => {
    if (!meld.slots || meld.slots.length === 0) {
      const cards = [...(meld.cards || [])];
      return cards
        .sort((a, b) => (sortDirection === 'desc' ? b.rank - a.rank : a.rank - b.rank))
        .map((c) => ({
          card: c,
          representedRank: c.rank,
          representedSuit: c.suit ?? undefined,
          isWildcard: false,
        }));
    }

    const slotsCopy = [...meld.slots];
    return slotsCopy.sort((a, b) => {
      if (sortDirection === 'desc') {
        return b.representedRank - a.representedRank;
      } else {
        return a.representedRank - b.representedRank;
      }
    });
  }, [meld.slots, meld.cards, sortDirection]);

  // Check for wildcards
  const wildcardSlot = sortedSlots.find((s) => s.isWildcard);

  return (
    <div
      data-testid={`enlarged-meld-${meld.id}`}
      className={`rounded-2xl p-4 sm:p-5 border flex flex-col gap-3.5 shadow-xl transition-all ${
        team === 'A'
          ? 'bg-slate-900/85 border-blue-500/30 hover:border-blue-500/60'
          : 'bg-slate-900/85 border-amber-500/30 hover:border-amber-500/60'
      }`}
    >
      {/* Sequence Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Points / Type Badge */}
          <span
            className={`text-xs sm:text-sm px-3 py-1 rounded-full border flex items-center gap-1.5 font-bold ${badgeClass}`}
          >
            {isPure13 && <Sparkles className="w-3.5 h-3.5" />}
            {isComplete7 && !isPure13 && <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{badgeText}</span>
          </span>

          {/* Suit Tag */}
          {meld.suit && (
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700">
              {getSuitSymbol(meld.suit)} {meld.suit}
            </span>
          )}

          {/* Card Count */}
          <span className="text-xs font-bold text-slate-400">
            {meld.cards.length} cards
          </span>
        </div>

        {/* Score & Zoom Button */}
        <div className="flex items-center gap-2">
          <span className="text-base sm:text-lg font-black text-amber-300 bg-slate-950 px-3 py-0.5 rounded-xl border border-slate-800">
            +{points} pts
          </span>
          {onZoom && (
            <button
              type="button"
              data-testid={`btn-zoom-${meld.id}`}
              onClick={() => onZoom(meld)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              title="Zoom in modal"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Wildcard substitution callout if present */}
      {wildcardSlot && (
        <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 flex items-center gap-2">
          <span>🃏 Wildcard in play:</span>
          <span className="font-bold text-white">
            {wildcardSlot.card.isNaturalJoker ? 'Natural Joker' : `2 of ${wildcardSlot.card.suit ?? ''}`}
          </span>
          <span>substituting for</span>
          <span className="font-extrabold text-amber-300 underline underline-offset-2">
            {getRankLabel(wildcardSlot.representedRank)} of{' '}
            {wildcardSlot.representedSuit ?? meld.suit ?? wildcardSlot.card.suit} (
            {getSuitSymbol(wildcardSlot.representedSuit ?? meld.suit ?? wildcardSlot.card.suit)})
          </span>
        </div>
      )}

      {/* Enlarged Cards Row */}
      <div
        data-testid={`enlarged-cards-row-${meld.id}`}
        className="flex items-center overflow-x-auto pt-2 pb-3 px-2 scrollbar-thin rounded-xl bg-slate-950/60 border border-slate-800/80"
      >
        {sortedSlots.map((slot, index) => {
          const card = slot.card;
          const isSlotWild = slot.isWildcard;
          let wildLabel: string | undefined = undefined;

          if (isSlotWild) {
            const repRank = getRankLabel(slot.representedRank);
            const repSuit = getSuitSymbol(slot.representedSuit ?? meld.suit ?? card.suit);
            wildLabel = `Wild (${repRank}${repSuit})`;
          }

          return (
            <div
              key={`${card.id}-${slot.representedRank}-${index}`}
              style={{
                marginLeft: index === 0 ? 0 : '-20px',
                zIndex: index + 1,
              }}
              className="relative transition-transform hover:-translate-y-3 hover:!z-30 shrink-0"
            >
              <PlayingCard
                card={card}
                size="lg"
                isWild={isSlotWild}
                representedRank={slot.representedRank}
                representedSuit={slot.representedSuit}
                wildcardLabel={wildLabel}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
