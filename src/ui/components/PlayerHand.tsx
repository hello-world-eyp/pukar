import React, { useState, useMemo } from 'react';
import { Card, Suit, Team } from '../../engine/types';
import { PlayingCard } from './PlayingCard';
import { ArrowDownUp, Sparkles, X, ArrowDown, ArrowUp } from 'lucide-react';

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
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  selectedCardIds = [],
  newCardIds = [],
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
  onSortDirectionChange,
  initialSort = 'none',
  initialSortDirection = 'desc',
  isRippling = false,
  actionsSlot,
}) => {
  const [internalSortMode, setInternalSortMode] = useState<SortMode>(initialSort);
  const [internalSortDirection, setInternalSortDirection] = useState<SortDirection>(initialSortDirection);

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

  const handleSetDirection = (direction: SortDirection) => {
    try {
      if (controlledSortDirection === undefined) {
        setInternalSortDirection(direction);
      }
      onSortDirectionChange?.(direction);
      if (activeSortMode === 'none') {
        handleSetSort('suit');
      }
    } catch (err) {
      console.error('Error in handleSetDirection:', err);
    }
  };

  // Sort cards based on activeSortMode and activeSortDirection (Dual Filter)
  const displayCards = useMemo(() => {
    try {
      if (activeSortMode === 'suit') {
        return sortCardsBySuit(cards, activeSortDirection);
      }
      if (activeSortMode === 'rank') {
        return sortCardsByRank(cards, activeSortDirection);
      }
      return cards;
    } catch (err) {
      console.error('Error calculating displayCards in PlayerHand:', err);
      return cards;
    }
  }, [cards, activeSortMode, activeSortDirection]);

  const selectedSet = useMemo(() => new Set(selectedCardIds), [selectedCardIds]);
  const newCardSet = useMemo(() => new Set(newCardIds), [newCardIds]);

  const handleCardClick = (card: Card) => {
    if (disabled) return;
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
      className={`w-full wood-hand-tray rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl flex flex-col gap-2.5 text-stone-900 ${className}`}
    >
      {/* HAND TOOLBAR & STATUS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#a47b4e]/40 pb-2">
        {/* PLAYER IDENTITY & CARD COUNTS */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-stone-900 text-stone-100 border-2 border-white flex items-center justify-center font-black text-base shrink-0 shadow-md">
              {playerName ? playerName.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-stone-950 text-base sm:text-lg tracking-tight">{playerName}</span>
                {playerTeam && (
                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm ${
                      playerTeam === 'A'
                        ? 'bg-blue-600 text-white'
                        : 'bg-amber-600 text-white'
                    }`}
                  >
                    {`Team ${playerTeam}`}
                  </span>
                )}
                {isCurrentPlayer && (
                  <span className="text-xs font-black text-emerald-950 bg-emerald-300 border border-emerald-500 px-2 py-0.5 rounded-md shadow-sm">
                    Active Turn
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-stone-700 mt-0.5 font-bold">
                <span data-testid="card-count" className="font-extrabold text-stone-900">
                  {`${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`}
                </span>
                {selectedCardIds.length > 0 && (
                  <>
                    <span className="text-stone-500">•</span>
                    <span data-testid="selected-count" className="text-amber-950 font-black bg-amber-200 border border-amber-400 px-2 py-0.5 rounded-md">
                      {`${selectedCardIds.length} selected`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CONTEXTUAL ACTION CONTROLS SLOT */}
        {actionsSlot && (
          <div className="flex items-center justify-center my-1 sm:my-0 flex-1 max-w-xl mx-auto">
            {actionsSlot}
          </div>
        )}

        {/* SORT CONTROLS & SELECTION ACTIONS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* PRIMARY SORT BUTTONS (Suit vs Rank) */}
          <div className="flex items-center rounded-xl bg-stone-100 p-1 border border-stone-300 shadow-sm">
            <button
              type="button"
              aria-label="Sort by Suit"
              onClick={() => handleSetSort(activeSortMode === 'suit' ? 'none' : 'suit')}
              className={`h-9 px-3 text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSortMode === 'suit'
                  ? 'bg-stone-900 text-white shadow-md'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-200'
              }`}
              title="Primary: Group by Suit (♠ ♥ ♣ ♦), Secondary: Rank"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Sort by Suit</span>
            </button>
            <button
              type="button"
              aria-label="Sort by Rank"
              onClick={() => handleSetSort(activeSortMode === 'rank' ? 'none' : 'rank')}
              className={`h-9 px-3 text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSortMode === 'rank'
                  ? 'bg-stone-900 text-white shadow-md'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-200'
              }`}
              title="Primary: Group by Rank, Secondary: Suit"
            >
              <ArrowDownUp className="w-4 h-4 text-amber-500" />
              <span>Sort by Rank</span>
            </button>
          </div>

          {/* SECONDARY ORDER TOGGLE (Dual Filter: High → Low vs Low → High) */}
          <div
            data-testid="sort-direction-controls"
            className="flex items-center rounded-xl bg-stone-100 p-1 border border-stone-300 shadow-sm"
          >
            <button
              type="button"
              aria-label="Sort High to Low"
              data-testid="btn-sort-desc"
              onClick={() => handleSetDirection('desc')}
              className={`h-9 px-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                activeSortDirection === 'desc'
                  ? 'bg-emerald-700 text-white shadow-md'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
              }`}
              title={
                activeSortMode === 'suit'
                  ? 'Secondary filter: Highest card first, lowest card last (A → 2)'
                  : 'Primary filter: High to low (A → 2), secondary by suit'
              }
            >
              <ArrowDown className="w-4 h-4" />
              <span>High → Low</span>
            </button>
            <button
              type="button"
              aria-label="Sort Low to High"
              data-testid="btn-sort-asc"
              onClick={() => handleSetDirection('asc')}
              className={`h-9 px-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                activeSortDirection === 'asc'
                  ? 'bg-emerald-700 text-white shadow-md'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
              }`}
              title={
                activeSortMode === 'suit'
                  ? 'Secondary filter: Lowest card first, highest card last (2 → A)'
                  : 'Primary filter: Low to high (2 → A), secondary by suit'
              }
            >
              <ArrowUp className="w-4 h-4" />
              <span>Low → High</span>
            </button>
          </div>

          {/* CLEAR SELECTION BUTTON */}
          {selectedCardIds.length > 0 && (
            <button
              type="button"
              aria-label="Clear Selection"
              onClick={onClearSelection}
              className="h-9 px-3 text-sm font-bold text-stone-800 hover:text-stone-950 bg-stone-200 hover:bg-stone-300 border border-stone-400 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <X className="w-4 h-4" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* CARDS DISPLAY CONTAINER (RECESSED WOODEN TRAY SLOT) */}
      <div
        className="w-full wood-hand-slot rounded-2xl p-2.5 sm:p-3 overflow-x-auto pb-3 pt-3 scrollbar-thin scrollbar-thumb-stone-600 scrollbar-track-transparent shadow-inner"
        tabIndex={0}
        aria-label="Hand Cards"
      >
        {displayCards.length === 0 ? (
          <div className="py-8 text-center text-amber-200/80 text-base font-bold">
            Hand is empty
          </div>
        ) : (
          <div className="flex items-end gap-1 sm:gap-1.5 min-w-max px-2 py-1">
            {displayCards.map((card, index) => {
              const isSelected = selectedSet.has(card.id);
              const isNew = newCardSet.has(card.id);
              const animationClasses = isRippling
                ? 'animate-card-ripple'
                : isNew
                ? 'animate-card-deal-in'
                : '';

              const animStyle: React.CSSProperties = isRippling
                ? { animationDelay: `${(index % 12) * 50}ms` }
                : isNew
                ? { animationDelay: `${(index % 8) * 40}ms` }
                : {};

              return (
                <div
                  key={card.id || `card-${index}`}
                  style={animStyle}
                  className={`transition-all duration-150 transform ${animationClasses} ${
                    isSelected
                      ? '-translate-y-4'
                      : isNew
                      ? '-translate-y-2 hover:-translate-y-3'
                      : 'hover:-translate-y-2'
                  }`}
                >
                  <PlayingCard
                    card={card}
                    size={cardSize}
                    isSelected={isSelected}
                    isNew={isNew}
                    disabled={disabled}
                    onClick={() => handleCardClick(card)}
                    className="cursor-pointer select-none"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
