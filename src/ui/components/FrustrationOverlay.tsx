import React, { useEffect } from 'react';

export interface FrustrationOverlayProps {
  playerName?: string;
  onComplete?: () => void;
}

/**
 * FrustrationOverlay
 * Displays a 10-second pop-out & disappear animation in the center of the screen:
 * "Aap Nahi Samjhoge Meri Duvidha"
 * Non-blocking (`pointer-events-none`) so ongoing gameplay remains interactive.
 */
export const FrustrationOverlay: React.FC<FrustrationOverlayProps> = ({
  playerName,
  onComplete,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, 10000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      data-testid="frustration-overlay"
      className="fixed inset-0 z-50 pointer-events-none overflow-hidden flex items-center justify-center select-none"
      aria-live="polite"
    >
      <div className="animate-frustration-pop flex flex-col items-center justify-center drop-shadow-[0_20px_35px_rgba(0,0,0,0.7)]">
        <div className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-white font-black text-2xl sm:text-4xl md:text-5xl px-8 sm:px-12 py-4 sm:py-5 rounded-3xl shadow-2xl border-4 border-yellow-300 tracking-wider whitespace-nowrap flex items-center gap-3 sm:gap-4 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]">
          <span className="text-3xl sm:text-5xl animate-bounce" role="img" aria-label="fire">🔥</span>
          <span>Aap Nahi Samjhoge Meri Duvidha</span>
          <span className="text-3xl sm:text-5xl animate-bounce" role="img" aria-label="fire">🔥</span>
        </div>
        {playerName && (
          <div className="mt-3 text-stone-100 text-sm sm:text-lg font-black bg-stone-950/85 px-5 py-1.5 rounded-full border-2 border-orange-400 shadow-xl backdrop-blur-sm">
            — {playerName}
          </div>
        )}
      </div>
    </div>
  );
};
