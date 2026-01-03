export type LandType = 'Plains' | 'Island' | 'Swamp' | 'Mountain' | 'Forest'

export type Card = LandType

export interface Player {
  deck: Card[]
  hand: Card[]
  board: Card[]
  graveyard: Card[]
}

export interface GameState {
  players: [Player, Player]
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
  }
}

