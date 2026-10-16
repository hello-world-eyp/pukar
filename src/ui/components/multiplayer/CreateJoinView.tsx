import React, { useState } from 'react';
import { PlusCircle, LogIn, Users, Wifi, WifiOff } from 'lucide-react';
import { getStoredPlayerName, saveStoredPlayerName } from '../../../network/session-storage';

export interface CreateJoinViewProps {
  onCreateRoom: (playerName: string, playerCount: 4 | 6) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  isConnected: boolean;
  initialTab?: 'CREATE' | 'JOIN';
  initialPlayerName?: string;
  initialRoomCode?: string;
  initialPlayerCount?: 4 | 6;
}

export const CreateJoinView: React.FC<CreateJoinViewProps> = ({
  onCreateRoom,
  onJoinRoom,
  isConnected,
  initialTab = 'CREATE',
  initialPlayerName = '',
  initialRoomCode = '',
  initialPlayerCount = 4,
}) => {
  const cleanRoomCode = (raw: string): string => {
    if (!raw) return '';
    const match = raw.match(/[?&]room=([a-zA-Z0-9]{4})/i);
    if (match) {
      return match[1].toUpperCase();
    }
    return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
  };

  const [tab, setTab] = useState<'CREATE' | 'JOIN'>(initialTab);
  const [playerName, setPlayerName] = useState(() => initialPlayerName || getStoredPlayerName());
  const [roomCode, setRoomCode] = useState(() => cleanRoomCode(initialRoomCode));
  const [playerCount, setPlayerCount] = useState<4 | 6>(initialPlayerCount);

  const trimmedName = playerName.trim();
  const trimmedCode = cleanRoomCode(roomCode);

  const isCreateDisabled = !isConnected || trimmedName.length === 0;
  const isJoinDisabled = !isConnected || trimmedName.length === 0 || trimmedCode.length !== 4;

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isCreateDisabled) return;
    saveStoredPlayerName(trimmedName);
    onCreateRoom(trimmedName, playerCount);
  };

  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isJoinDisabled) return;
    saveStoredPlayerName(trimmedName);
    onJoinRoom(trimmedCode, trimmedName);
  };


  return (
    <div
      data-testid="create-join-view"
      className="w-full max-w-md mx-auto bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl text-stone-100 flex flex-col gap-6"
    >
      {/* Connection Indicator */}
      <div className="flex items-center justify-between pb-2 border-b border-stone-800 text-xs">
        <span className="font-extrabold uppercase tracking-wider text-stone-400">Multiplayer Hub</span>
        <div
          data-testid="status-connection"
          className={`flex items-center gap-1.5 font-bold ${
            isConnected ? 'text-emerald-400' : 'text-amber-400'
          }`}
        >
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              <span>Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span>Connecting to server...</span>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-stone-800/80 p-1" role="tablist">
        <button
          data-testid="tab-create-room"
          role="tab"
          aria-selected={tab === 'CREATE'}
          onClick={() => setTab('CREATE')}
          className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
            tab === 'CREATE'
              ? 'bg-amber-500 text-stone-950 shadow-md'
              : 'text-stone-400 hover:text-white'
          }`}
        >
          Create Room
        </button>
        <button
          data-testid="tab-join-room"
          role="tab"
          aria-selected={tab === 'JOIN'}
          onClick={() => setTab('JOIN')}
          className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
            tab === 'JOIN'
              ? 'bg-amber-500 text-stone-950 shadow-md'
              : 'text-stone-400 hover:text-white'
          }`}
        >
          Join Room
        </button>
      </div>

      <form
        onSubmit={tab === 'CREATE' ? handleCreate : handleJoin}
        className="flex flex-col gap-4"
      >
        {/* Shared Name Input */}
        <div>
          <label htmlFor="player-name-input" className="block text-xs font-bold text-stone-400 mb-1.5">
            Your Name
          </label>
          <input
            id="player-name-input"
            data-testid="input-player-name"
            type="text"
            maxLength={24}
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => {
              setPlayerName(e.target.value);
              saveStoredPlayerName(e.target.value);
            }}

            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (tab === 'CREATE') {
                  handleCreate();
                } else {
                  handleJoin();
                }
              }
            }}
            className="w-full px-4 py-3 rounded-xl bg-stone-800 border border-stone-700 text-white placeholder-stone-500 text-sm font-semibold focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Tab Specific Content */}
        {tab === 'CREATE' ? (
          <>
            <div>
              <label className="block text-xs font-bold text-stone-400 mb-1.5">Player Count</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="btn-player-count-4"
                  onClick={() => setPlayerCount(4)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    playerCount === 4
                      ? 'border-amber-500 bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30'
                      : 'border-stone-700 bg-stone-800/60 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Users className="w-4 h-4" /> 4 Players (2v2)
                </button>
                <button
                  type="button"
                  data-testid="btn-player-count-6"
                  onClick={() => setPlayerCount(6)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    playerCount === 6
                      ? 'border-amber-500 bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30'
                      : 'border-stone-700 bg-stone-800/60 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Users className="w-4 h-4" /> 6 Players (3v3)
                </button>
              </div>
            </div>

            <button
              type="submit"
              data-testid="btn-create-room"
              disabled={isCreateDisabled}
              onClick={handleCreate}
              className="mt-2 w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-lg shadow-amber-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <PlusCircle className="w-4 h-4" /> Create Room
            </button>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="room-code-input" className="block text-xs font-bold text-stone-400 mb-1.5">
                4-Letter Room Code
              </label>
              <input
                id="room-code-input"
                data-testid="input-room-code"
                type="text"
                placeholder="e.g. PKAR"
                value={roomCode}
                onPaste={(e) => {
                  const pasted = e.clipboardData?.getData('text');
                  if (pasted) {
                    e.preventDefault();
                    setRoomCode(cleanRoomCode(pasted));
                  }
                }}
                onChange={(e) => {
                  setRoomCode(cleanRoomCode(e.target.value));
                }}
                className="w-full px-4 py-3 rounded-xl bg-stone-800 border border-stone-700 text-amber-300 placeholder-stone-500 text-lg font-black tracking-widest text-center uppercase focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              data-testid="btn-join-room"
              disabled={isJoinDisabled}
              onClick={handleJoin}
              className="mt-2 w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <LogIn className="w-4 h-4" /> Join Room
            </button>
          </>
        )}
      </form>
    </div>
  );
};
