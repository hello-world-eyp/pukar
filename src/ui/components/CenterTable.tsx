import React, { useState } from 'react';
import { Card } from '../../engine/types';
import { PlayingCard } from './PlayingCard';
import { DiscardPileModal } from './DiscardPileModal';
import { Eye, Layers, ArrowDownCircle, Sparkles, AlertTriangle } from 'lucide-react';

export interface CenterTableProps {
  stockDeckCount?: number;
  stockDeck?: Card[];
  discardPile: Card[];
  pukarPoolCount?: number;
  pukarPool?: Card[][];
  canDraw?: boolean;
  canDrawStock?: boolean;
  canDrawDiscard?: boolean;
  onDrawStock?: () => void;
  onDrawDiscard?: () => void;
  onPeekDiscard?: () => void;
  className?: string;
}

export const CenterTable: React.FC<CenterTableProps> = ({
  stockDeckCount,
  stockDeck,
  discardPile,
  pukarPoolCount,
  pukarPool,
  canDraw = false,
  canDrawStock,
  canDrawDiscard,
  onDrawStock,
  onDrawDiscard,
  onPeekDiscard,
  className = '',
}) => {
  const [internalPeekOpen, setInternalPeekOpen] = useState(false);

  const actualStockCount = stockDeckCount ?? stockDeck?.length ?? 0;
  const actualPukarCount = pukarPoolCount ?? pukarPool?.length ?? 0;
  const drawStockAllowed = canDrawStock !== undefined ? canDrawStock : canDraw;
  const drawDiscardAllowed =
    canDrawDiscard !== undefined ? canDrawDiscard : canDraw && discardPile.length > 0;

  const topDiscardCard =
    discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

  const handleOpenPeek = () => {
    if (onPeekDiscard) {
      onPeekDiscard();
    } else {
      setInternalPeekOpen(true);
    }
  };

  const handleClosePeek = () => {
    setInternalPeekOpen(false);
  };

  // Dummy card representation for faceDown stock deck card
  const dummyStockCard: Card = {
    id: '__stock_top__',
    suit: 'SPADES',
    rank: 14,
  };

  return (
    <>
      <div
        className={`relative w-full rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-900 to-slate-950 border border-slate-800/80 p-5 shadow-2xl text-slate-100 ${className}`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* 1. STOCK DECK */}
          <div className="flex flex-col items-center justify-between p-4 rounded-xl bg-slate-950/50 border border-slate-800/60 min-h-[220px]">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <span>Stock Deck</span>
            </div>

            {/* Visual Card Stack */}
            <div className="relative my-2 flex items-center justify-center">
              {actualStockCount > 1 && (
                <div className="absolute -top-1.5 -left-1.5 w-20 h-28 rounded-lg bg-blue-950/80 border border-blue-800/50 -rotate-3" />
              )}
              {actualStockCount > 2 && (
                <div className="absolute -top-0.5 -right-1.5 w-20 h-28 rounded-lg bg-blue-950/80 border border-blue-800/50 rotate-2" />
              )}

              {actualStockCount > 0 ? (
                <div
                  onClick={drawStockAllowed ? onDrawStock : undefined}
                  className={`relative z-10 transition-all ${
                    drawStockAllowed
                      ? 'cursor-pointer hover:scale-105 active:scale-95 ring-2 ring-sky-400/80 ring-offset-2 ring-offset-slate-900 rounded-lg shadow-lg shadow-sky-500/20'
                      : ''
                  }`}
                >
                  <PlayingCard card={dummyStockCard} faceDown size="md" />
                </div>
              ) : (
                <div className="w-20 h-28 rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center p-2 text-center text-slate-500 text-xs">
                  <AlertTriangle className="w-6 h-6 text-amber-500/80 mb-1" />
                  <span>Exhausted</span>
                </div>
              )}
            </div>

            {/* Stock Count & Button */}
            <div className="flex flex-col items-center gap-1.5 mt-2 w-full">
              <span className="text-xs font-medium text-slate-300">
                {`${actualStockCount} ${actualStockCount === 1 ? 'card' : 'cards'} remaining`}
              </span>
              <button
                type="button"
                onClick={onDrawStock}
                disabled={!drawStockAllowed || actualStockCount === 0}
                className={`w-full max-w-[160px] py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  drawStockAllowed && actualStockCount > 0
                    ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md shadow-sky-500/20 hover:scale-[1.02]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
                <span>Draw 1 Card</span>
              </button>
            </div>
          </div>

          {/* 2. DISCARD PILE ("THE BOTTOM") */}
          <div className="flex flex-col items-center justify-between p-4 rounded-xl bg-slate-950/50 border border-slate-800/60 min-h-[220px]">
            <div className="flex items-center justify-between w-full mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Discard Pile (&ldquo;The Bottom&rdquo;)</span>
              </div>
              <button
                type="button"
                onClick={handleOpenPeek}
                aria-label="Peek Pile"
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors cursor-pointer"
              >
                <Eye className="w-3 h-3" />
                <span>{`Peek (${discardPile.length})`}</span>
              </button>
            </div>

            {/* Visual Top Card */}
            <div className="relative my-2 flex items-center justify-center">
              {discardPile.length > 1 && (
                <div className="absolute -top-1 -right-1 w-20 h-28 rounded-lg bg-slate-800/70 border border-slate-700 rotate-2" />
              )}
              {topDiscardCard ? (
                <div
                  onClick={drawDiscardAllowed ? onDrawDiscard : undefined}
                  className={`relative z-10 transition-all ${
                    drawDiscardAllowed
                      ? 'cursor-pointer hover:scale-105 active:scale-95 ring-2 ring-amber-400/80 ring-offset-2 ring-offset-slate-900 rounded-lg shadow-lg shadow-amber-500/20'
                      : ''
                  }`}
                >
                  <PlayingCard card={topDiscardCard} size="md" />
                </div>
              ) : (
                <div className="w-20 h-28 rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center p-2 text-center text-slate-500 text-xs">
                  <span>Empty Pile</span>
                </div>
              )}
            </div>

            {/* Discard Count & Draw Button */}
            <div className="flex flex-col items-center gap-1.5 mt-2 w-full">
              <span className="text-xs font-medium text-slate-300">
                {`${discardPile.length} ${discardPile.length === 1 ? 'card' : 'cards'} in pile`}
              </span>
              <button
                type="button"
                onClick={onDrawDiscard}
                disabled={!drawDiscardAllowed || discardPile.length === 0}
                className={`w-full max-w-[170px] py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  drawDiscardAllowed && discardPile.length > 0
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md shadow-amber-500/20 hover:scale-[1.02]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
                <span>Take The Bottom (All)</span>
              </button>
            </div>
          </div>

          {/* 3. PUKAR POOL */}
          <div className="flex flex-col items-center justify-between p-4 rounded-xl bg-slate-950/50 border border-slate-800/60 min-h-[220px]">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Pukar Pool (Reserve)</span>
            </div>

            {/* Pukar Stack Visual Graphic */}
            <div className="my-2 flex flex-col items-center justify-center">
              {actualPukarCount > 0 ? (
                <div className="relative flex items-center justify-center w-28 h-28">
                  {Array.from({ length: Math.min(actualPukarCount, 4) }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        transform: `translate(${i * 4 - 6}px, ${-i * 4 + 4}px)`,
                      }}
                      className="absolute w-20 h-24 rounded-lg bg-gradient-to-br from-emerald-900 to-teal-950 border border-emerald-500/50 shadow-md flex items-center justify-center text-center p-1.5"
                    >
                      <div className="w-full h-full border border-emerald-400/20 rounded border-dashed flex flex-col items-center justify-center text-[10px] text-emerald-200">
                        <span className="font-extrabold uppercase tracking-wide">Pukar</span>
                        <span className="text-[8px] opacity-75">13 Cards</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl border border-dashed border-red-500/40 bg-red-950/20 flex flex-col items-center justify-center p-2 text-center text-red-400 text-xs">
                  <span className="font-bold">0 Pukars</span>
                  <span className="text-[10px] text-slate-400 mt-1">
                    Exhaust rule active
                  </span>
                </div>
              )}
            </div>

            {/* Pukar Count Status */}
            <div className="flex flex-col items-center gap-1 mt-2 text-center w-full">
              <span className="text-xs font-bold text-emerald-300">
                {`${actualPukarCount} ${actualPukarCount === 1 ? 'Pukar' : 'Pukars'} Available`}
              </span>
              <span className="text-[10px] text-slate-400">
                13 cards each • Claim awards +50 pts bonus
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Discard Pile Modal (Active when not externally overridden) */}
      {!onPeekDiscard && (
        <DiscardPileModal
          isOpen={internalPeekOpen}
          onClose={handleClosePeek}
          cards={discardPile}
        />
      )}
    </>
  );
};
