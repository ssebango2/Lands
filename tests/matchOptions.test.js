'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { MAX_HAND_SIZE } = require('../lib/engine')
const { normalizeMatchOptions, startingPlayerFor } = require('../lib/matchOptions')
const { createGame, getGame } = require('../lib/gameStore')
const { makeState, act, reject, filler } = require('./helpers')

describe('match options', () => {
  it('"go first" is relative to whoever chose the options', () => {
    assert.equal(startingPlayerFor({ goFirst: true }, 1), 1)
    assert.equal(startingPlayerFor({ goFirst: false }, 1), 2)
    assert.equal(startingPlayerFor({ goFirst: true }, 2), 2)
    assert.equal(startingPlayerFor({ goFirst: false }, 2), 1)
  })

  it('defaults to going first with no hand limit', () => {
    assert.deepEqual(normalizeMatchOptions(undefined), { goFirst: true, handLimit: false })
    assert.deepEqual(normalizeMatchOptions({ goFirst: false, handLimit: true }), { goFirst: false, handLimit: true })
  })

  it('stores the creator options and token on the game', () => {
    const code = createGame({ options: { goFirst: false, handLimit: true }, creatorToken: 'creator' })
    const game = getGame(code)
    assert.deepEqual(game.options, { goFirst: false, handLimit: true })
    assert.equal(game.creatorToken, 'creator')
  })
})

describe(`${MAX_HAND_SIZE}-card hand limit`, () => {
  const bigHand = (n) => filler(n, 'Swamp')

  it('changes nothing when the option is off', () => {
    const s = act(makeState({ p1: { hand: bigHand(9) } }), 1, { type: 'endTurn' })
    assert.equal(s.pendingEffect, null)
    assert.equal(s.activePlayer, 2)
    assert.equal(s.players[0].hand.length, 9)
  })

  it('makes a player with 8 or more discard down to 7 before the turn passes', () => {
    let s = act(makeState({ p1: { hand: bigHand(9) }, rules: { handLimit: true } }), 1, { type: 'endTurn' })
    assert.deepEqual(s.pendingEffect, { type: 'handLimit', playerId: 1, discardCount: 2 })
    assert.equal(s.activePlayer, 1, 'turn has not passed yet')

    reject(s, 2, { type: 'handLimitDiscard', cardIndex: 0 })
    reject(s, 1, { type: 'playCard', cardIndex: 0 })
    reject(s, 1, { type: 'endTurn' })
    reject(s, 1, { type: 'handLimitDiscard', cardIndex: 99 })

    s = act(s, 1, { type: 'handLimitDiscard', cardIndex: 0 })
    assert.equal(s.pendingEffect.discardCount, 1)
    s = act(s, 1, { type: 'handLimitDiscard', cardIndex: 0 })

    assert.equal(s.pendingEffect, null)
    assert.equal(s.players[0].hand.length, MAX_HAND_SIZE)
    assert.deepEqual(s.players[0].graveyard, ['Swamp', 'Swamp'])
    assert.equal(s.activePlayer, 2)
    assert.equal(s.players[1].hand.length, 1, 'next player drew for their turn')
  })

  it('exactly 7 cards needs no discard', () => {
    const s = act(makeState({ p1: { hand: bigHand(7) }, rules: { handLimit: true } }), 1, { type: 'endTurn' })
    assert.equal(s.pendingEffect, null)
    assert.equal(s.activePlayer, 2)
  })

  it('applies after a spell resolves, e.g. Plains drawing to 8', () => {
    let s = makeState({ p1: { hand: ['Plains', ...bigHand(7)] }, rules: { handLimit: true } })
    s = act(s, 1, { type: 'playCard', cardIndex: 0 })
    s = act(s, 2, { type: 'pass' })
    assert.deepEqual(s.pendingEffect, { type: 'handLimit', playerId: 1, discardCount: 1 })
    s = act(s, 1, { type: 'handLimitDiscard', cardIndex: 7 })
    assert.equal(s.activePlayer, 2)
  })

  it('also checks the other player, after the active player', () => {
    let s = act(makeState({ p1: { hand: bigHand(8) }, p2: { hand: bigHand(8) }, rules: { handLimit: true } }), 1, { type: 'endTurn' })
    assert.equal(s.pendingEffect.playerId, 1)
    s = act(s, 1, { type: 'handLimitDiscard', cardIndex: 0 })
    assert.equal(s.pendingEffect.playerId, 2)
    s = act(s, 2, { type: 'handLimitDiscard', cardIndex: 0 })
    assert.equal(s.pendingEffect, null)
    assert.equal(s.activePlayer, 2)
  })

  it('a winning player is not asked to discard', () => {
    let s = makeState({
      p1: { hand: ['Forest', ...bigHand(8)], board: ['Plains', 'Island', 'Swamp', 'Mountain'] },
      rules: { handLimit: true },
    })
    s = act(s, 1, { type: 'playCard', cardIndex: 0 })
    s = act(s, 2, { type: 'pass' })
    assert.equal(s.winner, 1)
    assert.equal(s.pendingEffect, null)
  })
})
