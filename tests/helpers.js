'use strict'

const assert = require('node:assert/strict')
const { createMatchState, applyIntent } = require('../lib/engine')

const filler = (n, card = 'Plains') => Array.from({ length: n }, () => card)

/** A mid-game state with explicit zones; unspecified zones get harmless defaults. */
function makeState({ p1 = {}, p2 = {}, activePlayer = 1, autoPass, rules } = {}) {
  const base = createMatchState({ decks: [filler(20), filler(20)], autoPass, rules })
  const player = (spec) => ({
    deck: spec.deck ?? filler(10),
    hand: spec.hand ?? [],
    board: spec.board ?? [],
    graveyard: spec.graveyard ?? [],
  })
  return { ...base, players: [player(p1), player(p2)], activePlayer, turnNumber: 5, log: [] }
}

/** Apply an intent that must succeed. */
function act(state, playerId, intent) {
  const result = applyIntent(state, playerId, intent)
  assert.equal(result.error, undefined, `expected ${intent.type} by P${playerId} to succeed, got: ${result.error}`)
  return result.state
}

/** Apply an intent that must be rejected; returns the error. */
function reject(state, playerId, intent) {
  const result = applyIntent(state, playerId, intent)
  assert.ok(result.error, `expected ${intent.type} by P${playerId} to be rejected`)
  assert.equal(result.state, undefined)
  return result.error
}

module.exports = { makeState, act, reject, filler }
