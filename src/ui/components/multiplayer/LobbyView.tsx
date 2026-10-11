import React, { useState } from 'react';
import { Copy, Check, Play, UserMinus, Share2 } from 'lucide-react';
import { LobbySeat } from '../../../network/types';

export interface LobbyViewProps {
  roomCode: string;
  seats: LobbySeat[];
  myPlayerId: string | null;
  isHost: boolean;
  inviteUrl?: string;
  onSelectSeat: (seatIndex: number) => void;
  onStartGame: () => void;
  onKickPlayer?: (seatIndex: number) => void;
  onLeaveLobby: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomCode,
  seats,
  myPlayerId,
  isHost,
  inviteUrl,
  onSelectSeat,
  onStartGame,
  onKickPlayer,
  onLeaveLobby,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const timerCodeRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerLinkRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const occupiedCount = seats.filter((s) => s.playerId !== null).length;
  const isFull = seats.length > 0 && occupiedCount === seats.length;

  React.useEffect(() => {
    return () => {
      if (timerCodeRef.current) clearTimeout(timerCodeRef.current);
      if (timerLinkRef.current) clearTimeout(timerLinkRef.current);
    };
  }, []);

  const getInviteLink = () => {
    if (inviteUrl) return inviteUrl;
    try {
      if (typeof window !== 'undefined' && window.location) {
        const origin = window.location.origin || '';
        const pathname = window.location.pathname || '';
        return `${origin}${pathname}?room=${roomCode}`;
      }
    } catch {
      // Safe fallback
    }
    return `?room=${roomCode}`;
  };

  const handleCopyCode = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(roomCode).catch(() => {});
      }
    } catch {
      // Safe fallback if clipboard API is not available
    }
    setCopiedCode(true);
    if (timerCodeRef.current) clearTimeout(timerCodeRef.current);
    timerCodeRef.current = setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const link = getInviteLink();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(link).catch(() => {});
      }
    } catch {
      // Safe fallback if clipboard API is not available
    }
    setCopiedLink(true);
    if (timerLinkRef.current) clearTimeout(timerLinkRef.current);
    timerLinkRef.current = setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div
      data-testid="multiplayer-lobby-view"
      className="w-full max-w-2xl mx-auto bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl text-stone-100 flex flex-col gap-6"
    >
      {/* Header & Room Code Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-stone-800">
        <div>
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Room Code</span>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
            <span
              data-testid="room-code-display"
              className="text-3xl font-black tracking-widest text-amber-400 font-mono select-all mr-1"
            >
              {roomCode}
            </span>
            <button
              data-testid="btn-copy-code"
              onClick={handleCopyCode}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Copy Room Code"
              aria-label="Copy Room Code"
            >
              {copiedCode ? (
                <>
                  <Check data-testid="copy-success-indicator" className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="hidden sm:inline">Copy Code</span>
                </>
              )}
            </button>
            <button
              data-testid="btn-copy-invite-link"
              onClick={handleCopyLink}
              className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-sm"
              title="Copy Shareable Invite Link"
              aria-label="Copy Invite Link"
            >
              {copiedLink ? (
                <>
                  <Check data-testid="copy-link-success-indicator" className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-black text-emerald-400">Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Copy Invite Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="text-center sm:text-right">
          <span className="text-xs font-bold text-stone-400 block">Lobby Status</span>
          <div
            data-testid="lobby-status-indicator"
            className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 justify-center sm:justify-end mt-1"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isFull ? 'bg-emerald-400' : 'bg-emerald-500 animate-pulse'
              }`}
            />
            {isFull ? (
              <span className="text-emerald-300 font-bold">{`Lobby Full (${occupiedCount}/${seats.length})`}</span>
            ) : (
              <span>{`Waiting for players (${occupiedCount}/${seats.length})`}</span>
            )}
          </div>
        </div>
      </div>

      {/* Team Seating Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-stone-400">
            Seating Arrangement (Alternating Teams)
          </h3>
          <span className="text-[11px] text-stone-500">
            Team A (Emerald) vs Team B (Violet)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="seating-grid">
          {seats.map((seat) => {
            const isMe = seat.playerId !== null && seat.playerId === myPlayerId;
            const isTeamA = seat.team === 'A';
            const seatLabel = `${seat.team}${Math.floor(seat.seatIndex / 2) + 1}`;

            return (
              <div
                key={seat.seatIndex}
                data-testid={`seat-card-${seat.seatIndex}`}
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                  isMe
                    ? 'border-amber-500/80 bg-amber-500/10 shadow-sm shadow-amber-500/10'
                    : seat.playerId
                    ? 'border-stone-700 bg-stone-800/60'
                    : 'border-dashed border-stone-700/60 bg-stone-800/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Team Badge */}
                  <div
                    data-testid={`team-badge-${seat.seatIndex}`}
                    className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                      isTeamA
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-violet-500/20 text-violet-400 border border-violet-500/40'
                    }`}
                  >
                    {seatLabel}
                  </div>

                  {/* Player & Badges */}
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5 flex-wrap">
                      {seat.playerId ? (
                        <>
                          <span
                            data-testid={`player-name-${seat.seatIndex}`}
                            className="text-white font-extrabold"
                          >
                            {seat.playerName}
                          </span>
                          {/* Connection Status Dot */}
                          <span
                            data-testid={`connection-dot-${seat.seatIndex}`}
                            title={seat.isConnected ? 'Connected' : 'Disconnected'}
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              seat.isConnected ? 'bg-emerald-400' : 'bg-red-400'
                            }`}
                          />
                          {isMe && (
                            <span
                              data-testid="badge-you"
                              className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-black border border-amber-500/40"
                            >
                              YOU
                            </span>
                          )}
                          {seat.isHost && (
                            <span
                              data-testid="badge-host"
                              className="px-1.5 py-0.5 rounded text-[10px] bg-stone-700 text-stone-300 font-bold"
                            >
                              HOST
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-stone-500 italic">Empty Seat</span>
                      )}
                    </div>
                    <div className="text-[10px] text-stone-400 mt-0.5">
                      {`Team ${seat.team} • Seat ${seat.seatIndex + 1}`}
                    </div>
                  </div>
                </div>

                {/* Seat Actions */}
                <div>
                  {!seat.playerId ? (
                    <button
                      type="button"
                      data-testid={`btn-claim-seat-${seat.seatIndex}`}
                      onClick={() => onSelectSeat(seat.seatIndex)}
                      className="px-3 py-1.5 rounded-xl text-xs font-black bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-200 transition-colors cursor-pointer border border-stone-700 hover:border-amber-400"
                    >
                      Claim Seat
                    </button>
                  ) : isHost && !isMe && onKickPlayer ? (
                    <button
                      type="button"
                      data-testid={`btn-kick-seat-${seat.seatIndex}`}
                      onClick={() => onKickPlayer(seat.seatIndex)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Kick player"
                      aria-label={`Kick ${seat.playerName || 'player'}`}
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Host Controls & Leave */}
      <div className="flex items-center justify-between pt-4 border-t border-stone-800">
        <button
          type="button"
          data-testid="btn-leave-lobby"
          onClick={onLeaveLobby}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 transition-colors cursor-pointer"
        >
          Leave Lobby
        </button>

        {isHost && (
          <button
            type="button"
            data-testid="btn-start-game"
            disabled={!isFull}
            onClick={onStartGame}
            className="px-6 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 active:scale-98 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <Play className="w-4 h-4 fill-white" /> Start Game
          </button>
        )}
      </div>
    </div>
  );
};
