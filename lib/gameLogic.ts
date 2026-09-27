export type LandType = 'Plains' | 'Island' | 'Swamp' | 'Mountain' | 'Forest'

export type Card = LandType

export interface Player {
  deck: Card[]
  hand: Card[]
  board: Card[]
  graveyard: Card[]
}

/** Stack entry - land on stack awaiting pass/counter */
export interface StackEntry {
  spell: LandType
  controller: 1 | 2
  counterCount: number
  /** Links a Mountain/Forest on the stack to its `targetedEffect` */
  effectId?: number
}

/** Pending card effect - synced across clients for online multiplayer */
export type PendingEffect =
  | { type: 'swamp'; activePlayer: 1 | 2; phase: 'reveal' | 'discard'; revealedCards: number[] }
  | { type: 'island'; activePlayer: 1 | 2; revealedCard: LandType }
  | { type: 'handLimit'; playerId: 1 | 2; discardCount: number }
  | null
/** Mirrors lib/matchOptions.js. `goFirst` is relative to whoever chose the options. */
export interface MatchOptions {
  goFirst: boolean
  handLimit: boolean
}

/** Mirrors EFFECT_PHASES in lib/engine.js */
export type EffectPhase =
  | 'AWAITING_TARGET_SELECTION'
  | 'AWAITING_COUNTER_DECISION'
  | 'RESOLVING_EFFECT'
  | 'EFFECT_COMPLETE'

export interface EffectTarget {
  playerId: 1 | 2
  zone: 'board' | 'graveyard'
  index: number
  card: LandType
}

/** Mountain/Forest: the target is chosen and locked before anyone may counter. */
export interface TargetedEffect {
  id: number
  spell: 'Mountain' | 'Forest'
  controller: 1 | 2
  phase: EffectPhase
  target: EffectTarget | null
  outcome?: 'resolved' | 'countered' | 'fizzled' | 'no-target'
  returnedIndex?: number
}

export interface GameState {
  players: [Player, Player]
  activePlayer: 1 | 2
  turnNumber: number
  /** Stack: lands awaiting pass/counter resolution */
  stack?: StackEntry[]
  /** Who has priority (can pass or counter) */
  priorityHolder?: 1 | 2 | null
  /** Synced pending effect so both players see Swamp/Island/counter selection state */
  pendingEffect?: PendingEffect
  /** Online: Mountain/Forest in flight */
  targetedEffect?: TargetedEffect | null
  /** Online: the most recent Mountain/Forest after it finished (phase EFFECT_COMPLETE) */
  lastEffect?: TargetedEffect | null
  /** Set when game ends - winner player id */
  winner?: 1 | 2 | null
  winReason?: string | null
  /** Online: increments on every rematch */
  matchId?: number
  startingPlayer?: 1 | 2
  autoPass?: { 1: boolean; 2: boolean }
  /** Online: optional rules chosen for this match */
  rules?: { handLimit: boolean }
  /** Online: server-authored log shared by both players */
  log?: string[]
  /** Version for optimistic concurrency - prevents stale updates overwriting in online play */
  stateVersion?: number
}

export interface RematchState {
  status: 'idle' | 'requested'
  requestId: string | null
  requestedBy: 1 | 2 | null
  /** The requester's options, shown to the opponent before they accept */
  options: MatchOptions | null
  expiresAt: number | null
  outcome: null | 'declined' | 'cancelled' | 'expired' | 'disconnected' | 'unavailable'
}

/** Returns { playerId, reason } if player has won (1 of each land or 5 of one type), else null */
export function getWinnerIfAny(player: Player, playerId: 1 | 2): { playerId: 1 | 2; reason: string } | null {
  const landTypes: LandType[] = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']
  const hasAllTypes = landTypes.every(type => player.board.includes(type))
  if (hasAllTypes) {
    return { playerId, reason: 'Domain (1 of each basic land type)' }
  }
  for (const landType of landTypes) {
    const count = player.board.filter(card => card === landType).length
    if (count >= 5) {
      return { playerId, reason: `5 ${landType}s` }
    }
  }
  return null
}

const BASIC_LANDS: LandType[] = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']

export function createDeck(): Card[] {
  const deck: Card[] = []
  // Add 5 of each basic land (25 cards total)
  BASIC_LANDS.forEach(land => {
    for (let i = 0; i < 5; i++) {
      deck.push(land)
    }
  })
  return deck
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function drawCards(deck: Card[], count: number): [Card[], Card[]] {
  const drawn: Card[] = []
  const remaining = [...deck]
  
  for (let i = 0; i < count && remaining.length > 0; i++) {
    drawn.push(remaining.pop()!)
  }
  
  return [remaining, drawn]
}

export function initializeGame(): GameState {
  // Create and shuffle decks for both players
  const player1Deck = shuffleDeck(createDeck())
  const player2Deck = shuffleDeck(createDeck())

  // Draw initial 4 cards for each player
  const [player1Remaining, player1Hand] = drawCards(player1Deck, 4)
  const [player2Remaining, player2Hand] = drawCards(player2Deck, 4)

  return {
    players: [
      {
        deck: player1Remaining,
        hand: player1Hand,
        board: [],
        graveyard: [],
      },
      {
        deck: player2Remaining,
        hand: player2Hand,
        board: [],
        graveyard: [],
      },
    ],
    activePlayer: 1,
    turnNumber: 1,
  }
}

