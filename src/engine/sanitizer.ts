import { GameState, SanitizedGameState, SanitizedPlayer } from './types';

/**
 * Sanitizes the game state for a specific player perspective.
 * Masks opponents' hands (exposing only card counts) and face-down stock/pukar deck contents.
 * Public information (discard pile, team melds on table, scores, round status) remains fully visible.
 */
export function sanitizeStateForPlayer(
  state: GameState,
  playerId: string
): SanitizedGameState {
  const sanitizedPlayers: SanitizedPlayer[] = state.players.map((p) => {
    const isViewer = p.id === playerId;
    return {
      id: p.id,
      name: p.name,
      team: p.team,
      cardCount: p.hand.length,
      hand: isViewer ? [...p.hand] : undefined,
    };
  });

  return {
    playerCount: state.playerCount,
    players: sanitizedPlayers,
    currentPlayerIndex: state.currentPlayerIndex,
    phase: state.phase,
    turnPhase: state.phase,
    stockDeckCount: state.stockDeck.length,
    discardPile: [...state.discardPile],
    pukarPoolCount: state.pukarPool.length,
    melds: {
      A: [...state.melds.A],
      B: [...state.melds.B],
    },
    scores: { ...state.scores },
    roundScores: state.roundScores ? { ...state.roundScores } : undefined,
    totalScores: state.totalScores ? { ...state.totalScores } : undefined,
    pukarsClaimed: state.pukarsClaimed ? { ...state.pukarsClaimed } : undefined,
    round: state.round,
    roundStatus: state.roundStatus,
    isRoundOver:
      state.isRoundOver ??
      (state.roundStatus === 'ROUND_OVER' || state.roundStatus === 'GAME_OVER'),
  };
}
