import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Download, RotateCcw, X, Sparkles, Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { isSoundEnabled } from '../sound';

export interface PureSequenceCelebrationModalProps {
  team?: 'A' | 'B';
  playerName?: string;
  suit?: 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS';
  onClose: () => void;
  autoCloseOnEnd?: boolean;
}

const CELEBRATION_VIDEO_SRC = '/assets/celebration/500-points-celebration.mp4';

export const PureSequenceCelebrationModal: React.FC<PureSequenceCelebrationModalProps> = ({
  team = 'A',
  playerName = 'Player',
  suit,
  onClose,
  autoCloseOnEnd = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(!isSoundEnabled());
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(9.6);
  const [isLoaded, setIsLoaded] = useState(false);

  // Attempt unmuted or muted autoplay on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = isMuted;
    video
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {
        // Fallback to muted autoplay if browser blocks audio autoplay
        if (videoRef.current) {
          videoRef.current.muted = true;
          setIsMuted(true);
          videoRef.current.play().catch(() => {
            setIsPlaying(false);
          });
        }
      });
  }, []);

  // Sync mute state changes to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleReplay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 0;
    video.play().then(() => setIsPlaying(true)).catch(() => {});
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (autoCloseOnEnd) {
      setTimeout(onClose, 2500);
    }
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      data-testid="pure-sequence-celebration-modal"
      role="dialog"
      aria-label="500 Points Celebration"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md select-none overflow-hidden p-3 sm:p-6"
    >
      {/* Top Header & Close Bar */}
      <div className="w-full max-w-5xl mb-3 flex items-center justify-between pointer-events-auto z-20">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-900/90 border border-amber-500/50 text-amber-300 shadow-xl backdrop-blur-md">
          <Sparkles className="w-5 h-5 text-amber-400 animate-spin-slow" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="text-xs sm:text-sm font-black tracking-wider uppercase text-amber-300">
              500-PT PURE SEQUENCE CELEBRATION
            </span>
            <span className="text-[11px] sm:text-xs text-slate-400 font-semibold hidden sm:inline">
              • {playerName} (Team {team}){suit ? ` [${suit}]` : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mute Audio Toggle */}
          <button
            type="button"
            onClick={() => setIsMuted((prev) => !prev)}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-amber-400 text-slate-300 hover:text-white transition-colors cursor-pointer backdrop-blur-md shadow-md active:scale-95"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>

          {/* Close Modal */}
          <button
            type="button"
            onClick={onClose}
            title="Close Celebration"
            className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-red-500 hover:bg-red-500/20 text-slate-300 hover:text-red-300 transition-colors cursor-pointer backdrop-blur-md shadow-md active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main 16:9 Video Player Container */}
      <div className="relative w-full max-w-5xl aspect-video mx-auto flex items-center justify-center bg-slate-950 rounded-3xl shadow-2xl border-2 border-amber-500/60 overflow-hidden group">
        <video
          ref={videoRef}
          data-testid="pure-sequence-celebration-video"
          src={CELEBRATION_VIDEO_SRC}
          playsInline
          autoPlay
          onLoadedMetadata={() => {
            setIsLoaded(true);
            if (videoRef.current?.duration) {
              setDuration(videoRef.current.duration);
            }
          }}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onClick={handleTogglePlay}
          className="w-full h-full object-contain cursor-pointer"
        />

        {/* Loading Spinner until video metadata is loaded */}
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <Sparkles className="w-8 h-8 text-amber-400 animate-spin" />
              <span className="text-xs font-bold text-amber-200">Loading Celebration...</span>
            </div>
          </div>
        )}

        {/* Center Play Overlay on Pause */}
        {!isPlaying && (
          <button
            type="button"
            onClick={handleTogglePlay}
            aria-label="Play Video"
            className="absolute inset-0 m-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500/90 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-2xl transition-transform hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-sm"
          >
            <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-slate-950 translate-x-0.5" />
          </button>
        )}
      </div>

      {/* Bottom Timeline & Controls Bar */}
      <div className="mt-3.5 w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 z-20">
        {/* Timeline Progress Bar */}
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <span className="text-xs font-mono font-bold text-amber-400 min-w-[38px]">
            {currentTime.toFixed(1)}s
          </span>

          <div className="relative flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 transition-all duration-75 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
            <input
              type="range"
              min="0"
              max={duration || 10}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              aria-label="Seek video timeline"
            />
          </div>

          <span className="text-xs font-mono font-bold text-slate-400">
            {duration.toFixed(1)}s
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleReplay}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white transition-all cursor-pointer shadow-md active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Replay (10s)
          </button>

          <a
            href={CELEBRATION_VIDEO_SRC}
            download="pukar-500-points-celebration.mp4"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95 no-underline"
          >
            <Download className="w-4 h-4 text-slate-950" />
            Download 10s Video
          </a>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
          >
            Continue Game
          </button>
        </div>
      </div>
    </div>
  );
};
