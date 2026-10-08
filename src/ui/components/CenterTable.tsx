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
        className={`relative w-full rounded-2xl sm:rounded-3xl p-3 sm:p-4 text-stone-900 ${className}`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 items-stretch">
          {/* 1. STOCK DECK (LEFT) */}
          <div className="flex flex-col items-center justify-between p-3 sm:p-3.5 rounded-2xl table-well-light min-h-[175px]">
            <div className="flex items-center gap-1.5 text-sm sm:text-base font-black uppercase tracking-wider text-stone-800 mb-1">
              <Layers className="w-4 h-4 text-sky-600" />
              <span>Stock Deck</span>
            </div>

            {/* Visual Card Stack with 3D Depth */}
            <div className="relative my-1.5 flex items-center justify-center">
              {actualStockCount > 1 && (
                <div className="absolute -top-1.5 -left-1.5 w-22 h-32 rounded-xl bg-blue-900 border border-blue-700/80 -rotate-3 shadow-md" />
              )}
              {actualStockCount > 2 && (
                <div className="absolute -top-0.5 -right-1.5 w-22 h-32 rounded-xl bg-blue-900 border border-blue-700/80 rotate-2 shadow-md" />
              )}

              {actualStockCount > 0 ? (
                <div
                  onClick={drawStockAllowed ? handleDrawStock : undefined}
                  className={`relative z-10 transition-all ${
                    isRippling ? 'animate-card-ripple' : ''
                  } ${
                    drawStockAllowed
                      ? 'cursor-pointer hover:scale-105 active:scale-95 ring-4 ring-sky-500 ring-offset-2 ring-offset-amber-50 rounded-xl shadow-xl'
                      : ''
                  }`}
                  style={isRippling ? { animationDelay: '60ms' } : undefined}
                >
                  <PlayingCard card={dummyStockCard} faceDown size="md" />
                </div>
              ) : (
                <div className="w-22 h-32 rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center p-2 text-center text-stone-500 text-sm bg-stone-100/60">
                  <AlertTriangle className="w-6 h-6 text-amber-500 mb-1" />
                  <span className="font-bold">Exhausted</span>
                </div>
              )}
            </div>

            {/* Stock Count & Tactile Button */}
            <div className="flex flex-col items-center gap-1.5 mt-1.5 w-full">
              <span className="text-sm font-extrabold text-stone-700">
                {`${actualStockCount} ${actualStockCount === 1 ? 'card' : 'cards'} remaining`}
              </span>
              <button
                type="button"
                onClick={handleDrawStock}
                disabled={!drawStockAllowed || actualStockCount === 0}
                className={`w-full max-w-[190px] h-10 px-3 rounded-xl text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                  drawStockAllowed && actualStockCount > 0
                    ? 'btn-game-primary'
                    : 'bg-stone-300 text-stone-500 cursor-not-allowed opacity-60'
                }`}
              >
                <ArrowDownCircle className="w-4 h-4 shrink-0" />
                <span>Draw 1 Card</span>
              </button>
            </div>
          </div>

          {/* 2. DISCARD PILE ("THE BOTTOM") (MIDDLE) */}
          <div className="flex flex-col items-center justify-between p-3 sm:p-3.5 rounded-2xl table-well-light min-h-[175px]">
            <div className="flex items-center justify-between w-full mb-1 gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-sm sm:text-base font-black uppercase tracking-wider text-amber-900 truncate">
                  Discard Pile
                </span>
                <span className="text-xs font-bold text-stone-600 shrink-0">
                  (&ldquo;The Bottom&rdquo;)
                </span>
              </div>
              <button
                type="button"
                onClick={handleOpenPeek}
                aria-label="Peek Pile"
                data-testid="btn-zoom-discard-pile"
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs sm:text-sm font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-all cursor-pointer shadow-sm hover:scale-105 shrink-0"
                title="Click to peek into pile and see all buried cards"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>{`Zoom (${discardPile.length})`}</span>
              </button>
            </div>

            {/* Visual Top Card - Click to Zoom */}
            <div
              className="relative my-1.5 flex items-center justify-center cursor-pointer group"
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
                <div className="absolute -top-1 -right-1 w-22 h-32 rounded-xl bg-stone-300 border border-stone-400 rotate-2 pointer-events-none shadow-md" />
              )}
              {topDiscardCard ? (
                <div
                  key={topDiscardCard.id}
                  className={`relative z-10 transition-transform group-hover:scale-105 active:scale-95 rounded-xl shadow-xl ${
                    isRippling ? 'animate-card-ripple' : 'animate-discard-landing'
                  } ${
                    drawDiscardAllowed
                      ? 'ring-4 ring-amber-500 ring-offset-2 ring-offset-amber-50'
                      : ''
                  }`}
                  style={isRippling ? { animationDelay: '80ms' } : undefined}
                >
                  <PlayingCard card={topDiscardCard} size="md" />
                  <div className="absolute inset-0 bg-stone-900/60 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-amber-200 font-extrabold text-sm gap-1.5 backdrop-blur-[1px]">
                    <ZoomIn className="w-4 h-4" />
                    <span>Zoom Pile</span>
                  </div>
                </div>
              ) : (
                <div className="w-22 h-32 rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center p-2 text-center text-stone-500 text-sm bg-stone-100/60">
                  <span className="font-bold">Empty Pile</span>
                </div>
              )}
            </div>

            {/* Discard Count & Draw Button */}
            <div className="flex flex-col items-center gap-1.5 mt-1.5 w-full">
              <span className="text-sm font-extrabold text-stone-700">
                {`${discardPile.length} ${discardPile.length === 1 ? 'card' : 'cards'} in pile`}
              </span>
              <button
                type="button"
                onClick={handleDrawDiscard}
                disabled={!drawDiscardAllowed || discardPile.length === 0}
                className={`w-full max-w-[210px] h-10 px-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                  drawDiscardAllowed && discardPile.length > 0
                    ? 'btn-game-amber'
                    : 'bg-stone-300 text-stone-500 cursor-not-allowed opacity-60'
                }`}
              >
                <ArrowDownCircle className="w-4 h-4 shrink-0" />
                <span>Take The Bottom (All)</span>
              </button>
            </div>
          </div>

          {/* 3. PUKAR POOL (RIGHT) */}
          <div className="flex flex-col items-center justify-between p-3 sm:p-3.5 rounded-2xl table-well-light min-h-[175px]">
            <div className="flex items-center gap-1.5 text-sm sm:text-base font-black uppercase tracking-wider text-emerald-900 mb-1">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Pukar Pool (Reserve)</span>
            </div>

            {/* Pukar Stack Visual Graphic */}
            <div className="my-2 flex flex-col items-center justify-center">
              {actualPukarCount > 0 ? (
                <div className="relative flex items-center justify-center w-32 h-32">
                  {/* Subtle pedestal platter */}
                  <div className="absolute inset-x-0 bottom-0 h-10 rounded-full bg-stone-300/60 border border-stone-400/40 shadow-inner" />
                  {Array.from({ length: Math.min(actualPukarCount, 4) }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        transform: `translate(${i * 6 - 8}px, ${-i * 5 + 4}px)`,
                      }}
                      className="absolute w-22 h-28 rounded-xl bg-gradient-to-br from-emerald-800 to-teal-900 border-2 border-emerald-400 shadow-lg flex items-center justify-center text-center p-2"
                    >
                      <div className="w-full h-full border border-emerald-300/40 rounded-lg border-dashed flex flex-col items-center justify-center text-xs text-emerald-100">
                        <span className="font-black uppercase tracking-wider text-amber-300 text-sm">Pukar</span>
                        <span className="text-xs font-bold opacity-95">13 Cards</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-24 h-28 rounded-xl border-2 border-dashed border-red-400 bg-red-50 flex flex-col items-center justify-center p-2 text-center text-red-600 text-sm">
                  <span className="font-black text-sm">0 Pukars</span>
                  <span className="text-xs font-semibold text-stone-500 mt-1">
                    Exhaust rule active
                  </span>
                </div>
              )}
            </div>

            {/* Pukar Count Status */}
            <div className="flex flex-col items-center gap-1 mt-2 text-center w-full">
              <span className="text-sm sm:text-base font-black text-emerald-800">
                {`${actualPukarCount} ${actualPukarCount === 1 ? 'Pukar' : 'Pukars'} Available`}
              </span>
              <span className="text-sm font-bold text-stone-600">
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
