import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { GameSetupModal } from '../../src/ui/components/GameSetupModal';

describe('GameSetupModal Component', () => {
  it('renders modal with player count selector and 4 default player inputs by default', () => {
    const html = renderToString(
      <GameSetupModal
        isOpen={true}
        onStartGame={() => {}}
        initialPlayerCount={4}
      />
    );

    expect(html).toContain('data-testid="game-setup-modal"');
    expect(html).toContain('Pukar Setup');
    expect(html).toContain('data-testid="btn-select-4p"');
    expect(html).toContain('data-testid="btn-select-6p"');
    expect(html).toContain('Team A (Partners)');
    expect(html).toContain('Team B (Partners)');
    expect(html).toContain('data-testid="input-player-1"');
    expect(html).toContain('data-testid="input-player-2"');
    expect(html).toContain('data-testid="input-player-3"');
    expect(html).toContain('data-testid="input-player-4"');
    expect(html).not.toContain('data-testid="input-player-5"');
    expect(html).toContain('data-testid="btn-start-game"');
  });

  it('renders 6 inputs when initialPlayerCount is 6', () => {
    const html = renderToString(
      <GameSetupModal
        isOpen={true}
        onStartGame={() => {}}
        initialPlayerCount={6}
      />
    );

    expect(html).toContain('data-testid="input-player-1"');
    expect(html).toContain('data-testid="input-player-2"');
    expect(html).toContain('data-testid="input-player-3"');
    expect(html).toContain('data-testid="input-player-4"');
    expect(html).toContain('data-testid="input-player-5"');
    expect(html).toContain('data-testid="input-player-6"');
  });

  it('pre-populates custom initial player names', () => {
    const customNames = ['Harsh', 'Alex', 'Priya', 'Sam'];
    const html = renderToString(
      <GameSetupModal
        isOpen={true}
        onStartGame={() => {}}
        initialPlayerCount={4}
        initialPlayerNames={customNames}
      />
    );

    expect(html).toContain('value="Harsh"');
    expect(html).toContain('value="Alex"');
    expect(html).toContain('value="Priya"');
    expect(html).toContain('value="Sam"');
  });

  it('renders nothing when isOpen is false', () => {
    const html = renderToString(
      <GameSetupModal
        isOpen={false}
        onStartGame={() => {}}
      />
    );

    expect(html).toBe('');
  });

  it('renders Cancel and close buttons when isGameInProgress is true', () => {
    const html = renderToString(
      <GameSetupModal
        isOpen={true}
        onClose={() => {}}
        onStartGame={() => {}}
        isGameInProgress={true}
      />
    );

    expect(html).toContain('Cancel');
    expect(html).toContain('data-testid="btn-close-setup-modal"');
    expect(html).toContain('Restart &amp; Deal');
  });
});
