import React, { useState, useEffect } from 'react';
import { Users, Shield, Sparkles, X, Play, RotateCcw } from 'lucide-react';

export interface GameSetupModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onStartGame: (playerCount: 4 | 6, playerNames: string[]) => void;
  initialPlayerCount?: 4 | 6;
  initialPlayerNames?: string[];
  isGameInProgress?: boolean;
}

export const GameSetupModal: React.FC<GameSetupModalProps> = ({
  isOpen,
  onClose,
  onStartGame,
  initialPlayerCount = 4,
  initialPlayerNames,
  isGameInProgress = false,
}) => {
  const [playerCount, setPlayerCount] = useState<4 | 6>(initialPlayerCount);
  const [names, setNames] = useState<string[]>(() => {
    const default4 = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
    const default6 = ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6'];
    const defaults = initialPlayerCount === 6 ? default6 : default4;
    if (initialPlayerNames && initialPlayerNames.length > 0) {
      return defaults.map((d, i) => initialPlayerNames[i]?.trim() || d);
    }
    return defaults;
  });

  // Keep state synced when modal opens or initial props change
  useEffect(() => {
    if (isOpen) {
      setPlayerCount(initialPlayerCount);
      const defaults = initialPlayerCount === 6
        ? ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6']
        : ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
      if (initialPlayerNames && initialPlayerNames.length > 0) {
        setNames(defaults.map((d, i) => initialPlayerNames[i]?.trim() || d));
      } else {
        setNames(defaults);
      }
    }
  }, [isOpen, initialPlayerCount, initialPlayerNames]);

  if (!isOpen) return null;

  const handlePlayerCountChange = (count: 4 | 6) => {
    setPlayerCount(count);
    setNames((prev) => {
      const targetLength = count;
      const result = [...prev];
      while (result.length < targetLength) {
        result.push(`Player ${result.length + 1}`);
      }
      return result.slice(0, targetLength);
    });
  };

  const handleNameChange = (index: number, newName: string) => {
    setNames((prev) => {
      const next = [...prev];
      next[index] = newName;
      return next;
    });
  };

  const handleResetDefaults = () => {
    const defaults = playerCount === 6
      ? ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6']
      : ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
    setNames(defaults);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedNames = names.slice(0, playerCount).map((n, i) => {
      const trimmed = n.trim();
      return trimmed.length > 0 ? trimmed : `Player ${i + 1}`;
    });
    onStartGame(playerCount, sanitizedNames);
  };

  // Group players by alternating teams
  // In Pukar: Even indices (0, 2, 4) are Team A; Odd indices (1, 3, 5) are Team B
  const teamAPlayers = Array.from({ length: playerCount / 2 }, (_, i) => i * 2);
  const teamBPlayers = Array.from({ length: playerCount / 2 }, (_, i) => i * 2 + 1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-modal-title"
      data-testid="game-setup-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-7 text-slate-100 shadow-2xl shadow-black/80 flex flex-col gap-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-900/40">
              ♠
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="setup-modal-title" className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Pukar Setup
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                  Royal Rummy
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure player count and names before dealing
              </p>
            </div>
          </div>

          {isGameInProgress && onClose && (
            <button
              type="button"
              onClick={onClose}
              data-testid="btn-close-setup-modal"
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              aria-label="Close setup modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Step 1: Player Count Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-400" />
              <span>Select Player Count</span>
            </label>
            <div className="grid grid-cols-2 gap-3" role="group" aria-label="Player count selection">
              <button
                type="button"
                data-testid="btn-select-4p"
                onClick={() => handlePlayerCountChange(4)}
                className={`py-3 px-4 rounded-2xl font-bold text-sm border flex items-center justify-center gap-2.5 transition-all ${
                  playerCount === 4
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/50 scale-[1.02]'
                    : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <Users className="w-4 h-4" />
                <div className="text-left">
                  <div className="font-extrabold leading-tight">4 Players</div>
                  <div className={`text-[10px] ${playerCount === 4 ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                    2 Teams of 2 (2 Pukars)
                  </div>
                </div>
              </button>

              <button
                type="button"
                data-testid="btn-select-6p"
                onClick={() => handlePlayerCountChange(6)}
                className={`py-3 px-4 rounded-2xl font-bold text-sm border flex items-center justify-center gap-2.5 transition-all ${
                  playerCount === 6
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/50 scale-[1.02]'
                    : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <Users className="w-4 h-4" />
                <div className="text-left">
                  <div className="font-extrabold leading-tight">6 Players</div>
                  <div className={`text-[10px] ${playerCount === 6 ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                    2 Teams of 3 (3 Pukars)
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Custom Player Names Organized by Team */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Player Names & Teams</span>
              </label>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] font-semibold text-slate-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Defaults</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* TEAM A COLUMN */}
              <div className="bg-blue-950/40 border border-blue-500/40 rounded-2xl p-3 sm:p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-blue-500/30 pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-blue-300">
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    <span>Team A (Partners)</span>
                  </div>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded border border-blue-500/30 font-semibold">
                    {`Seats: ${teamAPlayers.map((i) => i + 1).join(', ')}`}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {teamAPlayers.map((playerIndex) => (
                    <div key={`input-p-${playerIndex}`} className="flex flex-col gap-1">
                      <label
                        htmlFor={`input-player-${playerIndex + 1}`}
                        className="text-[11px] font-medium text-slate-300 flex items-center justify-between"
                      >
                        <span>{`Seat ${playerIndex + 1}`}</span>
                        {playerIndex === 0 && (
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 px-1 rounded">
                            First Turn
                          </span>
                        )}
                      </label>
                      <input
                        id={`input-player-${playerIndex + 1}`}
                        data-testid={`input-player-${playerIndex + 1}`}
                        type="text"
                        maxLength={20}
                        value={names[playerIndex] || ''}
                        onChange={(e) => handleNameChange(playerIndex, e.target.value)}
                        placeholder={`Player ${playerIndex + 1}`}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all font-semibold"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* TEAM B COLUMN */}
              <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-3 sm:p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>Team B (Partners)</span>
                  </div>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30 font-semibold">
                    {`Seats: ${teamBPlayers.map((i) => i + 1).join(', ')}`}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {teamBPlayers.map((playerIndex) => (
                    <div key={`input-p-${playerIndex}`} className="flex flex-col gap-1">
                      <label
                        htmlFor={`input-player-${playerIndex + 1}`}
                        className="text-[11px] font-medium text-slate-300 flex items-center justify-between"
                      >
                        <span>{`Seat ${playerIndex + 1}`}</span>
                      </label>
                      <input
                        id={`input-player-${playerIndex + 1}`}
                        data-testid={`input-player-${playerIndex + 1}`}
                        type="text"
                        maxLength={20}
                        value={names[playerIndex] || ''}
                        onChange={(e) => handleNameChange(playerIndex, e.target.value)}
                        placeholder={`Player ${playerIndex + 1}`}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all font-semibold"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-1">
              💡 Partners sit across from each other and share cumulative sequence points and Pukar bonuses.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            {isGameInProgress && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              data-testid="btn-start-game"
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>{isGameInProgress ? 'Restart & Deal' : 'Start Game'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
