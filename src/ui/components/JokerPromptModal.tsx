import React from 'react';
import { JokerOption, getRankDisplayName } from '../../engine/meld-validator';
import { Sparkles, HelpCircle, X } from 'lucide-react';
import { getSuitSymbol } from './PlayingCard';

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
  if (!isOpen || !options || options.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="joker-prompt-title"
      data-testid="joker-prompt-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className={`relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl p-6 shadow-2xl shadow-amber-950/40 flex flex-col gap-5 ${className}`}
      >
        {/* Close / Cancel Button */}
        <button
          onClick={onCancel}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-inner">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2
              id="joker-prompt-title"
              className="text-xl font-bold text-white tracking-wide flex items-center gap-2"
            >
              Designate Joker Position
            </h2>
            <p className="text-xs text-amber-300/80 font-medium">
              Choose whether you want this Joker to be the highest card or the lowest card in the sequence
            </p>
          </div>
        </div>

        {/* Informative Note */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-slate-300">
          <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            The Normal Joker will remain fixed at this chosen rank on the table. It cannot shift up
            or down unless a player contributes its natural card to auto-pickup the Joker into their
            hand.
          </p>
        </div>

        {/* Options List */}
        <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto pr-1">
          {options.map((option) => {
            const isRed = option.suit === 'HEARTS' || option.suit === 'DIAMONDS';
            const symbol = getSuitSymbol(option.suit);
            const rankLabel = getRankDisplayName(option.rank);

            return (
              <button
                key={`${option.suit}-${option.rank}`}
                type="button"
                data-testid={`joker-option-${option.rank}`}
                onClick={() => onSelect(option.rank)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/60 transition-all duration-150 group cursor-pointer text-left shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-12 rounded-lg bg-white shadow flex flex-col items-center justify-center font-bold text-sm leading-tight border ${
                      isRed ? 'text-red-600 border-red-200' : 'text-slate-950 border-slate-300'
                    }`}
                  >
                    <span>{rankLabel === 'Ace' ? 'A' : rankLabel === 'King' ? 'K' : rankLabel === 'Queen' ? 'Q' : rankLabel === 'Jack' ? 'J' : option.rank}</span>
                    <span className="text-xs">{symbol}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white group-hover:text-amber-300 transition">
                        {option.label}
                      </span>
                      {option.positionLabel && (
                        <span
                          data-testid={option.positionLabel.includes('Highest') ? 'badge-highest-card' : 'badge-lowest-card'}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            option.positionLabel.includes('Highest')
                              ? 'bg-amber-400 text-slate-950 font-extrabold'
                              : 'bg-emerald-400 text-slate-950 font-extrabold'
                          }`}
                        >
                          {option.positionLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      {`Plays as ${rankLabel} of ${option.suit.toLowerCase()}`}
                    </div>
                  </div>
                </div>

                <div className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold group-hover:bg-amber-500 group-hover:text-slate-950 transition">
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
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
