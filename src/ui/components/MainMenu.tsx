import React from 'react';
import {
  Wifi,
  Users,
  HelpCircle,
  Volume2,
  VolumeX,
  Crown,
  ArrowRight,
} from 'lucide-react';

export interface MainMenuProps {
  onPlayOnline: () => void;
  onPlayLocal: () => void;
  onOpenRules: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onPlayOnline,
  onPlayLocal,
  onOpenRules,
  isMuted = false,
  onToggleMute,
}) => {
  return (
    <div
      data-testid="main-menu"
      className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500/30 selection:text-white"
    >
      {/* Top Header Bar */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/20">
            ♠
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg sm:text-xl tracking-tight bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                PUKAR
              </span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                Royal Rummy
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Classic Strategic Card Game</p>
          </div>
        </div>

        {/* Top Quick Actions (Sound & Rules) */}
        <div className="flex items-center gap-2.5">
          {onToggleMute && (
            <button
              type="button"
              data-testid="btn-menu-sound"
              onClick={onToggleMute}
              className={`p-2 sm:p-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                isMuted
                  ? 'bg-red-950/60 text-red-300 border-red-800/80 hover:bg-red-900/60'
                  : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 shadow-sm'
              }`}
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
              aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            data-testid="btn-menu-rules-top"
            onClick={onOpenRules}
            className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Game Rules & Guide"
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Rules &amp; Guide</span>
          </button>
        </div>
      </header>

      {/* Main Hero & Mode Cards */}
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 flex flex-col items-center justify-center flex-1 gap-8 sm:gap-10">
        {/* Hero Title */}
        <div className="text-center flex flex-col items-center max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-wider mb-3 shadow-inner">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Official Royal Edition</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-2">
            Welcome to{' '}
            <span className="bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
              Pukar
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 font-medium max-w-xl">
            Strategic partner rummy with movable wildcards, pure runs, and the royal Pukar reserve.
            Select a mode below to start playing.
          </p>
        </div>

        {/* The Two Main Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 w-full max-w-4xl">
          {/* OPTION 1: PLAY ONLINE PUKAR */}
          <div
            data-testid="card-mode-online"
            className="group relative bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border-2 border-emerald-500/40 hover:border-emerald-400/90 rounded-3xl p-6 sm:p-7 shadow-2xl hover:shadow-emerald-950/50 transition-all duration-300 flex flex-col justify-between overflow-hidden"
          >
            {/* Subtle radial glow */}
            <div className="absolute -top-16 -right-16 w-44 h-44 bg-emerald-500/15 rounded-full blur-3xl group-hover:bg-emerald-500/25 transition-all pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Online Multiplayer
                </span>
                <span className="text-xs font-bold text-slate-400">4 or 6 Players</span>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-emerald-500/30 transition-transform">
                <Wifi className="w-7 h-7" />
              </div>

              <h2 className="text-2xl font-black text-white mb-2 group-hover:text-emerald-300 transition-colors">
                Play Online Pukar
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                Host a room or join friends across phones, laptops, and tablets. Configure teams,
                customize player names, and enjoy real-time card synchronization.
              </p>

              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Instant 4-letter room code sharing</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Interactive lobby seat &amp; team selection</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Cross-device live multiplayer action</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              data-testid="btn-menu-online"
              onClick={onPlayOnline}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 hover:shadow-emerald-900/80 transition-all cursor-pointer group-hover:translate-y-[-1px]"
            >
              <span>Play Online Pukar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* OPTION 2: PLAY LOCAL GAME (PASS & PLAY) */}
          <div
            data-testid="card-mode-local"
            className="group relative bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border-2 border-amber-500/40 hover:border-amber-400/90 rounded-3xl p-6 sm:p-7 shadow-2xl hover:shadow-amber-950/50 transition-all duration-300 flex flex-col justify-between overflow-hidden"
          >
            {/* Subtle radial glow */}
            <div className="absolute -top-16 -right-16 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl group-hover:bg-amber-500/25 transition-all pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Local Pass &amp; Play
                </span>
                <span className="text-xs font-bold text-slate-400">Single Device</span>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-amber-500/30 transition-transform">
                <Users className="w-7 h-7" />
              </div>

              <h2 className="text-2xl font-black text-white mb-2 group-hover:text-amber-300 transition-colors">
                Play Local Game
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                Play together on a single screen with hot-seat switching. Select 4 or 6 players,
                customize team names, and practice strategy with dev inspector tools.
              </p>

              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Choose 4 Players (2 Decks) or 6 Players (3 Decks)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Custom player &amp; team name configuration</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Hot-seat switcher &amp; full table view</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              data-testid="btn-menu-local"
              onClick={onPlayLocal}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/60 hover:shadow-amber-900/80 transition-all cursor-pointer group-hover:translate-y-[-1px]"
            >
              <span>Play Local Game</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feature Highlights Banner */}
        <div className="w-full max-w-4xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex flex-col items-center">
            <span className="text-amber-400 font-extrabold text-sm mb-0.5">200 / 100 Pts</span>
            <span className="text-[11px] text-slate-400">Clean &amp; Dirty 7s</span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex flex-col items-center">
            <span className="text-amber-400 font-extrabold text-sm mb-0.5">Movable 2s</span>
            <span className="text-[11px] text-slate-400">Sliding Wildcards</span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex flex-col items-center">
            <span className="text-amber-400 font-extrabold text-sm mb-0.5">+50 Pts</span>
            <span className="text-[11px] text-slate-400">Royal Pukar Reserve</span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex flex-col items-center">
            <span className="text-amber-400 font-extrabold text-sm mb-0.5">500 Pts</span>
            <span className="text-[11px] text-slate-400">Pure 13-Card Run</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-800/60">
        <div className="flex items-center gap-2">
          <span>♠ ♥ ♦ ♣</span>
          <span>Pukar Royal Rummy • Indian Partnership Card Game</span>
        </div>
        <button
          type="button"
          onClick={onOpenRules}
          className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-4 cursor-pointer"
        >
          Read Complete Game Rules &amp; Scoring Matrix
        </button>
      </footer>
    </div>
  );
};
