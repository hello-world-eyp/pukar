import { StoredSession } from './types';

const STORAGE_KEY = 'pukar_multiplayer_session';

// In-memory fallback if sessionStorage is completely unavailable or throws access errors
let memoryFallback: Record<string, string> = {};

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage;
    }
  } catch {
    // Access denied (e.g., cross-origin iframe or privacy mode)
  }
  return null;
}

export const PLAYER_NAME_STORAGE_KEY = 'pukar_player_name';

function getLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // Access denied (e.g., cross-origin iframe or privacy mode)
  }
  return null;
}

/**
 * Retrieves persisted player name from localStorage.
 */
export function getStoredPlayerName(): string {
  try {
    const storage = getLocalStorage();
    const raw = storage ? storage.getItem(PLAYER_NAME_STORAGE_KEY) : memoryFallback[PLAYER_NAME_STORAGE_KEY];
    return typeof raw === 'string' ? raw.trim().slice(0, 24) : '';
  } catch {
    return memoryFallback[PLAYER_NAME_STORAGE_KEY] || '';
  }
}

/**
 * Persists player name into localStorage for seamless reuse across sessions.
 */
export function saveStoredPlayerName(name: string): void {
  try {
    if (typeof name !== 'string') return;
    const clean = name.trim().slice(0, 24);
    if (!clean) return;

    const storage = getLocalStorage();
    if (storage) {
      storage.setItem(PLAYER_NAME_STORAGE_KEY, clean);
    }
    memoryFallback[PLAYER_NAME_STORAGE_KEY] = clean;
  } catch {
    if (typeof name === 'string' && name.trim()) {
      memoryFallback[PLAYER_NAME_STORAGE_KEY] = name.trim().slice(0, 24);
    }
  }
}

/**
 * Persists room session credentials into browser sessionStorage.
 * Wrapped defensively in try/catch to protect against storage quota or security errors.
 */
export function saveSessionCredentials(session: StoredSession): void {
  try {
    if (
      !session ||
      typeof session.roomCode !== 'string' ||
      !session.roomCode.trim() ||
      typeof session.playerId !== 'string' ||
      !session.playerId.trim() ||
      typeof session.sessionToken !== 'string' ||
      !session.sessionToken.trim()
    ) {
      return;
    }

    const cleanPlayerName =
      typeof session.playerName === 'string' && session.playerName.trim()
        ? session.playerName.trim().slice(0, 24)
        : getStoredPlayerName() || undefined;

    if (cleanPlayerName) {
      saveStoredPlayerName(cleanPlayerName);
    }

    const normalizedSession: StoredSession = {
      roomCode: session.roomCode.trim(),
      playerId: session.playerId.trim(),
      sessionToken: session.sessionToken.trim(),
      seatIndex: typeof session.seatIndex === 'number' ? session.seatIndex : null,
      playerName: cleanPlayerName,
    };

    const serialized = JSON.stringify(normalizedSession);
    const storage = getStorage();
    if (storage) {
      storage.setItem(STORAGE_KEY, serialized);
    } else {
      memoryFallback[STORAGE_KEY] = serialized;
    }
  } catch (err) {
    console.warn('[SessionStorage] Failed to save multiplayer session credentials:', err);
    try {
      memoryFallback[STORAGE_KEY] = JSON.stringify(session);
    } catch {
      // Ignore memory serialization errors
    }
  }
}

/**
 * Retrieves stored session credentials from sessionStorage.
 * Returns null if no session exists or if parsing fails.
 */
export function getSessionCredentials(): StoredSession | null {
  try {
    const storage = getStorage();
    const raw = storage ? storage.getItem(STORAGE_KEY) : memoryFallback[STORAGE_KEY];
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed?.roomCode === 'string' &&
      typeof parsed?.playerId === 'string' &&
      typeof parsed?.sessionToken === 'string'
    ) {
      const storedName =
        typeof parsed.playerName === 'string' && parsed.playerName.trim()
          ? parsed.playerName.trim()
          : getStoredPlayerName() || undefined;

      return {
        roomCode: parsed.roomCode,
        playerId: parsed.playerId,
        sessionToken: parsed.sessionToken,
        seatIndex: typeof parsed.seatIndex === 'number' ? parsed.seatIndex : null,
        playerName: storedName,
      };
    }
    return null;
  } catch (err) {
    console.warn('[SessionStorage] Failed to read multiplayer session credentials:', err);
    return null;
  }
}


/**
 * Clears stored multiplayer session credentials upon voluntary room leave.
 */
export function clearSessionCredentials(): void {
  try {
    const storage = getStorage();
    if (storage) {
      storage.removeItem(STORAGE_KEY);
    }
    delete memoryFallback[STORAGE_KEY];
  } catch (err) {
    console.warn('[SessionStorage] Failed to clear multiplayer session credentials:', err);
    delete memoryFallback[STORAGE_KEY];
  }
}

/**
 * Resets internal memory fallback (primarily for test isolation).
 */
export function resetMemoryFallback(): void {
  memoryFallback = {};
}
