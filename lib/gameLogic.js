// Export game logic functions for use in server.js
const BASIC_LANDS = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']

function createDeck() {
  const deck = []
  // Add 5 of each basic land (25 cards total)
  BASIC_LANDS.forEach(land => {
    for (let i = 0; i < 5; i++) {
      deck.push(land)
    }
  })
  return deck
}

function shuffleDeck(deck) {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function drawCards(deck, count) {
  const drawn = []
  const remaining = [...deck]
  
  for (let i = 0; i < count && remaining.length > 0; i++) {
    drawn.push(remaining.pop())
  }
  
  return [remaining, drawn]
}

function initializeGame() {
  // Create and shuffle decks for both players
  const player1Deck = shuffleDeck(createDeck())
  const player2Deck = shuffleDeck(createDeck())

  // Draw initial 4 cards for each player
  const [player1Remaining, player1Hand] = drawCards(player1Deck, 4)
  const [player2Remaining, player2Hand] = drawCards(player2Deck, 4)

  return {
    pendingEffect: null,
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

module.exports = {
  createDeck,
  shuffleDeck,
  drawCards,
  initializeGame,
}


