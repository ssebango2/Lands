'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const store = require('../lib/gameStore')
const { EFFECT_PHASES } = require('../lib/engine')
const { makeState } = require('./helpers')

function startedGame(state) {
  const code = store.createGame()
  assert.equal(store.joinGame(code, 'sock-1', 'token-1').playerId, 1)
  assert.equal(store.joinGame(code, 'sock-2', 'token-2').playerId, 2)
  store.commitState(code, state, { resetHistory: true })
  return code
}

const version = (code) => store.getGame(code).stateVersion

function mountainGame() {
  return startedGame(makeState({
    p1: { hand: ['Mountain', 'Plains'] },
    p2: { hand: ['Island', 'Mountain'], board: ['Swamp'] },
  }))
}

describe('authoritative intent gate', () => {
  it('applies a duplicated socket event only once', () => {
    const code = mountainGame()
    const v = version(code)
    const first = store.submitIntent(code, 1, { type: 'playCard', cardIndex: 0 }, v)
    const dupe = store.submitIntent(code, 1, { type: 'playCard', cardIndex: 0 }, v)
    assert.equal(first.accepted, true)
    assert.equal(dupe.accepted, false)
    assert.equal(dupe.reason, 'stale')
    assert.deepEqual(store.getGame(code).gameState.players[0].hand, ['Plains'])
  })

  it('lets only one of two racing clients advance the phase', () => {
    const code = mountainGame()
    store.submitIntent(code, 1, { type: 'playCard', cardIndex: 0 }, version(code))
    const effectId = store.getGame(code).gameState.targetedEffect.id
    store.submitIntent(code, 1, { type: 'selectTarget', targetPlayerId: 2, cardIndex: 0, effectId }, version(code))
    assert.equal(store.getGame(code).gameState.priorityHolder, 2)

    const v = version(code)
    const pass = store.submitIntent(code, 2, { type: 'pass' }, v)
    const lateCounter = store.submitIntent(code, 2, { type: 'counter' }, v)
    assert.equal(pass.accepted, true)
    assert.equal(lateCounter.accepted, false)
    assert.equal(store.getGame(code).gameState.lastEffect.outcome, 'resolved')
  })

  it('a replayed pass after resolution cannot end the next turn', () => {
    const code = mountainGame()
    store.submitIntent(code, 1, { type: 'playCard', cardIndex: 0 }, version(code))
    const effectId = store.getGame(code).gameState.targetedEffect.id
    store.submitIntent(code, 1, { type: 'selectTarget', targetPlayerId: 2, cardIndex: 0, effectId }, version(code))
    const v = version(code)
    store.submitIntent(code, 2, { type: 'pass' }, v)
    const turn = store.getGame(code).gameState.turnNumber
    const replay = store.submitIntent(code, 2, { type: 'pass' }, v)
    assert.equal(replay.accepted, false)
    assert.equal(store.getGame(code).gameState.turnNumber, turn)
    assert.equal(store.getGame(code).gameState.activePlayer, 2)
  })

  it('keeps a pending target selection across disconnect and reconnect', () => {
    const code = mountainGame()
    store.submitIntent(code, 1, { type: 'playCard', cardIndex: 0 }, version(code))

    const seat = store.disconnectSocket(code, 'sock-1')
    assert.equal(seat.playerId, 1)
    assert.equal(store.connectedCount(store.getGame(code)), 1)
    assert.equal(store.getGame(code).gameState.targetedEffect.phase, EFFECT_PHASES.AWAITING_TARGET_SELECTION)

    assert.equal(store.joinGame(code, 'sock-other', 'someone-else').success, false)
    const rejoin = store.joinGame(code, 'sock-1b', 'token-1')
    assert.equal(rejoin.success, true)
    assert.equal(rejoin.rejoined, true)
    assert.equal(rejoin.playerId, 1)

    const effectId = store.getGame(code).gameState.targetedEffect.id
    const select = store.submitIntent(code, 1, { type: 'selectTarget', targetPlayerId: 2, cardIndex: 0, effectId }, version(code))
    assert.equal(select.accepted, true)
    assert.equal(select.gameState.targetedEffect.phase, EFFECT_PHASES.AWAITING_COUNTER_DECISION)
  })

  it('rejects intents from the wrong player without bumping the version', () => {
    const code = mountainGame()
    const v = version(code)
    const result = store.submitIntent(code, 2, { type: 'playCard', cardIndex: 0 }, v)
    assert.equal(result.accepted, false)
    assert.equal(result.reason, 'invalid')
    assert.equal(version(code), v)
  })

  it('undo restores under a new version so the next intent is accepted', () => {
    const code = mountainGame()
    store.submitIntent(code, 1, { type: 'playCard', cardIndex: 0 }, version(code))
    const before = version(code)
    const restored = store.restorePreviousState(code)
    assert.equal(restored.targetedEffect, null)
    assert.equal(version(code), before + 1)
    assert.equal(store.submitIntent(code, 1, { type: 'playCard', cardIndex: 1 }, version(code)).accepted, true)
  })
})
