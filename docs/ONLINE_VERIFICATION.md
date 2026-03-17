# Online Multiplayer Verification Guide

Use this checklist to verify basic online gameplay works before implementing stack/counter logic.

## Setup

1. **Start the server**
   ```bash
   npm run dev
   ```

2. **Open two browser sessions** (each needs a separate session):
   - Option A: Two browser windows (e.g. Chrome + Firefox), or
   - Option B: One normal window + one Incognito/Private window, or
   - Option C: Two devices on same network (phone + laptop)

3. Both go to `http://localhost:3000` (or your dev URL)

---

## Verification Checklist

### 1. Lobby & Join

- [ ] **Create game** (Window A): Click "Create New Game" → redirects to `/game/[CODE]` with "Waiting for Player..."
- [ ] **Join game** (Window B): Go to lobby, enter the 6-letter code, click Join → both see the game board
- [ ] Each window shows correct "You are Player 1" / "You are Player 2"

### 2. Turn Structure

- [ ] **Turn indicator** shows "Player 1's Turn" at start
- [ ] **Player 2 cannot act** when it's Player 1's turn: Draw and Play on P2's section do nothing (or are disabled)
- [ ] **Player 1 draws** → card appears in P1's hand
- [ ] **Player 1 plays Plains** → card moves to board, turn advances to Player 2
- [ ] **Turn indicator** updates to "Player 2's Turn"
- [ ] **Player 1 cannot act** when it's Player 2's turn
- [ ] **End Turn button** appears for active player only; clicking it advances turn when no plays

### 3. State Sync

- [ ] Action in Window A (e.g. P1 plays a card) **immediately appears** in Window B
- [ ] No desync: both windows show same board, hands, deck counts
- [ ] Game log updates on both sides

### 4. Card Effects

- [ ] **Plains**: Play → draw a card → turn advances
- [ ] **Mountain**: Play → opponent selects a board card to discard → turn advances
- [ ] **Forest**: Play → select a graveyard card to return to hand → turn advances
- [ ] **Swamp**: Play → opponent reveals 3 hand cards → you choose one to discard → turn advances
- [ ] **Island**: (if implemented) Play → reveal top card → choose discard or put back → turn advances

### 5. Win Conditions

- [ ] **Domain win**: One player gets 1 of each land type on board → win message
- [ ] **5-of-a-kind win**: One player gets 5 of same land on board → win message

### 6. Edge Cases

- [ ] **Pending effect blocks End Turn**: Start Mountain/Forest/Swamp, try End Turn → blocked with message
- [ ] **Empty deck**: Playing Plains with empty deck doesn't break
- [ ] **Refresh**: One player refreshes → rejoin flow or reconnection (if implemented)

---

## Quick Smoke Test (5 min)

Minimum to confirm it works:

1. Create + Join
2. P1 draws, P1 plays a land
3. Turn passes to P2
4. P2 draws, P2 plays a land
5. Verify both windows stay in sync

If all pass → basic online play is verified. Proceed with stack/counter POC locally, then port online.
