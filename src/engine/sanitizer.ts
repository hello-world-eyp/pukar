import { GameState, SanitizedGameState, SanitizedPlayer } from './types';
import { hasTeamOpened } from './meld-validator';

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
    const isRoundOver = Boolean(
      state?.isRoundOver ||
      state?.roundStatus === 'ROUND_OVER' ||
      state?.roundStatus === 'GAME_OVER'
    );

    const sanitizedPlayers: SanitizedPlayer[] = (state?.players ?? []).map((p) => {
      const isViewer = p.id === playerId;
      const revealHand = isViewer || isRoundOver;
      return {
        id: p.id,
        name: p.name,
        team: p.team,
        cardCount: p.hand ? p.hand.length : 0,
        hand: revealHand && p.hand ? p.hand.map((c) => ({ ...c })) : undefined,
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
      roundHistory: state?.roundHistory ? [...state.roundHistory] : [],
      isRoundOver:
        state?.isRoundOver ??
        (state?.roundStatus === 'ROUND_OVER' || state?.roundStatus === 'GAME_OVER'),
      lastPickedUpCard: state?.lastPickedUpCard ? { ...state.lastPickedUpCard } : null,
      newlyPickedUpCardIds:
        isViewerActive && state?.newlyPickedUpCardIds
          ? [...state.newlyPickedUpCardIds]
          : [],
      cardsPickedUpThisTurn:
        isViewerActive && state?.cardsPickedUpThisTurn
          ? [...state.cardsPickedUpThisTurn]
          : [],
      initialHandSizeThisTurn:
        isViewerActive ? state?.initialHandSizeThisTurn : undefined,
      frustrationCooldownUntil: state?.frustrationCooldownUntil,
      activeFrustration: state?.activeFrustration
        ? { ...state.activeFrustration }
        : null,
      matchStats: state?.matchStats
        ? JSON.parse(JSON.stringify(state.matchStats))
        : undefined,
      turnCount: state?.turnCount ?? 1,
      meldCardAdditions: state?.meldCardAdditions ? [...state.meldCardAdditions] : [],
      lastTurnEndedAtTurnByPlayer: state?.lastTurnEndedAtTurnByPlayer
        ? { ...state.lastTurnEndedAtTurnByPlayer }
        : {},
      newMeldCardIds: getNewMeldCardIds(
        state,
        (() => {
          const idx = (state?.players ?? []).findIndex((p) => p.id === playerId);
          return idx >= 0 ? idx : 0;
        })()
      ),
      hasOpened: {
        A: hasTeamOpened(state, 'A'),
        B: hasTeamOpened(state, 'B'),
      },
    };
  } catch (err) {
    console.error('Error in sanitizeStateForPlayer:', err);
    return {
      playerCount: state?.playerCount ?? 4,
      players: [],
      currentPlayerIndex: state?.currentPlayerIndex ?? 0,
      phase: state?.phase ?? state?.turnPhase ?? 'DRAW',
      turnPhase: state?.turnPhase ?? state?.phase ?? 'DRAW',
      stockDeckCount: 0,
      discardPile: [],
      pukarPoolCount: 0,
      melds: { A: [], B: [] },
      scores: { A: 0, B: 0 },
      round: state?.round ?? 1,
      roundStatus: 'PLAYING',
      isRoundOver: false,
      frustrationCooldownUntil: state?.frustrationCooldownUntil,
      activeFrustration: null,
    };
  }
}

/**
 * Calculates which cards currently displayed in table melds are "new" from the perspective of playerIndex.
 * A card is considered new if it was added to a meld (by anyone: partner, opponent, or self)
 * after this player's last turn ended.
 * When the player ends their turn, all previously added cards immediately become normal cards.
 */
export function getNewMeldCardIds(
  state: GameState | SanitizedGameState,
  playerIndex: number
): string[] {
  if (!state) return [];
  const additions = state.meldCardAdditions;
  if (!additions || additions.length === 0) return [];

  const lastEndedTurn = state.lastTurnEndedAtTurnByPlayer?.[playerIndex] ?? 0;

  // Collect all card IDs currently present on the table (melds A and B)
  const meldsA = state.melds?.A ?? [];
  const meldsB = state.melds?.B ?? [];
  const currentTableCardIds = new Set<string>();
  for (const m of meldsA) {
    if (Array.isArray(m?.cards)) {
      for (const c of m.cards) {
        if (c?.id) currentTableCardIds.add(c.id);
      }
    }
  }
  for (const m of meldsB) {
    if (Array.isArray(m?.cards)) {
      for (const c of m.cards) {
        if (c?.id) currentTableCardIds.add(c.id);
      }
    }
  }

  const newCardIds = new Set<string>();
  for (const addition of additions) {
    if (addition.turnNumber > lastEndedTurn && currentTableCardIds.has(addition.cardId)) {
      newCardIds.add(addition.cardId);
    }
  }

  return Array.from(newCardIds);
}
