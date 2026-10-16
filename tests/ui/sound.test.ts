import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  playSound,
  setSoundEnabled,
  isSoundEnabled,
  toggleSound,
  resetAudioContext,
  type SoundEffect,
} from '../../src/ui/sound';

describe('Sound Synthesizer (src/ui/sound.ts)', () => {
  const mockOscillator = {
    type: 'sine',
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
    currentTime: 100,
    state: 'running',
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => mockOscillator),
    createGain: vi.fn(() => mockGain),
  };

  beforeEach(() => {
    resetAudioContext();
    setSoundEnabled(true);
    mockAudioContext.state = 'running';
    mockOscillator.type = 'sine';

    mockAudioContext.createOscillator = vi.fn(() => mockOscillator);
    mockAudioContext.createGain = vi.fn(() => mockGain);
    mockAudioContext.resume = vi.fn().mockResolvedValue(undefined);
    mockOscillator.start = vi.fn();
    mockOscillator.stop = vi.fn();
    mockOscillator.connect = vi.fn();
    mockGain.connect = vi.fn();
    mockOscillator.frequency.setValueAtTime = vi.fn();
    mockOscillator.frequency.exponentialRampToValueAtTime = vi.fn();
    mockGain.gain.setValueAtTime = vi.fn();
    mockGain.gain.exponentialRampToValueAtTime = vi.fn();

    const MockAudioContext = vi.fn(function () {
      return mockAudioContext;
    });
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('window', {
      AudioContext: MockAudioContext,
    });
  });

  afterEach(() => {
    resetAudioContext();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Sound Preferences & Toggles', () => {
    it('initializes with sound enabled', () => {
      setSoundEnabled(true);
      expect(isSoundEnabled()).toBe(true);
    });

    it('toggles sound on and off', () => {
      setSoundEnabled(true);
      const newState1 = toggleSound();
      expect(newState1).toBe(false);
      expect(isSoundEnabled()).toBe(false);

      const newState2 = toggleSound();
      expect(newState2).toBe(true);
      expect(isSoundEnabled()).toBe(true);
    });

    it('explicitly sets sound enabled state', () => {
      setSoundEnabled(false);
      expect(isSoundEnabled()).toBe(false);

      setSoundEnabled(true);
      expect(isSoundEnabled()).toBe(true);
    });
  });

  describe('Sound Playback Effects', () => {
    const effects: SoundEffect[] = ['draw', 'meld', 'discard', 'pukar', 'error', 'roundOver'];

    it.each(effects)('plays sound effect "%s" when sound is enabled', (effect) => {
      playSound(effect);

      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
      expect(mockOscillator.start).toHaveBeenCalled();
      expect(mockOscillator.stop).toHaveBeenCalled();
      expect(mockOscillator.connect).toHaveBeenCalledWith(mockGain);
      expect(mockGain.connect).toHaveBeenCalledWith(mockAudioContext.destination);
    });

    it('does not play sounds when sound is disabled', () => {
      setSoundEnabled(false);

      effects.forEach((effect) => {
        playSound(effect);
      });

      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
      expect(mockAudioContext.createGain).not.toHaveBeenCalled();
    });

    it('resumes suspended audio context on play', () => {
      mockAudioContext.state = 'suspended';

      playSound('draw');

      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('plays "draw" sound with triangle oscillator and frequency ramp', () => {
      playSound('draw');

      expect(mockOscillator.type).toBe('triangle');
      expect(mockOscillator.frequency.value).toBe(240);
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(240, 100.015);
      expect(mockOscillator.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(340, 100.095);
      expect(mockGain.gain.setValueAtTime).toHaveBeenCalledWith(0.001, 100.015);
      expect(mockGain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.08, 100.02);
      expect(mockGain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 100.095);
    });

    it('plays "discard" sound with sine wave and descending frequency ramp', () => {
      playSound('discard');

      expect(mockOscillator.type).toBe('sine');
      expect(mockOscillator.frequency.value).toBe(240);
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(240, 100.015);
      expect(mockOscillator.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(120, 100.085);
    });

    it('plays "meld" sound with 3-note harmonic triad (C5, E5, G5)', () => {
      playSound('meld');

      // 3 oscillators created for triad
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(3);
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(523.25, 100.015);
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(659.25, 100.075);
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(783.99, 100.135);
    });

    it('plays "pukar" sound with heavy physical slam thud and celebratory chime', () => {
      playSound('pukar');

      // 4 impact slam layers + 4 celebratory chime notes = 8 oscillators
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(8);
      // Sub-bass heavy thud impact
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(160, 100.015);
      expect(mockOscillator.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(36, 100.395);
      // Table crunch resonance
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(260, 100.015);
      expect(mockOscillator.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(45, 100.235);
      // Card snap transient
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(440, 100.015);
      expect(mockOscillator.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(80, 100.095);
      // Table tremor rumble
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(60, 100.015);
      expect(mockOscillator.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(28, 100.465);
      // Trailing chime arpeggio
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(523.25, 100.135);
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(1046.5, 100.345);
    });

    it('plays "roundOver" grand victory chord arpeggio', () => {
      playSound('roundOver');

      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(4);
      expect(mockOscillator.type).toBe('sine');
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(440, 100.015);
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(880, 100.315);
    });

    it('plays "error" sound with buzzy sawtooth wave', () => {
      playSound('error');

      expect(mockOscillator.type).toBe('sawtooth');
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(160, 100.015);
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(120, 100.075);
    });

    it('gracefully handles missing window/AudioContext without throwing', () => {
      vi.stubGlobal('window', undefined);

      expect(() => {
        playSound('draw');
      }).not.toThrow();
    });

    it('gracefully handles AudioContext construction failure', () => {
      const FailingConstructor = vi.fn(function () {
        throw new Error('Web Audio not allowed');
      });
      vi.stubGlobal('AudioContext', FailingConstructor);
      vi.stubGlobal('window', {
        AudioContext: FailingConstructor,
      });

      expect(() => {
        playSound('draw');
      }).not.toThrow();
    });
  });
});
