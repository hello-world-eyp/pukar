import React, { useState, useMemo } from 'react';
import { Card, Suit, Team } from '../../engine/types';
import { PlayingCard } from './PlayingCard';
import { ArrowDownUp, Sparkles, X, User, ArrowDown, ArrowUp } from 'lucide-react';

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
      className={`w-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3 ${className}`}
    >
      {/* HAND TOOLBAR & STATUS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        {/* PLAYER IDENTITY & CARD COUNTS */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 text-sm">{playerName}</span>
                {playerTeam && (
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                      playerTeam === 'A'
                        ? 'bg-blue-600/80 text-white'
                        : 'bg-amber-500/80 text-slate-950'
                    }`}
                  >
                    {`Team ${playerTeam}`}
                  </span>
                )}
                {isCurrentPlayer && (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-700/40 px-1.5 py-0.5 rounded">
                    Active Turn
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span data-testid="card-count" className="font-medium text-slate-300">
                  {`${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`}
                </span>
                {selectedCardIds.length > 0 && (
                  <>
                    <span>•</span>
                    <span data-testid="selected-count" className="text-amber-400 font-semibold">
                      {`${selectedCardIds.length} selected`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SORT CONTROLS & SELECTION ACTIONS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* PRIMARY SORT BUTTONS (Suit vs Rank) */}
          <div className="flex items-center rounded-xl bg-slate-800/80 p-0.5 border border-slate-700 shadow-sm">
            <button
              type="button"
              aria-label="Sort by Suit"
              onClick={() => handleSetSort(activeSortMode === 'suit' ? 'none' : 'suit')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeSortMode === 'suit'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Primary: Group by Suit (♠ ♥ ♣ ♦), Secondary: Rank"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sort by Suit</span>
            </button>
            <button
              type="button"
              aria-label="Sort by Rank"
              onClick={() => handleSetSort(activeSortMode === 'rank' ? 'none' : 'rank')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeSortMode === 'rank'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Primary: Group by Rank, Secondary: Suit"
            >
              <ArrowDownUp className="w-3.5 h-3.5" />
              <span>Sort by Rank</span>
            </button>
          </div>

          {/* SECONDARY ORDER TOGGLE (Dual Filter: High → Low vs Low → High) */}
          <div
            data-testid="sort-direction-controls"
            className="flex items-center rounded-xl bg-slate-800/80 p-0.5 border border-slate-700 shadow-sm"
          >
            <button
              type="button"
              aria-label="Sort High to Low"
              data-testid="btn-sort-desc"
              onClick={() => handleSetDirection('desc')}
              className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                activeSortDirection === 'desc'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
              }`}
              title={
                activeSortMode === 'suit'
                  ? 'Secondary filter: Highest card first, lowest card last (A → 2)'
                  : 'Primary filter: High to low (A → 2), secondary by suit'
              }
            >
              <ArrowDown className="w-3 h-3" />
              <span>High → Low</span>
            </button>
            <button
              type="button"
              aria-label="Sort Low to High"
              data-testid="btn-sort-asc"
              onClick={() => handleSetDirection('asc')}
              className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                activeSortDirection === 'asc'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
              }`}
              title={
                activeSortMode === 'suit'
                  ? 'Secondary filter: Lowest card first, highest card last (2 → A)'
                  : 'Primary filter: Low to high (2 → A), secondary by suit'
              }
            >
              <ArrowUp className="w-3 h-3" />
              <span>Low → High</span>
            </button>
          </div>

          {/* CLEAR SELECTION BUTTON */}
          {selectedCardIds.length > 0 && (
            <button
              type="button"
              aria-label="Clear Selection"
              onClick={onClearSelection}
              className="px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/70 rounded-lg flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* CARDS DISPLAY CONTAINER */}
      <div
        className="w-full overflow-x-auto pb-2 pt-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
        tabIndex={0}
        aria-label="Hand Cards"
      >
        {displayCards.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            Hand is empty
          </div>
        ) : (
          <div className="flex items-end gap-1.5 sm:gap-2 min-w-max px-1">
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
                      ? '-translate-y-2.5'
                      : isNew
                      ? '-translate-y-1 hover:-translate-y-2'
                      : 'hover:-translate-y-1'
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
