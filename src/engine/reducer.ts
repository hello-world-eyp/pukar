import {
  Card,
  GameAction,
  GameState,
  Meld,
  RoundStatus,
  TurnPhase,
} from './types';
import { dealInitialState, shuffleDeck } from './deck';
import {
  validateNewMeld,
  canAddCardsToMeld,
  evaluateMeldScore,
} from './meld-validator';

/**
 * Calculates end-of-round points for both teams based on melds on the table
 * and claimed Pukars (+50 points each).
 */
function calculateRoundEndScores(state: GameState): {
  roundScores: { A: number; B: number };
  totalScores: { A: number; B: number };
} {
  try {
    const pukarsA = state.pukarsClaimed?.A ?? 0;
    const pukarsB = state.pukarsClaimed?.B ?? 0;

    const meldPointsA = (state.melds?.A ?? []).reduce(
      (sum, m) => {
        try {
          return sum + (m.points ?? evaluateMeldScore(m).points);
        } catch {
          return sum;
        }
      },
      0
    );
    const meldPointsB = (state.melds?.B ?? []).reduce(
      (sum, m) => {
        try {
          return sum + (m.points ?? evaluateMeldScore(m).points);
        } catch {
          return sum;
        }
      },
      0
    );

    const roundScoreA = meldPointsA + pukarsA * 50;
    const roundScoreB = meldPointsB + pukarsB * 50;

    // Base total from prior rounds (subtracting any mid-round Pukars already added to totalScores during this round)
    const baseTotalA = state.totalScores ? state.totalScores.A - pukarsA * 50 : 0;
    const baseTotalB = state.totalScores ? state.totalScores.B - pukarsB * 50 : 0;

    return {
      roundScores: { A: roundScoreA, B: roundScoreB },
      totalScores: { A: baseTotalA + roundScoreA, B: baseTotalB + roundScoreB },
    };
  } catch (err) {
    console.error('Error calculating round end scores:', err);
    return {
      roundScores: { A: 0, B: 0 },
      totalScores: state.totalScores ? { ...state.totalScores } : { A: 0, B: 0 },
    };
  }
}

/**
 * Pure game engine reducer for Pukar Card Game.
 * Deterministic, immutable state transitions with zero DOM/React dependencies.
 */
export function pukarReducer(
  state: GameState,
  action: GameAction
): { state: GameState; error?: string } {
  try {
    if (!state) {
      return { state, error: 'Cannot reduce undefined game state' };
    }
    if (!action || !action.type) {
      return { state, error: 'Invalid or missing action' };
    }

    switch (action.type) {
      case 'DRAW_FROM_STOCK':
      case 'DRAW_CARD': {
        const source =
          action.type === 'DRAW_CARD' ? action.source ?? 'DECK' : 'DECK';

        if (source === 'BOTTOM' || source === 'DISCARD') {
          return handleTakeDiscard(state);
        } else {
          return handleDrawFromStock(state);
        }
      }

      case 'TAKE_DISCARD': {
        return handleTakeDiscard(state);
      }

      case 'PLAY_NEW_MELD': {
        return handlePlayNewMeld(
          state,
          action.cardIds,
          action.jokerRepresentedRank
        );
      }

      case 'ADD_TO_MELD': {
        return handleAddToMeld(state, action.meldId, action.cardIds);
      }

      case 'DISCARD_CARD': {
        return handleDiscardCard(state, action.cardId);
      }

      case 'START_NEXT_ROUND': {
        return handleStartNextRound(state);
      }

      case 'RESET_GAME': {
        return handleResetGame(state, action.playerCount);
      }

      default:
        return {
          state,
          error: `Unknown action type: ${(action as any).type}`,
        };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`Reducer error processing action ${action?.type}:`, err);
    return {
      state,
      error: `Reducer error: ${errorMsg}`,
    };
  }
}

function handleDrawFromStock(state: GameState): {
  state: GameState;
  error?: string;
} {
  if (state.roundStatus === 'ROUND_OVER' || state.roundStatus === 'GAME_OVER') {
    return { state, error: 'Cannot draw: round is already over' };
  }
  if (state.phase !== 'DRAW') {
    return { state, error: `Cannot draw: current phase is ${state.phase}` };
  }
  if (state.stockDeck.length === 0) {
    return { state, error: 'Stock deck is empty' };
  }

  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer || !Array.isArray(activePlayer.hand)) {
    return { state, error: 'Active player not found' };
  }

  const drawnCard = state.stockDeck[0];
  let remainingStock = state.stockDeck.slice(1);
  let pukarPool = [...state.pukarPool];
  let lastTurnTriggeredByDeckExhaust = state.lastTurnTriggeredByDeckExhaust ?? false;

  // Stock deck exhaustion handling
  if (remainingStock.length === 0) {
    if (pukarPool.length >= 1) {
      // Pop 1 Pukar to become new Stock deck (shuffled per Spec Section 3.5)
      remainingStock = shuffleDeck(pukarPool[0]);
      pukarPool = pukarPool.slice(1);
    } else {
      // Deck exhausted with 0 Pukars: trigger final turn flag
      lastTurnTriggeredByDeckExhaust = true;
    }
  }

  const updatedPlayers = state.players.map((p, idx) => {
    if (idx !== state.currentPlayerIndex) return p;
    return {
      ...p,
      hand: [...p.hand, drawnCard],
    };
  });

  const nextState: GameState = {
    ...state,
    stockDeck: remainingStock,
    pukarPool,
    pukars: pukarPool,
    players: updatedPlayers,
    phase: 'MELD',
    turnPhase: 'MELD',
    lastTurnTriggeredByDeckExhaust,
    lastPickedUpCard: null,
    newlyPickedUpCardIds: [drawnCard.id],
  };

  return { state: nextState };
}

function handleTakeDiscard(state: GameState): {
  state: GameState;
  error?: string;
} {
  if (state.roundStatus === 'ROUND_OVER' || state.roundStatus === 'GAME_OVER') {
    return { state, error: 'Cannot draw: round is already over' };
  }
  if (state.phase !== 'DRAW') {
    return { state, error: `Cannot draw: current phase is ${state.phase}` };
  }
  if (state.discardPile.length === 0) {
    return { state, error: 'Discard pile is empty' };
  }

  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer || !Array.isArray(activePlayer.hand)) {
    return { state, error: 'Active player not found' };
  }

  const cardsFromDiscard = [...state.discardPile];
  const updatedPlayers = state.players.map((p, idx) => {
    if (idx !== state.currentPlayerIndex) return p;
    return {
      ...p,
      hand: [...p.hand, ...cardsFromDiscard],
    };
  });

  const nextState: GameState = {
    ...state,
    discardPile: [],
    players: updatedPlayers,
    phase: 'MELD',
    turnPhase: 'MELD',
    lastPickedUpCard: null,
    newlyPickedUpCardIds: cardsFromDiscard.map((c) => c.id),
  };

  return { state: nextState };
}

function handlePlayNewMeld(
  state: GameState,
  cardIds: string[],
  jokerRepresentedRank?: number
): { state: GameState; error?: string } {
  if (state.roundStatus === 'ROUND_OVER' || state.roundStatus === 'GAME_OVER') {
    return { state, error: 'Cannot meld: round is already over' };
  }
  if (state.phase !== 'MELD') {
    return { state, error: `Cannot meld: current phase is ${state.phase}` };
  }
  if (!Array.isArray(cardIds) || cardIds.length < 3) {
    return { state, error: 'A meld requires at least 3 cards' };
  }
  if (new Set(cardIds).size !== cardIds.length) {
    return { state, error: 'Duplicate card IDs are not allowed' };
  }

  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer || !Array.isArray(activePlayer.hand)) {
    return { state, error: 'Active player not found' };
  }

  const handCardMap = new Map<string, Card>(activePlayer.hand.map((c) => [c.id, c]));
  const cardsToMeld: Card[] = [];

  for (const id of cardIds) {
    const card = handCardMap.get(id);
    if (!card) {
      return { state, error: `Player hand does not contain card ${id}` };
    }
    cardsToMeld.push(card);
  }

  const meldValidation = validateNewMeld(cardsToMeld, jokerRepresentedRank);
  if (!meldValidation.valid || !meldValidation.slots || !meldValidation.type) {
    return { state, error: meldValidation.error || 'Cards do not form a valid meld' };
  }

  const cardIdSet = new Set(cardIds);
  const remainingHand = activePlayer.hand.filter((c) => !cardIdSet.has(c.id));

  const team = activePlayer.team;
  const meldId = `meld-r${state.round}-${team}-${(state.melds[team]?.length || 0) + 1}`;
  const scoreInfo = evaluateMeldScore({
    id: meldId,
    team,
    type: meldValidation.type,
    suit: meldValidation.suit,
    cards: cardsToMeld,
    slots: meldValidation.slots,
  });

  const newMeld: Meld = {
    id: meldId,
    team,
    type: meldValidation.type,
    suit: meldValidation.suit,
    cards: cardsToMeld,
    slots: meldValidation.slots,
    points: scoreInfo.points,
  };

  const updatedMelds = {
    ...state.melds,
    [team]: [...state.melds[team], newMeld],
  };

  return handlePostMeldState(state, remainingHand, updatedMelds);
}

function handleAddToMeld(
  state: GameState,
  meldId: string,
  cardIds: string[]
): { state: GameState; error?: string } {
  if (state.roundStatus === 'ROUND_OVER' || state.roundStatus === 'GAME_OVER') {
    return { state, error: 'Cannot meld: round is already over' };
  }
  if (state.phase !== 'MELD') {
    return { state, error: `Cannot add to meld: current phase is ${state.phase}` };
  }
  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    return { state, error: 'Must select at least 1 card to add to meld' };
  }
  if (new Set(cardIds).size !== cardIds.length) {
    return { state, error: 'Duplicate card IDs are not allowed' };
  }

  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer || !Array.isArray(activePlayer.hand)) {
    return { state, error: 'Active player not found' };
  }

  const team = activePlayer.team;
  const opponentTeam = team === 'A' ? 'B' : 'A';

  if (state.melds[opponentTeam].some((m) => m.id === meldId)) {
    return { state, error: "Cannot add cards to opponent team's meld" };
  }

  const existingMeld = state.melds[team].find((m) => m.id === meldId);
  if (!existingMeld) {
    return { state, error: `Meld ${meldId} not found on team ${team}'s board` };
  }

  const handCardMap = new Map<string, Card>(activePlayer.hand.map((c) => [c.id, c]));
  const cardsToAdd: Card[] = [];

  for (const id of cardIds) {
    const card = handCardMap.get(id);
    if (!card) {
      return { state, error: `Player hand does not contain card ${id}` };
    }
    cardsToAdd.push(card);
  }

  const validation = canAddCardsToMeld(existingMeld, cardsToAdd);
  if (!validation.valid || !validation.updatedSlots) {
    return { state, error: validation.error || 'Cannot add cards to meld' };
  }

  const cardIdSet = new Set(cardIds);
  let remainingHand = activePlayer.hand.filter((c) => !cardIdSet.has(c.id));

  // If a Normal Joker was replaced in the meld, it is auto picked up into player's hand!
  if (validation.pickedUpCard) {
    remainingHand = [...remainingHand, validation.pickedUpCard];
  }

  const meldCardsWithoutPickedUp = validation.pickedUpCard
    ? existingMeld.cards.filter((c) => c.id !== validation.pickedUpCard!.id)
    : existingMeld.cards;

  const updatedMeld: Meld = {
    ...existingMeld,
    cards: [...meldCardsWithoutPickedUp, ...cardsToAdd],
    slots: validation.updatedSlots,
  };
  updatedMeld.points = evaluateMeldScore(updatedMeld).points;

  const updatedMelds = {
    ...state.melds,
    [team]: state.melds[team].map((m) => (m.id === meldId ? updatedMeld : m)),
  };

  const postResult = handlePostMeldState(state, remainingHand, updatedMelds);
  if (validation.pickedUpCard) {
    postResult.state = {
      ...postResult.state,
      lastPickedUpCard: validation.pickedUpCard,
      newlyPickedUpCardIds: [
        ...(postResult.state.newlyPickedUpCardIds ?? []),
        validation.pickedUpCard.id,
      ],
    };
  }
  return postResult;
}

/**
 * Handles post-meld transitions: Pukar claims (+50 pts) or going out.
 */
function handlePostMeldState(
  state: GameState,
  remainingHand: Card[],
  updatedMelds: { A: Meld[]; B: Meld[] }
): { state: GameState; error?: string } {
  const activePlayer = state.players[state.currentPlayerIndex];
  const team = activePlayer.team;
  let pukarPool = [...state.pukarPool];
  let scores = { ...state.scores };
  let roundScores = {
    A: state.roundScores?.A ?? 0,
    B: state.roundScores?.B ?? 0,
  };
  let totalScores = state.totalScores ? { ...state.totalScores } : undefined;
  let pukarsClaimed = {
    A: state.pukarsClaimed?.A ?? 0,
    B: state.pukarsClaimed?.B ?? 0,
  };

  let updatedHand = remainingHand;
  let roundStatus: RoundStatus = state.roundStatus;
  let isRoundOver = state.isRoundOver ?? false;
  let newlyPickedUpCardIds = (state.newlyPickedUpCardIds ?? []).filter((id) =>
    updatedHand.some((c) => c.id === id)
  );

  // Check if active player's hand reached 0
  if (remainingHand.length === 0) {
    if (pukarPool.length >= 1) {
      // Immediate Pukar claim into hand (+50 pts, keep in MELD phase)
      const claimedPukar = pukarPool[0];
      pukarPool = pukarPool.slice(1);
      updatedHand = [...claimedPukar];
      newlyPickedUpCardIds = claimedPukar.map((c) => c.id);

      scores[team] += 50;
      roundScores[team] += 50;
      if (totalScores) {
        totalScores[team] += 50;
      }
      pukarsClaimed[team] += 1;
    } else {
      // Hand emptied with 0 Pukars remaining: Player went out!
      roundStatus = 'ROUND_OVER';
      isRoundOver = true;
      newlyPickedUpCardIds = [];
    }
  }

  const updatedPlayers = state.players.map((p, idx) => {
    if (idx !== state.currentPlayerIndex) return p;
    return {
      ...p,
      hand: updatedHand,
    };
  });

  let nextState: GameState = {
    ...state,
    players: updatedPlayers,
    melds: updatedMelds,
    pukarPool,
    pukars: pukarPool,
    scores,
    roundScores,
    ...(totalScores ? { totalScores } : {}),
    pukarsClaimed,
    roundStatus,
    isRoundOver,
    newlyPickedUpCardIds,
  };

  if (isRoundOver) {
    const finalScores = calculateRoundEndScores(nextState);
    nextState = {
      ...nextState,
      roundScores: finalScores.roundScores,
      scores: finalScores.totalScores,
      totalScores: finalScores.totalScores,
    };
  }

  return { state: nextState };
}

function handleDiscardCard(
  state: GameState,
  cardId: string
): { state: GameState; error?: string } {
  if (state.roundStatus === 'ROUND_OVER' || state.roundStatus === 'GAME_OVER') {
    return { state, error: 'Cannot discard: round is already over' };
  }
  if (state.phase === 'DRAW') {
    return { state, error: 'Cannot discard during DRAW phase' };
  }
  if (typeof cardId !== 'string' || !cardId.trim()) {
    return { state, error: 'Invalid or missing cardId to discard' };
  }

  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer || !Array.isArray(activePlayer.hand)) {
    return { state, error: 'Active player not found' };
  }

  const cardIndex = activePlayer.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    return { state, error: `Card ${cardId} is not in active player hand` };
  }

  const discardedCard = activePlayer.hand[cardIndex];
  let remainingHand = [
    ...activePlayer.hand.slice(0, cardIndex),
    ...activePlayer.hand.slice(cardIndex + 1),
  ];
  const updatedDiscardPile = [...state.discardPile, discardedCard];
  const team = activePlayer.team;
  let pukarPool = [...state.pukarPool];
  let scores = { ...state.scores };
  let roundScores = {
    A: state.roundScores?.A ?? 0,
    B: state.roundScores?.B ?? 0,
  };
  let totalScores = state.totalScores ? { ...state.totalScores } : undefined;
  let pukarsClaimed = {
    A: state.pukarsClaimed?.A ?? 0,
    B: state.pukarsClaimed?.B ?? 0,
  };

  let roundStatus: RoundStatus = state.roundStatus;
  let isRoundOver = state.isRoundOver ?? false;

  let newlyPickedUpCardIds: string[] = [];

  // Check if hand reaches 0 upon discard
  let claimedPukarMidDiscard = false;
  if (remainingHand.length === 0) {
    if (pukarPool.length >= 1) {
      // Claim Pukar into hand (+50 pts). Turn DOES NOT END!
      const claimedPukar = pukarPool[0];
      pukarPool = pukarPool.slice(1);
      remainingHand = [...claimedPukar];
      newlyPickedUpCardIds = claimedPukar.map((c) => c.id);

      scores[team] += 50;
      roundScores[team] += 50;
      if (totalScores) {
        totalScores[team] += 50;
      }
      pukarsClaimed[team] += 1;
      claimedPukarMidDiscard = true;
    } else {
      // Hand emptied with 0 Pukars remaining: Player went out!
      roundStatus = 'ROUND_OVER';
      isRoundOver = true;
    }
  }

  // Check final turn completion (only if player didn't claim a Pukar to continue)
  if (!isRoundOver && state.roundStatus === 'FINAL_TURN' && !claimedPukarMidDiscard) {
    roundStatus = 'ROUND_OVER';
    isRoundOver = true;
  }

  let nextPlayerIndex = state.currentPlayerIndex;
  let nextPhase: TurnPhase = state.phase;
  let finalTurnPlayerIndex = state.finalTurnPlayerIndex ?? null;

  if (!isRoundOver) {
    if (claimedPukarMidDiscard) {
      // Turn DOES NOT END when claiming a Pukar.
      // The player receives 13 cards and continues playing in MELD phase (no need to draw).
      // They must drop another card to finish their turn.
      nextPlayerIndex = state.currentPlayerIndex;
      nextPhase = 'MELD';
    } else {
      nextPlayerIndex = (state.currentPlayerIndex + 1) % state.playerCount;
      nextPhase = 'DRAW';

      if (state.lastTurnTriggeredByDeckExhaust && roundStatus === 'PLAYING') {
        roundStatus = 'FINAL_TURN';
        finalTurnPlayerIndex = nextPlayerIndex;
      }
    }
  }

  const updatedPlayers = state.players.map((p, idx) => {
    if (idx !== state.currentPlayerIndex) return p;
    return {
      ...p,
      hand: remainingHand,
    };
  });

  let nextState: GameState = {
    ...state,
    players: updatedPlayers,
    discardPile: updatedDiscardPile,
    pukarPool,
    pukars: pukarPool,
    scores,
    roundScores,
    ...(totalScores ? { totalScores } : {}),
    pukarsClaimed,
    currentPlayerIndex: nextPlayerIndex,
    phase: nextPhase,
    turnPhase: nextPhase,
    roundStatus,
    isRoundOver,
    finalTurnPlayerIndex,
    lastPickedUpCard: null,
    newlyPickedUpCardIds,
  };

  if (isRoundOver) {
    const finalScores = calculateRoundEndScores(nextState);
    nextState = {
      ...nextState,
      roundScores: finalScores.roundScores,
      scores: finalScores.totalScores,
      totalScores: finalScores.totalScores,
    };
  }

  return { state: nextState };
}

function handleStartNextRound(state: GameState): {
  state: GameState;
  error?: string;
} {
  if (!state.isRoundOver && state.roundStatus !== 'ROUND_OVER') {
    return {
      state,
      error: 'Cannot start next round: current round is not over',
    };
  }

  const preservedScores = { ...state.scores };
  const freshState = dealInitialState(state.playerCount);

  const nextState: GameState = {
    ...freshState,
    round: state.round + 1,
    scores: preservedScores,
    totalScores: preservedScores,
    roundScores: { A: 0, B: 0 },
    pukarsClaimed: { A: 0, B: 0 },
    roundStatus: 'PLAYING',
    isRoundOver: false,
    phase: 'DRAW',
    turnPhase: 'DRAW',
    lastPickedUpCard: null,
    newlyPickedUpCardIds: [],
  };

  return { state: nextState };
}

function handleResetGame(
  state: GameState,
  playerCount?: 4 | 6
): { state: GameState; error?: string } {
  const count = playerCount ?? state?.playerCount ?? 4;
  if (count !== 4 && count !== 6) {
    return {
      state,
      error: `Invalid player count: ${count}. Pukar requires 4 or 6 players.`,
    };
  }
  const freshState = dealInitialState(count);

  const nextState: GameState = {
    ...freshState,
    round: 1,
    scores: { A: 0, B: 0 },
    totalScores: { A: 0, B: 0 },
    roundScores: { A: 0, B: 0 },
    pukarsClaimed: { A: 0, B: 0 },
    roundStatus: 'PLAYING',
    isRoundOver: false,
    phase: 'DRAW',
    turnPhase: 'DRAW',
    lastPickedUpCard: null,
    newlyPickedUpCardIds: [],
  };

  return { state: nextState };
}
