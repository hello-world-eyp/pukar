import React, { useMemo } from 'react';
import { Card, Meld, TurnPhase } from '../../engine/types';
import { validateNewMeld } from '../../engine/meld-validator';
import { PlayingCard, getRankLabel, getSuitSymbol } from './PlayingCard';
import {
  Trash2,
  ArrowDownCircle,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Inbox,
  MousePointerClick,
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
  onPlayMeld?: (cardIds: string[], jokerRepresentedRank?: number) => void;
  onAddToMeld?: (meldId: string, cardIds: string[]) => void;
  onDiscard?: (cardId: string) => void;
  disabled?: boolean;
  className?: string;
  showDrawButtons?: boolean;
  unifiedMode?: boolean;
  requiresPureSequence?: boolean;
  cardsPickedUpThisTurn?: string[];
  initialHandSizeThisTurn?: number;
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
  onDiscard,
  disabled = false,
  className = '',
  showDrawButtons,
  unifiedMode = false,
  requiresPureSequence = false,
  cardsPickedUpThisTurn,
  initialHandSizeThisTurn,
}) => {
  // Resolve effective selected cards
  const selectedCards: Card[] = useMemo(() => {
    try {
      if (explicitSelectedCards) return explicitSelectedCards;
      if (selectedCardIds && allHandCards) {
        const idSet = new Set(selectedCardIds);
        return allHandCards.filter((c) => idSet.has(c.id));
      }
      return [];
    } catch (err) {
      console.error('Error resolving selected cards:', err);
      return [];
    }
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

  // Determine whether to display the legacy draw buttons
  const shouldRenderDrawButtons =
    showDrawButtons !== undefined ? showDrawButtons : !unifiedMode;

  // 2. Play New Meld Validation Preview
  const meldValidation = useMemo(() => {
    try {
      if (selectedCardCount < 3) {
        return {
          valid: false,
          error: selectedCardCount === 0 ? 'Select cards to form sequence' : `Need at least 3 cards (${selectedCardCount}/3)`,
        };
      }
      if (allHandCards && allHandCards.length > 0 && selectedCardCount >= allHandCards.length) {
        return {
          valid: false,
          error: 'Must keep at least 1 card in hand to discard',
        };
      }
      return validateNewMeld(selectedCards, undefined, { requirePure: requiresPureSequence });
    } catch (err) {
      console.error('Error during meld validation preview:', err);
      return { valid: false, error: 'Validation preview error' };
    }
  }, [selectedCards, selectedCardCount, allHandCards, requiresPureSequence]);

  const canPlayNewMeld = !disabled && isMeldPhase && meldValidation.valid;

  // Single picked up card discard restriction
  const isSelectedCardDisallowedFromDiscard = useMemo(() => {
    if (selectedCardCount !== 1) return false;
    const selectedCardId = selectedCards[0]?.id;
    if (!selectedCardId) return false;
    if (!cardsPickedUpThisTurn || cardsPickedUpThisTurn.length !== 1) return false;
    if (cardsPickedUpThisTurn[0] !== selectedCardId) return false;
    // Exception: player started turn with only 1 card in hand
    if (initialHandSizeThisTurn === 1) return false;
    return true;
  }, [selectedCardCount, selectedCards, cardsPickedUpThisTurn, initialHandSizeThisTurn]);

  // Discard Card Eligibility
  const canDiscard =
    !disabled &&
    isDiscardAllowed &&
    selectedCardCount === 1 &&
    !isSelectedCardDisallowedFromDiscard;

  // Action handlers
  const handlePlayMeldClick = () => {
    if (!canPlayNewMeld) return;
    try {
      onPlayMeld?.(selectedCards.map((c) => c.id));
    } catch (err) {
      console.error('Error in handlePlayMeldClick:', err);
    }
  };

  const handleDiscardClick = () => {
    if (!canDiscard || selectedCards.length !== 1) return;
    try {
      onDiscard?.(selectedCards[0].id);
    } catch (err) {
      console.error('Error in handleDiscardClick:', err);
    }
  };

  const discardButtonLabel = useMemo(() => {
    if (selectedCardCount === 1) {
      if (isSelectedCardDisallowedFromDiscard) {
        return "Can't discard picked up card";
      }
      const card = selectedCards[0];
      return `Discard ${getRankLabel(card.rank, card.isNaturalJoker || card.rank === 0)}${getSuitSymbol(card.suit)}`;
    }
    return 'Discard Selected Card';
  }, [selectedCardCount, selectedCards, isSelectedCardDisallowedFromDiscard]);

  const discardTooltip = isSelectedCardDisallowedFromDiscard
    ? 'Cannot discard the single card picked up from the discard pile this turn unless you started with only 1 card in hand'
    : undefined;

  // =========================================================================
  // UNIFIED INLINE MODE (Rendered cleanly within the player dock)
  // =========================================================================
  if (unifiedMode) {
    return (
      <div
        data-testid="action-controls"
        className={`min-h-9 sm:min-h-10 flex items-center justify-center gap-1 sm:gap-2 flex-wrap sm:flex-nowrap min-w-0 ${className}`}
      >
        {/* DRAW PHASE INLINE GUIDANCE */}
        {!disabled && isDrawPhase && (
          <div className="h-8 sm:h-10 flex items-center gap-1 sm:gap-2 px-2 sm:px-3 rounded-xl bg-amber-100 border-2 border-amber-400 text-amber-950 text-xs sm:text-sm font-black shadow-md animate-pulse shrink-0">
            <MousePointerClick className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-700 shrink-0" />
            <span className="truncate">YOUR TURN: DRAW • Click Deck or Pile</span>
          </div>
        )}

        {disabled && (
          <div
            data-testid="waiting-turn-indicator"
            className="h-8 sm:h-10 flex items-center gap-1 sm:gap-2 px-2 sm:px-3 rounded-xl bg-stone-200/80 border border-stone-300 text-stone-600 text-xs font-bold shrink-0"
          >
            <span className="w-2 h-2 rounded-full bg-stone-400 animate-pulse shrink-0" />
            <span>Waiting for turn...</span>
          </div>
        )}

        {/* MELD / DISCARD PHASE ACTIONS */}
        {!isDrawPhase && (
          <div className="min-h-8 sm:min-h-10 flex items-center justify-center gap-1 sm:gap-2 flex-wrap sm:flex-nowrap shrink-0 max-w-full">
            {/* Play New Sequence Button (enabled when valid sequence selected) */}
            <button
              type="button"
              data-testid="btn-play-meld"
              disabled={!canPlayNewMeld}
              onClick={handlePlayMeldClick}
              className={`h-8 sm:h-10 px-2 sm:px-3.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 transition-all shadow-md shrink-0 cursor-pointer ${
                canPlayNewMeld
                  ? 'btn-game-primary'
                  : 'bg-stone-200 text-stone-500 border border-stone-300 cursor-not-allowed opacity-60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-200 shrink-0" />
              <span className="truncate">
                {canPlayNewMeld
                  ? `Play ${meldValidation.type || ''} Sequence`
                  : 'Play Sequence'}
              </span>
            </button>

            {/* Validation Preview / Tip Badge */}
            <div data-testid="meld-validation-badge" className="h-8 sm:h-10 flex items-center text-xs sm:text-sm shrink-0">
              {isMeldPhase && (
                canPlayNewMeld ? (
                  <span className="inline-flex items-center gap-1 text-emerald-950 font-bold bg-emerald-100 border border-emerald-400 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-lg shadow-sm text-[11px] sm:text-xs">
                    <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-700 shrink-0" />
                    <span>{`Valid ${meldValidation.type} (+pts)`}</span>
                  </span>
                ) : selectedCardCount >= 3 ? (
                  <span className="inline-flex items-center gap-1 text-amber-950 font-bold bg-amber-100 border border-amber-400 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-lg shadow-sm text-[11px] sm:text-xs">
                    <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-amber-700 shrink-0" />
                    <span className="truncate max-w-[100px] sm:max-w-none">{meldValidation.error}</span>
                  </span>
                ) : null
              )}
            </div>

            {/* Add to Sequence Tip / Merge Guidance */}
            {selectedCardCount > 0 && isMeldPhase && !canPlayNewMeld && (
              <div
                data-testid="add-to-sequence-tip"
                className="hidden 2xl:flex items-center h-8 sm:h-10 gap-1.5 px-2.5 rounded-lg bg-yellow-100 border border-yellow-400 text-yellow-950 text-xs font-bold shadow-sm shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                <span>Click sequence on table to add</span>
              </div>
            )}

            {/* Discard Action Button */}
            <button
              type="button"
              data-testid="btn-discard"
              disabled={!canDiscard}
              onClick={handleDiscardClick}
              title={discardTooltip}
              className={`h-8 sm:h-10 px-2 sm:px-3.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 transition-all shadow-md shrink-0 cursor-pointer min-w-fit ${
                canDiscard
                  ? 'btn-game-danger'
                  : 'bg-stone-200 text-stone-500 border border-stone-300 cursor-not-allowed opacity-60'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate sm:hidden">{selectedCardCount === 1 ? discardButtonLabel : 'Discard'}</span>
              <span className="truncate hidden sm:inline">{discardButtonLabel}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // STANDARD / STANDALONE CARD MODE (Used for standalone test suites & pages)
  // =========================================================================
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
              disabled
                ? 'bg-slate-700 text-slate-300'
                : isDrawPhase
                ? 'bg-amber-500 text-slate-950'
                : isMeldPhase
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-red-500 text-white'
            }`}
          >
            {disabled ? 'WAITING' : phase}
          </span>
        </div>

        {/* Real-time selection summary */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedCardCount === 0 ? (
            <span className="text-xs text-slate-400">No cards selected</span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 font-semibold">
                Selected ({selectedCardCount}):
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                {selectedCards.map((c) => (
                  <div key={`selected-preview-${c.id}`} className="shrink-0 shadow-md rounded-md hover:scale-105 transition-transform">
                    <PlayingCard card={c} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedCardCount > 0 && isMeldPhase && (
            <div
              data-testid="add-to-sequence-tip"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-950/60 border border-yellow-500/40 text-yellow-300 text-xs font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              <span>Click any yellow-highlighted sequence on the table to add cards</span>
            </div>
          )}
          {selectedMeld && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-950/60 border border-teal-600/40 text-teal-300 text-xs font-semibold">
              <span className="text-slate-400 font-normal">Target:</span>
              <span>{`Team ${selectedMeld.team} ${selectedMeld.type} Sequence (${selectedMeld.cards.length} cards)`}</span>
            </div>
          )}
        </div>
      </div>

      {/* ACTION BUTTONS GRID */}
      <div className={`grid grid-cols-1 ${shouldRenderDrawButtons ? 'sm:grid-cols-3' : 'sm:grid-cols-1'} gap-3`}>
        {/* ACTION 1: DRAW FROM STOCK (Rendered in standard mode) */}
        {shouldRenderDrawButtons && (
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
        )}

        {/* ACTION 2: TAKE BOTTOM / DISCARD (Rendered in standard mode) */}
        {shouldRenderDrawButtons && (
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
        )}

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
            <span className="truncate">Play Sequence</span>
          </button>

          {/* Validation Preview Badge */}
          <div data-testid="meld-validation-badge" className="text-[11px] text-center min-h-[18px]">
            {isMeldPhase ? (
              meldValidation.valid ? (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-700/40 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  {`Valid ${meldValidation.type} Sequence`}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800/70 border border-slate-700/60 px-2 py-0.5 rounded">
                  <AlertCircle className="w-3 h-3 shrink-0 text-amber-400" />
                  {meldValidation.error}
                </span>
              )
            ) : (
              <span className="text-slate-500">Only in SEQUENCE phase</span>
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
          title={discardTooltip}
          className={`w-full sm:w-auto min-w-[200px] h-11 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
            canDiscard
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-700/30 active:scale-95'
              : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
          }`}
        >
          <Trash2 className="w-4 h-4 shrink-0" />
          <span>{discardButtonLabel}</span>
        </button>
      </div>
    </div>
  );
};
