import React, { useState } from 'react';
import { Card } from '../../engine/types';
import { PlayingCard } from './PlayingCard';
import { DiscardPileModal } from './DiscardPileModal';
import { Layers, ArrowDownCircle, Sparkles, AlertTriangle, ZoomIn } from 'lucide-react';

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
  isRippling?: boolean;
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
  isRippling = false,
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
    try {
      if (onPeekDiscard) {
        onPeekDiscard();
      } else {
        setInternalPeekOpen(true);
      }
    } catch (err) {
      console.error('Error opening peek modal:', err);
    }
  };

  const handleClosePeek = () => {
    try {
      setInternalPeekOpen(false);
    } catch (err) {
      console.error('Error closing peek modal:', err);
    }
  };

  const handleDrawStock = () => {
    try {
      onDrawStock?.();
    } catch (err) {
      console.error('Error drawing stock:', err);
    }
  };

  const handleDrawDiscard = () => {
    try {
      onDrawDiscard?.();
    } catch (err) {
      console.error('Error drawing discard:', err);
    }
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
        className={`relative w-full rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-900 to-slate-950 border border-slate-800/80 p-3 sm:p-4 shadow-xl text-slate-100 ${className}`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 items-center">
          {/* 1. STOCK DECK */}
          <div className="flex flex-col items-center justify-between p-3 sm:p-4 rounded-2xl bg-slate-950/80 border-2 border-slate-800 shadow-xl min-h-[175px]">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black uppercase tracking-wider text-sky-300 mb-1">
              <Layers className="w-4 h-4 text-sky-400" />
              <span>Stock Deck</span>
            </div>

            {/* Visual Card Stack with 3D Depth */}
            <div className="relative my-2 flex items-center justify-center">
              {actualStockCount > 1 && (
                <div className="absolute -top-1.5 -left-1.5 w-20 h-28 rounded-lg bg-blue-950/90 border border-blue-700/60 -rotate-3 shadow-md" />
              )}
              {actualStockCount > 2 && (
                <div className="absolute -top-0.5 -right-1.5 w-20 h-28 rounded-lg bg-blue-950/90 border border-blue-700/60 rotate-2 shadow-md" />
              )}

              {actualStockCount > 0 ? (
                <div
                  onClick={drawStockAllowed ? handleDrawStock : undefined}
                  className={`relative z-10 transition-all ${
                    isRippling ? 'animate-card-ripple' : ''
                  } ${
                    drawStockAllowed
                      ? 'cursor-pointer hover:scale-105 active:scale-95 ring-4 ring-sky-400/90 ring-offset-2 ring-offset-slate-950 rounded-lg shadow-xl shadow-sky-500/30'
                      : ''
                  }`}
                  style={isRippling ? { animationDelay: '60ms' } : undefined}
                >
                  <PlayingCard card={dummyStockCard} faceDown size="md" />
                </div>
              ) : (
                <div className="w-20 h-28 rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center p-2 text-center text-slate-400 text-xs bg-slate-900/40">
                  <AlertTriangle className="w-6 h-6 text-amber-500 mb-1" />
                  <span className="font-bold">Exhausted</span>
                </div>
              )}
            </div>

            {/* Stock Count & Tactile Button */}
            <div className="flex flex-col items-center gap-2 mt-2 w-full">
              <span className="text-sm font-bold text-slate-200">
                {`${actualStockCount} ${actualStockCount === 1 ? 'card' : 'cards'} remaining`}
              </span>
              <button
                type="button"
                onClick={handleDrawStock}
                disabled={!drawStockAllowed || actualStockCount === 0}
                className={`w-full max-w-[170px] h-10 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                  drawStockAllowed && actualStockCount > 0
                    ? 'btn-game-primary'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                <ArrowDownCircle className="w-4 h-4 shrink-0" />
                <span>Draw 1 Card</span>
              </button>
            </div>
          </div>

          {/* 2. DISCARD PILE ("THE BOTTOM") */}
          <div className="flex flex-col items-center justify-between p-3 sm:p-4 rounded-2xl bg-slate-950/80 border-2 border-slate-800 shadow-xl min-h-[175px]">
            <div className="flex items-center justify-between w-full mb-1">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Discard Pile (&ldquo;The Bottom&rdquo;)</span>
              </div>
              <button
                type="button"
                onClick={handleOpenPeek}
                aria-label="Peek Pile"
                data-testid="btn-zoom-discard-pile"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all cursor-pointer shadow-sm hover:scale-105"
                title="Click to peek into pile and see all buried cards"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>{`Zoom (${discardPile.length})`}</span>
              </button>
            </div>

            {/* Visual Top Card - Click to Zoom */}
            <div
              className="relative my-2 flex items-center justify-center cursor-pointer group"
              onClick={handleOpenPeek}
              title="Click pile to zoom and view all cards"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOpenPeek();
                }
              }}
            >
              {discardPile.length > 1 && (
                <div className="absolute -top-1 -right-1 w-20 h-28 rounded-lg bg-slate-800/80 border border-slate-600 rotate-2 pointer-events-none shadow-md" />
              )}
              {topDiscardCard ? (
                <div
                  key={topDiscardCard.id}
                  className={`relative z-10 transition-transform group-hover:scale-105 active:scale-95 rounded-lg shadow-xl ${
                    isRippling ? 'animate-card-ripple' : 'animate-discard-landing'
                  } ${
                    drawDiscardAllowed
                      ? 'ring-4 ring-amber-400/90 ring-offset-2 ring-offset-slate-950'
                      : ''
                  }`}
                  style={isRippling ? { animationDelay: '80ms' } : undefined}
                >
                  <PlayingCard card={topDiscardCard} size="md" />
                  <div className="absolute inset-0 bg-slate-950/60 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-amber-300 font-extrabold text-xs gap-1 backdrop-blur-[1px]">
                    <ZoomIn className="w-4 h-4" />
                    <span>Zoom Pile</span>
                  </div>
                </div>
              ) : (
                <div className="w-20 h-28 rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center p-2 text-center text-slate-400 text-xs bg-slate-900/40">
                  <span className="font-bold">Empty Pile</span>
                </div>
              )}
            </div>

            {/* Discard Count & Draw Button */}
            <div className="flex flex-col items-center gap-2 mt-2 w-full">
              <span className="text-sm font-bold text-slate-200">
                {`${discardPile.length} ${discardPile.length === 1 ? 'card' : 'cards'} in pile`}
              </span>
              <button
                type="button"
                onClick={handleDrawDiscard}
                disabled={!drawDiscardAllowed || discardPile.length === 0}
                className={`w-full max-w-[190px] h-10 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                  drawDiscardAllowed && discardPile.length > 0
                    ? 'btn-game-amber'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                <ArrowDownCircle className="w-4 h-4 shrink-0" />
                <span>Take The Bottom (All)</span>
              </button>
            </div>
          </div>

          {/* 3. PUKAR POOL */}
          <div className="flex flex-col items-center justify-between p-3 sm:p-4 rounded-2xl bg-slate-950/80 border-2 border-slate-800 shadow-xl min-h-[175px]">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-300 mb-1">
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
                      className="absolute w-20 h-24 rounded-lg bg-gradient-to-br from-emerald-900 to-teal-950 border-2 border-emerald-400/60 shadow-lg flex items-center justify-center text-center p-1.5"
                    >
                      <div className="w-full h-full border border-emerald-400/30 rounded border-dashed flex flex-col items-center justify-center text-[10px] text-emerald-200">
                        <span className="font-black uppercase tracking-wider text-amber-300">Pukar</span>
                        <span className="text-[9px] font-bold opacity-90">13 Cards</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-red-500/50 bg-red-950/30 flex flex-col items-center justify-center p-2 text-center text-red-300 text-xs">
                  <span className="font-black text-sm">0 Pukars</span>
                  <span className="text-[11px] font-medium text-slate-300 mt-1">
                    Exhaust rule active
                  </span>
                </div>
              )}
            </div>

            {/* Pukar Count Status */}
            <div className="flex flex-col items-center gap-1 mt-2 text-center w-full">
              <span className="text-sm font-black text-emerald-300">
                {`${actualPukarCount} ${actualPukarCount === 1 ? 'Pukar' : 'Pukars'} Available`}
              </span>
              <span className="text-xs font-semibold text-slate-300">
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
