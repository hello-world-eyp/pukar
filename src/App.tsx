import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  GameState,
  GameAction,
  Meld,
  Card,
  isNaturalJoker,
} from './engine/types';
import { dealInitialState } from './engine/deck';
import { pukarReducer } from './engine/reducer';
import {
  getRunCandidateOptions,
  getAddToRunCandidateOptions,
  JokerOption,
} from './engine/meld-validator';
import { ScoreBoard } from './ui/components/ScoreBoard';
import { TableMeldBoard } from './ui/components/TableMeldBoard';
import { CenterTable } from './ui/components/CenterTable';
import { PlayerHand } from './ui/components/PlayerHand';
import { ActionControls } from './ui/components/ActionControls';
import { DevInspector } from './ui/components/DevInspector';
import { RoundSummaryModal } from './ui/components/RoundSummaryModal';
import { DiscardPileModal } from './ui/components/DiscardPileModal';
import { JokerPromptModal } from './ui/components/JokerPromptModal';
import { TableSeating } from './ui/components/TableSeating';
import { SequenceZoomModal } from './ui/components/SequenceZoomModal';
import { PukarSlamOverlay } from './ui/components/PukarSlamOverlay';
import { playSound, setSoundEnabled } from './ui/sound';
import {
  RotateCcw,
  HelpCircle,
  Sparkles,
  Shield,
  AlertCircle,
  X,
  Trophy,
  Info,
} from 'lucide-react';

export function App() {
  // ---------------------------------------------------------------------------
  // Core Game State
  // ---------------------------------------------------------------------------
  const [gameState, setGameState] = useState<GameState>(() => dealInitialState(4));

  // Selection state
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectedMeldId, setSelectedMeldId] = useState<string | null>(null);

  // Perspective / Hot-seat view state (null = follow active turn)
  const [viewedPlayerIndex, setViewedPlayerIndex] = useState<number | null>(null);

  // UI Modals & Panels
  const [isGodModeOpen, setIsGodModeOpen] = useState(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetPlayerCount, setResetPlayerCount] = useState<4 | 6>(4);
  const [zoomedMeld, setZoomedMeld] = useState<Meld | null>(null);

  // Audio mute
  const [isMuted, setIsMuted] = useState(false);

  // Notifications & Feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pukarBanner, setPukarBanner] = useState<{
    team: 'A' | 'B';
    playerName: string;
    points: number;
  } | null>(null);
  const [pukarSlamEvent, setPukarSlamEvent] = useState<{
    team: 'A' | 'B';
    playerName: string;
    points: number;
  } | null>(null);
  const [isTableRippling, setIsTableRippling] = useState(false);
  const [exhaustNotification, setExhaustNotification] = useState<string | null>(null);
  const [jokerPickupBanner, setJokerPickupBanner] = useState<{
    playerName: string;
  } | null>(null);

  // Joker Selection Prompt Modal State
  const [jokerPromptData, setJokerPromptData] = useState<{
    isOpen: boolean;
    options: JokerOption[];
    cardIds: string[];
    targetMeldId?: string;
  } | null>(null);

  // Auto-dismiss error message after 4.5 seconds
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => {
      setErrorMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  // Sync audio toggle with sound utility
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      setSoundEnabled(!next);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Active vs Viewed Player Resolution
  // ---------------------------------------------------------------------------
  const activeTurnIndex = gameState.currentPlayerIndex;
  const activePlayer = gameState.players[activeTurnIndex];

  // The player whose hand is currently rendered on screen
  const currentViewIndex = viewedPlayerIndex ?? activeTurnIndex;
  const viewingPlayer = gameState.players[currentViewIndex] ?? activePlayer;
  const isViewingActivePlayer = currentViewIndex === activeTurnIndex;

  // Selected cards in current hand
  const selectedCards: Card[] = useMemo(() => {
    try {
      if (!selectedCardIds || selectedCardIds.length === 0) return [];
      const idSet = new Set(selectedCardIds);
      return (viewingPlayer.hand ?? []).filter((c) => idSet.has(c.id));
    } catch {
      return [];
    }
  }, [selectedCardIds, viewingPlayer.hand]);

  // Selected meld object
  const selectedMeld: Meld | null = useMemo(() => {
    try {
      if (!selectedMeldId) return null;
      const allMelds = [...(gameState.melds?.A ?? []), ...(gameState.melds?.B ?? [])];
      return allMelds.find((m) => m.id === selectedMeldId) ?? null;
    } catch (err) {
      console.error('Error resolving selected meld:', err);
      return null;
    }
  }, [selectedMeldId, gameState.melds]);

  // ---------------------------------------------------------------------------
  // Action Dispatcher with Feedback & Audio Cues
  // ---------------------------------------------------------------------------
  const handleAction = useCallback(
    (action: GameAction): boolean => {
      try {
        const prevPukarsA = gameState.pukarsClaimed?.A ?? 0;
        const prevPukarsB = gameState.pukarsClaimed?.B ?? 0;
        const prevStockCount = gameState.stockDeck?.length ?? 0;
        const prevPukarPoolCount = gameState.pukarPool?.length ?? 0;

        const result = pukarReducer(gameState, action);

        if (result.error) {
          setErrorMessage(result.error);
          try {
            playSound('error');
          } catch {}
          return false;
        }

        const next = result.state;

        // Detect Pukar claim (+50 pts)
        const nextPukarsA = next.pukarsClaimed?.A ?? 0;
        const nextPukarsB = next.pukarsClaimed?.B ?? 0;
        if (nextPukarsA > prevPukarsA || nextPukarsB > prevPukarsB) {
          const claimingTeam: 'A' | 'B' = nextPukarsA > prevPukarsA ? 'A' : 'B';
          const actor = gameState.players[gameState.currentPlayerIndex];
          const pukarInfo: { team: 'A' | 'B'; playerName: string; points: number } = {
            team: claimingTeam,
            playerName: actor?.name ?? `Player ${gameState.currentPlayerIndex + 1}`,
            points: 50,
          };
          setPukarBanner(pukarInfo);
          setPukarSlamEvent(pukarInfo);
          setIsTableRippling(true);
          setTimeout(() => setIsTableRippling(false), 1400);
          try {
            playSound('pukar');
          } catch {}
        }
        // Detect Stock Deck replenishment from Pukar pool
        else if (prevStockCount === 1 && prevPukarPoolCount > (next.pukarPool?.length ?? 0)) {
          setExhaustNotification(
            'Stock deck was empty! 1 Pukar deck (13 cards) was placed into the Stock deck.'
          );
          try {
            playSound('draw');
          } catch {}
        }
        // Detect Final Turn triggered by stock exhaustion
        else if (!gameState.lastTurnTriggeredByDeckExhaust && next.lastTurnTriggeredByDeckExhaust) {
          setExhaustNotification(
            'Stock deck and Pukar pool are both exhausted! Final turn initiated.'
          );
          try {
            playSound('draw');
          } catch {}
        }
        // Normal action sound cues
        else if (
          action.type === 'DRAW_FROM_STOCK' ||
          action.type === 'TAKE_DISCARD' ||
          action.type === 'DRAW_CARD'
        ) {
          try {
            playSound('draw');
          } catch {}
        } else if (action.type === 'PLAY_NEW_MELD' || action.type === 'ADD_TO_MELD') {
          try {
            playSound('meld');
          } catch {}
        } else if (action.type === 'DISCARD_CARD') {
          try {
            playSound('discard');
          } catch {}
        } else if (action.type === 'START_NEXT_ROUND') {
          try {
            playSound('draw');
          } catch {}
        }

        // Detect Round Over
        if (next.roundStatus === 'ROUND_OVER' && gameState.roundStatus !== 'ROUND_OVER') {
          try {
            playSound('roundOver');
          } catch {}
        }

        // Detect Normal Joker pickup into hand
        if (next.lastPickedUpCard) {
          const actor = gameState.players[gameState.currentPlayerIndex];
          setJokerPickupBanner({
            playerName: actor?.name ?? `Player ${gameState.currentPlayerIndex + 1}`,
          });
          try {
            playSound('pukar');
          } catch {}
        }

        // Clean up selection state
        if (action.type === 'PLAY_NEW_MELD' || action.type === 'ADD_TO_MELD') {
          setSelectedCardIds([]);
        } else if (action.type === 'DISCARD_CARD') {
          setSelectedCardIds([]);
          setSelectedMeldId(null);
          setJokerPickupBanner(null);
          // On turn advance, reset viewed perspective so active turn stays in view
          setViewedPlayerIndex(null);
        } else if (action.type === 'START_NEXT_ROUND' || action.type === 'RESET_GAME') {
          setSelectedCardIds([]);
          setSelectedMeldId(null);
          setViewedPlayerIndex(null);
          setPukarBanner(null);
          setPukarSlamEvent(null);
          setIsTableRippling(false);
          setExhaustNotification(null);
          setJokerPickupBanner(null);
        }

        setGameState(next);
        setErrorMessage(null);
        return true;
      } catch (err) {
        console.error('Unexpected error in handleAction:', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setErrorMessage(`Game action error: ${errorMsg}`);
        try {
          playSound('error');
        } catch {}
        return false;
      }
    },
    [gameState]
  );

  // ---------------------------------------------------------------------------
  // Card Selection Handlers
  // ---------------------------------------------------------------------------
  const handleToggleCardSelection = useCallback((cardId: string) => {
    try {
      setSelectedCardIds((prev) =>
        prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
      );
    } catch (err) {
      console.error('Error in handleToggleCardSelection:', err);
    }
  }, []);

  const handleClearSelection = useCallback(() => {
    try {
      setSelectedCardIds([]);
    } catch (err) {
      console.error('Error in handleClearSelection:', err);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Play New Meld Handler with Joker Designation Prompt
  // ---------------------------------------------------------------------------
  const handlePlayMeld = useCallback(
    (cardIds: string[], jokerRepresentedRank?: number) => {
      try {
        const activeHand = gameState.players[gameState.currentPlayerIndex]?.hand ?? [];
        const cardsToMeld = cardIds
          .map((id) => activeHand.find((c) => c.id === id))
          .filter((c): c is Card => c !== undefined);

        const candidateOptions = getRunCandidateOptions(cardsToMeld);
        if (jokerRepresentedRank === undefined && candidateOptions.length > 1) {
          setJokerPromptData({
            isOpen: true,
            options: candidateOptions,
            cardIds,
          });
          return;
        }

        handleAction({
          type: 'PLAY_NEW_MELD',
          cardIds,
          jokerRepresentedRank:
            jokerRepresentedRank ??
            (candidateOptions.length === 1 ? candidateOptions[0].rank : undefined),
        });
      } catch (err) {
        console.error('Error in handlePlayMeld:', err);
      }
    },
    [gameState.players, gameState.currentPlayerIndex, handleAction]
  );

  // ---------------------------------------------------------------------------
  // Add Cards to Meld Handler with Joker Position Prompt (Highest vs Lowest)
  // ---------------------------------------------------------------------------
  const handleAddToMeld = useCallback(
    (meldId: string, cardIds: string[], jokerRepresentedRank?: number) => {
      try {
        const activeHand = gameState.players[gameState.currentPlayerIndex]?.hand ?? [];
        const cardsToAdd = cardIds
          .map((id) => activeHand.find((c) => c.id === id))
          .filter((c): c is Card => c !== undefined);

        const allMelds = [...gameState.melds.A, ...gameState.melds.B];
        const targetMeld = allMelds.find((m) => m.id === meldId);

        // If adding a Normal Joker to a RUN sequence and rank is not specified:
        if (
          targetMeld &&
          targetMeld.type === 'RUN' &&
          cardsToAdd.some((c) => isNaturalJoker(c)) &&
          jokerRepresentedRank === undefined
        ) {
          const candidateOptions = getAddToRunCandidateOptions(targetMeld, cardsToAdd);
          if (candidateOptions.length > 1) {
            setJokerPromptData({
              isOpen: true,
              options: candidateOptions,
              cardIds,
              targetMeldId: meldId,
            });
            return;
          }
          if (candidateOptions.length === 1) {
            jokerRepresentedRank = candidateOptions[0].rank;
          }
        }

        handleAction({
          type: 'ADD_TO_MELD',
          meldId,
          cardIds,
          jokerRepresentedRank,
        });
      } catch (err) {
        console.error('Error in handleAddToMeld:', err);
      }
    },
    [gameState.players, gameState.currentPlayerIndex, gameState.melds, handleAction]
  );

  // ---------------------------------------------------------------------------
  // Hot-Seat Perspective Switcher
  // ---------------------------------------------------------------------------
  const handleSwitchPlayer = useCallback((targetIndex: number) => {
    try {
      // When switching player in hot-seat mode, update viewed player
      // without mutating gameState.currentPlayerIndex
      setViewedPlayerIndex(targetIndex);
      setSelectedCardIds([]);
      setSelectedMeldId(null);
    } catch (err) {
      console.error('Error in handleSwitchPlayer:', err);
    }
  }, []);

  const handleForceTurn = useCallback((targetIndex: number) => {
    try {
      // Explicit dev override: force game turn to the target player
      setViewedPlayerIndex(targetIndex);
      setGameState((prev) => ({
        ...prev,
        currentPlayerIndex: targetIndex,
      }));
      setSelectedCardIds([]);
      setSelectedMeldId(null);
    } catch (err) {
      console.error('Error in handleForceTurn:', err);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Reset / New Game
  // ---------------------------------------------------------------------------
  const handleOpenResetModal = (count: 4 | 6 = gameState.playerCount) => {
    try {
      setResetPlayerCount(count);
      setIsResetConfirmOpen(true);
    } catch (err) {
      console.error('Error opening reset modal:', err);
    }
  };

  const handleConfirmReset = () => {
    try {
      handleAction({ type: 'RESET_GAME', playerCount: resetPlayerCount });
      setIsResetConfirmOpen(false);
    } catch (err) {
      console.error('Error confirming reset:', err);
      setIsResetConfirmOpen(false);
    }
  };

  return (
    <div
      data-testid="pukar-app"
      className="min-h-screen lg:h-screen lg:max-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-white overflow-y-auto lg:overflow-hidden"
    >
      {/* =====================================================================
          1. UNIFIED TOP NAVIGATION & SCOREBOARD BAR
      ====================================================================== */}
      <ScoreBoard
        round={gameState.round}
        roundStatus={gameState.roundStatus}
        phase={gameState.phase}
        scores={gameState.scores}
        roundScores={gameState.roundScores}
        totalScores={gameState.totalScores}
        pukarsClaimed={gameState.pukarsClaimed}
        currentPlayerIndex={activeTurnIndex}
        currentPlayerName={activePlayer.name}
        activeTeam={activePlayer.team}
        playerCount={gameState.playerCount}
        onTogglePlayerCount={(count) => {
          if (gameState.playerCount !== count) handleOpenResetModal(count);
        }}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onOpenRules={() => setIsRulesModalOpen(true)}
        onRestartGame={() => handleOpenResetModal(gameState.playerCount)}
      />

      {/* =====================================================================
          NOTIFICATION & CELEBRATION BANNERS
      ====================================================================== */}
      <div className="max-w-[1680px] mx-auto w-full px-3 sm:px-6 pt-2 flex flex-col gap-1.5 shrink-0 z-30">
        {/* Error Toast */}
        {errorMessage && (
          <div
            data-testid="error-toast"
            role="alert"
            className="flex items-center justify-between gap-3 px-4 py-2 rounded-xl bg-red-950/90 border border-red-600/70 text-red-200 shadow-lg shadow-red-950/50 text-xs sm:text-sm animate-in fade-in slide-in-from-top duration-200"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
            <button
              type="button"
              data-testid="btn-dismiss-error"
              onClick={() => setErrorMessage(null)}
              className="p-1 rounded-lg hover:bg-red-900/50 text-red-300 hover:text-white transition-colors"
              aria-label="Dismiss Error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Pukar Claimed Celebration Banner */}
        {pukarBanner && (
          <div
            data-testid="pukar-celebration-banner"
            role="status"
            className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-950/90 via-yellow-950/90 to-amber-950/90 border-2 border-amber-500/80 text-amber-200 shadow-xl shadow-amber-950/60 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm text-amber-100 flex items-center gap-2">
                  <span>🎉 ROYAL PUKAR CLAIMED!</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black">
                    +50 PTS
                  </span>
                </div>
                <div className="text-[11px] text-amber-300/90">
                  {`${pukarBanner.playerName} (Team ${pukarBanner.team}) emptied their hand and claimed a 13-card Pukar deck! Turn continues — play sequences or drop a card to end your turn.`}
                </div>
              </div>
            </div>
            <button
              type="button"
              data-testid="btn-dismiss-pukar"
              onClick={() => setPukarBanner(null)}
              className="p-1 rounded-xl hover:bg-amber-900/50 text-amber-300 hover:text-white transition-colors"
              aria-label="Dismiss Pukar Announcement"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Normal Joker Picked Up Banner */}
        {jokerPickupBanner && (
          <div
            data-testid="joker-pickup-banner"
            role="status"
            className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-950/90 via-indigo-950/90 to-purple-950/90 border-2 border-purple-500/80 text-purple-200 shadow-xl shadow-purple-950/60 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-xl bg-purple-500 text-white flex items-center justify-center font-black shadow-md shrink-0">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm text-purple-100 flex items-center gap-2">
                  <span>🃏 NORMAL JOKER PICKED UP!</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500 text-white font-bold">
                    Added to Hand
                  </span>
                </div>
                <div className="text-[11px] text-purple-300/90">
                  {`${jokerPickupBanner.playerName} contributed the natural card replacing the Joker! The Joker has returned to your hand to be played in another meld.`}
                </div>
              </div>
            </div>
            <button
              type="button"
              data-testid="btn-dismiss-joker-pickup"
              onClick={() => setJokerPickupBanner(null)}
              className="p-1 rounded-xl hover:bg-purple-900/50 text-purple-300 hover:text-white transition-colors"
              aria-label="Dismiss Joker Pickup Announcement"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Deck Exhaustion Alert */}
        {exhaustNotification && (
          <div
            data-testid="exhaust-notification"
            role="status"
            className="flex items-center justify-between gap-3 px-4 py-2 rounded-xl bg-indigo-950/80 border border-indigo-700/60 text-indigo-200 text-xs sm:text-sm animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{exhaustNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setExhaustNotification(null)}
              className="p-1 rounded-lg hover:bg-indigo-900/50 text-indigo-300 hover:text-white"
              aria-label="Dismiss Alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          2. MAIN PLAYING ARENA (NO-SCROLL DESKTOP FIT)
      ====================================================================== */}
      <main className="max-w-[1680px] mx-auto w-full px-2 sm:px-4 lg:px-6 py-2 flex flex-col gap-3 flex-1 min-h-0">
        {/* Spatial Seating & Casino Felt Card Table Arena */}
        <section aria-label="Table Arena and Seating" className="w-full flex-1 min-h-0 flex flex-col justify-center">
          <TableSeating
            players={gameState.players}
            viewedPlayerIndex={currentViewIndex}
            activeTurnIndex={activeTurnIndex}
            onSelectPlayer={handleSwitchPlayer}
            isRippling={isTableRippling}
          >
            {/* The Casino Felt Surface */}
            <div
              className={`w-full rounded-2xl sm:rounded-3xl p-3 sm:p-5 poker-table-felt poker-table-rail flex flex-col gap-3 sm:gap-4 shadow-2xl transition-transform ${
                isTableRippling ? 'animate-table-quake' : ''
              }`}
            >
              {/* Center Decks & Piles */}
              <div aria-label="Center Table Decks" className="w-full">
                <CenterTable
                  stockDeckCount={gameState.stockDeck.length}
                  discardPile={gameState.discardPile}
                  pukarPoolCount={gameState.pukarPool.length}
                  canDraw={gameState.phase === 'DRAW' && isViewingActivePlayer}
                  onDrawStock={() => handleAction({ type: 'DRAW_FROM_STOCK' })}
                  onDrawDiscard={() => handleAction({ type: 'TAKE_DISCARD' })}
                  onPeekDiscard={() => setIsDiscardModalOpen(true)}
                  isRippling={isTableRippling}
                />
              </div>

              {/* Table Sequences Board (Team A & Team B) */}
              <div aria-label="Table Sequences" className="w-full">
                <TableMeldBoard
                  melds={gameState.melds}
                  activeTeam={activePlayer.team}
                  selectedMeldId={selectedMeldId}
                  onSelectMeld={(meld) => {
                    setSelectedMeldId((prev) => (prev === meld.id ? null : meld.id));
                  }}
                  onZoomMeld={(meld) => setZoomedMeld(meld)}
                  selectedCards={selectedCards}
                  allHandCards={viewingPlayer.hand}
                  canAdd={gameState.phase === 'MELD' && isViewingActivePlayer}
                  onAddToMeld={handleAddToMeld}
                  isRippling={isTableRippling}
                />
              </div>
            </div>
          </TableSeating>
        </section>

        {/* ===================================================================
            3. DOCKED UNIFIED PLAYER CONSOLE (HAND + CONTEXTUAL ACTIONS)
        ==================================================================== */}
        <section aria-label="Player Hand and Actions" className="w-full shrink-0">
          <PlayerHand
            cards={viewingPlayer.hand}
            selectedCardIds={selectedCardIds}
            newCardIds={
              isViewingActivePlayer
                ? (gameState.newlyPickedUpCardIds ?? [])
                : []
            }
            onToggleCardSelection={handleToggleCardSelection}
            onClearSelection={handleClearSelection}
            playerName={viewingPlayer.name}
            playerTeam={viewingPlayer.team}
            isCurrentPlayer={isViewingActivePlayer}
            disabled={gameState.roundStatus === 'ROUND_OVER'}
            isRippling={isTableRippling}
            actionsSlot={
              <ActionControls
                phase={gameState.phase}
                selectedCards={selectedCards}
                selectedCardIds={selectedCardIds}
                allHandCards={viewingPlayer.hand}
                selectedMeld={selectedMeld}
                canDrawStock={
                  gameState.phase === 'DRAW' &&
                  isViewingActivePlayer &&
                  gameState.stockDeck.length > 0
                }
                canTakeDiscard={
                  gameState.phase === 'DRAW' &&
                  isViewingActivePlayer &&
                  gameState.discardPile.length > 0
                }
                stockCount={gameState.stockDeck.length}
                discardCount={gameState.discardPile.length}
                onDrawStock={() => handleAction({ type: 'DRAW_FROM_STOCK' })}
                onTakeDiscard={() => handleAction({ type: 'TAKE_DISCARD' })}
                onPlayMeld={handlePlayMeld}
                onAddToMeld={handleAddToMeld}
                onDiscard={(cardId) => handleAction({ type: 'DISCARD_CARD', cardId })}
                disabled={!isViewingActivePlayer || gameState.roundStatus === 'ROUND_OVER'}
                unifiedMode={true}
                showDrawButtons={false}
              />
            }
          />
        </section>

        {/* 4. Dev Inspector & Hot-Seat Switcher */}
        <section aria-label="Hot-Seat Tools & Dev Inspector" className="shrink-0">
          <DevInspector
            players={gameState.players}
            currentPlayerIndex={currentViewIndex}
            activeTurnIndex={activeTurnIndex}
            onSwitchPlayer={handleSwitchPlayer}
            onForceTurn={handleForceTurn}
            stockDeckCount={gameState.stockDeck.length}
            discardPileCount={gameState.discardPile.length}
            pukarPoolCount={gameState.pukarPool.length}
            isGodModeOpen={isGodModeOpen}
            onToggleGodMode={() => setIsGodModeOpen((prev) => !prev)}
            newlyPickedUpCardIds={gameState.newlyPickedUpCardIds}
          />
        </section>
      </main>

      {/* =====================================================================
          MODALS
      ====================================================================== */}
      {/* 1. Round Summary Modal */}
      <RoundSummaryModal
        isOpen={gameState.roundStatus === 'ROUND_OVER' || Boolean(gameState.isRoundOver)}
        isRoundOver={gameState.roundStatus === 'ROUND_OVER' || Boolean(gameState.isRoundOver)}
        round={gameState.round}
        roundScores={gameState.roundScores}
        totalScores={gameState.totalScores ?? gameState.scores}
        melds={gameState.melds}
        pukarsClaimed={gameState.pukarsClaimed}
        onStartNextRound={() => handleAction({ type: 'START_NEXT_ROUND' })}
      />

      {/* 2. Discard Pile History Modal */}
      <DiscardPileModal
        isOpen={isDiscardModalOpen}
        onClose={() => setIsDiscardModalOpen(false)}
        discardPile={gameState.discardPile}
      />

      {/* 3. Sequence Zoom Inspection Modal */}
      <SequenceZoomModal
        isOpen={Boolean(zoomedMeld)}
        meld={zoomedMeld}
        onClose={() => setZoomedMeld(null)}
      />

      {/* 3. Restart / New Game Confirmation Modal */}
      {isResetConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 text-slate-100">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 id="reset-modal-title" className="text-lg font-bold text-white">
                  Start New Game?
                </h2>
                <p className="text-xs text-slate-400">Current game state and scores will be reset.</p>
              </div>
            </div>

            {/* Select Player Count */}
            <div className="flex flex-col gap-1.5 pt-2">
              <label className="text-xs font-semibold text-slate-300">Player Count:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="reset-option-4p"
                  onClick={() => setResetPlayerCount(4)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    resetPlayerCount === 4
                      ? 'bg-amber-500/10 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-sm">4 Players</div>
                  <div className="text-[11px] text-slate-400">2 Teams of 2 (2 Decks)</div>
                </button>
                <button
                  type="button"
                  data-testid="reset-option-6p"
                  onClick={() => setResetPlayerCount(6)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    resetPlayerCount === 6
                      ? 'bg-amber-500/10 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-sm">6 Players</div>
                  <div className="text-[11px] text-slate-400">2 Teams of 3 (3 Decks)</div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                data-testid="btn-cancel-reset"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="btn-confirm-reset"
                onClick={handleConfirmReset}
                className="px-4 py-2 rounded-xl text-xs font-extrabold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-md shadow-amber-950/40"
              >
                Confirm & Start
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Joker Designation Prompt Modal */}
      <JokerPromptModal
        isOpen={Boolean(jokerPromptData?.isOpen)}
        options={jokerPromptData?.options ?? []}
        onSelect={(rank) => {
          if (jokerPromptData) {
            if (jokerPromptData.targetMeldId) {
              handleAction({
                type: 'ADD_TO_MELD',
                meldId: jokerPromptData.targetMeldId,
                cardIds: jokerPromptData.cardIds,
                jokerRepresentedRank: rank,
              });
            } else {
              handleAction({
                type: 'PLAY_NEW_MELD',
                cardIds: jokerPromptData.cardIds,
                jokerRepresentedRank: rank,
              });
            }
            setJokerPromptData(null);
          }
        }}
        onCancel={() => setJokerPromptData(null)}
      />

      {/* 5. Rules & Instructions Modal */}
      {isRulesModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rules-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsRulesModalOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] shadow-2xl flex flex-col overflow-hidden text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="rules-modal-title" className="text-lg font-bold text-white">
                    Pukar Rules & Gameplay
                  </h2>
                  <p className="text-xs text-slate-400">Royal Partner Rummy Guide</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRulesModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                aria-label="Close Rules"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <h3 className="font-bold text-white text-sm mb-1 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                  Objective & Teams
                </h3>
                <p>
                  Pukar is played in 2 teams (Team A vs Team B). Players take alternating turns.
                  Form melds on your team&apos;s board, empty your hand to claim Pukar decks (+50 pts
                  each), and maximize your team&apos;s score.
                </p>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <h3 className="font-bold text-white text-sm mb-1">Turn Sequence</h3>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>
                    <strong className="text-amber-300">DRAW:</strong> Draw 1 card from the face-down
                    Stock deck OR take the entire face-up Discard pile (&ldquo;The Bottom&rdquo;).
                  </li>
                  <li>
                    <strong className="text-amber-300">MELD:</strong> (Optional) Play new 3+ card
                    runs or sets, or add cards to existing team melds. You can make multiple melds!
                  </li>
                  <li>
                    <strong className="text-amber-300">DISCARD:</strong> (Mandatory) Discard 1 card
                    face-up to the Bottom to end your turn.
                  </li>
                </ol>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <h3 className="font-bold text-white text-sm mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Wildcards & Melds
                </h3>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li>
                    All <strong>2s</strong> and <strong>Natural Jokers</strong> are wildcards.
                  </li>
                  <li>
                    A meld requires at least 3 cards and must have at least as many natural cards as
                    wildcards (wildcard ratio ≤ 50%).
                  </li>
                  <li>
                    <strong>Movable 2:</strong> In a sequence, a 2 can float and shift position as
                    natural cards fill its represented slot!
                  </li>
                </ul>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <h3 className="font-bold text-white text-sm mb-1 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  Pukar Claim & Scoring
                </h3>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li>
                    When a player empties their hand and Pukars remain, they claim a 13-card Pukar deck
                    and score an immediate <strong>+50 points</strong>!
                  </li>
                  <li>
                    When claiming a Pukar (by melding or discarding), your turn does not end! You immediately
                    receive the 13 cards, continue in Sequence phase without needing to draw, and only end your
                    turn by dropping another card.
                  </li>
                  <li>
                    If all Pukars have run out and a player empties their hand, that also counts as claiming
                    a Pukar for <strong>+50 points</strong> (with no cards dealt), and the round concludes immediately.
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
              <button
                type="button"
                onClick={() => setIsRulesModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors"
              >
                Got It, Let&apos;s Play!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pukar Slam Celebration & Ripple Shockwave Overlay */}
      {pukarSlamEvent && (
        <PukarSlamOverlay
          team={pukarSlamEvent.team}
          playerName={pukarSlamEvent.playerName}
          points={pukarSlamEvent.points}
          onClose={() => setPukarSlamEvent(null)}
          onImpact={() => {
            setIsTableRippling(true);
            setTimeout(() => setIsTableRippling(false), 1200);
          }}
        />
      )}
    </div>
  );
}

export default App;
