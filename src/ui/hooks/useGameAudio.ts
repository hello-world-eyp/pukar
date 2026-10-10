import { useState, useCallback } from 'react';
import { playSound, setSoundEnabled, SoundEffect } from '../sound';

export function useGameAudio() {
  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      setSoundEnabled(!next);
      return next;
    });
  }, []);

  const triggerSound = useCallback((effect: SoundEffect) => {
    try {
      playSound(effect);
    } catch {
      // Audio playback errors are non-fatal
    }
  }, []);

  return {
    isMuted,
    setIsMuted,
    toggleMute,
    triggerSound,
  };
}
