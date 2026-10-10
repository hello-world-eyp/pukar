import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PlayerHand } from '../../src/ui/components/PlayerHand';
import { FrustrationOverlay } from '../../src/ui/components/FrustrationOverlay';
import { Card } from '../../src/engine/types';

describe('Frustration UI Components', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const dummyCards: Card[] = [
    { id: 'c1', suit: 'SPADES', rank: 7 },
    { id: 'c2', suit: 'HEARTS', rank: 8 },
  ];

  describe('PlayerHand Frustration Button', () => {
    it('renders the Frustration button when onTriggerFrustration is provided', () => {
      const html = renderToString(
        <PlayerHand
          cards={dummyCards}
          onTriggerFrustration={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="btn-frustration"');
      expect(html).toContain('aria-label="Frustration"');
      expect(html).toContain('Frustration');
      expect(html).not.toContain('disabled');
    });

    it('omits the Frustration button when onTriggerFrustration is not provided', () => {
      const html = renderToString(
        <PlayerHand
          cards={dummyCards}
        />
      );

      expect(html).not.toContain('data-testid="btn-frustration"');
    });

    it('disables the button and displays remaining countdown time during active cooldown', () => {
      const now = 100000;
      vi.setSystemTime(now);
      const cooldownUntil = now + 42000; // 42 seconds left

      const html = renderToString(
        <PlayerHand
          cards={dummyCards}
          frustrationCooldownUntil={cooldownUntil}
          onTriggerFrustration={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="btn-frustration"');
      expect(html).toContain('disabled');
      expect(html).toContain('Frustration (42s)');
      expect(html).toContain('cursor-not-allowed');
    });

    it('displays button enabled when cooldown has expired in the past', () => {
      const now = 200000;
      vi.setSystemTime(now);
      const expiredCooldown = now - 5000; // Expired 5 seconds ago

      const html = renderToString(
        <PlayerHand
          cards={dummyCards}
          frustrationCooldownUntil={expiredCooldown}
          onTriggerFrustration={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="btn-frustration"');
      expect(html).not.toContain('disabled');
      expect(html).toContain('Frustration');
      expect(html).not.toContain('Frustration (');
    });
  });

  describe('FrustrationOverlay', () => {
    it('renders spinning text banner, animation class, and non-blocking pointer-events', () => {
      const html = renderToString(
        <FrustrationOverlay
          playerName="Chacha Ji"
          onComplete={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="frustration-overlay"');
      expect(html).toContain('pointer-events-none');
      expect(html).toContain('animate-frustration-spin');
      expect(html).toContain('Aap Nahi Samjhoge Meri Duvidha');
      expect(html).toContain('Chacha Ji');
    });

    it('renders without player name when not supplied', () => {
      const html = renderToString(
        <FrustrationOverlay
          onComplete={vi.fn()}
        />
      );

      expect(html).toContain('Aap Nahi Samjhoge Meri Duvidha');
      expect(html).not.toContain('—');
    });
  });
});
