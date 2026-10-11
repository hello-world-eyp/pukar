import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Meld, Team, Suit, Card } from '../../engine/types';
import { evaluateMeldScore, canAddCardsToMeld } from '../../engine/meld-validator';
import { PlayingCard, getRankLabel, getSuitSymbol } from './PlayingCard';
import { Shield, Sparkles, CheckCircle2, PlusCircle, ZoomIn, Lock } from 'lucide-react';

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
  compactMeldHeaders?: boolean;
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
  compactMeldHeaders,
}) => {
  const sortDirection: MeldSortDirection = defaultSortDirection;

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
    <div className={`w-full flex flex-col gap-2 sm:gap-2.5 ${className}`}>
      {/* Board Controls Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm sm:text-base font-black text-stone-800">Table Sequences</span>
          <span className="text-sm text-stone-400">•</span>
          <span className="text-xs sm:text-sm font-bold text-stone-600">
            {sortDirection === 'desc' ? 'Sorted Highest to Lowest' : 'Sorted Lowest to Highest'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-3.5">
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
          compactMeldHeaders={compactMeldHeaders}
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
          compactMeldHeaders={compactMeldHeaders}
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
  compactMeldHeaders?: boolean;
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
  compactMeldHeaders,
}) => {
  const isBlue = teamColor === 'blue';

  const headerBorder = isBlue ? 'border-sky-300' : 'border-amber-300';
  const headerBg = isBlue ? 'bg-sky-100/80' : 'bg-amber-100/80';
  const headerTextColor = isBlue ? 'text-sky-900' : 'text-amber-900';
  const activeRing = isBlue ? 'ring-2 ring-sky-500 shadow-lg' : 'ring-2 ring-amber-500 shadow-lg';

  const sortedMelds = useMemo(() => {
    return sortMelds(melds, sortDirection);
  }, [melds, sortDirection]);

  return (
    <div
      data-team={team}
      className={`rounded-2xl sm:rounded-3xl border-2 ${
        isBlue ? 'border-sky-300/80 bg-white/60' : 'border-amber-300/80 bg-white/60'
      } p-2.5 sm:p-3 flex flex-col gap-2 sm:gap-2.5 shadow-sm transition-all ${
        isActive ? activeRing : ''
      }`}
    >
      {/* Column Header */}
      <div
        className={`flex items-center justify-between px-3 py-1.5 rounded-xl ${headerBg} border ${headerBorder}`}
      >
        <div className="flex items-center gap-2">
          <Shield className={`w-4 h-4 ${headerTextColor}`} />
          <h3 className={`font-black text-xs sm:text-sm tracking-wide ${headerTextColor}`}>
            {teamName}
          </h3>
          {isActive && (
            <span className="text-[11px] sm:text-xs font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-sky-500 text-white shadow-sm">
              Active Turn
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
          <span className="text-stone-600 font-bold">
            {`${melds.length} ${melds.length === 1 ? 'sequence' : 'sequences'}`}
          </span>
          <span className="font-black px-2 py-0.5 rounded-lg bg-stone-800 text-stone-100 shadow-sm">
            {`${score} pts`}
          </span>
        </div>
      </div>

      {/* Sequences List: Strictly 2 columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2.5 min-h-[75px]">
        {sortedMelds.length === 0 ? (
          <div className="col-span-full flex-1 flex flex-col items-center justify-center p-2 sm:p-3 border-2 border-dashed border-stone-300/80 rounded-xl text-stone-500 text-xs sm:text-sm text-center bg-white/40 min-h-[60px]">
            <p className="font-bold text-stone-700">No sequences placed yet</p>
            <p className="text-xs text-stone-500 mt-0.5">
              {`Sequences placed by ${teamName} will appear here.`}
            </p>
          </div>
        ) : (
          sortedMelds.map((meld) => {
            const isSelected = selectedMeldId === meld.id;
            const evaluation = evaluateMeldScore(meld);
            const isCompleteSequence = evaluation.isPure13 || evaluation.points === 500;

            // Check if all selected cards can be added to this sequence
            // Complete 500-pt sequences are closed - nothing can be added
            const isOwnTeam = isActive;
            const willLeaveEmptyHand = Boolean(
              allHandCards &&
                allHandCards.length > 0 &&
                selectedCards &&
                selectedCards.length >= allHandCards.length
            );
            const canAttemptAdd = Boolean(
              !isCompleteSequence &&
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
            const canSelectThisMeld = Boolean(onSelectMeld) && !isCompleteSequence;

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
                canSelect={canSelectThisMeld}
                onZoom={onZoomMeld}
                sortDirection={sortDirection}
                cardSize={cardSize}
                isRippling={isRippling}
                compactMeldHeaders={compactMeldHeaders}
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
  compactMeldHeaders?: boolean;
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
  compactMeldHeaders,
}) => {
  const { isComplete7, isPure13 } = evaluation;

  const headerRef = useRef<HTMLDivElement | null>(null);
  const uncollapsedWidthRef = useRef<number | null>(null);
  const [isAutoCompact, setIsAutoCompact] = useState(false);

  // If compactMeldHeaders is passed explicitly, it overrides auto-detection
  const isCompact =
    compactMeldHeaders !== undefined ? compactMeldHeaders : isAutoCompact;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (compactMeldHeaders !== undefined) return;

    const checkOverflow = () => {
      const el = headerRef.current;
      if (!el) return;

      if (!isCompact) {
        // If content overflows or container width is under 290px, switch to compact mode
        if (el.scrollWidth - el.clientWidth > 1 || el.clientWidth < 290) {
          uncollapsedWidthRef.current = Math.max(el.scrollWidth, 305);
          setIsAutoCompact(true);
        }
      } else {
        // Only restore full text if container widens enough to fit full badge comfortably
        const threshold = uncollapsedWidthRef.current ?? 305;
        if (el.clientWidth >= threshold + 16) {
          setIsAutoCompact(false);
          uncollapsedWidthRef.current = null;
        }
      }
    };

    checkOverflow();

    window.addEventListener('resize', checkOverflow);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && headerRef.current) {
      ro = new ResizeObserver(checkOverflow);
      ro.observe(headerRef.current);
    }

    return () => {
      window.removeEventListener('resize', checkOverflow);
      ro?.disconnect();
    };
  }, [isCompact, compactMeldHeaders]);

  // Determine Badge Styling & Text
  let fullBadgeText = '';
  let compactBadgeText = '';
  let badgeClass = '';

  if (isPure13) {
    fullBadgeText = 'Complete Sequence - 500 pts';
    compactBadgeText = '500 pts';
    badgeClass =
      'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black border-yellow-300 shadow-md';
  } else if (isComplete7) {
    const isClean = evaluation.points === 200;
    compactBadgeText = `${evaluation.points} pts`;
    if (meld.type === 'RUN') {
      if (isClean) {
        fullBadgeText = 'Pure Sequence - 200 pts';
        badgeClass = 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 font-black shadow-sm';
      } else {
        fullBadgeText = 'Impure Sequence - 100 pts';
        badgeClass = 'bg-blue-950/80 text-blue-300 border border-blue-500/50 font-black shadow-sm';
      }
    } else {
      if (isClean) {
        fullBadgeText = 'Clean 7-of-a-Kind - 200 pts';
        badgeClass = 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 font-black shadow-sm';
      } else {
        fullBadgeText = 'Dirty 7-of-a-Kind - 100 pts';
        badgeClass = 'bg-blue-950/80 text-blue-300 border border-blue-500/50 font-black shadow-sm';
      }
    }
  } else {
    // Incomplete (under 7 cards, 0 points)
    fullBadgeText = `${meld.cards.length}c`;
    compactBadgeText = `${meld.cards.length}c`;
    badgeClass = 'bg-slate-900 text-slate-300 border border-slate-700 font-bold';
  }

  const badgeText = isCompact ? compactBadgeText : fullBadgeText;

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

  const isCompleteSequence = isPure13 || evaluation.points === 500;
  const [isAbsorbing, setIsAbsorbing] = useState(false);

  const handleItemClick = () => {
    if (isCompleteSequence) {
      return;
    }
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

  const containerClasses = isCompleteSequence
    ? 'bg-stone-200/50 border-2 border-stone-300/90 text-stone-600 opacity-65 filter grayscale-[45%] shadow-inner cursor-not-allowed hover:opacity-75'
    : isEligibleToAutoAdd
    ? 'border-2 border-yellow-400 ring-4 ring-yellow-400/70 shadow-2xl shadow-yellow-500/30 bg-yellow-50/90 cursor-pointer hover:scale-[1.015] hover:border-yellow-300 hover:ring-yellow-300 transition-all'
    : isSelected
    ? 'bg-amber-100/80 border-2 border-amber-500 ring-2 ring-amber-400/50 shadow-md'
    : 'bg-white/90 border-2 border-stone-300/80 hover:border-stone-400 hover:bg-white shadow-sm';

  const absorbClass = isAbsorbing ? 'animate-sequence-absorb' : '';

  return (
    <div
      data-testid={`meld-item-${meld.id}`}
      data-selected={isSelected ? 'true' : undefined}
      data-can-add={isEligibleToAutoAdd ? 'true' : undefined}
      data-highlight-yellow={isEligibleToAutoAdd ? 'true' : undefined}
      data-complete={isCompleteSequence ? 'true' : undefined}
      onClick={handleItemClick}
      title={
        isCompleteSequence
          ? 'Complete Sequence (500 pts) • Full 13-card sequence; no cards can be added'
          : undefined
      }
      className={`relative group rounded-xl p-2 sm:p-2.5 transition-all ${
        isCompleteSequence
          ? 'cursor-not-allowed'
          : canSelect || isEligibleToAutoAdd
          ? 'cursor-pointer'
          : ''
      } ${containerClasses} ${absorbClass}`}
    >
      {/* Yellow Auto-Add Floating Banner (Positioned absolute so height never shifts on card selection) */}
      {isEligibleToAutoAdd && (
        <div
          data-testid={`auto-add-prompt-${meld.id}`}
          className="absolute -top-3.5 right-3 z-30 pointer-events-none flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-300 border-2 border-yellow-500 text-stone-950 text-xs font-black shadow-lg animate-pulse max-w-[90%] truncate"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-yellow-800 shrink-0" />
            <span className="truncate">
              {`Click sequence to add (${selectedCardsCount} ${selectedCardsCount === 1 ? 'card' : 'cards'})`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {autoAddValidation?.pickedUpCard && (
              <span className="text-[10px] font-black bg-stone-900 text-yellow-300 border border-yellow-400/40 px-1.5 py-0.5 rounded">
                🃏 Picks up Joker!
              </span>
            )}
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-yellow-400 text-stone-950 shadow-sm shrink-0 border border-yellow-600">
              Click to Auto-Add
            </span>
          </div>
        </div>
      )}

      {/* Meld Header Bar */}
      <div
        ref={headerRef}
        data-testid={`meld-header-${meld.id}`}
        data-compact={isCompact ? 'true' : 'false'}
        className="min-h-[28px] flex items-center justify-between mb-2 gap-1.5 flex-nowrap"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
          <span
            data-testid={`badge-meld-score-${meld.id}`}
            title={fullBadgeText}
            className={`text-xs sm:text-sm font-bold px-2 sm:px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 whitespace-nowrap shrink-0 ${badgeClass}`}
          >
            {isPure13 && <Sparkles className="w-3.5 h-3.5 text-amber-900 shrink-0" />}
            {isComplete7 && !isPure13 && (
              <CheckCircle2
                className={`w-3.5 h-3.5 shrink-0 ${
                  evaluation.points === 200 ? 'text-emerald-500' : 'text-blue-400'
                }`}
              />
            )}
            <span>{badgeText}</span>
          </span>

          {meld.suit && (
            <span
              className="text-xs sm:text-sm font-extrabold text-stone-700 uppercase tracking-wider whitespace-nowrap shrink-0"
              title={meld.suit}
            >
              {meld.suit}
            </span>
          )}

          {isCompleteSequence && (
            <span
              data-testid={`badge-complete-locked-${meld.id}`}
              className="text-[10px] sm:text-xs font-black uppercase px-1.5 sm:px-2 py-0.5 rounded-md bg-stone-300/80 border border-stone-400/80 text-stone-700 flex items-center gap-1 shadow-sm shrink-0"
              title="Complete Sequence is full (13 cards). No cards can be added."
            >
              <Lock className="w-3 h-3 text-stone-600 shrink-0" />
              <span className={isCompact ? 'hidden sm:inline' : 'inline'}>Closed</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
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
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-all cursor-pointer hover:scale-105 shrink-0 whitespace-nowrap shadow-sm filter-none opacity-100"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>Zoom</span>
            </button>
          )}

          {isEligibleToAutoAdd && (
            <div className="flex items-center gap-1 text-sm">
              <span className="px-2 py-0.5 rounded bg-yellow-400 text-stone-950 font-black flex items-center gap-1 shadow-sm">
                <PlusCircle className="w-4 h-4" />
                <span>Auto-Add</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Sequential Cards Layout (Overlapping for compact fit) */}
      <div
        data-testid="meld-cards-row"
        data-sort-direction={sortDirection}
        className="flex items-center overflow-x-auto overflow-y-hidden overscroll-y-contain pt-4 pb-2.5 px-2 scrollbar-thin"
      >
        {sortedSlots.map((slot, index) => {
          const card = slot.card;
          const isSlotWild = slot.isWildcard;
          let wildLabel: string | undefined = undefined;

          if (isSlotWild) {
            const repRank = getRankLabel(slot.representedRank);
            const repSuit = getSuitSymbol(slot.representedSuit ?? meld.suit ?? card.suit);
            wildLabel = cardSize === 'sm' ? `W (${repRank}${repSuit})` : `Wild (${repRank}${repSuit})`;
          } else if (isSlotWild === false) {
            // Natural 2 that slid down
            wildLabel = undefined;
          }

          return (
            <div
              key={`${card.id}-${slot.representedRank}-${index}`}
              style={{
                marginLeft: index === 0 ? 0 : cardSize === 'md' ? '-44px' : '-26px',
                zIndex: index + 1,
                animationDelay: isRippling ? `${(index % 12) * 45}ms` : undefined,
              }}
              className={`relative transition-transform hover:-translate-y-1.5 hover:!z-30 shrink-0 ${
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
