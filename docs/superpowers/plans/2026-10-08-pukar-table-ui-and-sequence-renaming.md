# Pukar Table UI Redesign & Sequence Renaming Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Pukar Card Game into an immersive, authentic casino-table experience with a 4/6-player spatial seating layout (left, right, front, bottom), centered decks with click-to-zoom on the discard pile, sequence zoom modal, enlarged legible cards, wide table container, and consistent renaming of "meld" to "sequence" across all user-facing UI.

**Architecture:**
- **Table Felt & Canvas:** Deep emerald casino poker felt with radial lighting, padded leather rails, and an expanded wide container (`max-w-[1700px]`).
- **Spatial Seating Architecture:** Relative player seating engine (`getRelativeTableSeats`) and component (`TableSeating` / `PlayerSeat`) placing the viewed player at bottom, teammate opposite/front, and opponents on the left and right wings.
- **Center Table Layout:** Stock Deck, Discard Pile ("The Bottom"), and Pukar Pool positioned in the central felt arena, with direct click-to-zoom on the discard pile.
- **Sequence (Meld) Zoom & Larger Cards:** Card sizing upgraded across sequences and previews; interactive Sequence Zoom modal showing high-res cards (`size="lg"`).
- **Terminology Migration:** Rename all user-facing "Meld" labels to "Sequence" (e.g., Table Sequences, Play Sequence, Add to Sequence, Sequence Phase) while maintaining backward-compatible TypeScript engine aliases.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Vitest.

---

## Global Constraints
- Pure TypeScript engine compatibility: do not break existing game state reducer or engine action signatures (`PLAY_NEW_MELD`, `ADD_TO_MELD`, etc. remain valid; UI displays "Sequence").
- All user-facing copy and aria-labels must use "Sequence" / "Sequences".
- Clean responsive layout that scales down smoothly from ultra-wide (1700px) to laptop and mobile screens.
- 100% test pass rate across all test suites with zero TypeScript compilation errors.

---

### Task 1: UI Terminology Migration: "Meld" -> "Sequence" Across Components & Modals

**Files:**
- Modify: `src/ui/components/ActionControls.tsx`
- Modify: `src/ui/components/TableMeldBoard.tsx`
- Modify: `src/ui/components/RoundSummaryModal.tsx`
- Modify: `src/ui/components/DevInspector.tsx`
- Modify: `src/App.tsx`
- Test: `tests/ui/controls.test.tsx`
- Test: `tests/ui/components.test.tsx`

**Interfaces:**
- Updates user-facing text from "Meld" to "Sequence":
  - "Meld Selected" -> "Play Sequence"
  - "Add to Meld" -> "Add to Sequence"
  - "Table Melds" -> "Table Sequences"
  - "Team A / B Melds" -> "Team A / B Sequences"
  - "MELD" phase badge -> "SEQUENCE" (or mapped display text)
  - "No melds placed yet" -> "No sequences placed yet"
  - Retain backwards-compatible `data-testid` attributes or add aliased test ids.

- [ ] **Step 1: Write test verifying "Sequence" terminology in ActionControls and TableMeldBoard**
- [ ] **Step 2: Update user-facing text in ActionControls.tsx, TableMeldBoard.tsx, RoundSummaryModal.tsx, DevInspector.tsx, and App.tsx**
- [ ] **Step 3: Run vitest on modified component tests to verify pass**
- [ ] **Step 4: Commit terminology migration**

---

### Task 2: Relative Seating Calculation & `PlayerSeat` / `TableSeating` Component

**Files:**
- Create: `src/ui/components/TableSeating.tsx`
- Test: `tests/ui/table-seating.test.tsx`

**Interfaces:**
- `export interface PlayerSeatProps { player: Player; isTurn: boolean; isViewed: boolean; position: 'top' | 'left' | 'right' | 'top-left' | 'top-right'; onSelectSeat?: () => void; }`
- `export function getRelativeTableSeats(players: Player[], currentViewIndex: number): { top: Player[]; left: Player; right: Player; }`
- Seating renders avatar, name, team badge (Team A blue / Team B amber), card count badge with mini card-back fan, and turn indicator pulse.

- [ ] **Step 1: Write test for relative seating positions for 4-player and 6-player games**
- [ ] **Step 2: Implement `getRelativeTableSeats` and `TableSeating` component**
- [ ] **Step 3: Run vitest for table-seating.test.tsx**
- [ ] **Step 4: Commit seating components**

---

### Task 3: Casino Felt Table Styling & Wide Layout Container

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Test: `tests/ui/app-integration.test.tsx`

**Interfaces:**
- Container width expanded to `max-w-[1700px] w-full px-4 lg:px-8`.
- Casino table felt background with radial gradient lighting:
  - Outer rail: dark mahogany / leather border with gold stitch accents.
  - Felt arena: `#0a3d24` to `#052616` with vignette lighting.
- Seating placed around table perimeter: top/front seat at top center, left seat on left flank, right seat on right flank, active player at bottom.

- [ ] **Step 1: Update index.css with casino table textures and felt styles**
- [ ] **Step 2: Restructure App.tsx layout with wide container and table seating perimeter**
- [ ] **Step 3: Run vitest to ensure app integration tests pass**
- [ ] **Step 4: Commit table felt and wide layout**

---

### Task 4: Center Table Deck Refinement & Click-To-Zoom on Discard Pile

**Files:**
- Modify: `src/ui/components/CenterTable.tsx`
- Modify: `src/ui/components/DiscardPileModal.tsx`
- Test: `tests/ui/components.test.tsx`

**Interfaces:**
- Entire discard pile area in `CenterTable` is directly clickable to open zoom modal:
  - If it's DRAW phase and player can draw, clicking "Take The Bottom" button draws; clicking the pile or "Zoom Pile" icon opens `DiscardPileModal`.
- `DiscardPileModal` enlarged:
  - Uses `size="md"` for cards (instead of `sm`) so all ranks and suits are clearly legible.
  - Displays full card count, chronological breakdown, and direct "Take All Cards" action if eligible.

- [ ] **Step 1: Write tests for direct click-to-zoom on Discard Pile and enlarged modal cards**
- [ ] **Step 2: Update CenterTable.tsx and DiscardPileModal.tsx**
- [ ] **Step 3: Run vitest to verify**
- [ ] **Step 4: Commit center table and discard zoom enhancements**

---

### Task 5: Sequence Zoom Modal & Enlarged Card Sizing

**Files:**
- Create: `src/ui/components/SequenceZoomModal.tsx`
- Modify: `src/ui/components/TableMeldBoard.tsx`
- Modify: `src/ui/components/ActionControls.tsx`
- Modify: `src/App.tsx`
- Test: `tests/ui/sequence-zoom.test.tsx`

**Interfaces:**
- `SequenceZoomModal`:
  - Shows zoomed sequence with `size="lg"` cards (`w-28 h-[168px]`).
  - Displays complete evaluation (Pure 2-A Run, Clean Run, Dirty Run, Sets), wildcard substitutions, and points.
- `TableMeldBoard`:
  - Adds `Zoom Sequence (🔍)` button to each sequence.
  - Scales default cards in sequences up from `w-12 h-[72px]` (`sm`) to `w-16 h-[96px]` (or responsive `size="md"`) for greater legibility.
- `ActionControls`:
  - When cards are selected to be added or formed into a sequence, renders visual card thumbnails with rank/suit instead of plain text.

- [ ] **Step 1: Write unit tests for `SequenceZoomModal` and zoom action in TableMeldBoard**
- [ ] **Step 2: Implement `SequenceZoomModal.tsx` and integrate zoom triggers in TableMeldBoard.tsx**
- [ ] **Step 3: Upgrade card preview in ActionControls.tsx and enlarge sequence cards**
- [ ] **Step 4: Run vitest across all test suites**
- [ ] **Step 5: Commit zoom modal and card size enhancements**

---

### Task 6: Full Integration Verification & Build Audit

**Files:**
- Run all test suites
- Run TypeScript compiler `tsc`
- Run Vite production build `npm run build`

- [ ] **Step 1: Run `npm test` across all 22+ test files**
- [ ] **Step 2: Run `npm run build` to confirm 0 TypeScript / CSS / Vite errors**
- [ ] **Step 3: Final self-review, git log check, and completion report**
