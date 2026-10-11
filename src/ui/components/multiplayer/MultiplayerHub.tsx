import React from 'react';
import { CreateJoinView } from './CreateJoinView';
import { LobbyView } from './LobbyView';
import { UseMultiplayerGameReturn } from '../../../network/types';
import { AlertCircle, X, ArrowLeft } from 'lucide-react';

export interface MultiplayerHubProps {
  onBackToMenu: () => void;
  multiplayerHook: UseMultiplayerGameReturn;
  initialRoomCode?: string;
}

export const MultiplayerHub: React.FC<MultiplayerHubProps> = ({
  onBackToMenu,
  multiplayerHook,
  initialRoomCode,
}) => {
  const {
    connectionStatus,
    roomCode,
    isHost,
    isInLobby,
    lobbySeats,
    myPlayerId,
    errorMessage,
    createRoom,
    joinRoom,
    selectSeat,
    startGame,
    kickPlayer,
    leaveRoom,
    clearError,
  } = multiplayerHook;

  return (
    <div
      data-testid="multiplayer-hub"
      className="flex flex-col items-center justify-center min-h-[500px] p-4 w-full"
    >
      {/* Error Banner */}
      {errorMessage && (
        <div
          data-testid="multiplayer-error-banner"
          className="w-full max-w-md mb-4 p-3.5 rounded-2xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs font-bold flex items-center justify-between gap-3 shadow-lg"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            data-testid="btn-dismiss-error"
            onClick={clearError}
            aria-label="Dismiss error"
            className="p-1 rounded-lg text-red-400 hover:text-white hover:bg-red-500/20 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {isInLobby && roomCode ? (
        <LobbyView
          roomCode={roomCode}
          seats={lobbySeats}
          myPlayerId={myPlayerId}
          isHost={isHost}
          onSelectSeat={selectSeat}
          onStartGame={startGame}
          onKickPlayer={kickPlayer}
          onLeaveLobby={() => {
            leaveRoom();
            onBackToMenu();
          }}
        />
      ) : (
        <div className="w-full max-w-md mx-auto flex flex-col items-center gap-4">
          <CreateJoinView
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            isConnected={connectionStatus === 'CONNECTED'}
            initialTab={initialRoomCode ? 'JOIN' : undefined}
            initialRoomCode={initialRoomCode}
          />
          <button
            type="button"
            data-testid="btn-back-to-menu"
            onClick={onBackToMenu}
            className="text-xs font-bold text-stone-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Main Menu
          </button>
        </div>
      )}
    </div>
  );
};
