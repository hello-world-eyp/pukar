import {
  Card,
  GameState,
  Player,
  SUITS,
  STANDARD_RANKS,
} from './types';

/**
 * Creates standard decks plus 3 natural jokers per deck for the specified player count.
 * 4 players: 2 standard decks of 52 + 3 jokers each = 110 cards.
 * 6 players: 3 standard decks of 52 + 3 jokers each = 165 cards.
 */
export function createDecks(playerCount: 4 | 6): Card[] {
  if (playerCount !== 4 && playerCount !== 6) {
    throw new Error(`Invalid player count: ${playerCount}. Pukar requires 4 or 6 players.`);
  }

  const numDecks = playerCount === 4 ? 2 : 3;
  const cards: Card[] = [];

  for (let d = 0; d < numDecks; d++) {
    // 52 standard cards per deck
    for (const suit of SUITS) {
      for (const rank of STANDARD_RANKS) {
        cards.push({
          id: `deck-${d}-${suit}-${rank}`,
          suit,
          rank,
          isNaturalJoker: false,
          isJoker: false,
        });
      }
    }

    // 3 Natural Jokers per deck
    for (let j = 0; j < 3; j++) {
      cards.push({
        id: `deck-${d}-JOKER-${j}`,
        suit: null,
        rank: 0,
        isNaturalJoker: true,
        isJoker: true,
      });
    }
  }

  return cards;
}

/**
 * Shuffles an array of cards using the Fisher-Yates algorithm.
 * Returns a new array, preserving the original array without mutation.
 */
export function shuffleDeck(cards: Card[]): Card[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deals the initial game state for a new round of Pukar.
 *
 * Rules:
 * - 4 players: 2 decks (110 cards), 2 Pukar decks of 13 cards.
 * - 6 players: 3 decks (165 cards), 3 Pukar decks of 13 cards.
 * - Hands: exactly 13 cards dealt to each player.
 * - Seating: alternates teams (P1: Team A, P2: Team B, P3: Team A, P4: Team B, ...).
 * - Discard Pile ("The Bottom"): 1 card turned face-up from remaining deck.
 * - Stock Deck: remainder of cards (31 for 4p, 47 for 6p).
 */
export function dealInitialState(playerCount: 4 | 6, customDeck?: Card[]): GameState {
  if (playerCount !== 4 && playerCount !== 6) {
    throw new Error(`Invalid player count: ${playerCount}. Pukar requires 4 or 6 players.`);
  }

  const deck = customDeck ? [...customDeck] : shuffleDeck(createDecks(playerCount));

  // 1. Create players and deal 13 cards to each player's hand
  const players: Player[] = [];
  for (let i = 0; i < playerCount; i++) {
    const hand = deck.splice(0, 13);
    players.push({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      team: i % 2 === 0 ? 'A' : 'B',
      hand,
    });
  }

  // 2. Create Pukar pool (13 cards per Pukar pile)
  const pukarCount = playerCount === 4 ? 2 : 3;
  const pukarPool: Card[][] = [];
  for (let i = 0; i < pukarCount; i++) {
    pukarPool.push(deck.splice(0, 13));
  }

  // 3. Flip 1 card face-up to initialize Discard Pile ("The Bottom")
  const firstDiscard = deck.shift();
  if (!firstDiscard) {
    throw new Error('Insufficient cards in deck to initialize discard pile.');
  }
  const discardPile: Card[] = [firstDiscard];

  // 4. Remaining cards form the face-down Stock Deck
  const stockDeck: Card[] = deck;

  return {
    playerCount,
    players,
    currentPlayerIndex: 0,
    phase: 'DRAW',
    stockDeck,
    discardPile,
    pukarPool,
    pukars: pukarPool,
    melds: {
      A: [],
      B: [],
    },
    scores: {
      A: 0,
      B: 0,
    },
    round: 1,
    roundStatus: 'PLAYING',
    finalTurnPlayerIndex: null,
  };
}
