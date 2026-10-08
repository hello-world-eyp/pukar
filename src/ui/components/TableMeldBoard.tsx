import React, { useState, useMemo } from 'react';
import { Meld, Team, Suit, Card } from '../../engine/types';
import { evaluateMeldScore, canAddCardsToMeld } from '../../engine/meld-validator';
import { PlayingCard, getRankLabel, getSuitSymbol } from './PlayingCard';
import { Shield, Sparkles, CheckCircle2, PlusCircle, ArrowDownUp, ZoomIn } from 'lucide-react';

export type MeldSortDirection = 'desc' | 'asc';

const SUIT_SORT_ORDER: Record<string, number> = {
  SPADES: 1,
  HEARTS: 2,
  CLUBS: 3,
  DIAMONDS: 4,
};

export interface TableMeldBoardProps {
  melds?: {
    A: Meld[];
    B: Meld[];
  };
  teamAMelds?: Meld[];
  teamBMelds?: Meld[];
  activeTeam?: Team;
  selectedMeldId?: string | null;
  onSelectMeld?: (meld: Meld) => void;
  onZoomMeld?: (meld: Meld) => void;
  selectedCards?: Card[];
  selectedCardIds?: string[];
  allHandCards?: Card[];
  canAdd?: boolean;
  onAddToMeld?: (meldId: string, cardIds: string[]) => void;
  className?: string;
  defaultSortDirection?: MeldSortDirection;
  cardSize?: 'sm' | 'md';
  isRippling?: boolean;
}

export const TableMeldBoard: React.FC<TableMeldBoardProps> = ({
  melds,
  teamAMelds,
  teamBMelds,
  activeTeam,
  selectedMeldId,
  onSelectMeld,
  onZoomMeld,
  selectedCards,
  selectedCardIds,
  allHandCards,
  canAdd = true,
  onAddToMeld,
  className = '',
  defaultSortDirection = 'desc',
  cardSize = 'md',
  isRippling = false,
}) => {
  const [sortDirection, setSortDirection] = useState<MeldSortDirection>(defaultSortDirection);

  const effectiveSelectedCards = useMemo(() => {
    try {
      if (selectedCards && Array.isArray(selectedCards)) {
        return selectedCards;
      }
      if (selectedCardIds && allHandCards) {
        const idSet = new Set(selectedCardIds);
        return allHandCards.filter((c) => idSet.has(c.id));
      }
      return [];
    } catch {
      return [];
    }
  }, [selectedCards, selectedCardIds, allHandCards]);

  const listA = melds?.A ?? teamAMelds ?? [];
  const listB = melds?.B ?? teamBMelds ?? [];

  const calculateTeamPoints = (teamMelds: Meld[]) => {
    try {
      return (teamMelds || []).reduce((sum, m) => {
        try {
          return sum + evaluateMeldScore(m).points;
        } catch {
          return sum;
        }
      }, 0);
    } catch (err) {
      console.error('Error calculating team meld points:', err);
      return 0;
    }
  };

  const scoreA = calculateTeamPoints(listA);
  const scoreB = calculateTeamPoints(listB);

  return (
    <div className={`w-full flex flex-col gap-3 ${className}`}>
      {/* Board Controls Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300">Table Sequences</span>
          <span className="text-[11px] text-slate-500">•</span>
          <span className="text-[11px] text-slate-400">
            {sortDirection === 'desc' ? 'Sorted Highest to Lowest' : 'Sorted Lowest to Highest'}
          </span>
        </div>
        <button
          type="button"
          data-testid="btn-toggle-meld-sort"
          onClick={() => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
          title="Toggle sequence card order between Highest to Lowest and Lowest to Highest"
        >
          <ArrowDownUp className="w-3.5 h-3.5 text-amber-400" />
          <span>{sortDirection === 'desc' ? 'Sort: High → Low' : 'Sort: Low → High'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* TEAM A MELDS COLUMN */}
        <TeamMeldColumn
          team="A"
          teamName="Team A"
          teamColor="blue"
          melds={listA}
          score={scoreA}
          isActive={activeTeam === 'A'}
          selectedMeldId={selectedMeldId}
          onSelectMeld={onSelectMeld}
          onZoomMeld={onZoomMeld}
          sortDirection={sortDirection}
          cardSize={cardSize}
          selectedCards={effectiveSelectedCards}
          allHandCards={allHandCards}
          canAdd={canAdd}
          onAddToMeld={onAddToMeld}
          isRippling={isRippling}
        />

        {/* TEAM B MELDS COLUMN */}
        <TeamMeldColumn
          team="B"
          teamName="Team B"
          teamColor="amber"
          melds={listB}
          score={scoreB}
          isActive={activeTeam === 'B'}
          selectedMeldId={selectedMeldId}
          onSelectMeld={onSelectMeld}
          onZoomMeld={onZoomMeld}
          sortDirection={sortDirection}
          cardSize={cardSize}
          selectedCards={effectiveSelectedCards}
          allHandCards={allHandCards}
          canAdd={canAdd}
          onAddToMeld={onAddToMeld}
          isRippling={isRippling}
        />
      </div>
    </div>
  );
};

interface TeamMeldColumnProps {
  team: Team;
  teamName: string;
  teamColor: 'blue' | 'amber';
  melds: Meld[];
  score: number;
  isActive: boolean;
  selectedMeldId?: string | null;
  onSelectMeld?: (meld: Meld) => void;
  onZoomMeld?: (meld: Meld) => void;
  sortDirection: MeldSortDirection;
  cardSize?: 'sm' | 'md';
  selectedCards?: Card[];
  allHandCards?: Card[];
  canAdd?: boolean;
  onAddToMeld?: (meldId: string, cardIds: string[]) => void;
  isRippling?: boolean;
}

export function sortMelds(
  melds: Meld[],
  cardSortDirection: MeldSortDirection = 'desc'
): Meld[] {
  try {
    if (!melds || !Array.isArray(melds)) return [];

    return [...melds].sort((a, b) => {
      // 1. Primary sort: By Suit in order Spades (1), Hearts (2), Clubs (3), Diamonds (4), Sets/None (5)
      const suitKeyA = a.suit ? (a.suit.toUpperCase() as Suit) : null;
      const suitKeyB = b.suit ? (b.suit.toUpperCase() as Suit) : null;
      const suitRankA = suitKeyA && SUIT_SORT_ORDER[suitKeyA] ? SUIT_SORT_ORDER[suitKeyA] : 5;
      const suitRankB = suitKeyB && SUIT_SORT_ORDER[suitKeyB] ? SUIT_SORT_ORDER[suitKeyB] : 5;

      if (suitRankA !== suitRankB) {
        return suitRankA - suitRankB;
      }

      // 2. Secondary sort: If two melds have the SAME suit (or both are Sets)
      // Sort by the highest represented rank in the meld (descending by default)
      const getMaxRank = (m: Meld): number => {
        if (m.slots && m.slots.length > 0) {
          return Math.max(...m.slots.map((s) => s.representedRank));
        }
        if (m.cards && m.cards.length > 0) {
          return Math.max(...m.cards.map((c) => c.rank));
        }
        return m.rank ?? 0;
      };

      const getMinRank = (m: Meld): number => {
        if (m.slots && m.slots.length > 0) {
          return Math.min(...m.slots.map((s) => s.representedRank));
        }
        if (m.cards && m.cards.length > 0) {
          return Math.min(...m.cards.map((c) => c.rank));
        }
        return m.rank ?? 0;
      };

      const maxA = getMaxRank(a);
      const maxB = getMaxRank(b);

      if (maxA !== maxB) {
        return cardSortDirection === 'desc' ? maxB - maxA : maxA - maxB;
      }

      const minA = getMinRank(a);
      const minB = getMinRank(b);
      if (minA !== minB) {
        return cardSortDirection === 'desc' ? minB - minA : minA - minB;
      }

      return a.id.localeCompare(b.id);
    });
  } catch (err) {
    console.error('Error in sortMelds:', err);
    return melds || [];
  }
}

const TeamMeldColumn: React.FC<TeamMeldColumnProps> = ({
  team,
  teamName,
  teamColor,
  melds,
  score,
  isActive,
  selectedMeldId,
  onSelectMeld,
  onZoomMeld,
  sortDirection,
  cardSize = 'md',
  selectedCards,
  allHandCards,
  canAdd = true,
  onAddToMeld,
  isRippling = false,
}) => {
  const isBlue = teamColor === 'blue';

  const headerBorder = isBlue ? 'border-blue-500/30' : 'border-amber-500/30';
  const headerBg = isBlue ? 'bg-blue-950/40' : 'bg-amber-950/40';
  const headerTextColor = isBlue ? 'text-blue-400' : 'text-amber-400';
  const activeRing = isBlue ? 'ring-2 ring-blue-500/50' : 'ring-2 ring-amber-500/50';

  const sortedMelds = useMemo(() => {
    return sortMelds(melds, sortDirection);
  }, [melds, sortDirection]);

  return (
    <div
      data-team={team}
      className={`rounded-2xl border ${headerBorder} bg-slate-900/80 p-4 flex flex-col gap-4 shadow-xl backdrop-blur-sm transition-all ${
        isActive ? activeRing : ''
      }`}
    >
      {/* Column Header */}
      <div
        className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${headerBg} border ${headerBorder}`}
      >
        <div className="flex items-center gap-2">
          <Shield className={`w-4 h-4 ${headerTextColor}`} />
          <h3 className={`font-bold text-sm tracking-wide ${headerTextColor}`}>
            {teamName}
          </h3>
          {isActive && (
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30">
              Active Turn
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">
            {`${melds.length} ${melds.length === 1 ? 'sequence' : 'sequences'}`}
          </span>
          <span className="font-extrabold px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700">
            {`${score} pts`}
          </span>
        </div>
      </div>

      {/* Sequences List */}
      <div className="flex flex-col gap-3 min-h-[160px]">
        {sortedMelds.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 text-xs text-center">
            <p className="font-medium">No sequences placed yet</p>
            <p className="text-[11px] text-slate-600 mt-1">
              {`Sequences placed by ${teamName} will appear here.`}
            </p>
          </div>
        ) : (
          sortedMelds.map((meld) => {
            const isSelected = selectedMeldId === meld.id;
            const evaluation = evaluateMeldScore(meld);

            // Check if all selected cards can be added to this sequence
            const isOwnTeam = isActive;
            const willLeaveEmptyHand = Boolean(
              allHandCards &&
                allHandCards.length > 0 &&
                selectedCards &&
                selectedCards.length >= allHandCards.length
            );
            const canAttemptAdd = Boolean(
              canAdd &&
                isOwnTeam &&
                selectedCards &&
                selectedCards.length > 0 &&
                !willLeaveEmptyHand
            );
            const addValidation = canAttemptAdd
              ? canAddCardsToMeld(meld, selectedCards!)
              : { valid: false };
            const isEligibleToAutoAdd = Boolean(canAttemptAdd && addValidation.valid);

            return (
              <MeldCardItem
                key={meld.id}
                meld={meld}
                evaluation={evaluation}
                isSelected={isSelected}
                isEligibleToAutoAdd={isEligibleToAutoAdd}
                autoAddValidation={addValidation}
                selectedCardsCount={selectedCards?.length ?? 0}
                onAutoAdd={() => {
                  if (onAddToMeld && selectedCards && selectedCards.length > 0) {
                    onAddToMeld(meld.id, selectedCards.map((c) => c.id));
                  }
                }}
                onSelect={() => {
                  try {
                    onSelectMeld?.(meld);
                  } catch (err) {
                    console.error('Error in onSelectMeld:', err);
                  }
                }}
                canSelect={Boolean(onSelectMeld)}
                onZoom={onZoomMeld}
                sortDirection={sortDirection}
                cardSize={cardSize}
                isRippling={isRippling}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

interface MeldCardItemProps {
  meld: Meld;
  evaluation: ReturnType<typeof evaluateMeldScore>;
  isSelected: boolean;
  onSelect: () => void;
  canSelect: boolean;
  onZoom?: (meld: Meld) => void;
  sortDirection: MeldSortDirection;
  cardSize?: 'sm' | 'md';
  isEligibleToAutoAdd?: boolean;
  autoAddValidation?: ReturnType<typeof canAddCardsToMeld>;
  selectedCardsCount?: number;
  onAutoAdd?: () => void;
  isRippling?: boolean;
}

const MeldCardItem: React.FC<MeldCardItemProps> = ({
  meld,
  evaluation,
  isSelected,
  onSelect,
  canSelect,
  onZoom,
  sortDirection,
  cardSize = 'md',
  isEligibleToAutoAdd = false,
  autoAddValidation,
  selectedCardsCount = 0,
  onAutoAdd,
  isRippling = false,
}) => {
  const { isComplete7, isPure13 } = evaluation;

  // Determine Badge Styling & Text
  let badgeText = '';
  let badgeClass = '';

  if (isPure13) {
    badgeText = 'Pure 2-A Run - 500 pts';
    badgeClass =
      'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-extrabold border-yellow-300 shadow-sm';
  } else if (isComplete7) {
    if (meld.type === 'RUN') {
      const isClean = !meld.cards.some(
        (c) => c.isNaturalJoker || c.rank === 0 || c.rank === 2
      );
      if (isClean) {
        badgeText = 'Clean Run - 200 pts';
        badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      } else {
        badgeText = 'Dirty Run - 100 pts';
        badgeClass = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      }
    } else {
      const isClean = !meld.cards.some(
        (c) => c.isNaturalJoker || c.rank === 0 || c.rank === 2
      );
      if (isClean) {
        badgeText = 'Clean 7-of-a-Kind - 200 pts';
        badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      } else {
        badgeText = 'Dirty 7-of-a-Kind - 100 pts';
        badgeClass = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      }
    }
  } else {
    // Incomplete
    badgeText = `${meld.type === 'RUN' ? 'Run' : 'Set'} - ${meld.cards.length} cards`;
    badgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
  }

  // Sort slots: Default highest to lowest (descending by representedRank)
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
        if (b.representedRank !== a.representedRank) {
          return b.representedRank - a.representedRank;
        }
        if (!a.isWildcard && b.isWildcard) return -1;
        if (a.isWildcard && !b.isWildcard) return 1;
        const suitA = a.card.suit ? SUIT_SORT_ORDER[a.card.suit] ?? 99 : 99;
        const suitB = b.card.suit ? SUIT_SORT_ORDER[b.card.suit] ?? 99 : 99;
        return suitA - suitB;
      } else {
        if (a.representedRank !== b.representedRank) {
          return a.representedRank - b.representedRank;
        }
        if (!a.isWildcard && b.isWildcard) return -1;
        if (a.isWildcard && !b.isWildcard) return 1;
        const suitA = a.card.suit ? SUIT_SORT_ORDER[a.card.suit] ?? 99 : 99;
        const suitB = b.card.suit ? SUIT_SORT_ORDER[b.card.suit] ?? 99 : 99;
        return suitA - suitB;
      }
    });
  }, [meld.slots, meld.cards, sortDirection]);

  const [isAbsorbing, setIsAbsorbing] = useState(false);

  const handleItemClick = () => {
    if (isEligibleToAutoAdd && onAutoAdd) {
      try {
        setIsAbsorbing(true);
        setTimeout(() => setIsAbsorbing(false), 550);
        onAutoAdd();
      } catch (err) {
        console.error('Error auto-adding to sequence:', err);
      }
      return;
    }
    if (canSelect) {
      onSelect();
    }
  };

  const containerClasses = isEligibleToAutoAdd
    ? 'border-2 border-yellow-400 ring-4 ring-yellow-400/70 shadow-2xl shadow-yellow-500/30 bg-gradient-to-br from-yellow-950/40 via-slate-900/90 to-yellow-950/30 cursor-pointer hover:scale-[1.015] hover:border-yellow-300 hover:ring-yellow-300 transition-all'
    : isSelected
    ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/50 shadow-lg'
    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/80';

  const absorbClass = isAbsorbing ? 'animate-sequence-absorb' : '';

  return (
    <div
      data-testid={`meld-item-${meld.id}`}
      data-can-add={isEligibleToAutoAdd ? 'true' : undefined}
      data-highlight-yellow={isEligibleToAutoAdd ? 'true' : undefined}
      onClick={handleItemClick}
      className={`relative group rounded-xl p-3 border transition-all ${
        canSelect || isEligibleToAutoAdd ? 'cursor-pointer' : ''
      } ${containerClasses} ${absorbClass}`}
    >
      {/* Yellow Auto-Add Banner */}
      {isEligibleToAutoAdd && (
        <div
          data-testid={`auto-add-prompt-${meld.id}`}
          className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-yellow-400/20 border border-yellow-400/60 text-yellow-300 text-xs font-bold mb-2 animate-pulse flex-wrap"
        >
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span>
              {`Click sequence to add (${selectedCardsCount} ${selectedCardsCount === 1 ? 'card' : 'cards'})`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {autoAddValidation?.pickedUpCard && (
              <span className="text-[10px] font-extrabold bg-slate-950 text-yellow-300 border border-yellow-400/40 px-1.5 py-0.5 rounded">
                🃏 Picks up Joker!
              </span>
            )}
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-yellow-400 text-slate-950 shadow-sm shrink-0">
              Click to Auto-Add
            </span>
          </div>
        </div>
      )}

      {/* Meld Header Bar */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${badgeClass}`}
          >
            {isPure13 && <Sparkles className="w-3 h-3 text-amber-900" />}
            {isComplete7 && !isPure13 && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            <span>{badgeText}</span>
          </span>

          {meld.suit && (
            <span className="text-xs font-semibold text-slate-400">
              {meld.suit}
            </span>
          )}

          <span className="text-[10px] text-slate-400 bg-slate-900/60 border border-slate-800 px-1.5 py-0.5 rounded font-mono">
            {sortDirection === 'desc' ? 'High → Low' : 'Low → High'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onZoom && (
            <button
              type="button"
              data-testid={`btn-zoom-meld-${meld.id}`}
              onClick={(e) => {
                e.stopPropagation();
                try {
                  onZoom(meld);
                } catch (err) {
                  console.error('Error invoking onZoom:', err);
                }
              }}
              title="Zoom into sequence to inspect cards in detail"
              className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all cursor-pointer hover:scale-105"
            >
              <ZoomIn className="w-3 h-3" />
              <span>Zoom</span>
            </button>
          )}

          {isEligibleToAutoAdd ? (
            <div className="flex items-center gap-1 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-yellow-400 text-slate-950 font-extrabold flex items-center gap-1 shadow-sm">
                <PlusCircle className="w-3 h-3" />
                <span>Auto-Add</span>
              </span>
            </div>
          ) : canSelect ? (
            <div className="flex items-center gap-1 text-[11px]">
              {isSelected ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <span>Selected to add</span>
                </span>
              ) : (
                <span className="text-slate-500 group-hover:text-slate-300 flex items-center gap-1 transition-colors">
                  <PlusCircle className="w-3 h-3" />
                  <span>Select</span>
                </span>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Sequential Cards Layout (Overlapping for compact fit) */}
      <div
        data-testid="meld-cards-row"
        data-sort-direction={sortDirection}
        className="flex items-center overflow-x-auto py-2.5 px-1 scrollbar-thin"
      >
        {sortedSlots.map((slot, index) => {
          const card = slot.card;
          const isSlotWild = slot.isWildcard;
          let wildLabel: string | undefined = undefined;

          if (isSlotWild) {
            const repRank = getRankLabel(slot.representedRank);
            const repSuit = getSuitSymbol(slot.representedSuit ?? meld.suit ?? card.suit);
            wildLabel = `Wild (${repRank}${repSuit})`;
          } else if (isSlotWild === false) {
            // Natural 2 that slid down
            wildLabel = undefined;
          }

          return (
            <div
              key={`${card.id}-${slot.representedRank}-${index}`}
              style={{
                marginLeft: index === 0 ? 0 : cardSize === 'md' ? '-30px' : '-18px',
                zIndex: index + 1,
                animationDelay: isRippling ? `${(index % 12) * 45}ms` : undefined,
              }}
              className={`relative transition-transform hover:-translate-y-2.5 hover:!z-30 shrink-0 ${
                isRippling ? 'animate-card-ripple' : 'animate-sequence-pop-in'
              }`}
            >
              <PlayingCard
                card={card}
                size={cardSize}
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

export const TableSequenceBoard = TableMeldBoard;
