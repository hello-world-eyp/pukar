/**
 * Core data types for Pukar Card Game engine.
 * Pure TypeScript with zero DOM/React dependencies.
 * All state models are 100% JSON-serializable.
 */

export type Suit = 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS';

export const SUITS: readonly Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'] as const;

export type StandardRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export const STANDARD_RANKS: readonly StandardRank[] = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
] as const;

/**
 * Rank 0 represents a Natural Joker.
 * Ranks 2..14 represent standard card ranks (11=Jack, 12=Queen, 13=King, 14=Ace).
 */
export type Rank = StandardRank | 0;

export interface Card {
  id: string;
  suit: Suit | null; // null for Natural Jokers
  rank: Rank; // 0 for Natural Joker, 2..14 for standard cards
  isNaturalJoker?: boolean;
  isJoker?: boolean;
}

export type Team = 'A' | 'B';

export interface Player {
  id: string;
  name: string;
  team: Team;
  hand: Card[];
}

export interface MeldSlot {
  card: Card;
  representedRank: number; // The rank this card represents in the meld (e.g. 5 if 2 is substituting for 5, or 1 for Ace low)
  representedSuit?: Suit; // The suit represented (for runs or wildcards)
  isWildcard?: boolean; // Whether this card acts as a wildcard
}

export type MeldType = 'RUN' | 'SET';

export interface Meld {
  id: string;
  team: Team;
  type: MeldType;
  suit?: Suit; // Defined for RUN melds
  rank?: number; // Defined for SET melds
  cards: Card[];
  slots: MeldSlot[];
  isClean?: boolean;
  isPure13?: boolean;
  points?: number;
}

export type TurnPhase = 'DRAW' | 'MELD' | 'DISCARD';

export type RoundStatus = 'PLAYING' | 'FINAL_TURN' | 'ROUND_OVER' | 'GAME_OVER';

export interface GameState {
  playerCount: 4 | 6;
  players: Player[];
  currentPlayerIndex: number;
  phase: TurnPhase;
  turnPhase?: TurnPhase;
  stockDeck: Card[];
  discardPile: Card[];
  pukarPool: Card[][]; // array of 13-card Pukar decks
  pukars?: Card[][]; // alias for pukarPool
  melds: {
    A: Meld[];
    B: Meld[];
  };
  scores: {
    A: number;
    B: number;
  };
  roundScores?: {
    A: number;
    B: number;
  };
  totalScores?: {
    A: number;
    B: number;
  };
  pukarsClaimed?: {
    A: number;
    B: number;
  };
  round: number;
  roundStatus: RoundStatus;
  isRoundOver?: boolean;
  finalTurnPlayerIndex?: number | null;
  lastTurnTriggeredByDeckExhaust?: boolean;
  lastPickedUpCard?: Card | null;
}

export type GameAction =
  | { type: 'DRAW_FROM_STOCK' }
  | { type: 'TAKE_DISCARD' }
  | { type: 'DRAW_CARD'; source?: 'DECK' | 'STOCK' | 'BOTTOM' | 'DISCARD' }
  | { type: 'PLAY_NEW_MELD'; cardIds: string[]; jokerRepresentedRank?: number }
  | { type: 'ADD_TO_MELD'; meldId: string; cardIds: string[] }
  | { type: 'DISCARD_CARD'; cardId: string }
  | { type: 'START_NEXT_ROUND' }
  | { type: 'RESET_GAME'; playerCount?: 4 | 6 };

export interface GameError {
  code: string;
  message: string;
}

export interface SanitizedPlayer {
  id: string;
  name: string;
  team: Team;
  cardCount: number;
  hand?: Card[];
}

export interface SanitizedGameState {
  playerCount: 4 | 6;
  players: SanitizedPlayer[];
  currentPlayerIndex: number;
  phase: TurnPhase;
  turnPhase?: TurnPhase;
  stockDeckCount: number;
  discardPile: Card[];
  pukarPoolCount: number;
  melds: {
    A: Meld[];
    B: Meld[];
  };
  scores: {
    A: number;
    B: number;
  };
  roundScores?: {
    A: number;
    B: number;
  };
  totalScores?: {
    A: number;
    B: number;
  };
  pukarsClaimed?: {
    A: number;
    B: number;
  };
  round: number;
  roundStatus: RoundStatus;
  isRoundOver?: boolean;
  lastPickedUpCard?: Card | null;
}

/**
 * Returns true if the card is a wildcard in Pukar (Natural Joker or any card of rank 2).
 */
export function isWildcard(card: Card): boolean {
  return card.isNaturalJoker === true || card.rank === 0 || card.rank === 2;
}

/**
 * Returns true if the card is a Natural Joker (rank 0 / null suit).
 */
export function isNaturalJoker(card: Card): boolean {
  return card.isNaturalJoker === true || card.rank === 0;
}
