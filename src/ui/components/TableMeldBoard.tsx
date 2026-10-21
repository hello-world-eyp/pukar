import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Meld, Team, Suit, Card } from '../../engine/types';
import { evaluateMeldScore, canAddCardsToMeld } from '../../engine/meld-validator';
import { PlayingCard, getRankLabel, getSuitSymbol } from './PlayingCard';
import { Shield, Sparkles, CheckCircle2, PlusCircle, ZoomIn } from 'lucide-react';

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
  newMeldCardIds?: string[];
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
  newMeldCardIds,
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

  const [mobileActiveTeam, setMobileActiveTeam] = useState<'A' | 'B'>(activeTeam ?? 'A');
  useEffect(() => {
    if (activeTeam) {
      setMobileActiveTeam(activeTeam);
    }
  }, [activeTeam]);

  const scoreA = calculateTeamPoints(listA);
  const scoreB = calculateTeamPoints(listB);

  return (
    <div
      aria-label={`Table Sequences (${sortDirection === 'desc' ? 'Sorted Highest to Lowest' : 'Sorted Lowest to Highest'})`}
      data-testid="table-meld-board"
      className={`w-full ${className}`}
    >
      {/* Mobile Team Melds Switcher (<640px) */}
      <div className="sm:hidden flex items-center justify-center p-1 rounded-xl bg-stone-200/90 border border-stone-300 mb-2 gap-1 shadow-inner">
        <button
          type="button"
          onClick={() => setMobileActiveTeam('A')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileActiveTeam === 'A'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-stone-700 hover:text-stone-950'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-300" />
          <span>Team A ({listA.length})</span>
          <span className="text-[10px] opacity-80">{scoreA} pts</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileActiveTeam('B')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            mobileActiveTeam === 'B'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-stone-700 hover:text-stone-950'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-300" />
          <span>Team B ({listB.length})</span>
          <span className="text-[10px] opacity-80">{scoreB} pts</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2.5">
        {/* TEAM A MELDS COLUMN */}
        <div className={mobileActiveTeam === 'A' ? 'block' : 'hidden sm:block'}>
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
            newMeldCardIds={newMeldCardIds}
          />
        </div>

        {/* TEAM B MELDS COLUMN */}
        <div className={mobileActiveTeam === 'B' ? 'block' : 'hidden sm:block'}>
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
            newMeldCardIds={newMeldCardIds}
          />
        </div>
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
  newMeldCardIds?: string[];
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
  newMeldCardIds,
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
      } p-2 sm:p-2.5 flex flex-col gap-1.5 sm:gap-2 shadow-sm transition-all ${
        isActive ? activeRing : ''
      }`}
    >
      {/* Column Header */}
      <div
        className={`flex items-center justify-between px-2.5 py-1 rounded-xl ${headerBg} border ${headerBorder}`}
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-2 min-h-[60px] w-full min-w-0">
        {sortedMelds.length === 0 ? (
          <div className="col-span-full flex-1 flex flex-col items-center justify-center p-2 sm:p-2.5 border-2 border-dashed border-stone-300/80 rounded-xl text-stone-500 text-xs sm:text-sm text-center bg-white/40 min-h-[50px]">
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
            const rawValidation =
              canAdd && isOwnTeam && selectedCards && selectedCards.length > 0 && !isCompleteSequence
                ? canAddCardsToMeld(meld, selectedCards)
                : { valid: false };
            const willLeaveEmptyHand = Boolean(
              allHandCards &&
                allHandCards.length > 0 &&
                selectedCards &&
                selectedCards.length - (rawValidation.pickedUpCard ? 1 : 0) >= allHandCards.length
            );
            const canAttemptAdd = Boolean(
              !isCompleteSequence &&
                canAdd &&
                isOwnTeam &&
                selectedCards &&
                selectedCards.length > 0 &&
                !willLeaveEmptyHand
            );
            const addValidation = canAttemptAdd ? rawValidation : { valid: false };
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
                allHandCards={allHandCards}
                onAddToMeld={onAddToMeld}
                canAdd={canAdd}
                isOwnTeam={isOwnTeam}
                selectedCards={selectedCards}
                newMeldCardIds={newMeldCardIds}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export interface MeldCardItemProps {
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
  allHandCards?: Card[];
  onAddToMeld?: (meldId: string, cardIds: string[]) => void;
  canAdd?: boolean;
  isOwnTeam?: boolean;
  selectedCards?: Card[];
  newMeldCardIds?: string[];
}

/**
 * Calculates negative margin between cards in table sequences to ensure compact fit.
 * Automatically decreases horizontal spacing as card count increases or container space contracts,
 * guaranteeing that up to 10 (and even full 13-card) sequences fit within the SAME space as fewer cards,
 * with zero horizontal overflow outside the sequence box, while keeping corner rank and suit indices visible.
 */
export function calculateMeldCardOverlapMargin({
  cardCount,
  cardSize = 'md',
  containerWidth,
  isSmallScreen = false,
}: {
  cardCount: number;
  cardSize?: 'sm' | 'md';
  containerWidth?: number | null;
  isSmallScreen?: boolean;
}): number {
  if (cardCount <= 1) return 0;

  // Card widths defined in PlayingCard.tsx sizeStyles:
  // md: w-20 (80px) on mobile, sm:w-24 (96px) on desktop (>=640px)
  // sm: w-12 (48px) on mobile, sm:w-16 (64px) on desktop (>=640px)
  const cardWidth =
    cardSize === 'sm'
      ? isSmallScreen
        ? 48
        : 64
      : isSmallScreen
      ? 80
      : 96;

  // Minimum exposed width required to keep corner rank & suit index visible (+5% increase for legibility)
  const minExposed =
    cardSize === 'sm'
      ? isSmallScreen ? 8 : 9
      : cardCount > 10
      ? 10
      : isSmallScreen ? 11 : 12;

  // Maximum exposed width when there are few cards (+5% increase for legibility)
  const maxExposed =
    cardSize === 'sm'
      ? cardCount <= 3
        ? isSmallScreen ? 23 : 29
        : cardCount <= 5
        ? isSmallScreen ? 17 : 21
        : cardCount <= 7
        ? isSmallScreen ? 15 : 18
        : isSmallScreen ? 13 : 16
      : cardCount <= 3
      ? isSmallScreen ? 38 : 46
      : cardCount <= 5
      ? isSmallScreen ? 27 : 34
      : cardCount <= 7
      ? isSmallScreen ? 21 : 25
      : isSmallScreen ? 17 : 20;

  // Available container width: use measured container if available, or standard column width
  // (220px on mobile, 260px on desktop) so that 10 cards occupy the same space immediately
  const effectiveContainer =
    containerWidth && containerWidth > cardWidth
      ? containerWidth
      : isSmallScreen ? 220 : 260;

  const availWidth = Math.max(cardWidth, effectiveContainer - 16);
  // Increase exposed spacing between cards by 5% as requested to enhance top card and corner visibility
  const availPerOverlap = Math.floor(((availWidth - cardWidth) / (cardCount - 1)) * 1.05);
  const targetExposed = Math.max(minExposed, Math.min(maxExposed, availPerOverlap));

  return targetExposed - cardWidth;
}

/**
 * Pure validation helper for drag-and-drop targeting on a table meld.
 * Checks phase, team ownership, pure 13 completeness, hand exhaustion rule, and meld rules.
 */
export function canDropCardsOnMeld({
  meld,
  cardsInFlight,
  allHandCards,
  canAdd = true,
  isOwnTeam = true,
}: {
  meld: Meld;
  cardsInFlight: Card[];
  allHandCards?: Card[];
  canAdd?: boolean;
  isOwnTeam?: boolean;
}): { valid: boolean; error?: string } {
  try {
    const isCompleteSequence = meld.isPure13 || evaluateMeldScore(meld).points === 500;
    if (isCompleteSequence) {
      return { valid: false, error: 'Sequence is complete' };
    }
    if (!canAdd || !isOwnTeam) {
      return { valid: false, error: 'Cannot add to sequence right now' };
    }
    if (!cardsInFlight || cardsInFlight.length === 0) {
      return { valid: false, error: 'No cards in flight' };
    }
    const validation = canAddCardsToMeld(meld, cardsInFlight);
    if (!validation.valid) {
      return validation;
    }
    const netHandRemaining =
      (allHandCards ? allHandCards.length : 0) -
      cardsInFlight.length +
      (validation.pickedUpCard ? 1 : 0);
    if (allHandCards && netHandRemaining <= 0) {
      return { valid: false, error: 'Cannot meld all cards; must keep at least 1 card in hand' };
    }
    return validation;
  } catch (err) {
    console.error('Error validating drop cards on meld:', err);
    return { valid: false, error: 'Validation error' };
  }
}

export const MeldCardItem: React.FC<MeldCardItemProps> = ({
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
  allHandCards,
  onAddToMeld,
  canAdd = true,
  isOwnTeam = true,
  selectedCards,
  newMeldCardIds,
}) => {
  const { isComplete7, isPure13 } = evaluation;
  const isCompleteSequence = isPure13 || evaluation.points === 500;

  const headerRef = useRef<HTMLDivElement | null>(null);
  const cardsRowRef = useRef<HTMLDivElement | null>(null);
  const uncollapsedWidthRef = useRef<number | null>(null);
  const [isAutoCompact, setIsAutoCompact] = useState(false);
  const [measuredRowWidth, setMeasuredRowWidth] = useState<number | null>(null);

  // If compactMeldHeaders is passed explicitly, it overrides auto-detection
  const isCompact =
    compactMeldHeaders !== undefined ? compactMeldHeaders : isAutoCompact;

  const useIsomorphicLayoutEffect =
    typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

  useIsomorphicLayoutEffect(() => {
    if (cardsRowRef.current) {
      cardsRowRef.current.scrollTop = 0;
      if (cardsRowRef.current.clientWidth > 0) {
        setMeasuredRowWidth(cardsRowRef.current.clientWidth);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkOverflow = () => {
      const el = headerRef.current;
      if (el && compactMeldHeaders === undefined) {
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
      }

      const rowEl = cardsRowRef.current;
      if (rowEl) {
        rowEl.scrollTop = 0;
        if (rowEl.clientWidth > 0) {
          setMeasuredRowWidth(rowEl.clientWidth);
        }
      }
    };

    checkOverflow();

    window.addEventListener('resize', checkOverflow);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(checkOverflow);
      if (headerRef.current) ro.observe(headerRef.current);
      if (cardsRowRef.current) ro.observe(cardsRowRef.current);
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

  if (isCompleteSequence) {
    fullBadgeText = 'Complete Sequence - 500 pts';
    compactBadgeText = 'Complete Sequence - 500 pts';
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

  const [isAbsorbing, setIsAbsorbing] = useState(false);
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);
  const [dragHoverCardCount, setDragHoverCardCount] = useState(0);

  const getCardsBeingDragged = (e: React.DragEvent): Card[] => {
    try {
      if (!allHandCards || allHandCards.length === 0) return [];

      let cardIds: string[] = [];
      if (typeof window !== 'undefined' && (window as any).__pukarActiveDragCardIds) {
        cardIds = (window as any).__pukarActiveDragCardIds;
      }

      if (!cardIds || cardIds.length === 0) {
        const rawIds = e.dataTransfer?.getData('card-ids');
        if (rawIds) {
          try {
            cardIds = JSON.parse(rawIds);
          } catch {}
        }
      }

      if (!cardIds || cardIds.length === 0) {
        const singleId = e.dataTransfer?.getData('card-id');
        if (singleId) {
          cardIds = [singleId];
        }
      }

      if (!cardIds || cardIds.length === 0) {
        const jsonStr = e.dataTransfer?.getData('application/json');
        if (jsonStr) {
          try {
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed.cardIds)) {
              cardIds = parsed.cardIds;
            } else if (parsed.id) {
              cardIds = [parsed.id];
            }
          } catch {}
        }
      }

      if ((!cardIds || cardIds.length === 0) && selectedCards && selectedCards.length > 0) {
        return selectedCards;
      }

      if (!cardIds || cardIds.length === 0) return [];

      const handMap = new Map(allHandCards.map((c) => [c.id, c]));
      return cardIds.map((id) => handMap.get(id)).filter((c): c is Card => c !== undefined);
    } catch {
      return [];
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    const cardsInFlight = getCardsBeingDragged(e);
    const dropCheck = canDropCardsOnMeld({
      meld,
      cardsInFlight,
      allHandCards,
      canAdd,
      isOwnTeam,
    });

    if (dropCheck.valid) {
      e.preventDefault();
      try {
        e.dataTransfer.dropEffect = 'copy';
      } catch {}
      if (!isDragOverTarget) {
        setIsDragOverTarget(true);
        setDragHoverCardCount(cardsInFlight.length);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOverTarget(false);
      setDragHoverCardCount(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    setIsDragOverTarget(false);
    setDragHoverCardCount(0);

    if (!onAddToMeld) return;

    try {
      const cardsInFlight = getCardsBeingDragged(e);
      const dropCheck = canDropCardsOnMeld({
        meld,
        cardsInFlight,
        allHandCards,
        canAdd,
        isOwnTeam,
      });

      if (dropCheck.valid) {
        e.preventDefault();
        setIsAbsorbing(true);
        setTimeout(() => setIsAbsorbing(false), 550);
        onAddToMeld(meld.id, cardsInFlight.map((c) => c.id));
      }
    } catch (err) {
      console.error('Error handling meld drop:', err);
    } finally {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dragend'));
      }
    }
  };

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
    : isDragOverTarget
    ? 'border-2 border-emerald-400 ring-4 ring-emerald-400/80 shadow-2xl shadow-emerald-500/30 bg-emerald-50/95 scale-[1.02] cursor-copy transition-all'
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
      data-highlight-yellow={isEligibleToAutoAdd && !isDragOverTarget ? 'true' : undefined}
      data-drag-over={isDragOverTarget ? 'true' : undefined}
      data-complete={isCompleteSequence ? 'true' : undefined}
      onClick={handleItemClick}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={
        isCompleteSequence
          ? 'Complete Sequence (500 pts) • Full 13-card sequence; no cards can be added'
          : undefined
      }
      className={`relative group rounded-xl p-1.5 sm:p-2 transition-all w-full min-w-0 max-w-full [overflow-x:clip] overflow-y-visible ${
        isCompleteSequence
          ? 'cursor-not-allowed'
          : isDragOverTarget
          ? 'cursor-copy'
          : canSelect || isEligibleToAutoAdd
          ? 'cursor-pointer'
          : ''
      } ${containerClasses} ${absorbClass}`}
    >
      {/* Emerald Drag-and-Drop Drop Target Floating Badge */}
      {isDragOverTarget && (
        <div
          data-testid={`drop-add-prompt-${meld.id}`}
          className="absolute -top-3.5 right-3 z-30 pointer-events-none flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400 border-2 border-emerald-600 text-slate-950 text-xs font-black shadow-lg animate-bounce max-w-[90%] truncate"
        >
          <PlusCircle className="w-3.5 h-3.5 text-emerald-950 shrink-0" />
          <span className="truncate">
            {`Drop to add (${dragHoverCardCount} ${dragHoverCardCount === 1 ? 'card' : 'cards'})`}
          </span>
        </div>
      )}

      {/* Yellow Auto-Add Floating Banner (Positioned absolute so height never shifts on card selection) */}
      {!isDragOverTarget && isEligibleToAutoAdd && (
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
        className="min-h-[24px] flex items-center justify-between mb-1 sm:mb-1.5 gap-1.5 flex-nowrap"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
          <span
            data-testid={`badge-meld-score-${meld.id}`}
            title={fullBadgeText}
            className={`text-xs sm:text-sm font-bold px-2 sm:px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 whitespace-nowrap shrink-0 ${badgeClass}`}
          >
            {isCompleteSequence && <Sparkles className="w-3.5 h-3.5 text-amber-900 shrink-0" />}
            {isComplete7 && !isCompleteSequence && (
              <CheckCircle2
                className={`w-3.5 h-3.5 shrink-0 ${
                  evaluation.points === 200 ? 'text-emerald-500' : 'text-blue-400'
                }`}
              />
            )}
            <span>{badgeText}</span>
          </span>

          {!isCompleteSequence && meld.suit && (
            <span
              className="text-xs sm:text-sm font-extrabold text-stone-700 uppercase tracking-wider whitespace-nowrap shrink-0"
              title={meld.suit}
            >
              {meld.suit}
            </span>
          )}
        </div>

        {!isCompleteSequence && (
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
        )}
      </div>

      {/* Sequential Cards Layout (Overlapping for compact fit without vertical or horizontal scroll trapping) */}
      <div
        ref={cardsRowRef}
        data-testid="meld-cards-row"
        data-sort-direction={sortDirection}
        className="flex items-center pt-2 pb-1 px-1.5 w-full max-w-full min-w-0 overflow-y-visible [overflow-x:clip]"
      >
        {(() => {
          const isSmallScreen = typeof window !== 'undefined' ? window.innerWidth < 640 : false;
          const overlapMargin = calculateMeldCardOverlapMargin({
            cardCount: sortedSlots.length,
            cardSize,
            containerWidth: measuredRowWidth,
            isSmallScreen,
          });

          return sortedSlots.map((slot, index) => {
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
                  marginLeft: index === 0 ? 0 : `${overlapMargin}px`,
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
                  isNew={Boolean(newMeldCardIds && newMeldCardIds.includes(card.id))}
                  representedRank={slot.representedRank}
                  representedSuit={slot.representedSuit}
                  wildcardLabel={wildLabel}
                />
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
};

export const TableSequenceBoard = TableMeldBoard;
