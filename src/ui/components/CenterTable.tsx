import React, { useState, useMemo } from 'react';
import { Card } from '../../engine/types';
import { PlayingCard } from './PlayingCard';
import { DiscardPileModal } from './DiscardPileModal';
import { ArrowDownCircle, AlertTriangle, ZoomIn } from 'lucide-react';

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

/**
 * Calculates rotation and translation offsets for rendering a fan of up to 6 cards.
 * Leftmost card slightly rotates to the left, rightmost to the right,
 * with consistent angle differences across cards in between.
 */
export function getFanCardTransform(
  index: number,
  totalCards: number
): { rotation: number; translateX: number; translateY: number } {
  if (totalCards <= 1) {
    return { rotation: 0, translateX: 0, translateY: 0 };
  }

  const centerIndex = (totalCards - 1) / 2;
  const t = index - centerIndex;

  // Consistent angle step across cards:
  // For totalCards = 6: angleStep = 4.4deg -> [-11deg, -6.6deg, -2.2deg, +2.2deg, +6.6deg, +11deg]
  // For totalCards = 2: angleStep = 8deg   -> [-4deg, +4deg]
  const angleStep =
    totalCards === 2 ? 8 : totalCards === 3 ? 6.5 : totalCards === 4 ? 5.5 : totalCards === 5 ? 4.8 : 4.4;
  const rotation = t * angleStep;

  // Horizontal spread: ensures the top-left rank/suit of each previous card is exposed
  const xStep =
    totalCards === 2 ? 28 : totalCards === 3 ? 22 : totalCards === 4 ? 18 : totalCards === 5 ? 16 : 14;
  const translateX = t * xStep;

  // Subtle natural arc: outer cards slightly dip
  const normalized = Math.abs(t) / centerIndex;
  const translateY = normalized * 4;

  return { rotation, translateX, translateY };
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

  // Recently discarded cards shown as a fan (up to 6 cards)
  const recentCards = useMemo(() => {
    if (!discardPile || discardPile.length === 0) return [];
    return discardPile.slice(-6);
  }, [discardPile]);

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
        className={`relative w-full rounded-2xl sm:rounded-3xl p-2 sm:p-2.5 text-stone-900 ${className}`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 items-stretch">
          {/* 1. STOCK DECK (LEFT) */}
          <div
            aria-label="Stock Deck"
            className="relative flex flex-col items-center justify-between p-2.5 sm:p-3 rounded-2xl table-well-light min-h-[195px] sm:min-h-[210px]"
          >
            <span className="sr-only">Stock Deck</span>

            {/* Visual Card Stack with 3D Depth */}
            <div className="relative my-1 flex items-center justify-center">
              {actualStockCount > 0 ? (
                <div className="relative inline-flex items-center justify-center">
                  {/* Underneath deck cards creating clean, realistic physical depth */}
                  {actualStockCount > 1 && (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 translate-x-[2px] translate-y-[2px] rounded-xl bg-[#0c1836] border border-amber-500/40 shadow-sm pointer-events-none"
                    />
                  )}
                  {actualStockCount > 2 && (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 translate-x-[4px] translate-y-[4px] rounded-xl bg-[#081024] border border-amber-500/30 shadow-md pointer-events-none"
                    />
                  )}
                  {actualStockCount > 10 && (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 translate-x-[6px] translate-y-[6px] rounded-xl bg-[#040814] border border-amber-500/20 shadow-lg pointer-events-none"
                    />
                  )}

                  {/* Top face-down card */}
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
                </div>
              ) : (
                <div className="w-20 h-[120px] sm:w-24 sm:h-[144px] rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center p-2 text-center text-stone-500 text-xs sm:text-sm bg-stone-100/60">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mb-1" />
                  <span className="font-bold">Exhausted</span>
                </div>
              )}
            </div>

            {/* Stock Count & Tactile Button */}
            <div className="flex flex-col items-center gap-1 mt-1 w-full">
              <span className="text-xs sm:text-sm font-extrabold text-stone-700">
                {`${actualStockCount} ${actualStockCount === 1 ? 'card' : 'cards'} remaining in deck`}
              </span>
              <button
                type="button"
                onClick={handleDrawStock}
                disabled={!drawStockAllowed || actualStockCount === 0}
                className={`w-full max-w-[220px] sm:max-w-[240px] h-8 sm:h-8.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                  drawStockAllowed && actualStockCount > 0
                    ? 'btn-game-primary'
                    : 'bg-stone-300 text-stone-500 cursor-not-allowed opacity-60'
                }`}
              >
                <ArrowDownCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Draw 1 Card</span>
              </button>
            </div>
          </div>

          {/* 2. DISCARD PILE (MIDDLE) */}
          <div
            aria-label="Discard Pile"
            className="relative flex flex-col items-center justify-between p-2.5 sm:p-3 rounded-2xl table-well-light min-h-[195px] sm:min-h-[210px]"
          >
            <span className="sr-only">Discard Pile</span>

            {/* Corner Zoom Button - takes zero vertical layout space */}
            <button
              type="button"
              onClick={handleOpenPeek}
              aria-label="Peek Pile"
              data-testid="btn-zoom-discard-pile"
              className="absolute top-2 sm:top-2.5 right-2 sm:right-2.5 z-20 flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs sm:text-sm font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-all cursor-pointer shadow-sm hover:scale-105 shrink-0"
              title="Click to peek into pile and see all buried cards"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>{`Zoom (${discardPile.length})`}</span>
            </button>

            {/* Visual Discard Pile Fan (Up to 6 recently discarded cards) - Click to Zoom */}
            <div
              data-testid="discard-pile-fan"
              className="relative my-1 w-full h-[140px] sm:h-[160px] flex items-center justify-center cursor-pointer group select-none"
              onClick={handleOpenPeek}
              title="Click pile to zoom and view all cards in detail"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOpenPeek();
                }
              }}
            >
              {recentCards.length > 0 ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* Underneath deck cards creating clean physical depth if more than 6 cards in pile */}
                  {discardPile.length > 6 && (
                    <div
                      aria-hidden="true"
                      style={{
                        left: '50%',
                        top: '50%',
                        transform: 'translate(calc(-50% - 42px), calc(-50% + 4px)) rotate(-13deg)',
                        transformOrigin: '50% 115%',
                        zIndex: 0,
                      }}
                      className="absolute w-20 h-[120px] sm:w-24 sm:h-[144px] rounded-xl bg-stone-300/80 border border-stone-400 shadow-sm pointer-events-none"
                    />
                  )}

                  {/* Fanned out cards (up to 6, with consistent angle differences) */}
                  {recentCards.map((card, idx) => {
                    const isTopCard = idx === recentCards.length - 1;
                    const transform = getFanCardTransform(idx, recentCards.length);

                    return (
                      <div
                        key={card.id || `discard-fan-${idx}`}
                        data-testid={isTopCard ? 'top-discard-card' : `discard-fan-card-${idx}`}
                        style={{
                          left: '50%',
                          top: '50%',
                          transform: `translate(calc(-50% + ${transform.translateX}px), calc(-50% + ${transform.translateY}px)) rotate(${transform.rotation}deg)`,
                          transformOrigin: '50% 115%',
                          zIndex: idx + 1,
                        }}
                        className={`absolute transition-transform duration-200 group-hover:scale-[1.02] ${
                          isTopCard && drawDiscardAllowed
                            ? 'ring-4 ring-amber-500 ring-offset-2 ring-offset-amber-50 rounded-xl'
                            : ''
                        }`}
                      >
                        <div
                          style={{
                            animationDelay: isRippling ? `${idx * 25 + 60}ms` : undefined,
                          }}
                          className={`relative ${
                            isTopCard
                              ? isRippling
                                ? 'animate-card-ripple'
                                : 'animate-discard-landing'
                              : isRippling
                              ? 'animate-card-ripple'
                              : ''
                          }`}
                        >
                          <PlayingCard card={card} size="md" />

                          {/* Top card hover zoom affordance */}
                          {isTopCard && (
                            <div className="absolute inset-0 bg-stone-900/60 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-amber-200 font-extrabold text-xs gap-1 backdrop-blur-[1px]">
                              <ZoomIn className="w-3.5 h-3.5" />
                              <span>Zoom</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="w-20 h-[120px] sm:w-24 sm:h-[144px] rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center p-2 text-center text-stone-500 text-xs sm:text-sm bg-stone-100/60">
                  <span className="font-bold">Empty Pile</span>
                </div>
              )}
            </div>

            {/* Discard Count & Draw Button */}
            <div className="flex flex-col items-center gap-1 mt-1 w-full">
              <span className="text-xs sm:text-sm font-extrabold text-stone-700">
                {`${discardPile.length} ${discardPile.length === 1 ? 'card' : 'cards'} in discard pile`}
              </span>
              <button
                type="button"
                onClick={handleDrawDiscard}
                disabled={!drawDiscardAllowed || discardPile.length === 0}
                className={`w-full max-w-[240px] sm:max-w-[260px] h-8 sm:h-8.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                  drawDiscardAllowed && discardPile.length > 0
                    ? 'btn-game-amber'
                    : 'bg-stone-300 text-stone-500 cursor-not-allowed opacity-60'
                }`}
              >
                <ArrowDownCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Take Discard Pile</span>
              </button>
            </div>
          </div>

          {/* 3. PUKAR POOL (RIGHT) */}
          <div
            aria-label="Pukar Pool"
            className="relative flex flex-col items-center justify-between p-2.5 sm:p-3 rounded-2xl table-well-light min-h-[195px] sm:min-h-[210px]"
          >
            <span className="sr-only">Pukar Pool (Reserve)</span>

            {/* Pukar Stack Visual Graphic */}
            <div className="my-1 flex flex-col items-center justify-center">
              {actualPukarCount > 0 ? (
                <div className="relative flex items-center justify-center w-28 h-32 sm:w-32 sm:h-36">
                  {/* Subtle pedestal platter */}
                  <div className="absolute inset-x-0 bottom-0 h-8 rounded-full bg-stone-300/60 border border-stone-400/40 shadow-inner" />
                  {Array.from({ length: Math.min(actualPukarCount, 4) }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        transform: `translate(${i * 6 - 8}px, ${-i * 5 + 4}px)`,
                      }}
                      className="absolute w-20 h-[120px] sm:w-24 sm:h-[144px] rounded-xl bg-gradient-to-br from-emerald-800 to-teal-900 border-2 border-emerald-400 shadow-lg flex items-center justify-center text-center p-2"
                    >
                      <div className="w-full h-full border border-emerald-300/40 rounded-lg border-dashed flex flex-col items-center justify-center text-xs text-emerald-100">
                        <span className="font-black uppercase tracking-wider text-amber-300 text-sm">Pukar</span>
                        <span className="text-xs font-bold opacity-95">13 Cards</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-20 h-[120px] sm:w-24 sm:h-[144px] rounded-xl border-2 border-dashed border-red-400 bg-red-50 flex flex-col items-center justify-center p-2 text-center text-red-600 text-xs">
                  <span className="font-black text-sm">0 Pukars</span>
                  <span className="text-xs font-semibold text-stone-500 mt-0.5">
                    Exhaust rule active
                  </span>
                </div>
              )}
            </div>

            {/* Pukar Count Status */}
            <div className="flex flex-col items-center gap-0.5 mt-1 text-center w-full">
              <span className="text-xs sm:text-sm font-black text-emerald-800">
                {`${actualPukarCount} ${actualPukarCount === 1 ? 'Pukar' : 'Pukars'} Available`}
              </span>
              <span className="text-xs font-bold text-stone-600">
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
