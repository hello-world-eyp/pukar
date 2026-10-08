import React, { useEffect, useState } from 'react';
import { Card } from '../../engine/types';
import { PlayingCard } from './PlayingCard';
import { X, Layers, ZoomIn } from 'lucide-react';

export interface DiscardPileModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards?: Card[];
  discardPile?: Card[];
  className?: string;
  defaultCardSize?: 'lg' | 'xl';
}

export const DiscardPileModal: React.FC<DiscardPileModalProps> = ({
  isOpen,
  onClose,
  cards,
  discardPile,
  className = '',
  defaultCardSize = 'lg',
}) => {
  const [cardScale, setCardScale] = useState<'lg' | 'xl'>(defaultCardSize);
  const pileCards = cards ?? discardPile ?? [];

  const handleSafeClose = () => {
    try {
      onClose();
    } catch (err) {
      console.error('Error closing DiscardPileModal:', err);
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

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-pile-modal-title"
      data-testid="discard-pile-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={handleSafeClose}
    >
      <div
        className={`relative w-full max-w-6xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="discard-pile-modal-title"
                className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2 flex-wrap"
              >
                <span>Discard Pile History &amp; Zoom (&ldquo;The Bottom&rdquo;)</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {`${pileCards.length} ${pileCards.length === 1 ? 'card' : 'cards'}`}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Chronological order from oldest buried card (#1) to current top face-up card (#{pileCards.length || 0})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Card Size Selector */}
            <div
              className="flex items-center rounded-xl bg-slate-800/80 p-0.5 border border-slate-700 text-xs"
              role="group"
              aria-label="Card Size Options"
            >
              <button
                type="button"
                onClick={() => setCardScale('lg')}
                data-testid="btn-card-size-lg"
                className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  cardScale === 'lg'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>Large</span>
              </button>
              <button
                type="button"
                onClick={() => setCardScale('xl')}
                data-testid="btn-card-size-xl"
                className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  cardScale === 'xl'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>Extra Large</span>
              </button>
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
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-950/70 min-h-[300px]">
          {pileCards.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-slate-500 text-sm">
              <Layers className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-semibold text-base text-slate-400">The discard pile is currently empty.</p>
              <p className="text-xs text-slate-600 mt-1">
                Cards discarded by players will accumulate here.
              </p>
            </div>
          ) : (
            <div
              className={`justify-items-center ${
                cardScale === 'xl'
                  ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'
                  : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5'
              }`}
            >
              {pileCards.map((card, index) => {
                const isBottom = index === 0;
                const isTop = index === pileCards.length - 1;

                return (
                  <div
                    key={`${card.id}-${index}`}
                    className={`flex flex-col items-center p-3 rounded-2xl transition-all shadow-md hover:scale-105 hover:shadow-xl ${
                      isTop
                        ? 'bg-amber-500/15 border-2 border-amber-400 shadow-amber-500/20'
                        : isBottom
                        ? 'bg-slate-800/80 border border-slate-600'
                        : 'bg-slate-900/60 border border-slate-800/80 hover:border-slate-600'
                    }`}
                  >
                    <span
                      className={`text-xs font-black mb-2 px-3 py-0.5 rounded-full shadow-sm ${
                        isTop
                          ? 'bg-amber-400 text-slate-950'
                          : isBottom
                          ? 'bg-slate-700 text-slate-200'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isTop
                        ? `#${index + 1} (Top)`
                        : isBottom
                        ? `#${index + 1} (Bottom)`
                        : `#${index + 1}`}
                    </span>
                    <PlayingCard card={card} size={cardScale} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-900/95 text-xs text-slate-400 flex-wrap gap-2">
          <span>
            Drawing the bottom pile takes <strong>{`all ${pileCards.length} cards`}</strong> directly into the player&apos;s hand.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

