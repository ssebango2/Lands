'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { createRematchState, reduceRematch, REMATCH_TIMEOUT_MS } = require('../lib/rematch')

const over = { gameOver: true, bothConnected: true, matchId: 1, now: 1000 }

function requested(by = 1) {
  const result = reduceRematch(createRematchState(), { type: 'request', playerId: by }, over)
  assert.equal(result.changed, true)
  return result.rematch
}

describe('rematch state machine', () => {
  it('request -> accept starts exactly one match', () => {
    const rm = requested(1)
    assert.equal(rm.status, 'requested')
    assert.equal(rm.requestedBy, 1)
    assert.equal(rm.expiresAt, 1000 + REMATCH_TIMEOUT_MS)

    const accepted = reduceRematch(rm, { type: 'accept', playerId: 2, requestId: rm.requestId }, over)
    assert.equal(accepted.startMatch, true)
    assert.equal(accepted.rematch.status, 'idle')

    // The same accept delivered twice (or after the new match started) does nothing.
    const replay = reduceRematch(accepted.rematch, { type: 'accept', playerId: 2, requestId: rm.requestId }, over)
    assert.equal(replay.startMatch, false)
    assert.ok(replay.error)
    const afterReset = reduceRematch(accepted.rematch, { type: 'accept', playerId: 2, requestId: rm.requestId }, { ...over, gameOver: false, matchId: 2 })
    assert.equal(afterReset.startMatch, false)
  })

  it('does not start without both players agreeing', () => {
    const rm = requested(1)
    const self = reduceRematch(rm, { type: 'accept', playerId: 1, requestId: rm.requestId }, over)
    assert.equal(self.startMatch, false)
    assert.ok(self.error)
  })

  it('duplicate requests from the requester are idempotent', () => {
    const rm = requested(1)
    const again = reduceRematch(rm, { type: 'request', playerId: 1 }, over)
    assert.equal(again.changed, false)
    assert.equal(again.startMatch, false)
    assert.equal(again.rematch, rm)
  })

  it('crossing requests count as mutual agreement', () => {
    const rm = requested(1)
    const both = reduceRematch(rm, { type: 'request', playerId: 2 }, over)
    assert.equal(both.startMatch, true)
  })

  it('decline, cancel, disconnect and timeout end the request without a match', () => {
    const rm = requested(1)
    const cases = [
      [{ type: 'decline', playerId: 2, requestId: rm.requestId }, 'declined'],
      [{ type: 'cancel', playerId: 1, requestId: rm.requestId }, 'cancelled'],
      [{ type: 'disconnect', playerId: 2 }, 'disconnected'],
      [{ type: 'timeout', requestId: rm.requestId }, 'expired'],
    ]
    for (const [event, outcome] of cases) {
      const result = reduceRematch(rm, event, over)
      assert.equal(result.startMatch, false, event.type)
      assert.equal(result.rematch.status, 'idle', event.type)
      assert.equal(result.rematch.outcome, outcome, event.type)
    }
  })

  it('only the requester can cancel and only the opponent can decline', () => {
    const rm = requested(1)
    assert.ok(reduceRematch(rm, { type: 'cancel', playerId: 2, requestId: rm.requestId }, over).error)
    assert.ok(reduceRematch(rm, { type: 'decline', playerId: 1, requestId: rm.requestId }, over).error)
  })

  it('ignores responses aimed at an older request', () => {
    const first = requested(1)
    const cancelled = reduceRematch(first, { type: 'cancel', playerId: 1, requestId: first.requestId }, over).rematch
    const second = reduceRematch(cancelled, { type: 'request', playerId: 1 }, over).rematch
    assert.notEqual(second.requestId, first.requestId)

    const staleAccept = reduceRematch(second, { type: 'accept', playerId: 2, requestId: first.requestId }, over)
    assert.equal(staleAccept.startMatch, false)
    const staleTimeout = reduceRematch(second, { type: 'timeout', requestId: first.requestId }, over)
    assert.equal(staleTimeout.changed, false)
    assert.equal(staleTimeout.rematch.status, 'requested')
  })

  it("starts with the requester's options, relative to the requester", () => {
    const options = { goFirst: false, handLimit: true }
    const rm = reduceRematch(createRematchState(), { type: 'request', playerId: 2, options }, over).rematch
    assert.deepEqual(rm.options, options, 'opponent can see the options before accepting')

    const accepted = reduceRematch(rm, { type: 'accept', playerId: 1, requestId: rm.requestId }, over)
    assert.equal(accepted.startMatch, true)
    assert.deepEqual(accepted.settings, { chooser: 2, options })
    assert.equal(accepted.rematch.options, null)

    // Crossing requests keep the first request's options.
    const crossed = reduceRematch(rm, { type: 'request', playerId: 1, options: { goFirst: true, handLimit: false } }, over)
    assert.deepEqual(crossed.settings, { chooser: 2, options })
  })

  it('ignores malformed options and clears them when a request ends', () => {
    const rm = reduceRematch(createRematchState(), { type: 'request', playerId: 1, options: { goFirst: 'nope', handLimit: 1 } }, over).rematch
    assert.deepEqual(rm.options, { goFirst: true, handLimit: false })
    const declined = reduceRematch(rm, { type: 'decline', playerId: 2, requestId: rm.requestId }, over)
    assert.equal(declined.rematch.options, null)
  })

  it('requires the game to be over and the opponent to be connected', () => {
    const during = reduceRematch(createRematchState(), { type: 'request', playerId: 1 }, { ...over, gameOver: false })
    assert.ok(during.error)
    assert.equal(during.changed, false)

    const alone = reduceRematch(createRematchState(), { type: 'request', playerId: 1 }, { ...over, bothConnected: false })
    assert.ok(alone.error)
    assert.equal(alone.rematch.status, 'idle')

    const rm = requested(1)
    const acceptAlone = reduceRematch(rm, { type: 'accept', playerId: 2, requestId: rm.requestId }, { ...over, bothConnected: false })
    assert.equal(acceptAlone.startMatch, false)
  })
})
