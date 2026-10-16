import { Card, GameAction, GameState, Meld } from './types';

export interface DebugPlayerSnapshot {
  id: string;
  name: string;
  team: 'A' | 'B';
  hand: Card[];
  cardCount: number;
}

export interface DebugSnapshot {
  timestamp: string;
  stepIndex: number;
  action?: GameAction;
  round: number;
  currentPlayerIndex: number;
  phase: string;
  roundStatus: string;
  players: DebugPlayerSnapshot[];
  melds: {
    A: Meld[];
    B: Meld[];
  };
  discardPile: Card[];
  pukarPoolCount: number;
  stockDeckCount: number;
  pukarsClaimed: { A: number; B: number };
  roundScores: { A: number; B: number };
  totalScores: { A: number; B: number };
}

export interface PukarDebugLog {
  version: 1;
  appName: 'Pukar Card Game';
  exportedAt: string;
  gameMode: 'LOCAL' | 'BOTS' | 'MULTIPLAYER';
  liveState: GameState | null;
  totalSnapshots: number;
  history: DebugSnapshot[];
}

export const MAX_DEBUG_SNAPSHOTS = 100;

class GameDebugLogger {
  private history: DebugSnapshot[] = [];
  private stepCounter = 0;
  private gameMode: 'LOCAL' | 'BOTS' | 'MULTIPLAYER' = 'LOCAL';

  public setGameMode(mode: 'LOCAL' | 'BOTS' | 'MULTIPLAYER') {
    this.gameMode = mode;
  }

  public getGameMode(): 'LOCAL' | 'BOTS' | 'MULTIPLAYER' {
    return this.gameMode;
  }

  public getSnapshotCount(): number {
    return this.history.length;
  }

  public clear() {
    this.history = [];
    this.stepCounter = 0;
  }

  private cloneCards(cards?: Card[]): Card[] {
    if (!cards) return [];
    return cards.map((c) => ({ ...c }));
  }

  private cloneMelds(melds?: Meld[]): Meld[] {
    if (!melds) return [];
    return melds.map((m) => ({
      ...m,
      cards: this.cloneCards(m.cards),
      slots: m.slots ? m.slots.map((s) => ({ ...s, card: { ...s.card } })) : [],
    }));
  }

  public recordSnapshot(state: GameState, action?: GameAction): DebugSnapshot {
    this.stepCounter += 1;

    const playersSnapshot: DebugPlayerSnapshot[] = (state.players || []).map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      hand: this.cloneCards(p.hand),
      cardCount: p.hand ? p.hand.length : 0,
    }));

    const snapshot: DebugSnapshot = {
      timestamp: new Date().toISOString(),
      stepIndex: this.stepCounter,
      action: action ? JSON.parse(JSON.stringify(action)) : undefined,
      round: state.round ?? 1,
      currentPlayerIndex: state.currentPlayerIndex ?? 0,
      phase: state.phase ?? 'UNKNOWN',
      roundStatus: state.roundStatus ?? 'ACTIVE',
      players: playersSnapshot,
      melds: {
        A: this.cloneMelds(state.melds?.A),
        B: this.cloneMelds(state.melds?.B),
      },
      discardPile: this.cloneCards(state.discardPile),
      pukarPoolCount: Array.isArray(state.pukarPool) ? state.pukarPool.length : 0,
      stockDeckCount: Array.isArray(state.stockDeck) ? state.stockDeck.length : 0,
      pukarsClaimed: {
        A: state.pukarsClaimed?.A ?? 0,
        B: state.pukarsClaimed?.B ?? 0,
      },
      roundScores: {
        A: state.roundScores?.A ?? 0,
        B: state.roundScores?.B ?? 0,
      },
      totalScores: {
        A: (state.totalScores ?? state.scores)?.A ?? 0,
        B: (state.totalScores ?? state.scores)?.B ?? 0,
      },
    };

    this.history.push(snapshot);
    if (this.history.length > MAX_DEBUG_SNAPSHOTS) {
      this.history.shift();
    }

    return snapshot;
  }

  public getLogData(currentState?: GameState): PukarDebugLog {
    let liveStateClone: GameState | null = null;
    if (currentState) {
      try {
        liveStateClone = JSON.parse(JSON.stringify(currentState));
      } catch {
        liveStateClone = null;
      }
    }

    return {
      version: 1,
      appName: 'Pukar Card Game',
      exportedAt: new Date().toISOString(),
      gameMode: this.gameMode,
      liveState: liveStateClone,
      totalSnapshots: this.stepCounter,
      history: [...this.history],
    };
  }

  public exportLogFile(
    currentState?: GameState,
    options?: {
      filename?: string;
      onDownload?: (filename: string) => void;
    }
  ): boolean {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = options?.filename ?? `pukar-debug-log-${timestamp}.json`;
    const logData = this.getLogData(currentState);
    const jsonString = JSON.stringify(logData, null, 2);

    if (
      typeof window !== 'undefined' &&
      typeof document !== 'undefined' &&
      typeof document.createElement === 'function' &&
      window.URL &&
      typeof window.URL.createObjectURL === 'function'
    ) {
      try {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (typeof window.URL.revokeObjectURL === 'function') {
          window.URL.revokeObjectURL(url);
        }
        options?.onDownload?.(filename);
        return true;
      } catch (err) {
        console.error('Failed to export debug log file:', err);
        return false;
      }
    }

    // Non-browser fallback
    options?.onDownload?.(filename);
    return false;
  }
}

// Global singleton instance for runtime state recording
const globalDebugLogger = new GameDebugLogger();

export function recordGameSnapshot(state: GameState, action?: GameAction): DebugSnapshot {
  return globalDebugLogger.recordSnapshot(state, action);
}

export function getDebugLogData(currentState?: GameState): PukarDebugLog {
  return globalDebugLogger.getLogData(currentState);
}

export function exportDebugLogFile(
  currentState?: GameState,
  options?: {
    filename?: string;
    onDownload?: (filename: string) => void;
  }
): boolean {
  return globalDebugLogger.exportLogFile(currentState, options);
}

export function clearDebugLog(): void {
  globalDebugLogger.clear();
}

export function setDebugGameMode(mode: 'LOCAL' | 'BOTS' | 'MULTIPLAYER'): void {
  globalDebugLogger.setGameMode(mode);
}

export function getDebugSnapshotCount(): number {
  return globalDebugLogger.getSnapshotCount();
}
