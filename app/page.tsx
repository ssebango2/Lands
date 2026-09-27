'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocalGame } from '@/lib/useLocalGame'
import { shouldPlayOpeningIntro, useGameIntro } from '@/lib/useGameIntro'
import { motionViewsFromGameState } from '@/lib/cardMotion'
import { useCardMotion } from '@/lib/useCardMotion'
import PlayerSection from '@/components/PlayerSection'
import GameControls from '@/components/GameControls'
import GameLog from '@/components/GameLog'
import Board from '@/components/Board'
import Dialog from '@/components/Dialog'
import IslandDecision from '@/components/IslandDecision'
import CardMotionLayer from '@/components/CardMotionLayer'

const BOTH_HANDS_FACE_UP = { 1: true, 2: true } as const

export default function Home() {
  const [expandedGraveyard, setExpandedGraveyard] = useState<1 | 2 | null>(null)
  const [isGameLogOpen, setIsGameLogOpen] = useState(false)
  const [introSession, setIntroSession] = useState(0)

  const {
    gameState,
    gameLog,
    activePlayer,
    mountainTargetSelection,
    forestTargetSelection,
    swampSelection,
    islandSelection,
    startNewGame,
    handlePlayCard,
    handleMountainTarget,
    handleForestTarget,
    handleSwampReveal,
    handleSwampDiscard,
    handleIslandChoice,
  } = useLocalGame({
    onLog: (message) => console.log(message)
  })

  const playIntro = useMemo(
    () => (gameState ? shouldPlayOpeningIntro(gameState) : false),
    [gameState]
  )

  const {
    phase: introPhase,
    displayDeckCount,
    displayHandCount,
    isIntroActive,
    isInteractive,
    skip: skipIntro,
  } = useGameIntro(playIntro, playIntro ? introSession : null)

  const handleStartNewGame = () => {
    setIntroSession((n) => n + 1)
    startNewGame()
  }

  const introProps = isIntroActive
    ? {
        introHandCount: displayHandCount,
        introDeckCount: displayDeckCount,
        isShuffling: introPhase === 'shuffle',
        isIntroDealing: introPhase === 'dealing',
      }
    : {}

  const canAct = isInteractive

  const motionViews = useMemo(
    () => gameState
      ? motionViewsFromGameState(gameState, islandSelection ? { playerId: islandSelection.activePlayer, card: islandSelection.revealedCard } : null)
      : null,
    [gameState, islandSelection]
  )
  const { flights, holds, finishFlight } = useCardMotion({
    views: motionViews,
    resetKey: introSession,
    enabled: !isIntroActive,
    faceUpHands: BOTH_HANDS_FACE_UP,
  })

  return (
    <div className="container">
      {!gameState && (
        <main className="start-screen">
          <p className="eyebrow">Magic: The Gathering basic lands</p>
          <h1>Basic Lands Game</h1>
          <div className="start-actions">
            <button className="btn btn-primary" onClick={handleStartNewGame} style={{ display: 'none' }}>
              Local Game
            </button>
            <Link href="/lobby" className="btn btn-primary btn-large">
              Multiplayer
            </Link>
          </div>
        </main>
      )}

      {gameState && (
        <>
          {gameState.winner && (
            <Dialog
              className="game-over-dialog"
              eyebrow="Game over"
              title={`Player ${gameState.winner} wins`}
              actions={
                <button type="button" className="btn btn-primary" onClick={handleStartNewGame}>
                  New game
                </button>
              }
            />
          )}
          {isIntroActive && (
            <div className="game-intro-banner" aria-live="polite">
              <div className="game-intro-banner-label">
                {introPhase === 'shuffle' ? 'Shuffling decks…' : 'Drawing opening hands…'}
              </div>
              <button type="button" className="btn-skip-intro" onClick={skipIntro}>
                Skip
              </button>
            </div>
          )}
          <div className={`game-board${isIntroActive ? ' intro-locked' : ''}`}>
            <aside className="table-rail table-rail-left" aria-label="Game controls">
              <div className="game-header">
                <div className="game-meta">
                  <span className="eyebrow">Mode</span>
                  <span className="player-indicator">Local game</span>
                </div>
                <GameControls onNewGame={handleStartNewGame} gameState={gameState} />
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-game-log-toggle"
                onClick={() => setIsGameLogOpen(!isGameLogOpen)}
                aria-expanded={isGameLogOpen}
                aria-controls="game-log-panel"
              >
                Game log
              </button>
            </aside>

            <PlayerSection
              player={gameState.players[1]}
              playerId={2}
              isActive={activePlayer === 2}
              canPlayCard={canAct && activePlayer === 2 && !mountainTargetSelection && !forestTargetSelection && !swampSelection && !islandSelection}
              onPlayCard={(cardIndex) => handlePlayCard(2, cardIndex)}
              onGraveyardCardClick={forestTargetSelection && forestTargetSelection.activePlayer === 2
                ? (cardIndex) => {
                    handleForestTarget(2, cardIndex)
                    setExpandedGraveyard(null)
                  }
                : undefined}
              isGraveyardSelectable={canAct && forestTargetSelection?.activePlayer === 2}
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
              motionHolds={holds[2]}
              {...introProps}
            />
            <div className="board-area">
              <Board 
                cards={gameState.players[1].board} 
                playerId={2}
                label="Player 2"
                onCardClick={mountainTargetSelection && mountainTargetSelection.activePlayer === 1 
                  ? (cardIndex) => handleMountainTarget(2, cardIndex)
                  : undefined}
                isSelectable={canAct && mountainTargetSelection?.activePlayer === 1}
              />
              <div className="combat-zone" aria-hidden="true" />
              <Board 
                cards={gameState.players[0].board} 
                playerId={1}
                label="Player 1"
                onCardClick={mountainTargetSelection && mountainTargetSelection.activePlayer === 2 
                  ? (cardIndex) => handleMountainTarget(1, cardIndex)
                  : undefined}
                isSelectable={canAct && mountainTargetSelection?.activePlayer === 2}
              />
            </div>
            <PlayerSection
              player={gameState.players[0]}
              playerId={1}
              isActive={activePlayer === 1}
              canPlayCard={canAct && activePlayer === 1 && !mountainTargetSelection && !forestTargetSelection && !swampSelection && !islandSelection}
              onPlayCard={(cardIndex) => handlePlayCard(1, cardIndex)}
              onGraveyardCardClick={forestTargetSelection && forestTargetSelection.activePlayer === 1
                ? (cardIndex) => {
                    handleForestTarget(1, cardIndex)
                    setExpandedGraveyard(null)
                  }
                : undefined}
              isGraveyardSelectable={canAct && forestTargetSelection?.activePlayer === 1}
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
              motionHolds={holds[1]}
              {...introProps}
            />

            <aside className="table-rail table-rail-right" aria-label="Turn">
              <div className="turn-and-counter-panel">
                <div
                  key={activePlayer}
                  className={`turn-indicator turn-indicator-p${activePlayer} is-you`}
                  role="status"
                  aria-live="polite"
                >
                  <span className="eyebrow turn-indicator-eyebrow">Current turn</span>
                  <span className="turn-indicator-label">Player {activePlayer}</span>
                </div>
              </div>
            </aside>
          </div>

          {isGameLogOpen && (
            <div 
              className="game-log-backdrop" 
              onClick={() => setIsGameLogOpen(false)}
            />
          )}
          <div
            id="game-log-panel"
            className={`game-log-sidebar ${isGameLogOpen ? 'open' : ''}`}
            role="region"
            aria-label="Game log"
          >
            <div className="game-log-header">
              <h3>Game log</h3>
              <button 
                type="button"
                className="dialog-close btn-close-log" 
                onClick={() => setIsGameLogOpen(false)}
                aria-label="Close game log"
              >
                <span className="dialog-close-icon" aria-hidden="true">×</span>
                <span className="dialog-close-text" aria-hidden="true">Close</span>
              </button>
            </div>
            <GameLog logs={gameLog} />
          </div>
          <CardMotionLayer flights={flights} onDone={finishFlight} />
          {islandSelection && islandSelection.activePlayer === activePlayer && canAct && (
            <IslandDecision
              playerId={activePlayer}
              revealedCard={islandSelection.revealedCard}
              eyebrow={`Island · Player ${activePlayer}`}
              onChoose={handleIslandChoice}
            />
          )}
        </>
      )}
    </div>
  )
}
