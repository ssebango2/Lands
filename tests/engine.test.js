'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { EFFECT_PHASES } = require('../lib/engine')
const { makeState, act, reject } = require('./helpers')

const { AWAITING_TARGET_SELECTION, AWAITING_COUNTER_DECISION, EFFECT_COMPLETE } = EFFECT_PHASES

/** P1 holds Mountain with no Islands (can't re-counter); P2 can pay Island + Mountain. */
function mountainSetup(overrides = {}) {
  return makeState({
    p1: { hand: ['Mountain', 'Plains'], board: ['Plains'] },
    p2: { hand: ['Island', 'Mountain', 'Plains'], board: ['Island', 'Swamp'] },
    ...overrides,
  })
}

/** P1 holds Forest with two cards in the graveyard; P2 can pay Island + Forest. */
function forestSetup(overrides = {}) {
  return makeState({
    p1: { hand: ['Forest'], graveyard: ['Swamp', 'Island'] },
    p2: { hand: ['Island', 'Forest', 'Plains'] },
    ...overrides,
  })
}

function playAndTarget(state, target) {
  let s = act(state, 1, { type: 'playCard', cardIndex: 0 })
  return act(s, 1, { type: 'selectTarget', effectId: s.targetedEffect.id, ...target })
}

function payCounter(state, pid) {
  return act(state, pid, { type: 'counter' })
}

describe('Mountain', () => {
  it('asks the caster for a target before the opponent can respond', () => {
    const s = act(mountainSetup(), 1, { type: 'playCard', cardIndex: 0 })
    assert.equal(s.targetedEffect.phase, AWAITING_TARGET_SELECTION)
    assert.equal(s.targetedEffect.target, null)
    assert.deepEqual(s.stack, [])
    assert.equal(s.priorityHolder, null)
    reject(s, 2, { type: 'pass' })
    reject(s, 2, { type: 'counter' })
    reject(s, 2, { type: 'selectTarget', targetPlayerId: 2, cardIndex: 0, effectId: s.targetedEffect.id })
    reject(s, 1, { type: 'playCard', cardIndex: 0 })
  })

  it('locks the target, then gives the opponent the counter decision', () => {
    let s = act(mountainSetup(), 1, { type: 'playCard', cardIndex: 0 })
    reject(s, 1, { type: 'selectTarget', targetPlayerId: 1, cardIndex: 0, effectId: s.targetedEffect.id })
    reject(s, 1, { type: 'selectTarget', targetPlayerId: 2, cardIndex: 7, effectId: s.targetedEffect.id })
    s = act(s, 1, { type: 'selectTarget', targetPlayerId: 2, cardIndex: 1, effectId: s.targetedEffect.id })

    assert.equal(s.targetedEffect.phase, AWAITING_COUNTER_DECISION)
    assert.deepEqual(s.targetedEffect.target, { playerId: 2, zone: 'board', index: 1, card: 'Swamp' })
    assert.equal(s.priorityHolder, 2)
    assert.equal(s.stack.length, 1)
    assert.equal(s.stack[0].effectId, s.targetedEffect.id)
    // A second (duplicate) selection or a retarget is refused.
    reject(s, 1, { type: 'selectTarget', targetPlayerId: 2, cardIndex: 0, effectId: s.targetedEffect.id })
  })

  it('counter accepted: Mountain goes to the graveyard and the target survives', () => {
    let s = playAndTarget(mountainSetup(), { targetPlayerId: 2, cardIndex: 1 })
    s = payCounter(s, 2)
    assert.deepEqual(s.players[1].hand, ['Plains'], 'Island + Mountain paid without a selection step')
    assert.equal(s.pendingEffect, null)
    assert.equal(s.priorityHolder, 1, 'caster still gets a re-counter window')
    s = act(s, 1, { type: 'pass' })

    assert.deepEqual(s.players[1].board, ['Island', 'Swamp'])
    assert.deepEqual(s.players[0].board, ['Plains'])
    assert.deepEqual(s.players[0].graveyard, ['Mountain'])
    assert.deepEqual(s.players[1].graveyard, ['Island', 'Mountain'])
    assert.equal(s.targetedEffect, null)
    assert.equal(s.lastEffect.phase, EFFECT_COMPLETE)
    assert.equal(s.lastEffect.outcome, 'countered')
    assert.deepEqual(s.stack, [])
    assert.equal(s.activePlayer, 2)
  })

  it('counter declined: resolves against the locked target', () => {
    let s = playAndTarget(mountainSetup(), { targetPlayerId: 2, cardIndex: 1 })
    s = act(s, 2, { type: 'pass' })

    assert.deepEqual(s.players[0].board, ['Plains', 'Mountain'])
    assert.deepEqual(s.players[1].board, ['Island'])
    assert.deepEqual(s.players[1].graveyard, ['Swamp'])
    assert.equal(s.lastEffect.outcome, 'resolved')
    assert.equal(s.lastEffect.target.card, 'Swamp')
    assert.equal(s.activePlayer, 2)
    assert.equal(s.players[1].hand.length, 4, 'next player drew for their turn')
  })

  it('auto-pass counters: resolves as soon as the target is locked', () => {
    let s = mountainSetup({ autoPass: { 2: true } })
    s = playAndTarget(s, { targetPlayerId: 2, cardIndex: 0 })

    assert.equal(s.targetedEffect, null)
    assert.deepEqual(s.players[1].board, ['Swamp'])
    assert.deepEqual(s.players[1].graveyard, ['Island'])
    assert.ok(s.log.some((line) => line.includes('auto-passes')))
  })

  it('turning auto-pass on while holding priority resolves the pending decision', () => {
    let s = playAndTarget(mountainSetup(), { targetPlayerId: 2, cardIndex: 1 })
    assert.equal(s.priorityHolder, 2)
    s = act(s, 2, { type: 'setAutoPass', enabled: true })
    assert.equal(s.lastEffect.outcome, 'resolved')
    assert.deepEqual(s.players[1].board, ['Island'])
  })

  it("no available counter: still waits on the opponent so the pass doesn't reveal their hand", () => {
    const base = mountainSetup()
    base.players[1] = { ...base.players[1], hand: ['Plains', 'Swamp'] }
    let s = playAndTarget(base, { targetPlayerId: 2, cardIndex: 1 })
    assert.equal(s.targetedEffect.phase, AWAITING_COUNTER_DECISION)
    assert.equal(s.priorityHolder, 2)
    assert.ok(!s.log.some((line) => /can't counter/.test(line)))
    reject(s, 2, { type: 'counter' })
    s = act(s, 2, { type: 'pass' })
    assert.equal(s.lastEffect.outcome, 'resolved')
    assert.deepEqual(s.players[1].graveyard, ['Swamp'])
  })

  it('no valid target: skips selection and still offers the counter window', () => {
    const base = mountainSetup()
    base.players[1] = { ...base.players[1], board: [] }
    let s = act(base, 1, { type: 'playCard', cardIndex: 0 })
    assert.equal(s.targetedEffect.phase, AWAITING_COUNTER_DECISION)
    assert.equal(s.targetedEffect.target, null)
    assert.equal(s.priorityHolder, 2)
    reject(s, 1, { type: 'selectTarget', targetPlayerId: 2, cardIndex: 0, effectId: s.targetedEffect.id })

    s = act(s, 2, { type: 'pass' })
    assert.deepEqual(s.players[0].board, ['Plains', 'Mountain'])
    assert.equal(s.lastEffect.outcome, 'no-target')
  })

  it('caster cannot retarget during a counter war; a re-counter resolves on the original target', () => {
    const base = mountainSetup()
    base.players[0] = { ...base.players[0], hand: ['Mountain', 'Island', 'Island'] }
    let s = playAndTarget(base, { targetPlayerId: 2, cardIndex: 1 })
    s = payCounter(s, 2)
    assert.equal(s.priorityHolder, 1)
    reject(s, 1, { type: 'selectTarget', targetPlayerId: 2, cardIndex: 0, effectId: s.targetedEffect.id })

    s = payCounter(s, 1) // two Islands -> counter count 2
    s = act(s, 2, { type: 'pass' })
    assert.equal(s.lastEffect.outcome, 'resolved')
    assert.deepEqual(s.players[1].board, ['Island'])
    assert.deepEqual(s.players[1].graveyard, ['Island', 'Mountain', 'Swamp'])
  })

  it('rejects a selection carrying a stale effect id', () => {
    const s = act(mountainSetup(), 1, { type: 'playCard', cardIndex: 0 })
    reject(s, 1, { type: 'selectTarget', targetPlayerId: 2, cardIndex: 0, effectId: s.targetedEffect.id + 1 })
  })

  it('rejects a replayed counter response after the effect completed', () => {
    let s = playAndTarget(mountainSetup(), { targetPlayerId: 2, cardIndex: 1 })
    s = act(s, 2, { type: 'pass' })
    reject(s, 2, { type: 'counter' })
    reject(s, 1, { type: 'selectTarget', targetPlayerId: 2, cardIndex: 0, effectId: s.lastEffect.id })
  })
})

describe('Forest', () => {
  it('asks for a graveyard target before the opponent can respond', () => {
    let s = act(forestSetup(), 1, { type: 'playCard', cardIndex: 0 })
    assert.equal(s.targetedEffect.phase, AWAITING_TARGET_SELECTION)
    assert.equal(s.priorityHolder, null)
    reject(s, 2, { type: 'pass' })
    reject(s, 1, { type: 'selectTarget', targetPlayerId: 2, cardIndex: 0, effectId: s.targetedEffect.id })

    s = act(s, 1, { type: 'selectTarget', targetPlayerId: 1, cardIndex: 0, effectId: s.targetedEffect.id })
    assert.equal(s.targetedEffect.phase, AWAITING_COUNTER_DECISION)
    assert.deepEqual(s.targetedEffect.target, { playerId: 1, zone: 'graveyard', index: 0, card: 'Swamp' })
    assert.equal(s.priorityHolder, 2)
  })

  it('counter accepted: nothing returns and Forest joins the graveyard', () => {
    let s = playAndTarget(forestSetup(), { targetPlayerId: 1, cardIndex: 0 })
    s = payCounter(s, 2)
    s = act(s, 1, { type: 'pass' })
    assert.deepEqual(s.players[0].hand, [])
    assert.deepEqual(s.players[0].graveyard, ['Swamp', 'Island', 'Forest'])
    assert.deepEqual(s.players[0].board, [])
    assert.equal(s.lastEffect.outcome, 'countered')
  })

  it('counter declined: returns the locked card', () => {
    let s = playAndTarget(forestSetup(), { targetPlayerId: 1, cardIndex: 0 })
    s = act(s, 2, { type: 'pass' })
    assert.deepEqual(s.players[0].hand, ['Swamp'])
    assert.deepEqual(s.players[0].graveyard, ['Island'])
    assert.deepEqual(s.players[0].board, ['Forest'])
    assert.equal(s.lastEffect.outcome, 'resolved')
    assert.equal(s.lastEffect.returnedIndex, 0)
  })

  it('auto-pass counters: resolves immediately after the target is locked', () => {
    const s = playAndTarget(forestSetup({ autoPass: { 2: true } }), { targetPlayerId: 1, cardIndex: 1 })
    assert.deepEqual(s.players[0].hand, ['Island'])
    assert.equal(s.targetedEffect, null)
  })

  it('no available counter: the prompt still opens and the opponent must pass', () => {
    const base = forestSetup()
    base.players[1] = { ...base.players[1], hand: ['Plains'] }
    let s = playAndTarget(base, { targetPlayerId: 1, cardIndex: 1 })
    assert.equal(s.priorityHolder, 2)
    assert.deepEqual(s.players[0].hand, [])
    s = act(s, 2, { type: 'pass' })
    assert.deepEqual(s.players[0].hand, ['Island'])
  })

  it('no valid target: empty graveyard goes straight to the counter window', () => {
    const base = forestSetup()
    base.players[0] = { ...base.players[0], graveyard: [] }
    let s = act(base, 1, { type: 'playCard', cardIndex: 0 })
    assert.equal(s.targetedEffect.phase, AWAITING_COUNTER_DECISION)
    assert.equal(s.targetedEffect.target, null)
    s = act(s, 2, { type: 'pass' })
    assert.deepEqual(s.players[0].board, ['Forest'])
    assert.equal(s.lastEffect.outcome, 'no-target')
  })

  it("counter costs paid into the caster's graveyard don't shift the locked target", () => {
    const base = forestSetup()
    base.players[0] = { ...base.players[0], hand: ['Forest', 'Island', 'Island'] }
    let s = playAndTarget(base, { targetPlayerId: 1, cardIndex: 1 }) // the Island in the graveyard
    s = payCounter(s, 2)
    s = payCounter(s, 1)
    s = act(s, 2, { type: 'pass' })
    assert.equal(s.lastEffect.outcome, 'resolved')
    assert.deepEqual(s.players[0].hand, ['Island'])
    assert.deepEqual(s.players[0].graveyard, ['Swamp', 'Island', 'Island'])
  })
})

describe('other lands keep the play-then-counter order', () => {
  it('Plains goes on the stack immediately and draws on resolution', () => {
    let s = makeState({ p1: { hand: ['Plains'] }, p2: { hand: ['Island', 'Plains'] } })
    s = act(s, 1, { type: 'playCard', cardIndex: 0 })
    assert.equal(s.targetedEffect, null)
    assert.equal(s.stack.length, 1)
    assert.equal(s.priorityHolder, 2)
    s = act(s, 2, { type: 'pass' })
    assert.deepEqual(s.players[0].board, ['Plains'])
    assert.equal(s.players[0].hand.length, 1)
  })

  it('Island reveals and waits for the discard / put-back decision', () => {
    let s = makeState({ p1: { hand: ['Island'], deck: ['Swamp', 'Forest'] }, p2: { hand: ['Plains'] } })
    s = act(s, 1, { type: 'playCard', cardIndex: 0 })
    s = act(s, 2, { type: 'pass' })
    assert.deepEqual(s.pendingEffect, { type: 'island', activePlayer: 1, revealedCard: 'Forest' })
    reject(s, 1, { type: 'endTurn' })
    s = act(s, 1, { type: 'islandChoice', choice: 'discard' })
    assert.deepEqual(s.players[0].graveyard, ['Forest'])
    assert.equal(s.activePlayer, 2)
  })
})
