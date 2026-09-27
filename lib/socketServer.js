const { Server: SocketIOServer } = require('socket.io')
const { createMatchState, applyIntent } = require('./engine')
const { reduceRematch, REMATCH_TIMEOUT_MS } = require('./rematch')
const { startingPlayerFor } = require('./matchOptions')
const {
  getGame,
  joinGame,
  disconnectSocket,
  connectedCount,
  commitState,
  submitIntent,
  restorePreviousState,
} = require('./gameStore')

function rematchPayload(game) {
  return {
    rematch: game.rematch,
    matchId: game.gameState?.matchId ?? null,
    connected: { 1: seatConnected(game, 1), 2: seatConnected(game, 2) },
  }
}

function seatConnected(game, playerId) {
  return game.players.some((p) => p.playerId === playerId && p.connected)
}

function initializeSocketServer(httpServer) {
  const io = new SocketIOServer(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? process.env.NEXT_PUBLIC_APP_URL
        : 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  })

  const broadcastState = (game, event = 'game:state') => {
    io.to(game.code).emit(event, { gameState: game.gameState })
  }
  const broadcastRematch = (game) => {
    io.to(game.code).emit('game:rematch', rematchPayload(game))
  }

  const clearRematchTimer = (game) => {
    if (game.rematchTimer) clearTimeout(game.rematchTimer)
    game.rematchTimer = null
  }

  const updateRematch = (game, event) => {
    const result = reduceRematch(game.rematch, event, {
      gameOver: !!game.gameState?.winner,
      bothConnected: connectedCount(game) === 2,
      matchId: game.gameState?.matchId ?? 1,
    })
    if (!result.changed) return result
    game.rematch = result.rematch
    clearRematchTimer(game)
    if (game.rematch.status === 'requested') {
      const { requestId } = game.rematch
      game.rematchTimer = setTimeout(() => {
        game.rematchTimer = null
        updateRematch(game, { type: 'timeout', requestId })
      }, REMATCH_TIMEOUT_MS)
    }
    if (result.startMatch) startNextMatch(game, result.settings)
    broadcastRematch(game)
    return result
  }

  const startMatch = (game, { matchId, chooser, options, autoPass }) => {
    game.options = options
    const startingPlayer = startingPlayerFor(options, chooser)
    const state = createMatchState({ matchId, startingPlayer, autoPass, rules: { handLimit: options.handLimit } })
    commitState(game.code, state, { resetHistory: true })
    broadcastState(game, 'game:start')
  }

  // Seats are kept; the rematch requester's options decide who starts and which rules apply.
  const startNextMatch = (game, settings) => {
    const previous = game.gameState
    startMatch(game, {
      matchId: (previous?.matchId ?? 1) + 1,
      chooser: settings.chooser,
      options: settings.options,
      autoPass: previous?.autoPass,
    })
  }

  io.on('connection', (socket) => {
    socket.on('game:join', (data = {}) => {
      const { code, playerToken } = data
      const result = joinGame(code, socket.id, playerToken)
      if (!result.success) {
        socket.emit('game:join-error', { error: result.error })
        return
      }
      const game = getGame(code)

      if (result.previousSocketId) {
        const stale = io.sockets.sockets.get(result.previousSocketId)
        if (stale) {
          stale.data.gameCode = null
          stale.leave(game.code)
          stale.emit('game:join-error', { error: 'This game was opened in another tab' })
        }
      }

      socket.join(game.code)
      socket.data.gameCode = game.code
      socket.data.playerId = result.playerId

      socket.emit('game:joined', {
        code: game.code,
        playerId: result.playerId,
        players: game.players.length,
      })
      socket.to(game.code).emit(result.rejoined ? 'game:player-reconnected' : 'game:player-joined', {
        playerId: result.playerId,
        players: game.players.length,
      })

      if (game.players.length === 2 && !game.gameState) {
        const creator = game.players.find((p) => game.creatorToken && p.token === game.creatorToken)
        startMatch(game, { matchId: 1, chooser: creator?.playerId ?? 1, options: game.options })
      } else if (game.gameState) {
        socket.emit('game:state', { gameState: game.gameState })
      }
      broadcastRematch(game)
    })

    /**
     * Every gameplay action goes through here. `fromVersion` must match the
     * server's version, so duplicate or stale emits (double clicks, replays
     * after reconnect, both clients racing) are rejected instead of applied twice.
     */
    socket.on('game:intent', (data = {}) => {
      const game = socket.data.gameCode && getGame(socket.data.gameCode)
      const playerId = socket.data.playerId
      if (!game || !game.gameState || !playerId) {
        socket.emit('game:action-error', { error: 'Game not found or not started' })
        return
      }
      const result = submitIntent(game.code, playerId, data.intent, data.fromVersion)
      if (!result.accepted) {
        if (result.reason === 'stale') socket.emit('game:intent-rejected', { reason: 'stale', intent: data.intent?.type })
        else socket.emit('game:action-error', { error: result.error, intent: data.intent?.type })
        socket.emit('game:state', { gameState: game.gameState })
        return
      }
      broadcastState(game)
    })

    // A preference, not a move: applied regardless of version so the toggle never gets lost.
    socket.on('game:set-auto-pass', (data = {}) => {
      const game = socket.data.gameCode && getGame(socket.data.gameCode)
      const playerId = socket.data.playerId
      if (!game || !game.gameState || !playerId) return
      const result = applyIntent(game.gameState, playerId, { type: 'setAutoPass', enabled: !!data.enabled })
      if (result.error) return
      commitState(game.code, result.state)
      broadcastState(game)
    })

    socket.on('game:rematch', (data = {}) => {
      const game = socket.data.gameCode && getGame(socket.data.gameCode)
      const playerId = socket.data.playerId
      if (!game || !playerId) return
      const result = updateRematch(game, { type: data.action, playerId, requestId: data.requestId, options: data.options })
      if (result.error) socket.emit('game:rematch-error', { error: result.error })
      if (!result.changed) socket.emit('game:rematch', rematchPayload(game))
    })

    socket.on('game:undo-request', () => {
      const gameCode = socket.data.gameCode
      const playerId = socket.data.playerId
      if (!gameCode || !playerId) return
      socket.to(gameCode).emit('game:undo-requested', { fromPlayerId: playerId })
    })

    socket.on('game:undo-accept', () => {
      const gameCode = socket.data.gameCode
      if (!gameCode) return
      const previousState = restorePreviousState(gameCode)
      if (previousState) {
        io.to(gameCode).emit('game:state', { gameState: previousState })
      }
    })

    socket.on('game:undo-decline', () => {
      const gameCode = socket.data.gameCode
      const playerId = socket.data.playerId
      if (!gameCode || !playerId) return
      socket.to(gameCode).emit('game:undo-declined', { byPlayerId: playerId })
    })

    socket.on('disconnect', () => {
      const gameCode = socket.data.gameCode
      if (!gameCode) return
      const game = getGame(gameCode)
      const seat = disconnectSocket(gameCode, socket.id)
      if (!game || !seat) return
      socket.to(gameCode).emit('game:player-left', { playerId: seat.playerId })
      updateRematch(game, { type: 'disconnect', playerId: seat.playerId })
      broadcastRematch(game)
    })
  })

  return io
}

module.exports = { initializeSocketServer }
