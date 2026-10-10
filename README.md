# Pukar (Royal Partner Rummy)

A web-based card game engine and modern UI for **Pukar** (Royal Partner Rummy), a strategic multi-deck team game played with 4 or 6 players. Built with React 19, TypeScript, Tailwind CSS, and WebSockets.

---

## Table of Contents

- [Overview & Objective](#overview--objective)
- [Game Rules & Mechanics](#game-rules--mechanics)
  - [Players, Teams & Seating](#players-teams--seating)
  - [Deck Setup & Dealing](#deck-setup--dealing)
  - [Turn Structure](#turn-structure)
  - [Melds & Sequences](#melds--sequences)
  - [Wildcards & Joker Rules](#wildcards--joker-rules)
  - [Pukar Claim & Round Conclusion](#pukar-claim--round-conclusion)
  - [Scoring Summary](#scoring-summary)
- [Game Modes](#game-modes)
  - [Local Pass & Play](#local-pass--play)
  - [Online / LAN Multiplayer](#online--lan-multiplayer)
- [Tech Stack & Architecture](#tech-stack--architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the App](#running-the-app)
  - [Running the Multiplayer Server](#running-the-multiplayer-server)
  - [Running Tests](#running-tests)
  - [Production Build](#production-build)

---

## Overview & Objective

Pukar is an engaging partnership card game where players work in two alternating teams (**Team A** vs **Team B**) to assemble high-value sequences and sets, claim extra 13-card **Pukar decks**, and outscore their opponents over multiple rounds.

The core gameplay centers on dynamic team melds, strategic wildcard management with movable `2`s, tactical pickup of the entire discard pile ("The Bottom"), and racing to claim bonus Pukar reserves.

---

## Game Rules & Mechanics

### Players, Teams & Seating
- **4 Players**: 2 teams of 2. Seating alternates: `P1 (Team A)`, `P2 (Team B)`, `P3 (Team A)`, `P4 (Team B)`.
- **6 Players**: 2 teams of 3. Seating alternates: `P1 (Team A)`, `P2 (Team B)`, `P3 (Team A)`, `P4 (Team B)`, `P5 (Team A)`, `P6 (Team B)`.

### Deck Setup & Dealing
- **4 Players**: Uses **2 standard 52-card decks** + 3 Natural Jokers per deck = **110 cards**.
  - Deal: 13 cards to each player's hand.
  - Pukar Pool: 2 Pukar decks of 13 cards each (26 cards).
  - The Bottom (Discard Pile): 1 card turned face-up.
  - Stock Deck: Remainder (31 cards).
- **6 Players**: Uses **3 standard 52-card decks** + 3 Natural Jokers per deck = **165 cards**.
  - Deal: 13 cards to each player's hand.
  - Pukar Pool: 3 Pukar decks of 13 cards each (39 cards).
  - The Bottom (Discard Pile): 1 card turned face-up.
  - Stock Deck: Remainder (47 cards).

### Turn Structure
Every player's turn consists of three distinct phases:

1. **DRAW (Mandatory)**:
   - **Draw 1 card** from the face-down Stock Deck; **OR**
   - **Take the entire Discard Pile** ("The Bottom") unconditionally into your hand.
2. **MELD (Optional)**:
   - Play new sequences (runs) or sets of 3+ cards for your team.
   - Add matching cards to your team's existing sequences on the table.
   - If your hand reaches 0 cards and Pukars remain in the pool, you immediately claim a 13-card Pukar deck and your turn continues!
3. **DISCARD (Mandatory)**:
   - Discard exactly 1 card face-up to the discard pile to end your turn and pass play to the next player.

---

### Melds & Sequences

Melds belong to the entire team once placed on the table. Any teammate may contribute cards on their turn.

- **Pure Opening Sequence**:
  - Each team's very first meld on the table **must be a Pure Run** (minimum 3 consecutive cards of the same suit, with zero wildcards/jokers; a card of rank `2` can only be present at its natural `2` rank position).
  - Sets and impure sequences cannot be played by a team until their pure opening run is established.
- **Pure Sequence (Clean Run)**:
  - 7 or more consecutive cards of the exact same suit with **0 wildcards**.
  - Scores **+200 points**.
- **Impure Sequence (Dirty Run)**:
  - 7 or more cards in sequence of the same suit containing **1 wildcard** (a Natural Joker or rank `2`).
  - Scores **+100 points**.
- **Complete Sequence (Pure 13-Card Run)**:
  - An unbroken, 13-card sequence in the same suit spanning from `2` through `Ace` with **0 wildcards**.
  - Scores **+500 points**.
  - Once completed, the sequence is locked (greyed out) and no additional cards may be added.
- **Sets (Of-a-Kind)**:
  - 3 or more cards of identical rank.
  - Clean set of 7: **+200 points**.
  - Impure set of 7: **+100 points**.
- **Wildcard Limit**: At most **1 wildcard** is permitted per sequence.

---

### Wildcards & Joker Rules

- **Rank 2 Cards (Movable Wildcards)**:
  - Every card of rank `2` acts as a wildcard by default, but can also serve at its natural rank `2` position.
  - **Movable Shift Dynamics**: When a `2` is substituting for a missing rank in a run, and a player adds the natural card that fills that rank:
    - The `2` is **never returned to hand** (it remains locked on the table).
    - The `2` dynamically shifts to another valid position in the sequence (shifting upward to a higher missing rank or sliding down to natural `2`).
- **Natural Jokers**:
  - Non-suited wildcards (rank 0) that designate a specific represented rank upon placement.
  - **Joker Pickup**: If a player holds the natural card corresponding to a Natural Joker locked in a sequence, they can play that natural card to replace the Joker and pick the Joker back into their hand!

---

### Pukar Claim & Round Conclusion

- **Claiming a Pukar (+50 pts)**:
  - When an active player empties their hand and Pukar decks remain in the shared pool, they immediately claim 13 cards from the Pukar pool.
  - Their team is awarded **+50 bonus points**.
  - The player's turn **continues immediately** in the MELD phase with their fresh 13-card hand.
- **Round Conclusion**:
  - When the Pukar pool is empty and a player empties their hand (either during melding or on final discard), that player **goes out**.
  - The team earns **+50 points** and the round terminates immediately.
- **Stock Deck Exhaustion**:
  - If the Stock Deck empties while Pukar decks remain in the pool, 1 Pukar deck is shuffled to replenish the Stock Deck.
  - If the Stock Deck empties and no Pukar decks remain, each player gets one final turn before the round concludes.

---

### Scoring Summary

| Achievement | Points |
| :--- | :--- |
| **Complete Sequence** (13 natural cards, 2-to-A, same suit, 0 wildcards) | **+500 pts** |
| **Pure Sequence** (7+ natural cards, consecutive, same suit, 0 wildcards) | **+200 pts** |
| **Clean Set** (7 cards of identical rank, 0 wildcards) | **+200 pts** |
| **Impure Sequence** (7+ cards in sequence, 1 wildcard) | **+100 pts** |
| **Impure Set** (7 cards of identical rank, 1 wildcard) | **+100 pts** |
| **Pukar Claim** (Emptying hand while Pukars remain in pool) | **+50 pts** |
| **Going Out** (Emptying hand when Pukar pool is exhausted) | **+50 pts** |

*Note: In Pukar, unmelded cards left in players' hands do not incur negative point penalties.*

---

## Game Modes

### Local Pass & Play
- Designed for local testing or casual pass-and-play matches.
- Full hot-seat player switcher (`P1` .. `P4`/`P6`).
- **Dev Inspector / God Mode**: Expandable developer panel allowing inspection of all players' hands simultaneously for rule verification.
- **Top Navigation Bar**: Seamless switching between the Table Arena, enlarged Sequences View, and detailed Scoreboard Breakdown.

### Online / LAN Multiplayer
- Powered by a lightweight Node.js WebSocket server (`server/server.ts`).
- **Room Code System**: Create 4-player or 6-player rooms with 4-letter join codes.
- **Interactive Lobby**: Choose your seat, select your team, toggle ready status, and customize player names.
- **State Sanitization**: The authoritative server strictly masks opponent hands and stock deck order so remote clients only receive their own hand and public table information.
- **Auto-Reconnection**: Rejoin sessions seamlessly across network interruptions using session tokens.

---

## Tech Stack & Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React
- **Build & Dev Tool**: Vite 6
- **Test Framework**: Vitest (770+ automated tests across engine, UI, network, and server)
- **Networking**: Node.js `ws` WebSocket library with typed client/server protocol contracts
- **Engine Design**:
  - Pure TypeScript state machine (`src/engine/reducer.ts`) with zero DOM dependencies.
  - 100% JSON-serializable immutable game state.
  - Deterministic deck generation, Fisher-Yates shuffling, and state sanitization.

---

## Getting Started

### Prerequisites
- **Node.js**: v18.0.0, v20.0.0, or >= v22.0.0
- **npm**: v9 or higher

### Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/hello-world-eyp/pukar.git
cd pukar
npm install
```

### Running the App
To start the Vite development server:

```bash
npm run dev
```

Open your browser at `http://localhost:5173`.

### Running the Multiplayer Server
To run the authoritative WebSocket multiplayer server:

```bash
npm run server
```

The server starts on port `8080` (or `PORT` environment variable) with full structured diagnostic logging.

### Running Tests
Execute the comprehensive test suite with Vitest:

```bash
npm test
```

Or run in watch mode:

```bash
npm run test:watch
```

### Production Build
To typecheck and compile the production bundle:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## License

Private repository. All rights reserved.
