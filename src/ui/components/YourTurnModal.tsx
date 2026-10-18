import React, { useEffect } from 'react';
import { Bell, Sparkles, X, ArrowRight } from 'lucide-react';

export interface YourTurnModalProps {
  isOpen: boolean;
  playerName: string;
  team: 'A' | 'B';
  onDismiss: () => void;
  autoDismissMs?: number;
}

export const YourTurnModal: React.FC<YourTurnModalProps> = ({
  isOpen,
  playerName,
  team,
  onDismiss,
  autoDismissMs = 3000,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onDismiss]);

  if (!isOpen) return null;

  const isTeamA = team === 'A';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your Turn Notification"
      data-testid="your-turn-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150 cursor-pointer"
      onClick={onDismiss}
    >
      <div
        data-testid="your-turn-banner"
        role="status"
        aria-live="polite"
        className="relative w-full max-w-sm sm:max-w-md rounded-3xl p-6 sm:p-8 text-center shadow-2xl bg-gradient-to-b from-emerald-950/95 via-slate-900/95 to-slate-950 border-2 border-amber-400 text-amber-100 flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200 cursor-default overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dismiss Button */}
        <button
          type="button"
          data-testid="btn-dismiss-your-turn"
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-amber-900/50 text-amber-300 hover:text-white transition-colors cursor-pointer"
          aria-label="Dismiss Your Turn Notification"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Animated Bell Icon Badge */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-amber-400 blur-lg opacity-40 animate-pulse" />
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30 animate-bounce">
            <Bell className="w-8 h-8 sm:w-10 sm:h-10 text-slate-950 fill-slate-950" />
          </div>
        </div>

        {/* Turn Title & Badges */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-black tracking-wide text-amber-300 font-serif drop-shadow-md">
              Your Turn!
            </h2>
            <span className="text-[10px] sm:text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-sm">
              Action Required
            </span>
          </div>

          {/* Player name & team badge */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs sm:text-sm font-bold text-slate-300">
              {playerName}
            </span>
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                isTeamA
                  ? 'bg-sky-950/80 text-sky-300 border-sky-400/50'
                  : 'bg-amber-950/80 text-amber-300 border-amber-400/50'
              }`}
            >
              {`Team ${team}`}
            </span>
          </div>

          <p className="text-xs sm:text-sm font-semibold text-amber-100/90 max-w-xs mt-1.5 leading-relaxed">
            It&apos;s your turn — draw from the Stock Deck or Discard Pile to begin.
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onDismiss}
          className="w-full mt-1 py-3 px-6 rounded-2xl font-black text-sm sm:text-base bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-slate-950" />
          <span>Draw Card / Start Turn</span>
          <ArrowRight className="w-4 h-4 text-slate-950" />
        </button>

        {/* 3-Second Countdown Progress Bar */}
        <div className="w-full flex flex-col items-center gap-1 mt-1">
          <div className="w-full bg-slate-800/80 rounded-full h-1 overflow-hidden">
            <div
              className="bg-amber-400 h-full animate-turn-timer rounded-full"
              style={{ animationDuration: `${autoDismissMs}ms` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            Auto-closing in 3s (or click anywhere)
          </span>
        </div>
      </div>
    </div>
  );
};
