import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MainMenu } from '../../src/ui/components/MainMenu';

describe('MainMenu Component', () => {
  it('renders the Pukar royal branding and title', () => {
    const html = renderToString(
      <MainMenu
        onPlayOnline={vi.fn()}
        onPlayLocal={vi.fn()}
        onOpenRules={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="main-menu"');
    expect(html).toContain('PUKAR');
    expect(html).toContain('Royal Rummy');
    expect(html).toContain('Official Royal Edition');
  });

  it('renders both primary options: Play Online Pukar and Play Local Game', () => {
    const html = renderToString(
      <MainMenu
        onPlayOnline={vi.fn()}
        onPlayLocal={vi.fn()}
        onOpenRules={vi.fn()}
      />
    );

    // Option 1: Online
    expect(html).toContain('data-testid="btn-menu-online"');
    expect(html).toContain('Play Online Pukar');
    expect(html).toContain('Online Multiplayer');

    // Option 2: Local
    expect(html).toContain('data-testid="btn-menu-local"');
    expect(html).toContain('Play Local Game');
    expect(html).toContain('Local Pass &amp; Play');
  });

  it('renders rules guide and mute controls', () => {
    const html = renderToString(
      <MainMenu
        onPlayOnline={vi.fn()}
        onPlayLocal={vi.fn()}
        onOpenRules={vi.fn()}
        onToggleMute={vi.fn()}
        isMuted={false}
      />
    );

    expect(html).toContain('data-testid="btn-menu-rules-top"');
    expect(html).toContain('data-testid="btn-menu-sound"');
    expect(html).toContain('Read Complete Game Rules &amp; Scoring Matrix');
  });
});
