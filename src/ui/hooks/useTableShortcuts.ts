import { useEffect, useRef } from 'react';
import { GameAction, GameState, SanitizedGameState } from '../../engine/types';
import { exportDebugLogFile } from '../../engine/debug-logger';

export interface UseTableShortcutsProps {
  currentScreen: 'MENU' | 'GAME' | 'MULTIPLAYER_HUB';
  onAction: (action: GameAction) => boolean;
  onExportDebugLog?: () => boolean | void;
  onNotify?: (msg: string) => void;
  gameState?: GameState | SanitizedGameState;
}

export function createTableShortcutHandler(props: UseTableShortcutsProps) {
  let lastJTime = 0;
  let lastQTime = 0;

  return (e: { key: string; target?: any }) => {
    if (props.currentScreen !== 'GAME') return;

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

    const key = e.key.toLowerCase();

    if (key === 'j') {
      const now = Date.now();
      if (now - lastJTime <= 1200) {
        lastJTime = 0;
        props.onAction({ type: 'OPTIMIZE_DECK_ORDER' });
      } else {
        lastJTime = now;
      }
      lastQTime = 0;
    } else if (key === 'q') {
      const now = Date.now();
      if (now - lastQTime <= 1200) {
        lastQTime = 0;
        let success: boolean | void = true;
        if (props.onExportDebugLog) {
          success = props.onExportDebugLog();
        } else {
          success = exportDebugLogFile(props.gameState as GameState);
        }
        if (success === false) {
          props.onNotify?.('Failed to download debug log');
        } else {
          props.onNotify?.('Debug log downloaded! (qq)');
        }
      } else {
        lastQTime = now;
      }
      lastJTime = 0;
    } else {
      lastJTime = 0;
      lastQTime = 0;
    }
  };
}

export function useTableShortcuts({
  currentScreen,
  onAction,
  onExportDebugLog,
  onNotify,
  gameState,
}: UseTableShortcutsProps) {
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  const onExportDebugLogRef = useRef(onExportDebugLog);
  onExportDebugLogRef.current = onExportDebugLog;

  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    if (currentScreen !== 'GAME') return;

    const handler = createTableShortcutHandler({
      currentScreen,
      onAction: (act) => onActionRef.current(act),
      onExportDebugLog: () => onExportDebugLogRef.current?.(),
      onNotify: (msg) => onNotifyRef.current?.(msg),
      get gameState() {
        return gameStateRef.current;
      },
    });

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [currentScreen]);
}
