import React, { useEffect, useState } from 'react';
import { Sparkles, Trophy, X } from 'lucide-react';

export interface PukarSlamOverlayProps {
  team: 'A' | 'B';
  playerName: string;
  points?: number;
  onClose?: () => void;
  onImpact?: () => void;
  autoDismissMs?: number;
}

const CELEBRATION_SYMBOLS = ['♠', '♥', '♦', '♣', '★', '✨', '⚡', '👑'];

interface BurstParticle {
  id: number;
  symbol: string;
  tx: number;
  ty: number;
  color: string;
  size: number;
  delay: number;
}

function generateParticles(): BurstParticle[] {
  const count = 36;
  const newParticles: BurstParticle[] = [];
  const colors = [
    'text-yellow-400',
    'text-amber-300',
    'text-emerald-400',
    'text-red-400',
    'text-white',
  ];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI + (i % 2 === 0 ? 0.05 : -0.05);
    const distance = 220 + (i % 6) * 45;
    newParticles.push({
      id: i,
      symbol: CELEBRATION_SYMBOLS[i % CELEBRATION_SYMBOLS.length],
      tx: Math.round(Math.cos(angle) * distance),
      ty: Math.round(Math.sin(angle) * distance),
      color: colors[i % colors.length],
      size: 20 + (i % 4) * 6,
      delay: (i % 6) * 0.03,
    });
  }
  return newParticles;
}

export const PukarSlamOverlay: React.FC<PukarSlamOverlayProps> = ({
  team,
  playerName,
  points = 50,
  onClose,
  onImpact,
  autoDismissMs = 2600,
}) => {
  const [particles] = useState<BurstParticle[]>(() => generateParticles());

  useEffect(() => {
    // Trigger slam impact ripple after initial drop descent (~180ms)
    const impactTimer = setTimeout(() => {
      try {
        onImpact?.();
      } catch (err) {
        console.error('Error invoking onImpact callback:', err);
      }
    }, 180);

    // Auto-dismiss
    const dismissTimer = setTimeout(() => {
      try {
        onClose?.();
      } catch (err) {
        console.error('Error invoking onClose callback:', err);
      }
    }, autoDismissMs);

    return () => {
      clearTimeout(impactTimer);
      clearTimeout(dismissTimer);
    };
  }, [onImpact, onClose, autoDismissMs]);

  return (
    <div
      data-testid="pukar-slam-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Pukar Claim Slam Celebration"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer select-none"
      onClick={onClose}
    >
      {/* Container centered on impact point */}
      <div
        className="relative flex flex-col items-center justify-center p-4 max-w-2xl sm:max-w-3xl w-full pointer-events-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Shockwave Rings radiating outward */}
        <div
          aria-hidden="true"
          className="absolute w-[450px] h-[450px] sm:w-[650px] sm:h-[650px] md:w-[850px] md:h-[850px] rounded-full border-4 border-amber-400/90 animate-shockwave pointer-events-none"
          style={{ animationDelay: '0.12s' }}
        />
        <div
          aria-hidden="true"
          className="absolute w-[450px] h-[450px] sm:w-[650px] sm:h-[650px] md:w-[850px] md:h-[850px] rounded-full border-4 border-yellow-300/80 animate-shockwave pointer-events-none"
          style={{ animationDelay: '0.24s' }}
        />
        <div
          aria-hidden="true"
          className="absolute w-[450px] h-[450px] sm:w-[650px] sm:h-[650px] md:w-[850px] md:h-[850px] rounded-full border-2 border-amber-500/60 animate-shockwave pointer-events-none"
          style={{ animationDelay: '0.36s' }}
        />

        {/* Burst Particles */}
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {particles.map((p) => (
            <span
              key={p.id}
              className={`absolute font-black animate-particle-burst select-none ${p.color}`}
              style={
                {
                  '--tx': `${p.tx}px`,
                  '--ty': `${p.ty}px`,
                  fontSize: `${p.size}px`,
                  animationDelay: `${p.delay}s`,
                } as React.CSSProperties
              }
            >
              {p.symbol}
            </span>
          ))}
        </div>

        {/* The Heavy Slamming Royal Card / Deck */}
        <div className="relative animate-pukar-slam z-20 flex flex-col items-center pointer-events-auto">
          {/* Deck Shadow on impact */}
          <div className="absolute -bottom-8 w-4/5 h-10 bg-black/80 rounded-full blur-xl" />

          {/* Golden Royal Card Frame */}
          <div className="w-[92vw] max-w-[540px] sm:max-w-[620px] md:max-w-[680px] rounded-3xl bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 p-2 sm:p-2.5 shadow-[0_25px_60px_rgba(245,158,11,0.6)] border-2 border-yellow-100">
            <div className="w-full rounded-2xl bg-gradient-to-b from-stone-950 via-slate-900 to-amber-950 p-6 sm:p-9 flex flex-col items-center text-center relative overflow-hidden border border-amber-500/40">
              {/* Gold Ribbon / Texture Background */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(245,158,11,0.25)_0%,transparent_70%)] pointer-events-none"
              />

              {/* Close Button */}
              <button
                type="button"
                data-testid="btn-dismiss-slam-overlay"
                onClick={onClose}
                className="absolute top-3 right-3 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-amber-200 hover:text-white transition-colors cursor-pointer"
                aria-label="Close Slam Overlay"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Royal Icon Header */}
              <div className="relative mb-3 flex items-center justify-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/50 border-2 border-yellow-200">
                  <Trophy className="w-11 h-11 sm:w-14 sm:h-14" />
                </div>
                <Sparkles className="absolute -top-2 -right-2 w-7 h-7 sm:w-8 sm:h-8 text-yellow-300 animate-spin" />
              </div>

              {/* Slam Title */}
              <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 uppercase drop-shadow-md">
                💥 PUKAR SLAM!
              </div>

              {/* Points Badge */}
              <div className="mt-3 inline-flex items-center gap-2 px-6 sm:px-8 py-2 sm:py-2.5 rounded-full bg-amber-500 text-slate-950 font-black text-base sm:text-lg tracking-wide shadow-lg">
                <Sparkles className="w-5 h-5" />
                <span>{`+${points} BONUS POINTS`}</span>
              </div>

              {/* Player details */}
              <p className="mt-4 text-base sm:text-lg text-amber-100 font-bold">
                {playerName}
                <span className="ml-1.5 text-sm sm:text-base text-amber-300 font-semibold">
                  {`(Team ${team})`}
                </span>
              </p>

              <p className="mt-2 text-sm sm:text-base text-amber-200/90 leading-snug">
                Hand emptied! 13-card Pukar claimed!
                <br />
                <span className="text-xs sm:text-sm text-yellow-300/90 font-medium">
                  🌊 Ripple shockwave shaking all cards across the table!
                </span>
              </p>

              {/* Dismiss hint */}
              <button
                type="button"
                onClick={onClose}
                className="mt-6 px-8 sm:px-10 py-3 sm:py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm sm:text-base uppercase tracking-wider shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                Continue Playing
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
