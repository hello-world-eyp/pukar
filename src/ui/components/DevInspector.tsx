import React, { useState } from 'react';
import { Card, Player, SanitizedPlayer } from '../../engine/types';
import { PlayingCard } from './PlayingCard';
import { Eye, EyeOff, Wrench, Layers, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

export interface DevInspectorProps {
  players: Array<Player | SanitizedPlayer>;
  currentPlayerIndex: number;
  activeTurnIndex?: number;
  onSwitchPlayer: (playerIndex: number) => void;
  onForceTurn?: (playerIndex: number) => void;
  pukarPoolCount?: number;
  pukarPool?: Card[][];
  stockDeckCount?: number;
  discardPileCount?: number;
  isGodModeOpen?: boolean;
  onToggleGodMode?: () => void;
  onPreviewCelebration?: () => void;
  newlyPickedUpCardIds?: string[];
  className?: string;
}

export const DevInspector: React.FC<DevInspectorProps> = ({
  players,
  currentPlayerIndex,
  activeTurnIndex,
  onSwitchPlayer,
  onForceTurn,
  pukarPoolCount,
  pukarPool,
  stockDeckCount,
  discardPileCount,
  isGodModeOpen: controlledGodMode,
  onToggleGodMode,
  onPreviewCelebration,
  newlyPickedUpCardIds,
  className = '',
}) => {
  const [internalGodMode, setInternalGodMode] = useState(false);
  const isGodModeOpen = controlledGodMode !== undefined ? controlledGodMode : internalGodMode;

  const handleToggleGodMode = () => {
    try {
      if (controlledGodMode === undefined) {
        setInternalGodMode(!internalGodMode);
      }
      onToggleGodMode?.();
    } catch (err) {
      console.error('Error toggling god mode:', err);
    }
  };

  const actualPukarCount = pukarPoolCount ?? pukarPool?.length ?? 0;

  return (
    <div
      data-testid="dev-inspector"
      className={`w-full bg-slate-950/95 border border-slate-800 rounded-2xl p-3 md:p-4 text-slate-200 shadow-2xl flex flex-col gap-3 ${className}`}
    >
      {/* HEADER BAR: TOOL IDENTIFIER & HOT-SEAT SWITCHER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Wrench className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Dev Inspector
            </span>
            <span className="text-[10px] text-slate-500 block">
              Perspective Switcher & Debug Tools
            </span>
          </div>
        </div>

        {/* HOT-SEAT PLAYER SWITCHER TABS & FORCE TURN BUTTON */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0" role="tablist" aria-label="Player Tabs">
            {players.map((player, index) => {
              const isActive = index === currentPlayerIndex;
              const isTurn = index === (activeTurnIndex ?? currentPlayerIndex);
              const isTeamA = player.team === 'A';
              const cardCount = 'hand' in player && player.hand ? player.hand.length : ('cardCount' in player ? player.cardCount : 0);

              return (
                <button
                  key={player.id || `p-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid={`switcher-p${index + 1}`}
                  onClick={() => {
                    try {
                      onSwitchPlayer(index);
                    } catch (err) {
                      console.error('Error in onSwitchPlayer:', err);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shrink-0 ${
                    isActive
                      ? isTeamA
                        ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-900/50 ring-2 ring-blue-400/50 scale-105'
                        : 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg shadow-amber-900/50 ring-2 ring-amber-400/50 scale-105'
                      : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{player.name || `P${index + 1}`}</span>
                  <span
                    className={`text-[10px] px-1 py-0.5 rounded uppercase ${
                      isActive
                        ? isTeamA
                          ? 'bg-blue-800 text-blue-100'
                          : 'bg-amber-700 text-amber-100'
                        : isTeamA
                        ? 'bg-blue-950 text-blue-400 border border-blue-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {`T${player.team}`}
                  </span>
                  {isTurn && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/30 text-emerald-300 font-extrabold uppercase">
                      Turn
                    </span>
                  )}
                  <span className="text-[10px] opacity-75 font-normal">
                    {`(${cardCount}c)`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* FORCE TURN TO THIS PLAYER TOGGLE BUTTON */}
          {onForceTurn && (
            <button
              type="button"
              data-testid="btn-force-turn"
              onClick={() => {
                try {
                  onForceTurn(currentPlayerIndex);
                } catch (err) {
                  console.error('Error in onForceTurn:', err);
                }
              }}
              disabled={activeTurnIndex !== undefined && currentPlayerIndex === activeTurnIndex}
              title={
                activeTurnIndex !== undefined && currentPlayerIndex === activeTurnIndex
                  ? `Already ${players[currentPlayerIndex]?.name || `Player ${currentPlayerIndex + 1}`}'s active turn`
                  : `Force game turn to ${players[currentPlayerIndex]?.name || `Player ${currentPlayerIndex + 1}`}`
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shrink-0 ${
                activeTurnIndex !== undefined && currentPlayerIndex === activeTurnIndex
                  ? 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-900/40 ring-1 ring-amber-400'
              }`}
            >
              <span>Force Turn To This Player</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap sm:flex-nowrap">
          {/* 500-PT CELEBRATION PREVIEW BUTTON */}
          {onPreviewCelebration && (
            <button
              type="button"
              data-testid="btn-preview-500-celebration"
              onClick={onPreviewCelebration}
              className="px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 border border-amber-400 shadow-md flex items-center gap-1.5 cursor-pointer shrink-0 transition-transform active:scale-95"
              title="Preview 10s 500-Point Celebration Animation"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Preview 500-Pt Animation</span>
            </button>
          )}

          {/* GOD MODE TOGGLE BUTTON */}
          <button
            type="button"
            data-testid="btn-toggle-godmode"
            onClick={handleToggleGodMode}
            aria-expanded={isGodModeOpen}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shrink-0 ${
              isGodModeOpen
                ? 'bg-purple-600/90 text-white border-purple-400 shadow-md shadow-purple-900/40 ring-1 ring-purple-400'
                : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700'
            }`}
          >
            {isGodModeOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>God Mode</span>
            {isGodModeOpen ? (
              <ChevronUp className="w-3 h-3 text-purple-200" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* GOD MODE COLLAPSIBLE PANEL (VIEW ALL HANDS) */}
      {isGodModeOpen && (
        <div
          data-testid="godmode-panel"
          className="flex flex-col gap-4 pt-1 animate-in fade-in duration-200"
        >
          {/* DEBUG SUMMARY METRICS */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 bg-slate-900/70 p-2.5 rounded-xl border border-slate-800">
            <span className="font-bold text-purple-300 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Game Pools:
            </span>
            {stockDeckCount !== undefined && (
              <span>Stock: <strong className="text-slate-200">{stockDeckCount}</strong></span>
            )}
            {discardPileCount !== undefined && (
              <span>Discard: <strong className="text-slate-200">{discardPileCount}</strong></span>
            )}
            <span>Pukar Pool: <strong className="text-slate-200">{`${actualPukarCount} decks`}</strong></span>
          </div>

          {/* ALL PLAYERS HANDS GRID */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {players.map((player, pIdx) => {
              const isActive = pIdx === currentPlayerIndex;
              const hasHand = 'hand' in player && Array.isArray(player.hand);
              const handCards = hasHand ? (player.hand as Card[]) : [];
              const isTeamA = player.team === 'A';

              return (
                <div
                  key={`godmode-p-${player.id || pIdx}`}
                  data-testid={`godmode-player-${pIdx + 1}`}
                  className={`bg-slate-900/90 rounded-xl p-3 border transition-all ${
                    isActive
                      ? isTeamA
                        ? 'border-blue-500/80 shadow-md shadow-blue-950/50'
                        : 'border-amber-500/80 shadow-md shadow-amber-950/50'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-100">
                        {player.name || `Player ${pIdx + 1}`}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase ${
                          isTeamA ? 'bg-blue-600 text-white' : 'bg-amber-500 text-slate-950'
                        }`}
                      >
                        {`Team ${player.team}`}
                      </span>
                      {isActive && (
                        <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-600/40 px-1 rounded">
                          Current Turn
                        </span>
                      )}
                      {onForceTurn && pIdx !== (activeTurnIndex ?? currentPlayerIndex) && (
                        <button
                          type="button"
                          data-testid={`btn-force-turn-p${pIdx + 1}`}
                          onClick={() => onForceTurn(pIdx)}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 transition-colors"
                        >
                          Force Turn
                        </button>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {`${handCards.length} cards`}
                    </span>
                  </div>

                  {/* CARDS LIST IN SMALL FORMAT */}
                  <div className="overflow-x-auto pb-1.5 pt-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {handCards.length === 0 ? (
                      <div className="text-[11px] text-slate-500 italic py-2">
                        No cards in hand
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 min-w-max">
                        {handCards.map((card, cIdx) => (
                          <div key={card.id || `card-${cIdx}`} className="shrink-0">
                            <PlayingCard
                              card={card}
                              size="sm"
                              isNew={
                                pIdx === (activeTurnIndex ?? currentPlayerIndex) &&
                                Boolean(newlyPickedUpCardIds?.includes(card.id))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
