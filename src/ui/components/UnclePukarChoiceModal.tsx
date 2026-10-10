import React, { useState, useEffect } from 'react';
import { Clock, Sparkles, Layers, CheckCircle2 } from 'lucide-react';

export interface UnclePukarChoiceModalProps {
  isOpen: boolean;
  availableDecksCount: number;
  onSelectDeck: (deckIndex: number) => void;
  onClose?: () => void;
  playerName?: string;
  team?: 'A' | 'B';
}

export const UnclePukarChoiceModal: React.FC<UnclePukarChoiceModalProps> = ({
  isOpen,
  availableDecksCount,
  onSelectDeck,
  onClose,
  playerName,
  team,
}) => {
  const [currentTime, setCurrentTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  });

  const [selectedDeckIndex, setSelectedDeckIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const count = Math.max(2, availableDecksCount || 2);
  const deckOptions = Array.from({ length: count }, (_, i) => i);

  const handleChoose = (idx: number) => {
    setSelectedDeckIndex(idx);
    setTimeout(() => {
      onSelectDeck(idx);
    }, 250);
  };

  return (
    <div
      data-testid="uncle-pukar-choice-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Sid's Auspicious Pukar Time Deck Selection"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto animate-fade-in"
      onClick={() => {
        // Fallback default on backdrop click
        if (onClose) onClose();
        else onSelectDeck(0);
      }}
    >
      <div
        className="relative w-full max-w-4xl bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border-2 border-amber-500/50 rounded-3xl shadow-2xl shadow-amber-500/20 overflow-hidden flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===================================================================
            TOP HEADER: LIVE TIME & JOKE REFERENCE
        ==================================================================== */}
        <div className="bg-slate-950/80 border-b border-amber-500/30 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 tracking-wide">
                Sid&apos;s Auspicious Pukar Time
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                {playerName ? `${playerName} (Team ${team ?? 'A'}) claimed a Pukar! ` : ''}
                Check the auspicious time before picking your deck 🙏
              </p>
            </div>
          </div>

          {/* Real-time Ticking Clock */}
          <div
            data-testid="uncle-live-clock"
            className="flex items-center gap-2.5 bg-slate-900/90 border border-amber-400/40 px-4 py-2 rounded-2xl shadow-inner shadow-amber-500/10"
          >
            <Clock className="w-5 h-5 text-amber-400 animate-spin-slow" />
            <span className="font-mono text-lg sm:text-2xl font-extrabold text-amber-300 tracking-wider">
              {currentTime}
            </span>
          </div>
        </div>

        {/* ===================================================================
            BODY: LEFT CARTOON + RIGHT DECK OPTIONS
        ==================================================================== */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left Side: Uncle Cartoon Illustration */}
          <div className="md:col-span-5 flex flex-col items-center justify-center bg-gradient-to-b from-amber-500/5 to-slate-950/40 p-4 rounded-2xl border border-amber-500/20">
            <div className="relative group max-w-[260px] sm:max-w-[290px] w-full flex justify-center">
              <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-transparent blur-xl rounded-full" />
              <img
                src="/uncle-pukar.png"
                alt="Sid meditating before Pukar claim"
                data-testid="uncle-cartoon-image"
                className="relative z-10 w-auto h-auto max-h-[300px] object-contain drop-shadow-[0_10px_20px_rgba(245,158,11,0.25)] transition-transform duration-300 hover:scale-105"
              />
            </div>
            <p className="mt-3 text-xs text-amber-300/90 font-medium italic text-center">
              &ldquo;Wait, let me see what time it is before taking the Pukar...&rdquo;
            </p>
          </div>

          {/* Right Side: Pukar Deck Choices */}
          <div className="md:col-span-7 flex flex-col gap-4">
            <div className="border-b border-slate-800 pb-2">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                Select Your Pukar Deck
              </h3>
              <p className="text-xs text-slate-400">
                Multiple Pukar decks are available on the table. Choose which 13-card deck you want to take into your hand:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {deckOptions.map((deckIdx) => {
                const isSelected = selectedDeckIndex === deckIdx;
                return (
                  <button
                    key={deckIdx}
                    type="button"
                    data-testid={`btn-select-pukar-deck-${deckIdx}`}
                    onClick={() => handleChoose(deckIdx)}
                    className={`relative p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center text-center group cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/30 scale-102 ring-2 ring-amber-400/50'
                        : 'bg-slate-800/60 hover:bg-slate-800/90 border-slate-700/80 hover:border-amber-400/60 shadow-md hover:scale-[1.02]'
                    }`}
                  >
                    {/* Visual Card Stack Graphic */}
                    <div className="w-16 h-22 mb-3 relative flex items-center justify-center">
                      <div className="absolute inset-0 bg-slate-950 border border-slate-700 rounded-lg shadow-sm -rotate-6 translate-x-1" />
                      <div className="absolute inset-0 bg-slate-900 border border-slate-600 rounded-lg shadow-md -rotate-3 translate-x-0.5" />
                      <div className="relative w-full h-full bg-gradient-to-br from-amber-600 to-amber-800 border-2 border-amber-300 rounded-lg shadow-xl flex flex-col items-center justify-center p-1">
                        <span className="text-xl">🂠</span>
                        <span className="text-[10px] font-bold text-amber-100">13 Cards</span>
                      </div>
                    </div>

                    <div className="font-extrabold text-base text-slate-100 group-hover:text-amber-300 transition-colors">
                      {`Pukar Deck #${deckIdx + 1}`}
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5">
                      {deckIdx === 0 ? 'Top Pukar Deck' : `Deck Option #${deckIdx + 1}`}
                    </span>

                    <div
                      className={`mt-3 w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-amber-500/20 text-amber-300 group-hover:bg-amber-400 group-hover:text-slate-950'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Selected!
                        </>
                      ) : (
                        `Claim Deck #${deckIdx + 1}`
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-start gap-2.5 mt-1">
              <span className="text-amber-400 text-sm">💡</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Whichever deck you pick will be placed into your hand to continue your turn, while the remaining deck stays on the table for future Pukar claims.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
