# Design Specification: Pukar Card Game

**Date:** 2026-10-07  
**Status:** Approved  
**Author:** Pair Programming (User & Antigravity)  
**Target:** Local Hot-Seat Test Application (with Architecture Ready for LAN / Online Multiplayer)

---

## 1. Executive Summary & Objective

Pukar is a strategic multi-deck card meld game played by 4 or 6 players split into two competing teams (Team A vs Team B). The objective is to score points through sequences (runs) and groups (sets), claim Pukar decks when emptying hands, and capitalize on movable wildcards (2s and Natural Jokers).

This specification outlines the complete system design for:
1. A decoupled, pure TypeScript game engine implementing deterministic state transitions, strict rule validation, and JSON-serializable actions.
2. A comprehensive automated test suite (Vitest) validating 100% of game mechanics and edge cases.
3. A modern React/Tailwind Web UI designed for local hot-seat testing, with perspective switching and an inspector mode to observe all player hands.
4. A network-ready contract designed to transition smoothly to LAN or online multiplayer in Phase 2 without rewriting core game logic.

---

## 2. Architecture & Multiplayer Readiness

The system adheres to a strict separation of concerns between game logic and user interface:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Pure Game Engine                                │
│                   (src/engine/ - Pure TypeScript)                      │
│  • Immutable GameState             • Deterministic Reducer             │
│  • Meld & Joker Validation         • Deck & Pukar Management           │
│  • Turn Lifecycle State Machine    • Scoring Engine                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
     [Phase 1: Local Hot-Seat]           [Phase 2: Future LAN / Online]
  ┌───────────────────────────────┐   ┌──────────────────────────────────┐
  │ Local State Manager           │   │ WebSocket / LAN Server           │
  │ • Instant action dispatch     │   │ • Room state authority           │
  │ • Hot-seat player switcher    │   │ • State sanitization per player  │
  │ • God-Mode inspector view     │   │ • Network reconnection & sync    │
  └───────────────┬───────────────┘   └─────────────────┬────────────────┘
                  └─────────────────┬───────────────────┘
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │                   Web UI Presentation                   │
       │                 (src/ui/ - React/Tailwind)              │
       │  • Table View & Team Melds     • Card Hand & Selector   │
       │  • Discard Pile Peek Modal     • Scoring & Round Modals │
       └─────────────────────────────────────────────────────────┘
```

### 2.1 Engine Principles
- **Zero DOM / React Dependencies**: The engine operates purely on plain JavaScript/TypeScript objects.
- **Deterministic Action Reducer**: `dispatchAction(state: GameState, action: GameAction): Result<GameState, GameError>`.
- **Serializability**: Every piece of state (cards, hands, melds, scores) is 100% JSON-serializable.
- **Multiplayer State Sanitization**: Includes a helper `sanitizeStateForPlayer(state: GameState, playerId: string): SanitizedGameState` that masks opponents' hands and draw deck contents for remote clients in future multiplayer modes.

---

## 3. Game Rules & Formal Specification

### 3.1 Players, Decks & Dealing
- **Player Counts**:
  - **4 Players**: 2 teams of 2. Seating order: Team A1, Team B1, Team A2, Team B2.
  - **6 Players**: 2 teams of 3. Seating order: Team A1, Team B1, Team A2, Team B2, Team A3, Team B3.
- **Deck Composition**:
  - 4 Players: **2 standard decks** + 3 natural jokers per deck = **110 cards**.
  - 6 Players: **3 standard decks** + 3 natural jokers per deck = **165 cards**.
- **Initial Deal**:
  - Each player receives **13 cards** in hand.
  - Pukar Decks:
    - 4 Players: **2 Pukar piles** of 13 cards each (total 26 cards).
    - 6 Players: **3 Pukar piles** of 13 cards each (total 39 cards).
  - Pukars are placed face-down in a **shared, first-come first-served pool**.
  - Discard Pile ("The Bottom"): 1 card is flipped face-up from the remaining stock to initialize the discard pile.
  - Remaining cards form the face-down **Stock Deck**.

---

### 3.2 Card Model & Jokers
- **Standard Ranks**: 2 through 14 (11=Jack, 12=Queen, 13=King, 14=Ace). Ace can also act as low rank 1 in runs (A-2-3-4-5-6-7).
- **Suits**: Spades (♠), Hearts (♥), Diamonds (♦), Clubs (♣).
- **Natural Jokers**: 3 jokers per deck (total 6 in a 4-player game, 9 in a 6-player game). Natural jokers have no suit and serve strictly as wildcards.
- **Rank '2' Cards (Movable Jokers)**:
  - Every card of rank `2` is a wildcard by default.
  - **Dual Capability**: A `2` can either occupy its natural rank position (rank `2`) matching the suit of a run, OR substitute for any missing rank in that run or set.
  - **Up-and-Down Shifting**: When a team member contributes a natural card that matches the rank currently substituted by a `2`:
    - The `2` is **not discarded or returned to hand**.
    - The `2` shifts to another valid position in that sequence (e.g. shifts upward to substitute for a higher rank, or slides down to the natural `2` spot if available).
    - Example: In run `[3♠, 4♠, 2 (acting as 5♠), 6♠]`, if a player adds `5♠` and `8♠`, the `5♠` takes its natural slot, the `2` moves up to act as `7♠`, and `8♠` connects: `[3♠, 4♠, 5♠, 6♠, 2 (acting as 7♠), 8♠]`.
  - **Permanence**: Once a `2` is placed in a meld, it is permanently locked on the table and cannot be returned to any player's hand.
- **Wildcard Limit**: At most **1 wildcard** (either a natural joker or a 2) is permitted in any single meld.

---

### 3.3 Melds & Sequences
Melds require a **minimum of 3 cards** to be played to the table. Once opened, melds belong to the entire team, and any team member can contribute cards on their turn.

1. **Runs (Sequences)**:
   - Must consist of cards of the **exact same suit** (♠, ♥, ♦, or ♣).
   - Ranks must be consecutive (e.g., 4-5-6).
   - At most 1 wildcard (2 or Natural Joker) substituting for a single rank in the sequence.
   - Clean Run: A run containing zero wildcards and zero 2s.
   - Dirty Run: A run containing 1 wildcard (either a natural joker or any 2).
2. **Sets (Groups)**:
   - 3 or more cards of the **exact same rank** (e.g., 8♠, 8♥, 8♦).
   - At most 1 wildcard allowed.
3. **Special 13-Card Full Run (2 to A)**:
   - Consecutive sequence of all 13 cards of the same suit: 2-3-4-5-6-7-8-9-10-J-Q-K-A.
   - **Must be 100% pure/natural**: No wildcards of any kind are permitted.

---

### 3.4 Turn Lifecycle State Machine

A player's turn consists of three strict sequential phases:

```
     ┌────────────────┐
     │   DRAW PHASE   │
     └───────┬────────┘
             │ Choose one:
             ├──────────────────────────────────────┐
             ▼                                      ▼
     [Draw 1 from Stock]                 [Take All from Discard Pile ("Bottom")]
             │                                      │
             └──────────────────┬───────────────────┘
                                ▼
                     ┌─────────────────────┐
                     │     MELD PHASE      │◄─────────────────────────────┐
                     └──────────┬──────────┘                              │
                                │ (0 or more actions)                     │
                                ├─ Play new sequence (min 3 cards)        │
                                ├─ Add cards to team meld (shift 2)       │
                                │                                         │
                                ▼ Hand reaches 0 cards?                   │
                         [Pukar Available?]                               │
                             ├─ YES: Gain Pukar (+50 pts) ────────────────┘
                             │       (Continues melding in same turn)
                             │
                             └─ NO: Hand empty & no Pukars!
                                    └───► [ROUND ENDS IMMEDIATELY]
                                │
                                ▼
                     ┌─────────────────────┐
                     │    DISCARD PHASE    │
                     └──────────┬──────────┘
                                │
                                ▼ Mandatory: Discard 1 card to Bottom
                     ┌─────────────────────┐
                     │      NEXT TURN      │
                     └─────────────────────┘
```

#### Detailed Phase Mechanics:
1. **Draw Phase**:
   - The player draws 1 card from the top of the face-down stock deck, OR
   - The player takes **all cards** currently in the discard pile ("the bottom") unconditionally into their hand.
2. **Meld Phase**:
   - Player may play new runs or sets (minimum 3 cards).
   - Player may add cards to existing melds belonging to their team.
   - **Pukar Claim Trigger**: If a player depletes all cards in their hand through melding:
     - If Pukars remain in the shared pool: The player immediately claims one 13-card Pukar into their hand, their team is awarded **+50 points**, and the player continues their turn.
     - If no Pukars remain: The player has "gone out" cleanly. The round ends immediately with no discard required.
3. **Discard Phase**:
   - Mandatory: The player selects 1 card from hand and discards it face-up to "the bottom" to conclude their turn.
   - Turn advances clockwise to the next player.
   - If discarding leaves the player with 0 cards:
     - If Pukars remain: The player claims the 13-card Pukar into their hand (+50 points), which they will play on their next turn.
     - If no Pukars remain: The player has gone out; round ends immediately.

---

### 3.5 Stock Deck Exhaustion & Round Termination

When the face-down Stock Deck runs out of cards during a draw:
1. **Pukars Remaining in Pool**:
   - Exactly one 13-card Pukar deck is taken from the pool, shuffled, and set as the new Stock Deck.
   - Gameplay continues without interruption.
2. **Zero Pukars Remaining**:
   - The Stock Deck is depleted and no Pukars exist.
   - The player whose turn occurs immediately after the deck empties receives **one final turn**.
   - Upon completion of this final turn, the round terminates.
3. **Round Termination via Going Out**:
   - Occurs when any player empties their hand and no Pukars remain in the pool.

---

### 3.6 Scoring Matrix

Scoring is tallied per team at the end of each round based on completed milestones:

| Achievement | Condition | Points Awarded |
| :--- | :--- | :--- |
| **Clean 7-Card Run** | Exactly 7+ cards in sequence, same suit, 0 wildcards/2s | **+200 pts** |
| **Dirty 7-Card Run** | Exactly 7+ cards in sequence, same suit, contains 1 wildcard | **+100 pts** |
| **Clean 7-of-a-Kind** | Exactly 7+ cards of identical rank, 0 wildcards | **+200 pts** |
| **Dirty 7-of-a-Kind** | Exactly 7+ cards of identical rank, contains 1 wildcard | **+100 pts** |
| **Pure 13-Card Run (2 to A)** | Full natural sequence 2 through A, same suit, 0 wildcards | **+500 pts** |
| **Claimed Pukar** | Awarded each time a team claims a 13-card Pukar | **+50 pts** |
| **Incomplete Melds / Hand Cards** | Melds under 7 cards, unplayed cards left in hand | **0 pts (No penalty)** |

- Round points are added to the cumulative match score.
- Matches can be played across multiple rounds until players choose to conclude the game.

---

## 4. Hot-Seat Web UI Specification

### 4.1 Interface Components
1. **Header / Scoreboard**:
   - Round counter, active team indicator, team score breakdown (cumulative + current round), and Pukar claim tallies.
2. **Table Arena**:
   - **Team A & Team B Meld Boards**: Displays each active sequence with visual badges:
     - `Clean Run (200)`
     - `Dirty Run (100)`
     - `7-of-a-Kind (200/100)`
     - `Pure 2-to-A Run (500)`
     - Highlighted movable wildcard indicators (e.g., golden glow with label "2 as 5♠").
   - **Center Table (Deck & Discard)**:
     - Stock deck with remaining card counter.
     - Discard pile ("The Bottom") displaying the top face-up card and total pile count.
     - "Peek Bottom" button opening a visual modal of all cards in the discard pile.
     - Pukar stack showing remaining pool count.
3. **Active Player Hand & Control Dock**:
   - Overlapping visual playing cards with suit colors and rank labels.
   - "Sort by Suit" and "Sort by Rank" toggles.
   - Action buttons: "Draw Deck", "Take Bottom", "Meld Selected as New", "Add to Selected Meld", "Discard & Pass".
4. **Developer / Testing Tools**:
   - **Hot-Seat Switcher**: Quick-select buttons for P1, P2, P3, P4 (and P5, P6 in 6-player mode).
   - **Inspector / God Mode**: Expandable drawer revealing all player hands simultaneously for instantaneous testing and state verification.
   - **Game Reset & Round Advance**: Clear controls to test multi-round score persistence.

---

## 5. Automated Verification Plan (Vitest)

Before connecting the Web UI, the core engine will be verified through comprehensive unit tests:
1. `deck.test.ts`: 110 cards for 4p, 165 cards for 6p, 3 jokers/deck, 13 cards/hand, 13 cards/pukar.
2. `meld-validator.test.ts`:
   - Valid runs (same suit, min 3 cards). Rejection of mixed suits.
   - Valid sets (same rank, min 3 cards).
   - Wildcard limits (at most 1 joker/2 per meld).
   - Pure 2-to-A run (500 pts) rejects wildcards.
   - 7-card runs and sets accurately tagged as 200 pts (clean) or 100 pts (dirty).
3. `movable-joker.test.ts`:
   - Adding natural card into meld containing substituted 2 displaces the 2 upward or to natural rank.
   - Immutability check: attempts to withdraw 2 to hand throw a validation error.
4. `turn-lifecycle.test.ts`:
   - Draw from stock vs draw entire bottom pile.
   - Mandatory discard advances turn.
   - Depleting hand triggers instant Pukar claim and adds 50 points.
   - Empty stock deck replenished with Pukar when available.
   - Empty stock deck with 0 Pukars triggers 1 final turn, then round conclusion.
   - Going out with 0 Pukars ends round.
5. `score-calculator.test.ts`:
   - Correct tally of all bonuses across rounds.
