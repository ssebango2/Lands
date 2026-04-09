'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useLocalGame } from '@/lib/useLocalGame'
import { LandType } from '@/lib/gameLogic'
import PlayerSection from '@/components/PlayerSection'
import GameControls from '@/components/GameControls'
import GameLog from '@/components/GameLog'
import Board from '@/components/Board'

const getCardImage = (landType: LandType): string => {
  const imageMap: Record<LandType, string> = {
    'Plains': '/images/plains.jpg',
    'Island': '/images/island.jpg',
    'Swamp': '/images/swamp.jpg',
    'Mountain': '/images/mountain.jpg',
    'Forest': '/images/forest.jpg',
  }
  return imageMap[landType]
}

export default function Home() {
  const [expandedGraveyard, setExpandedGraveyard] = useState<1 | 2 | null>(null)
  const [isGameLogOpen, setIsGameLogOpen] = useState(false)
  
  const {
    gameState,
    gameLog,
    activePlayer,
    mountainTargetSelection,
    forestTargetSelection,
    swampSelection,
    islandSelection,
    startNewGame,
    endTurn,
    handleDrawCard,
    handlePlayCard,
    handleMountainTarget,
    handleForestTarget,
    handleSwampReveal,
    handleSwampDiscard,
    handleIslandChoice,
  } = useLocalGame({
    onLog: (message) => console.log(message)
  })

  return (
    <div className="container">
      {!gameState && (
        <div className="start-screen">
          <h1>Basic Lands Game</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={startNewGame} style={{ display: 'none' }}>
              Local Game
            </button>
            <Link href="/lobby" className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}>
              Multiplayer
            </Link>
          </div>
        </div>
      )}

      {gameState && (
        <>
          {gameState.winner && (
            <div className="game-over-overlay">
              <div className="game-over-content">
                <h2>🎉 Player {gameState.winner} Wins!</h2>
                <button className="btn btn-primary" onClick={startNewGame}>
                  New Game
                </button>
              </div>
            </div>
          )}
          <div 
            className="turn-indicator" 
            style={{ 
              position: 'absolute', 
              right: '24px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              zIndex: 1000, 
              background: 'rgba(0,0,0,0.8)', 
              padding: '12px 24px', 
              borderRadius: '8px', 
              color: 'white', 
              border: `3px solid ${activePlayer === 1 ? '#4CAF50' : '#2196F3'}`
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
              Player {activePlayer}'s Turn
            </div>
          </div>
          <div className="game-board">
            <PlayerSection
              player={gameState.players[1]}
              playerId={2}
              isActive={activePlayer === 2}
              canPlayCard={activePlayer === 2 && !mountainTargetSelection && !forestTargetSelection && !swampSelection && !islandSelection}
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
              isActive={activePlayer === 1}
              canPlayCard={activePlayer === 1 && !mountainTargetSelection && !forestTargetSelection && !swampSelection && !islandSelection}
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
                ? swampSelection.revealedCards
                : []}
              swampPhase={swampSelection && swampSelection.activePlayer === 2
                ? swampSelection.phase
                : null}
            />
          </div>
          <div className="game-ui-overlay">
            <GameControls
              onNewGame={startNewGame}
              gameState={gameState}
            />
          </div>
          <button 
            className="btn-game-log-toggle" 
            onClick={() => setIsGameLogOpen(!isGameLogOpen)}
            title="Toggle Game Log"
          >
            📜
          </button>
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
          {/* Game over overlay */}
          {gameState.winner && (
            <div className="game-over-overlay">
              <div className="game-over-content">
                <h2>Player {gameState.winner} Wins!</h2>
                <button className="btn btn-primary" onClick={startNewGame}>
                  New Game
                </button>
              </div>
            </div>
          )}
          {gameState.winner && (
            <div className="island-choice-modal">
              <div className="island-choice-content">
                <h3>🎉 Player {gameState.winner} Wins!</h3>
                <p>Congratulations!</p>
                <button className="btn btn-primary" onClick={startNewGame}>
                  New Game
                </button>
              </div>
            </div>
          )}
          {gameState.winner && (
            <div className="island-choice-modal">
              <div className="island-choice-content">
                <h3>Game Over</h3>
                <p style={{ fontSize: '1.5rem', margin: '20px 0' }}>🎉 Player {gameState.winner} wins!</p>
                <button className="btn btn-primary" onClick={startNewGame}>
                  New Game
                </button>
              </div>
            </div>
          )}
          {islandSelection && islandSelection.activePlayer === activePlayer && (
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
        </>
      )}
    </div>
  )
}

