/**
 * Bot Mode Data Types and Contracts
 * Pure TypeScript with zero DOM/React dependencies.
 */
import { Card, GameAction, Rank, Suit } from '../types';

export type BotPersonality =
  | 'smart_chacha'
  | 'the_jadugar'
  | 'fast_chachi'
  | 'the_long_term_guy';

export interface BotProfile {
  id: BotPersonality;
  name: string;
}

export const BOT_PROFILES: Record<BotPersonality, BotProfile> = {
  smart_chacha: {
    id: 'smart_chacha',
    name: 'Sid',
  },
  the_jadugar: {
    id: 'the_jadugar',
    name: 'Heman',
  },
  fast_chachi: {
    id: 'fast_chachi',
    name: 'Chachi',
  },
  the_long_term_guy: {
    id: 'the_long_term_guy',
    name: 'Harsh',
  },
};

export interface CardLogEntry {
  cardId: string;
  suit: Suit | null;
  rank: Rank;
  playerIndex: number;
  action: 'DISCARD' | 'PICKUP_BOTTOM' | 'MELD';
  timestamp: number;
}

export interface BotMemory {
  // Global log of all cards picked up from bottom and discarded by each player
  cardLog: CardLogEntry[];
  // Cards known to have been taken from discard pile by player index
  bottomPickupsByPlayer: Record<number, Card[]>;
  // Cards discarded by player index
  discardsByPlayer: Record<number, Card[]>;
}

export interface BotTurnPlan {
  drawAction: { type: 'DRAW_FROM_STOCK' } | { type: 'TAKE_DISCARD' };
  meldActions: GameAction[];
  pukarDeckIndex?: number;
  discardAction: { type: 'DISCARD_CARD'; cardId: string };
  reasoning: string;
}

export interface BotSeatConfig {
  seatIndex: number;
  name: string;
  personality: BotPersonality;
  isHuman: boolean;
}

export interface BotGameConfig {
  playerCount: 4 | 6;
  seats: BotSeatConfig[];
}
