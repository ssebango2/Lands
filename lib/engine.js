'use strict'

/**
 * Authoritative rules for online play. Pure functions only: the socket server
 * owns the single copy of state and runs every player intent through
 * `applyIntent`, so both clients always render the same result.
 */

const { createDeck, shuffleDeck, drawCards } = require('./gameLogic')

const EFFECT_PHASES = Object.freeze({
  AWAITING_TARGET_SELECTION: 'AWAITING_TARGET_SELECTION',
  AWAITING_COUNTER_DECISION: 'AWAITING_COUNTER_DECISION',
  RESOLVING_EFFECT: 'RESOLVING_EFFECT',
  EFFECT_COMPLETE: 'EFFECT_COMPLETE',
})

const LAND_TYPES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']
const TARGETED_SPELLS = ['Mountain', 'Forest']
const OPENING_HAND_SIZE = 4
const MAX_HAND_SIZE = 7
const LOG_LIMIT = 200

const other = (id) => (id === 1 ? 2 : 1)

function createMatchState({ startingPlayer = 1, matchId = 1, autoPass, decks, rules } = {}) {
  const players = [1, 2].map((id) => {
    const deck = decks ? [...decks[id - 1]] : shuffleDeck(createDeck())
    const [remaining, hand] = drawCards(deck, OPENING_HAND_SIZE)
    return { deck: remaining, hand, board: [], graveyard: [] }
  })
  return {
    matchId,
    startingPlayer,
    players,
    activePlayer: startingPlayer,
    turnNumber: 1,
    stack: [],
    priorityHolder: null,
    pendingEffect: null,
    targetedEffect: null,
    lastEffect: null,
    nextEffectId: 1,
    winner: null,
    winReason: null,
    autoPass: { 1: !!autoPass?.[1], 2: !!autoPass?.[2] },
    rules: { handLimit: rules?.handLimit === true },
    log: [
      `Match ${matchId} started. Player ${startingPlayer} goes first.`,
      ...(rules?.handLimit ? [`${MAX_HAND_SIZE}-card hand limit is on.`] : []),
    ],
  }
}

// --- helpers ---------------------------------------------------------------

function withPlayer(state, id, patch) {
  const players = state.players.slice()
  players[id - 1] = { ...players[id - 1], ...patch }
  return { ...state, players }
}

function addLog(state, ...messages) {
  return { ...state, log: [...(state.log || []), ...messages].slice(-LOG_LIMIT) }
}

function getWinReason(player) {
  if (LAND_TYPES.every((type) => player.board.includes(type))) return 'Domain (1 of each basic land type)'
  for (const type of LAND_TYPES) {
    if (player.board.filter((c) => c === type).length >= 5) return `5 ${type}s`
  }
  return null
}

/** First counter: 1 Island + 1 of the spell's type (2 Islands vs. Island). Re-counters: 2 Islands. */
function canPayCounterCost(player, spell, counterCount) {
  const islands = player.hand.filter((c) => c === 'Island').length
  if (counterCount === 0 && spell !== 'Island') {
    return islands >= 1 && player.hand.includes(spell)
  }
  return islands >= 2
}

/** The cost is fixed by the spell and counter depth, so the engine pays it without a selection step. */
function counterCostCards(spell, counterCount) {
  return counterCount === 0 && spell !== 'Island' ? ['Island', spell] : ['Island', 'Island']
}

function hasPendingWork(state) {
  return (state.stack || []).length > 0 || !!state.pendingEffect || !!state.targetedEffect
}

/** Indices a targeted spell may choose from when it is played. */
function validTargets(state, spell, controller) {
  if (spell === 'Mountain') {
    return { playerId: other(controller), zone: 'board', indices: state.players[other(controller) - 1].board.map((_, i) => i) }
  }
  if (spell === 'Forest') {
    return { playerId: controller, zone: 'graveyard', indices: state.players[controller - 1].graveyard.map((_, i) => i) }
  }
  return null
}

// --- turn flow -------------------------------------------------------------

function advanceTurn(state) {
  const next = other(state.activePlayer)
  let s = { ...state, activePlayer: next, turnNumber: state.turnNumber + 1, stack: [], priorityHolder: null }
  const p = s.players[next - 1]
  if (p.deck.length > 0) {
    const [deck, drawn] = drawCards(p.deck, 1)
    s = withPlayer(s, next, { deck, hand: [...p.hand, drawn[0]] })
  }
  return addLog(s, `Player ${next}'s turn`)
}

/**
 * The active player's action is done: check their win, then (with the hand
 * limit on) make anyone over the limit discard, then pass the turn.
 */
function finishTurn(state) {
  const ap = state.activePlayer
  const reason = getWinReason(state.players[ap - 1])
  if (reason) {
    return addLog({ ...state, winner: ap, winReason: reason, stack: [], priorityHolder: null }, `Player ${ap} wins! (${reason})`)
  }
  if (state.rules?.handLimit) {
    const over = [ap, other(ap)].find((id) => state.players[id - 1].hand.length > MAX_HAND_SIZE)
    if (over) {
      const discardCount = state.players[over - 1].hand.length - MAX_HAND_SIZE
      const pendingEffect = { type: 'handLimit', playerId: over, discardCount }
      return addLog(
        { ...state, stack: [], priorityHolder: null, pendingEffect },
        `Player ${over} is over the hand limit and must discard ${discardCount} card${discardCount === 1 ? '' : 's'}`
      )
    }
  }
  return advanceTurn(state)
}

/**
 * Hand priority to `pid`. Only the player's own auto-pass setting skips the
 * window: passing automatically because the hand can't pay would tell the
 * opponent what that hand holds.
 */
function givePriority(state, pid) {
  const s = { ...state, priorityHolder: pid }
  if (s.autoPass?.[pid]) {
    return resolveTop(addLog(s, `Player ${pid} auto-passes`))
  }
  return s
}

function applyTargetedEffect(state, effect) {
  const { target, spell, controller } = effect
  if (!target) {
    return { state: addLog(state, `${spell} resolves with no target`), outcome: 'no-target' }
  }
  const owner = state.players[target.playerId - 1]
  const zone = owner[target.zone]
  // Identical lands are interchangeable; fall back to another copy if indices shifted.
  let index = zone[target.index] === target.card ? target.index : zone.lastIndexOf(target.card)
  if (index < 0) {
    return { state: addLog(state, `${spell}'s target is gone, so it does nothing`), outcome: 'fizzled' }
  }
  if (spell === 'Mountain') {
    const board = zone.filter((_, i) => i !== index)
    const s = withPlayer(state, target.playerId, { board, graveyard: [...owner.graveyard, target.card] })
    return { state: addLog(s, `Mountain destroys Player ${target.playerId}'s ${target.card}`), outcome: 'resolved' }
  }
  const graveyard = zone.filter((_, i) => i !== index)
  const hand = [...owner.hand, target.card]
  const s = withPlayer(state, controller, { graveyard, hand })
  return { state: addLog(s, `Forest returns ${target.card} to Player ${controller}'s hand`), outcome: 'resolved', returnedIndex: hand.length - 1 }
}

/** Resolve the top of the stack: even counter count resolves, odd is countered. */
function resolveTop(state) {
  const stack = state.stack || []
  const top = stack[stack.length - 1]
  const rest = stack.slice(0, -1)
  let s = { ...state, stack: rest, priorityHolder: rest.length > 0 ? state.priorityHolder : null }
  const { spell, controller } = top
  const effect = top.effectId != null && s.targetedEffect?.id === top.effectId ? s.targetedEffect : null
  const player = s.players[controller - 1]

  if (top.counterCount % 2 === 1) {
    s = withPlayer(s, controller, { graveyard: [...player.graveyard, spell] })
    s = addLog(s, `${spell} was countered and put into the graveyard`)
    if (effect) {
      s = { ...s, targetedEffect: null, lastEffect: { ...effect, phase: EFFECT_PHASES.EFFECT_COMPLETE, outcome: 'countered' } }
    }
    return finishTurn(s)
  }

  s = withPlayer(s, controller, { board: [...player.board, spell] })
  s = addLog(s, `${spell} resolves`)

  if (effect) {
    s = { ...s, targetedEffect: { ...effect, phase: EFFECT_PHASES.RESOLVING_EFFECT } }
    const result = applyTargetedEffect(s, effect)
    s = {
      ...result.state,
      targetedEffect: null,
      lastEffect: {
        ...effect,
        phase: EFFECT_PHASES.EFFECT_COMPLETE,
        outcome: result.outcome,
        ...(result.returnedIndex != null ? { returnedIndex: result.returnedIndex } : {}),
      },
    }
    return finishTurn(s)
  }

  const p = s.players[controller - 1]
  const opp = other(controller)
  let pendingEffect = null
  if (spell === 'Plains' && p.deck.length > 0) {
    const [deck, drawn] = drawCards(p.deck, 1)
    s = addLog(withPlayer(s, controller, { deck, hand: [...p.hand, drawn[0]] }), `Player ${controller} draws a card from Plains`)
  } else if (spell === 'Swamp') {
    const oppHand = s.players[opp - 1].hand
    if (oppHand.length > 0 && oppHand.length <= 3) {
      pendingEffect = { type: 'swamp', activePlayer: controller, phase: 'discard', revealedCards: oppHand.map((_, i) => i) }
      s = addLog(s, `Player ${opp}'s whole hand is revealed. Player ${controller} chooses a discard`)
    } else if (oppHand.length > 3) {
      pendingEffect = { type: 'swamp', activePlayer: controller, phase: 'reveal', revealedCards: [] }
      s = addLog(s, `Player ${opp} must reveal 3 cards`)
    }
  } else if (spell === 'Island' && p.deck.length > 0) {
    const [deck, drawn] = drawCards(p.deck, 1)
    s = withPlayer(s, controller, { deck })
    pendingEffect = { type: 'island', activePlayer: controller, revealedCard: drawn[0] }
    s = addLog(s, `Player ${controller} reveals the top card of their deck`)
  }

  s = { ...s, pendingEffect }
  return pendingEffect ? s : finishTurn(s)
}

// --- intents ---------------------------------------------------------------

const fail = (error) => ({ error })

function playCard(state, pid, { cardIndex }) {
  if (state.activePlayer !== pid) return fail('It is not your turn')
  if (hasPendingWork(state)) return fail('Resolve the current effect first')
  const player = state.players[pid - 1]
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= player.hand.length) return fail('Invalid card')

  const spell = player.hand[cardIndex]
  let s = withPlayer(state, pid, { hand: player.hand.filter((_, i) => i !== cardIndex) })

  if (TARGETED_SPELLS.includes(spell)) {
    const id = s.nextEffectId || 1
    const targets = validTargets(s, spell, pid)
    s = { ...s, nextEffectId: id + 1 }
    if (targets.indices.length > 0) {
      s = { ...s, targetedEffect: { id, spell, controller: pid, phase: EFFECT_PHASES.AWAITING_TARGET_SELECTION, target: null } }
      return { state: addLog(s, `Player ${pid} plays ${spell} and is choosing a target`) }
    }
    s = {
      ...s,
      targetedEffect: { id, spell, controller: pid, phase: EFFECT_PHASES.AWAITING_COUNTER_DECISION, target: null },
      stack: [{ spell, controller: pid, counterCount: 0, effectId: id }],
    }
    s = addLog(s, `Player ${pid} plays ${spell} (no valid target)`)
    return { state: givePriority(s, other(pid)) }
  }

  s = { ...s, stack: [...(s.stack || []), { spell, controller: pid, counterCount: 0 }] }
  s = addLog(s, `Player ${pid} plays ${spell}`)
  return { state: givePriority(s, other(pid)) }
}

function selectTarget(state, pid, { targetPlayerId, cardIndex, effectId }) {
  const effect = state.targetedEffect
  if (!effect || effect.phase !== EFFECT_PHASES.AWAITING_TARGET_SELECTION) return fail('No target is being chosen')
  if (effectId != null && effectId !== effect.id) return fail('That effect has already moved on')
  if (effect.controller !== pid) return fail('Only the player who cast it chooses the target')

  const targets = validTargets(state, effect.spell, pid)
  if (targetPlayerId !== targets.playerId || !targets.indices.includes(cardIndex)) return fail('Invalid target')

  const card = state.players[targetPlayerId - 1][targets.zone][cardIndex]
  const target = { playerId: targetPlayerId, zone: targets.zone, index: cardIndex, card }
  let s = {
    ...state,
    targetedEffect: { ...effect, phase: EFFECT_PHASES.AWAITING_COUNTER_DECISION, target },
    stack: [...(state.stack || []), { spell: effect.spell, controller: pid, counterCount: 0, effectId: effect.id }],
  }
  const where = targets.zone === 'board' ? `Player ${targetPlayerId}'s ${card}` : `${card} in their graveyard`
  s = addLog(s, `Player ${pid}'s ${effect.spell} targets ${where}`)
  return { state: givePriority(s, other(pid)) }
}

function pass(state, pid) {
  const stack = state.stack || []
  if (stack.length === 0) {
    if (state.activePlayer !== pid) return fail('It is not your turn')
    if (hasPendingWork(state)) return fail('Resolve the current effect first')
    return { state: finishTurn(addLog(state, `Player ${pid} passes the turn`)) }
  }
  if (state.priorityHolder !== pid) return fail('You do not have priority')
  if (state.pendingEffect) return fail('Resolve the current effect first')
  return { state: resolveTop(addLog(state, `Player ${pid} passes`)) }
}

function counter(state, pid) {
  const stack = state.stack || []
  if (stack.length === 0 || state.priorityHolder !== pid) return fail('You do not have priority')
  if (state.pendingEffect) return fail('Resolve the current effect first')
  const top = stack[stack.length - 1]
  const player = state.players[pid - 1]
  if (!canPayCounterCost(player, top.spell, top.counterCount)) return fail('You cannot pay the counter cost')

  const cards = counterCostCards(top.spell, top.counterCount)
  const hand = player.hand.slice()
  for (const card of cards) hand.splice(hand.indexOf(card), 1)
  let s = withPlayer(state, pid, { hand, graveyard: [...player.graveyard, ...cards] })
  const nextStack = s.stack.slice()
  nextStack[nextStack.length - 1] = { ...top, counterCount: top.counterCount + 1 }
  s = addLog({ ...s, stack: nextStack }, `Player ${pid} counters with ${cards.join(' + ')}`)
  return { state: givePriority(s, other(pid)) }
}

function swampReveal(state, pid, { cardIndex }) {
  const pe = state.pendingEffect
  if (pe?.type !== 'swamp' || pe.phase !== 'reveal') return fail('Nothing to reveal')
  if (pid !== other(pe.activePlayer)) return fail('Only the opponent reveals cards')
  const hand = state.players[pid - 1].hand
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= hand.length) return fail('Invalid card')
  let revealedCards
  if (pe.revealedCards.includes(cardIndex)) revealedCards = pe.revealedCards.filter((i) => i !== cardIndex)
  else if (pe.revealedCards.length < 3) revealedCards = [...pe.revealedCards, cardIndex]
  else return fail('Three cards are already revealed')
  const phase = revealedCards.length === 3 ? 'discard' : 'reveal'
  let s = { ...state, pendingEffect: { ...pe, phase, revealedCards } }
  if (phase === 'discard') s = addLog(s, `Player ${pid} revealed 3 cards. Player ${pe.activePlayer} chooses a discard`)
  return { state: s }
}

function swampDiscard(state, pid, { cardIndex }) {
  const pe = state.pendingEffect
  if (pe?.type !== 'swamp' || pe.phase !== 'discard') return fail('Nothing to discard')
  if (pid !== pe.activePlayer) return fail('Only the Swamp player chooses')
  if (!pe.revealedCards.includes(cardIndex)) return fail('Choose one of the revealed cards')
  const victim = other(pid)
  const vp = state.players[victim - 1]
  const card = vp.hand[cardIndex]
  let s = withPlayer(state, victim, { hand: vp.hand.filter((_, i) => i !== cardIndex), graveyard: [...vp.graveyard, card] })
  s = addLog({ ...s, pendingEffect: null }, `Player ${pid} discards Player ${victim}'s ${card}`)
  return { state: finishTurn(s) }
}

function islandChoice(state, pid, { choice }) {
  const pe = state.pendingEffect
  if (pe?.type !== 'island' || pe.activePlayer !== pid) return fail('No Island decision pending')
  if (choice !== 'discard' && choice !== 'putBack') return fail('Invalid choice')
  const player = state.players[pid - 1]
  let s
  if (choice === 'discard') {
    s = addLog(withPlayer(state, pid, { graveyard: [...player.graveyard, pe.revealedCard] }), `Player ${pid} discards the revealed ${pe.revealedCard}`)
  } else {
    // drawCards pops from the end, so the top of the deck is the last element.
    s = addLog(withPlayer(state, pid, { deck: [...player.deck, pe.revealedCard] }), `Player ${pid} puts the revealed card back on top`)
  }
  return { state: finishTurn({ ...s, pendingEffect: null }) }
}

function handLimitDiscard(state, pid, { cardIndex }) {
  const pe = state.pendingEffect
  if (pe?.type !== 'handLimit') return fail('No discard is required')
  if (pe.playerId !== pid) return fail('Your opponent is discarding down to the hand limit')
  const player = state.players[pid - 1]
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= player.hand.length) return fail('Invalid card')

  const card = player.hand[cardIndex]
  let s = withPlayer(state, pid, {
    hand: player.hand.filter((_, i) => i !== cardIndex),
    graveyard: [...player.graveyard, card],
  })
  s = addLog(s, `Player ${pid} discards ${card} (hand limit)`)
  const remaining = s.players[pid - 1].hand.length - MAX_HAND_SIZE
  if (remaining > 0) return { state: { ...s, pendingEffect: { ...pe, discardCount: remaining } } }
  return { state: finishTurn({ ...s, pendingEffect: null }) }
}

function endTurn(state, pid) {
  if (state.activePlayer !== pid) return fail('It is not your turn')
  if (hasPendingWork(state)) return fail('Resolve the current effect first')
  return { state: finishTurn(state) }
}

function setAutoPass(state, pid, { enabled }) {
  let s = { ...state, autoPass: { ...(state.autoPass || {}), [pid]: !!enabled } }
  const stack = s.stack || []
  if (enabled && stack.length > 0 && s.priorityHolder === pid && !s.pendingEffect) {
    s = resolveTop(addLog(s, `Player ${pid} auto-passes`))
  }
  return { state: s }
}

const HANDLERS = {
  playCard,
  selectTarget,
  pass,
  counter,
  swampReveal,
  swampDiscard,
  islandChoice,
  handLimitDiscard,
  endTurn,
  setAutoPass,
}

/** Returns `{ state }` on success or `{ error }` without touching the input state. */
function applyIntent(state, playerId, intent) {
  if (!state) return fail('Game has not started')
  if (playerId !== 1 && playerId !== 2) return fail('Unknown player')
  const handler = intent && HANDLERS[intent.type]
  if (!handler) return fail('Unknown action')
  if (state.winner && intent.type !== 'setAutoPass') return fail('The game is over')
  return handler(state, playerId, intent)
}

module.exports = {
  EFFECT_PHASES,
  LAND_TYPES,
  MAX_HAND_SIZE,
  createMatchState,
  applyIntent,
  canPayCounterCost,
  validTargets,
  getWinReason,
}
