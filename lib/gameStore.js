const { nanoid } = require('nanoid')
const { createRematchState } = require('./rematch')
const { applyIntent } = require('./engine')
const { normalizeMatchOptions } = require('./matchOptions')

// In-memory game store (can be replaced with Redis for production)
const games = new Map()

// Clean up old games (older than 24 hours)
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours
// How long a started game survives with nobody connected (page reloads, flaky networks)
const ABANDON_DELAY = 5 * 60 * 1000
const HISTORY_LIMIT = 3

/**
 * `options` come from the creator; `creatorToken` is the seat token their tab
 * will join with, so "go first" follows the creator rather than join order.
 */
function createGame({ options, creatorToken } = {}) {
  const code = nanoid(6).toUpperCase()
  const game = {
    code,
    options: normalizeMatchOptions(options),
    creatorToken: typeof creatorToken === 'string' && creatorToken ? creatorToken.slice(0, 100) : null,
    gameState: null,
    stateVersion: 0,
    stateHistory: [],
    players: [],
    createdAt: Date.now(),
    status: 'waiting',
    rematch: createRematchState(),
    rematchTimer: null,
  }
  games.set(code, game)
  return code
}

function getGame(code) {
  return games.get(String(code).toUpperCase())
}

/**
 * Seat a socket. A known `token` reclaims its existing seat (reconnect/reload);
 * otherwise a new seat is only available while the game is still waiting.
 */
function joinGame(code, socketId, token) {
  const game = getGame(code)
  if (!game) return { success: false, error: 'Game not found' }

  const seat = token ? game.players.find((p) => p.token === token) : null
  if (seat) {
    const previousSocketId = seat.connected && seat.socketId !== socketId ? seat.socketId : null
    seat.socketId = socketId
    seat.connected = true
    return { success: true, playerId: seat.playerId, rejoined: true, previousSocketId }
  }

  if (game.players.length >= 2) return { success: false, error: 'Game is full' }
  if (game.status !== 'waiting') return { success: false, error: 'Game has already started' }
  if (game.players.some((p) => p.socketId === socketId)) return { success: false, error: 'Already in this game' }

  const taken = new Set(game.players.map((p) => p.playerId))
  const playerId = taken.has(1) ? 2 : 1
  game.players.push({ playerId, socketId, token: token || null, connected: true })
  return { success: true, playerId, rejoined: false, previousSocketId: null }
}

/** Returns the seat that went offline, or null if the socket wasn't seated. */
function disconnectSocket(code, socketId) {
  const game = getGame(code)
  if (!game) return null
  const seat = game.players.find((p) => p.socketId === socketId)
  if (!seat) return null

  if (game.status === 'waiting') {
    game.players = game.players.filter((p) => p !== seat)
  } else {
    seat.connected = false
  }

  if (!game.players.some((p) => p.connected)) {
    const delay = game.status === 'waiting' ? 60000 : ABANDON_DELAY
    setTimeout(() => {
      const current = getGame(code)
      if (current && !current.players.some((p) => p.connected)) {
        if (current.rematchTimer) clearTimeout(current.rematchTimer)
        games.delete(current.code)
      }
    }, delay).unref?.()
  }
  return seat
}

function connectedCount(game) {
  return game.players.filter((p) => p.connected).length
}

/** Store a new authoritative state and bump the version clients must echo back. */
function commitState(code, gameState, { resetHistory = false } = {}) {
  const game = getGame(code)
  if (!game) return null
  if (resetHistory) {
    game.stateHistory = []
  } else if (game.gameState) {
    game.stateHistory.push(game.gameState)
    if (game.stateHistory.length > HISTORY_LIMIT) game.stateHistory.shift()
  }
  game.stateVersion = (game.stateVersion ?? 0) + 1
  game.gameState = { ...gameState, stateVersion: game.stateVersion }
  if (game.status === 'waiting') game.status = 'in-progress'
  return game.gameState
}

/**
 * Apply a player intent against the authoritative state. `fromVersion` must
 * equal the current version, so duplicated or stale emits are rejected rather
 * than applied twice.
 */
function submitIntent(code, playerId, intent, fromVersion) {
  const game = getGame(code)
  if (!game || !game.gameState) return { accepted: false, reason: 'not-started', error: 'Game not found or not started' }
  if (fromVersion !== game.stateVersion) return { accepted: false, reason: 'stale' }
  const result = applyIntent(game.gameState, playerId, intent)
  if (result.error) return { accepted: false, reason: 'invalid', error: result.error }
  return { accepted: true, gameState: commitState(code, result.state) }
}

/** Undo: restore the previous state under a fresh version so clients' next intents line up. */
function restorePreviousState(code) {
  const game = getGame(code)
  if (!game || game.stateHistory.length === 0) return null
  const previous = game.stateHistory.pop()
  game.stateVersion = (game.stateVersion ?? 0) + 1
  game.gameState = { ...previous, stateVersion: game.stateVersion }
  return game.gameState
}

// Cleanup old games periodically
setInterval(() => {
  const now = Date.now()
  for (const [code, game] of games.entries()) {
    if (now - game.createdAt > CLEANUP_INTERVAL) {
      if (game.rematchTimer) clearTimeout(game.rematchTimer)
      games.delete(code)
    }
  }
}, CLEANUP_INTERVAL).unref?.()

module.exports = {
  createGame,
  getGame,
  joinGame,
  disconnectSocket,
  connectedCount,
  commitState,
  submitIntent,
  restorePreviousState,
}
