import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { GameState, initializeGame } from './gameLogic'
import { 
  getGame, 
  joinGame, 
  removePlayer, 
  updateGameState, 
  getGameState,
  getPlayerId 
} from './gameStore'

export function initializeSocketServer(httpServer: HTTPServer) {
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

    socket.on('game:join', async (data: { code: string; playerName?: string }) => {
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
        
        // Broadcast game start to all players
        io.to(code).emit('game:start', { gameState: newGameState })
      } else if (game.gameState) {
        // Game already started, send current state
        socket.emit('game:state', { gameState: game.gameState })
      }
    })

    socket.on('game:action', async (data: { action: string; payload: any }) => {
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

      // Validate player can perform action
      // (You'll need to implement game logic validation here)

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

    socket.on('game:state-update', (data: { gameState: GameState }) => {
      const gameCode = socket.data.gameCode
      if (!gameCode) return

      // Update server state
      updateGameState(gameCode, data.gameState)

      // Broadcast to all other players
      socket.to(gameCode).emit('game:state', { gameState: data.gameState })
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


