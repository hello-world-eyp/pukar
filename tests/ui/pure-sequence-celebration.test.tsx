import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PureSequenceCelebrationModal } from '../../src/ui/components/PureSequenceCelebrationModal';
import { DevInspector } from '../../src/ui/components/DevInspector';

describe('PureSequenceCelebrationModal Component', () => {
  it('renders celebration modal with 10s timeline, canvas, and controls', () => {
    const handleClose = vi.fn();
    const html = renderToString(
      <PureSequenceCelebrationModal
        team="A"
        playerName="Harsh"
        suit="SPADES"
        onClose={handleClose}
      />
    );

    // Verify modal elements and text
    expect(html).toContain('data-testid="pure-sequence-celebration-modal"');
    expect(html).toContain('500-PT PURE SEQUENCE CELEBRATION');
    expect(html).toContain('Replay (10s)');
    expect(html).toContain('Download 10s Video');
    expect(html).toContain('Continue Game');
    expect(html).toContain('<video');
    expect(html).toContain('data-testid="pure-sequence-celebration-video"');
    expect(html).toContain('/assets/celebration/500-points-celebration.mp4');
  });

  it('renders DevInspector preview button when onPreviewCelebration is provided', () => {
    const handlePreview = vi.fn();
    const html = renderToString(
      <DevInspector
        players={[
          { id: 'p1', name: 'Player 1', team: 'A', hand: [], cardCount: 0 },
          { id: 'p2', name: 'Player 2', team: 'B', hand: [], cardCount: 0 },
        ]}
        currentPlayerIndex={0}
        onSwitchPlayer={vi.fn()}
        onPreviewCelebration={handlePreview}
      />
    );

    expect(html).toContain('data-testid="btn-preview-500-celebration"');
    expect(html).toContain('Preview 500-Pt Animation');
  });
});
