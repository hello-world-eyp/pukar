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
  try {
    const sanitizedPlayers: SanitizedPlayer[] = (state?.players ?? []).map((p) => {
      const isViewer = p.id === playerId;
      return {
        id: p.id,
        name: p.name,
        team: p.team,
        cardCount: p.hand ? p.hand.length : 0,
        hand: isViewer && p.hand ? p.hand.map((c) => ({ ...c })) : undefined,
      };
    });

    const isViewerActive = Boolean(
      state?.players && state.players[state?.currentPlayerIndex]?.id === playerId
    );

    return {
      playerCount: state?.playerCount ?? 4,
      players: sanitizedPlayers,
      currentPlayerIndex: state?.currentPlayerIndex ?? 0,
      phase: state?.phase ?? 'DRAW',
      turnPhase: state?.phase ?? 'DRAW',
      stockDeckCount: state?.stockDeck ? state.stockDeck.length : 0,
      discardPile: state?.discardPile ? state.discardPile.map((c) => ({ ...c })) : [],
      pukarPoolCount: state?.pukarPool ? state.pukarPool.length : 0,
      melds: {
        A: state?.melds?.A
          ? state.melds.A.map((m) => ({
              ...m,
              cards: m.cards ? m.cards.map((c) => ({ ...c })) : [],
              slots: m.slots ? m.slots.map((s) => ({ ...s, card: { ...s.card } })) : [],
            }))
          : [],
        B: state?.melds?.B
          ? state.melds.B.map((m) => ({
              ...m,
              cards: m.cards ? m.cards.map((c) => ({ ...c })) : [],
              slots: m.slots ? m.slots.map((s) => ({ ...s, card: { ...s.card } })) : [],
            }))
          : [],
      },
      scores: state?.scores ? { ...state.scores } : { A: 0, B: 0 },
      roundScores: state?.roundScores ? { ...state.roundScores } : undefined,
      totalScores: state?.totalScores ? { ...state.totalScores } : undefined,
      pukarsClaimed: state?.pukarsClaimed ? { ...state.pukarsClaimed } : undefined,
      round: state?.round ?? 1,
      roundStatus: state?.roundStatus ?? 'PLAYING',
      isRoundOver:
        state?.isRoundOver ??
        (state?.roundStatus === 'ROUND_OVER' || state?.roundStatus === 'GAME_OVER'),
      lastPickedUpCard: state?.lastPickedUpCard ? { ...state.lastPickedUpCard } : null,
      newlyPickedUpCardIds:
        isViewerActive && state?.newlyPickedUpCardIds
          ? [...state.newlyPickedUpCardIds]
          : [],
    };
  } catch (err) {
    console.error('Error in sanitizeStateForPlayer:', err);
    return {
      playerCount: state?.playerCount ?? 4,
      players: [],
      currentPlayerIndex: state?.currentPlayerIndex ?? 0,
      phase: state?.phase ?? 'DRAW',
      stockDeckCount: 0,
      discardPile: [],
      pukarPoolCount: 0,
      melds: { A: [], B: [] },
      scores: { A: 0, B: 0 },
      round: state?.round ?? 1,
      roundStatus: 'PLAYING',
      isRoundOver: false,
    };
  }
}
