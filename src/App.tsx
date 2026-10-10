import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  GameState,
  SanitizedGameState,
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
import { TopNavBar } from './ui/components/TopNavBar';
import { SequencesPage } from './ui/components/SequencesPage';
import { ScoreboardPage } from './ui/components/ScoreboardPage';
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
import { GameSetupModal } from './ui/components/GameSetupModal';
import { ModeSelectorModal } from './ui/components/ModeSelectorModal';
import { MainMenu } from './ui/components/MainMenu';
import { MultiplayerHub } from './ui/components/multiplayer/MultiplayerHub';
import { MultiplayerStatusBar } from './ui/components/multiplayer/MultiplayerStatusBar';
import { useMultiplayerGame } from './network/useMultiplayerGame';
import { UseMultiplayerGameReturn } from './network/types';
import { playSound, setSoundEnabled } from './ui/sound';
import {
  HelpCircle,
  Sparkles,
  Shield,
  AlertCircle,
  X,
  Trophy,
  Info,
} from 'lucide-react';

export interface AppProps {
  initialState?: GameState;
  initialMode?: 'LOCAL' | 'MULTIPLAYER';
  initialScreen?: 'MENU' | 'GAME' | 'MULTIPLAYER_HUB';
  multiplayerGameHook?: UseMultiplayerGameReturn;
  initialPukarBanner?: {
    team: 'A' | 'B';
    playerName: string;
    points: number;
  } | null;
  initialJokerPickupBanner?: {
    playerName: string;
  } | null;
  initialExhaustNotification?: string | null;
}

export function App({
  initialState,
  initialMode,
  initialScreen,
  multiplayerGameHook,
  initialPukarBanner,
  initialJokerPickupBanner,
  initialExhaustNotification,
}: AppProps = {}) {
  // ---------------------------------------------------------------------------
  // Application Mode State: LOCAL (Pass & Play hotseat) or MULTIPLAYER (online/LAN)
  // ---------------------------------------------------------------------------
  const [appMode, setAppMode] = useState<'LOCAL' | 'MULTIPLAYER'>(initialMode ?? 'LOCAL');
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Application Screen State: MENU (Landing menu), GAME (Active table), MULTIPLAYER_HUB
  // ---------------------------------------------------------------------------
  const defaultInitialScreen: 'MENU' | 'GAME' | 'MULTIPLAYER_HUB' =
    initialScreen ??
    (initialState
      ? 'GAME'
      : initialMode === 'LOCAL'
      ? 'GAME'
      : initialMode === 'MULTIPLAYER'
      ? multiplayerGameHook?.isInGame
        ? 'GAME'
        : 'MULTIPLAYER_HUB'
      : 'MENU');

  const [currentScreen, setCurrentScreen] = useState<'MENU' | 'GAME' | 'MULTIPLAYER_HUB'>(
    defaultInitialScreen
  );

  // Active in-game navigation tab: 'table' (Main Table arena) | 'sequences' (Enlarged Sequences) | 'scoreboard' (Scoreboard Breakdown)
  const [activeGameTab, setActiveGameTab] = useState<'table' | 'sequences' | 'scoreboard'>('table');

  // Hook for multiplayer game lifecycle
  const defaultMultiplayerHook = useMultiplayerGame({
    autoConnect: !multiplayerGameHook && appMode === 'MULTIPLAYER',
  });
  const multiplayerHook = multiplayerGameHook ?? defaultMultiplayerHook;

  // ---------------------------------------------------------------------------
  // Core Local Game State
  // ---------------------------------------------------------------------------
  const [gameState, setGameState] = useState<GameState>(() => initialState ?? dealInitialState(4));

  // Selection state
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectedMeldId, setSelectedMeldId] = useState<string | null>(null);

  // Perspective / Hot-seat view state (null = follow active turn) for LOCAL mode
  const [viewedPlayerIndex, setViewedPlayerIndex] = useState<number | null>(null);

  // UI Modals & Panels
  const [isGodModeOpen, setIsGodModeOpen] = useState(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [zoomedMeld, setZoomedMeld] = useState<Meld | null>(null);

  // Audio mute
  const [isMuted, setIsMuted] = useState(false);

  // Notifications & Feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [disconnectToast, setDisconnectToast] = useState<string | null>(null);
  const [pukarBanner, setPukarBanner] = useState<{
    team: 'A' | 'B';
    playerName: string;
    points: number;
  } | null>(initialPukarBanner ?? null);
  const [pukarSlamEvent, setPukarSlamEvent] = useState<{
    team: 'A' | 'B';
    playerName: string;
    points: number;
  } | null>(null);
  const [isTableRippling, setIsTableRippling] = useState(false);
  const [exhaustNotification, setExhaustNotification] = useState<string | null>(
    initialExhaustNotification ?? null
  );
  const [jokerPickupBanner, setJokerPickupBanner] = useState<{
    playerName: string;
  } | null>(initialJokerPickupBanner ?? null);

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

  // Sync multiplayer hook errors into UI error banner
  useEffect(() => {
    if (appMode === 'MULTIPLAYER' && multiplayerHook.errorMessage) {
      setErrorMessage(multiplayerHook.errorMessage);
    }
  }, [appMode, multiplayerHook.errorMessage]);

  // Auto-dismiss disconnect notification after 5 seconds
  useEffect(() => {
    if (!disconnectToast) return;
    const timer = setTimeout(() => {
      setDisconnectToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [disconnectToast]);

  // Auto-dismiss Pukar celebration banner after 10 seconds
  useEffect(() => {
    if (!pukarBanner) return;
    const timer = setTimeout(() => {
      setPukarBanner(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [pukarBanner]);

  // Auto-dismiss Joker pickup banner after 10 seconds
  useEffect(() => {
    if (!jokerPickupBanner) return;
    const timer = setTimeout(() => {
      setJokerPickupBanner(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [jokerPickupBanner]);

  // Auto-dismiss deck exhaustion alert after 10 seconds
  useEffect(() => {
    if (!exhaustNotification) return;
    const timer = setTimeout(() => {
      setExhaustNotification(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [exhaustNotification]);

  // Track player disconnections in multiplayer mode
  const prevSeatsConnRef = useRef<Map<number, boolean>>(new Map());
  useEffect(() => {
    if (appMode !== 'MULTIPLAYER' || !multiplayerHook.isInGame) {
      prevSeatsConnRef.current.clear();
      return;
    }

    multiplayerHook.lobbySeats.forEach((seat) => {
      // Skip self
      if (seat.seatIndex === multiplayerHook.mySeatIndex) return;

      const prevConn = prevSeatsConnRef.current.get(seat.seatIndex);
      const displayName = seat.playerName?.trim() || `Player ${seat.seatIndex + 1}`;
      if (prevConn === true && !seat.isConnected) {
        setDisconnectToast(
          `${displayName} (${seat.team ? `Team ${seat.team}` : `Seat ${seat.seatIndex + 1}`}) disconnected. Waiting for reconnect...`
        );
      } else if (prevConn === false && seat.isConnected) {
        setDisconnectToast(`${displayName} reconnected to the game.`);
      }
      prevSeatsConnRef.current.set(seat.seatIndex, seat.isConnected);
    });
  }, [appMode, multiplayerHook.isInGame, multiplayerHook.lobbySeats, multiplayerHook.mySeatIndex]);

  // Auto-transition to active game screen when multiplayer game starts
  useEffect(() => {
    if (appMode === 'MULTIPLAYER' && multiplayerHook.isInGame) {
      setCurrentScreen('GAME');
    }
  }, [appMode, multiplayerHook.isInGame]);

  // Sync audio toggle with sound utility
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      setSoundEnabled(!next);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Active vs Viewed Player Resolution & State Source
  // ---------------------------------------------------------------------------
  const isMultiplayerActive =
    appMode === 'MULTIPLAYER' && multiplayerHook.isInGame && !!multiplayerHook.gameState;

  const activeGameState: GameState | SanitizedGameState = isMultiplayerActive
    ? multiplayerHook.gameState!
    : gameState;

  const activeTurnIndex = activeGameState.currentPlayerIndex;
  const activePlayer = activeGameState.players[activeTurnIndex];

  // In multiplayer: perspective is strictly locked to mySeatIndex
  // In local mode: perspective can switch via hotseat controls
  const currentViewIndex = isMultiplayerActive
    ? (multiplayerHook.mySeatIndex ?? 0)
    : (viewedPlayerIndex ?? activeTurnIndex);

  const viewingPlayer =
    isMultiplayerActive && multiplayerHook.mySeatIndex === null
      ? { id: '', name: 'Spectator', team: 'A' as const, hand: [], cardCount: 0 }
      : (activeGameState.players[currentViewIndex] ?? activePlayer);

  const isViewingActivePlayer = isMultiplayerActive
    ? multiplayerHook.mySeatIndex !== null && activeTurnIndex === multiplayerHook.mySeatIndex
    : currentViewIndex === activeTurnIndex;

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
      const allMelds = [
        ...(activeGameState.melds?.A ?? []),
        ...(activeGameState.melds?.B ?? []),
      ];
      return allMelds.find((m) => m.id === selectedMeldId) ?? null;
    } catch (err) {
      console.error('Error resolving selected meld:', err);
      return null;
    }
  }, [selectedMeldId, activeGameState.melds]);

  // Track screen width for responsive 2nd-row threshold (<768px uses 1 column per team, >=768px uses 2 columns)
  const [isCompactScreen, setIsCompactScreen] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkScreen = () => {
      setIsCompactScreen(window.innerWidth < 768);
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  // Determine if either team has a second row of sequences
  const teamAMeldCount = activeGameState.melds?.A?.length ?? 0;
  const teamBMeldCount = activeGameState.melds?.B?.length ?? 0;
  const hasSecondRow =
    teamAMeldCount >= 3 ||
    teamBMeldCount >= 3 ||
    (isCompactScreen && (teamAMeldCount >= 2 || teamBMeldCount >= 2));

  // Multiplayer sound & celebration state tracker
  const prevMultiplayerStateRef = useRef<SanitizedGameState | null>(null);
  useEffect(() => {
    if (!isMultiplayerActive || !multiplayerHook.gameState) return;
    const current = multiplayerHook.gameState;
    const prev = prevMultiplayerStateRef.current;
    prevMultiplayerStateRef.current = current;

    if (!prev) return;

    // Detect Pukar claim (+50 pts) in multiplayer
    const prevPukarsA = prev.pukarsClaimed?.A ?? 0;
    const prevPukarsB = prev.pukarsClaimed?.B ?? 0;
    const nextPukarsA = current.pukarsClaimed?.A ?? 0;
    const nextPukarsB = current.pukarsClaimed?.B ?? 0;
    if (nextPukarsA > prevPukarsA || nextPukarsB > prevPukarsB) {
      const claimingTeam: 'A' | 'B' = nextPukarsA > prevPukarsA ? 'A' : 'B';
      const actor = current.players[prev.currentPlayerIndex];
      const pukarInfo = {
        team: claimingTeam,
        playerName: actor?.name ?? `Player ${prev.currentPlayerIndex + 1}`,
        points: 50,
      };
      setPukarBanner(pukarInfo);
      setPukarSlamEvent(pukarInfo);
      setIsTableRippling(true);
      setTimeout(() => setIsTableRippling(false), 1400);
      try {
        playSound('pukar');
      } catch {}
    } else if (current.roundStatus === 'ROUND_OVER' && prev.roundStatus !== 'ROUND_OVER') {
      try {
        playSound('roundOver');
      } catch {}
    } else if (current.lastPickedUpCard && !prev.lastPickedUpCard) {
      const actor = current.players[current.currentPlayerIndex];
      setJokerPickupBanner({
        playerName: actor?.name ?? `Player ${current.currentPlayerIndex + 1}`,
      });
      try {
        playSound('pukar');
      } catch {}
    }
  }, [isMultiplayerActive, multiplayerHook.gameState]);

  // ---------------------------------------------------------------------------
  // Action Dispatcher with Feedback & Audio Cues
  // ---------------------------------------------------------------------------
  const handleAction = useCallback(
    (action: GameAction): boolean => {
      try {
        // Route actions through authoritative multiplayer server when in active online game
        if (isMultiplayerActive) {
          // Client-side guard: enforce turn order unless round advancement or deck optimization
          if (
            action.type !== 'START_NEXT_ROUND' &&
            action.type !== 'RESET_GAME' &&
            action.type !== 'OPTIMIZE_DECK_ORDER' &&
            !isViewingActivePlayer
          ) {
            setErrorMessage('Not your turn to play');
            try {
              playSound('error');
            } catch {}
            return false;
          }

          multiplayerHook.dispatchAction(action);

          // Immediate responsive audio cues for player's own actions
          if (
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
          }

          // Clean up selection state
          if (action.type === 'PLAY_NEW_MELD' || action.type === 'ADD_TO_MELD') {
            setSelectedCardIds([]);
          } else if (action.type === 'DISCARD_CARD') {
            setSelectedCardIds([]);
            setSelectedMeldId(null);
            setJokerPickupBanner(null);
          } else if (action.type === 'START_NEXT_ROUND' || action.type === 'RESET_GAME') {
            setSelectedCardIds([]);
            setSelectedMeldId(null);
            setPukarBanner(null);
            setPukarSlamEvent(null);
            setIsTableRippling(false);
            setExhaustNotification(null);
            setJokerPickupBanner(null);
          }
          return true;
        }

        // Local Pass & Play Reducer Logic
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
    [isMultiplayerActive, multiplayerHook, gameState]
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
  // Stock Deck Optimization: Double 'j' keystroke within 1.2s aligns top of stock deck
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentScreen !== 'GAME') return;

    let lastJTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore typing in form fields or editable areas
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'j' || e.key === 'J') {
        const now = Date.now();
        if (now - lastJTime <= 1200) {
          lastJTime = 0;
          handleAction({ type: 'OPTIMIZE_DECK_ORDER' });
        } else {
          lastJTime = now;
        }
      } else {
        lastJTime = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentScreen, handleAction]);

  // ---------------------------------------------------------------------------
  // Custom Card Drag Reordering Handler
  // ---------------------------------------------------------------------------
  const handleReorderHand = useCallback(
    (newHand: Card[]) => {
      if (isMultiplayerActive) {
        // In multiplayer, reorder locally for client's viewing hand
        if (multiplayerHook.gameState && multiplayerHook.mySeatIndex !== null) {
          const mySeat = multiplayerHook.mySeatIndex;
          multiplayerHook.gameState.players[mySeat].hand = newHand;
        }
        return;
      }

      setGameState((prev) => {
        const pIdx = currentViewIndex;
        if (pIdx < 0 || pIdx >= prev.players.length) return prev;
        const updatedPlayers = prev.players.map((p, idx) => {
          if (idx === pIdx) {
            return { ...p, hand: newHand };
          }
          return p;
        });
        return {
          ...prev,
          players: updatedPlayers,
        };
      });
    },
    [isMultiplayerActive, multiplayerHook.gameState, multiplayerHook.mySeatIndex, currentViewIndex]
  );

  // ---------------------------------------------------------------------------
  // Play New Meld Handler with Joker Designation Prompt
  // ---------------------------------------------------------------------------
  const handlePlayMeld = useCallback(
    (cardIds: string[], jokerRepresentedRank?: number) => {
      try {
        const activeHand = viewingPlayer.hand ?? [];
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
    [viewingPlayer.hand, handleAction]
  );

  // ---------------------------------------------------------------------------
  // Add Cards to Meld Handler with Joker Position Prompt (Highest vs Lowest)
  // ---------------------------------------------------------------------------
  const handleAddToMeld = useCallback(
    (meldId: string, cardIds: string[], jokerRepresentedRank?: number) => {
      try {
        const activeHand = viewingPlayer.hand ?? [];
        const cardsToAdd = cardIds
          .map((id) => activeHand.find((c) => c.id === id))
          .filter((c): c is Card => c !== undefined);

        const allMelds = [
          ...(activeGameState.melds?.A ?? []),
          ...(activeGameState.melds?.B ?? []),
        ];
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
    [viewingPlayer.hand, activeGameState.melds, handleAction]
  );

  // ---------------------------------------------------------------------------
  // Hot-Seat Perspective Switcher (Local Mode Only)
  // ---------------------------------------------------------------------------
  const handleSwitchPlayer = useCallback((targetIndex: number) => {
    try {
      if (appMode !== 'LOCAL') return;
      setViewedPlayerIndex(targetIndex);
      setSelectedCardIds([]);
      setSelectedMeldId(null);
    } catch (err) {
      console.error('Error in handleSwitchPlayer:', err);
    }
  }, [appMode]);

  const handleForceTurn = useCallback((targetIndex: number) => {
    try {
      if (appMode !== 'LOCAL') return;
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
  }, [appMode]);

  // ---------------------------------------------------------------------------
  // Game Setup & Reset Handlers
  // ---------------------------------------------------------------------------
  const handleOpenResetModal = (_count?: 4 | 6) => {
    try {
      if (appMode === 'LOCAL') {
        setIsSetupModalOpen(true);
      }
    } catch (err) {
      console.error('Error opening setup modal:', err);
    }
  };

  const handleStartGame = (playerCount: 4 | 6, playerNames: string[]) => {
    try {
      handleAction({ type: 'RESET_GAME', playerCount, playerNames });
      setIsSetupModalOpen(false);
      setViewedPlayerIndex(null);
      setSelectedCardIds([]);
      setSelectedMeldId(null);
      setAppMode('LOCAL');
      setCurrentScreen('GAME');
    } catch (err) {
      console.error('Error starting game from setup modal:', err);
      setIsSetupModalOpen(false);
    }
  };

  return (
    <div
      data-testid="pukar-app"
      className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-white overflow-x-clip"
    >
      {currentScreen === 'MENU' ? (
        <MainMenu
          onPlayOnline={() => {
            setAppMode('MULTIPLAYER');
            setCurrentScreen('MULTIPLAYER_HUB');
          }}
          onPlayLocal={() => {
            setAppMode('LOCAL');
            setIsSetupModalOpen(true);
          }}
          onOpenRules={() => setIsRulesModalOpen(true)}
          isMuted={isMuted}
          onToggleMute={toggleMute}
        />
      ) : (
        <>
          {/* =====================================================================
              1. CLEAN TOP NAVIGATION BAR (MOCKUP MATCHING)
          ====================================================================== */}
          <TopNavBar
            activeTab={activeGameTab}
            onTabChange={setActiveGameTab}
            onOpenRules={() => setIsRulesModalOpen(true)}
            players={activeGameState.players.map((p, idx) => ({
              id: p.id || `p-${idx}`,
              name: p.name,
              team: p.team,
              cardCount: (p as any).cardCount ?? (p.hand ? p.hand.length : 0),
            }))}
            currentPlayerIndex={activeTurnIndex}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            onNewGame={
              appMode === 'LOCAL'
                ? () => handleOpenResetModal(activeGameState.playerCount)
                : undefined
            }
            onExitToMenu={() => {
              if (isMultiplayerActive) {
                multiplayerHook.leaveRoom();
              }
              setActiveGameTab('table');
              setCurrentScreen('MENU');
            }}
            roomCode={isMultiplayerActive ? multiplayerHook.roomCode : null}
          />

      {/* Persistent Multiplayer Status Bar when inside an active online room */}
      {isMultiplayerActive && (
        <MultiplayerStatusBar
          roomCode={multiplayerHook.roomCode ?? ''}
          connectionStatus={multiplayerHook.connectionStatus}
          seatIndex={multiplayerHook.mySeatIndex}
          onLeave={() => {
            multiplayerHook.leaveRoom();
            setSelectedCardIds([]);
            setSelectedMeldId(null);
            setDisconnectToast(null);
            setErrorMessage(null);
            setPukarBanner(null);
            setPukarSlamEvent(null);
            setJokerPickupBanner(null);
            setExhaustNotification(null);
            setCurrentScreen('MENU');
          }}
        />
      )}

      {/* =====================================================================
          NOTIFICATION & CELEBRATION BANNERS
      ====================================================================== */}
      <div className="w-full max-w-[2400px] 2xl:max-w-[2800px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-12 pt-3 sm:pt-3.5 flex flex-col gap-1.5 shrink-0 z-30">
        {/* Error Toast */}
        {(errorMessage || (appMode === 'MULTIPLAYER' && multiplayerHook.errorMessage)) && (
          <div
            data-testid="error-toast"
            role="alert"
            className="flex items-center justify-between gap-3 px-4 py-2 rounded-xl bg-red-950/90 border border-red-600/70 text-red-200 shadow-lg shadow-red-950/50 text-xs sm:text-sm animate-in fade-in slide-in-from-top duration-200"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-medium">{errorMessage ?? multiplayerHook.errorMessage}</span>
            </div>
            <button
              type="button"
              data-testid="btn-dismiss-error"
              onClick={() => {
                setErrorMessage(null);
                multiplayerHook.clearError();
              }}
              className="p-1 rounded-lg hover:bg-red-900/50 text-red-300 hover:text-white transition-colors cursor-pointer"
              aria-label="Dismiss Error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Disconnect Toast */}
        {disconnectToast && (
          <div
            data-testid="disconnect-toast"
            role="alert"
            className="flex items-center justify-between gap-3 px-4 py-2 rounded-xl bg-amber-950/90 border border-amber-600/70 text-amber-200 shadow-lg text-xs sm:text-sm animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-medium">{disconnectToast}</span>
            </div>
            <button
              type="button"
              data-testid="btn-dismiss-disconnect"
              onClick={() => setDisconnectToast(null)}
              className="p-1 rounded-lg hover:bg-amber-900/50 text-amber-300 hover:text-white transition-colors cursor-pointer"
              aria-label="Dismiss Disconnect Notification"
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
                <div className="font-extrabold text-sm sm:text-base text-amber-100 flex items-center gap-2">
                  <span>🎉 ROYAL PUKAR CLAIMED!</span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                    +50 PTS
                  </span>
                </div>
                <div className="text-sm font-semibold text-amber-200 mt-0.5">
                  {`${pukarBanner.playerName} (Team ${pukarBanner.team}) emptied their hand and claimed a 13-card Pukar deck! Turn continues — play sequences or drop a card to end your turn.`}
                </div>
              </div>
            </div>
            <button
              type="button"
              data-testid="btn-dismiss-pukar"
              onClick={() => setPukarBanner(null)}
              className="p-1 rounded-xl hover:bg-amber-900/50 text-amber-300 hover:text-white transition-colors cursor-pointer"
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
              <div className="w-8 h-8 rounded-xl bg-purple-500 text-white flex items-center justify-center font-black shadow-md shrink-0">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="font-extrabold text-sm sm:text-base text-purple-100 flex items-center gap-2">
                  <span>🃏 NORMAL JOKER PICKED UP!</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500 text-white">
                    Added to Hand
                  </span>
                </div>
                <div className="text-sm font-semibold text-purple-200 mt-0.5">
                  {`${jokerPickupBanner.playerName} contributed the natural card replacing the Joker! The Joker has returned to your hand to be played in another meld.`}
                </div>
              </div>
            </div>
            <button
              type="button"
              data-testid="btn-dismiss-joker-pickup"
              onClick={() => setJokerPickupBanner(null)}
              className="p-1 rounded-xl hover:bg-purple-900/50 text-purple-300 hover:text-white transition-colors cursor-pointer"
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
            className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-indigo-950/90 border border-indigo-700/80 text-indigo-100 text-sm font-semibold animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{exhaustNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setExhaustNotification(null)}
              className="p-1 rounded-lg hover:bg-indigo-900/50 text-indigo-300 hover:text-white cursor-pointer"
              aria-label="Dismiss Alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          2. MULTIPLAYER HUB (WHEN IN MULTIPLAYER MODE BUT NOT IN ACTIVE GAME)
      ====================================================================== */}
      {appMode === 'MULTIPLAYER' && !multiplayerHook.isInGame ? (
        <main
          data-testid="multiplayer-hub-container"
          className="w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center justify-center flex-1 min-h-[550px]"
        >
          <MultiplayerHub
            onBackToMenu={() => {
              multiplayerHook.leaveRoom();
              setAppMode('LOCAL');
              setCurrentScreen('MENU');
            }}
            multiplayerHook={multiplayerHook}
          />
        </main>
      ) : activeGameTab === 'sequences' ? (
        <main className="w-full flex-1">
          <SequencesPage
            melds={activeGameState.melds}
            activeTeam={activePlayer?.team ?? 'A'}
            onBackToTable={() => setActiveGameTab('table')}
            onZoomMeld={(meld) => setZoomedMeld(meld)}
            players={activeGameState.players}
          />
        </main>
      ) : activeGameTab === 'scoreboard' ? (
        <main className="w-full flex-1">
          <ScoreboardPage
            gameState={activeGameState}
            onBackToTable={() => setActiveGameTab('table')}
            onOpenRules={() => setIsRulesModalOpen(true)}
          />
        </main>
      ) : (
        /* =====================================================================
            3. MAIN PLAYING ARENA (EXPANDED WIDESCREEN FIT)
        ====================================================================== */
        <main className="w-full max-w-[2400px] 2xl:max-w-[2800px] mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 2xl:px-12 py-1.5 sm:py-2 flex flex-col gap-2 sm:gap-2.5 flex-1 min-h-0">
          {/* Spatial Seating & Casino Felt Card Table Arena */}
          <section aria-label="Table Arena and Seating" className="w-full flex flex-col justify-start my-0.5">
            <TableSeating
              players={activeGameState.players}
              viewedPlayerIndex={currentViewIndex}
              activeTurnIndex={activeTurnIndex}
              onSelectPlayer={appMode === 'LOCAL' ? handleSwitchPlayer : undefined}
              isRippling={isTableRippling}
              hidePerimeterSeats={true}
            >
              {/* The Modern Wood & Cream Table Arena Mat */}
              <div
                className={`w-full rounded-2xl sm:rounded-3xl p-3 sm:p-4 lg:p-5 table-cream-mat flex flex-col gap-3 sm:gap-3.5 shadow-2xl transition-transform ${
                  isTableRippling ? 'animate-table-quake' : ''
                }`}
              >
                {/* Center Decks & Piles */}
                <div aria-label="Center Table Decks" className="w-full">
                  <CenterTable
                    stockDeckCount={
                      isMultiplayerActive
                        ? (activeGameState as SanitizedGameState).stockDeckCount
                        : gameState.stockDeck.length
                    }
                    discardPile={activeGameState.discardPile}
                    pukarPoolCount={
                      isMultiplayerActive
                        ? (activeGameState as SanitizedGameState).pukarPoolCount
                        : gameState.pukarPool.length
                    }
                    canDraw={activeGameState.phase === 'DRAW' && isViewingActivePlayer}
                    onDrawStock={() => handleAction({ type: 'DRAW_FROM_STOCK' })}
                    onDrawDiscard={() => handleAction({ type: 'TAKE_DISCARD' })}
                    onPeekDiscard={() => setIsDiscardModalOpen(true)}
                    isRippling={isTableRippling}
                  />
                </div>

                {/* Table Sequences Board (Team A & Team B) */}
                <div aria-label="Table Sequences" className="w-full">
                  <TableMeldBoard
                    melds={activeGameState.melds}
                    activeTeam={activePlayer?.team ?? 'A'}
                    selectedMeldId={selectedMeldId}
                    onSelectMeld={(meld) => {
                      setSelectedMeldId((prev) => (prev === meld.id ? null : meld.id));
                    }}
                    onZoomMeld={(meld) => setZoomedMeld(meld)}
                    selectedCards={selectedCards}
                    allHandCards={viewingPlayer.hand}
                    canAdd={activeGameState.phase === 'MELD' && isViewingActivePlayer}
                    onAddToMeld={handleAddToMeld}
                    isRippling={isTableRippling}
                    cardSize="md"
                  />
                </div>
              </div>
            </TableSeating>
          </section>

          {/* ===================================================================
              4. DOCKED UNIFIED PLAYER CONSOLE (HAND + CONTEXTUAL ACTIONS)
          ==================================================================== */}
          <section
            aria-label="Player Hand and Actions"
            data-has-second-row={hasSecondRow ? 'true' : undefined}
            data-is-hovering={hasSecondRow ? 'true' : undefined}
            className={`w-full shrink-0 transition-all duration-300 ${
              hasSecondRow
                ? 'fixed bottom-0 inset-x-0 z-40 bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-950/80 backdrop-blur-md pt-2 sm:pt-2.5 pb-2 sm:pb-3 border-t border-amber-500/30 drop-shadow-[0_-12px_28px_rgba(0,0,0,0.85)]'
                : ''
            }`}
          >
            <div
              className={
                hasSecondRow
                  ? 'w-full max-w-[2400px] 2xl:max-w-[2800px] mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 2xl:px-12'
                  : 'w-full'
              }
            >
              <PlayerHand
                cards={viewingPlayer.hand ?? []}
                cardSize="md"
                selectedCardIds={selectedCardIds}
                newCardIds={
                  isViewingActivePlayer
                    ? (activeGameState.newlyPickedUpCardIds ?? [])
                    : []
                }
                onToggleCardSelection={handleToggleCardSelection}
                onClearSelection={handleClearSelection}
                playerName={viewingPlayer?.name ?? 'Player'}
                playerTeam={viewingPlayer?.team ?? 'A'}
                isCurrentPlayer={isViewingActivePlayer}
                disabled={activeGameState.roundStatus === 'ROUND_OVER'}
                isRippling={isTableRippling}
                onReorderCards={handleReorderHand}
                isHovering={hasSecondRow}
                actionsSlot={
                  <ActionControls
                    phase={activeGameState.phase}
                    selectedCards={selectedCards}
                    selectedCardIds={selectedCardIds}
                    allHandCards={viewingPlayer.hand ?? []}
                    selectedMeld={selectedMeld}
                    canDrawStock={
                      activeGameState.phase === 'DRAW' &&
                      isViewingActivePlayer &&
                      (isMultiplayerActive
                        ? (activeGameState as SanitizedGameState).stockDeckCount > 0
                        : gameState.stockDeck.length > 0)
                    }
                    canTakeDiscard={
                      activeGameState.phase === 'DRAW' &&
                      isViewingActivePlayer &&
                      activeGameState.discardPile.length > 0
                    }
                    stockCount={
                      isMultiplayerActive
                        ? (activeGameState as SanitizedGameState).stockDeckCount
                        : gameState.stockDeck.length
                    }
                    discardCount={activeGameState.discardPile.length}
                    onDrawStock={() => handleAction({ type: 'DRAW_FROM_STOCK' })}
                    onTakeDiscard={() => handleAction({ type: 'TAKE_DISCARD' })}
                    onPlayMeld={handlePlayMeld}
                    onAddToMeld={handleAddToMeld}
                    onDiscard={(cardId) => handleAction({ type: 'DISCARD_CARD', cardId })}
                    disabled={!isViewingActivePlayer || activeGameState.roundStatus === 'ROUND_OVER'}
                    unifiedMode={true}
                    showDrawButtons={false}
                    requiresPureSequence={(activeGameState.melds?.[viewingPlayer?.team ?? 'A']?.length ?? 0) === 0}
                  />
                }
              />
            </div>
          </section>

          {/* 5. Dev Inspector & Hot-Seat Switcher (Hidden in Multiplayer mode for fairness) */}
          {appMode === 'LOCAL' && (
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
          )}

          {/* Spacer for bottom hover mode when either team has a second row */}
          {hasSecondRow && (
            <div
              aria-hidden="true"
              data-testid="hand-dock-spacer"
              className="w-full shrink-0 h-[230px] sm:h-[260px] pointer-events-none"
            />
          )}
        </main>
      )}
        </>
      )}

      {/* =====================================================================
          MODALS
      ====================================================================== */}
      {/* 0. Mode Selector Modal */}
      <ModeSelectorModal
        isOpen={isModeModalOpen}
        onSelectLocal={() => {
          setAppMode('LOCAL');
          setSelectedCardIds([]);
          setSelectedMeldId(null);
          setDisconnectToast(null);
          setErrorMessage(null);
          setPukarBanner(null);
          setPukarSlamEvent(null);
          setJokerPickupBanner(null);
          setExhaustNotification(null);
          setIsModeModalOpen(false);
        }}
        onSelectMultiplayer={() => {
          setAppMode('MULTIPLAYER');
          setSelectedCardIds([]);
          setSelectedMeldId(null);
          setDisconnectToast(null);
          setErrorMessage(null);
          setPukarBanner(null);
          setPukarSlamEvent(null);
          setJokerPickupBanner(null);
          setExhaustNotification(null);
          setIsModeModalOpen(false);
        }}
        onClose={() => setIsModeModalOpen(false)}
      />

      {/* 1. Round Summary Modal */}
      <RoundSummaryModal
        isOpen={
          activeGameState.roundStatus === 'ROUND_OVER' ||
          activeGameState.roundStatus === 'GAME_OVER' ||
          Boolean(activeGameState.isRoundOver)
        }
        isRoundOver={
          activeGameState.roundStatus === 'ROUND_OVER' ||
          activeGameState.roundStatus === 'GAME_OVER' ||
          Boolean(activeGameState.isRoundOver)
        }
        round={activeGameState.round}
        roundScores={activeGameState.roundScores}
        totalScores={activeGameState.totalScores ?? activeGameState.scores}
        melds={activeGameState.melds}
        pukarsClaimed={activeGameState.pukarsClaimed}
        onStartNextRound={() => handleAction({ type: 'START_NEXT_ROUND' })}
      />

      {/* 2. Discard Pile History Modal */}
      <DiscardPileModal
        isOpen={isDiscardModalOpen}
        onClose={() => setIsDiscardModalOpen(false)}
        discardPile={activeGameState.discardPile}
      />

      {/* 3. Sequence Zoom Inspection Modal */}
      <SequenceZoomModal
        isOpen={Boolean(zoomedMeld)}
        meld={zoomedMeld}
        onClose={() => setZoomedMeld(null)}
      />

      {/* 4. Game Setup & New Game Modal (Local Mode Only) */}
      <GameSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        onStartGame={handleStartGame}
        initialPlayerCount={gameState.playerCount}
        initialPlayerNames={gameState.players.map((p) => p.name)}
        isGameInProgress={
          currentScreen === 'GAME' &&
          (gameState.round > 1 ||
            gameState.phase !== 'DRAW' ||
            (gameState.melds.A?.length ?? 0) > 0 ||
            (gameState.melds.B?.length ?? 0) > 0 ||
            (gameState.scores?.A ?? 0) > 0 ||
            (gameState.scores?.B ?? 0) > 0)
        }
      />

      {/* 5. Joker Designation Prompt Modal */}
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

      {/* 6. Rules & Instructions Modal */}
      {isRulesModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rules-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 lg:p-8 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setIsRulesModalOpen(false)}
        >
          <div
            className="game-modal-frame rounded-3xl max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] w-full max-h-[94vh] shadow-2xl flex flex-col overflow-hidden text-slate-100 border-2 border-amber-500/40"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-800 bg-slate-900/95 shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-inner">
                  <HelpCircle className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <h2 id="rules-modal-title" className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                    Pukar Rules &amp; Gameplay
                  </h2>
                  <p className="text-sm sm:text-base text-amber-300 font-bold mt-0.5">Royal Partner Rummy Guide</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRulesModalOpen(false)}
                className="w-11 h-11 rounded-2xl flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
                aria-label="Close Rules"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content Body: Spacious 2-Column Responsive Grid */}
            <div className="p-6 sm:p-8 lg:p-10 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7 lg:gap-8 text-sm sm:text-base lg:text-[17px] text-slate-200 leading-relaxed scrollbar-thin">
              {/* Card 1: Objective & Teams */}
              <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl sm:rounded-3xl p-6 sm:p-7 lg:p-8 shadow-md flex flex-col gap-3 sm:gap-4">
                <h3 className="font-black text-amber-300 text-base sm:text-lg lg:text-xl uppercase tracking-wider flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0" />
                  <span>Objective &amp; Teams</span>
                </h3>
                <p className="text-slate-200 leading-relaxed text-sm sm:text-base lg:text-[17px]">
                  Pukar is played in <strong className="text-white font-bold">2 partner teams</strong> (Team A vs Team B) with alternating seating. Partners collaborate and share sequences, score points together, and aim to maximize their team&apos;s cumulative score.
                </p>
                <ul className="list-disc list-inside space-y-2.5 sm:space-y-3 text-slate-200 pt-1 text-sm sm:text-base lg:text-[17px]">
                  <li>
                    <strong className="text-white font-bold">Target:</strong> Form valid sequences on the board and empty your hand to claim high-value Pukar bonus decks.
                  </li>
                  <li>
                    <strong className="text-white font-bold">Partnership:</strong> Both partners can add cards to their team&apos;s existing sequences on the table.
                  </li>
                </ul>
              </div>

              {/* Card 2: Turn Sequence */}
              <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl sm:rounded-3xl p-6 sm:p-7 lg:p-8 shadow-md flex flex-col gap-3 sm:gap-4">
                <h3 className="font-black text-amber-300 text-base sm:text-lg lg:text-xl uppercase tracking-wider flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0" />
                  <span>Turn Sequence</span>
                </h3>
                <ol className="list-decimal list-inside space-y-3 sm:space-y-3.5 text-slate-200 leading-relaxed text-sm sm:text-base lg:text-[17px]">
                  <li>
                    <strong className="text-amber-300 font-extrabold">DRAW:</strong> Draw 1 card from the face-down Stock deck OR take the entire face-up Discard pile (&ldquo;The Bottom&rdquo;).
                  </li>
                  <li>
                    <strong className="text-amber-300 font-extrabold">SEQUENCE:</strong> (Optional) Play new 3+ card sequences, or add cards to your team&apos;s existing table sequences. You can make multiple plays in one turn!
                  </li>
                  <li>
                    <strong className="text-amber-300 font-extrabold">DISCARD:</strong> (Mandatory) Discard 1 card face-up to the pile to conclude your turn.
                  </li>
                </ol>
              </div>

              {/* Card 3: Wildcards & Sequences */}
              <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl sm:rounded-3xl p-6 sm:p-7 lg:p-8 shadow-md flex flex-col gap-3 sm:gap-4">
                <h3 className="font-black text-amber-300 text-base sm:text-lg lg:text-xl uppercase tracking-wider flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0" />
                  <span>Wildcards &amp; Sequence Rules</span>
                </h3>
                <ul className="list-disc list-inside space-y-3 sm:space-y-3.5 text-slate-200 leading-relaxed text-sm sm:text-base lg:text-[17px]">
                  <li>
                    <strong className="text-amber-300 font-extrabold">Pure Opening Sequence:</strong> Each team&apos;s very first sequence on the board must be a <strong className="text-white font-bold">pure run</strong> (no jokers/wildcards; suited card 2 can only be at its natural rank 2 position). Sets are not allowed until this pure run is placed.
                  </li>
                  <li>
                    <strong className="text-white font-bold">All 2s &amp; Natural Jokers:</strong> Function as wildcards. At most 1 wildcard is permitted per sequence.
                  </li>
                  <li>
                    <strong className="text-white font-bold">Movable 2:</strong> In a run, a card 2 can dynamically float and shift position as natural cards arrive to fill its slot.
                  </li>
                  <li>
                    <strong className="text-white font-bold">Normal Joker Lock &amp; Pickup:</strong> Normal Jokers designate a fixed rank on placement. If a player holds the natural card replacing that Joker, they can play it to pick the Joker back into their hand!
                  </li>
                </ul>
              </div>

              {/* Card 4: Pukar Claim & Scoring */}
              <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl sm:rounded-3xl p-6 sm:p-7 lg:p-8 shadow-md flex flex-col gap-3 sm:gap-4">
                <h3 className="font-black text-amber-300 text-base sm:text-lg lg:text-xl uppercase tracking-wider flex items-center gap-2.5 border-b border-slate-800/80 pb-3">
                  <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0" />
                  <span>Pukar Claim &amp; Scoring</span>
                </h3>
                <ul className="list-disc list-inside space-y-2.5 sm:space-y-3 text-slate-200 leading-relaxed text-sm sm:text-base lg:text-[17px]">
                  <li>
                    <strong className="text-white font-bold">Claiming a Pukar (+50 pts):</strong> When a player empties their hand and Pukars remain in the pool, they claim an entire 13-card Pukar deck and their turn continues immediately!
                  </li>
                  <li>
                    <strong className="text-white font-bold">Round Conclusion:</strong> When the Pukar pool is exhausted and a player empties their hand, that player goes out (+50 pts) and the round terminates immediately.
                  </li>
                  <li>
                    <strong className="text-white font-bold">Pure Sequence:</strong> 7+ consecutive natural cards (0 wildcards) = <span className="text-emerald-400 font-extrabold font-mono text-base sm:text-lg">+200 pts</span>.
                  </li>
                  <li>
                    <strong className="text-white font-bold">Impure Sequence:</strong> 7+ cards with 1 wildcard = <span className="text-amber-400 font-extrabold font-mono text-base sm:text-lg">+100 pts</span>.
                  </li>
                  <li>
                    <strong className="text-white font-bold">Complete Sequence:</strong> Full 13 natural cards in suit (2-to-A) = <span className="text-emerald-400 font-extrabold font-mono text-base sm:text-lg">+500 pts</span>.
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 sm:px-8 py-4 sm:py-5 border-t border-slate-800 bg-slate-900/95 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsRulesModalOpen(false)}
                className="h-11 sm:h-12 px-8 sm:px-10 rounded-2xl text-sm sm:text-base font-black btn-game-amber cursor-pointer shadow-lg hover:scale-105 active:scale-95 transition-all"
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
