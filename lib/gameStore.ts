import { GameState } from './gameLogic'
import { nanoid } from 'nanoid'

export interface GameRoom {
  code: string
  gameState: GameState | null
  players: {
    playerId: 1 | 2
    socketId: string
    name?: string
  }[]
  createdAt: number
  status: 'waiting' | 'in-progress' | 'finished'
}

// In-memory game store (can be replaced with Redis for production)
const games = new Map<string, GameRoom>()

// Clean up old games (older than 24 hours)
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours

export function createGame(): string {
  const code = nanoid(6).toUpperCase()
  const game: GameRoom = {
    code,
    gameState: null,
    players: [],
    createdAt: Date.now(),
    status: 'waiting',
  }
  games.set(code, game)
  return code
}

export function getGame(code: string): GameRoom | undefined {
  return games.get(code.toUpperCase())
}

export function joinGame(code: string, socketId: string, playerName?: string): { success: boolean; playerId?: 1 | 2; error?: string } {
  const game = games.get(code.toUpperCase())
  
  if (!game) {
    return { success: false, error: 'Game not found' }
  }
  
  if (game.players.length >= 2) {
    return { success: false, error: 'Game is full' }
  }
  
  if (game.status !== 'waiting') {
    return { success: false, error: 'Game has already started' }
  }
  
  // Check if socket is already in game
  if (game.players.some(p => p.socketId === socketId)) {
    return { success: false, error: 'Already in this game' }
  }
  
  const playerId = (game.players.length + 1) as 1 | 2
  game.players.push({
    playerId,
    socketId,
    name: playerName,
  })
  
  return { success: true, playerId }
}

export function removePlayer(code: string, socketId: string): void {
  const game = games.get(code.toUpperCase())
  if (!game) return
  
  game.players = game.players.filter(p => p.socketId !== socketId)
  
  // If no players left, remove game after a delay
  if (game.players.length === 0) {
    setTimeout(() => {
      const currentGame = games.get(code.toUpperCase())
      if (currentGame && currentGame.players.length === 0) {
        games.delete(code.toUpperCase())
      }
    }, 60000) // Remove after 1 minute if still empty
  }
}

export function updateGameState(code: string, gameState: GameState): void {
  const game = games.get(code.toUpperCase())
  if (!game) return
  
  game.gameState = gameState
  if (game.status === 'waiting' && gameState) {
    game.status = 'in-progress'
  }
}

export function getGameState(code: string): GameState | null {
  const game = games.get(code.toUpperCase())
  return game?.gameState || null
}

export function getPlayerId(code: string, socketId: string): 1 | 2 | null {
  const game = games.get(code.toUpperCase())
  if (!game) return null
  
  const player = game.players.find(p => p.socketId === socketId)
  return player?.playerId || null
}

// Cleanup old games periodically
setInterval(() => {
  const now = Date.now()
  Array.from(games.entries()).forEach(([code, game]) => {
    if (now - game.createdAt > CLEANUP_INTERVAL) {
      games.delete(code)
    }
  })
}, CLEANUP_INTERVAL)

