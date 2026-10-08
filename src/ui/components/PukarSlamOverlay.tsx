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
  const count = 24;
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
    const distance = 150 + (i % 5) * 35;
    newParticles.push({
      id: i,
      symbol: CELEBRATION_SYMBOLS[i % CELEBRATION_SYMBOLS.length],
      tx: Math.round(Math.cos(angle) * distance),
      ty: Math.round(Math.sin(angle) * distance),
      color: colors[i % colors.length],
      size: 18 + (i % 4) * 4,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm cursor-pointer select-none"
      onClick={onClose}
    >
      {/* Container centered on impact point */}
      <div
        className="relative flex flex-col items-center justify-center p-4 max-w-lg w-full pointer-events-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Shockwave Rings radiating outward */}
        <div
          aria-hidden="true"
          className="absolute w-64 h-64 rounded-full border-4 border-amber-400/90 animate-shockwave pointer-events-none"
          style={{ animationDelay: '0.12s' }}
        />
        <div
          aria-hidden="true"
          className="absolute w-64 h-64 rounded-full border-4 border-yellow-300/80 animate-shockwave pointer-events-none"
          style={{ animationDelay: '0.24s' }}
        />
        <div
          aria-hidden="true"
          className="absolute w-64 h-64 rounded-full border-2 border-amber-500/60 animate-shockwave pointer-events-none"
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
          <div className="absolute -bottom-6 w-56 h-8 bg-black/70 rounded-full blur-md" />

          {/* Golden Royal Card Frame */}
          <div className="w-72 sm:w-80 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 p-1.5 shadow-[0_20px_50px_rgba(245,158,11,0.5)] border-2 border-yellow-100">
            <div className="w-full rounded-xl bg-gradient-to-b from-stone-950 via-slate-900 to-amber-950 p-6 flex flex-col items-center text-center relative overflow-hidden border border-amber-500/40">
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
                className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-amber-200 hover:text-white transition-colors cursor-pointer"
                aria-label="Close Slam Overlay"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Royal Icon Header */}
              <div className="relative mb-3 flex items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/40 border border-yellow-200">
                  <Trophy className="w-9 h-9" />
                </div>
                <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-300 animate-spin" />
              </div>

              {/* Slam Title */}
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 uppercase drop-shadow-sm">
                💥 PUKAR SLAM!
              </div>

              {/* Points Badge */}
              <div className="mt-2 inline-flex items-center gap-1 px-4 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-sm tracking-wide shadow-md">
                <Sparkles className="w-4 h-4" />
                <span>{`+${points} BONUS POINTS`}</span>
              </div>

              {/* Player details */}
              <p className="mt-3 text-sm text-amber-100 font-bold">
                {playerName}
                <span className="ml-1 text-xs text-amber-300 font-semibold">
                  {`(Team ${team})`}
                </span>
              </p>

              <p className="mt-1 text-xs text-amber-200/80 leading-snug">
                Hand emptied! 13-card Pukar claimed!
                <br />
                <span className="text-[11px] text-yellow-300/90 font-medium">
                  🌊 Ripple shockwave shaking all cards across the table!
                </span>
              </p>

              {/* Dismiss hint */}
              <button
                type="button"
                onClick={onClose}
                className="mt-4 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
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
