import { useEffect } from 'react';
import { GameAction } from '../../engine/types';

export interface UseTableShortcutsProps {
  currentScreen: 'MENU' | 'GAME' | 'MULTIPLAYER_HUB';
  onAction: (action: GameAction) => boolean;
}

export function useTableShortcuts({ currentScreen, onAction }: UseTableShortcutsProps) {
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
          onAction({ type: 'OPTIMIZE_DECK_ORDER' });
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
  }, [currentScreen, onAction]);
}
