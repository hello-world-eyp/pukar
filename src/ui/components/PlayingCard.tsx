import React from 'react';
import { Card, Rank, Suit, isWildcard as checkIsWildcard } from '../../engine/types';

export interface PlayingCardProps {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  isSelected?: boolean;
  isNew?: boolean;
  isHighlighted?: boolean;
  isWild?: boolean;
  representedRank?: number;
  representedSuit?: Suit;
  wildcardLabel?: string;
  faceDown?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  showNewBadge?: boolean;
}

export function getRankLabel(rank: Rank | number, isNaturalJoker?: boolean): string {
  if (rank === 0 || isNaturalJoker) return 'JK';
  if (rank === 14 || rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}

export function getSuitSymbol(suit: Suit | null | undefined): string {
  switch (suit) {
    case 'SPADES':
      return '♠';
    case 'HEARTS':
      return '♥';
    case 'DIAMONDS':
      return '♦';
    case 'CLUBS':
      return '♣';
    default:
      return '★';
  }
}

export function isRedSuit(suit: Suit | null | undefined): boolean {
  return suit === 'HEARTS' || suit === 'DIAMONDS';
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  size = 'md',
  isSelected = false,
  isNew,
  isHighlighted,
  isWild,
  representedRank,
  representedSuit,
  wildcardLabel,
  faceDown = false,
  disabled = false,
  onClick,
  className = '',
  showNewBadge = true,
}) => {
  const isCardNew = Boolean(isNew || isHighlighted);
  const isJoker = card.isNaturalJoker || card.rank === 0;
  const naturallyWild = checkIsWildcard(card);
  const actingAsWild = isWild !== undefined ? isWild : naturallyWild;

  // Determine Wildcard Badge text
  let wildBadgeText: string | null = null;
  if (actingAsWild) {
    if (wildcardLabel) {
      wildBadgeText = wildcardLabel;
    } else if (representedRank !== undefined) {
      const repRankStr = getRankLabel(representedRank);
      const repSuitStr = getSuitSymbol(representedSuit ?? card.suit);
      wildBadgeText = `Wild (${repRankStr}${repSuitStr})`;
    } else {
      wildBadgeText = 'Wild';
    }
  }

  const rankStr = getRankLabel(card.rank, isJoker);
  const suitSymbol = getSuitSymbol(card.suit);
  const isRed = isRedSuit(card.suit);

  const [imgLoaded, setImgLoaded] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);
  const [srcIndex, setSrcIndex] = React.useState(0);

  const suitCapitalized = card.suit
    ? card.suit.charAt(0).toUpperCase() + card.suit.slice(1).toLowerCase()
    : '';
  const suitLower = card.suit ? card.suit.toLowerCase() : '';

  const candidateSources = React.useMemo(() => {
    if (isJoker) {
      return ['/cards/joker.png', '/cards/natural_joker.png', '/cards/joker.svg'];
    }
    if (!card.suit) return [];
    return [
      `/cards/${suitCapitalized}/${rankStr}.png`,
      `/cards/${suitCapitalized}/${suitLower}_${rankStr}.png`,
      `/cards/${suitLower}_${rankStr}.png`,
      `/cards/${suitLower}_${rankStr}.svg`,
    ];
  }, [isJoker, card.suit, suitCapitalized, suitLower, rankStr]);

  React.useEffect(() => {
    setSrcIndex(0);
    setImgLoaded(false);
    setImgError(false);
  }, [card.id, card.suit, card.rank]);

  const currentSrc = candidateSources[srcIndex] ?? null;

  const handleImageError = () => {
    try {
      if (srcIndex + 1 < candidateSources.length) {
        setSrcIndex((prev) => prev + 1);
      } else {
        setImgError(true);
      }
    } catch {
      setImgError(true);
    }
  };

  const handleImageLoad = () => {
    try {
      setImgLoaded(true);
    } catch {
      // ignore
    }
  };

  // Size specific styles with precise 2:3 aspect ratio
  const sizeStyles = {
    sm: {
      card: 'w-12 h-[72px] text-[11px] rounded-md shadow-sm',
      cornerRank: 'text-[11px]',
      cornerSuit: 'text-[10px]',
      centerSuit: 'text-base',
      badge: 'text-[8px] px-1 py-0',
      paddings: 'p-1',
    },
    md: {
      card: 'w-20 h-[120px] text-sm rounded-lg shadow-sm',
      cornerRank: 'text-sm font-bold',
      cornerSuit: 'text-xs',
      centerSuit: 'text-2xl',
      badge: 'text-[9px] px-1.5 py-0.5',
      paddings: 'p-1.5',
    },
    lg: {
      card: 'w-28 h-[168px] text-base rounded-xl shadow-md',
      cornerRank: 'text-lg font-bold',
      cornerSuit: 'text-sm',
      centerSuit: 'text-4xl',
      badge: 'text-[10px] px-2 py-0.5',
      paddings: 'p-2',
    },
  }[size];

  // Suit / Rank Color
  const colorClass = isJoker
    ? 'text-amber-600'
    : isRed
    ? 'text-red-600'
    : 'text-slate-900';

  const isClickable = Boolean(onClick) && !disabled;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      try {
        onClick?.();
      } catch (err) {
        console.error('Error invoking PlayingCard onClick via keyboard:', err);
      }
    }
  };

  const handleCardClick = () => {
    if (!isClickable) return;
    try {
      onClick?.();
    } catch (err) {
      console.error('Error invoking PlayingCard onClick:', err);
    }
  };

  const ariaLabel = faceDown
    ? 'Face-down card'
    : isJoker
    ? `Natural Joker${actingAsWild ? ' (Wild)' : ''}${isCardNew ? ' (New)' : ''}`
    : `${rankStr} of ${card.suit ?? 'Unknown'}${actingAsWild ? ' (Wild)' : ''}${isCardNew ? ' (New)' : ''}`;

  if (faceDown) {
    return (
      <div
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={isClickable ? handleCardClick : undefined}
        onKeyDown={isClickable ? handleKeyDown : undefined}
        aria-label={ariaLabel}
        data-new-card={isCardNew ? 'true' : undefined}
        data-is-new={isCardNew ? 'true' : undefined}
        className={`relative select-none flex-shrink-0 transition-transform duration-150 ${sizeStyles.card} ${
          isClickable ? 'cursor-pointer hover:-translate-y-1 hover:shadow-md' : ''
        } ${isSelected ? 'ring-4 ring-amber-400 -translate-y-2' : ''} ${className}`}
      >
        <img
          src="/cards/card_back.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover rounded-[inherit] pointer-events-none select-none z-10"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
        <div className="w-full h-full rounded-[inherit] bg-gradient-to-br from-blue-900 via-indigo-950 to-blue-950 p-1 border border-blue-800 flex items-center justify-center overflow-hidden">
          <div className="w-full h-full rounded-[inherit] border border-blue-400/40 border-dashed flex items-center justify-center bg-blue-900/30">
            <span className="text-blue-300/60 font-serif text-xs font-semibold select-none">
              PUKAR
            </span>
          </div>
        </div>
      </div>
    );
  }

  const isImageActive = imgLoaded && !imgError;

  const borderAndEffectClasses = isSelected
    ? isCardNew
      ? 'border-2 border-emerald-400 ring-4 ring-amber-400 ring-offset-1 border-amber-500 -translate-y-2.5 shadow-lg shadow-emerald-500/30'
      : 'ring-4 ring-amber-400 ring-offset-1 border-amber-500 -translate-y-2.5 shadow-lg'
    : isCardNew
    ? 'border-2 border-emerald-400 ring-2 ring-emerald-400/60 shadow-md shadow-emerald-500/25'
    : actingAsWild
    ? 'border-amber-400 ring-1 ring-amber-300/80 bg-amber-50/30'
    : 'border border-stone-300/80';

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? handleCardClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      aria-label={ariaLabel}
      data-new-card={isCardNew ? 'true' : undefined}
      data-is-new={isCardNew ? 'true' : undefined}
      className={`relative select-none flex-shrink-0 bg-[#FAF7F0] transition-all duration-150 flex flex-col justify-between ${
        sizeStyles.card
      } ${sizeStyles.paddings} ${
        isClickable ? 'cursor-pointer hover:-translate-y-1 hover:shadow-md' : ''
      } ${borderAndEffectClasses} ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      } ${className}`}
    >
      {/* Card Illustration Asset */}
      {currentSrc && !imgError && (
        <img
          src={currentSrc}
          alt=""
          aria-hidden="true"
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`absolute inset-0 w-full h-full object-cover rounded-[inherit] pointer-events-none select-none z-0 transition-opacity duration-200 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Wildcard Badge */}
      {wildBadgeText && (
        <span
          className={`absolute -top-2 left-1/2 -translate-x-1/2 font-bold uppercase rounded-full tracking-wider bg-amber-400 text-amber-950 border border-amber-300 shadow-md whitespace-nowrap z-20 ${sizeStyles.badge}`}
        >
          {wildBadgeText}
        </span>
      )}

      {/* Newly Picked Up Badge */}
      {isCardNew && showNewBadge && !wildBadgeText && (
        <span
          data-testid="new-card-badge"
          className={`absolute -top-2 left-1/2 -translate-x-1/2 font-extrabold uppercase rounded-full tracking-wider bg-emerald-500 text-slate-950 border border-emerald-300 shadow-md whitespace-nowrap z-20 ${sizeStyles.badge}`}
        >
          New
        </span>
      )}

      {/* Top-Left Corner Index */}
      <div
        className={`relative z-10 flex flex-col items-center leading-none ${colorClass} ${
          isImageActive ? 'opacity-0 pointer-events-none select-none' : ''
        }`}
      >
        <span className={sizeStyles.cornerRank}>{rankStr}</span>
        <span className={sizeStyles.cornerSuit}>{suitSymbol}</span>
      </div>

      {/* Center Symbol */}
      <div
        className={`self-center leading-none ${colorClass} ${
          isImageActive ? 'opacity-0 pointer-events-none select-none' : ''
        }`}
      >
        {isJoker ? (
          <div className="flex flex-col items-center">
            <span className={sizeStyles.centerSuit}>★</span>
            {size !== 'sm' && (
              <span className="text-[9px] tracking-tight font-extrabold uppercase text-amber-700">
                Joker
              </span>
            )}
          </div>
        ) : (
          <span className={sizeStyles.centerSuit}>{suitSymbol}</span>
        )}
      </div>

      {/* Bottom-Right Corner Index (Inverted) */}
      <div
        className={`flex flex-col items-center leading-none rotate-180 ${colorClass} ${
          isImageActive ? 'opacity-0 pointer-events-none select-none' : ''
        }`}
      >
        <span className={sizeStyles.cornerRank}>{rankStr}</span>
        <span className={sizeStyles.cornerSuit}>{suitSymbol}</span>
      </div>
    </div>
  );
};
