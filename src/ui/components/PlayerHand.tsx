import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Card, Suit, Team } from '../../engine/types';
import { PlayingCard } from './PlayingCard';
import { X, Pin, Eye, EyeOff } from 'lucide-react';

export type SortMode = 'suit' | 'rank' | 'none';
export type SortDirection = 'desc' | 'asc';

const SUIT_ORDER: Record<Suit, number> = {
  SPADES: 1,
  HEARTS: 2,
  CLUBS: 3,
  DIAMONDS: 4,
};

/**
 * Sorts cards by suit first, then by rank within each suit.
 * When direction === 'desc' (default): Highest card first within each suit (A..2).
 * When direction === 'asc': Lowest card first within each suit (2..A).
 * Natural Jokers (null suit / rank 0) are placed first as universal wildcards.
 */
export function sortCardsBySuit(cards: Card[], direction: SortDirection = 'desc'): Card[] {
  try {
    if (!cards || !Array.isArray(cards)) return [];
    return [...cards].sort((a, b) => {
      // Natural Jokers first
      const aIsJoker = a.isNaturalJoker || a.rank === 0 || a.suit === null;
      const bIsJoker = b.isNaturalJoker || b.rank === 0 || b.suit === null;
      if (aIsJoker && !bIsJoker) return -1;
      if (!aIsJoker && bIsJoker) return 1;
      if (aIsJoker && bIsJoker) return 0;

      const suitDiff = (SUIT_ORDER[a.suit as Suit] ?? 99) - (SUIT_ORDER[b.suit as Suit] ?? 99);
      if (suitDiff !== 0) return suitDiff;

      // Secondary filter: rank order within suit
      return direction === 'desc' ? b.rank - a.rank : a.rank - b.rank;
    });
  } catch (err) {
    console.error('Error in sortCardsBySuit:', err);
    return cards || [];
  }
}

/**
 * Sorts cards primarily by rank (High to Low when 'desc' [default], or Low to High when 'asc').
 * Ties in rank are broken secondary by suit order (SPADES, HEARTS, CLUBS, DIAMONDS).
 * Natural Jokers (rank 0 / null suit) are placed first as universal wildcards.
 */
export function sortCardsByRank(cards: Card[], direction: SortDirection = 'desc'): Card[] {
  try {
    if (!cards || !Array.isArray(cards)) return [];
    return [...cards].sort((a, b) => {
      // Natural Jokers first
      const aIsJoker = a.isNaturalJoker || a.rank === 0 || a.suit === null;
      const bIsJoker = b.isNaturalJoker || b.rank === 0 || b.suit === null;
      if (aIsJoker && !bIsJoker) return -1;
      if (!aIsJoker && bIsJoker) return 1;
      if (aIsJoker && bIsJoker) return 0;

      // Primary filter: rank
      if (a.rank !== b.rank) {
        return direction === 'desc' ? b.rank - a.rank : a.rank - b.rank;
      }

      // Secondary filter: suit order
      const aSuitOrder = a.suit ? (SUIT_ORDER[a.suit] ?? 99) : 0;
      const bSuitOrder = b.suit ? (SUIT_ORDER[b.suit] ?? 99) : 0;
      return aSuitOrder - bSuitOrder;
    });
  } catch (err) {
    console.error('Error in sortCardsByRank:', err);
    return cards || [];
  }
}

export interface HandOverlapResult {
  overlapMargin: number; // in pixels (<= 0 when overlapping, 0 when normal)
  visibleCardWidth: number; // in pixels
  isOverlapping: boolean;
}

/**
 * Calculates adaptive negative margin for hand cards so that 14 to 26 cards
 * dynamically fan out and fit within available tray width without horizontal scrolling.
 * Guarantees that at least `minVisibleWidth` (default 28px: enough to see the rank + suit pip column)
 * remains exposed for every card.
 */
export function calculateHandOverlap({
  cardCount,
  containerWidth,
  cardWidth = 96,
  minVisibleWidth = 28,
  naturalGap = 8,
}: {
  cardCount: number;
  containerWidth: number;
  cardWidth?: number;
  minVisibleWidth?: number;
  naturalGap?: number;
}): HandOverlapResult {
  if (cardCount <= 1 || containerWidth <= 0) {
    return {
      overlapMargin: 0,
      visibleCardWidth: cardWidth,
      isOverlapping: false,
    };
  }

  // Total width without overlap:
  const naturalTotalWidth = cardWidth * cardCount + naturalGap * (cardCount - 1);
  if (naturalTotalWidth <= containerWidth) {
    return {
      overlapMargin: 0,
      visibleCardWidth: cardWidth,
      isOverlapping: false,
    };
  }

  // Calculate target overlap per card using Math.floor to ensure total width never exceeds containerWidth
  // Total width = cardWidth * cardCount + (cardCount - 1) * overlapMargin <= containerWidth
  const rawOverlap = Math.floor((containerWidth - cardWidth * cardCount) / (cardCount - 1));
  const minOverlap = minVisibleWidth - cardWidth; // e.g. 28 - 96 = -68px
  const overlapMargin = Math.min(0, Math.max(minOverlap, rawOverlap));
  const visibleCardWidth = cardWidth + overlapMargin;

  return {
    overlapMargin,
    visibleCardWidth,
    isOverlapping: overlapMargin < 0,
  };
}

export interface PlayerHandProps {
  cards: Card[];
  selectedCardIds?: string[];
  newCardIds?: string[];
  onToggleCardSelection?: (cardId: string) => void;
  onSelectCard?: (card: Card) => void;
  onClearSelection?: () => void;
  playerName?: string;
  playerTeam?: Team;
  isCurrentPlayer?: boolean;
  disabled?: boolean;
  cardSize?: 'sm' | 'md' | 'lg';
  className?: string;
  sortMode?: SortMode;
  onSortChange?: (mode: SortMode) => void;
  sortDirection?: SortDirection;
  onSortDirectionChange?: (direction: SortDirection) => void;
  initialSort?: SortMode;
  initialSortDirection?: SortDirection;
  isRippling?: boolean;
  actionsSlot?: React.ReactNode;
  onReorderCards?: (cards: Card[]) => void;
  isHovering?: boolean;
  frustrationCooldownUntil?: number;
  onTriggerFrustration?: () => void;
  cardsPickedUpThisTurn?: string[];
  initialHandSizeThisTurn?: number;
  containerWidth?: number;
  minVisibleCardWidth?: number;
  isChoosingPukar?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  selectedCardIds = [],
  newCardIds = [],
  cardsPickedUpThisTurn = [],
  initialHandSizeThisTurn,
  onToggleCardSelection,
  onSelectCard,
  onClearSelection,
  playerName = 'Your Hand',
  playerTeam,
  isCurrentPlayer = true,
  disabled = false,
  cardSize = 'md',
  className = '',
  sortMode: controlledSortMode,
  onSortChange,
  sortDirection: controlledSortDirection,
  onSortDirectionChange: _onSortDirectionChange,
  initialSort = 'suit',
  initialSortDirection = 'desc',
  isRippling = false,
  actionsSlot,
  onReorderCards,
  isHovering = false,
  frustrationCooldownUntil,
  onTriggerFrustration,
  containerWidth,
  minVisibleCardWidth,
  isChoosingPukar = false,
  isCollapsed: controlledIsCollapsed,
  onToggleCollapse,
}) => {
  const [internalSortMode, setInternalSortMode] = useState<SortMode>(initialSort);
  const [internalSortDirection] = useState<SortDirection>(initialSortDirection);
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);

  const isCollapsed = controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalIsCollapsed;
  const handleToggleCollapse = () => {
    const next = !isCollapsed;
    setInternalIsCollapsed(next);
    onToggleCollapse?.(next);
  };

  // Live timer for frustration cooldown countdown
  const [now, setNow] = useState(() => Date.now());

  // Inner tray measurement & fanning state
  const trayRef = useRef<HTMLDivElement | null>(null);
  const [measuredTrayWidth, setMeasuredTrayWidth] = useState<number>(0);
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateWidth = () => {
      if (trayRef.current) {
        // clientWidth minus horizontal padding (p-2.5 sm:p-3 = ~20-24px total)
        const measured = trayRef.current.clientWidth - 24;
        if (measured > 0) {
          setMeasuredTrayWidth(measured);
        }
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && trayRef.current) {
      ro = new ResizeObserver(updateWidth);
      ro.observe(trayRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateWidth);
      ro?.disconnect();
    };
  }, []);

  React.useEffect(() => {
    if (!frustrationCooldownUntil || frustrationCooldownUntil <= Date.now()) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(interval);
  }, [frustrationCooldownUntil]);

  const frustrationRemainingSecs = useMemo(() => {
    if (!frustrationCooldownUntil) return 0;
    return Math.max(0, Math.ceil((frustrationCooldownUntil - now) / 1000));
  }, [frustrationCooldownUntil, now]);

  const isFrustratedOnCooldown = frustrationRemainingSecs > 0;

  // Manual custom arrangement order (list of card IDs)
  const [customOrder, setCustomOrder] = useState<string[]>([]);

  // Drag and Drop interaction state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Automatically reset drag state whenever hand cards change or perspective switches
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__pukarActiveDragCardIds = null;
    }
    setIsDragging(false);
    setDraggedIndex(null);
    setDraggedCardId(null);
    setDragOverIndex(null);
  }, [cards]);

  // Window-level safety cleanup: always clear drag state if drag ends or mouse releases anywhere
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleGlobalDragClean = () => {
      (window as any).__pukarActiveDragCardIds = null;
      setIsDragging(false);
      setDraggedIndex(null);
      setDraggedCardId(null);
      setDragOverIndex(null);
    };

    window.addEventListener('dragend', handleGlobalDragClean);
    window.addEventListener('drop', handleGlobalDragClean);
    window.addEventListener('mouseup', handleGlobalDragClean);
    return () => {
      window.removeEventListener('dragend', handleGlobalDragClean);
      window.removeEventListener('drop', handleGlobalDragClean);
      window.removeEventListener('mouseup', handleGlobalDragClean);
    };
  }, []);

  // Ref to suppress accidental click/selection right after dropping a card
  const dragJustEndedRef = useRef(false);

  // Touch drag state ref for tablet / mobile touchscreens (supports 300ms long-press to separate scrolling from reordering)
  const touchStateRef = useRef<{
    startIndex: number;
    cardId: string;
    startX: number;
    startY: number;
    hasMoved: boolean;
    isLongPressed: boolean;
    timer: any;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (touchStateRef.current?.timer) {
        clearTimeout(touchStateRef.current.timer);
      }
    };
  }, []);

  const activeSortMode = controlledSortMode !== undefined ? controlledSortMode : internalSortMode;
  const activeSortDirection = controlledSortDirection !== undefined ? controlledSortDirection : internalSortDirection;

  const handleSetSort = (mode: SortMode) => {
    try {
      if (controlledSortMode === undefined) {
        setInternalSortMode(mode);
      }
      onSortChange?.(mode);
    } catch (err) {
      console.error('Error in handleSetSort:', err);
    }
  };


  // Derive cards to display: defaults to suit (primary) and rank (secondary)
  const displayCards = useMemo(() => {
    try {
      if (activeSortMode === 'rank') {
        return sortCardsByRank(cards, activeSortDirection);
      }
      if (activeSortMode === 'none') {
        // When in manual custom order or disabled sort ('none')
        if (customOrder.length > 0) {
          const cardMap = new Map(cards.map((c) => [c.id, c]));
          const ordered: Card[] = [];
          // Place known cards in customOrder sequence
          for (const id of customOrder) {
            const card = cardMap.get(id);
            if (card) {
              ordered.push(card);
              cardMap.delete(id);
            }
          }
          // Append any newly drawn / unarranged cards to the end
          for (const remainingCard of cardMap.values()) {
            ordered.push(remainingCard);
          }
          return ordered;
        }
        return cards;
      }
      // Default sequencing: Primary by suit, Secondary by rank (descending)
      return sortCardsBySuit(cards, activeSortDirection);
    } catch (err) {
      console.error('Error calculating displayCards in PlayerHand:', err);
      return sortCardsBySuit(cards, activeSortDirection);
    }
  }, [cards, activeSortMode, activeSortDirection, customOrder]);

  const selectedSet = useMemo(() => new Set(selectedCardIds), [selectedCardIds]);
  const newCardSet = useMemo(() => new Set(newCardIds), [newCardIds]);
  const cannotDiscardSet = useMemo(() => {
    if (!cardsPickedUpThisTurn || cardsPickedUpThisTurn.length !== 1) {
      return new Set<string>();
    }
    // If started with only 1 card in hand, player is allowed to discard the picked up card!
    if (initialHandSizeThisTurn === 1) {
      return new Set<string>();
    }
    return new Set<string>(cardsPickedUpThisTurn);
  }, [cardsPickedUpThisTurn, initialHandSizeThisTurn]);

  const effectiveContainerWidth =
    containerWidth !== undefined
      ? containerWidth
      : measuredTrayWidth > 0
      ? measuredTrayWidth
      : typeof window !== 'undefined'
      ? Math.max(600, window.innerWidth - 64)
      : 1200;

  const effectiveCardWidth =
    cardSize === 'sm' ? 64 : cardSize === 'lg' ? 120 : effectiveContainerWidth >= 640 ? 96 : 80;

  const overlapInfo = useMemo(() => {
    return calculateHandOverlap({
      cardCount: displayCards.length,
      containerWidth: effectiveContainerWidth,
      cardWidth: effectiveCardWidth,
      minVisibleWidth: minVisibleCardWidth ?? 28,
      naturalGap: 8,
    });
  }, [displayCards.length, effectiveContainerWidth, effectiveCardWidth, minVisibleCardWidth]);

  // Card reordering logic
  const handleMoveCard = useCallback(
    (sourceIndex: number, targetIndex: number) => {
      if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0) return;
      if (sourceIndex >= displayCards.length || targetIndex >= displayCards.length) return;

      try {
        const newCards = [...displayCards];
        const [movedCard] = newCards.splice(sourceIndex, 1);
        newCards.splice(targetIndex, 0, movedCard);

        setCustomOrder(newCards.map((c) => c.id));
        if (activeSortMode !== 'none') {
          handleSetSort('none');
        }
        onReorderCards?.(newCards);
      } catch (err) {
        console.error('Error in handleMoveCard:', err);
      }
    },
    [displayCards, activeSortMode, onReorderCards]
  );

  // Desktop HTML5 Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number, card: Card) => {
    if (disabled) return;
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      e.dataTransfer.setData('card-id', card.id);

      const isCardSelected = selectedCardIds && selectedCardIds.includes(card.id);
      const draggedCardIds =
        isCardSelected && selectedCardIds && selectedCardIds.length > 0
          ? selectedCardIds
          : [card.id];

      e.dataTransfer.setData('card-ids', JSON.stringify(draggedCardIds));
      e.dataTransfer.setData(
        'application/json',
        JSON.stringify({ index, id: card.id, cardIds: draggedCardIds })
      );

      if (typeof window !== 'undefined') {
        (window as any).__pukarActiveDragCardIds = draggedCardIds;
      }

      setIsDragging(true);
      setDraggedIndex(index);
      setDraggedCardId(card.id);
    } catch (err) {
      console.error('Error in handleDragStart:', err);
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = 'move';
      if (dragOverIndex !== index) {
        setDragOverIndex(index);
      }
    } catch (err) {
      console.error('Error in handleDragOver:', err);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, index: number) => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    try {
      const sourceIndexStr = e.dataTransfer.getData('text/plain');
      const sourceIndex = draggedIndex !== null ? draggedIndex : parseInt(sourceIndexStr, 10);
      if (!isNaN(sourceIndex) && sourceIndex >= 0) {
        handleMoveCard(sourceIndex, targetIndex);
      }
    } catch (err) {
      console.error('Error in handleDrop:', err);
    } finally {
      handleDragEnd();
    }
  };

  const handleDragEnd = () => {
    if (typeof window !== 'undefined') {
      (window as any).__pukarActiveDragCardIds = null;
    }
    setIsDragging(false);
    setDraggedIndex(null);
    setDraggedCardId(null);
    setDragOverIndex(null);
    dragJustEndedRef.current = true;
    setTimeout(() => {
      dragJustEndedRef.current = false;
    }, 150);
  };

  // Mobile / Tablet Touch Drag handlers with 300ms long-press separation
  const handleTouchStart = (e: React.TouchEvent, index: number, card: Card) => {
    if (disabled || e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (touchStateRef.current?.timer) {
      clearTimeout(touchStateRef.current.timer);
    }
    const timer = setTimeout(() => {
      if (touchStateRef.current) {
        touchStateRef.current.isLongPressed = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(30);
          } catch {
            // ignore
          }
        }
      }
    }, 300);

    touchStateRef.current = {
      startIndex: index,
      cardId: card.id,
      startX: touch.clientX,
      startY: touch.clientY,
      hasMoved: false,
      isLongPressed: false,
      timer,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStateRef.current || disabled) return;
    if (e.touches.length > 1) {
      // Multi-touch cancellation (e.g. user pinches or uses 2 fingers)
      if (touchStateRef.current.timer) {
        clearTimeout(touchStateRef.current.timer);
      }
      touchStateRef.current = null;
      handleDragEnd();
      return;
    }
    const touch = e.touches[0];
    const dx = touch.clientX - touchStateRef.current.startX;
    const dy = touch.clientY - touchStateRef.current.startY;

    // If finger moves before 300ms long-press threshold, cancel long-press to allow natural tray scrolling
    if (!touchStateRef.current.isLongPressed) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (touchStateRef.current.timer) {
          clearTimeout(touchStateRef.current.timer);
          touchStateRef.current.timer = null;
        }
      }
      return;
    }

    // Long press was achieved: start card reorder drag
    if (!touchStateRef.current.hasMoved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      touchStateRef.current.hasMoved = true;
      setIsDragging(true);
      setDraggedIndex(touchStateRef.current.startIndex);
      setDraggedCardId(touchStateRef.current.cardId);
    }

    if (touchStateRef.current.hasMoved) {
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const cardSlot = el?.closest('[data-card-index]');
      if (cardSlot) {
        const targetIdx = parseInt(cardSlot.getAttribute('data-card-index') || '-1', 10);
        if (targetIdx >= 0 && targetIdx !== dragOverIndex) {
          setDragOverIndex(targetIdx);
        }
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchStateRef.current?.timer) {
      clearTimeout(touchStateRef.current.timer);
    }
    if (!touchStateRef.current) {
      if (isDragging) {
        handleDragEnd();
      }
      return;
    }
    const { startIndex, hasMoved, isLongPressed } = touchStateRef.current;
    touchStateRef.current = null;

    if (hasMoved && isLongPressed && dragOverIndex !== null && dragOverIndex !== startIndex) {
      handleMoveCard(startIndex, dragOverIndex);
    }

    if (hasMoved || isDragging) {
      handleDragEnd();
    } else {
      // Normal tap without drag: reset transient drag states without setting dragJustEndedRef=true,
      // so the ensuing click event correctly toggles card selection.
      setDragOverIndex(null);
      setDraggedIndex(null);
      setDraggedCardId(null);
      setIsDragging(false);
    }
  };

  const handleCardClick = (card: Card) => {
    if (disabled || dragJustEndedRef.current) return;
    try {
      onToggleCardSelection?.(card.id);
      onSelectCard?.(card);
    } catch (err) {
      console.error('Error in handleCardClick:', err);
    }
  };

  return (
    <div
      data-testid="player-hand"
      className={`w-full wood-hand-tray rounded-xl sm:rounded-2xl p-2 sm:p-2.5 shadow-2xl flex flex-col gap-1.5 text-stone-900 ${className}`}
    >
      {/* HAND TOOLBAR & STATUS (STRICT ONE LINE) */}
      <div className="relative flex flex-nowrap items-center justify-between gap-1 sm:gap-2 border-b border-[#a47b4e]/40 pb-1.5 w-full overflow-x-hidden overflow-y-hidden">
        {/* PLAYER IDENTITY & CARD COUNTS */}
        {/* Mobile Compact Identity (<768px): Avatar + Name + Selected Count */}
        <div className="flex md:hidden items-center gap-1 shrink-0 min-w-0">
          <div className="w-7 h-7 rounded-full bg-stone-900 text-stone-100 border-2 border-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
            {playerName ? playerName.charAt(0).toUpperCase() : 'P'}
          </div>
          <span className="font-black text-stone-950 text-xs tracking-tight truncate max-w-[50px]">
            {playerName}
          </span>
          {!isChoosingPukar && selectedCardIds.length > 0 && (
            <span
              data-testid="selected-count"
              className="text-amber-950 font-black bg-amber-200 border border-amber-400 px-1 py-0.5 rounded-md text-[10px] shrink-0 leading-none"
            >
              {selectedCardIds.length}
            </span>
          )}
        </div>

        {/* Desktop Full Identity (md: and up - 100% untouched) */}
        <div className="hidden md:flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-stone-900 text-stone-100 border-2 border-white flex items-center justify-center font-black text-sm sm:text-base shrink-0 shadow-md">
            {playerName ? playerName.charAt(0).toUpperCase() : 'P'}
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="font-black text-stone-950 text-sm sm:text-base tracking-tight">{playerName}</span>
              {playerTeam && (
                <span
                  className={`text-[10px] sm:text-xs font-black px-1.5 sm:px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm ${
                    playerTeam === 'A'
                      ? 'bg-blue-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {`Team ${playerTeam}`}
                </span>
              )}
              {isCurrentPlayer && (
                <span className="text-[10px] sm:text-xs font-black text-emerald-950 bg-emerald-300 border border-emerald-500 px-1.5 sm:px-2 py-0.5 rounded-md shadow-sm">
                  Active Turn
                </span>
              )}
              {isHovering && (
                <span
                  data-testid="badge-hovering-dock"
                  className="text-[10px] sm:text-xs font-black text-amber-950 bg-amber-300 border border-amber-500 px-1.5 sm:px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1"
                  title="Hand is hovering docked at the bottom because sequences have expanded to a second row. Scroll the board up/down to see all sequences."
                >
                  <Pin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-900" />
                  <span>Docked at Bottom</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-stone-700 font-bold leading-none">
              <span
                data-testid="card-count"
                className={`font-extrabold ${isChoosingPukar ? 'text-amber-800 animate-pulse' : 'text-stone-900'}`}
              >
                {isChoosingPukar
                  ? 'Selecting Pukar Deck...'
                  : `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`}
              </span>
              {!isChoosingPukar && selectedCardIds.length > 0 && (
                <>
                  <span className="text-stone-500">•</span>
                  <span
                    data-testid="selected-count"
                    className="text-amber-950 font-black bg-amber-200 border border-amber-400 px-1.5 py-0.5 rounded-md leading-none inline-flex items-center text-xs"
                  >
                    {`${selectedCardIds.length} selected`}
                  </span>
                </>
              )}
              {!isChoosingPukar && (
                <>
                  <span className="text-stone-400 hidden 2xl:inline">•</span>
                  <span className="text-xs font-semibold text-stone-600 hidden 2xl:inline" title="Drag cards to rearrange them in any custom order">
                    Drag cards to reorder
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* CONTEXTUAL ACTION CONTROLS SLOT (CENTER INLINE ROW) */}
        {!isChoosingPukar && actionsSlot && (
          <div className="flex items-center justify-center my-0 flex-1 min-w-0 max-w-xl mx-1 md:mx-auto h-8 md:h-9 overflow-visible md:overflow-hidden">
            {actionsSlot}
          </div>
        )}

        {/* RIGHT ACTIONS: CLEAR SELECTION + FRUSTRATION BUTTON + HIDE HAND */}
        <div className="shrink-0 flex items-center justify-end gap-1 sm:gap-2 h-8 sm:h-9 z-10">
          {!isChoosingPukar && selectedCardIds.length > 0 && (
            <button
              type="button"
              aria-label="Clear Selection"
              data-testid="btn-clear-selection"
              onClick={onClearSelection}
              className="h-7 sm:h-8.5 px-1.5 sm:px-2.5 text-xs font-bold text-stone-800 hover:text-stone-950 bg-stone-200 hover:bg-stone-300 border border-stone-400 rounded-lg sm:rounded-xl flex items-center gap-1 transition-colors cursor-pointer shadow-sm animate-in fade-in duration-100 shrink-0"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          {onTriggerFrustration && (
            <button
              type="button"
              aria-label="Frustration"
              data-testid="btn-frustration"
              onClick={onTriggerFrustration}
              disabled={isFrustratedOnCooldown || isChoosingPukar}
              title={
                isFrustratedOnCooldown
                  ? `Frustration is on cooldown (${frustrationRemainingSecs}s remaining)`
                  : 'Express your frustration!'
              }
              className={`h-7 sm:h-8.5 px-1.5 sm:px-2.5 text-xs sm:text-sm font-black rounded-lg sm:rounded-xl flex items-center justify-center gap-1 transition-all shadow-sm shrink-0 ${
                isFrustratedOnCooldown || isChoosingPukar
                  ? 'bg-stone-300/80 text-stone-500 border border-stone-400 cursor-not-allowed opacity-75'
                  : 'bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white border border-rose-700 active:scale-95 shadow-orange-500/20 cursor-pointer'
              }`}
            >
              <span className="text-sm leading-none shrink-0" role="img" aria-label="fire">🔥</span>
              <span className="hidden sm:inline">{isFrustratedOnCooldown ? `Frustration (${frustrationRemainingSecs}s)` : 'Frustration'}</span>
            </button>
          )}

          {/* HIDE / SHOW CARDS TOGGLE BUTTON */}
          <button
            type="button"
            aria-label={isCollapsed ? 'Show Cards' : 'Hide Cards'}
            aria-expanded={!isCollapsed}
            data-testid="btn-toggle-hand-collapse"
            onClick={handleToggleCollapse}
            title={
              isCollapsed
                ? 'Show your hand cards'
                : 'Hide your hand cards to view the table'
            }
            className={`h-7 sm:h-8.5 px-1.5 sm:px-3 text-xs sm:text-sm font-black rounded-lg sm:rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer shadow-md shrink-0 ${
              isCollapsed
                ? 'bg-amber-400 hover:bg-amber-300 text-stone-950 border-2 border-amber-300 font-black shadow-amber-500/30 ring-2 ring-amber-400/60'
                : 'bg-stone-900 hover:bg-stone-800 text-amber-300 hover:text-amber-200 border-2 border-amber-400/80 shadow-stone-950/40'
            }`}
          >
            {isCollapsed ? (
              <>
                <Eye className="w-4 h-4 text-stone-950 shrink-0" />
                <span className="hidden sm:inline">Show Cards</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Hide Cards</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* CARDS DISPLAY CONTAINER (RECESSED WOODEN TRAY SLOT OR COLLAPSED BAR) */}
      {isCollapsed ? (
        <button
          type="button"
          data-testid="collapsed-hand-bar"
          aria-label={`Hand Hidden • Click to show ${cards.length} cards`}
          onClick={handleToggleCollapse}
          className="w-full py-2 px-3 sm:px-4 rounded-xl wood-hand-slot border border-amber-500/40 hover:border-amber-400/80 bg-amber-950/40 hover:bg-amber-950/60 flex items-center justify-between text-stone-200 transition-all cursor-pointer shadow-inner group"
        >
          <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-amber-200">
            <Eye className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>{`Hand Hidden • Click to show ${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`}</span>
          </div>
          <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-400 text-stone-950 group-hover:bg-amber-300 shadow-sm transition-colors">
            Show Hand ▲
          </span>
        </button>
      ) : (
        <div
          ref={trayRef}
          className="relative w-full h-[148px] sm:h-[172px] min-h-[148px] sm:min-h-[172px] max-h-[148px] sm:max-h-[172px] wood-hand-slot rounded-xl sm:rounded-2xl p-2 sm:p-2.5 overflow-x-auto overflow-y-hidden pb-2 pt-2 sm:pt-2.5 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-transparent shadow-inner group"
          tabIndex={0}
          aria-label="Hand Cards"
        >
        {isChoosingPukar ? (
          <div
            data-testid="pukar-selection-pending-tray"
            className="h-full flex flex-col items-center justify-center gap-2 py-4 animate-pulse select-none text-center"
          >
            <div className="flex items-center justify-center gap-2 text-amber-300 font-black text-base sm:text-lg tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
              <span role="img" aria-label="sparkles">✨</span>
              <span>Selecting Pukar Deck...</span>
            </div>
            <p className="text-amber-100/80 text-xs sm:text-sm font-semibold max-w-md text-center">
              Choose which Auspicious Pukar deck will bless your hand from the prompt above to receive your 13 cards.
            </p>
          </div>
        ) : displayCards.length === 0 ? (
          <div className="py-8 text-center text-amber-200/80 text-base font-bold">
            Hand is empty
          </div>
        ) : (
          <div
            data-is-overlapping={overlapInfo.isOverlapping ? 'true' : undefined}
            className={`flex items-end ${overlapInfo.isOverlapping ? 'gap-0' : 'gap-1.5 sm:gap-2'} min-w-max px-2 py-1`}
          >
            {displayCards.map((card, index) => {
              const isSelected = selectedSet.has(card.id);
              const isNew = newCardSet.has(card.id);
              const isDisallowedFromDiscard = cannotDiscardSet.has(card.id);
              const isBeingDragged =
                isDragging && (draggedCardId ? draggedCardId === card.id : draggedIndex === index);
              const isDropTarget = isDragging && dragOverIndex === index && draggedIndex !== index;
              const isHovered = hoveredCardIndex === index;

              const animationClasses = isRippling
                ? 'animate-card-ripple'
                : isNew
                ? 'animate-card-deal-in'
                : '';

              const slotMarginLeft =
                overlapInfo.isOverlapping && index > 0 ? `${overlapInfo.overlapMargin}px` : undefined;

              const slotZIndex = isHovered
                ? 50
                : isDropTarget
                ? 45
                : isSelected
                ? 40
                : isBeingDragged
                ? 30
                : overlapInfo.isOverlapping
                ? index + 1
                : undefined;

              const animStyle: React.CSSProperties = {
                ...(isRippling
                  ? { animationDelay: `${(index % 12) * 50}ms` }
                  : isNew
                  ? { animationDelay: `${(index % 8) * 40}ms` }
                  : {}),
                ...(slotMarginLeft ? { marginLeft: slotMarginLeft } : {}),
                ...(slotZIndex !== undefined ? { zIndex: slotZIndex } : {}),
              };

              return (
                <div
                  key={card.id || `card-${index}`}
                  data-card-index={index}
                  data-testid={`hand-card-slot-${index}`}
                  draggable={!disabled}
                  onMouseEnter={() => setHoveredCardIndex(index)}
                  onMouseLeave={() => setHoveredCardIndex((prev) => (prev === index ? null : prev))}
                  onFocus={() => setHoveredCardIndex(index)}
                  onBlur={() => setHoveredCardIndex((prev) => (prev === index ? null : prev))}
                  onDragStart={(e) => handleDragStart(e, index, card)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={(e) => handleDragLeave(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={(e) => handleTouchStart(e, index, card)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  style={animStyle}
                  className={`relative transition-all duration-150 transform ${animationClasses} ${
                    isBeingDragged
                      ? 'opacity-60 scale-95 ring-2 ring-amber-400 cursor-grabbing z-30'
                      : isDropTarget
                      ? 'scale-105 z-20 cursor-grabbing'
                      : isHovered
                      ? '-translate-y-4 shadow-2xl z-50 cursor-grab'
                      : isSelected
                      ? '-translate-y-3.5 z-20 cursor-grab'
                      : isNew
                      ? '-translate-y-1 hover:-translate-y-4 hover:z-30 cursor-grab'
                      : 'hover:-translate-y-4 hover:z-30 cursor-grab'
                  }`}
                  title={
                    isDisallowedFromDiscard
                      ? 'Single card picked up this turn (cannot discard this turn) • Drag to reorder'
                      : 'Click to select • Drag to reorder'
                  }
                >
                  {/* Drop Target Insertion Indicator Line */}
                  {isDropTarget && (
                    <div
                      data-testid="drag-drop-indicator"
                      className={`absolute top-0 bottom-0 w-1.5 bg-amber-400 rounded-full shadow-lg shadow-amber-400/80 animate-pulse z-30 pointer-events-none ${
                        draggedIndex !== null && draggedIndex < index ? '-right-1' : '-left-1'
                      }`}
                    />
                  )}

                  <PlayingCard
                    card={card}
                    size={cardSize}
                    isSelected={isSelected}
                    isNew={isNew}
                    disabled={disabled}
                    onClick={() => handleCardClick(card)}
                    className="select-none"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
};
