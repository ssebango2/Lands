import { GameState, LandType } from './gameLogic'

/** What a player's zones look like on screen; enough to infer where cards travelled. */
export interface ZoneView {
  deckCount: number
  hand: LandType[]
  board: LandType[]
  graveyard: LandType[]
  /** Card shown on the battlefield while it waits on the stack / for a target */
  pending: LandType | null
  /** Island's revealed top card while the decision is open */
  revealed: LandType | null
}

export type ZoneViews = [ZoneView, ZoneView]

export type FlightKind = 'discard' | 'draw' | 'return'

export interface PlannedFlight {
  id: string
  kind: FlightKind
  playerId: 1 | 2
  card: LandType
  /** `data-motion` keys, most specific first */
  from: string[]
  to: string[]
  /** Card back at the start (deck) / at the end (hidden hand) */
  backAtStart: boolean
  backAtEnd: boolean
  delay: number
}

const DISCARD_STAGGER_MS = 90
const DRAW_STAGGER_MS = 140

export const motionKey = {
  deck: (p: 1 | 2) => `deck-${p}`,
  graveyard: (p: 1 | 2) => `graveyard-${p}`,
  hand: (p: 1 | 2) => `hand-${p}`,
  handCard: (p: 1 | 2, card: LandType) => `hand-${p}-card-${card}`,
  handIndex: (p: 1 | 2, index: number) => `hand-${p}-idx-${index}`,
  board: (p: 1 | 2, card: LandType) => `board-${p}-${card}`,
  reveal: (p: 1 | 2) => `reveal-${p}`,
}

export function motionViewsFromGameState(
  state: GameState,
  revealedOverride?: { playerId: 1 | 2; card: LandType } | null,
): ZoneViews {
  const stack = state.stack ?? []
  const top = stack.length > 0 ? stack[stack.length - 1] : null
  const te = state.targetedEffect
  const pe = state.pendingEffect
  const view = (pid: 1 | 2): ZoneView => {
    const p = state.players[pid - 1]
    let pending: LandType | null = null
    if (top?.controller === pid) pending = top.spell
    else if (te && te.controller === pid && te.phase === 'AWAITING_TARGET_SELECTION') pending = te.spell
    let revealed: LandType | null = null
    if (revealedOverride !== undefined) revealed = revealedOverride?.playerId === pid ? revealedOverride.card : null
    else if (pe?.type === 'island' && pe.activePlayer === pid) revealed = pe.revealedCard
    return { deckCount: p.deck.length, hand: p.hand, board: p.board, graveyard: p.graveyard, pending, revealed }
  }
  return [view(1), view(2)]
}

/**
 * Zones only ever lose cards at an index and gain them at the end, so a greedy
 * walk recovers which entries left and which arrived.
 */
function alignDiff(prev: LandType[], next: LandType[]) {
  const removed: Array<{ card: LandType; index: number }> = []
  let i = 0
  let j = 0
  while (i < prev.length && j < next.length) {
    if (prev[i] === next[j]) {
      i++
      j++
    } else {
      removed.push({ card: prev[i], index: i })
      i++
    }
  }
  for (; i < prev.length; i++) removed.push({ card: prev[i], index: i })
  const appended = next.slice(j).map((card, k) => ({ card, index: j + k }))
  return { removed, appended }
}

let flightSeq = 0

export function planCardMotions(
  prev: ZoneViews,
  next: ZoneViews,
  { faceUpHands }: { faceUpHands: { 1: boolean; 2: boolean } },
): PlannedFlight[] {
  const flights: PlannedFlight[] = []

  for (const pid of [1, 2] as const) {
    const before = prev[pid - 1]
    const after = next[pid - 1]
    const handKey = (card: LandType, index: number) =>
      faceUpHands[pid] ? motionKey.handCard(pid, card) : motionKey.handIndex(pid, index)

    const hand = alignDiff(before.hand, after.hand)
    const board = alignDiff(before.board, after.board)
    const graveyard = alignDiff(before.graveyard, after.graveyard)

    // Where could a card that just reached this graveyard have come from?
    const origins: Array<{ card: LandType; keys: string[] }> = [
      ...board.removed.map(r => ({ card: r.card, keys: [motionKey.board(pid, r.card)] })),
      ...hand.removed.map(r => ({ card: r.card, keys: [handKey(r.card, r.index), motionKey.hand(pid)] })),
    ]
    if (before.pending && !after.pending) {
      origins.push({ card: before.pending, keys: [motionKey.board(pid, before.pending)] })
    }
    if (before.revealed && !after.revealed) {
      origins.push({ card: before.revealed, keys: [motionKey.reveal(pid), motionKey.deck(pid)] })
    }

    graveyard.appended.forEach(({ card }, k) => {
      const at = origins.findIndex(o => o.card === card)
      const from = at >= 0 ? origins.splice(at, 1)[0].keys : [motionKey.deck(pid)]
      flights.push({
        id: `f${++flightSeq}`,
        kind: 'discard',
        playerId: pid,
        card,
        from,
        to: [motionKey.graveyard(pid)],
        backAtStart: false,
        backAtEnd: false,
        delay: k * DISCARD_STAGGER_MS,
      })
    })

    let deckDrawn = Math.max(0, before.deckCount - after.deckCount)
    const leftGraveyard = graveyard.removed.map(r => r.card)
    hand.appended.forEach(({ card, index }, k) => {
      const fromGraveyardAt = deckDrawn > 0 ? -1 : leftGraveyard.indexOf(card)
      const returning = fromGraveyardAt >= 0
      if (returning) leftGraveyard.splice(fromGraveyardAt, 1)
      else deckDrawn = Math.max(0, deckDrawn - 1)
      flights.push({
        id: `f${++flightSeq}`,
        kind: returning ? 'return' : 'draw',
        playerId: pid,
        card,
        from: returning ? [motionKey.graveyard(pid)] : [motionKey.deck(pid)],
        to: [handKey(card, index), motionKey.hand(pid)],
        // A card returned by Forest is public, so it stays face up even in a hidden hand.
        backAtStart: !returning,
        backAtEnd: !returning && !faceUpHands[pid],
        delay: k * DRAW_STAGGER_MS,
      })
    })
  }

  return flights
}
