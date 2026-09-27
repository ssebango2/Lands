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

- [ ] **Create game** (Window A): Click "Create New Game" → options dialog ("You go first", "7-card hand limit") → Create game → redirects to `/game/[CODE]` with "Waiting for an opponent"
- [ ] With "You go first" off, the joining player takes turn 1; with the hand limit on, the rail shows "7-card hand limit" and ending a turn with 8+ cards prompts a discard down to 7
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
- [ ] **Mountain**: Play → *you* pick an opponent's land (they see "Choosing a target…") → the target is marked on both screens → *then* the opponent may counter → resolves or is countered → turn advances
- [ ] **Forest**: Play → pick a card from your graveyard → marked for both → opponent may counter → card returns (or Forest is countered) → turn advances
- [ ] **Mountain / Forest with no valid target** (empty opponent board / empty graveyard): skips targeting and goes straight to the counter window
- [ ] **Swamp**: Play → opponent reveals 3 hand cards → you choose one to discard → turn advances
- [ ] **Island**: Play → reveal top card → "Inspect board" collapses the panel to a tray (no blur) → "Return to decision" → choose discard or put back → turn advances
- [ ] **Card motion**: discarded / destroyed cards fly to the right graveyard; draws lift off the deck and flip into your hand (card back stays for the opponent's hand)

### 5. Win Conditions

- [ ] **Domain win**: One player gets 1 of each land type on board → win message
- [ ] **5-of-a-kind win**: One player gets 5 of same land on board → win message

### 6. Edge Cases

- [ ] **Pending effect blocks End Turn**: Start Mountain/Forest/Swamp, try End Turn → blocked with message
- [ ] **Empty deck**: Playing Plains with empty deck doesn't break
- [ ] **Refresh**: One player refreshes mid-effect → they reclaim the same seat (per-tab token in sessionStorage) and the pending target / counter / Island decision is still there

### 7. Rematch

- [ ] After a win, both see **Request rematch**, which opens the same options as the lobby (defaults: alternate who starts, keep the current hand-limit setting)
- [ ] Requester sees "Rematch requested…" plus the options summary, with **Cancel request**; opponent sees the options from their side with **Accept** / **Decline**
- [ ] Accept → fresh match on the same code, seats kept, the requester's options applied
- [ ] Decline / cancel / opponent closes the tab / 60 s timeout → status message, no new match

---

## Quick Smoke Test (5 min)

Minimum to confirm it works:

1. Create + Join
2. P1 draws, P1 plays a land
3. Turn passes to P2
4. P2 draws, P2 plays a land
5. Verify both windows stay in sync

If all pass → basic online play is verified. Proceed with stack/counter POC locally, then port online.
