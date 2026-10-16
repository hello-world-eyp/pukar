import React, { useState } from 'react';
import { Bot, Users, Shield, Play, X, User } from 'lucide-react';
import { BotGameConfig, BotPersonality, BOT_PROFILES } from '../../engine/bots/types';

export interface BotSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartBotGame: (config: BotGameConfig, playerName: string) => void;
  initialPlayerCount?: 4 | 6;
  initialPlayerName?: string;
}

export const BotSetupModal: React.FC<BotSetupModalProps> = ({
  isOpen,
  onClose,
  onStartBotGame,
  initialPlayerCount = 4,
  initialPlayerName = 'You',
}) => {
  const [playerCount, setPlayerCount] = useState<4 | 6>(initialPlayerCount);
  const [playerName, setPlayerName] = useState(initialPlayerName);

  // Bot assignments for seats:
  // Seat 0: Human
  // Seat 1: Opponent 1 (Team B)
  // Seat 2: Partner 1 (Team A)
  // Seat 3: Opponent 2 (Team B)
  // Seat 4: Partner 2 (Team A - 6p)
  // Seat 5: Opponent 3 (Team B - 6p)
  const [seat1Personality, setSeat1Personality] = useState<BotPersonality>('fast_chachi');
  const [seat2Personality, setSeat2Personality] = useState<BotPersonality>('smart_chacha');
  const [seat3Personality, setSeat3Personality] = useState<BotPersonality>('the_long_term_guy');
  const [seat4Personality, setSeat4Personality] = useState<BotPersonality>('the_jadugar');
  const [seat5Personality, setSeat5Personality] = useState<BotPersonality>('smart_chacha');

  if (!isOpen) return null;

  const botOptions: { id: BotPersonality; name: string }[] = [
    { id: 'smart_chacha', name: BOT_PROFILES.smart_chacha.name },
    { id: 'the_jadugar', name: BOT_PROFILES.the_jadugar.name },
    { id: 'fast_chachi', name: BOT_PROFILES.fast_chachi.name },
    { id: 'the_long_term_guy', name: BOT_PROFILES.the_long_term_guy.name },
    { id: 'cheetah', name: BOT_PROFILES.cheetah.name },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPlayerName = playerName.trim() || 'You';

    const seats = [
      {
        seatIndex: 0,
        name: trimmedPlayerName,
        personality: 'smart_chacha' as BotPersonality,
        isHuman: true,
      },
      {
        seatIndex: 1,
        name: BOT_PROFILES[seat1Personality].name,
        personality: seat1Personality,
        isHuman: false,
      },
      {
        seatIndex: 2,
        name: BOT_PROFILES[seat2Personality].name,
        personality: seat2Personality,
        isHuman: false,
      },
      {
        seatIndex: 3,
        name: BOT_PROFILES[seat3Personality].name,
        personality: seat3Personality,
        isHuman: false,
      },
    ];

    if (playerCount === 6) {
      seats.push(
        {
          seatIndex: 4,
          name: BOT_PROFILES[seat4Personality].name,
          personality: seat4Personality,
          isHuman: false,
        },
        {
          seatIndex: 5,
          name: BOT_PROFILES[seat5Personality].name,
          personality: seat5Personality,
          isHuman: false,
        }
      );
    }

    const config: BotGameConfig = {
      playerCount,
      seats,
    };

    onStartBotGame(config, trimmedPlayerName);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bot-setup-title"
      data-testid="bot-setup-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl sm:max-w-3xl game-modal-frame rounded-3xl p-6 sm:p-8 text-slate-100 shadow-2xl shadow-black/90 flex flex-col gap-6 max-h-[92vh] overflow-y-auto border-2 border-indigo-500/40 bg-slate-900/95">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 flex items-center justify-center shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 id="bot-setup-title" className="text-xl sm:text-2xl font-black text-white">
                Play With Bots
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Choose your teammate and opponent bot personalities for the match.
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="btn-close-bot-setup"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* 1. Player Count Toggle */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Match Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="btn-bot-format-4p"
                onClick={() => setPlayerCount(4)}
                className={`py-3 px-4 rounded-2xl border font-bold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                  playerCount === 4
                    ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-lg shadow-indigo-950/50 ring-1 ring-indigo-400/60'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>4 Players (2 Decks)</span>
              </button>

              <button
                type="button"
                data-testid="btn-bot-format-6p"
                onClick={() => setPlayerCount(6)}
                className={`py-3 px-4 rounded-2xl border font-bold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                  playerCount === 6
                    ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-lg shadow-indigo-950/50 ring-1 ring-indigo-400/60'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>6 Players (3 Decks)</span>
              </button>
            </div>
          </div>

          {/* 2. Team Configurations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Team A (Your Team) */}
            <div className="bg-cyan-950/30 border border-cyan-800/50 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-cyan-300 font-extrabold text-sm border-b border-cyan-800/40 pb-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                <span>Team A (Your Team)</span>
              </div>

              {/* Seat 0 (You) */}
              <div className="flex flex-col gap-1">
                <label htmlFor="human-player-name" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  You (Player 1)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none" />
                  <input
                    id="human-player-name"
                    data-testid="input-human-player-name"
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={18}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              {/* Seat 2 (Partner 1) */}
              <div className="flex flex-col gap-1">
                <label htmlFor="select-bot-partner-1" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Partner Bot
                </label>
                <div className="relative">
                  <Bot className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none" />
                  <select
                    id="select-bot-partner-1"
                    data-testid="select-bot-partner-1"
                    value={seat2Personality}
                    onChange={(e) => setSeat2Personality(e.target.value as BotPersonality)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-cyan-400"
                  >
                    {botOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Seat 4 (Partner 2 if 6p) */}
              {playerCount === 6 && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="select-bot-partner-2" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    2nd Partner Bot
                  </label>
                  <div className="relative">
                    <Bot className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none" />
                    <select
                      id="select-bot-partner-2"
                      data-testid="select-bot-partner-2"
                      value={seat4Personality}
                      onChange={(e) => setSeat4Personality(e.target.value as BotPersonality)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-cyan-400"
                    >
                      {botOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Team B (Opponent Team) */}
            <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-amber-300 font-extrabold text-sm border-b border-amber-800/40 pb-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Team B (Opponents)</span>
              </div>

              {/* Seat 1 (Opponent 1) */}
              <div className="flex flex-col gap-1">
                <label htmlFor="select-bot-opponent-1" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Opponent 1
                </label>
                <div className="relative">
                  <Bot className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" />
                  <select
                    id="select-bot-opponent-1"
                    data-testid="select-bot-opponent-1"
                    value={seat1Personality}
                    onChange={(e) => setSeat1Personality(e.target.value as BotPersonality)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-amber-400"
                  >
                    {botOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Seat 3 (Opponent 2) */}
              <div className="flex flex-col gap-1">
                <label htmlFor="select-bot-opponent-2" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Opponent 2
                </label>
                <div className="relative">
                  <Bot className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" />
                  <select
                    id="select-bot-opponent-2"
                    data-testid="select-bot-opponent-2"
                    value={seat3Personality}
                    onChange={(e) => setSeat3Personality(e.target.value as BotPersonality)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-amber-400"
                  >
                    {botOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Seat 5 (Opponent 3 if 6p) */}
              {playerCount === 6 && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="select-bot-opponent-3" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Opponent 3
                  </label>
                  <div className="relative">
                    <Bot className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" />
                    <select
                      id="select-bot-opponent-3"
                      data-testid="select-bot-opponent-3"
                      value={seat5Personality}
                      onChange={(e) => setSeat5Personality(e.target.value as BotPersonality)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-amber-400"
                    >
                      {botOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="btn-start-bot-game"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-indigo-950/60 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Game vs Bots</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
