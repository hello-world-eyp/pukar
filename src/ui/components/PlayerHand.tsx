import React, { useState, useMemo } from 'react';
import { Card, Suit, Team } from '../../engine/types';
import { PlayingCard } from './PlayingCard';
import { ArrowDownUp, Sparkles, X, User } from 'lucide-react';

export type SortMode = 'suit' | 'rank' | 'none';

const SUIT_ORDER: Record<Suit, number> = {
  SPADES: 1,
  HEARTS: 2,
  CLUBS: 3,
  DIAMONDS: 4,
};

/**
 * Sorts cards by suit first, then by ascending rank (2..14).
 * Natural Jokers (null suit / rank 0) are placed first.
 */
export function sortCardsBySuit(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    // Natural Jokers first
    const aIsJoker = a.isNaturalJoker || a.rank === 0 || a.suit === null;
    const bIsJoker = b.isNaturalJoker || b.rank === 0 || b.suit === null;
    if (aIsJoker && !bIsJoker) return -1;
    if (!aIsJoker && bIsJoker) return 1;
    if (aIsJoker && bIsJoker) return 0;

    const suitDiff = (SUIT_ORDER[a.suit as Suit] ?? 99) - (SUIT_ORDER[b.suit as Suit] ?? 99);
    if (suitDiff !== 0) return suitDiff;

    return a.rank - b.rank;
  });
}

/**
 * Sorts cards by rank ascending (0/Jokers first, then 2..14).
 * Ties are broken by suit order.
 */
export function sortCardsByRank(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    const aSuitOrder = a.suit ? SUIT_ORDER[a.suit] : 0;
    const bSuitOrder = b.suit ? SUIT_ORDER[b.suit] : 0;
    return aSuitOrder - bSuitOrder;
  });
}

export interface PlayerHandProps {
  cards: Card[];
  selectedCardIds?: string[];
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
  initialSort?: SortMode;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  selectedCardIds = [],
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
  initialSort = 'none',
}) => {
  const [internalSortMode, setInternalSortMode] = useState<SortMode>(initialSort);
  const activeSortMode = controlledSortMode !== undefined ? controlledSortMode : internalSortMode;

  const handleSetSort = (mode: SortMode) => {
    if (controlledSortMode === undefined) {
      setInternalSortMode(mode);
    }
    onSortChange?.(mode);
  };

  // Sort cards based on activeSortMode
  const displayCards = useMemo(() => {
    if (activeSortMode === 'suit') {
      return sortCardsBySuit(cards);
    }
    if (activeSortMode === 'rank') {
      return sortCardsByRank(cards);
    }
    return cards;
  }, [cards, activeSortMode]);

  const selectedSet = useMemo(() => new Set(selectedCardIds), [selectedCardIds]);

  const handleCardClick = (card: Card) => {
    if (disabled) return;
    onToggleCardSelection?.(card.id);
    onSelectCard?.(card);
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
        <div className="flex items-center gap-2">
          {/* SORT BUTTONS */}
          <div className="flex items-center rounded-xl bg-slate-800/80 p-0.5 border border-slate-700">
            <button
              type="button"
              aria-label="Sort by Suit"
              onClick={() => handleSetSort(activeSortMode === 'suit' ? 'none' : 'suit')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeSortMode === 'suit'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
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
            >
              <ArrowDownUp className="w-3.5 h-3.5" />
              <span>Sort by Rank</span>
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
              return (
                <div
                  key={card.id || `card-${index}`}
                  className={`transition-all duration-150 transform ${
                    isSelected ? '-translate-y-2.5' : 'hover:-translate-y-1'
                  }`}
                >
                  <PlayingCard
                    card={card}
                    size={cardSize}
                    isSelected={isSelected}
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
