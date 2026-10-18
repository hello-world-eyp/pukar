# Graph Report - Pukar game  (2026-10-18)

## Corpus Check
- 168 files · ~218,115 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 4, .css 1, .command 1)

## Summary
- 851 nodes · 2840 edges · 41 communities (30 shown, 11 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 100 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `931a733c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- server.ts
- Deck Creation & Sequence Mechanics
- RoomManager
- App.tsx
- server/types.ts
- meld-validator.ts
- Bot AI & Turn Decision Strategies
- Match Analytics & Player Awards
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
- Card
- ErrorBoundary.tsx
- 3. Game Rules & Formal Specification
- logger.ts
- SocketClient
- Global Constraints
- Room
- build-royal-heritage-deck.py
- CLAUDE.md
- GEMINI.md
- bot-game-hook.test.tsx
- useMultiplayerGame.ts
- useMultiplayerGame.test.ts
- react-dom
- network/types.ts
- app-multiplayer-integration.test.tsx
- PureSequenceCelebrationModal.tsx
- GameSetupModal.tsx

## God Nodes (most connected - your core abstractions)
1. `Card` - 87 edges
2. `vitest` - 85 edges
3. `Meld` - 57 edges
4. `dealInitialState()` - 53 edges
5. `App()` - 51 edges
6. `react` - 48 edges
7. `GameState` - 47 edges
8. `pukarReducer()` - 44 edges
9. `react-dom` - 43 edges
10. `canAddCardsToMeld()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `4.3 Game Coordinator (`server/game-coordinator.ts`)` --references--> `sanitizeStateForPlayer()`  [INFERRED]
  docs/superpowers/specs/2026-10-09-pukar-multiplayer-design.md → src/engine/sanitizer.ts
- `8.1 Unit Tests` --references--> `sanitizeStateForPlayer()`  [INFERRED]
  docs/superpowers/specs/2026-10-09-pukar-multiplayer-design.md → src/engine/sanitizer.ts
- `Task 7: Full Application Assembly & End-to-End Verification` --references--> `GameState`  [INFERRED]
  docs/superpowers/plans/2026-10-07-pukar-card-game.md → src/engine/types.ts
- `Task 1: Networking Dependencies, Core Server Types & Structured Diagnostic Logger` --references--> `RoomStatus`  [INFERRED]
  docs/superpowers/plans/2026-10-09-pukar-multiplayer.md → server/types.ts
- `Task 1: Networking Dependencies, Core Server Types & Structured Diagnostic Logger` --references--> `Seat`  [INFERRED]
  docs/superpowers/plans/2026-10-09-pukar-multiplayer.md → server/types.ts

## Import Cycles
- None detected.

## Communities (41 total, 11 thin omitted)

### Community 0 - "server.ts"
Cohesion: 0.17
Nodes (16): ws, broadcastGameState(), broadcastLobby(), broadcastToRoom(), __dirname, distDir, ExtWebSocket, __filename (+8 more)

### Community 1 - "Deck Creation & Sequence Mechanics"
Cohesion: 0.07
Nodes (45): Task 2: Core Data Types & Deck Management, Global Constraints, Pukar Multiplayer (LAN & Online) Implementation Plan, Task 2: Decoupled Room Manager & Reconnection Session Store, Task 3: Authoritative Game Coordinator & State Sanitization, Task 4: WebSocket Server, Connection Lifecycle & Multi-Client E2E Test Suite, Task 5: Client Networking Layer & React State Hook (`useMultiplayerGame`), Task 1: Clean 7 Completion Priority Over Opening New 3-Card Melds (+37 more)

### Community 2 - "RoomManager"
Cohesion: 0.14
Nodes (5): 5.3 React Hook (`src/network/useMultiplayerGame.ts`), RoomManager, sanitizePlayerName(), ServerOptions, gameState()

### Community 3 - "App.tsx"
Cohesion: 0.18
Nodes (15): Task 7: App Integration, In-Game Multiplayer Experience & End-to-End Verification, react, App(), parseRoomCodeFromUrl(), BotSetupModal(), FrustrationOverlay(), FrustrationOverlayProps, JokerPromptModal() (+7 more)

### Community 4 - "server/types.ts"
Cohesion: 0.14
Nodes (16): Task 1: Networking Dependencies, Core Server Types & Structured Diagnostic Logger, ClientMessage, ClientMessageType, RoomStatus, Seat, ServerMessage, ServerMessageType, MessageHandler (+8 more)

### Community 5 - "meld-validator.ts"
Cohesion: 0.08
Nodes (39): clearDebugLog(), DebugPlayerSnapshot, exportDebugLogFile(), GameDebugLogger, getDebugLogData(), getDebugSnapshotCount(), globalDebugLogger, MAX_DEBUG_SNAPSHOTS (+31 more)

### Community 6 - "Bot AI & Turn Decision Strategies"
Cohesion: 0.06
Nodes (94): Bot Intelligence Enhancements Implementation Plan, Global Constraints, Task 10: Strict Lockdown Against Opponent on 1 Card & Burying Connecting Cards for Partner, Task 2: Preserving Clean Runs (Preventing Premature Wildcard Tainting), Task 3: Multi-Meld Opening Turns (Pure + Dirty in the Same Turn), Task 4: Natural Joker Retrieval Priority & Mid-Turn Re-Planning, Task 5: Mid-Turn Pukar Claim Continuation, Task 6: The Jadugar Speed Tuning (Eliminating Discard Pile Bloat) (+86 more)

### Community 7 - "Match Analytics & Player Awards"
Cohesion: 0.10
Nodes (37): Task 6: Hand, Action Controls, Scoreboard & Inspector Components, Global Constraints, Pukar Table UI Redesign & Sequence Renaming Plan, Task 1: UI Terminology Migration: "Meld" -> "Sequence" Across Components & Modals, Task 2: Relative Seating Calculation & `PlayerSeat` / `TableSeating` Component, Task 3: Casino Felt Table Styling & Wide Layout Container, Task 6: Full Integration Verification & Build Audit, calculateMatchMVP() (+29 more)

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

### Community 23 - "Card"
Cohesion: 0.07
Nodes (44): Task 5: Visual Card & Meld Board UI Components, Task 4: Center Table Deck Refinement & Click-To-Zoom on Discard Pile, Task 5: Sequence Zoom Modal & Enlarged Card Sizing, 6.3 In-Game Multiplayer Experience, ActionControls(), CenterTable(), CenterTableProps, getFanCardTransform() (+36 more)

### Community 24 - "ErrorBoundary.tsx"
Cohesion: 0.18
Nodes (4): react, ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState

### Community 25 - "3. Game Rules & Formal Specification"
Cohesion: 0.12
Nodes (15): 1. Executive Summary & Objective, 2.1 Engine Principles, 2. Architecture & Multiplayer Readiness, 3.1 Players, Decks & Dealing, 3.2 Card Model & Jokers, 3.3 Melds & Sequences, 3.4 Turn Lifecycle State Machine, 3.5 Stock Deck Exhaustion & Round Termination (+7 more)

### Community 26 - "logger.ts"
Cohesion: 0.15
Nodes (14): formatLog, formatLogMessage(), LogContext, logger, LogLevel, safeString(), safeStringify(), serverLogger (+6 more)

### Community 28 - "Global Constraints"
Cohesion: 0.29
Nodes (6): Global Constraints, Pukar Card Game Implementation Plan, Task 1: Project Scaffolding & Configuration, Task 3: Meld Validation, Scoring & Movable "2" Joker Dynamics, Task 4: Pure Game Engine Reducer & Turn Lifecycle, Task 7: Full Application Assembly & End-to-End Verification

### Community 30 - "build-royal-heritage-deck.py"
Cohesion: 0.25
Nodes (8): build_aces_and_jokers(), build_court_cards(), build_master_base_pristine(), create_bespoke_gold_numeral(), erase_isolated_emblem(), generate_pip_card(), get_positions(), main()

### Community 34 - "useMultiplayerGame.ts"
Cohesion: 0.29
Nodes (15): clearSessionCredentials(), getLocalStorage(), getSessionCredentials(), getStorage(), getStoredPlayerName(), memoryFallback, PLAYER_NAME_STORAGE_KEY, resetMemoryFallback() (+7 more)

### Community 35 - "useMultiplayerGame.test.ts"
Cohesion: 0.16
Nodes (8): resolveDefaultSocketUrl(), createMockElement(), ElementMock, HTMLElementMock, HTMLIFrameElementMock, mockDoc, MockWebSocket, renderHook()

### Community 36 - "react-dom"
Cohesion: 0.25
Nodes (7): react-dom, PlayerInfo, TEAM_AVATAR_PALETTE, TopNavBar(), TopNavBarProps, VoiceChatControlProps, MockResizeObserver

### Community 37 - "network/types.ts"
Cohesion: 0.35
Nodes (8): Task 6: Multiplayer UI Components: Mode Selector, Create/Join View & Interactive Lobby, LobbySeat, CreateJoinView(), LobbyView(), LobbyViewProps, MultiplayerHub(), findByTestId(), findElement()

### Community 38 - "app-multiplayer-integration.test.tsx"
Cohesion: 0.19
Nodes (6): lucide-react, ConnectionStatus, MultiplayerStatusBarProps, UnclePukarChoiceModalProps, findByTestId(), findElement()

### Community 39 - "PureSequenceCelebrationModal.tsx"
Cohesion: 0.60
Nodes (3): PureSequenceCelebrationModal(), PureSequenceCelebrationModalProps, isSoundEnabled()

## Knowledge Gaps
- **12 isolated node(s):** `@types/node`, `@types/react`, `@types/react-dom`, `@types/ws`, `@vitest/coverage-v8` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 265 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Deck Creation & Sequence Mechanics` to `server.ts`, `App.tsx`, `server/types.ts`, `meld-validator.ts`, `Bot AI & Turn Decision Strategies`, `Match Analytics & Player Awards`, `Package Manifest & Metadata`, `Card`, `ErrorBoundary.tsx`, `logger.ts`, `Room`, `bot-game-hook.test.tsx`, `useMultiplayerGame.ts`, `useMultiplayerGame.test.ts`, `react-dom`, `network/types.ts`, `app-multiplayer-integration.test.tsx`, `PureSequenceCelebrationModal.tsx`, `GameSetupModal.tsx`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Card` (e.g. with `Task 2: Core Data Types & Deck Management` and `Task 5: Visual Card & Meld Board UI Components`) actually correct?**
  _`Card` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/node`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Deck Creation & Sequence Mechanics` be split into smaller, more focused modules?**
  _Cohesion score 0.06947021232735519 - nodes in this community are weakly interconnected._
- **Why does `Card` connect `Deck Creation & Sequence Mechanics` to `bot-game-hook.test.tsx`, `App.tsx`, `react-dom`, `meld-validator.ts`, `Bot AI & Turn Decision Strategies`, `Match Analytics & Player Awards`, `app-multiplayer-integration.test.tsx`, `Card`, `Room`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Meld` (e.g. with `Task 2: Core Data Types & Deck Management` and `Task 5: Visual Card & Meld Board UI Components`) actually correct?**
  _`Meld` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `RoomManager` be split into smaller, more focused modules?**
  _Cohesion score 0.1422924901185771 - nodes in this community are weakly interconnected._