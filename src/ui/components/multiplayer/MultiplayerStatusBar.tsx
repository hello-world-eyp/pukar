import React from 'react';
import { Wifi, WifiOff, LogOut, Radio } from 'lucide-react';
import { ConnectionStatus } from '../../../network/types';

export interface MultiplayerStatusBarProps {
  roomCode: string;
  connectionStatus: ConnectionStatus;
  seatIndex: number | null | undefined;
  onLeave: () => void;
}

/**
 * Persistent status bar displayed during active multiplayer matches.
 * Provides real-time network connectivity feedback, room code,
 * assigned seat & team badge, and a button to exit back to the multiplayer hub.
 */
export const MultiplayerStatusBar: React.FC<MultiplayerStatusBarProps> = ({
  roomCode,
  connectionStatus,
  seatIndex,
  onLeave,
}) => {
  const isSeated = typeof seatIndex === 'number' && !isNaN(seatIndex) && seatIndex >= 0;
  const teamLetter = isSeated ? (seatIndex % 2 === 0 ? 'A' : 'B') : null;

  return (
    <div
      data-testid="multiplayer-status-bar"
      role="region"
      aria-label="Multiplayer Game Status"
      className="w-full bg-slate-900/95 border-b border-slate-700/80 px-4 py-2 flex items-center justify-between text-xs text-slate-300 backdrop-blur-md z-40 transition-all shadow-md"
    >
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        {/* Connection Status Icon & Label */}
        <div
          data-testid="status-connection-badge"
          className="flex items-center gap-1.5 font-bold"
          title={`Connection: ${connectionStatus}`}
        >
          {connectionStatus === 'CONNECTED' ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              <Wifi className="w-3.5 h-3.5 text-emerald-400" data-testid="status-icon-connected" />
              <span className="text-emerald-400 font-extrabold uppercase text-[11px] tracking-wide">
                Connected
              </span>
            </>
          ) : connectionStatus === 'RECONNECTING' ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" aria-hidden="true" />
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" data-testid="status-icon-reconnecting" />
              <span className="text-amber-400 font-extrabold uppercase text-[11px] tracking-wide">
                Reconnecting...
              </span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" aria-hidden="true" />
              <WifiOff className="w-3.5 h-3.5 text-red-400" data-testid="status-icon-disconnected" />
              <span className="text-red-400 font-extrabold uppercase text-[11px] tracking-wide">
                Disconnected
              </span>
            </>
          )}
        </div>

        {/* 4-Letter Room Code */}
        <div className="flex items-center gap-1.5" data-testid="status-room-container">
          <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Room:</span>
          <span
            data-testid="status-room-code"
            className="font-mono font-black text-amber-300 tracking-wider text-sm px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60"
          >
            {roomCode}
          </span>
        </div>

        {/* Assigned Seat & Team Badge */}
        {isSeated && (
          <div
            data-testid="status-seat-badge"
            className={`px-2.5 py-0.5 rounded-lg border font-bold text-[11px] flex items-center gap-1.5 ${
              teamLetter === 'A'
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                : 'bg-indigo-950/60 text-indigo-300 border-indigo-700/60'
            }`}
          >
            <span>{`Seat ${seatIndex! + 1}`}</span>
            <span>{`(Team ${teamLetter})`}</span>
          </div>
        )}
      </div>

      {/* Leave Room Button */}
      <button
        type="button"
        data-testid="btn-leave-room"
        onClick={onLeave}
        className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 hover:bg-red-950/60 hover:text-red-300 hover:border-red-600/60 text-slate-300 border border-slate-700 font-bold text-xs transition-colors cursor-pointer"
        aria-label="Leave Room"
      >
        <LogOut className="w-3.5 h-3.5 text-red-400" />
        <span>Leave Room</span>
      </button>
    </div>
  );
};
