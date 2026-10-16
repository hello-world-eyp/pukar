import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { playSound, AUDIO_SCHEDULE_LOOKAHEAD_SEC, resetAudioContext } from '../../src/ui/sound';

describe('Sound Timing & Jitter Protection', () => {
  const mockOscillator = {
    type: 'triangle',
    frequency: {
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };

  const mockGain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };

  const mockAudioContext = {
    currentTime: 50.0,
    state: 'running',
    destination: {},
    createOscillator: vi.fn(() => mockOscillator),
    createGain: vi.fn(() => mockGain),
  };

  beforeEach(() => {
    resetAudioContext();
    mockOscillator.frequency.value = 0;
    mockOscillator.frequency.setValueAtTime = vi.fn();
    mockOscillator.frequency.exponentialRampToValueAtTime = vi.fn();
    mockGain.gain.setValueAtTime = vi.fn();
    mockGain.gain.exponentialRampToValueAtTime = vi.fn();

    const MockAudioContext = vi.fn(function () {
      return mockAudioContext;
    });
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('window', { AudioContext: MockAudioContext });
  });

  afterEach(() => {
    resetAudioContext();
    vi.unstubAllGlobals();
  });

  it('provides a positive scheduling lookahead buffer of 15ms', () => {
    expect(AUDIO_SCHEDULE_LOOKAHEAD_SEC).toBeGreaterThan(0);
    expect(AUDIO_SCHEDULE_LOOKAHEAD_SEC).toBe(0.015);
  });

  it('schedules "draw" with lookahead and initializes frequency.value to avoid 440Hz fallback', () => {
    mockAudioContext.currentTime = 12.345;
    playSound('draw');

    const expectedStartTime = 12.345 + AUDIO_SCHEDULE_LOOKAHEAD_SEC;

    expect(mockOscillator.frequency.value).toBe(240);
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(240, expectedStartTime);
    expect(mockOscillator.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      340,
      expectedStartTime + 0.08
    );
    expect(mockOscillator.start).toHaveBeenCalledWith(expectedStartTime);
    expect(mockOscillator.stop).toHaveBeenCalledWith(expectedStartTime + 0.08);
  });

  it('schedules "discard" with lookahead and initializes frequency.value', () => {
    mockAudioContext.currentTime = 20.0;
    playSound('discard');

    const expectedStartTime = 20.0 + AUDIO_SCHEDULE_LOOKAHEAD_SEC;

    expect(mockOscillator.frequency.value).toBe(240);
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(240, expectedStartTime);
    expect(mockOscillator.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      120,
      expectedStartTime + 0.07
    );
    expect(mockOscillator.start).toHaveBeenCalledWith(expectedStartTime);
    expect(mockOscillator.stop).toHaveBeenCalledWith(expectedStartTime + 0.07);
  });
});
