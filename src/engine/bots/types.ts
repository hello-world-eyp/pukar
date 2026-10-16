/**
 * Bot Mode Data Types and Contracts
 * Pure TypeScript with zero DOM/React dependencies.
 */
import { Card, GameAction, Rank, Suit } from '../types';

export type BotPersonality =
  | 'smart_chacha'
  | 'the_jadugar'
  | 'fast_chachi'
  | 'the_long_term_guy'
  | 'cheetah';

export interface BotProfile {
  id: BotPersonality;
  name: string;
  title: string;
  badge?: string;
  description: string;
}

export const BOT_PROFILES: Record<BotPersonality, BotProfile> = {
  smart_chacha: {
    id: 'smart_chacha',
    name: 'Sid',
    title: 'Smart Chacha',
    badge: '🧠 Strategic Defense',
    description: 'Master of lockdown defense. Protects clean runs and strictly prevents opponents from advancing when they hold 1–2 cards.',
  },
  the_jadugar: {
    id: 'the_jadugar',
    name: 'Heman',
    title: 'The Jadugar',
    badge: '⚡ Quick Melds',
    description: 'Speed-runner who builds rapid 3-card melds, keeps deadwood to a minimum, and dumps cards quickly.',
  },
  fast_chachi: {
    id: 'fast_chachi',
    name: 'Chachi',
    title: 'Fast Chachi',
    badge: '👑 Extreme Cards',
    description: 'Aggressive card hoarder who loves building around extreme cards (3s, Kings, Aces) with a safe 14-card ceiling.',
  },
  the_long_term_guy: {
    id: 'the_long_term_guy',
    name: 'Harsh',
    title: 'The Long-Term Guy',
    badge: '🎯 7+ Card Runs',
    description: 'Patient master strategist who holds cards in reserve to construct massive 7+ card runs worth 200+ points.',
  },
  cheetah: {
    id: 'cheetah',
    name: 'Cheetah',
    title: 'The Hyper-Speed Rusher',
    badge: '⚡ 30% Faster',
    description: 'Plays 30% faster than other bots. Aggressively rushes to Pukar with high-tempo melding and ignores defensive stall.',
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
