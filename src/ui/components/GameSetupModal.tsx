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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl game-modal-frame rounded-3xl p-6 sm:p-8 md:p-9 text-slate-100 shadow-2xl shadow-black/90 flex flex-col gap-6 sm:gap-7 max-h-[92vh] overflow-y-auto border-2 border-amber-500/30">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4 sm:pb-5">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-2xl sm:text-3xl shadow-lg shadow-amber-900/50 shrink-0">
              ♠
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 id="setup-modal-title" className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Pukar Setup
                </h2>
                <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/40">
                  Royal Rummy
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Configure player count and names before dealing
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              data-testid="btn-close-setup-modal"
              className="p-2 sm:p-2.5 rounded-2xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              aria-label="Close setup modal"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 sm:gap-7">
          {/* Step 1: Player Count Selector */}
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span>Select Player Count</span>
            </label>
            <div className="grid grid-cols-2 gap-4 sm:gap-5" role="group" aria-label="Player count selection">
              <button
                type="button"
                data-testid="btn-select-4p"
                onClick={() => handlePlayerCountChange(4)}
                className={`py-4 sm:py-5 px-5 sm:px-6 rounded-2xl sm:rounded-3xl font-bold border flex items-center justify-center gap-3.5 transition-all cursor-pointer ${
                  playerCount === 4
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 border-amber-300 shadow-xl shadow-amber-500/25 ring-4 ring-amber-400/40 scale-[1.01]'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-700/80 hover:border-slate-600'
                }`}
              >
                <Users className="w-6 h-6 shrink-0" />
                <div className="text-left min-w-0">
                  <div className="text-base sm:text-lg font-black leading-tight">4 Players</div>
                  <div className={`text-xs mt-0.5 ${playerCount === 4 ? 'text-slate-950 font-bold' : 'text-slate-400'}`}>
                    2 Teams of 2 (2 Pukars)
                  </div>
                </div>
              </button>

              <button
                type="button"
                data-testid="btn-select-6p"
                onClick={() => handlePlayerCountChange(6)}
                className={`py-4 sm:py-5 px-5 sm:px-6 rounded-2xl sm:rounded-3xl font-bold border flex items-center justify-center gap-3.5 transition-all cursor-pointer ${
                  playerCount === 6
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 border-amber-300 shadow-xl shadow-amber-500/25 ring-4 ring-amber-400/40 scale-[1.01]'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-700/80 hover:border-slate-600'
                }`}
              >
                <Users className="w-6 h-6 shrink-0" />
                <div className="text-left min-w-0">
                  <div className="text-base sm:text-lg font-black leading-tight">6 Players</div>
                  <div className={`text-xs mt-0.5 ${playerCount === 6 ? 'text-slate-950 font-bold' : 'text-slate-400'}`}>
                    2 Teams of 3 (3 Pukars)
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Custom Player Names Organized by Team */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Player Names & Teams</span>
              </label>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-amber-500/10 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Defaults</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* TEAM A COLUMN */}
              <div className="bg-gradient-to-b from-blue-950/60 to-blue-950/40 border-2 border-blue-500/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col gap-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-blue-500/30 pb-3">
                  <div className="flex items-center gap-2 font-black text-xs text-blue-200">
                    <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Team A (Partners)</span>
                  </div>
                  <span className="text-xs bg-blue-500/25 text-blue-200 px-2.5 py-1 rounded-lg border border-blue-400/40 font-bold">
                    {`Seats: ${teamAPlayers.map((i) => i + 1).join(', ')}`}
                  </span>
                </div>

                <div className="flex flex-col gap-3.5">
                  {teamAPlayers.map((playerIndex) => (
                    <div key={`input-p-${playerIndex}`} className="flex flex-col gap-1.5">
                      <label
                        htmlFor={`input-player-${playerIndex + 1}`}
                        className="text-xs font-bold text-slate-200 flex items-center justify-between"
                      >
                        <span>{`Seat ${playerIndex + 1}`}</span>
                        {playerIndex === 0 && (
                          <span className="text-xs font-black uppercase tracking-wider text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 px-2 py-0.5 rounded-md">
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
                        className="w-full h-11 sm:h-12 bg-slate-900/90 border-2 border-slate-700 focus:border-blue-400 rounded-xl px-4 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-400/25 transition-all shadow-inner"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* TEAM B COLUMN */}
              <div className="bg-gradient-to-b from-amber-950/60 to-amber-950/40 border-2 border-amber-500/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col gap-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
                  <div className="flex items-center gap-2 font-black text-xs text-amber-200">
                    <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Team B (Partners)</span>
                  </div>
                  <span className="text-xs bg-amber-500/25 text-amber-200 px-2.5 py-1 rounded-lg border border-amber-400/40 font-bold">
                    {`Seats: ${teamBPlayers.map((i) => i + 1).join(', ')}`}
                  </span>
                </div>

                <div className="flex flex-col gap-3.5">
                  {teamBPlayers.map((playerIndex) => (
                    <div key={`input-p-${playerIndex}`} className="flex flex-col gap-1.5">
                      <label
                        htmlFor={`input-player-${playerIndex + 1}`}
                        className="text-xs font-bold text-slate-200 flex items-center justify-between"
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
                        className="w-full h-11 sm:h-12 bg-slate-900/90 border-2 border-slate-700 focus:border-amber-400 rounded-xl px-4 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-amber-400/25 transition-all shadow-inner"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3 sm:p-3.5 rounded-2xl text-center">
              <p className="text-xs text-slate-300 font-medium">
                💡 Partners sit across from each other and share cumulative sequence points and Pukar bonuses.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-slate-800">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="h-11 sm:h-12 px-6 sm:px-7 rounded-xl sm:rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-colors cursor-pointer border border-slate-700"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              data-testid="btn-start-game"
              className="flex-1 sm:flex-none h-11 sm:h-12 px-8 sm:px-10 rounded-xl sm:rounded-2xl btn-game-amber font-black text-xs flex items-center justify-center gap-2.5 cursor-pointer shadow-xl shadow-amber-950/60 hover:scale-[1.01] active:scale-[0.99] transition-all"
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
