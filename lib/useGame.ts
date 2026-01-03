'use client'

import { useState, useEffect, useCallback } from 'react'
import { GameState, Player, drawCards } from './gameLogic'
import io from 'socket.io-client'

// Socket type from socket.io-client
type SocketType = ReturnType<typeof io>

interface UseGameProps {
  socket: SocketType | null
  playerId: 1 | 2 | null
  gameState: GameState | null
  setGameState: (state: GameState | null) => void
}

export function useGame({ socket, playerId, gameState, setGameState }: UseGameProps) {
  const [gameLog, setGameLog] = useState<string[]>([])
  const [mountainTargetSelection, setMountainTargetSelection] = useState<{
    activePlayer: 1 | 2
    cardIndex: number
  } | null>(null)
  const [forestTargetSelection, setForestTargetSelection] = useState<{
    activePlayer: 1 | 2
  } | null>(null)
  const [swampSelection, setSwampSelection] = useState<{
    activePlayer: 1 | 2
    phase: 'reveal' | 'discard'
    revealedCards: number[]
  } | null>(null)

  const addLog = useCallback((message: string) => {
    setGameLog(prev => [...prev, message])
  }, [])

  const updateGameStateAndSync = useCallback((newState: GameState) => {
    setGameState(newState)
    if (socket) {
      socket.emit('game:state-update', { gameState: newState })
    }
  }, [socket, setGameState])

  const handleDrawCard = useCallback((targetPlayerId: 1 | 2) => {
    if (!gameState || !playerId || targetPlayerId !== playerId) return

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

    updateGameStateAndSync(updatedGameState)
    addLog(`Player ${playerId} drew a ${drawnCard[0]} card`)
  }, [gameState, playerId, addLog, updateGameStateAndSync])

  const handlePlayCard = useCallback((targetPlayerId: 1 | 2, cardIndex: number) => {
    if (!gameState || !playerId || targetPlayerId !== playerId) return

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
        setForestTargetSelection({ activePlayer: playerId })
        addLog(`Player ${playerId} played Forest - select a card from graveyard to return to hand`)
      }
    }

    // Swamp: Requires opponent to reveal 3 cards
    if (cardToPlay === 'Swamp') {
      const opponentId = playerId === 1 ? 2 : 1
      const opponent = gameState.players[opponentId - 1]
      
      if (opponent.hand.length < 3) {
        effectMessage = ` (opponent only has ${opponent.hand.length} card(s) in hand)`
        addLog(`Player ${playerId} played Swamp but opponent doesn't have 3 cards to reveal`)
      } else {
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

    updateGameStateAndSync(updatedGameState)
    if (cardToPlay !== 'Mountain' && cardToPlay !== 'Forest' && cardToPlay !== 'Swamp') {
      addLog(`Player ${playerId} played ${cardToPlay}${effectMessage}`)
    } else if (cardToPlay === 'Mountain' && gameState.players[(playerId === 1 ? 2 : 1) - 1].board.length === 0) {
      addLog(`Player ${playerId} played ${cardToPlay}${effectMessage}`)
    } else if (cardToPlay === 'Forest' && player.graveyard.length === 0) {
      addLog(`Player ${playerId} played ${cardToPlay}${effectMessage}`)
    } else if (cardToPlay === 'Swamp' && gameState.players[(playerId === 1 ? 2 : 1) - 1].hand.length < 3) {
      addLog(`Player ${playerId} played ${cardToPlay}${effectMessage}`)
    }
  }, [gameState, playerId, addLog, updateGameStateAndSync])

  const handleMountainTarget = useCallback((targetPlayerId: 1 | 2, cardIndex: number) => {
    if (!gameState || !mountainTargetSelection || !playerId) return
    
    const { activePlayer } = mountainTargetSelection
    if (targetPlayerId === activePlayer || activePlayer !== playerId) return
    
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

    updateGameStateAndSync(updatedGameState)
    setMountainTargetSelection(null)
    addLog(`Player ${activePlayer} discarded ${cardToDiscard} from Player ${targetPlayerId}'s board`)
  }, [gameState, mountainTargetSelection, playerId, addLog, updateGameStateAndSync])

  const handleForestTarget = useCallback((targetPlayerId: 1 | 2, cardIndex: number) => {
    if (!gameState || !forestTargetSelection || !playerId) return
    
    const { activePlayer } = forestTargetSelection
    if (targetPlayerId !== activePlayer || activePlayer !== playerId) return
    
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

    updateGameStateAndSync(updatedGameState)
    setForestTargetSelection(null)
    addLog(`Player ${activePlayer} returned ${cardToReturn} from graveyard to hand`)
  }, [gameState, forestTargetSelection, playerId, addLog, updateGameStateAndSync])

  const handleSwampReveal = useCallback((opponentId: 1 | 2, cardIndex: number) => {
    if (!gameState || !swampSelection || swampSelection.phase !== 'reveal' || !playerId) return
    
    const { activePlayer, revealedCards } = swampSelection
    const opponentPlayerId = activePlayer === 1 ? 2 : 1
    
    // Only opponent can reveal cards
    if (opponentId !== opponentPlayerId || playerId !== opponentPlayerId) return
    
    const opponent = gameState.players[opponentId - 1]
    if (cardIndex < 0 || cardIndex >= opponent.hand.length) return
    
    if (revealedCards.includes(cardIndex)) {
      const newRevealedCards = revealedCards.filter(idx => idx !== cardIndex)
      setSwampSelection({ ...swampSelection, revealedCards: newRevealedCards })
    } else if (revealedCards.length < 3) {
      const newRevealedCards = [...revealedCards, cardIndex]
      setSwampSelection({ ...swampSelection, revealedCards: newRevealedCards })
      
      if (newRevealedCards.length === 3) {
        addLog(`Opponent revealed 3 cards - Player ${activePlayer} must choose one to discard`)
        setSwampSelection({ ...swampSelection, phase: 'discard', revealedCards: newRevealedCards })
      }
    }
  }, [gameState, swampSelection, playerId, addLog])

  const handleSwampDiscard = useCallback((opponentId: 1 | 2, cardIndex: number) => {
    if (!gameState || !swampSelection || swampSelection.phase !== 'discard' || !playerId) return
    
    const { activePlayer, revealedCards } = swampSelection
    const opponentPlayerId = activePlayer === 1 ? 2 : 1
    
    if (opponentId !== opponentPlayerId || activePlayer !== playerId) return
    if (!revealedCards.includes(cardIndex)) return
    
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

    updateGameStateAndSync(updatedGameState)
    setSwampSelection(null)
    addLog(`Player ${activePlayer} discarded ${cardToDiscard} from Player ${opponentId}'s hand`)
  }, [gameState, swampSelection, playerId, addLog, updateGameStateAndSync])

  return {
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
  }
}

