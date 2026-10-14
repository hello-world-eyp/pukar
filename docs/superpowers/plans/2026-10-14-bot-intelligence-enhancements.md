# Bot Intelligence Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 10 advanced strategic intelligence optimizations across all 4 Pukar AI bots, elevating their play from competent to master-level with realistic fair play, optimal scoring, tempo re-planning, and strict endgame defense.

**Architecture:** 
- Enhance [`hand-analyzer.ts`](file:///Users/Harsh/Pukar%20game/src/engine/bots/hand-analyzer.ts) for Clean 7 completion priority, clean run protection against premature wildcard tainting, multi-meld pure+dirty opening turns, and final turn dump mode.
- Update [`bot-player.ts`](file:///Users/Harsh/Pukar%20game/src/engine/bots/bot-player.ts) for realistic Uncle Pukar deck selection without peeking at face-down cards.
- Upgrade [`useBotGame.ts`](file:///Users/Harsh/Pukar%20game/src/ui/hooks/useBotGame.ts) to support mid-turn re-planning on Natural Joker retrieval and Pukar claim continuation during the MELD sub-phase.
- Tune personality-specific logic in [`fast-chachi.ts`](file:///Users/Harsh/Pukar%20game/src/engine/bots/strategies/fast-chachi.ts), [`the-jadugar.ts`](file:///Users/Harsh/Pukar%20game/src/engine/bots/strategies/the-jadugar.ts), [`the-long-term-guy.ts`](file:///Users/Harsh/Pukar%20game/src/engine/bots/strategies/the-long-term-guy.ts), and [`smart-chacha.ts`](file:///Users/Harsh/Pukar%20game/src/engine/bots/strategies/smart-chacha.ts) for strict lockdown against 1-card opponents, burying connecting cards under irrelevant deadwood, and avoiding discard bloat.

**Tech Stack:** TypeScript, React, Vitest, Git.

---

## Global Constraints

- Pure TypeScript engine without DOM dependencies in `src/engine/`.
- All tests must pass: `npm test` (0 failures across all 70+ test suites).
- Zero TypeScript errors: `npx tsc --noEmit`.
- Clean production build: `npm run build`.
- Frequent commits: commit after each task and push to GitHub.

---

### Task 1: Clean 7 Completion Priority Over Opening New 3-Card Melds

**Files:**
- Modify: `src/engine/bots/hand-analyzer.ts:370-425`
- Test: `tests/engine/bots/strategies.test.ts`

**Interfaces:**
- Consumes: `canAddCardsToMeld`, `Meld`, `Card`
- Produces: `findBestMeldPlan(hand, teamMelds, options)` prioritizing table extensions that complete a 7-card run (+200 pts) over small 3-card new melds (0 bonus pts).

- [ ] **Step 1: Write the failing test**
  In `tests/engine/bots/strategies.test.ts`, add a test where a bot has a choice between starting a new 3-card run (e.g. 8♥-9♥-10♥) or completing a 5-card table run (e.g. 3♠-4♠-5♠-6♠-7♠ with 8♠ and 9♠ in hand to make a 7-card Clean Run for 200 pts). The bot must choose to complete the 7-card Clean Run.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: FAIL (cards currently consumed by new run first).

- [ ] **Step 3: Implement 7-card completion priority in `findBestMeldPlan`**
  In `src/engine/bots/hand-analyzer.ts`, before committing new candidate melds, check if any candidate table additions can bring an existing team run or set to $\ge 7$ cards (or 13 cards). If so, prioritize and commit those additions first.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: PASS.

- [ ] **Step 5: Verify build & commit**
  Run: `npx tsc --noEmit && npm test && npm run build`
  Git: commit and push to `origin main`.

---

### Task 2: Preserving Clean Runs (Preventing Premature Wildcard Tainting)

**Files:**
- Modify: `src/engine/bots/hand-analyzer.ts:275-320`
- Test: `tests/engine/bots/strategies.test.ts`

**Interfaces:**
- Consumes: `findPotentialAdditionsToMelds(hand, tableMelds, options)`
- Produces: Guard in `findPotentialAdditionsToMelds` preventing adding wildcards (Natural Jokers or 2s) to 5- or 6-card clean runs unless `isCloseToPukar` is true or `isFinalTurn` is true.

- [ ] **Step 1: Write the failing test**
  In `tests/engine/bots/strategies.test.ts`, add a test where team has a 5-card clean run on the table, and bot holds a Natural Joker (or suited 2) and deadwood cards (hand $> 4$ cards). Bot must NOT add the wildcard to the clean run, preserving the Clean 7 (200 pts) potential.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement clean run wildcard preservation**
  In `src/engine/bots/hand-analyzer.ts` inside `findPotentialAdditionsToMelds`, check if `isCleanRun` and `meld.cards.length >= 5`. If adding a wildcard would make the run dirty, disallow it unless `isCloseToPukar` or `isFinalTurn`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: PASS.

- [ ] **Step 5: Verify build & commit**
  Run: `npx tsc --noEmit && npm test && npm run build`
  Git: commit and push to `origin main`.

---

### Task 3: Multi-Meld Opening Turns (Pure + Dirty in the Same Turn)

**Files:**
- Modify: `src/engine/bots/hand-analyzer.ts:370-420`
- Test: `tests/engine/bots/strategies.test.ts`

**Interfaces:**
- Consumes: `findBestMeldPlan`
- Produces: When `teamMelds.length === 0`, once a valid Pure Run is staged as `meldsToPlay[0]`, allow dirty candidate melds for remaining uncommitted hand cards in the same turn.

- [ ] **Step 1: Write the failing test**
  In `tests/engine/bots/strategies.test.ts`, test an opening turn where a bot has a Pure Run ($3♠-4♠-5♠$) and a Dirty Run ($8♥-9♥-\text{Joker}$). The bot must play both in the same turn.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: FAIL (currently only pure melds are considered when `teamMelds.length === 0`).

- [ ] **Step 3: Implement multi-meld pure+dirty opening turn**
  In `findBestMeldPlan`, if `requirePure` was true and a pure meld was successfully added to `meldsToPlay`, evaluate a second pass for remaining cards with `requirePure = false` so valid dirty melds can also be staged.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: PASS.

- [ ] **Step 5: Verify build & commit**
  Run: `npx tsc --noEmit && npm test && npm run build`
  Git: commit and push to `origin main`.

---

### Task 4: Natural Joker Retrieval Priority & Mid-Turn Re-Planning

**Files:**
- Modify: `src/engine/bots/hand-analyzer.ts:300-325`, `src/ui/hooks/useBotGame.ts:220-258`
- Test: `tests/engine/bots/strategies.test.ts`

**Interfaces:**
- Consumes: `canAddCardsToMeld`, `validation.pickedUpCard`
- Produces: Addition score $+150$ for Joker retrieval; `useBotGame.ts` re-evaluates `decideBotTurn` if a card was retrieved to hand during `MELD` sub-phase.

- [ ] **Step 1: Write the failing test**
  In `tests/engine/bots/strategies.test.ts`, test that replacing a Natural Joker is scored with highest priority (+150).

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: FAIL (currently score is standard 25).

- [ ] **Step 3: Implement Joker retrieval priority & mid-turn re-planning**
  - In `hand-analyzer.ts`: award score $+150$ if `validation.pickedUpCard` is present.
  - In `useBotGame.ts`: during `MELD` phase execution, if an addition was played and resulted in a picked-up Joker or hand size changed, re-plan the melds with the updated hand.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: PASS.

- [ ] **Step 5: Verify build & commit**
  Run: `npx tsc --noEmit && npm test && npm run build`
  Git: commit and push to `origin main`.

---

### Task 5: Mid-Turn Pukar Claim Continuation

**Files:**
- Modify: `src/ui/hooks/useBotGame.ts:220-265`
- Test: `tests/engine/bots/bot-endgame-and-pacing.test.ts`

**Interfaces:**
- Consumes: `initialHandSizeThisTurn`, `pukarPool`
- Produces: Bot stays in `MELD` sub-phase when claiming a 13-card Pukar deck to meld from the new 13 cards before discarding.

- [ ] **Step 1: Write the failing test**
  In `tests/engine/bots/bot-endgame-and-pacing.test.ts`, test that when a bot claims a Pukar mid-turn, it executes melds from the 13 new cards in the same turn before discarding.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test tests/engine/bots/bot-endgame-and-pacing.test.ts`
  Expected: FAIL (currently transitions directly to DISCARD).

- [ ] **Step 3: Implement mid-turn Pukar claim continuation**
  In `useBotGame.ts`, when a Pukar is claimed, if valid melds exist in the new 13 cards, dispatch them in the MELD phase before transitioning to DISCARD.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test tests/engine/bots/bot-endgame-and-pacing.test.ts`
  Expected: PASS.

- [ ] **Step 5: Verify build & commit**
  Run: `npx tsc --noEmit && npm test && npm run build`
  Git: commit and push to `origin main`.

---

### Task 6: The Jadugar Speed Tuning (Eliminating Discard Pile Bloat)

**Files:**
- Modify: `src/engine/bots/hand-analyzer.ts:970-985, 1038-1042`
- Test: `tests/engine/bots/strategies.test.ts`

**Interfaces:**
- Consumes: `evaluateDiscardPilePickup`
- Produces: Selective draw logic for The Jadugar ensuring she only takes discard pile for immediate melds, wildcards, or tight pairs on small piles ($\le 2$ cards).

- [ ] **Step 1: Write the failing test**
  In `tests/engine/bots/strategies.test.ts`, test that The Jadugar leaves a 3-card discard pile with loose gap-2 connectors and draws from stock deck instead.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: FAIL (currently lines 975 and 1039 cause her to take it).

- [ ] **Step 3: Implement clean Jadugar pickup logic**
  In `src/engine/bots/hand-analyzer.ts`, refine Jadugar's condition so loose gap-2 connectors without immediate meld do not trigger pickup, and remove unconditional 4-card pickup for Jadugar unless it contains an immediate meld or wildcard.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: PASS.

- [ ] **Step 5: Verify build & commit**
  Run: `npx tsc --noEmit && npm test && npm run build`
  Git: commit and push to `origin main`.

---

### Task 7: Fast Chachi Hoarding Ceiling

**Files:**
- Modify: `src/engine/bots/hand-analyzer.ts:886-902`
- Test: `tests/engine/bots/strategies.test.ts`

**Interfaces:**
- Consumes: `evaluateDiscardPilePickup`
- Produces: Hoarding ceiling for Fast Chachi at $> 14$ cards.

- [ ] **Step 1: Write the failing test**
  In `tests/engine/bots/strategies.test.ts`, test that Fast Chachi with 16 cards in hand leaves a 3-card pile of disconnected junk to draw from stock deck.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: FAIL (currently takes 3+ cards unconditionally regardless of hand size).

- [ ] **Step 3: Implement hoarding ceiling**
  In `src/engine/bots/hand-analyzer.ts` inside `options.personality === 'FAST_CHACHI'`, if `hand.length > 14`, require the pile to contain a wildcard, immediate meld, or extreme run connector to pick up.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: PASS.

- [ ] **Step 5: Verify build & commit**
  Run: `npx tsc --noEmit && npm test && npm run build`
  Git: commit and push to `origin main`.

---

### Task 8: Final Turn All-Out Dump Mode (`FINAL_TURN` / Stock Exhaust)

**Files:**
- Modify: `src/engine/bots/hand-analyzer.ts:510-705`, bot strategy files
- Test: `tests/engine/bots/strategies.test.ts`

**Interfaces:**
- Consumes: `state.roundStatus === 'FINAL_TURN'`, `state.lastTurnTriggeredByDeckExhaust`
- Produces: `isFinalTurn` flag passed through options, enabling cross-suit 2s on dirty runs, playing any dirty melds, and dumping maximum points.

- [ ] **Step 1: Write the failing test**
  In `tests/engine/bots/strategies.test.ts`, test that when `roundStatus === 'FINAL_TURN'`, a bot adds a cross-suit 2 to a dirty run to get points on table before round ends.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: FAIL (cross-suit 2 currently blocked unless close to Pukar).

- [ ] **Step 3: Implement Final Turn dump mode**
  In `hand-analyzer.ts`, check `isFinalTurn` (or `lastTurnTriggeredByDeckExhaust`). If true: allow cross-suit 2s on dirty melds, relax connector holding, and prioritize highest score dumps.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: PASS.

- [ ] **Step 5: Verify build & commit**
  Run: `npx tsc --noEmit && npm test && npm run build`
  Git: commit and push to `origin main`.

---

### Task 9: Realistic Uncle Pukar Deck Selection (No Peeking into Face-Down Cards)

**Files:**
- Modify: `src/engine/bots/bot-player.ts:101-126`
- Test: `tests/engine/bots/strategies.test.ts`

**Interfaces:**
- Consumes: `selectBotPukarDeck(state, botIndex, personality)`
- Produces: Blind, realistic deck selection matching human player constraints without inspecting `state.pukarPool[i]`.

- [ ] **Step 1: Write the failing test**
  In `tests/engine/bots/strategies.test.ts`, test that `selectBotPukarDeck` returns a valid deck index (0 or 1) without inspecting face-down cards in `pukarPool`.

- [ ] **Step 2: Run test to verify it fails / check behavior**
  Verify existing peeking implementation.

- [ ] **Step 3: Implement realistic selection**
  In `src/engine/bots/bot-player.ts`, select deck based on pile size if uneven, or realistic random choice (50/50), eliminating the face-down cards inspection loop.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: PASS.

- [ ] **Step 5: Verify build & commit**
  Run: `npx tsc --noEmit && npm test && npm run build`
  Git: commit and push to `origin main`.

---

### Task 10: Strict Lockdown Against Opponent on 1 Card & Burying Connecting Cards for Partner

**Files:**
- Modify: `src/engine/bots/hand-analyzer.ts:510-705`, `src/engine/bots/strategies/smart-chacha.ts:220-300`
- Test: `tests/engine/bots/strategies.test.ts`

**Interfaces:**
- Consumes: `nextOpponentCardCount <= 2`, `discardPile`
- Produces: Strict lockdown against providing connecting cards to an opponent about to go out; if a connecting card is at the bottom, deliberately discard most irrelevant deadwood (without breaking own hand) to bury it and pass cards cleanly to partner.

- [ ] **Step 1: Write the failing test**
  In `tests/engine/bots/strategies.test.ts`, test that when the next opponent has 1 card left, the bot strictly refuses to discard any card connecting to opponent melds or runs, and instead discards safe deadwood. Also test that if a connecting card is at the bottom, the bot discards irrelevant deadwood to bury it.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement strict lockdown and connector burying**
  In `hand-analyzer.ts` and `smart-chacha.ts`:
  - When next opponent has $\le 2$ cards, add massive penalty ($+500$) against discarding any card connecting to opponent table melds or open ends.
  - When a connecting card is in the discard pile, choose completely irrelevant isolated deadwood to discard that buries the card while preserving hand structure.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test tests/engine/bots/strategies.test.ts`
  Expected: PASS.

- [ ] **Step 5: Verify build & commit**
  Run: `npx tsc --noEmit && npm test && npm run build`
  Git: commit and push to `origin main`.
