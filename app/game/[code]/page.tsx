'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { GameState } from '@/lib/gameLogic'
import { useSocket } from '@/lib/useSocket'
import { useGame } from '@/lib/useGame'
import PlayerSection from '@/components/PlayerSection'
import GameControls from '@/components/GameControls'
import GameLog from '@/components/GameLog'
import Board from '@/components/Board'

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  const { socket, isConnected } = useSocket()
  
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerId, setPlayerId] = useState<1 | 2 | null>(null)
  const [waitingForPlayer, setWaitingForPlayer] = useState(true)
  const [expandedGraveyard, setExpandedGraveyard] = useState<1 | 2 | null>(null)

  const {
    gameLog,
    mountainTargetSelection,
    forestTargetSelection,
    swampSelection,
    handleDrawCard,
    handlePlayCard,
    handleMountainTarget,
    handleForestTarget,
    handleSwampReveal,
    handleSwampDiscard,
    setMountainTargetSelection,
    setForestTargetSelection,
    setSwampSelection,
  } = useGame({ socket, playerId, gameState, setGameState })

  useEffect(() => {
    if (!socket || !isConnected) return

    // Join the game room
    socket.emit('game:join', { code })

    // Listen for game events
    socket.on('game:joined', (data: { playerId: 1 | 2; players: number }) => {
      setPlayerId(data.playerId)
      setWaitingForPlayer(data.players < 2)
    })

    socket.on('game:player-joined', (data: { players: number }) => {
      setWaitingForPlayer(data.players < 2)
    })

    socket.on('game:start', (data: { gameState: GameState }) => {
      setGameState(data.gameState)
      setWaitingForPlayer(false)
    })

    socket.on('game:state', (data: { gameState: GameState }) => {
      setGameState(data.gameState)
    })

    socket.on('game:action', (data: { playerId: 1 | 2; action: string; payload: any }) => {
      // Handle opponent's actions - state will be synced via game:state
    })

    socket.on('game:player-left', () => {
      // Handle player leaving
    })

    socket.on('game:join-error', (data: { error: string }) => {
      alert(data.error)
      router.push('/lobby')
    })

    return () => {
      socket.off('game:joined')
      socket.off('game:player-joined')
      socket.off('game:start')
      socket.off('game:state')
      socket.off('game:action')
      socket.off('game:player-left')
      socket.off('game:join-error')
    }
  }, [socket, isConnected, code, router])

  if (waitingForPlayer) {
    return (
      <div className="container">
        <div className="waiting-screen">
          <h1>Waiting for Player...</h1>
          <p>Game Code: <strong>{code}</strong></p>
          <p>Share this code with your opponent</p>
          <div className="waiting-spinner"></div>
        </div>
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className="container">
        <div className="waiting-screen">
          <h1>Loading Game...</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="game-header">
        <div className="game-code-display">Game: {code}</div>
        <div className="player-indicator">You are Player {playerId}</div>
      </div>
      <div className="game-board">
        <PlayerSection
          player={gameState.players[1]}
          playerId={2}
          onDrawCard={() => handleDrawCard(2)}
          onPlayCard={(cardIndex) => handlePlayCard(2, cardIndex)}
          onGraveyardCardClick={forestTargetSelection && forestTargetSelection.activePlayer === 2
            ? (cardIndex) => handleForestTarget(2, cardIndex)
            : undefined}
          isGraveyardSelectable={forestTargetSelection?.activePlayer === 2}
          isGraveyardExpanded={expandedGraveyard === 2}
          onToggleGraveyard={() => setExpandedGraveyard(expandedGraveyard === 2 ? null : 2)}
          onSwampReveal={swampSelection && swampSelection.phase === 'reveal' && swampSelection.activePlayer === 1
            ? (cardIndex) => handleSwampReveal(2, cardIndex)
            : undefined}
          onSwampDiscard={swampSelection && swampSelection.phase === 'discard' && swampSelection.activePlayer === 1
            ? (cardIndex) => handleSwampDiscard(2, cardIndex)
            : undefined}
          swampRevealedCards={swampSelection && swampSelection.activePlayer === 1
            ? swampSelection.revealedCards
            : []}
          swampPhase={swampSelection && swampSelection.activePlayer === 1
            ? swampSelection.phase
            : null}
        />
        <div className="board-area">
          <Board 
            cards={gameState.players[1].board} 
            playerId={2}
            onCardClick={mountainTargetSelection && mountainTargetSelection.activePlayer === 1 
              ? (cardIndex) => handleMountainTarget(2, cardIndex)
              : undefined}
            isSelectable={mountainTargetSelection?.activePlayer === 1}
          />
          <div className="combat-zone">⚔</div>
          <Board 
            cards={gameState.players[0].board} 
            playerId={1}
            onCardClick={mountainTargetSelection && mountainTargetSelection.activePlayer === 2 
              ? (cardIndex) => handleMountainTarget(1, cardIndex)
              : undefined}
            isSelectable={mountainTargetSelection?.activePlayer === 2}
          />
        </div>
        <PlayerSection
          player={gameState.players[0]}
          playerId={1}
          onDrawCard={() => handleDrawCard(1)}
          onPlayCard={(cardIndex) => handlePlayCard(1, cardIndex)}
          onGraveyardCardClick={forestTargetSelection && forestTargetSelection.activePlayer === 1
            ? (cardIndex) => handleForestTarget(1, cardIndex)
            : undefined}
          isGraveyardSelectable={forestTargetSelection?.activePlayer === 1}
          isGraveyardExpanded={expandedGraveyard === 1}
          onToggleGraveyard={() => setExpandedGraveyard(expandedGraveyard === 1 ? null : 1)}
          onSwampReveal={swampSelection && swampSelection.phase === 'reveal' && swampSelection.activePlayer === 2
            ? (cardIndex) => handleSwampReveal(1, cardIndex)
            : undefined}
          onSwampDiscard={swampSelection && swampSelection.phase === 'discard' && swampSelection.activePlayer === 2
            ? (cardIndex) => handleSwampDiscard(1, cardIndex)
            : undefined}
          swampRevealedCards={swampSelection && swampSelection.activePlayer === 2
            ? swampSelection.revealedCards
            : []}
          swampPhase={swampSelection && swampSelection.activePlayer === 2
            ? swampSelection.phase
            : null}
        />
      </div>
      <GameLog logs={gameLog} />
    </div>
  )
}

