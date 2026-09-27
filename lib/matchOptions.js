'use strict'

/**
 * Options chosen when creating a game or requesting a rematch. `goFirst` is
 * relative to whoever chose them (the creator or the rematch requester).
 */
const DEFAULT_MATCH_OPTIONS = Object.freeze({ goFirst: true, handLimit: false })

function normalizeMatchOptions(raw) {
  return {
    goFirst: raw?.goFirst !== false,
    handLimit: raw?.handLimit === true,
  }
}

/** Seat that starts, given the seat of the player who chose the options. */
function startingPlayerFor(options, chooserSeat) {
  const chooser = chooserSeat === 2 ? 2 : 1
  return options.goFirst ? chooser : chooser === 1 ? 2 : 1
}

module.exports = { DEFAULT_MATCH_OPTIONS, normalizeMatchOptions, startingPlayerFor }
