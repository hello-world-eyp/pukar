import React from 'react';
import {
  RotateCcw,
  Volume2,
  VolumeX,
  Home,
  Download,
  Eye,
  EyeOff,
  Mic,
  MicOff,
  ChevronDown,
  Shield,
  Lock,
  Unlock,
  X,
} from 'lucide-react';

export interface PlayerInfo {
  id: string;
  name: string;
  team: 'A' | 'B';
  cardCount?: number;
  isConnected?: boolean;
}

export interface VoiceChatControlProps {
  isVoiceSupported: boolean;
  isVoiceActive: boolean;
  isMuted: boolean;
  isHardMuted: boolean;
  onToggleMic: () => void;
  isAdmin: boolean;
  myPlayerId?: string | null;
  onAdminMutePlayer?: (targetPlayerId: string, muteType: 'TEMP' | 'HARD' | 'UNMUTE') => void;
  playerVoiceStates?: Record<string, { isMuted: boolean; isHardMuted: boolean; isSpeaking?: boolean }>;
}

export interface TopNavBarProps {
  activeTab: 'table' | 'sequences' | 'scoreboard';
  onTabChange: (tab: 'table' | 'sequences' | 'scoreboard') => void;
  onOpenRules: () => void;
  players: PlayerInfo[];
  currentPlayerIndex: number;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onNewGame?: () => void;
  onExitToMenu?: () => void;
  onExportDebugLog?: () => void;
  gameTitle?: string;
  roomCode?: string | null;
  consolidatePlayers?: boolean;
  isHandCollapsed?: boolean;
  onToggleHandCollapse?: () => void;
  voiceChat?: VoiceChatControlProps;
}

// Distinctive team avatar shades:
// Team A: Cyan shade (Player 1, 3, 5)
// Team B: Amber shade (Player 2, 4, 6)
export const TEAM_AVATAR_PALETTE: Record<'A' | 'B', { bg: string }> = {
  A: { bg: 'bg-cyan-200 text-cyan-950 ring-cyan-400' },
  B: { bg: 'bg-amber-300 text-amber-950 ring-amber-400' },
};

export const TopNavBar: React.FC<TopNavBarProps> = ({
  activeTab,
  onTabChange,
  onOpenRules,
  players,
  currentPlayerIndex,
  isMuted = false,
  onToggleMute,
  onNewGame,
  onExitToMenu,
  onExportDebugLog,
  gameTitle,
  roomCode,
  consolidatePlayers,
  isHandCollapsed = false,
  onToggleHandCollapse,
  voiceChat,
}) => {
  const displayTitle = roomCode ? `Room ${roomCode}` : gameTitle;

  const headerRef = React.useRef<HTMLElement | null>(null);
  const adminMenuRef = React.useRef<HTMLDivElement | null>(null);
  const uncollapsedWidthRef = React.useRef<number | null>(null);
  const [isAutoConsolidated, setIsAutoConsolidated] = React.useState(false);
  const [isAdminVoiceOpen, setIsAdminVoiceOpen] = React.useState(false);

  // Close admin voice dropdown if clicked outside
  React.useEffect(() => {
    if (!isAdminVoiceOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target as Node)) {
        setIsAdminVoiceOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAdminVoiceOpen]);

  // When consolidatePlayers is explicitly passed, it overrides auto-detection
  const isConsolidated =
    consolidatePlayers !== undefined ? consolidatePlayers : isAutoConsolidated;

  // Reset cached measurement and auto-consolidation state if player count changes
  React.useEffect(() => {
    uncollapsedWidthRef.current = null;
    setIsAutoConsolidated(false);
  }, [players.length]);

  // Monitor header dimensions and consolidate roster when horizontal scroll would occur
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (consolidatePlayers !== undefined) return;

    const checkOverflow = () => {
      const el = headerRef.current;
      if (!el) return;

      if (!isConsolidated) {
        // Full roster is currently shown. Detect if content overflows container width.
        // A threshold of > 2px guards against fractional subpixel discrepancies.
        if (el.scrollWidth - el.clientWidth > 2) {
          uncollapsedWidthRef.current = el.scrollWidth;
          setIsAutoConsolidated(true);
        }
      } else {
        // Consolidated to active player. Check if container has widened enough to fit full roster.
        const cachedWidth = uncollapsedWidthRef.current;
        if (cachedWidth && el.clientWidth >= cachedWidth + 16) {
          setIsAutoConsolidated(false);
          uncollapsedWidthRef.current = null;
        }
      }
    };

    checkOverflow();

    window.addEventListener('resize', checkOverflow);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && headerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        checkOverflow();
      });
      resizeObserver.observe(headerRef.current);
    }

    return () => {
      window.removeEventListener('resize', checkOverflow);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [isConsolidated, consolidatePlayers, players.length]);

  const activeIndex =
    currentPlayerIndex >= 0 && currentPlayerIndex < players.length
      ? currentPlayerIndex
      : 0;

  const displayedPlayers =
    isConsolidated && players.length > 0
      ? [{ player: players[activeIndex], originalIndex: activeIndex }]
      : players.map((player, idx) => ({ player, originalIndex: idx }));

  return (
    <header
      ref={headerRef}
      data-testid="top-nav-bar"
      data-consolidated={isConsolidated ? 'true' : 'false'}
      className={`w-full min-h-[64px] sm:min-h-[72px] bg-[#0e121d] border-b border-slate-800/80 px-4 sm:px-8 py-3 text-slate-100 flex items-center justify-between gap-4 shadow-xl z-30 selection:bg-amber-500/30 overflow-y-hidden ${
        isConsolidated ? 'overflow-x-hidden' : 'overflow-x-auto'
      }`}
    >
      {/* =====================================================================
          1. LEFT: LOGO, TITLE, AND NAVIGATION PILLS
      ====================================================================== */}
      <div className="flex items-center gap-5 sm:gap-7 shrink-0">
        {/* Branding & Subtitle */}
        <div className="flex items-center gap-3.5 shrink-0">
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-lime-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-md shrink-0">
            ♠
          </div>
          <div className="flex items-center gap-3">
            <span className="font-black text-xl sm:text-2xl tracking-tight text-white lowercase">
              pukar
            </span>
            {displayTitle ? (
              <span className="text-sm text-slate-400 font-semibold truncate max-w-[130px] sm:max-w-[200px] hidden md:inline">
                {displayTitle}
              </span>
            ) : null}
          </div>
        </div>

        {/* Navigation Tabs (Table, Sequences, Scoreboard, How to play) */}
        <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="Game navigation">
          {/* Table Tab */}
          <button
            type="button"
            data-testid="tab-table"
            onClick={() => onTabChange('table')}
            className={`h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-sm font-bold transition-all flex items-center justify-center cursor-pointer ${
              activeTab === 'table'
                ? 'bg-slate-100 text-slate-950 shadow-md scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Table
          </button>

          {/* Sequences Tab (Not Meld) */}
          <button
            type="button"
            data-testid="tab-sequences"
            onClick={() => onTabChange('sequences')}
            className={`h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-sm font-bold transition-all flex items-center justify-center cursor-pointer ${
              activeTab === 'sequences'
                ? 'bg-slate-100 text-slate-950 shadow-md scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Sequences
          </button>

          {/* Scoreboard Tab */}
          <button
            type="button"
            data-testid="tab-scoreboard"
            onClick={() => onTabChange('scoreboard')}
            className={`h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-sm font-bold transition-all flex items-center justify-center cursor-pointer ${
              activeTab === 'scoreboard'
                ? 'bg-slate-100 text-slate-950 shadow-md scale-[1.02]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Scoreboard
          </button>

          {/* How to Play Tab */}
          <button
            type="button"
            data-testid="tab-how-to-play"
            id="btn-rules-modal"
            onClick={onOpenRules}
            className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all flex items-center justify-center cursor-pointer"
          >
            How to play
          </button>
        </nav>
      </div>

      {/* =====================================================================
          2. RIGHT: PLAYER AVATARS (WITH CURRENT TURN HIGHLIGHTED) & NEW GAME
      ====================================================================== */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Player Roster with Initials & Active Turn Glow */}
        <div
          data-testid="nav-players-roster"
          data-consolidated={isConsolidated ? 'true' : 'false'}
          className="flex items-center gap-2 sm:gap-2.5 flex-wrap"
          aria-label="Players in game"
        >
          {displayedPlayers.map(({ player, originalIndex }) => {
            const isTurn = originalIndex === currentPlayerIndex;
            const initial = player.name ? player.name.trim().charAt(0).toUpperCase() : `${originalIndex + 1}`;
            const isTeamA = player.team ? player.team === 'A' : originalIndex % 2 === 0;
            const palette = isTeamA ? TEAM_AVATAR_PALETTE.A : TEAM_AVATAR_PALETTE.B;

            return (
              <div
                key={player.id || `nav-p-${originalIndex}`}
                data-testid={`nav-player-${originalIndex}`}
                className={`h-10 sm:h-11 flex items-center gap-2 px-2.5 sm:px-3 rounded-xl transition-all ${
                  isTurn
                    ? 'bg-amber-400/15 border border-amber-400/60 shadow-md shadow-amber-400/10 ring-1 ring-amber-400/40 text-white'
                    : 'text-slate-300'
                }`}
                title={`${player.name} (${player.team ? `Team ${player.team}` : ''})${player.cardCount !== undefined ? ` • ${player.cardCount} cards` : ''}${isTurn ? ' • Current Turn' : ''}${isConsolidated && players.length > 1 ? ` • (${players.length} players in game)` : ''}`}
              >
                {/* Circular Avatar Badge with Initial */}
                <div
                  className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center font-black text-xs sm:text-sm shadow-sm shrink-0 ${
                    palette.bg
                  } ${isTurn ? 'ring-2 ring-amber-400 scale-105' : ''}`}
                >
                  {initial}
                </div>

                {/* Player Name */}
                <span className="text-sm font-bold tracking-tight truncate max-w-[90px] sm:max-w-[130px]">
                  {player.name}
                </span>

                {/* Card Count in Hand */}
                {player.cardCount !== undefined && (
                  <span
                    data-testid={`nav-player-card-count-${originalIndex}`}
                    className={`text-xs font-bold shrink-0 ${
                      isTurn ? 'text-amber-300 font-extrabold' : 'text-slate-400'
                    }`}
                  >
                    {`(${player.cardCount})`}
                  </span>
                )}

                {/* Turn Highlight Indicator Dot */}
                {isTurn && (
                  <span
                    data-testid="turn-indicator-dot"
                    className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse ml-0.5 shrink-0"
                    title="Active Turn"
                  />
                )}

                {/* Disconnected Indicator Dot */}
                {player.isConnected === false && (
                  <span
                    data-testid={`nav-player-disconnect-${originalIndex}`}
                    className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse ml-0.5 shrink-0"
                    title="Player Disconnected"
                  />
                )}

                {/* Voice Status Indicator Dot / Badge */}
                {voiceChat?.playerVoiceStates?.[player.id] && (
                  (() => {
                    const vs = voiceChat.playerVoiceStates[player.id];
                    if (vs.isHardMuted) {
                      return (
                        <span
                          data-testid={`voice-locked-${originalIndex}`}
                          className="w-4 h-4 rounded-full bg-red-950 border border-red-500 text-red-400 flex items-center justify-center shrink-0 ml-0.5"
                          title="Microphone locked by host"
                        >
                          <Lock className="w-2.5 h-2.5" />
                        </span>
                      );
                    }
                    if (vs.isMuted) {
                      return (
                        <span
                          data-testid={`voice-muted-${originalIndex}`}
                          className="w-4 h-4 rounded-full bg-stone-800 border border-stone-600 text-stone-400 flex items-center justify-center shrink-0 ml-0.5"
                          title="Microphone muted"
                        >
                          <MicOff className="w-2.5 h-2.5" />
                        </span>
                      );
                    }
                    return (
                      <span
                        data-testid={`voice-active-${originalIndex}`}
                        className="w-4 h-4 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-400 flex items-center justify-center shrink-0 ml-0.5 animate-pulse"
                        title="Speaking"
                      >
                        <Mic className="w-2.5 h-2.5" />
                      </span>
                    );
                  })()
                )}
              </div>
            );
          })}
        </div>


        {/* Voice Chat Controls (Mic Toggle & Admin Moderation Dropdown) */}
        {voiceChat && (
          <div className="relative flex items-center shrink-0" ref={adminMenuRef}>
            {/* Main Mic Toggle Button */}
            {voiceChat.isHardMuted ? (
              <button
                type="button"
                data-testid="btn-mic-locked"
                disabled
                title="Microphone locked by room host"
                className="h-10 sm:h-11 px-3 rounded-xl bg-red-950/70 border border-red-800 text-red-400 cursor-not-allowed flex items-center gap-1.5 font-bold text-xs shadow-sm shrink-0"
              >
                <Lock className="w-4 h-4 text-red-400 shrink-0" />
                <span className="hidden lg:inline">Mic Locked</span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="btn-mic-toggle"
                onClick={voiceChat.onToggleMic}
                title={
                  !voiceChat.isVoiceActive
                    ? 'Turn on microphone'
                    : voiceChat.isMuted
                    ? 'Unmute microphone'
                    : 'Mute microphone'
                }
                className={`h-10 sm:h-11 px-3 ${
                  voiceChat.isAdmin && voiceChat.onAdminMutePlayer ? 'rounded-l-xl' : 'rounded-xl'
                } border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 font-bold text-xs sm:text-sm shadow-sm ${
                  !voiceChat.isVoiceActive || voiceChat.isMuted
                    ? 'bg-slate-900 border-slate-700 text-stone-300 hover:text-white hover:bg-slate-800'
                    : 'bg-emerald-950 border-emerald-500 text-emerald-300 ring-2 ring-emerald-400/40 shadow-emerald-500/20'
                }`}
              >
                {!voiceChat.isVoiceActive || voiceChat.isMuted ? (
                  <MicOff className="w-4 h-4 text-stone-400 shrink-0" />
                ) : (
                  <Mic className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                )}
                <span className="hidden md:inline">
                  {!voiceChat.isVoiceActive
                    ? 'Join Voice'
                    : voiceChat.isMuted
                    ? 'Mic Muted'
                    : 'Mic Active'}
                </span>
              </button>
            )}

            {/* Admin Moderation Dropdown Caret Button (Host Only) */}
            {voiceChat.isAdmin && voiceChat.onAdminMutePlayer && (
              <button
                type="button"
                data-testid="btn-admin-voice-dropdown"
                onClick={() => setIsAdminVoiceOpen((prev) => !prev)}
                title="Admin Voice Moderation"
                className={`h-10 sm:h-11 px-2.5 rounded-r-xl border-y border-r transition-colors flex items-center justify-center cursor-pointer shrink-0 ${
                  isAdminVoiceOpen
                    ? 'bg-amber-400 text-stone-950 border-amber-300 font-black'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400'
                }`}
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-150 ${
                    isAdminVoiceOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            )}

            {/* Admin Voice Moderation Panel Popover */}
            {isAdminVoiceOpen && voiceChat.isAdmin && voiceChat.onAdminMutePlayer && (
              <div
                data-testid="admin-voice-panel"
                className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-amber-500/50 shadow-2xl p-3 z-50 flex flex-col gap-2.5 text-slate-100 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-black uppercase tracking-wider">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Host Voice Controls</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAdminVoiceOpen(false)}
                    className="p-1 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                  {players
                    .filter((p) => p.id && (!voiceChat.myPlayerId || p.id !== voiceChat.myPlayerId))
                    .map((p) => {
                      const vs = voiceChat.playerVoiceStates?.[p.id];
                      const isLocked = Boolean(vs?.isHardMuted);
                      return (
                        <div
                          key={`admin-mod-${p.id}`}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-800/80 border border-slate-700/60"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-white truncate max-w-[110px]">
                              {p.name}
                            </span>
                            <span className="text-[10px] text-slate-400">Team {p.team}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              data-testid={`btn-mute-temp-${p.id}`}
                              onClick={() => {
                                voiceChat.onAdminMutePlayer?.(p.id, 'TEMP');
                              }}
                              title="Temporarily mute this player (player can unmute)"
                              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer"
                            >
                              Mute Temp
                            </button>

                            {isLocked ? (
                              <button
                                type="button"
                                data-testid={`btn-unlock-${p.id}`}
                                onClick={() => {
                                  voiceChat.onAdminMutePlayer?.(p.id, 'UNMUTE');
                                }}
                                title="Unlock player's microphone"
                                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Unlock className="w-2.5 h-2.5" />
                                <span>Unlock</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                data-testid={`btn-lock-${p.id}`}
                                onClick={() => {
                                  voiceChat.onAdminMutePlayer?.(p.id, 'HARD');
                                }}
                                title="Permanently lock player's mic until you unlock it"
                                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-red-600 hover:bg-red-500 text-white transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Lock className="w-2.5 h-2.5" />
                                <span>Lock</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sound Toggle */}
        {onToggleMute && (
          <button
            type="button"
            data-testid="btn-sound-toggle"
            onClick={onToggleMute}
            className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl border transition-colors flex items-center justify-center cursor-pointer shrink-0 ${
              isMuted
                ? 'bg-red-950/60 text-red-300 border-red-800/80 hover:bg-red-900/60'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 shadow-sm'
            }`}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        )}

        {/* Download Debug Log */}
        {onExportDebugLog && (
          <button
            type="button"
            data-testid="btn-download-debug-log"
            onClick={onExportDebugLog}
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer shrink-0 shadow-sm"
            title="Download Debug Log (Shortcut: qq)"
            aria-label="Download Debug Log"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5 text-lime-400" />
          </button>
        )}

        {/* Quick Toggle Hand Visibility */}
        {onToggleHandCollapse && (
          <button
            type="button"
            data-testid="btn-top-nav-toggle-hand"
            onClick={onToggleHandCollapse}
            className={`h-10 sm:h-11 px-3 sm:px-3.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 font-bold text-xs sm:text-sm shadow-sm ${
              isHandCollapsed
                ? 'bg-amber-400 text-stone-950 border-amber-300 ring-2 ring-amber-400/50 shadow-amber-500/30'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title={isHandCollapsed ? 'Show your hand cards' : 'Hide your hand cards to view the table'}
            aria-label={isHandCollapsed ? 'Show Cards' : 'Hide Cards'}
          >
            {isHandCollapsed ? (
              <>
                <Eye className="w-4 h-4 text-stone-950 shrink-0" />
                <span className="hidden sm:inline">Show Cards</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 text-slate-300 shrink-0" />
                <span className="hidden sm:inline">Hide Cards</span>
              </>
            )}
          </button>
        )}

        {/* Menu Button if provided */}
        {onExitToMenu && (
          <button
            type="button"
            data-testid="btn-exit-to-menu"
            onClick={onExitToMenu}
            className="h-10 sm:h-11 px-3.5 sm:px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
            title="Return to Main Menu"
          >
            <Home className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Menu</span>
          </button>
        )}

        {/* Extreme Right: New Game Option */}
        {onNewGame && (
          <button
            type="button"
            data-testid="btn-restart-game"
            onClick={onNewGame}
            className="h-10 sm:h-11 px-4 sm:px-4.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
            title="Start New Game / Change Configuration"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">New Game</span>
          </button>
        )}
      </div>
    </header>
  );
};
