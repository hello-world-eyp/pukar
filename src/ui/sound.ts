/**
 * Web Audio API Sound Synthesizer for Pukar Card Game.
 * Zero external audio assets required; produces clean, synthesized retro/casino tones.
 * Safely handles environments where Web Audio is disabled, unsupported, or in SSR/Node.
 */

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

function getAudioContext(): AudioContext | null {
  const win =
    typeof window !== 'undefined'
      ? window
      : typeof globalThis !== 'undefined' && (globalThis as unknown as { window?: Window }).window
      ? (globalThis as unknown as { window: Window }).window
      : null;
  if (!win) return null;

  if (!audioCtx) {
    const AudioContextClass =
      (win as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (win as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
      (typeof globalThis !== 'undefined' && (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext);
    if (AudioContextClass) {
      try {
        audioCtx = new AudioContextClass();
      } catch {
        return null;
      }
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function resetAudioContext(): void {
  audioCtx = null;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function toggleSound(): boolean {
  soundEnabled = !soundEnabled;
  return soundEnabled;
}

export type SoundEffect = 'draw' | 'meld' | 'discard' | 'pukar' | 'error' | 'roundOver';

// Lookahead buffer to prevent main-thread scheduling jitter, audio quantum underruns, and ramp pitch truncation
export const AUDIO_SCHEDULE_LOOKAHEAD_SEC = 0.015;

export function playSound(effect: SoundEffect): void {
  if (!soundEnabled) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime + AUDIO_SCHEDULE_LOOKAHEAD_SEC;

    switch (effect) {
      case 'draw': {
        // Warm tactile card-slide swoosh (steady 240Hz -> 340Hz slide without piercing 520Hz whistle)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 240;
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(340, now + 0.08);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }

      case 'discard': {
        // Soft card tap
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 240;
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.07);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.1, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.07);
        break;
      }

      case 'meld': {
        // Upward pleasant harmonic triad: C5 (523Hz), E5 (659Hz), G5 (784Hz)
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const noteTime = now + idx * 0.06;
          osc.type = 'sine';
          osc.frequency.value = freq;
          osc.frequency.setValueAtTime(freq, noteTime);
          gain.gain.setValueAtTime(0.001, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.12, noteTime + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.16);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(noteTime);
          osc.stop(noteTime + 0.16);
        });
        break;
      }

      case 'pukar': {
        // Heavy tactile table thud / physical slam impact with celebratory chime

        // 1. Sub-bass visceral drop (weight/slam punch)
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.value = 160;
        subOsc.frequency.setValueAtTime(160, now);
        subOsc.frequency.exponentialRampToValueAtTime(36, now + 0.38);
        subGain.gain.setValueAtTime(0.75, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        subOsc.start(now);
        subOsc.stop(now + 0.38);

        // 2. Table surface crunch (wooden resonance of cards slamming)
        const crunchOsc = ctx.createOscillator();
        const crunchGain = ctx.createGain();
        crunchOsc.type = 'triangle';
        crunchOsc.frequency.value = 260;
        crunchOsc.frequency.setValueAtTime(260, now);
        crunchOsc.frequency.exponentialRampToValueAtTime(45, now + 0.22);
        crunchGain.gain.setValueAtTime(0.55, now);
        crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        crunchOsc.connect(crunchGain);
        crunchGain.connect(ctx.destination);
        crunchOsc.start(now);
        crunchOsc.stop(now + 0.22);

        // 3. Card pack transient slap (crisp tactile strike on felt)
        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();
        snapOsc.type = 'triangle';
        snapOsc.frequency.value = 440;
        snapOsc.frequency.setValueAtTime(440, now);
        snapOsc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
        snapGain.gain.setValueAtTime(0.35, now);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        snapOsc.connect(snapGain);
        snapGain.connect(ctx.destination);
        snapOsc.start(now);
        snapOsc.stop(now + 0.08);

        // 4. Low table tremor rumble (decaying table acoustic body vibration)
        const rumbleOsc = ctx.createOscillator();
        const rumbleGain = ctx.createGain();
        rumbleOsc.type = 'sine';
        rumbleOsc.frequency.value = 60;
        rumbleOsc.frequency.setValueAtTime(60, now);
        rumbleOsc.frequency.exponentialRampToValueAtTime(28, now + 0.45);
        rumbleGain.gain.setValueAtTime(0.45, now);
        rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        rumbleOsc.connect(rumbleGain);
        rumbleGain.connect(ctx.destination);
        rumbleOsc.start(now);
        rumbleOsc.stop(now + 0.45);

        // 5. Trailing golden celebration chime (ringing in as dust settles from slam)
        const chimeNotes = [523.25, 659.25, 783.99, 1046.5];
        chimeNotes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const noteTime = now + 0.12 + idx * 0.07;
          osc.type = 'triangle';
          osc.frequency.value = freq;
          osc.frequency.setValueAtTime(freq, noteTime);
          gain.gain.setValueAtTime(0.18, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.32);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(noteTime);
          osc.stop(noteTime + 0.32);
        });
        break;
      }

      case 'roundOver': {
        // Grand victory chord arpeggio
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const noteTime = now + idx * 0.1;
          osc.type = 'sine';
          osc.frequency.value = freq;
          osc.frequency.setValueAtTime(freq, noteTime);
          gain.gain.setValueAtTime(0.14, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(noteTime);
          osc.stop(noteTime + 0.4);
        });
        break;
      }

      case 'error': {
        // Low buzzy warning boop
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 160;
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.setValueAtTime(120, now + 0.06);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
        break;
      }
    }
  } catch {
    // Gracefully ignore audio errors in headless/test environments
  }
}
