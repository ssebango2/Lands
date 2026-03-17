'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { GameState, LandType } from '@/lib/gameLogic'
import { useSocket } from '@/lib/useSocket'
import { useGame } from '@/lib/useGame'
import PlayerSection from '@/components/PlayerSection'
import GameLog from '@/components/GameLog'
import Board from '@/components/Board'

function getCardImage(landType: LandType): string {
  const imageMap: Record<LandType, string> = {
    'Plains': '/images/plains.jpg',
    'Island': '/images/island.jpg',
    'Swamp': '/images/swamp.jpg',
    'Mountain': '/images/mountain.png',
    'Forest': '/images/forest.jpg',
  }
  return imageMap[landType]
}

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  const { socket, isConnected } = useSocket()
  
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerId, setPlayerId] = useState<1 | 2 | null>(null)
  const [waitingForPlayer, setWaitingForPlayer] = useState(true)
  const [expandedGraveyard, setExpandedGraveyard] = useState<1 | 2 | null>(null)
  const [counterEnabled, setCounterEnabled] = useState(false)
  const [isGameLogOpen, setIsGameLogOpen] = useState(false)
  const [undoRequestFrom, setUndoRequestFrom] = useState<1 | 2 | null>(null)

  const {
    activePlayer,
    gameLog,
    mountainTargetSelection,
    forestTargetSelection,
    swampSelection,
    islandSelection,
    stack,
    priorityHolder,
    canPayCounterCost,
    handleDrawCard,
    handlePlayCard,
    handleMountainTarget,
    handleForestTarget,
    handleSwampReveal,
    handleSwampDiscard,
    handleIslandChoice,
    handlePass,
    handleCounter,
    handleCounterSelectCard,
    handleCounterCostSubmit,
    counterSelection,
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

    socket.on('game:undo-requested', (data: { fromPlayerId: 1 | 2 }) => {
      setUndoRequestFrom(data.fromPlayerId)
    })

    socket.on('game:undo-declined', () => {
      setUndoRequestFrom(null)
    })

    return () => {
      socket.off('game:joined')
      socket.off('game:player-joined')
      socket.off('game:start')
      socket.off('game:state')
      socket.off('game:action')
      socket.off('game:player-left')
      socket.off('game:join-error')
      socket.off('game:undo-requested')
      socket.off('game:undo-declined')
    }
  }, [socket, isConnected, code, router])

  // When counter is disabled and we have priority on stack, auto-pass (resolve immediately)
  useEffect(() => {
    if (!gameState || !playerId || !handlePass) return
    if (stack.length === 0) return
    if (priorityHolder !== playerId) return
    if (counterEnabled) return
    handlePass()
  }, [gameState, playerId, stack.length, priorityHolder, counterEnabled, handlePass])

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
      {gameState.winner && (
        <div className="game-over-overlay">
          <div className="game-over-content">
            <h2>🎉 Player {gameState.winner} Wins!</h2>
            <Link href="/lobby" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Back to Lobby
            </Link>
          </div>
        </div>
      )}
      <div className="game-header">
        <div className="game-code-display">Game: {code}</div>
        <div className="player-indicator">You are Player {playerId}</div>
      </div>
      <div
        className="turn-and-counter-panel"
        style={{
          position: 'absolute',
          right: '24px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Counter box - next to turn indicator when visible */}
        {counterEnabled && stack.length > 0 && priorityHolder === playerId && (
          <div className="stack-action-bar stack-action-bar-inline">
            <div className="stack-info">Would you like to counter?</div>
            <div className="stack-buttons">
              <button className="btn btn-primary" onClick={handlePass}>
                No
              </button>
              {gameState && playerId && canPayCounterCost(gameState.players[playerId - 1], stack[stack.length - 1].spell, stack[stack.length - 1].counterCount) && (
                <button className="btn btn-secondary" onClick={handleCounter}>
                  Yes
                </button>
              )}
            </div>
          </div>
        )}
        <div
          className="turn-indicator"
          style={{
            background: 'rgba(0,0,0,0.8)',
            padding: '12px 24px',
            borderRadius: '8px',
            color: 'white',
            border: `3px solid ${activePlayer === 1 ? '#4CAF50' : '#2196F3'}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
            Player {activePlayer}&apos;s Turn
          </div>
          <label className="counter-toggle-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={counterEnabled}
              onChange={(e) => setCounterEnabled(e.target.checked)}
            />
            Enable counter
          </label>
        </div>
      </div>
      <div className="game-board">
        <button
          type="button"
          className="btn-game-log-toggle btn-game-log-between-graveyards"
          onClick={() => setIsGameLogOpen(!isGameLogOpen)}
          title="Game Log"
          aria-label="Toggle game log"
        >
          📜
        </button>
        <PlayerSection
          player={gameState.players[1]}
          playerId={2}
          isActive={activePlayer === 2}
          isOpponent={playerId !== 2}
          atBottom={playerId === 2}
          onDrawCard={() => handleDrawCard(2)}
          onPlayCard={(cardIndex) => handlePlayCard(2, cardIndex)}
          onGraveyardCardClick={forestTargetSelection && forestTargetSelection.activePlayer === 2
            ? (cardIndex) => {
                handleForestTarget(2, cardIndex)
                setExpandedGraveyard(null)
              }
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
            ? (playerId === 1 && swampSelection.phase === 'reveal'
                ? []
                : swampSelection.revealedCards)
            : []}
          swampPhase={swampSelection && swampSelection.activePlayer === 1
            ? swampSelection.phase
            : null}
        />
        <div className={`board-area ${playerId === 2 ? 'perspective-player2' : ''}`}>
          <Board 
            cards={gameState.players[1].board} 
            playerId={2}
            onCardClick={mountainTargetSelection && mountainTargetSelection.activePlayer === 1 
              ? (cardIndex) => handleMountainTarget(2, cardIndex)
              : undefined}
            isSelectable={mountainTargetSelection?.activePlayer === 1}
            pendingCard={stack.length > 0 && stack[stack.length - 1].controller === 2 ? stack[stack.length - 1].spell : undefined}
          />
          <div className="combat-zone">
            <span className="combat-symbol">⚔</span>
          </div>
          <Board 
            cards={gameState.players[0].board} 
            playerId={1}
            onCardClick={mountainTargetSelection && mountainTargetSelection.activePlayer === 2 
              ? (cardIndex) => handleMountainTarget(1, cardIndex)
              : undefined}
            isSelectable={mountainTargetSelection?.activePlayer === 2}
            pendingCard={stack.length > 0 && stack[stack.length - 1].controller === 1 ? stack[stack.length - 1].spell : undefined}
          />
        </div>
        <PlayerSection
          player={gameState.players[0]}
          playerId={1}
          isActive={activePlayer === 1}
          isOpponent={playerId !== 1}
          atBottom={playerId === 1}
          onDrawCard={() => handleDrawCard(1)}
          onPlayCard={(cardIndex) => handlePlayCard(1, cardIndex)}
          onGraveyardCardClick={forestTargetSelection && forestTargetSelection.activePlayer === 1
            ? (cardIndex) => {
                handleForestTarget(1, cardIndex)
                setExpandedGraveyard(null)
              }
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
            ? (playerId === 2 && swampSelection.phase === 'reveal'
                ? []
                : swampSelection.revealedCards)
            : []}
          swampPhase={swampSelection && swampSelection.activePlayer === 2
            ? swampSelection.phase
            : null}
        />
      </div>
      {/* Expandable Game Log - same as local version */}
      {isGameLogOpen && (
        <div
          className="game-log-backdrop"
          onClick={() => setIsGameLogOpen(false)}
        />
      )}
      <div className={`game-log-sidebar ${isGameLogOpen ? 'open' : ''}`}>
        <div className="game-log-header">
          <h3>Game Log</h3>
          <button
            className="btn-close-log"
            onClick={() => setIsGameLogOpen(false)}
            aria-label="Close game log"
          >
            ×
          </button>
        </div>
        <GameLog logs={gameLog} />
      </div>
      {gameState?.winner && (
        <div className="island-choice-modal">
          <div className="island-choice-content">
            <h3>🎉 Player {gameState.winner} Wins!</h3>
            <p>Game Over</p>
            <Link href="/lobby" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
              Back to Lobby
            </Link>
          </div>
        </div>
      )}
      {counterSelection && counterSelection.priorityHolder === playerId && gameState && (
        <div className="island-choice-modal">
          <div className="island-choice-content">
            <h3>Pay counter cost</h3>
            <p className="counter-cost-desc">
              {counterSelection.counterCount === 0
                ? counterSelection.spell === 'Island'
                  ? 'Select 2 Islands'
                  : `Select 1 Island + 1 ${counterSelection.spell}`
                : 'Select 2 Islands'}
            </p>
            <div className="counter-cost-hand">
              {gameState.players[playerId! - 1].hand.map((card, index) => (
                <div
                  key={index}
                  className={`counter-cost-card ${counterSelection.selectedIndices.includes(index) ? 'selected' : ''}`}
                  onClick={() => handleCounterSelectCard(index)}
                >
                  <Image
                    src={getCardImage(card)}
                    alt={card}
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="100px"
                  />
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary"
              onClick={handleCounterCostSubmit}
              disabled={counterSelection.selectedIndices.length !== 2}
            >
              Pay cost
            </button>
          </div>
        </div>
      )}
      {/* Undo request modal - opponent asks to undo */}
      {undoRequestFrom && (
        <div className="island-choice-modal">
          <div className="island-choice-content">
            <h3>Undo Request</h3>
            <p>Player {undoRequestFrom} requested to undo their last action.</p>
            <div className="island-choice-buttons">
              <button
                className="btn btn-primary"
                onClick={() => {
                  socket?.emit('game:undo-accept')
                  setUndoRequestFrom(null)
                }}
              >
                Accept
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  socket?.emit('game:undo-decline')
                  setUndoRequestFrom(null)
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
      {islandSelection && islandSelection.activePlayer === playerId && (
        <div className="island-choice-modal">
          <div className="island-choice-content">
            <h3>Revealed Card</h3>
            <div className="island-revealed-card">
              <div className="island-card-image-wrapper">
                <Image
                  src={getCardImage(islandSelection.revealedCard)}
                  alt={islandSelection.revealedCard}
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="200px"
                />
              </div>
            </div>
            <div className="island-choice-buttons">
              <button
                className="btn btn-primary"
                onClick={() => handleIslandChoice('discard')}
              >
                Discard
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleIslandChoice('putBack')}
              >
                Put Back on Top
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

