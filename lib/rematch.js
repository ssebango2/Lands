'use strict'

/**
 * Rematch negotiation, kept pure so the server can own timers/broadcasts and
 * tests can drive every transition. A match only restarts when the reducer
 * returns `startMatch: true`, which requires both players to have agreed.
 */

const { normalizeMatchOptions } = require('./matchOptions')

const REMATCH_TIMEOUT_MS = 60_000

function createRematchState() {
  return { status: 'idle', requestId: null, requestedBy: null, options: null, expiresAt: null, outcome: null, seq: 0 }
}

const noop = (rematch) => ({ rematch, startMatch: false, changed: false })
const reject = (rematch, error) => ({ rematch, startMatch: false, changed: false, error })
const cleared = (rm, outcome) => ({ ...rm, status: 'idle', requestId: null, requestedBy: null, options: null, expiresAt: null, outcome })

/** The accepted request's options, and the seat they are relative to. */
const startWith = (rm) => ({
  rematch: { ...createRematchState(), seq: rm.seq },
  startMatch: true,
  changed: true,
  settings: { chooser: rm.requestedBy, options: rm.options ?? normalizeMatchOptions() },
})

/**
 * @param rematch current rematch state
 * @param event { type: 'request'|'cancel'|'accept'|'decline'|'disconnect'|'timeout', playerId?, requestId?, options? }
 * @param ctx { gameOver: boolean, bothConnected: boolean, matchId: number, now?: number }
 */
function reduceRematch(rematch, event, ctx) {
  const rm = rematch || createRematchState()
  const now = ctx.now ?? Date.now()
  const pending = rm.status === 'requested'
  const matchesRequest = event.requestId == null || event.requestId === rm.requestId

  switch (event.type) {
    case 'request': {
      if (!ctx.gameOver) return reject(rm, 'The game is still in progress')
      if (pending && rm.requestedBy === event.playerId) return noop(rm)
      if (pending) {
        // Both players asked independently: that is mutual agreement, on the first request's options.
        if (!ctx.bothConnected) return reject(rm, 'Your opponent is not connected')
        return startWith(rm)
      }
      if (!ctx.bothConnected) return reject({ ...rm, outcome: 'unavailable' }, 'Your opponent is not connected')
      const seq = rm.seq + 1
      return {
        rematch: {
          status: 'requested',
          requestId: `${ctx.matchId}:${seq}`,
          requestedBy: event.playerId,
          options: normalizeMatchOptions(event.options),
          expiresAt: now + REMATCH_TIMEOUT_MS,
          outcome: null,
          seq,
        },
        startMatch: false,
        changed: true,
      }
    }
    case 'cancel': {
      if (!pending || !matchesRequest) return noop(rm)
      if (rm.requestedBy !== event.playerId) return reject(rm, 'Only the requester can cancel')
      return { rematch: cleared(rm, 'cancelled'), startMatch: false, changed: true }
    }
    case 'accept': {
      if (!pending || !matchesRequest) return reject(rm, 'That rematch request is no longer active')
      if (rm.requestedBy === event.playerId) return reject(rm, 'Waiting for your opponent to accept')
      if (!ctx.gameOver) return reject(rm, 'The game is still in progress')
      if (!ctx.bothConnected) return reject(rm, 'Your opponent is not connected')
      return startWith(rm)
    }
    case 'decline': {
      if (!pending || !matchesRequest) return noop(rm)
      if (rm.requestedBy === event.playerId) return reject(rm, 'Use cancel to withdraw your own request')
      return { rematch: cleared(rm, 'declined'), startMatch: false, changed: true }
    }
    case 'disconnect': {
      if (!pending) return noop(rm)
      return { rematch: cleared(rm, 'disconnected'), startMatch: false, changed: true }
    }
    case 'timeout': {
      if (!pending || !matchesRequest) return noop(rm)
      return { rematch: cleared(rm, 'expired'), startMatch: false, changed: true }
    }
    default:
      return reject(rm, 'Unknown rematch action')
  }
}

module.exports = { REMATCH_TIMEOUT_MS, createRematchState, reduceRematch }
