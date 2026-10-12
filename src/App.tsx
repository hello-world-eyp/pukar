import { useState, useEffect, useMemo } from 'react';
import { GameState, SanitizedGameState } from './engine/types';
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
import { PureSequenceCelebrationModal } from './ui/components/PureSequenceCelebrationModal';
import { UnclePukarChoiceModal } from './ui/components/UnclePukarChoiceModal';
import { FrustrationOverlay } from './ui/components/FrustrationOverlay';
import { GameSetupModal } from './ui/components/GameSetupModal';
import { BotSetupModal } from './ui/components/BotSetupModal';
import { ModeSelectorModal } from './ui/components/ModeSelectorModal';
import { MainMenu } from './ui/components/MainMenu';
import { MultiplayerHub } from './ui/components/multiplayer/MultiplayerHub';
import { MultiplayerStatusBar } from './ui/components/multiplayer/MultiplayerStatusBar';
import { useMultiplayerGame } from './network/useMultiplayerGame';
import { UseMultiplayerGameReturn } from './network/types';
import { BotGameConfig } from './engine/bots/types';
import {
  useGameAudio,
  useGameModals,
  useGameNotifications,
  useLocalGame,
  useTableShortcuts,
  useBotGame,
} from './ui/hooks';
import {
  HelpCircle,
  Sparkles,
  Shield,
  AlertCircle,
  X,
  Trophy,
  Info,
  Bot,
} from 'lucide-react';

export interface AppProps {
  initialState?: GameState;
  initialMode?: 'LOCAL' | 'MULTIPLAYER' | 'BOTS';
  initialScreen?: 'MENU' | 'GAME' | 'MULTIPLAYER_HUB';
  initialBotConfig?: BotGameConfig;
  multiplayerGameHook?: UseMultiplayerGameReturn;
  initialUrlRoomCode?: string;
  initialPukarBanner?: {
    team: 'A' | 'B';
    playerName: string;
    points: number;
    playerIndex?: number;
    playerId?: string;
  } | null;
  initialPukarSlamEvent?: {
    team: 'A' | 'B';
    playerName: string;
    points: number;
    playerIndex?: number;
    playerId?: string;
  } | null;
  initialJokerPickupBanner?: {
    playerName: string;
  } | null;
  initialExhaustNotification?: string | null;
}

/**
 * Extracts a 4-letter room code from a URL search query string (e.g. "?room=ABCD")
 */
export function parseRoomCodeFromUrl(urlSearch?: string): string | null {
  try {
    const search =
      urlSearch !== undefined
        ? urlSearch
        : typeof window !== 'undefined'
        ? window.location?.search ?? ''
        : '';
    if (!search) return null;
    const match = search.match(/[?&]room=([a-zA-Z0-9]{4})/i);
    if (match) {
      return match[1].toUpperCase();
    }
  } catch {
    // Ignore URL parse error
  }
  return null;
}

export function App({
  initialState,
  initialMode,
  initialScreen,
  initialBotConfig,
  multiplayerGameHook,
  initialUrlRoomCode,
  initialPukarBanner,
  initialPukarSlamEvent,
  initialJokerPickupBanner,
  initialExhaustNotification,
}: AppProps = {}) {
  // Extract room code if user arrived via shareable invite link (?room=ABCD)
  const detectedUrlRoomCode = useMemo(() => {
    if (initialUrlRoomCode) {
      const match =
        initialUrlRoomCode.match(/[?&]room=([a-zA-Z0-9]{4})/i) ||
        initialUrlRoomCode.match(/^([a-zA-Z0-9]{4})$/i);
      if (match) return match[1].toUpperCase();
      return initialUrlRoomCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || null;
    }
    return parseRoomCodeFromUrl();
  }, [initialUrlRoomCode]);

  // ---------------------------------------------------------------------------
  // Application Mode & Navigation State
  // ---------------------------------------------------------------------------
  const [appMode, setAppMode] = useState<'LOCAL' | 'MULTIPLAYER' | 'BOTS'>(
    initialMode ?? (detectedUrlRoomCode ? 'MULTIPLAYER' : 'LOCAL')
  );
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const [botConfig, setBotConfig] = useState<BotGameConfig | null>(initialBotConfig ?? null);
  const [isBotSetupModalOpen, setIsBotSetupModalOpen] = useState(false);

  const defaultInitialScreen: 'MENU' | 'GAME' | 'MULTIPLAYER_HUB' =
    initialScreen ??
    (detectedUrlRoomCode
      ? 'MULTIPLAYER_HUB'
      : typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('screen') === 'game'
      ? 'GAME'
      : initialState
      ? 'GAME'
      : initialMode === 'LOCAL' || initialMode === 'BOTS'
      ? 'GAME'
      : initialMode === 'MULTIPLAYER'
      ? multiplayerGameHook?.isInGame
        ? 'GAME'
        : 'MULTIPLAYER_HUB'
      : 'MENU');

  const [currentScreen, setCurrentScreen] = useState<'MENU' | 'GAME' | 'MULTIPLAYER_HUB'>(
    defaultInitialScreen
  );

  // Active in-game navigation tab: 'table' | 'sequences' | 'scoreboard'
  const [activeGameTab, setActiveGameTab] = useState<'table' | 'sequences' | 'scoreboard'>('table');

  // Multiplayer game lifecycle hook
  const defaultMultiplayerHook = useMultiplayerGame({
    autoConnect: !multiplayerGameHook && appMode === 'MULTIPLAYER',
  });
  const multiplayerHook = multiplayerGameHook ?? defaultMultiplayerHook;

  // Auto-transition to active game screen when multiplayer game starts
  useEffect(() => {
    if (appMode === 'MULTIPLAYER' && multiplayerHook.isInGame) {
      setCurrentScreen('GAME');
    }
  }, [appMode, multiplayerHook.isInGame]);

  // ---------------------------------------------------------------------------
  // Custom Modular Hooks
  // ---------------------------------------------------------------------------
  // 1. Audio management
  const { isMuted, toggleMute, triggerSound } = useGameAudio();

  // 2. Modal dialogs and prompt state
  const {
    isGodModeOpen,
    setIsGodModeOpen,
    isDiscardModalOpen,
    setIsDiscardModalOpen,
    isRulesModalOpen,
    setIsRulesModalOpen,
    isSetupModalOpen,
    setIsSetupModalOpen,
    zoomedMeld,
    setZoomedMeld,
    jokerPromptData,
    setJokerPromptData,
    unclePukarChoiceData,
    setUnclePukarChoiceData,
  } = useGameModals();

  // 3. User feedback, toasts, and celebration overlays
  const {
    errorMessage,
    setErrorMessage,
    disconnectToast,
    setDisconnectToast,
    pukarBanner,
    setPukarBanner,
    pukarSlamEvent,
    setPukarSlamEvent,
    isTableRippling,
    setIsTableRippling,
    exhaustNotification,
    setExhaustNotification,
    jokerPickupBanner,
    setJokerPickupBanner,
    pureSequenceCelebration,
    setPureSequenceCelebration,
    triggerPukarCelebration,
    triggerPureSequenceCelebration,
    clearAllNotifications,
  } = useGameNotifications({
    initialPukarBanner,
    initialPukarSlamEvent,
    initialJokerPickupBanner,
    initialExhaustNotification,
    appMode,
    multiplayerHook,
    triggerSound,
  });

  // 4. Core local game state machine & action handlers
  const {
    gameState,
    activeGameState,
    activeTurnIndex,
    activePlayer,
    currentViewIndex,
    viewingPlayer,
    isViewingActivePlayer,
    isMultiplayerActive,
    selectedCardIds,
    setSelectedCardIds,
    selectedCards,
    selectedMeldId,
    setSelectedMeldId,
    selectedMeld,
    setViewedPlayerIndex,
    handleAction,
    handleToggleCardSelection,
    handleClearSelection,
    handleReorderHand,
    handlePlayMeld,
    handleAddToMeld,
    handleSwitchPlayer,
    handleForceTurn,
  } = useLocalGame({
    initialState,
    appMode,
    multiplayerHook,
    triggerSound,
    setErrorMessage,
    triggerPukarCelebration,
    triggerPureSequenceCelebration,
    setExhaustNotification,
    setJokerPickupBanner,
    clearAllNotifications,
    setJokerPromptData,
  });

  // 5. Global table shortcuts (keystroke optimization)
  useTableShortcuts({
    currentScreen,
    onAction: handleAction,
  });

  // 6. Bot game orchestrator (active when appMode === 'BOTS')
  const { botStatus } = useBotGame({
    appMode,
    gameState: activeGameState as GameState,
    botConfig,
    handleAction,
    turnDelayMs: 650,
  });

  // ---------------------------------------------------------------------------
  // Responsive layout tracking
  // ---------------------------------------------------------------------------
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

  const teamAMeldCount = activeGameState.melds?.A?.length ?? 0;
  const teamBMeldCount = activeGameState.melds?.B?.length ?? 0;
  const hasSecondRow =
    teamAMeldCount >= 3 ||
    teamBMeldCount >= 3 ||
    (isCompactScreen && (teamAMeldCount >= 2 || teamBMeldCount >= 2));

  // ---------------------------------------------------------------------------
  // Auspicious Pukar Deck Selection State Tracking
  // ---------------------------------------------------------------------------
  const remainingPukars =
    'pukarPool' in activeGameState && Array.isArray(activeGameState.pukarPool)
      ? activeGameState.pukarPool.length
      : ((activeGameState as SanitizedGameState).pukarPoolCount ?? 0);

  const isClaimingPlayer =
    appMode !== 'MULTIPLAYER' ||
    (multiplayerHook.mySeatIndex !== null &&
      ((unclePukarChoiceData?.playerIndex !== undefined &&
        multiplayerHook.mySeatIndex === unclePukarChoiceData.playerIndex) ||
        (pukarSlamEvent?.playerIndex !== undefined &&
          multiplayerHook.mySeatIndex === pukarSlamEvent.playerIndex) ||
        multiplayerHook.mySeatIndex === activeTurnIndex));

  const isPukarSelectionPending = Boolean(
    (unclePukarChoiceData?.isOpen || (pukarSlamEvent && remainingPukars >= 1)) &&
      isClaimingPlayer
  );

  // ---------------------------------------------------------------------------
  // Game Setup & Reset Handlers
  // ---------------------------------------------------------------------------
  const handleOpenResetModal = (_count?: 4 | 6) => {
    try {
      if (appMode === 'LOCAL') {
        setIsSetupModalOpen(true);
      } else if (appMode === 'BOTS') {
        setIsBotSetupModalOpen(true);
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

  const handleStartBotGame = (config: BotGameConfig, _playerName: string) => {
    try {
      const names = config.seats.map((s) => s.name);
      setBotConfig(config);
      setAppMode('BOTS');
      handleAction({
        type: 'RESET_GAME',
        playerCount: config.playerCount,
        playerNames: names,
      });
      setIsBotSetupModalOpen(false);
      setViewedPlayerIndex(null);
      setSelectedCardIds([]);
      setSelectedMeldId(null);
      setCurrentScreen('GAME');
    } catch (err) {
      console.error('Error starting game with bots:', err);
      setIsBotSetupModalOpen(false);
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
          onPlayBots={() => {
            setIsBotSetupModalOpen(true);
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
                : appMode === 'BOTS'
                ? () => setIsBotSetupModalOpen(true)
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

        {/* Bot Thinking / Action Status Banner */}
        {appMode === 'BOTS' && botStatus && botStatus.isThinking && (
          <div
            data-testid="bot-thinking-banner"
            role="status"
            className="flex items-center justify-between gap-3 px-4 py-2 rounded-xl bg-indigo-950/90 border border-indigo-500/70 text-indigo-200 shadow-lg shadow-indigo-950/50 text-xs sm:text-sm animate-pulse"
          >
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-bold text-white">{botStatus.botName}</span>
              <span className="text-indigo-300 font-medium">
                {botStatus.phase === 'DRAW'
                  ? 'is deciding whether to draw from stock or discard pile...'
                  : botStatus.phase === 'MELD'
                  ? 'is arranging sequences on the table...'
                  : 'is discarding a card to the pile...'}
              </span>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              AI Turn
            </span>
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
            initialRoomCode={detectedUrlRoomCode ?? undefined}
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
                      (isMultiplayerActive
                        ? (activeGameState as SanitizedGameState).pukarPoolCount
                        : gameState.pukarPool.length) + (isPukarSelectionPending ? 1 : 0)
                    }
                    canDraw={activeGameState.phase === 'DRAW' && isViewingActivePlayer}
                    onDrawStock={() => handleAction({ type: 'DRAW_FROM_STOCK' })}
                    onDrawDiscard={() => handleAction({ type: 'TAKE_DISCARD' })}
                    onPeekDiscard={() => setIsDiscardModalOpen(true)}
                    canDropToDiscard={
                      (activeGameState.phase === 'MELD' || activeGameState.phase === 'DISCARD') &&
                      isViewingActivePlayer &&
                      activeGameState.roundStatus !== 'ROUND_OVER'
                    }
                    onDropToDiscard={(cardId) => handleAction({ type: 'DISCARD_CARD', cardId })}
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
                cards={
                  isPukarSelectionPending && isViewingActivePlayer
                    ? []
                    : (viewingPlayer.hand ?? [])
                }
                isChoosingPukar={isPukarSelectionPending && isViewingActivePlayer}
                cardSize="md"
                selectedCardIds={selectedCardIds}
                newCardIds={
                  isViewingActivePlayer
                    ? (activeGameState.newlyPickedUpCardIds ?? [])
                    : []
                }
                cardsPickedUpThisTurn={
                  isViewingActivePlayer
                    ? (activeGameState.cardsPickedUpThisTurn ?? [])
                    : []
                }
                initialHandSizeThisTurn={
                  isViewingActivePlayer
                    ? activeGameState.initialHandSizeThisTurn
                    : undefined
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
                frustrationCooldownUntil={activeGameState.frustrationCooldownUntil}
                onTriggerFrustration={() =>
                  handleAction({
                    type: 'TRIGGER_FRUSTRATION',
                    playerName: viewingPlayer?.name ?? 'Player',
                  })
                }
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
                    cardsPickedUpThisTurn={activeGameState.cardsPickedUpThisTurn}
                    initialHandSizeThisTurn={activeGameState.initialHandSizeThisTurn}
                  />
                }
              />
            </div>
          </section>

          {/* 5. Dev Inspector & Hot-Seat Switcher (Hidden in Multiplayer mode for fairness) */}
          {(appMode === 'LOCAL' || appMode === 'BOTS') && (
            <section aria-label="Hot-Seat Tools & Dev Inspector" className="shrink-0">
              <DevInspector
                players={gameState.players}
                currentPlayerIndex={currentViewIndex}
                activeTurnIndex={activeTurnIndex}
                onSwitchPlayer={handleSwitchPlayer}
                onForceTurn={handleForceTurn}
                stockDeckCount={gameState.stockDeck.length}
                discardPileCount={gameState.discardPile.length}
                pukarPoolCount={
                  gameState.pukarPool.length + (isPukarSelectionPending ? 1 : 0)
                }
                isGodModeOpen={isGodModeOpen}
                onToggleGodMode={() => setIsGodModeOpen((prev) => !prev)}
                onPreviewCelebration={() =>
                  triggerPureSequenceCelebration({
                    team: viewingPlayer?.team ?? 'A',
                    playerName: viewingPlayer?.name ?? 'Player 1',
                    suit: 'SPADES',
                  })
                }
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
        onSelectBots={() => {
          setIsModeModalOpen(false);
          setIsBotSetupModalOpen(true);
        }}
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

      {/* Bot Match Setup Modal */}
      <BotSetupModal
        isOpen={isBotSetupModalOpen}
        onClose={() => setIsBotSetupModalOpen(false)}
        onStartBotGame={handleStartBotGame}
        initialPlayerCount={gameState.playerCount}
        initialPlayerName={gameState.players[0]?.name === 'Player 1' ? 'You' : gameState.players[0]?.name}
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
          onClose={() => {
            const eventInfo = pukarSlamEvent;
            setPukarSlamEvent(null);
            const remainingPukars =
              'pukarPool' in activeGameState && Array.isArray(activeGameState.pukarPool)
                ? activeGameState.pukarPool.length
                : ((activeGameState as SanitizedGameState).pukarPoolCount ?? 0);

            if (remainingPukars >= 1) {
              // In multiplayer, the Uncle Pukar deck selection modal must ONLY be shown
              // to the specific player who earned the Pukar. Other players must not see it.
              const isClaimingPlayer =
                appMode === 'BOTS'
                  ? (eventInfo?.playerIndex === undefined || eventInfo?.playerIndex === 0)
                  : appMode !== 'MULTIPLAYER' ||
                    (multiplayerHook.mySeatIndex !== null &&
                      eventInfo?.playerIndex !== undefined &&
                      multiplayerHook.mySeatIndex === eventInfo.playerIndex) ||
                    Boolean(
                      multiplayerHook.myPlayerId &&
                        eventInfo?.playerId &&
                        multiplayerHook.myPlayerId === eventInfo.playerId
                    ) ||
                    (multiplayerHook.mySeatIndex !== null &&
                      Boolean(eventInfo?.playerName) &&
                      activeGameState.players[multiplayerHook.mySeatIndex]?.name === eventInfo?.playerName);

              if (isClaimingPlayer) {
                setUnclePukarChoiceData({
                  isOpen: true,
                  availableDecksCount: remainingPukars + 1,
                  playerName: eventInfo?.playerName ?? 'Player',
                  team: eventInfo?.team ?? 'A',
                  playerIndex: eventInfo?.playerIndex,
                  playerId: eventInfo?.playerId,
                });
              }
            }
          }}
          onImpact={() => {
            setIsTableRippling(true);
            setTimeout(() => setIsTableRippling(false), 1200);
          }}
        />
      )}

      {/* Sid's Auspicious Pukar Time Deck Selection Modal */}
      {unclePukarChoiceData &&
        unclePukarChoiceData.isOpen &&
        (appMode === 'BOTS'
          ? (unclePukarChoiceData.playerIndex === undefined || unclePukarChoiceData.playerIndex === 0)
          : appMode !== 'MULTIPLAYER' ||
            (multiplayerHook.mySeatIndex !== null &&
              (unclePukarChoiceData.playerIndex === undefined ||
                multiplayerHook.mySeatIndex === unclePukarChoiceData.playerIndex) &&
              (unclePukarChoiceData.playerId === undefined ||
                multiplayerHook.myPlayerId === unclePukarChoiceData.playerId))) && (
        <UnclePukarChoiceModal
          isOpen={unclePukarChoiceData.isOpen}
          availableDecksCount={unclePukarChoiceData.availableDecksCount}
          playerName={unclePukarChoiceData.playerName}
          team={unclePukarChoiceData.team}
          onSelectDeck={(deckIndex) => {
            handleAction({ type: 'SELECT_PUKAR_DECK', deckIndex });
            setUnclePukarChoiceData(null);
          }}
          onClose={() => {
            handleAction({ type: 'SELECT_PUKAR_DECK', deckIndex: 0 });
            setUnclePukarChoiceData(null);
          }}
        />
      )}

      {/* 10-Second Frustration Animation Overlay */}
      {activeGameState.activeFrustration && (
        <FrustrationOverlay
          playerName={activeGameState.activeFrustration.playerName}
          onComplete={() => handleAction({ type: 'CLEAR_FRUSTRATION' })}
        />
      )}

      {/* 10-Second 500-Point Pure Sequence Celebration Modal */}
      {pureSequenceCelebration && (
        <PureSequenceCelebrationModal
          team={pureSequenceCelebration.team}
          playerName={pureSequenceCelebration.playerName}
          suit={pureSequenceCelebration.suit}
          onClose={() => setPureSequenceCelebration(null)}
        />
      )}
    </div>
  );
}

export default App;
