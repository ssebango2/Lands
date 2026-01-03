'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { GameState, Player, createDeck, shuffleDeck, drawCards, initializeGame } from '@/lib/gameLogic'
import PlayerSection from '@/components/PlayerSection'
import GameControls from '@/components/GameControls'
import GameLog from '@/components/GameLog'
import Board from '@/components/Board'

export default function Home() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [gameLog, setGameLog] = useState<string[]>([])
  const [mountainTargetSelection, setMountainTargetSelection] = useState<{
    activePlayer: 1 | 2
    cardIndex: number
  } | null>(null)
  const [forestTargetSelection, setForestTargetSelection] = useState<{
    activePlayer: 1 | 2
  } | null>(null)
  const [expandedGraveyard, setExpandedGraveyard] = useState<1 | 2 | null>(null)
  const [swampSelection, setSwampSelection] = useState<{
    activePlayer: 1 | 2
    phase: 'reveal' | 'discard'
    revealedCards: number[]
  } | null>(null)

  const addLog = (message: string) => {
    setGameLog(prev => [...prev, message])
  }

  const handleNewGame = () => {
    const newGame = initializeGame()
    setGameState(newGame)
    setGameLog(['New game started!'])
    addLog(`Player 1 drew 4 cards`)
    addLog(`Player 2 drew 4 cards`)
  }

  const handleDrawCard = (playerId: 1 | 2) => {
    if (!gameState) return

    const player = gameState.players[playerId - 1]
    if (player.deck.length === 0) {
      addLog(`Player ${playerId} has no cards left in deck!`)
      return
    }

    const [newDeck, drawnCard] = drawCards(player.deck, 1)
    
    const updatedPlayers: [Player, Player] = [
      playerId === 1 
        ? { ...gameState.players[0], deck: newDeck, hand: [...gameState.players[0].hand, drawnCard[0]] }
        : gameState.players[0],
      playerId === 2
        ? { ...gameState.players[1], deck: newDeck, hand: [...gameState.players[1].hand, drawnCard[0]] }
        : gameState.players[1]
    ]
    
    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers
    }

    setGameState(updatedGameState)
    addLog(`Player ${playerId} drew a ${drawnCard[0]} card`)
  }

  const handlePlayCard = (playerId: 1 | 2, cardIndex: number) => {
    if (!gameState) return

    const player = gameState.players[playerId - 1]
    if (cardIndex < 0 || cardIndex >= player.hand.length) return

    const cardToPlay = player.hand[cardIndex]
    const newHand = player.hand.filter((_, idx) => idx !== cardIndex)
    const newBoard = [...player.board, cardToPlay]

    // Handle card effects
    let updatedDeck = player.deck
    let updatedHand = newHand
    let effectMessage = ''

    // Plains: Draw one card
    if (cardToPlay === 'Plains') {
      if (player.deck.length > 0) {
        const [newDeck, drawnCard] = drawCards(player.deck, 1)
        updatedDeck = newDeck
        updatedHand = [...newHand, drawnCard[0]]
        effectMessage = ` and drew ${drawnCard[0]}`
        addLog(`Player ${playerId} drew ${drawnCard[0]} from Plains effect`)
      } else {
        effectMessage = ' (no cards left in deck)'
        addLog(`Player ${playerId} tried to draw from Plains but deck is empty`)
      }
    }

    // Mountain: Requires target selection
    if (cardToPlay === 'Mountain') {
      const opponentId = playerId === 1 ? 2 : 1
      const opponent = gameState.players[opponentId - 1]
      
      if (opponent.board.length === 0) {
        effectMessage = ' (opponent has no cards on board)'
        addLog(`Player ${playerId} played Mountain but opponent has no cards to target`)
      } else {
        // Set up target selection mode
        setMountainTargetSelection({ activePlayer: playerId, cardIndex: newBoard.length - 1 })
        addLog(`Player ${playerId} played Mountain - select an opponent's card to discard`)
      }
    }

    // Forest: Requires graveyard target selection
    if (cardToPlay === 'Forest') {
      if (player.graveyard.length === 0) {
        effectMessage = ' (graveyard is empty)'
        addLog(`Player ${playerId} played Forest but graveyard is empty`)
      } else {
        // Set up target selection mode
        setForestTargetSelection({ activePlayer: playerId })
        addLog(`Player ${playerId} played Forest - select a card from graveyard to return to hand`)
      }
    }

    // Swamp: Requires opponent to reveal 3 cards, then player chooses one to discard
    if (cardToPlay === 'Swamp') {
      const opponentId = playerId === 1 ? 2 : 1
      const opponent = gameState.players[opponentId - 1]
      
      if (opponent.hand.length < 3) {
        effectMessage = ` (opponent only has ${opponent.hand.length} card(s) in hand)`
        addLog(`Player ${playerId} played Swamp but opponent doesn't have 3 cards to reveal`)
      } else {
        // Set up reveal phase
        setSwampSelection({ 
          activePlayer: playerId, 
          phase: 'reveal',
          revealedCards: []
        })
        addLog(`Player ${playerId} played Swamp - opponent must reveal 3 cards from hand`)
      }
    }

    const updatedPlayers: [Player, Player] = [
      playerId === 1 
        ? { ...gameState.players[0], hand: updatedHand, board: newBoard, deck: updatedDeck }
        : gameState.players[0],
      playerId === 2
        ? { ...gameState.players[1], hand: updatedHand, board: newBoard, deck: updatedDeck }
        : gameState.players[1]
    ]
    
    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers
    }

    setGameState(updatedGameState)
    if (cardToPlay !== 'Mountain' && cardToPlay !== 'Forest' && cardToPlay !== 'Swamp') {
      addLog(`Player ${playerId} played ${cardToPlay}${effectMessage}`)
    } else if (cardToPlay === 'Mountain' && gameState.players[(playerId === 1 ? 2 : 1) - 1].board.length === 0) {
      addLog(`Player ${playerId} played ${cardToPlay}${effectMessage}`)
    } else if (cardToPlay === 'Forest' && player.graveyard.length === 0) {
      addLog(`Player ${playerId} played ${cardToPlay}${effectMessage}`)
    } else if (cardToPlay === 'Swamp' && gameState.players[(playerId === 1 ? 2 : 1) - 1].hand.length < 3) {
      addLog(`Player ${playerId} played ${cardToPlay}${effectMessage}`)
    }
  }

  const handleMountainTarget = (targetPlayerId: 1 | 2, cardIndex: number) => {
    if (!gameState || !mountainTargetSelection) return
    
    const { activePlayer } = mountainTargetSelection
    if (targetPlayerId === activePlayer) return // Can't target own cards
    
    const targetPlayer = gameState.players[targetPlayerId - 1]
    if (cardIndex < 0 || cardIndex >= targetPlayer.board.length) return

    const cardToDiscard = targetPlayer.board[cardIndex]
    const newBoard = targetPlayer.board.filter((_, idx) => idx !== cardIndex)
    const newGraveyard = [...targetPlayer.graveyard, cardToDiscard]

    const updatedPlayers: [Player, Player] = [
      targetPlayerId === 1 
        ? { ...gameState.players[0], board: newBoard, graveyard: newGraveyard }
        : gameState.players[0],
      targetPlayerId === 2
        ? { ...gameState.players[1], board: newBoard, graveyard: newGraveyard }
        : gameState.players[1]
    ]
    
    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers
    }

    setGameState(updatedGameState)
    setMountainTargetSelection(null)
    addLog(`Player ${activePlayer} discarded ${cardToDiscard} from Player ${targetPlayerId}'s board`)
  }

  const handleForestTarget = (playerId: 1 | 2, cardIndex: number) => {
    if (!gameState || !forestTargetSelection) return
    
    const { activePlayer } = forestTargetSelection
    if (playerId !== activePlayer) return // Can only target own graveyard
    
    const player = gameState.players[playerId - 1]
    if (cardIndex < 0 || cardIndex >= player.graveyard.length) return

    const cardToReturn = player.graveyard[cardIndex]
    const newGraveyard = player.graveyard.filter((_, idx) => idx !== cardIndex)
    const newHand = [...player.hand, cardToReturn]

    const updatedPlayers: [Player, Player] = [
      playerId === 1 
        ? { ...gameState.players[0], hand: newHand, graveyard: newGraveyard }
        : gameState.players[0],
      playerId === 2
        ? { ...gameState.players[1], hand: newHand, graveyard: newGraveyard }
        : gameState.players[1]
    ]
    
    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers
    }

    setGameState(updatedGameState)
    setForestTargetSelection(null)
    addLog(`Player ${activePlayer} returned ${cardToReturn} from graveyard to hand`)
  }

  const handleSwampReveal = (opponentId: 1 | 2, cardIndex: number) => {
    if (!gameState || !swampSelection || swampSelection.phase !== 'reveal') return
    
    const { activePlayer, revealedCards } = swampSelection
    const opponentPlayerId = activePlayer === 1 ? 2 : 1
    
    if (opponentId !== opponentPlayerId) return // Only opponent can reveal cards
    
    const opponent = gameState.players[opponentId - 1]
    if (cardIndex < 0 || cardIndex >= opponent.hand.length) return
    
    // Check if card is already selected
    if (revealedCards.includes(cardIndex)) {
      // Deselect the card
      const newRevealedCards = revealedCards.filter(idx => idx !== cardIndex)
      setSwampSelection({ ...swampSelection, revealedCards: newRevealedCards })
    } else if (revealedCards.length < 3) {
      // Add the card to revealed cards
      const newRevealedCards = [...revealedCards, cardIndex]
      setSwampSelection({ ...swampSelection, revealedCards: newRevealedCards })
      
      if (newRevealedCards.length === 3) {
        // Move to discard phase
        addLog(`Opponent revealed 3 cards - Player ${activePlayer} must choose one to discard`)
        setSwampSelection({ ...swampSelection, phase: 'discard', revealedCards: newRevealedCards })
      }
    }
  }

  const handleSwampDiscard = (opponentId: 1 | 2, cardIndex: number) => {
    if (!gameState || !swampSelection || swampSelection.phase !== 'discard') return
    
    const { activePlayer, revealedCards } = swampSelection
    const opponentPlayerId = activePlayer === 1 ? 2 : 1
    
    if (opponentId !== opponentPlayerId) return
    if (!revealedCards.includes(cardIndex)) return // Can only discard revealed cards
    
    const opponent = gameState.players[opponentId - 1]
    if (cardIndex < 0 || cardIndex >= opponent.hand.length) return

    const cardToDiscard = opponent.hand[cardIndex]
    const newHand = opponent.hand.filter((_, idx) => idx !== cardIndex)
    const newGraveyard = [...opponent.graveyard, cardToDiscard]

    const updatedPlayers: [Player, Player] = [
      opponentId === 1 
        ? { ...gameState.players[0], hand: newHand, graveyard: newGraveyard }
        : gameState.players[0],
      opponentId === 2
        ? { ...gameState.players[1], hand: newHand, graveyard: newGraveyard }
        : gameState.players[1]
    ]
    
    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers
    }

    setGameState(updatedGameState)
    setSwampSelection(null)
    addLog(`Player ${activePlayer} discarded ${cardToDiscard} from Player ${opponentId}'s hand`)
  }

  // Redirect to lobby for multiplayer
  useEffect(() => {
    // Only redirect if we're on the root page and no game state
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      // Don't auto-redirect, let user choose
    }
  }, [])

  return (
    <div className="container">
      {!gameState && (
        <div className="start-screen">
          <h1>Basic Lands Game</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleNewGame}>
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
          <div className="game-ui-overlay">
            <GameControls
              onNewGame={handleNewGame}
              onDrawCard={handleDrawCard}
              gameState={gameState}
            />
          </div>
          <button className="btn-end-turn">END TURN</button>
        </>
      )}
    </div>
  )
}

