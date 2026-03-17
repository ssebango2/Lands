const { nanoid } = require('nanoid')
const { initializeGame } = require('./gameLogic')

// In-memory game store (can be replaced with Redis for production)
const games = new Map()

// Clean up old games (older than 24 hours)
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours

function createGame() {
  const code = nanoid(6).toUpperCase()
  const game = {
    code,
    gameState: null,
    stateHistory: [],
    players: [],
    createdAt: Date.now(),
    status: 'waiting',
  }
  games.set(code, game)
  return code
}

function getGame(code) {
  return games.get(code.toUpperCase())
}

function joinGame(code, socketId, playerName) {
  const game = games.get(code.toUpperCase())
  
  if (!game) {
    return { success: false, error: 'Game not found' }
  }
  
  if (game.players.length >= 2) {
    return { success: false, error: 'Game is full' }
  }
  
  if (game.status !== 'waiting') {
    return { success: false, error: 'Game has already started' }
  }
  
  // Check if socket is already in game
  if (game.players.some(p => p.socketId === socketId)) {
    return { success: false, error: 'Already in this game' }
  }
  
  const playerId = (game.players.length + 1)
  game.players.push({
    playerId,
    socketId,
    name: playerName,
  })
  
  return { success: true, playerId }
}

function removePlayer(code, socketId) {
  const game = games.get(code.toUpperCase())
  if (!game) return
  
  game.players = game.players.filter(p => p.socketId !== socketId)
  
  // If no players left, remove game after a delay
  if (game.players.length === 0) {
    setTimeout(() => {
      const currentGame = games.get(code.toUpperCase())
      if (currentGame && currentGame.players.length === 0) {
        games.delete(code.toUpperCase())
      }
    }, 60000) // Remove after 1 minute if still empty
  }
}

function updateGameState(code, gameState) {
  const game = games.get(code.toUpperCase())
  if (!game) return

  if (game.gameState) {
    game.stateHistory = game.stateHistory || []
    game.stateHistory.push(JSON.parse(JSON.stringify(game.gameState)))
    if (game.stateHistory.length > 3) game.stateHistory.shift()
  }

  if (game.stateVersion === undefined) game.stateVersion = 0
  game.gameState = { ...gameState, stateVersion: game.stateVersion }
  if (game.status === 'waiting' && gameState) {
    game.status = 'in-progress'
  }
}

/** Optimistic concurrency: only update if fromVersion matches current. Returns { accepted, stateVersion }. */
function tryUpdateGameState(code, gameState, fromVersion) {
  const game = games.get(code.toUpperCase())
  if (!game) return { accepted: false }

  const currentVersion = game.stateVersion ?? 0
  if (fromVersion !== currentVersion) return { accepted: false, stateVersion: currentVersion }

  if (game.gameState) {
    game.stateHistory = game.stateHistory || []
    game.stateHistory.push(JSON.parse(JSON.stringify(game.gameState)))
    if (game.stateHistory.length > 3) game.stateHistory.shift()
  }

  game.stateVersion = currentVersion + 1
  game.gameState = { ...gameState, stateVersion: game.stateVersion }
  if (game.status === 'waiting' && gameState) {
    game.status = 'in-progress'
  }
  return { accepted: true, stateVersion: game.stateVersion }
}

function getStateVersion(code) {
  const game = games.get(code.toUpperCase())
  return game?.stateVersion ?? 0
}

function restorePreviousState(code) {
  const game = games.get(code.toUpperCase())
  if (!game || !game.stateHistory || game.stateHistory.length === 0) return null

  const previous = game.stateHistory.pop()
  game.gameState = previous
  return previous
}

function getGameState(code) {
  const game = games.get(code.toUpperCase())
  return game?.gameState || null
}

function getPlayerId(code, socketId) {
  const game = games.get(code.toUpperCase())
  if (!game) return null
  
  const player = game.players.find(p => p.socketId === socketId)
  return player?.playerId || null
}

// Cleanup old games periodically
setInterval(() => {
  const now = Date.now()
  for (const [code, game] of games.entries()) {
    if (now - game.createdAt > CLEANUP_INTERVAL) {
      games.delete(code)
    }
  }
}, CLEANUP_INTERVAL)

module.exports = {
  createGame,
  getGame,
  joinGame,
  removePlayer,
  updateGameState,
  tryUpdateGameState,
  getGameState,
  getStateVersion,
  getPlayerId,
  restorePreviousState,
}


