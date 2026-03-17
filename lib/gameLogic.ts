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
}

/** Pending card effect - synced across clients for online multiplayer */
export type PendingEffect =
  | { type: 'mountain'; activePlayer: 1 | 2; cardIndex: number }
  | { type: 'forest'; activePlayer: 1 | 2 }
  | { type: 'swamp'; activePlayer: 1 | 2; phase: 'reveal' | 'discard'; revealedCards: number[] }
  | { type: 'island'; activePlayer: 1 | 2; revealedCard: LandType }
  | { type: 'counterSelect'; priorityHolder: 1 | 2; spell: LandType; counterCount: number; selectedIndices: number[] }
  | null

export interface GameState {
  players: [Player, Player]
  activePlayer: 1 | 2
  turnNumber: number
  /** Stack: lands awaiting pass/counter resolution */
  stack?: StackEntry[]
  /** Who has priority (can pass or counter) */
  priorityHolder?: 1 | 2
  /** Synced pending effect so both players see Mountain/Forest/Swamp selection state */
  pendingEffect?: PendingEffect
  /** Set when game ends - winner player id */
  winner?: 1 | 2
  /** Version for optimistic concurrency - prevents stale updates overwriting in online play */
  stateVersion?: number
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

