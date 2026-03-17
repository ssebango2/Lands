const { Server: SocketIOServer } = require('socket.io')
const { initializeGame } = require('./gameLogic')
const { 
  getGame, 
  joinGame, 
  removePlayer, 
  updateGameState, 
  tryUpdateGameState,
  restorePreviousState,
} = require('./gameStore')

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

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    socket.on('game:join', async (data) => {
      const { code, playerName } = data
      const result = joinGame(code, socket.id, playerName)
      
      if (!result.success) {
        socket.emit('game:join-error', { error: result.error })
        return
      }

      socket.join(code)
      socket.data.gameCode = code
      socket.data.playerId = result.playerId

      const game = getGame(code)
      if (!game) {
        socket.emit('game:join-error', { error: 'Game not found' })
        return
      }

      // Notify the player
      socket.emit('game:joined', {
        code,
        playerId: result.playerId,
        players: game.players.length,
      })

      // Notify other players
      socket.to(code).emit('game:player-joined', {
        playerId: result.playerId,
        players: game.players.length,
      })

      // If both players are ready, initialize game
      if (game.players.length === 2 && !game.gameState) {
        const newGameState = initializeGame()
        updateGameState(code, newGameState)
        const gameAfter = getGame(code)
        const stateToSend = { ...newGameState, stateVersion: gameAfter?.stateVersion ?? 0 }
        // Broadcast game start to all players
        io.to(code).emit('game:start', { gameState: stateToSend })
      } else if (game.gameState) {
        // Game already started, send current state (with stateVersion for consistency)
        const stateToSend = { ...game.gameState, stateVersion: game.stateVersion ?? 0 }
        socket.emit('game:state', { gameState: stateToSend })
      }
    })

    socket.on('game:action', async (data) => {
      const gameCode = socket.data.gameCode
      const playerId = socket.data.playerId

      if (!gameCode || !playerId) {
        socket.emit('game:action-error', { error: 'Not in a game' })
        return
      }

      const game = getGame(gameCode)
      if (!game || !game.gameState) {
        socket.emit('game:action-error', { error: 'Game not found or not started' })
        return
      }

      // Broadcast action to all players in the room
      socket.to(gameCode).emit('game:action', {
        playerId,
        action: data.action,
        payload: data.payload,
      })

      // Also send to sender for confirmation
      socket.emit('game:action-confirmed', {
        action: data.action,
        payload: data.payload,
      })
    })

    socket.on('game:state-update', (data) => {
      const gameCode = socket.data.gameCode
      if (!gameCode) return

      const fromVersion = data.fromVersion ?? 0
      const result = tryUpdateGameState(gameCode, data.gameState, fromVersion)

      if (result.accepted) {
        const game = getGame(gameCode)
        const stateToSend = { ...data.gameState, stateVersion: result.stateVersion }
        // Broadcast to ALL players (including sender) so everyone has authoritative stateVersion
        io.to(gameCode).emit('game:state', { gameState: stateToSend })
      } else {
        // Stale update rejected - resync sender with current state
        const game = getGame(gameCode)
        const stateToSend = { ...game.gameState, stateVersion: game.stateVersion ?? 0 }
        socket.emit('game:state', { gameState: stateToSend })
      }
    })

    socket.on('game:undo-request', () => {
      const gameCode = socket.data.gameCode
      const playerId = socket.data.playerId
      if (!gameCode || !playerId) return

      // Relay to opponent
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

      // Relay to requester
      socket.to(gameCode).emit('game:undo-declined', { byPlayerId: playerId })
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
      const gameCode = socket.data.gameCode
      if (gameCode) {
        removePlayer(gameCode, socket.id)
        socket.to(gameCode).emit('game:player-left', {
          playerId: socket.data.playerId,
        })
      }
    })
  })

  return io
}

module.exports = { initializeSocketServer }


