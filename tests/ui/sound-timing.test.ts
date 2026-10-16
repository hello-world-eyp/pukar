import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { playSound, AUDIO_SCHEDULE_LOOKAHEAD_SEC, resetAudioContext } from '../../src/ui/sound';

describe('Sound Timing & Jitter Protection', () => {
  const createdOscillators: Array<{
    type: string;
    frequency: {
      value: number;
      setValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];

  const createdGains: Array<{
    gain: {
      setValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
  }> = [];

  function createMockOscillator() {
    const osc = {
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
    createdOscillators.push(osc);
    return osc;
  }

  function createMockGain() {
    const g = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    createdGains.push(g);
    return g;
  }

  const mockAudioContext = {
    currentTime: 50.0,
    state: 'running',
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(createMockOscillator),
    createGain: vi.fn(createMockGain),
  };

  beforeEach(() => {
    resetAudioContext();
    createdOscillators.length = 0;
    createdGains.length = 0;
    mockAudioContext.currentTime = 50.0;
    mockAudioContext.state = 'running';
    mockAudioContext.resume = vi.fn().mockResolvedValue(undefined);
    mockAudioContext.createOscillator = vi.fn(createMockOscillator);
    mockAudioContext.createGain = vi.fn(createMockGain);

    const MockAudioContext = vi.fn(function () {
      return mockAudioContext;
    });
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('window', { AudioContext: MockAudioContext });
  });

  afterEach(() => {
    resetAudioContext();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('provides a positive scheduling lookahead buffer of 15ms', () => {
    expect(AUDIO_SCHEDULE_LOOKAHEAD_SEC).toBeGreaterThan(0);
    expect(AUDIO_SCHEDULE_LOOKAHEAD_SEC).toBe(0.015);
  });

  it('schedules "draw" with lookahead and initializes frequency.value to avoid 440Hz fallback', () => {
    mockAudioContext.currentTime = 12.345;
    playSound('draw');

    const expectedStartTime = 12.345 + AUDIO_SCHEDULE_LOOKAHEAD_SEC;
    expect(createdOscillators.length).toBe(1);
    const osc = createdOscillators[0];

    expect(osc.frequency.value).toBe(240);
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(240, expectedStartTime);
    expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      340,
      expectedStartTime + 0.08
    );
    expect(osc.start).toHaveBeenCalledWith(expectedStartTime);
    expect(osc.stop).toHaveBeenCalledWith(expectedStartTime + 0.08);
  });

  it('schedules "discard" with lookahead and initializes frequency.value', () => {
    mockAudioContext.currentTime = 20.0;
    playSound('discard');

    const expectedStartTime = 20.0 + AUDIO_SCHEDULE_LOOKAHEAD_SEC;
    expect(createdOscillators.length).toBe(1);
    const osc = createdOscillators[0];

    expect(osc.frequency.value).toBe(240);
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(240, expectedStartTime);
    expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      120,
      expectedStartTime + 0.07
    );
    expect(osc.start).toHaveBeenCalledWith(expectedStartTime);
    expect(osc.stop).toHaveBeenCalledWith(expectedStartTime + 0.07);
  });

  it('schedules "meld" triad notes with explicit frequency.values and lookahead offset', () => {
    mockAudioContext.currentTime = 100.0;
    playSound('meld');

    expect(createdOscillators.length).toBe(3);
    const expectedNotes = [523.25, 659.25, 783.99];

    createdOscillators.forEach((osc, idx) => {
      const expectedNoteTime = 100.0 + AUDIO_SCHEDULE_LOOKAHEAD_SEC + idx * 0.06;
      expect(osc.frequency.value).toBe(expectedNotes[idx]);
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(expectedNotes[idx], expectedNoteTime);
      expect(osc.start).toHaveBeenCalledWith(expectedNoteTime);
      expect(osc.stop).toHaveBeenCalledWith(expectedNoteTime + 0.16);
    });
  });

  it('schedules "pukar" oscillators (thud, crunch, snap, rumble, chime) with explicit frequency.values', () => {
    mockAudioContext.currentTime = 40.0;
    playSound('pukar');

    expect(createdOscillators.length).toBe(8);
    // Sub-bass
    expect(createdOscillators[0].frequency.value).toBe(160);
    // Crunch
    expect(createdOscillators[1].frequency.value).toBe(260);
    // Snap
    expect(createdOscillators[2].frequency.value).toBe(440);
    // Rumble
    expect(createdOscillators[3].frequency.value).toBe(60);
    // Chimes
    const chimeFreqs = [523.25, 659.25, 783.99, 1046.5];
    chimeFreqs.forEach((freq, idx) => {
      expect(createdOscillators[4 + idx].frequency.value).toBe(freq);
    });
  });

  it('schedules "roundOver" arpeggio oscillators with explicit frequency.values', () => {
    mockAudioContext.currentTime = 10.0;
    playSound('roundOver');

    expect(createdOscillators.length).toBe(4);
    const expectedNotes = [440, 554.37, 659.25, 880];
    createdOscillators.forEach((osc, idx) => {
      expect(osc.frequency.value).toBe(expectedNotes[idx]);
    });
  });

  it('schedules "error" oscillator with explicit frequency.value', () => {
    mockAudioContext.currentTime = 5.0;
    playSound('error');

    expect(createdOscillators.length).toBe(1);
    expect(createdOscillators[0].frequency.value).toBe(160);
  });

  it('maintains non-decreasing monotonic timestamps across rapid consecutive turn sounds', () => {
    let currentTime = 10.0;
    let lastScheduledStart = 0;

    for (let turn = 0; turn < 20; turn++) {
      mockAudioContext.currentTime = currentTime;
      playSound('draw');

      const latestOsc = createdOscillators[createdOscillators.length - 1];
      const startCall = latestOsc.start.mock.calls[0][0];

      expect(startCall).toBeGreaterThanOrEqual(lastScheduledStart);
      expect(startCall).toBeCloseTo(currentTime + AUDIO_SCHEDULE_LOOKAHEAD_SEC, 5);
      expect(latestOsc.frequency.value).toBe(240);

      lastScheduledStart = startCall;
      currentTime += 0.04; // 40ms later next turn action
    }
  });

  it('resumes suspended AudioContext on playSound without throwing', () => {
    mockAudioContext.state = 'suspended';
    playSound('draw');

    expect(mockAudioContext.resume).toHaveBeenCalled();
  });

  it('handles AudioContext resume rejection gracefully without throwing unhandled rejection', () => {
    mockAudioContext.state = 'suspended';
    mockAudioContext.resume = vi.fn().mockRejectedValue(new Error('Autoplay blocked by browser'));

    expect(() => {
      playSound('draw');
    }).not.toThrow();
  });

  it('handles AudioContext creation failure gracefully without throwing', () => {
    resetAudioContext();
    const FailingAudioContext = vi.fn(function () {
      throw new Error('Web Audio hardware unavailable');
    });
    vi.stubGlobal('AudioContext', FailingAudioContext);
    vi.stubGlobal('window', { AudioContext: FailingAudioContext });

    expect(() => {
      playSound('draw');
    }).not.toThrow();
  });
});
