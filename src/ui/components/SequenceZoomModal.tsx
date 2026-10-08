import React, { useEffect, useMemo } from 'react';
import { Meld } from '../../engine/types';
import { evaluateMeldScore } from '../../engine/meld-validator';
import { PlayingCard, getRankLabel, getSuitSymbol } from './PlayingCard';
import { X, ZoomIn, Info } from 'lucide-react';

export interface SequenceZoomModalProps {
  isOpen: boolean;
  meld: Meld | null;
  onClose: () => void;
  className?: string;
}

export const SequenceZoomModal: React.FC<SequenceZoomModalProps> = ({
  isOpen,
  meld,
  onClose,
  className = '',
}) => {
  const handleSafeClose = () => {
    try {
      onClose();
    } catch (err) {
      console.error('Error closing SequenceZoomModal:', err);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSafeClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const evaluation = useMemo(() => {
    if (!meld) return null;
    try {
      return evaluateMeldScore(meld);
    } catch (err) {
      console.error('Error evaluating meld score in zoom modal:', err);
      return { points: 0, description: 'Evaluation error', isComplete7: false, isPure13: false };
    }
  }, [meld]);

  if (!isOpen || !meld || !evaluation) return null;

  const isTeamA = meld.team === 'A';
  const { isComplete7, isPure13, points, description } = evaluation;

  // Sorted slots high-to-low for inspection
  const slotsToDisplay = meld.slots && meld.slots.length > 0
    ? [...meld.slots].sort((a, b) => b.representedRank - a.representedRank)
    : (meld.cards || []).map((c) => ({
        card: c,
        representedRank: c.rank,
        representedSuit: c.suit,
        isWildcard: c.isNaturalJoker || c.rank === 0 || c.rank === 2,
      }));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sequence-zoom-title"
      data-testid="sequence-zoom-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={handleSafeClose}
    >
      <div
        className={`relative w-full max-w-6xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border flex items-center justify-center font-bold ${
                isTeamA
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                  : 'bg-amber-600/20 text-amber-400 border-amber-500/30'
              }`}
            >
              <ZoomIn className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="sequence-zoom-title"
                  className="text-lg font-bold tracking-tight text-white"
                >
                  Sequence Zoom Inspection
                </h2>
                <span
                  className={`text-xs font-extrabold px-2 py-0.5 rounded uppercase ${
                    isTeamA ? 'bg-blue-600 text-white' : 'bg-amber-500 text-slate-950'
                  }`}
                >
                  {`Team ${meld.team}`}
                </span>
                {meld.suit && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                    {meld.suit}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>{`${meld.cards.length} cards total`}</span>
                <span>•</span>
                <span className="text-amber-400 font-bold">{description}</span>
                <span>•</span>
                <span className="text-emerald-400 font-mono font-bold">{`${points} pts`}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSafeClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Large Visual Cards Display */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-950/70 flex flex-col gap-6">
          <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap py-4">
            {slotsToDisplay.map((slot, index) => {
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
                  key={`zoom-slot-${card.id}-${slot.representedRank}-${index}`}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-lg hover:border-slate-600 transition-all hover:scale-105"
                >
                  <span className="text-[10px] font-bold text-slate-400">
                    {`#${index + 1}`}
                  </span>
                  <PlayingCard
                    card={card}
                    size="lg"
                    isWild={isSlotWild}
                    representedRank={slot.representedRank}
                    representedSuit={slot.representedSuit ?? undefined}
                    wildcardLabel={wildLabel}
                  />
                  {isSlotWild && (
                    <span className="text-[10px] font-extrabold text-amber-300 px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-600/40">
                      Substituting
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sequence Explanatory Details */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex items-start gap-3 text-xs text-slate-300">
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-bold text-slate-200">Rules & Point Value:</span>
              <span>
                {isPure13
                  ? 'Pure 13-Card Sequence (2 through Ace natural, 0 wildcards) scores 500 bonus points.'
                  : isComplete7
                  ? points === 200
                    ? 'Clean Sequence (7+ consecutive cards without wildcards or twos) scores 200 bonus points.'
                    : 'Dirty Sequence (7+ cards utilizing a 2 or Joker wildcard) scores 100 bonus points.'
                  : 'Incomplete sequence (fewer than 7 cards). Once completed to 7 cards, it awards full clean or dirty sequence points.'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900/95 text-xs text-slate-400">
          <span>Click close or press Escape to return to the table.</span>
          <button
            type="button"
            onClick={handleSafeClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
