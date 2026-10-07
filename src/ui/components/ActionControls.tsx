import React, { useMemo } from 'react';
import { Card, Meld, TurnPhase } from '../../engine/types';
import { validateNewMeld, canAddCardsToMeld } from '../../engine/meld-validator';
import { getRankLabel, getSuitSymbol } from './PlayingCard';
import {
  PlusCircle,
  Trash2,
  ArrowDownCircle,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Inbox,
} from 'lucide-react';

export interface ActionControlsProps {
  phase: TurnPhase;
  selectedCards?: Card[];
  selectedCardIds?: string[];
  allHandCards?: Card[];
  selectedMeld?: Meld | null;
  canDrawStock?: boolean;
  canTakeDiscard?: boolean;
  stockCount?: number;
  discardCount?: number;
  onDrawStock?: () => void;
  onTakeDiscard?: () => void;
  onPlayMeld?: (cardIds: string[]) => void;
  onAddToMeld?: (meldId: string, cardIds: string[]) => void;
  onDiscard?: (cardId: string) => void;
  disabled?: boolean;
  className?: string;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  phase,
  selectedCards: explicitSelectedCards,
  selectedCardIds,
  allHandCards,
  selectedMeld,
  canDrawStock,
  canTakeDiscard,
  stockCount,
  discardCount,
  onDrawStock,
  onTakeDiscard,
  onPlayMeld,
  onAddToMeld,
  onDiscard,
  disabled = false,
  className = '',
}) => {
  // Resolve effective selected cards
  const selectedCards: Card[] = useMemo(() => {
    if (explicitSelectedCards) return explicitSelectedCards;
    if (selectedCardIds && allHandCards) {
      const idSet = new Set(selectedCardIds);
      return allHandCards.filter((c) => idSet.has(c.id));
    }
    return [];
  }, [explicitSelectedCards, selectedCardIds, allHandCards]);

  const selectedCardCount = selectedCards.length;

  // Phase flags
  const isDrawPhase = phase === 'DRAW';
  const isMeldPhase = phase === 'MELD';
  const isDiscardAllowed = phase === 'MELD' || phase === 'DISCARD';

  // 1. Draw controls eligibility
  const actualCanDrawStock =
    !disabled && isDrawPhase && (canDrawStock !== undefined ? canDrawStock : (stockCount === undefined || stockCount > 0));
  const actualCanTakeDiscard =
    !disabled && isDrawPhase && (canTakeDiscard !== undefined ? canTakeDiscard : (discardCount === undefined || discardCount > 0));

  // 2. Play New Meld Validation Preview
  const meldValidation = useMemo(() => {
    if (selectedCardCount < 3) {
      return {
        valid: false,
        error: selectedCardCount === 0 ? 'Select cards to meld' : `Need at least 3 cards (${selectedCardCount}/3)`,
      };
    }
    return validateNewMeld(selectedCards);
  }, [selectedCards, selectedCardCount]);

  const canPlayNewMeld = !disabled && isMeldPhase && meldValidation.valid;

  // 3. Add to Meld Validation Preview
  const addToMeldValidation = useMemo(() => {
    if (!selectedMeld) {
      return { valid: false, error: 'Select a meld on table first' };
    }
    if (selectedCardCount === 0) {
      return { valid: false, error: 'Select cards to add' };
    }
    return canAddCardsToMeld(selectedMeld, selectedCards);
  }, [selectedMeld, selectedCards, selectedCardCount]);

  const canAddToMeld = !disabled && isMeldPhase && addToMeldValidation.valid;

  // 4. Discard Card Eligibility
  const canDiscard = !disabled && isDiscardAllowed && selectedCardCount === 1;

  // Action handlers
  const handlePlayMeldClick = () => {
    if (!canPlayNewMeld) return;
    onPlayMeld?.(selectedCards.map((c) => c.id));
  };

  const handleAddToMeldClick = () => {
    if (!canAddToMeld || !selectedMeld) return;
    onAddToMeld?.(selectedMeld.id, selectedCards.map((c) => c.id));
  };

  const handleDiscardClick = () => {
    if (!canDiscard || selectedCards.length !== 1) return;
    onDiscard?.(selectedCards[0].id);
  };

  return (
    <div
      data-testid="action-controls"
      className={`w-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Turn Phase:</span>
          <span
            data-testid="current-phase-badge"
            className={`text-xs font-black px-2 py-0.5 rounded uppercase tracking-wider ${
              isDrawPhase
                ? 'bg-amber-500 text-slate-950'
                : isMeldPhase
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-red-500 text-white'
            }`}
          >
            {phase}
          </span>
        </div>

        {/* Real-time selection summary */}
        <div className="text-xs text-slate-400">
          {selectedCardCount === 0 ? (
            <span>No cards selected</span>
          ) : (
            <span className="text-slate-200">
              Selected:{' '}
              <strong className="text-amber-400">
                {selectedCards
                  .map((c) => `${getRankLabel(c.rank, c.isNaturalJoker || c.rank === 0)}${getSuitSymbol(c.suit)}`)
                  .join(', ')}
              </strong>
            </span>
          )}
        </div>
      </div>

      {/* ACTION BUTTONS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* ACTION 1: DRAW FROM STOCK */}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            data-testid="btn-draw-stock"
            disabled={!actualCanDrawStock}
            onClick={onDrawStock}
            className={`w-full h-12 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
              actualCanDrawStock
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-700/30 active:scale-95'
                : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">Draw Deck</span>
            {stockCount !== undefined && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-200 border border-blue-400/30">
                {stockCount}
              </span>
            )}
          </button>
          <div className="text-[11px] text-slate-400 text-center truncate">
            {isDrawPhase ? 'Draw 1 card from Stock' : 'Only in DRAW phase'}
          </div>
        </div>

        {/* ACTION 2: TAKE BOTTOM / DISCARD */}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            data-testid="btn-take-discard"
            disabled={!actualCanTakeDiscard}
            onClick={onTakeDiscard}
            className={`w-full h-12 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
              actualCanTakeDiscard
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-700/30 active:scale-95'
                : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
            }`}
          >
            <Inbox className="w-4 h-4 shrink-0" />
            <span className="truncate">Take Bottom</span>
            {discardCount !== undefined && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-200 border border-indigo-400/30">
                {discardCount}
              </span>
            )}
          </button>
          <div className="text-[11px] text-slate-400 text-center truncate">
            {isDrawPhase
              ? discardCount === 0
                ? 'Discard pile empty'
                : `Take all ${discardCount ?? ''} discards`
              : 'Only in DRAW phase'}
          </div>
        </div>

        {/* ACTION 3: MELD SELECTED (RUN / SET) */}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            data-testid="btn-play-meld"
            disabled={!canPlayNewMeld}
            onClick={handlePlayMeldClick}
            className={`w-full h-12 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
              canPlayNewMeld
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-700/30 ring-2 ring-emerald-400/40 active:scale-95'
                : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-300" />
            <span className="truncate">Meld Selected</span>
          </button>

          {/* Validation Preview Badge */}
          <div data-testid="meld-validation-badge" className="text-[11px] text-center min-h-[18px]">
            {isMeldPhase ? (
              meldValidation.valid ? (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-700/40 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  {`Valid ${meldValidation.type}`}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800/70 border border-slate-700/60 px-2 py-0.5 rounded">
                  <AlertCircle className="w-3 h-3 shrink-0 text-amber-400" />
                  {meldValidation.error}
                </span>
              )
            ) : (
              <span className="text-slate-500">Only in MELD phase</span>
            )}
          </div>
        </div>

        {/* ACTION 4: ADD TO SELECTED MELD */}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            data-testid="btn-add-meld"
            disabled={!canAddToMeld}
            onClick={handleAddToMeldClick}
            className={`w-full h-12 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
              canAddToMeld
                ? 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-700/30 ring-2 ring-teal-400/40 active:scale-95'
                : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
            }`}
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">Add to Meld</span>
          </button>

          {/* Add to Meld Preview Badge */}
          <div data-testid="add-meld-badge" className="text-[11px] text-center min-h-[18px]">
            {isMeldPhase ? (
              addToMeldValidation.valid ? (
                <span className="inline-flex items-center gap-1 text-teal-400 font-semibold bg-teal-950/60 border border-teal-700/40 px-2 py-0.5 rounded truncate max-w-full">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  {`Add to ${selectedMeld?.type}`}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800/70 border border-slate-700/60 px-2 py-0.5 rounded truncate max-w-full">
                  <AlertCircle className="w-3 h-3 shrink-0 text-amber-400" />
                  {addToMeldValidation.error}
                </span>
              )
            ) : (
              <span className="text-slate-500">Only in MELD phase</span>
            )}
          </div>
        </div>
      </div>

      {/* DISCARD ACTION FOOTER ROW */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>Discarding finishes your turn and passes play to the next team member.</span>
        </div>

        <button
          type="button"
          data-testid="btn-discard"
          disabled={!canDiscard}
          onClick={handleDiscardClick}
          className={`w-full sm:w-auto min-w-[200px] h-11 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
            canDiscard
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-700/30 active:scale-95'
              : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
          }`}
        >
          <Trash2 className="w-4 h-4 shrink-0" />
          <span>
            {selectedCardCount === 1
              ? `Discard ${getRankLabel(selectedCards[0].rank, selectedCards[0].isNaturalJoker || selectedCards[0].rank === 0)}${getSuitSymbol(
                  selectedCards[0].suit
                )}`
              : 'Discard Selected Card'}
          </span>
        </button>
      </div>
    </div>
  );
};
