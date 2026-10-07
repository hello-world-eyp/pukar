# Pukar Card Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, fully tested multiplayer card game called Pukar with a decoupled TypeScript game engine and a modern React/Tailwind local hot-seat web application.

**Architecture:** A pure, deterministic, JSON-serializable TypeScript game engine (`src/engine/`) managing all card rules, movable wildcard '2' mechanics, turn states, and scoring, verified by an automated Vitest suite. A reactive Web UI (`src/ui/`) provides a digital card table with hot-seat player switching and a developer/god-mode inspector for easy testing, ready to transition to LAN/online multiplayer.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-07-pukar-card-game-design.md`

## Global Constraints

- 4 Players (2 decks, 6 natural jokers = 110 cards, 2 pukars of 13 cards) or 6 Players (3 decks, 9 natural jokers = 165 cards, 3 pukars of 13 cards).
- 13 cards dealt per hand; Pukars are 13 cards each in a shared first-come first-served pool.
- Draw phase: Draw 1 card from Stock OR take all cards from Discard Pile ("the bottom") unconditionally.
- Melds: Minimum 3 cards to open. Runs must be of the exact same suit (♠, ♥, ♦, ♣). Sets of same rank.
- Wildcards: At most 1 wildcard per meld. Every 2 is a wildcard by default.
- Movable '2': A 2 can act as natural 2 or wildcard substitute, and can shift up or down within a meld when natural cards arrive. 2 can never be returned to hand once melded.
- Scoring: Clean 7-card run = 200 pts; Dirty 7-card run = 100 pts; Clean 7-of-a-kind = 200 pts; Dirty 7-of-a-kind = 100 pts; Pure 13-card 2-to-A run = 500 pts; Pukar claim = 50 pts. No penalties for unmelded cards.
- Round End: Empty hand with 0 Pukars remaining; or Stock Deck exhaust with 0 Pukars (1 final turn).
- Pure TypeScript engine must have 0 DOM/React dependencies and be 100% JSON-serializable.

---

### Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `index.html`
- Create: `src/index.css`
- Create: `src/main.tsx`

**Interfaces:**
- Produces: Working Vite + React + Tailwind + Vitest development environment.

- [ ] **Step 1: Create package.json with dependencies**

Write `package.json` with React, React DOM, Lucide React, Tailwind CSS, PostCSS, Autoprefixer, Vite, and Vitest.

```json
{
  "name": "pukar-card-game",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "lucide-react": "^1.16.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.13.0",
    "@types/react": "^19.0.8",
    "@types/react-dom": "^19.0.3",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.1",
    "tailwindcss": "^3.4.17",
    "typescript": "~5.7.2",
    "vite": "^6.1.0",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 2: Create tsconfig.json, vite.config.ts, tailwind.config.js, postcss.config.js**

Set up standard TypeScript configuration with JSX and module resolution, Vite configuration with React plugin, and Tailwind CSS.

- [ ] **Step 3: Create index.html, src/index.css, and minimal src/main.tsx**

Set up base HTML root and Tailwind directives (`@tailwind base; @tailwind components; @tailwind utilities;`).

- [ ] **Step 4: Install dependencies and verify build & test commands**

Run: `npm install && npm test`
Expected: Dependencies installed cleanly.

- [ ] **Step 5: Commit scaffolding**

```bash
git add package.json tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html src/
git commit -m "chore: scaffold Vite React Tailwind Vitest project"
```

---

### Task 2: Core Data Types & Deck Management

**Files:**
- Create: `src/engine/types.ts`
- Create: `src/engine/deck.ts`
- Test: `tests/engine/deck.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `Suit`, `Rank`, `Card`, `MeldSlot`, `Meld`, `Player`, `Team`, `GameState`, `GameAction`, `GameError`.
  - `createDecks(playerCount: 4 | 6): Card[]`
  - `shuffleDeck(cards: Card[]): Card[]`
  - `dealInitialState(playerCount: 4 | 6): GameState`

- [ ] **Step 1: Write failing unit tests for deck creation and initial dealing**

Create `tests/engine/deck.test.ts` to verify:
- 4-player game creates 110 cards (2 decks of 52 + 3 jokers each).
- 6-player game creates 165 cards (3 decks of 52 + 3 jokers each).
- Initial deal gives exactly 13 cards to each player.
- 4-player game creates 2 Pukar decks of 13 cards each.
- 6-player game creates 3 Pukar decks of 13 cards each.
- Discard pile starts with exactly 1 card face-up.
- Remaining cards go to the stock deck.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/engine/deck.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement src/engine/types.ts**

Define all types: `Suit`, `Rank`, `Card`, `Meld`, `GameState`, etc. strictly according to the spec.

- [ ] **Step 4: Implement src/engine/deck.ts**

Implement `createDecks`, Fisher-Yates `shuffleDeck`, and `dealInitialState`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test tests/engine/deck.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/deck.ts tests/engine/deck.test.ts
git commit -m "feat(engine): implement core types, deck generation, and dealing"
```

---

### Task 3: Meld Validation, Scoring & Movable "2" Joker Dynamics

**Files:**
- Create: `src/engine/meld-validator.ts`
- Test: `tests/engine/meld-validator.test.ts`
- Test: `tests/engine/movable-joker.test.ts`

**Interfaces:**
- Consumes: `types.ts`
- Produces:
  - `validateNewRun(cards: Card[]): { valid: boolean; slots?: MeldSlot[]; error?: string }`
  - `validateNewSet(cards: Card[]): { valid: boolean; slots?: MeldSlot[]; error?: string }`
  - `validateNewMeld(cards: Card[]): { valid: boolean; type?: MeldType; suit?: Suit; slots?: MeldSlot[]; jokerCardId?: string; error?: string }`
  - `evaluateMeldScore(meld: Meld): { points: number; description: string; isComplete7: boolean; isPure13: boolean }`
  - `canAddCardsToMeld(meld: Meld, cardsToAdd: Card[]): { valid: boolean; updatedSlots?: MeldSlot[]; error?: string }`

- [ ] **Step 1: Write failing unit tests for meld validation and scoring**

Create `tests/engine/meld-validator.test.ts`:
- Valid clean runs of 3+ cards of same suit.
- Rejection of mixed-suit runs.
- Valid dirty runs with 1 wildcard (natural joker or 2).
- Rejection of runs with 2+ wildcards.
- Valid sets of same rank (clean and with 1 wildcard).
- Clean 7-card run score = 200 pts.
- Dirty 7-card run score = 100 pts.
- Clean 7-of-a-kind score = 200 pts; dirty = 100 pts.
- Pure 13-card 2-to-A run score = 500 pts; fails if wildcard used.

- [ ] **Step 2: Write failing unit tests for movable "2" joker shifting**

Create `tests/engine/movable-joker.test.ts`:
- Shifting 2 upward: `[3♠, 4♠, 2♠(sub 5), 6♠]` + `5♠` and `8♠` -> `[3♠, 4♠, 5♠, 6♠, 2♠(sub 7), 8♠]`.
- Sliding 2 downward: `[3♠, 4♠, 2♠(sub 5), 6♠]` + `5♠` -> `[2♠(natural 2), 3♠, 4♠, 5♠, 6♠]`.
- Immutability check: verifying 2 cannot be removed from meld.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test tests/engine/meld-validator.test.ts tests/engine/movable-joker.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement src/engine/meld-validator.ts**

Implement run sequencing (handling Ace low and high), set validation, wildcard replacement logic, and movable 2 re-assignment algorithms.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test tests/engine/meld-validator.test.ts tests/engine/movable-joker.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/meld-validator.ts tests/engine/meld-validator.test.ts tests/engine/movable-joker.test.ts
git commit -m "feat(engine): implement meld validation, scoring, and movable 2 mechanics"
```

---

### Task 4: Pure Game Engine Reducer & Turn Lifecycle

**Files:**
- Create: `src/engine/reducer.ts`
- Create: `src/engine/sanitizer.ts`
- Test: `tests/engine/turn-lifecycle.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `deck.ts`, `meld-validator.ts`
- Produces:
  - `pukarReducer(state: GameState, action: GameAction): { state: GameState; error?: string }`
  - `sanitizeStateForPlayer(state: GameState, playerId: string): SanitizedGameState`

- [ ] **Step 1: Write failing unit tests for turn lifecycle & edge cases**

Create `tests/engine/turn-lifecycle.test.ts`:
- Drawing from Stock deck advances phase from `DRAW` to `MELD`.
- Drawing from Discard pile unconditionally takes all cards into hand.
- Melding cards from hand onto table.
- Emptying hand during meld immediately claims next 13-card Pukar (+50 pts) and keeps turn in `MELD` phase.
- Mandatory discard advances turn to next player.
- Emptying hand with 0 Pukars remaining triggers immediate round completion.
- Stock deck exhaust when Pukars remain converts 1 Pukar to new Stock deck.
- Stock deck exhaust with 0 Pukars triggers final turn for next player, then concludes round.
- `START_NEXT_ROUND` preserves total scores and deals fresh round.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/engine/turn-lifecycle.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement src/engine/reducer.ts & src/engine/sanitizer.ts**

Implement action handlers for `DRAW_CARD`, `PLAY_NEW_MELD`, `ADD_TO_MELD`, `DISCARD_CARD`, `START_NEXT_ROUND`, `RESET_GAME`, and state sanitization.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test tests/engine/turn-lifecycle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/reducer.ts src/engine/sanitizer.ts tests/engine/turn-lifecycle.test.ts
git commit -m "feat(engine): implement game reducer, turn lifecycle, and state sanitizer"
```

---

### Task 5: Visual Card & Meld Board UI Components

**Files:**
- Create: `src/ui/components/PlayingCard.tsx`
- Create: `src/ui/components/TableMeldBoard.tsx`
- Create: `src/ui/components/CenterTable.tsx`
- Create: `src/ui/components/DiscardPileModal.tsx`

**Interfaces:**
- Consumes: `Card`, `Meld`, `Suit`, `Rank`
- Produces:
  - `PlayingCard`: Renders individual card with suit symbols, rank badges, selection ring, and wildcard indicator.
  - `TableMeldBoard`: Renders team meld columns with clean/dirty/pure point badges.
  - `CenterTable`: Renders Stock deck, "The Bottom" discard pile, and Pukar stack.
  - `DiscardPileModal`: Visual modal inspecting full discard pile history.

- [ ] **Step 1: Implement PlayingCard component**

Render suit symbols (♠ ♥ ♦ ♣), colors (red/black), rank labels (2..A, Joker), selection highlight, and wildcard badge.

- [ ] **Step 2: Implement DiscardPileModal component**

Render modal with chronological grid of all cards currently in the bottom pile.

- [ ] **Step 3: Implement CenterTable component**

Render Stock Deck (clickable to draw, showing count), Discard Pile (clickable to draw all, with "Peek Pile" button), and Pukar stack counter.

- [ ] **Step 4: Implement TableMeldBoard component**

Render Team A and Team B melds side by side with point tags (`Clean Run (200)`, `Dirty Run (100)`, `Pure 2-A Run (500)`). Allows selecting a meld to add cards.

- [ ] **Step 5: Verify build with TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/
git commit -m "feat(ui): implement visual card, table melds, and center deck components"
```

---

### Task 6: Hand, Action Controls, Scoreboard & Inspector Components

**Files:**
- Create: `src/ui/components/ScoreBoard.tsx`
- Create: `src/ui/components/PlayerHand.tsx`
- Create: `src/ui/components/ActionControls.tsx`
- Create: `src/ui/components/DevInspector.tsx`
- Create: `src/ui/components/RoundSummaryModal.tsx`

**Interfaces:**
- Consumes: `GameState`, `Player`, `pukarReducer`
- Produces:
  - `ScoreBoard`: Header bar with scores, round number, active team, Pukars claimed.
  - `PlayerHand`: Current player's hand with sort toggles and multi-card selection.
  - `ActionControls`: Draw, Meld, Add, Discard buttons with real-time validation previews.
  - `DevInspector`: Hot-seat switcher tabs (P1..P4/P6) and God Mode view of all player hands.
  - `RoundSummaryModal`: Round completion summary dialog with points breakdown.

- [ ] **Step 1: Implement ScoreBoard component**

Render game title, round number, Team A vs Team B points, and claimed Pukars count.

- [ ] **Step 2: Implement PlayerHand component**

Render active player's cards with sort buttons ("Sort by Suit", "Sort by Rank") and multi-card selection for melding.

- [ ] **Step 3: Implement ActionControls component**

Render contextual action buttons enabled only in valid phases:
- Draw Deck / Take Bottom (active in `DRAW` phase).
- Meld Selected as New Run/Set (active in `MELD` phase with preview).
- Add to Selected Team Meld (active in `MELD` phase).
- Discard Selected Card (active in `DISCARD_OR_END` phase).

- [ ] **Step 4: Implement DevInspector component**

Provide instant player tabs (P1, P2, P3, P4 / P6) and a "God Mode (View All Hands)" collapsible panel for effortless testing.

- [ ] **Step 5: Implement RoundSummaryModal component**

Render modal on `isRoundOver: true`, displaying round points itemization, cumulative match totals, and "Next Round" button.

- [ ] **Step 6: Verify build with TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/components/
git commit -m "feat(ui): implement hand controls, inspector tools, and summary modal"
```

---

### Task 7: Full Application Assembly & End-to-End Verification

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Wires: Full state management, audio/visual cues, hot-seat controls, dev inspector, and complete game loop.

- [ ] **Step 1: Implement src/App.tsx connecting engine and all UI components**

Integrate `GameState` managed via `useReducer(pukarReducer, initialGameState)`, wiring card selection, meld actions, discard actions, hot-seat switching, and modal popups.

- [ ] **Step 2: Run all unit tests**

Run: `npm test`
Expected: All engine tests pass (100% pass rate).

- [ ] **Step 3: Build production bundle**

Run: `npm run build`
Expected: Clean build without errors or bundle warnings.

- [ ] **Step 4: Launch Vite preview/dev server and verify in browser**

Verify:
1. Dealing 13 cards to all players, 2 Pukars in pool.
2. Drawing from stock vs drawing all cards from bottom.
3. Melding a 3-card sequence with a 2 wildcard.
4. Adding cards to sequence and observing 2 shift upward / downward.
5. Mandatory discard passing turn to next player.
6. Emptying hand triggering instant +50 pts Pukar claim and continuing turn.
7. Inspector view showing all hands simultaneously.
8. Round conclusion and multi-round score tally.

- [ ] **Step 5: Commit complete application**

```bash
git add src/App.tsx src/main.tsx src/index.css
git commit -m "feat: assemble complete Pukar card game application with hot-seat testing"
```
