import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BotSetupModal } from '../../src/ui/components/BotSetupModal';
import { MainMenu } from '../../src/ui/components/MainMenu';
import { ModeSelectorModal } from '../../src/ui/components/ModeSelectorModal';
import { App } from '../../src/App';
import { dealInitialState } from '../../src/engine/deck';
import { BotGameConfig } from '../../src/engine/bots/types';

describe('Bot Mode UI Components & Integration', () => {
  describe('BotSetupModal', () => {
    it('renders 4-player setup with team selections and only bot names (no strategy spoilers)', () => {
      const handleStartBotGame = vi.fn();
      const handleClose = vi.fn();

      const html = renderToString(
        <BotSetupModal
          isOpen={true}
          onClose={handleClose}
          onStartBotGame={handleStartBotGame}
          initialPlayerCount={4}
          initialPlayerName="Harsh"
        />
      );

      // Verify header and player name
      expect(html).toContain('data-testid="bot-setup-modal"');
      expect(html).toContain('Play With Bots');
      expect(html).toContain('value="Harsh"');

      // Verify dropdowns
      expect(html).toContain('data-testid="select-bot-partner-1"');
      expect(html).toContain('data-testid="select-bot-opponent-1"');
      expect(html).toContain('data-testid="select-bot-opponent-2"');

      // Verify bot names are displayed without strategy leaks
      expect(html).toContain('Sid');
      expect(html).toContain('Heman');
      expect(html).toContain('Chachi');
      expect(html).toContain('Harsh');

      // Ensure strategy details are NOT leaked in markup
      expect(html).not.toContain('discard hoarder');
      expect(html).not.toContain('extreme ends');
      expect(html).not.toContain('predicts opponent');
    });

    it('renders 6-player format with 2nd partner and 3rd opponent dropdowns when playerCount is 6', () => {
      const html = renderToString(
        <BotSetupModal
          isOpen={true}
          onClose={() => {}}
          onStartBotGame={() => {}}
          initialPlayerCount={6}
          initialPlayerName="Pooja"
        />
      );

      expect(html).toContain('data-testid="select-bot-partner-1"');
      expect(html).toContain('data-testid="select-bot-partner-2"');
      expect(html).toContain('data-testid="select-bot-opponent-1"');
      expect(html).toContain('data-testid="select-bot-opponent-2"');
      expect(html).toContain('data-testid="select-bot-opponent-3"');
    });

    it('returns null when isOpen is false', () => {
      const html = renderToString(
        <BotSetupModal
          isOpen={false}
          onClose={() => {}}
          onStartBotGame={() => {}}
        />
      );
      expect(html).toBe('');
    });
  });

  describe('MainMenu & ModeSelectorModal Bot Integration', () => {
    it('renders Play with Bots card on MainMenu with AI arena description', () => {
      const html = renderToString(
        <MainMenu
          onPlayOnline={() => {}}
          onPlayBots={() => {}}
          onPlayLocal={() => {}}
          onOpenRules={() => {}}
        />
      );

      expect(html).toContain('data-testid="card-mode-bots"');
      expect(html).toContain('data-testid="btn-menu-bots"');
      expect(html).toContain('Play With Bots');
      expect(html).toContain('AI Arena Mode');
    });

    it('renders Play with Bots button in ModeSelectorModal', () => {
      const html = renderToString(
        <ModeSelectorModal
          isOpen={true}
          onSelectLocal={() => {}}
          onSelectBots={() => {}}
          onSelectMultiplayer={() => {}}
          onClose={() => {}}
        />
      );

      expect(html).toContain('data-testid="btn-mode-bots"');
      expect(html).toContain('Play With Bots (AI Arena)');
    });
  });

  describe('In-Game Bot Mode Lifecycle & View Locking', () => {
    it('renders in-game table in BOTS mode with bot thinking banner when bot is active', () => {
      const initialState = dealInitialState(4, undefined, [
        'You',
        'Chachi',
        'Sid',
        'Harsh',
      ]);

      const botConfig: BotGameConfig = {
        playerCount: 4,
        seats: [
          { seatIndex: 0, name: 'You', personality: 'smart_chacha', isHuman: true },
          { seatIndex: 1, name: 'Chachi', personality: 'fast_chachi', isHuman: false },
          { seatIndex: 2, name: 'Sid', personality: 'smart_chacha', isHuman: false },
          { seatIndex: 3, name: 'Harsh', personality: 'the_long_term_guy', isHuman: false },
        ],
      };

      // Set current player to bot (Seat 1: Chachi)
      initialState.currentPlayerIndex = 1;
      initialState.phase = 'DRAW';

      const html = renderToString(
        <App
          initialState={initialState}
          initialMode="BOTS"
          initialScreen="GAME"
          initialBotConfig={botConfig}
        />
      );

      // Verify top nav and center table are present
      expect(html).toContain('data-testid="top-nav-bar"');
      expect(html).toContain('aria-label="Center Table Decks"');

      // Dev inspector is available in BOTS mode
      expect(html).toContain('data-testid="dev-inspector"');

      // Bot thinking banner is rendered
      expect(html).toContain('data-testid="bot-thinking-banner"');
      expect(html).toContain('Chachi');
      expect(html).toContain('AI Turn');
    });

    it('does not render bot thinking banner when active turn belongs to human player (Seat 0)', () => {
      const initialState = dealInitialState(4, undefined, [
        'You',
        'Chachi',
        'Sid',
        'Harsh',
      ]);

      const botConfig: BotGameConfig = {
        playerCount: 4,
        seats: [
          { seatIndex: 0, name: 'You', personality: 'smart_chacha', isHuman: true },
          { seatIndex: 1, name: 'Chachi', personality: 'fast_chachi', isHuman: false },
          { seatIndex: 2, name: 'Sid', personality: 'smart_chacha', isHuman: false },
          { seatIndex: 3, name: 'Harsh', personality: 'the_long_term_guy', isHuman: false },
        ],
      };

      // Human turn (Seat 0)
      initialState.currentPlayerIndex = 0;
      initialState.phase = 'DRAW';

      const html = renderToString(
        <App
          initialState={initialState}
          initialMode="BOTS"
          initialScreen="GAME"
          initialBotConfig={botConfig}
        />
      );

      expect(html).not.toContain('data-testid="bot-thinking-banner"');
    });
  });
});
