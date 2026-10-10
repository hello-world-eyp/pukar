import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveSessionCredentials,
  getSessionCredentials,
  clearSessionCredentials,
  resetMemoryFallback,
} from '../../src/network/session-storage';

describe('Multiplayer Session Storage - Comprehensive Audit & Edge Cases', () => {
  beforeEach(() => {
    resetMemoryFallback();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves, retrieves, and clears valid session credentials', () => {
    saveSessionCredentials({
      roomCode: 'ABCD',
      playerId: 'player-123',
      sessionToken: 'token-xyz',
      seatIndex: 2,
    });

    const retrieved = getSessionCredentials();
    expect(retrieved).toEqual({
      roomCode: 'ABCD',
      playerId: 'player-123',
      sessionToken: 'token-xyz',
      seatIndex: 2,
    });

    clearSessionCredentials();
    expect(getSessionCredentials()).toBeNull();
  });

  it('trims whitespace on stored credentials and handles null seatIndex', () => {
    saveSessionCredentials({
      roomCode: '  WXYZ  ',
      playerId: '  p-456  ',
      sessionToken: '  token-789  ',
      seatIndex: null,
    });

    const retrieved = getSessionCredentials();
    expect(retrieved?.roomCode).toBe('WXYZ');
    expect(retrieved?.playerId).toBe('p-456');
    expect(retrieved?.sessionToken).toBe('token-789');
    expect(retrieved?.seatIndex).toBeNull();
  });

  it('rejects invalid or empty session credentials', () => {
    saveSessionCredentials(null as any);
    expect(getSessionCredentials()).toBeNull();

    saveSessionCredentials({} as any);
    expect(getSessionCredentials()).toBeNull();

    saveSessionCredentials({
      roomCode: '',
      playerId: 'p1',
      sessionToken: 'tok',
    } as any);
    expect(getSessionCredentials()).toBeNull();

    saveSessionCredentials({
      roomCode: 'ABCD',
      playerId: '',
      sessionToken: 'tok',
    } as any);
    expect(getSessionCredentials()).toBeNull();

    saveSessionCredentials({
      roomCode: 'ABCD',
      playerId: 'p1',
      sessionToken: '',
    } as any);
    expect(getSessionCredentials()).toBeNull();
  });

  it('safely handles corrupted JSON or unexpected data structure in storage', () => {
    // Inject corrupt JSON into storage
    const storage = typeof window !== 'undefined' ? window.sessionStorage : null;
    if (storage) {
      storage.setItem('pukar_multiplayer_session', '{not-valid-json:::');
    }

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = getSessionCredentials();
    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });

  it('safely falls back to in-memory store when storage throws access error', () => {
    // Simulate quota exceeded or private mode throwing on setItem
    const mockStorage = {
      getItem: vi.fn().mockImplementation(() => {
        throw new Error('Access denied');
      }),
      setItem: vi.fn().mockImplementation(() => {
        throw new Error('Quota exceeded');
      }),
      removeItem: vi.fn().mockImplementation(() => {
        throw new Error('SecurityError');
      }),
    };

    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = {
      sessionStorage: mockStorage,
    };

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Save should fall back to memory
    saveSessionCredentials({
      roomCode: 'FALL',
      playerId: 'p_fall',
      sessionToken: 'tok_fall',
      seatIndex: 0,
    });

    // Clear should safely catch error and clear memory fallback
    clearSessionCredentials();
    expect(getSessionCredentials()).toBeNull();

    consoleSpy.mockRestore();

    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  });

  it('resets memory fallback via resetMemoryFallback()', () => {
    // Force write into memory fallback
    saveSessionCredentials({
      roomCode: 'MEM1',
      playerId: 'p_mem',
      sessionToken: 'tok_mem',
      seatIndex: 1,
    });

    resetMemoryFallback();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }

    expect(getSessionCredentials()).toBeNull();
  });
});
