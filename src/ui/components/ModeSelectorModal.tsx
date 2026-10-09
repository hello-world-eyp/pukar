import React from 'react';
import { Users, Wifi, MonitorPlay, X } from 'lucide-react';

export interface ModeSelectorModalProps {
  isOpen: boolean;
  onSelectLocal: () => void;
  onSelectMultiplayer: () => void;
  onClose: () => void;
}

export const ModeSelectorModal: React.FC<ModeSelectorModalProps> = ({
  isOpen,
  onSelectLocal,
  onSelectMultiplayer,
  onClose,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="mode-selector-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mode-selector-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl text-stone-100 flex flex-col gap-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          data-testid="btn-close-modal"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-white rounded-full hover:bg-stone-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-400 mb-2">
            <Users className="w-8 h-8" />
          </div>
          <h2 id="mode-selector-title" className="text-2xl font-black tracking-tight text-white">
            Choose Game Mode
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Play locally on one screen or join friends on LAN / Online
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button
            data-testid="btn-mode-local"
            onClick={() => {
              onSelectLocal();
              onClose();
            }}
            className="group flex items-start gap-4 p-4 rounded-2xl bg-stone-800/80 hover:bg-stone-800 border border-stone-700/60 hover:border-amber-500/50 transition-all text-left cursor-pointer"
          >
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform">
              <MonitorPlay className="w-6 h-6" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-stone-100 group-hover:text-amber-300">
                Local Hot-Seat / Pass &amp; Play
              </div>
              <div className="text-xs text-stone-400 mt-0.5">
                Play on this device with perspective switcher &amp; God-Mode inspector.
              </div>
            </div>
          </button>

          <button
            data-testid="btn-mode-multiplayer"
            onClick={() => {
              onSelectMultiplayer();
              onClose();
            }}
            className="group flex items-start gap-4 p-4 rounded-2xl bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/50 hover:border-emerald-500/60 transition-all text-left cursor-pointer"
          >
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
              <Wifi className="w-6 h-6" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-emerald-200 group-hover:text-emerald-100">
                LAN &amp; Online Multiplayer
              </div>
              <div className="text-xs text-stone-400 mt-0.5">
                Create a 4-letter room code or join friends on Wi-Fi with personal hands.
              </div>
            </div>
          </button>
        </div>

        <button
          data-testid="btn-cancel-modal"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl font-bold text-xs text-stone-400 hover:text-stone-200 bg-stone-800/40 hover:bg-stone-800 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
