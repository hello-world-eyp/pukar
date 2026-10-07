import React, { useEffect } from 'react';
import { Card } from '../../engine/types';
import { PlayingCard } from './PlayingCard';
import { X, Layers } from 'lucide-react';

export interface DiscardPileModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards?: Card[];
  discardPile?: Card[];
}

export const DiscardPileModal: React.FC<DiscardPileModalProps> = ({
  isOpen,
  onClose,
  cards,
  discardPile,
}) => {
  const pileCards = cards ?? discardPile ?? [];

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-pile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[85vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="discard-pile-modal-title"
                className="text-lg font-bold tracking-tight text-white flex items-center gap-2"
              >
                Discard Pile History (&ldquo;The Bottom&rdquo;)
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {`${pileCards.length} ${pileCards.length === 1 ? 'card' : 'cards'}`}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Chronological order from oldest buried card (#1) to current top face-up card (#{pileCards.length || 0})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-950/60 min-h-[220px]">
          {pileCards.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-sm">
              <Layers className="w-10 h-10 mb-2 opacity-40" />
              <p className="font-medium">The discard pile is currently empty.</p>
              <p className="text-xs text-slate-600 mt-1">
                Cards discarded by players will accumulate here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3 justify-items-center">
              {pileCards.map((card, index) => {
                const isBottom = index === 0;
                const isTop = index === pileCards.length - 1;

                return (
                  <div
                    key={`${card.id}-${index}`}
                    className={`flex flex-col items-center p-2 rounded-xl transition-all ${
                      isTop
                        ? 'bg-amber-500/10 border border-amber-500/40 shadow-sm'
                        : isBottom
                        ? 'bg-slate-800/60 border border-slate-700/60'
                        : 'bg-slate-900/40 border border-slate-800/40'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold mb-1.5 px-1.5 py-0.5 rounded ${
                        isTop
                          ? 'bg-amber-400 text-slate-950'
                          : isBottom
                          ? 'bg-slate-700 text-slate-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isTop
                        ? `#${index + 1} (Top)`
                        : isBottom
                        ? `#${index + 1} (Bottom)`
                        : `#${index + 1}`}
                    </span>
                    <PlayingCard card={card} size="sm" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900/90 text-xs text-slate-400">
          <span>
            Drawing the bottom pile takes <strong>{`all ${pileCards.length} cards`}</strong> directly into the player&apos;s hand.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
