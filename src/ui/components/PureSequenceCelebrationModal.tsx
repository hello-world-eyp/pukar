import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Download, RotateCcw, X, Sparkles, Volume2, VolumeX, CheckCircle2 } from 'lucide-react';
import { isSoundEnabled } from '../sound';

export interface PureSequenceCelebrationModalProps {
  team?: 'A' | 'B';
  playerName?: string;
  suit?: 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS';
  onClose: () => void;
  autoCloseOnEnd?: boolean;
}

interface CardParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  scale: number;
  vScale?: number;
  suit: '♠' | '♥' | '♦' | '♣';
  rank: string;
  isRed: boolean;
  alpha: number;
  flutterPhase: number;
  flutterSpeed: number;
  isDeckBurst?: boolean;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  color: string;
  width: number;
  height: number;
  alpha: number;
}

const SUITS: Array<{ symbol: '♠' | '♥' | '♦' | '♣'; isRed: boolean }> = [
  { symbol: '♠', isRed: false },
  { symbol: '♥', isRed: true },
  { symbol: '♦', isRed: true },
  { symbol: '♣', isRed: false },
];

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const PureSequenceCelebrationModal: React.FC<PureSequenceCelebrationModalProps> = ({
  team = 'A',
  playerName = 'Player',
  suit,
  onClose,
  autoCloseOnEnd = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(!isSoundEnabled());
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSuccess, setRecordingSuccess] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSoundTickRef = useRef<number>(0);

  // Character Images
  const imgGunRef = useRef<HTMLImageElement | null>(null);
  const imgThrowRef = useRef<HTMLImageElement | null>(null);

  // Simulation State
  const particlesRef = useRef<{
    cards: CardParticle[];
    sparks: SparkParticle[];
    confetti: ConfettiPiece[];
  }>({
    cards: [],
    sparks: [],
    confetti: [],
  });

  // MediaRecorder Ref for Video Download
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // ---------------------------------------------------------------------------
  // Load Character Assets
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const imgGun = new Image();
    imgGun.src = '/assets/celebration/harsh-card-gun.png';
    imgGunRef.current = imgGun;

    const imgThrow = new Image();
    imgThrow.src = '/assets/celebration/harsh-deck-throw.png';
    imgThrowRef.current = imgThrow;

    return () => {
      imgGun.onload = null;
      imgThrow.onload = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Web Audio Synthesizer for Celebration Sounds
  // ---------------------------------------------------------------------------
  const getAudioContext = useCallback(() => {
    if (isMuted) return null;
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, [isMuted]);

  const playCardFlutterClick = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600 + Math.random() * 300, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch {}
  }, [getAudioContext]);

  const playEmptyGunClick = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [0, 0.12].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now + offset);
        gain.gain.setValueAtTime(0.12, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.03);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.03);
      });
    } catch {}
  }, [getAudioContext]);

  const playDeckThrowWhoosh = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.25);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  }, [getAudioContext]);

  const playFanfareAndChimes = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Grand celebratory brass chords: C4, G4, C5, E5, G5
      const notes = [261.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.08;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.8);
      });

      // Shimmering Bell Chimes
      for (let i = 0; i < 8; i++) {
        const chimeOsc = ctx.createOscillator();
        const chimeGain = ctx.createGain();
        const chimeStart = now + 0.4 + i * 0.09;
        chimeOsc.type = 'sine';
        chimeOsc.frequency.setValueAtTime(1200 + i * 180, chimeStart);
        chimeGain.gain.setValueAtTime(0.15, chimeStart);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, chimeStart + 0.4);
        chimeOsc.connect(chimeGain);
        chimeGain.connect(ctx.destination);
        chimeOsc.start(chimeStart);
        chimeOsc.stop(chimeStart + 0.4);
      }
    } catch {}
  }, [getAudioContext]);

  // ---------------------------------------------------------------------------
  // Canvas Card & Placard Renderer
  // ---------------------------------------------------------------------------
  const drawPlayingCard = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    rank: string,
    suitSymbol: string,
    isRed: boolean,
    rot: number,
    alpha: number
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // Card drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 5;

    // Card white background with rounded corners
    const r = 5;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-w / 2 + r, -h / 2);
    ctx.lineTo(w / 2 - r, -h / 2);
    ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    ctx.lineTo(w / 2, h / 2 - r);
    ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    ctx.lineTo(-w / 2 + r, h / 2);
    ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    ctx.lineTo(-w / 2, -h / 2 + r);
    ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    ctx.closePath();
    ctx.fill();

    // Card border
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#D1D5DB';
    ctx.stroke();

    // Card inner rank & suit symbols
    ctx.fillStyle = isRed ? '#DC2626' : '#111827';
    ctx.font = `bold ${Math.max(10, Math.round(w * 0.32))}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Corner index
    ctx.fillText(rank, -w / 2 + w * 0.24, -h / 2 + h * 0.22);
    // Center suit
    ctx.font = `${Math.max(14, Math.round(w * 0.52))}px serif`;
    ctx.fillText(suitSymbol, 0, h * 0.08);

    ctx.restore();
  };

  const drawPlacard = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    scale: number,
    alpha: number
  ) => {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // Glowing background sunburst rays
    const rayCount = 18;
    const rayLength = 360;
    const rotSpeed = Date.now() * 0.0008;
    ctx.save();
    ctx.rotate(rotSpeed);
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, rayLength, angle - 0.08, angle + 0.08);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(251, 191, 36, 0.05)';
      ctx.fill();
    }
    ctx.restore();

    // Placard Frame Width & Height
    const pw = 680;
    const ph = 260;
    const pr = 28;

    // Outer Glow Shadow
    ctx.shadowColor = 'rgba(245, 158, 11, 0.85)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 8;

    // Placard Deep Gradient Background
    const bgGrad = ctx.createLinearGradient(0, -ph / 2, 0, ph / 2);
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(0.5, '#1E1B4B');
    bgGrad.addColorStop(1, '#0B0F19');

    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(-pw / 2, -ph / 2, pw, ph, pr);
    ctx.fill();

    // Golden Ornate Double Border
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 4;
    const goldGrad = ctx.createLinearGradient(-pw / 2, -ph / 2, pw / 2, ph / 2);
    goldGrad.addColorStop(0, '#FDE047');
    goldGrad.addColorStop(0.3, '#F59E0B');
    goldGrad.addColorStop(0.7, '#D97706');
    goldGrad.addColorStop(1, '#FEF08A');
    ctx.strokeStyle = goldGrad;
    ctx.stroke();

    // Inner subtle border
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.35)';
    ctx.beginPath();
    ctx.roundRect(-pw / 2 + 7, -ph / 2 + 7, pw - 14, ph - 14, pr - 6);
    ctx.stroke();

    // Header Tag
    ctx.fillStyle = '#F59E0B';
    ctx.font = '900 13px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '3px';
    ctx.fillText('★ PUKAR SUPREME 13-CARD RUN ★', 0, -ph / 2 + 38);

    // Main 500 Points Headline with golden gradient and shadow
    ctx.shadowColor = 'rgba(234, 179, 8, 0.6)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 2;

    const titleGrad = ctx.createLinearGradient(-pw / 2, 0, pw / 2, 0);
    titleGrad.addColorStop(0, '#FFFFFF');
    titleGrad.addColorStop(0.5, '#FEF08A');
    titleGrad.addColorStop(1, '#FBBF24');
    ctx.fillStyle = titleGrad;
    ctx.font = '900 38px Outfit, sans-serif';
    ctx.fillText('YOU JUST GOT 500 POINTS!!', 0, -ph / 2 + 96);

    // Let's Go Subtitle
    ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#38BDF8';
    ctx.font = '900 32px Outfit, sans-serif';
    ctx.fillText("LET'S GOOO! 🔥🚀", 0, -ph / 2 + 150);

    // Footnote details
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 15px Outfit, sans-serif';
    const suitNote = suit ? ` in ${suit}` : '';
    ctx.fillText(`Awarded to ${playerName} (Team ${team}) • Pure Sequence 2-to-Ace${suitNote}`, 0, -ph / 2 + 208);

    ctx.restore();
  };

  // ---------------------------------------------------------------------------
  // Main Animation Tick & Choreography
  // ---------------------------------------------------------------------------
  const tickAnimation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!startTimeRef.current) {
      startTimeRef.current = performance.now();
    }

    const elapsedMs = performance.now() - startTimeRef.current;
    const totalDurationMs = 10000;
    setCurrentTimeMs(Math.min(elapsedMs, totalDurationMs));

    const t = elapsedMs / 1000; // in seconds (0 to 10s)
    const cw = canvas.width;
    const ch = canvas.height;

    // Clear Screen with dark atmospheric background
    ctx.clearRect(0, 0, cw, ch);
    const bg = ctx.createRadialGradient(cw / 2, ch / 2, 100, cw / 2, ch / 2, cw * 0.75);
    bg.addColorStop(0, '#0F172A');
    bg.addColorStop(0.7, '#080C14');
    bg.addColorStop(1, '#020617');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);

    // -------------------------------------------------------------------------
    // Phase 1: 0.0s – 1.5s (The Entrance from the Right)
    // -------------------------------------------------------------------------
    // Harsh slides in from right side
    let harshX = cw + 250;
    let harshY = ch * 0.12;
    let harshScale = 0.85;

    if (t < 1.5) {
      const enterProgress = Math.min(1, t / 1.5);
      // Cubic ease out
      const ease = 1 - Math.pow(1 - enterProgress, 3);
      harshX = cw + 250 - ease * (cw * 0.42 + 250);
    } else {
      harshX = cw * 0.58;
    }

    // -------------------------------------------------------------------------
    // Phase 2: 1.5s – 5.2s (The Toy Card Blaster Rapid Spray)
    // -------------------------------------------------------------------------
    // Gun Nozzle coordinates (relative to Harsh position)
    const nozzleX = harshX + 180 * harshScale;
    const nozzleY = harshY + 285 * harshScale;

    if (t >= 1.5 && t < 5.2) {
      // Gentle recoil vibration
      harshX += Math.sin(t * 45) * 2;
      harshY += Math.cos(t * 35) * 1.5;

      // Spawn cards from gun nozzle
      if (Math.random() < 0.65) {
        const randSuit = SUITS[Math.floor(Math.random() * SUITS.length)];
        const randRank = RANKS[Math.floor(Math.random() * RANKS.length)];
        const launchAngle = -Math.PI * 0.65 - Math.random() * 0.45; // towards upper left
        const speed = 14 + Math.random() * 12;

        particlesRef.current.cards.push({
          x: nozzleX,
          y: nozzleY,
          vx: Math.cos(launchAngle) * speed,
          vy: Math.sin(launchAngle) * speed,
          rot: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.25,
          scale: 0.45 + Math.random() * 0.35,
          suit: randSuit.symbol,
          rank: randRank,
          isRed: randSuit.isRed,
          alpha: 1,
          flutterPhase: Math.random() * Math.PI * 2,
          flutterSpeed: 0.1 + Math.random() * 0.15,
        });

        // Trigger sound tick
        if (performance.now() - lastSoundTickRef.current > 75) {
          playCardFlutterClick();
          lastSoundTickRef.current = performance.now();
        }
      }

      // Muzzle spark flashes
      if (Math.random() < 0.7) {
        particlesRef.current.sparks.push({
          x: nozzleX + (Math.random() - 0.5) * 16,
          y: nozzleY + (Math.random() - 0.5) * 16,
          vx: -3 - Math.random() * 6,
          vy: (Math.random() - 0.5) * 4,
          color: Math.random() > 0.3 ? '#FDE047' : '#FFFFFF',
          size: 4 + Math.random() * 5,
          alpha: 1,
          life: 0,
          maxLife: 12,
        });
      }
    }

    // -------------------------------------------------------------------------
    // Phase 3: 5.2s – 5.6s (Out of Ammo Click-Click)
    // -------------------------------------------------------------------------
    if (t >= 5.2 && t < 5.6) {
      if (Math.abs(t - 5.25) < 0.03 && performance.now() - lastSoundTickRef.current > 300) {
        playEmptyGunClick();
        lastSoundTickRef.current = performance.now();
      }
    }

    // -------------------------------------------------------------------------
    // Phase 4: 5.6s – 7.2s (Deck Throw & Full-Screen Wipe)
    // -------------------------------------------------------------------------
    const isThrowPhase = t >= 5.6;

    if (t >= 5.6 && t < 6.0 && particlesRef.current.cards.filter((c) => c.isDeckBurst).length === 0) {
      playDeckThrowWhoosh();
      // Burst 90 cards straight out towards camera from pocket throw
      const handThrowX = harshX + 160 * harshScale;
      const handThrowY = harshY + 360 * harshScale;

      for (let i = 0; i < 85; i++) {
        const randSuit = SUITS[Math.floor(Math.random() * SUITS.length)];
        const randRank = RANKS[Math.floor(Math.random() * RANKS.length)];
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 18;

        particlesRef.current.cards.push({
          x: handThrowX,
          y: handThrowY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          rot: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.3,
          scale: 0.1,
          vScale: 0.045 + Math.random() * 0.055, // Expands dramatically towards screen
          suit: randSuit.symbol,
          rank: randRank,
          isRed: randSuit.isRed,
          alpha: 1,
          flutterPhase: Math.random() * Math.PI * 2,
          flutterSpeed: 0.12,
          isDeckBurst: true,
        });
      }
    }

    // -------------------------------------------------------------------------
    // Phase 5: 7.2s – 10.0s (Cards Fall & 500-PT Placard Reveal)
    // -------------------------------------------------------------------------
    const isPlacardPhase = t >= 7.2;

    if (isPlacardPhase && particlesRef.current.confetti.length === 0) {
      playFanfareAndChimes();
      // Spawn Confetti explosion
      const confettiColors = ['#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#EC4899', '#FEF08A'];
      for (let i = 0; i < 90; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 6 + Math.random() * 16;
        particlesRef.current.confetti.push({
          x: cw / 2,
          y: ch / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 6,
          rot: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.25,
          color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
          width: 8 + Math.random() * 8,
          height: 14 + Math.random() * 12,
          alpha: 1,
        });
      }
    }

    // -------------------------------------------------------------------------
    // Render Character Pose (Gun vs Deck Throw)
    // -------------------------------------------------------------------------
    const currentImg = isThrowPhase ? imgThrowRef.current : imgGunRef.current;
    if (currentImg && currentImg.complete && currentImg.naturalWidth > 0) {
      ctx.save();
      const imgW = 480 * harshScale;
      const imgH = 480 * harshScale;
      ctx.drawImage(currentImg, harshX, harshY, imgW, imgH);
      ctx.restore();
    } else {
      // Minimalist silhouette fallback while images load
      ctx.save();
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(harshX + 180, harshY + 140, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // -------------------------------------------------------------------------
    // Update and Render Sparks
    // -------------------------------------------------------------------------
    const sparks = particlesRef.current.sparks;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.life++;
      sp.alpha = 1 - sp.life / sp.maxLife;

      ctx.save();
      ctx.globalAlpha = Math.max(0, sp.alpha);
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (sp.life >= sp.maxLife) {
        sparks.splice(i, 1);
      }
    }

    // -------------------------------------------------------------------------
    // Update and Render Cards
    // -------------------------------------------------------------------------
    const cards = particlesRef.current.cards;
    for (let i = cards.length - 1; i >= 0; i--) {
      const c = cards[i];

      // Fluttering horizontal weave
      c.flutterPhase += c.flutterSpeed;
      c.x += c.vx + Math.sin(c.flutterPhase) * 2;

      // Accelerated gravity if in placard phase so screen clears
      const gravity = isPlacardPhase ? 1.4 : 0.42;
      c.vy += gravity;
      c.y += c.vy;

      c.rot += c.vRot;

      if (c.vScale && c.scale < 2.4 && !isPlacardPhase) {
        c.scale += c.vScale;
      }

      // Draw card
      const cardW = 54 * c.scale;
      const cardH = 76 * c.scale;

      drawPlayingCard(
        ctx,
        c.x,
        c.y,
        cardW,
        cardH,
        c.rank,
        c.suit,
        c.isRed,
        c.rot,
        c.alpha
      );

      // Remove out-of-bounds cards
      if (c.y > ch + 200 || c.x < -300 || c.x > cw + 300) {
        cards.splice(i, 1);
      }
    }

    // -------------------------------------------------------------------------
    // Update and Render Confetti
    // -------------------------------------------------------------------------
    const confetti = particlesRef.current.confetti;
    for (let i = confetti.length - 1; i >= 0; i--) {
      const cf = confetti[i];
      cf.x += cf.vx;
      cf.vy += 0.22; // gravity
      cf.y += cf.vy;
      cf.rot += cf.vRot;

      ctx.save();
      ctx.translate(cf.x, cf.y);
      ctx.rotate(cf.rot);
      ctx.fillStyle = cf.color;
      ctx.fillRect(-cf.width / 2, -cf.height / 2, cf.width, cf.height);
      ctx.restore();

      if (cf.y > ch + 50) {
        confetti.splice(i, 1);
      }
    }

    // -------------------------------------------------------------------------
    // Render Center 500-PT Placard (7.2s to 10s)
    // -------------------------------------------------------------------------
    if (isPlacardPhase) {
      const placardAge = t - 7.2;
      // Spring elastic drop
      const enterDuration = 0.55;
      let placardScale = 1;
      let placardAlpha = 1;

      if (placardAge < enterDuration) {
        const p = placardAge / enterDuration;
        // Elastic bounce easing
        placardScale = Math.sin((p * Math.PI) / 2) * 1.05;
        placardAlpha = Math.min(1, p * 2);
      }

      drawPlacard(ctx, cw / 2 - 40, ch / 2 - 10, placardScale, placardAlpha);
    }

    // Continue loop until 10s or user pauses
    if (elapsedMs < totalDurationMs) {
      animationFrameRef.current = requestAnimationFrame(tickAnimation);
    } else {
      setIsPlaying(false);
      if (autoCloseOnEnd) {
        setTimeout(onClose, 2500);
      }
    }
  }, [
    suit,
    playerName,
    team,
    autoCloseOnEnd,
    onClose,
    playCardFlutterClick,
    playEmptyGunClick,
    playDeckThrowWhoosh,
    playFanfareAndChimes,
  ]);

  // ---------------------------------------------------------------------------
  // Animation Loop Controller
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = performance.now() - currentTimeMs;
      animationFrameRef.current = requestAnimationFrame(tickAnimation);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, tickAnimation, currentTimeMs]);

  const handleReplay = () => {
    particlesRef.current = { cards: [], sparks: [], confetti: [] };
    startTimeRef.current = performance.now();
    setCurrentTimeMs(0);
    setIsPlaying(true);
    setRecordingSuccess(false);
  };

  // ---------------------------------------------------------------------------
  // 1-Click Video Exporter (MediaRecorder API)
  // ---------------------------------------------------------------------------
  const handleDownloadVideo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setIsRecording(true);
      setRecordingSuccess(false);
      recordedChunksRef.current = [];

      // Restart animation from 0s for pristine video capture
      handleReplay();

      const stream = canvas.captureStream(60);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pukar-500-points-celebration.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsRecording(false);
        setRecordingSuccess(true);
      };

      recorder.start();

      // Record for exactly 10.2 seconds
      setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }, 10200);
    } catch (err) {
      console.error('Failed to record celebration video:', err);
      setIsRecording(false);
    }
  };

  const progressPercent = Math.min(100, (currentTimeMs / 10000) * 100);

  return (
    <div
      data-testid="pure-sequence-celebration-modal"
      role="dialog"
      aria-label="500 Points Celebration"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md select-none overflow-hidden"
    >
      {/* Top Header / Close Bar */}
      <div className="absolute top-4 inset-x-6 z-20 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-900/80 border border-amber-500/40 text-amber-300 shadow-xl backdrop-blur-md">
          <Sparkles className="w-5 h-5 text-amber-400 animate-spin-slow" />
          <span className="text-xs sm:text-sm font-black tracking-wide uppercase">
            500-PT PURE SEQUENCE CELEBRATION
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mute Audio Toggle */}
          <button
            onClick={() => setIsMuted((prev) => !prev)}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 hover:border-amber-400 text-slate-300 hover:text-white transition-colors cursor-pointer backdrop-blur-md"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Close Modal */}
          <button
            onClick={onClose}
            title="Close Celebration"
            className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 hover:border-red-500 hover:bg-red-500/20 text-slate-300 hover:text-red-300 transition-colors cursor-pointer backdrop-blur-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main 16:9 Celebration Canvas */}
      <div className="relative w-full max-w-5xl aspect-video mx-auto px-4 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="w-full h-full object-contain rounded-3xl shadow-2xl border-2 border-amber-500/50 bg-slate-950"
        />

        {/* Recording Overlay Pill */}
        {isRecording && (
          <div className="absolute top-8 left-8 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/90 text-white text-xs font-black uppercase tracking-wider animate-pulse shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-white" />
            RECORDING 10S VIDEO...
          </div>
        )}
      </div>

      {/* Bottom Timeline & Controls Bar */}
      <div className="mt-4 w-full max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3 z-20">
        {/* Timeline Progress Bar */}
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <span className="text-xs font-mono font-bold text-amber-400 min-w-[38px]">
            {(currentTimeMs / 1000).toFixed(1)}s
          </span>
          <div className="relative flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 transition-all duration-75 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-slate-400">10.0s</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleReplay}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white transition-all cursor-pointer shadow-md active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Replay (10s)
          </button>

          <button
            onClick={handleDownloadVideo}
            disabled={isRecording}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg active:scale-95 ${
              recordingSuccess
                ? 'bg-emerald-600 text-white border border-emerald-400'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-amber-500/20'
            }`}
          >
            {recordingSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                Video Downloaded!
              </>
            ) : isRecording ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                Capturing Video...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-slate-950" />
                Download 10s Video
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            Continue Game
          </button>
        </div>
      </div>
    </div>
  );
};
