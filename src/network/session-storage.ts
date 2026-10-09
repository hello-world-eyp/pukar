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

/**
 * Persists room session credentials into browser sessionStorage.
 * Wrapped defensively in try/catch to protect against storage quota or security errors.
 */
export function saveSessionCredentials(session: StoredSession): void {
  try {
    const serialized = JSON.stringify(session);
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
      return {
        roomCode: parsed.roomCode,
        playerId: parsed.playerId,
        sessionToken: parsed.sessionToken,
        seatIndex: typeof parsed.seatIndex === 'number' ? parsed.seatIndex : null,
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
