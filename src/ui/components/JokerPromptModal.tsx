import React from 'react';
import { JokerOption, getRankDisplayName } from '../../engine/meld-validator';
import { Card, Rank } from '../../engine/types';
import { Sparkles, HelpCircle, X } from 'lucide-react';
import { PlayingCard } from './PlayingCard';

export interface JokerPromptModalProps {
  isOpen: boolean;
  options: JokerOption[];
  onSelect: (rank: number) => void;
  onCancel: () => void;
  className?: string;
}

export const JokerPromptModal: React.FC<JokerPromptModalProps> = ({
  isOpen,
  options,
  onSelect,
  onCancel,
  className = '',
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen || !options || options.length === 0) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="joker-prompt-title"
      data-testid="joker-prompt-modal"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className={`relative w-full max-w-xl sm:max-w-2xl lg:max-w-3xl game-modal-frame rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 flex flex-col gap-5 sm:gap-6 ${className}`}
      >
        {/* Close / Cancel Button */}
        <button
          onClick={onCancel}
          aria-label="Close"
          className="absolute top-4 sm:top-5 right-4 sm:right-5 p-2 sm:p-2.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 sm:gap-4 pr-10">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
            <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 animate-pulse text-amber-400" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h2
              id="joker-prompt-title"
              className="text-xl sm:text-2xl font-black text-white tracking-wide flex items-center gap-2"
            >
              Designate Joker Position
            </h2>
            <p className="text-xs text-amber-300 font-medium">
              Choose whether you want this Joker to be the highest card or the lowest card in the sequence
            </p>
          </div>
        </div>

        {/* Informative Note */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3 text-xs text-slate-200 leading-relaxed shadow-sm">
          <HelpCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p>
            The Normal Joker will remain fixed at this chosen rank on the table. It cannot shift up
            or down unless a player contributes its natural card to auto-pickup the Joker into their
            hand.
          </p>
        </div>

        {/* Options List */}
        <div className="flex flex-col gap-3 sm:gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {options.map((option) => {
            const rankLabel = getRankDisplayName(option.rank);
            const targetCard: Card = {
              id: `joker-preview-${option.suit}-${option.rank}`,
              suit: option.suit,
              rank: (option.rank === 1 ? 14 : option.rank) as Rank,
              isNaturalJoker: false,
              isJoker: false,
            };

            return (
              <button
                key={`${option.suit}-${option.rank}`}
                type="button"
                data-testid={`joker-option-${option.rank}`}
                onClick={() => onSelect(option.rank)}
                className="w-full flex items-center justify-between p-3.5 sm:p-4.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border-2 border-slate-700/80 hover:border-amber-400/80 transition-all duration-150 group cursor-pointer text-left shadow-lg hover:shadow-amber-500/10"
              >
                <div className="flex items-center gap-3.5 sm:gap-5 min-w-0 flex-1">
                  {/* Full Authentic Playing Card */}
                  <div className="shrink-0 transition-transform duration-150 group-hover:scale-105 group-hover:-translate-y-0.5">
                    <PlayingCard card={targetCard} size="md" />
                  </div>

                  {/* Option Description & Badges */}
                  <div className="flex flex-col gap-1 sm:gap-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                      <span className="text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition">
                        {option.label}
                      </span>
                      {option.positionLabel && (
                        <span
                          data-testid={
                            option.positionLabel.includes('Highest')
                              ? 'badge-highest-card'
                              : 'badge-lowest-card'
                          }
                          className={`text-xs sm:text-sm font-black px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full uppercase tracking-wider shadow-sm ${
                            option.positionLabel.includes('Highest')
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-emerald-400 text-slate-950'
                          }`}
                        >
                          {option.positionLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-300 font-medium">
                      {`Plays as ${rankLabel} of ${option.suit.toLowerCase()}`}
                    </div>
                  </div>
                </div>

                {/* Action CTA Button */}
                <div className="ml-3 sm:ml-4 shrink-0 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-amber-500/20 border-2 border-amber-500/50 text-amber-300 text-xs font-black group-hover:bg-amber-400 group-hover:text-slate-950 transition-all shadow-md group-hover:scale-105">
                  Select
                </div>
              </button>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80 transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
