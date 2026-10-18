# Graph Report - Pukar game  (2026-10-18)

## Corpus Check
- 168 files · ~220,016 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 4, .css 1, .command 1)

## Summary
- 863 nodes · 2866 edges · 43 communities (33 shown, 10 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 100 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `36ef5cdd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PukarSlamOverlay.tsx
- Deck Creation & Sequence Mechanics
- server.ts
- App.tsx
- ClientMessage
- useLocalGame.ts
- Bot AI & Turn Decision Strategies
- TableSeating
- TypeScript Configuration
- Asset Generation Scripts
- macOS Native Integration
- Package Manifest & Metadata
- Build Tooling & Dev Dependencies
- Package Run Scripts
- Security Overrides
- Production Dependencies
- Vite Build Configuration
- Node Runtime Constraints
- Game Launcher Shell Script
- Game Rules & Mechanics
- Design Specification: Pukar Multiplayer (LAN & Online)
- Meld
- ErrorBoundary.tsx
- 3. Game Rules & Formal Specification
- PlayerHand.tsx
- SocketClient
- Global Constraints
- react
- build-royal-heritage-deck.py
- CLAUDE.md
- GEMINI.md
- GameState
- useMultiplayerGame.ts
- useMultiplayerGame.test.ts
- game-elements-comprehensive.test.tsx
- network/types.ts
- Global Constraints
- socket-client.ts
- GameSetupModal.tsx
- MainMenu.tsx
- MockResizeObserver

## God Nodes (most connected - your core abstractions)
1. `Card` - 89 edges
2. `vitest` - 87 edges
3. `Meld` - 59 edges
4. `dealInitialState()` - 54 edges
5. `GameState` - 48 edges
6. `react` - 48 edges
7. `App()` - 46 edges
8. `pukarReducer()` - 45 edges
9. `react-dom` - 44 edges
10. `canAddCardsToMeld()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `4.3 Game Coordinator (`server/game-coordinator.ts`)` --references--> `sanitizeStateForPlayer()`  [INFERRED]
  docs/superpowers/specs/2026-10-09-pukar-multiplayer-design.md → src/engine/sanitizer.ts
- `8.1 Unit Tests` --references--> `sanitizeStateForPlayer()`  [INFERRED]
  docs/superpowers/specs/2026-10-09-pukar-multiplayer-design.md → src/engine/sanitizer.ts
- `Task 7: Full Application Assembly & End-to-End Verification` --references--> `GameState`  [INFERRED]
  docs/superpowers/plans/2026-10-07-pukar-card-game.md → src/engine/types.ts
- `Task 9: Realistic Uncle Pukar Deck Selection (No Peeking into Face-Down Cards)` --references--> `selectBotPukarDeck()`  [INFERRED]
  docs/superpowers/plans/2026-10-14-bot-intelligence-enhancements.md → src/engine/bots/bot-player.ts
- `Task 3: Multi-Meld Opening Turns (Pure + Dirty in the Same Turn)` --references--> `findBestMeldPlan()`  [INFERRED]
  docs/superpowers/plans/2026-10-14-bot-intelligence-enhancements.md → src/engine/bots/hand-analyzer.ts

## Import Cycles
- None detected.

## Communities (43 total, 10 thin omitted)

### Community 0 - "PukarSlamOverlay.tsx"
Cohesion: 0.32
Nodes (5): BurstParticle, CELEBRATION_SYMBOLS, generateParticles(), PukarSlamOverlay(), PukarSlamOverlayProps

### Community 1 - "Deck Creation & Sequence Mechanics"
Cohesion: 0.06
Nodes (55): Task 3: Authoritative Game Coordinator & State Sanitization, Core Objectives:, vitest, createDecks(), dealInitialState(), shuffleDeck(), calculateMatchMVP(), createInitialMatchStats() (+47 more)

### Community 2 - "server.ts"
Cohesion: 0.05
Nodes (43): Task 1: Networking Dependencies, Core Server Types & Structured Diagnostic Logger, 5.3 React Hook (`src/network/useMultiplayerGame.ts`), ws, GameCoordinator, formatLog, formatLogMessage(), LogContext, logger (+35 more)

### Community 3 - "App.tsx"
Cohesion: 0.09
Nodes (17): App(), parseRoomCodeFromUrl(), useVoiceChat(), DevInspector(), MultiplayerStatusBar(), PureSequenceCelebrationModal(), PureSequenceCelebrationModalProps, PlayerInfo (+9 more)

### Community 4 - "ClientMessage"
Cohesion: 0.24
Nodes (5): ClientMessage, GOOGLE_STUN_CONFIG, PlayerVoiceState, UseVoiceChatOptions, UseVoiceChatReturn

### Community 5 - "useLocalGame.ts"
Cohesion: 0.12
Nodes (27): JokerOption, UseMultiplayerGameReturn, JokerPromptModalProps, MultiplayerHubProps, useGameAudio(), JokerPromptData, UnclePukarChoiceData, useGameModals() (+19 more)

### Community 6 - "Bot AI & Turn Decision Strategies"
Cohesion: 0.07
Nodes (69): Task 2: Core Data Types & Deck Management, Bot Intelligence Enhancements Implementation Plan, Global Constraints, Task 10: Strict Lockdown Against Opponent on 1 Card & Burying Connecting Cards for Partner, Task 1: Clean 7 Completion Priority Over Opening New 3-Card Melds, Task 2: Preserving Clean Runs (Preventing Premature Wildcard Tainting), Task 3: Multi-Meld Opening Turns (Pure + Dirty in the Same Turn), Task 4: Natural Joker Retrieval Priority & Mid-Turn Re-Planning (+61 more)

### Community 7 - "TableSeating"
Cohesion: 0.31
Nodes (9): Global Constraints, Pukar Table UI Redesign & Sequence Renaming Plan, Task 1: UI Terminology Migration: "Meld" -> "Sequence" Across Components & Modals, Task 2: Relative Seating Calculation & `PlayerSeat` / `TableSeating` Component, Task 3: Casino Felt Table Styling & Wide Layout Container, Task 6: Full Integration Verification & Build Audit, getRelativeTableSeats(), PlayerSeat() (+1 more)

### Community 8 - "TypeScript Configuration"
Cohesion: 0.11
Nodes (18): compilerOptions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 9 - "Asset Generation Scripts"
Cohesion: 0.18
Nodes (14): CARDS_DIR, __dirname, __filename, generateCardSVG(), getClubPip(), getDiamondPip(), getHeartPip(), getSpadePip() (+6 more)

### Community 10 - "macOS Native Integration"
Cohesion: 0.17
Nodes (7): AppKit, Foundation, applyCornerPips(), createCardContext(), makePipSvg(), MasterCard, savePNG()

### Community 11 - "Package Manifest & Metadata"
Cohesion: 0.13
Nodes (14): name, private, type, version, autoprefixer, postcss, tailwindcss, tsx (+6 more)

### Community 12 - "Build Tooling & Dev Dependencies"
Cohesion: 0.14
Nodes (14): devDependencies, autoprefixer, postcss, tailwindcss, tsx, @types/node, @types/react, @types/react-dom (+6 more)

### Community 13 - "Package Run Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, preview, server, start, test, test:watch

### Community 14 - "Security Overrides"
Cohesion: 0.40
Nodes (5): overrides, braces, micromatch, postcss-selector-parser, tinypool

### Community 15 - "Production Dependencies"
Cohesion: 0.50
Nodes (4): dependencies, lucide-react, react-dom, ws

### Community 21 - "Game Rules & Mechanics"
Cohesion: 0.08
Nodes (23): Deck Setup & Dealing, Game Modes, Game Rules & Mechanics, Getting Started, Installation, License, Local Pass & Play, Melds & Sequences (+15 more)

### Community 22 - "Design Specification: Pukar Multiplayer (LAN & Online)"
Cohesion: 0.09
Nodes (22): 1. Executive Summary & Objective, 2. High-Level Architecture & System Topology, 3.1 Client → Server Messages, 3.2 Server → Client Messages, 3. Network Protocol Specification, 4.1 Diagnostic Logger (`server/logger.ts`), 4.2 Room Manager (`server/room-manager.ts`), 4.3 Game Coordinator (`server/game-coordinator.ts`) (+14 more)

### Community 23 - "Meld"
Cohesion: 0.15
Nodes (16): react-dom, Meld, EnlargedMeldCardProps, SequencesPage(), SequencesPageProps, SequenceZoomModalProps, canDropCardsOnMeld(), MeldCardItem() (+8 more)

### Community 24 - "ErrorBoundary.tsx"
Cohesion: 0.21
Nodes (3): ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState

### Community 25 - "3. Game Rules & Formal Specification"
Cohesion: 0.12
Nodes (15): 1. Executive Summary & Objective, 2.1 Engine Principles, 2. Architecture & Multiplayer Readiness, 3.1 Players, Decks & Dealing, 3.2 Card Model & Jokers, 3.3 Melds & Sequences, 3.4 Turn Lifecycle State Machine, 3.5 Stock Deck Exhaustion & Round Termination (+7 more)

### Community 26 - "PlayerHand.tsx"
Cohesion: 0.13
Nodes (15): Task 6: Hand, Action Controls, Scoreboard & Inspector Components, Task 5: Sequence Zoom Modal & Enlarged Card Sizing, 6.3 In-Game Multiplayer Experience, ActionControls(), FrustrationOverlay(), FrustrationOverlayProps, calculateHandOverlap(), HandOverlapResult (+7 more)

### Community 27 - "SocketClient"
Cohesion: 0.18
Nodes (4): SocketClient, ConnectionStatus, UseMultiplayerGameOptions, MultiplayerStatusBarProps

### Community 28 - "Global Constraints"
Cohesion: 0.29
Nodes (6): Global Constraints, Pukar Card Game Implementation Plan, Task 1: Project Scaffolding & Configuration, Task 3: Meld Validation, Scoring & Movable "2" Joker Dynamics, Task 4: Pure Game Engine Reducer & Turn Lifecycle, Task 7: Full Application Assembly & End-to-End Verification

### Community 29 - "react"
Cohesion: 0.25
Nodes (13): react, lucide-react, react, TurnPhase, ActionControlsProps, JokerPromptModal(), getRankLabel(), getSuitSymbol() (+5 more)

### Community 30 - "build-royal-heritage-deck.py"
Cohesion: 0.25
Nodes (8): build_aces_and_jokers(), build_court_cards(), build_master_base_pristine(), create_bespoke_gold_numeral(), erase_isolated_emblem(), generate_pip_card(), get_positions(), main()

### Community 33 - "GameState"
Cohesion: 0.07
Nodes (52): AppProps, createInitialBotMemory(), decideBotTurn(), selectBotPukarDeck(), updateBotMemory(), evaluateDeadwoodAndDiscard(), findBestMeldPlan(), decideCheetahTurn() (+44 more)

### Community 34 - "useMultiplayerGame.ts"
Cohesion: 0.36
Nodes (13): clearSessionCredentials(), getLocalStorage(), getSessionCredentials(), getStorage(), getStoredPlayerName(), memoryFallback, PLAYER_NAME_STORAGE_KEY, resetMemoryFallback() (+5 more)

### Community 35 - "useMultiplayerGame.test.ts"
Cohesion: 0.19
Nodes (7): createMockElement(), ElementMock, HTMLElementMock, HTMLIFrameElementMock, mockDoc, MockWebSocket, renderHook()

### Community 36 - "game-elements-comprehensive.test.tsx"
Cohesion: 0.47
Nodes (5): Task 5: Visual Card & Meld Board UI Components, Task 4: Center Table Deck Refinement & Click-To-Zoom on Discard Pile, CenterTable(), getFanCardTransform(), DiscardPileModal()

### Community 37 - "network/types.ts"
Cohesion: 0.21
Nodes (13): Task 6: Multiplayer UI Components: Mode Selector, Create/Join View & Interactive Lobby, Task 7: App Integration, In-Game Multiplayer Experience & End-to-End Verification, LobbySeat, StoredSession, ModeSelectorModal(), ModeSelectorModalProps, CreateJoinView(), CreateJoinViewProps (+5 more)

### Community 38 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Pukar Multiplayer (LAN & Online) Implementation Plan, Task 2: Decoupled Room Manager & Reconnection Session Store, Task 4: WebSocket Server, Connection Lifecycle & Multi-Client E2E Test Suite, Task 5: Client Networking Layer & React State Hook (`useMultiplayerGame`)

### Community 39 - "socket-client.ts"
Cohesion: 0.33
Nodes (4): MessageHandler, resolveDefaultSocketUrl(), SocketClientOptions, StatusHandler

## Knowledge Gaps
- **12 isolated node(s):** `AppKit`, `Foundation`, `autoprefixer`, `postcss`, `tailwindcss` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 273 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Deck Creation & Sequence Mechanics` to `PukarSlamOverlay.tsx`, `server.ts`, `App.tsx`, `ClientMessage`, `useLocalGame.ts`, `Bot AI & Turn Decision Strategies`, `TableSeating`, `Package Manifest & Metadata`, `Meld`, `ErrorBoundary.tsx`, `PlayerHand.tsx`, `react`, `GameState`, `useMultiplayerGame.ts`, `useMultiplayerGame.test.ts`, `game-elements-comprehensive.test.tsx`, `network/types.ts`, `GameSetupModal.tsx`, `MainMenu.tsx`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Card` (e.g. with `Task 2: Core Data Types & Deck Management` and `Task 5: Visual Card & Meld Board UI Components`) actually correct?**
  _`Card` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AppKit`, `Foundation`, `autoprefixer` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Deck Creation & Sequence Mechanics` be split into smaller, more focused modules?**
  _Cohesion score 0.0638536221060493 - nodes in this community are weakly interconnected._
- **Why does `Card` connect `Bot AI & Turn Decision Strategies` to `PukarSlamOverlay.tsx`, `Deck Creation & Sequence Mechanics`, `server.ts`, `GameState`, `game-elements-comprehensive.test.tsx`, `useLocalGame.ts`, `App.tsx`, `Meld`, `PlayerHand.tsx`, `react`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Meld` (e.g. with `Task 2: Core Data Types & Deck Management` and `Task 5: Visual Card & Meld Board UI Components`) actually correct?**
  _`Meld` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05462962962962963 - nodes in this community are weakly interconnected._