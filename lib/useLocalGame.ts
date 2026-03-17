'use client'

import { useState, useCallback } from 'react'
import { GameState, Player, drawCards, initializeGame, Card as CardType } from './gameLogic'

interface UseLocalGameProps {
  initialGameState?: GameState | null
  onLog?: (message: string) => void
}

export function useLocalGame({ initialGameState = null, onLog }: UseLocalGameProps = {}) {
  const [gameState, setGameState] = useState<GameState | null>(initialGameState)
  const [gameLog, setGameLog] = useState<string[]>([])
  const [activePlayer, setActivePlayer] = useState<1 | 2>(1)
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
  const [islandSelection, setIslandSelection] = useState<{
    activePlayer: 1 | 2
    revealedCard: CardType
  } | null>(null)

  const addLog = useCallback((message: string) => {
    setGameLog(prev => [...prev, message])
    onLog?.(message)
  }, [onLog])

  const startNewGame = useCallback(() => {
    const newGame = initializeGame()
    setGameState(newGame)
    setGameLog(['New game started!'])
    setActivePlayer(1)
    setMountainTargetSelection(null)
    setForestTargetSelection(null)
    setSwampSelection(null)
    addLog(`Player 1 drew 4 cards`)
    addLog(`Player 2 drew 4 cards`)
    addLog(`Player 1's turn`)
  }, [addLog])

  const checkWinCondition = useCallback((player: Player): { won: boolean; reason: string } | null => {
    // Win condition 1: Have 1 of each basic land type on board (Domain)
    const landTypes = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'] as const
    const hasAllTypes = landTypes.every(type => player.board.includes(type))
    if (hasAllTypes) {
      return { won: true, reason: 'Domain (1 of each basic land type)' }
    }

    // Win condition 2: Have 5 of a single basic land type on board
    for (const landType of landTypes) {
      const count = player.board.filter(card => card === landType).length
      if (count >= 5) {
        return { won: true, reason: `5 ${landType}s` }
      }
    }

    return null
  }, [])

  const endTurn = useCallback(() => {
    if (!gameState) return
    
    // Check if there are any pending selections that need to be resolved
    if (mountainTargetSelection || forestTargetSelection || swampSelection || islandSelection) {
      addLog('Cannot end turn - resolve pending card effects first')
      return
    }

    // Check win conditions before ending turn
    const player1Win = checkWinCondition(gameState.players[0])
    const player2Win = checkWinCondition(gameState.players[1])
    
    if (player1Win) {
      addLog(`🎉 Player 1 wins! (${player1Win.reason})`)
      setGameState({ ...gameState, winner: 1 })
      return
    }
    if (player2Win) {
      addLog(`🎉 Player 2 wins! (${player2Win.reason})`)
      setGameState({ ...gameState, winner: 2 })
      return
    }

    // Draw a card at the start of turn (except first turn)
    const nextPlayer = activePlayer === 1 ? 2 : 1
    const nextPlayerObj = gameState.players[nextPlayer - 1]
    
    if (nextPlayerObj.deck.length > 0) {
      const [newDeck, drawnCard] = drawCards(nextPlayerObj.deck, 1)
      const updatedPlayers: [Player, Player] = [
        nextPlayer === 1 
          ? { ...gameState.players[0], deck: newDeck, hand: [...gameState.players[0].hand, drawnCard[0]] }
          : gameState.players[0],
        nextPlayer === 2
          ? { ...gameState.players[1], deck: newDeck, hand: [...gameState.players[1].hand, drawnCard[0]] }
          : gameState.players[1]
      ]
      const updatedGameState = { ...gameState, players: updatedPlayers }
      setGameState(updatedGameState)
      addLog(`Player ${nextPlayer} drew ${drawnCard[0]} at start of turn`)
      
      // Check win condition after drawing
      const nextPlayerWin = checkWinCondition(updatedGameState.players[nextPlayer - 1])
      if (nextPlayerWin) {
        addLog(`🎉 Player ${nextPlayer} wins! (${nextPlayerWin.reason})`)
        setGameState({ ...updatedGameState, winner: nextPlayer })
        return
      }
    }

    setActivePlayer(nextPlayer)
    addLog(`Player ${nextPlayer}'s turn`)
  }, [gameState, activePlayer, mountainTargetSelection, forestTargetSelection, swampSelection, islandSelection, addLog, checkWinCondition])

  const handleDrawCard = useCallback((drawingPlayerId: 1 | 2) => {
    if (!gameState || drawingPlayerId !== activePlayer) {
      addLog(`It's not Player ${drawingPlayerId}'s turn`)
      return
    }

    const player = gameState.players[drawingPlayerId - 1]
    if (player.deck.length === 0) {
      addLog(`Player ${drawingPlayerId} has no cards left in deck!`)
      return
    }

    const [newDeck, drawnCard] = drawCards(player.deck, 1)
    
    const updatedPlayers: [Player, Player] = [
      drawingPlayerId === 1 
        ? { ...gameState.players[0], deck: newDeck, hand: [...gameState.players[0].hand, drawnCard[0]] }
        : gameState.players[0],
      drawingPlayerId === 2
        ? { ...gameState.players[1], deck: newDeck, hand: [...gameState.players[1].hand, drawnCard[0]] }
        : gameState.players[1]
    ]
    
    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers
    }

    setGameState(updatedGameState)
    addLog(`Player ${drawingPlayerId} drew a ${drawnCard[0]} card`)
  }, [gameState, activePlayer, addLog])

  const handlePlayCard = useCallback((playingPlayerId: 1 | 2, cardIndex: number) => {
    if (!gameState || playingPlayerId !== activePlayer) {
      addLog(`It's not Player ${playingPlayerId}'s turn`)
      return
    }

    // Check if there are pending selections
    if (mountainTargetSelection || forestTargetSelection || swampSelection || islandSelection) {
      addLog('Complete the current card effect before playing another card')
      return
    }

    const player = gameState.players[playingPlayerId - 1]
    if (cardIndex < 0 || cardIndex >= player.hand.length) return

    const cardToPlay = player.hand[cardIndex]
    const newHand = player.hand.filter((_, idx) => idx !== cardIndex)
    const newBoard = [...player.board, cardToPlay]

    let updatedDeck = player.deck
    let updatedHand = newHand
    let updatedGraveyard = player.graveyard
    let effectMessage = ''
    let newMountainTargetSelection: { activePlayer: 1 | 2; cardIndex: number } | null = null
    let newForestTargetSelection: { activePlayer: 1 | 2 } | null = null
    let newSwampSelection: { activePlayer: 1 | 2; phase: 'reveal' | 'discard'; revealedCards: number[] } | null = null
    let newIslandSelection: { activePlayer: 1 | 2; revealedCard: CardType } | null = null

    // Plains: Draw one card
    if (cardToPlay === 'Plains') {
      if (player.deck.length > 0) {
        const [newDeck, drawnCard] = drawCards(player.deck, 1)
        updatedDeck = newDeck
        updatedHand = [...newHand, drawnCard[0]]
        effectMessage = ` and drew ${drawnCard[0]}`
        addLog(`Player ${playingPlayerId} drew ${drawnCard[0]} from Plains effect`)
      } else {
        effectMessage = ' (no cards left in deck)'
        addLog(`Player ${playingPlayerId} tried to draw from Plains but deck is empty`)
      }
    }

    // Island: Reveal top card, then choose to discard or put back
    if (cardToPlay === 'Island') {
      if (player.deck.length > 0) {
        const [newDeck, revealedCard] = drawCards(player.deck, 1)
        // Store the revealed card and new deck state
        newIslandSelection = { activePlayer: playingPlayerId, revealedCard: revealedCard[0] }
        updatedDeck = newDeck // Remove the card from deck temporarily
        addLog(`Player ${playingPlayerId} played Island - revealed ${revealedCard[0]} from top of deck`)
        addLog(`Choose to discard ${revealedCard[0]} or put it back on top of deck`)
      } else {
        effectMessage = ' (no cards left in deck)'
        addLog(`Player ${playingPlayerId} played Island but deck is empty`)
      }
    }

    // Mountain: Requires target selection
    if (cardToPlay === 'Mountain') {
      const opponentId = playingPlayerId === 1 ? 2 : 1
      const opponent = gameState.players[opponentId - 1]
      
      if (opponent.board.length === 0) {
        effectMessage = ' (opponent has no cards on board)'
        addLog(`Player ${playingPlayerId} played Mountain but opponent has no cards to target`)
      } else {
        newMountainTargetSelection = { activePlayer: playingPlayerId, cardIndex: newBoard.length - 1 }
        addLog(`Player ${playingPlayerId} played Mountain - select an opponent's card to discard`)
      }
    }

    // Forest: Requires graveyard target selection
    if (cardToPlay === 'Forest') {
      if (player.graveyard.length === 0) {
        effectMessage = ' (graveyard is empty)'
        addLog(`Player ${playingPlayerId} played Forest but graveyard is empty`)
      } else {
        newForestTargetSelection = { activePlayer: playingPlayerId }
        addLog(`Player ${playingPlayerId} played Forest - select a card from graveyard to return to hand`)
      }
    }

    // Swamp: Requires opponent to reveal 3 cards, then player chooses one to discard
    if (cardToPlay === 'Swamp') {
      const opponentId = playingPlayerId === 1 ? 2 : 1
      const opponent = gameState.players[opponentId - 1]
      
      if (opponent.hand.length < 3) {
        effectMessage = ` (opponent only has ${opponent.hand.length} card(s) in hand)`
        addLog(`Player ${playingPlayerId} played Swamp but opponent doesn't have 3 cards to reveal`)
      } else {
        newSwampSelection = { 
          activePlayer: playingPlayerId, 
          phase: 'reveal',
          revealedCards: []
        }
        addLog(`Player ${playingPlayerId} played Swamp - opponent must reveal 3 cards from hand`)
      }
    }

    const updatedPlayers: [Player, Player] = [
      playingPlayerId === 1 
        ? { ...gameState.players[0], hand: updatedHand, board: newBoard, deck: updatedDeck, graveyard: updatedGraveyard }
        : gameState.players[0],
      playingPlayerId === 2
        ? { ...gameState.players[1], hand: updatedHand, board: newBoard, deck: updatedDeck, graveyard: updatedGraveyard }
        : gameState.players[1]
    ]
    
    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers
    }

    setMountainTargetSelection(newMountainTargetSelection)
    setForestTargetSelection(newForestTargetSelection)
    setSwampSelection(newSwampSelection)
    if (newIslandSelection) {
      setIslandSelection(newIslandSelection)
    }
    setGameState(updatedGameState)

    // Check win condition after playing card
    const playingPlayer = updatedGameState.players[playingPlayerId - 1]
    const winCondition = checkWinCondition(playingPlayer)
    if (winCondition) {
      addLog(`🎉 Player ${playingPlayerId} wins! (${winCondition.reason})`)
      return // Don't end turn if game is won
    }

    if (cardToPlay !== 'Mountain' && cardToPlay !== 'Forest' && cardToPlay !== 'Swamp' && cardToPlay !== 'Island') {
      addLog(`Player ${playingPlayerId} played ${cardToPlay}${effectMessage}`)
    } else if (cardToPlay === 'Mountain' && gameState.players[(playingPlayerId === 1 ? 2 : 1) - 1].board.length === 0) {
      addLog(`Player ${playingPlayerId} played ${cardToPlay}${effectMessage}`)
    } else if (cardToPlay === 'Forest' && player.graveyard.length === 0) {
      addLog(`Player ${playingPlayerId} played ${cardToPlay}${effectMessage}`)
    } else if (cardToPlay === 'Swamp' && gameState.players[(playingPlayerId === 1 ? 2 : 1) - 1].hand.length < 3) {
      addLog(`Player ${playingPlayerId} played ${cardToPlay}${effectMessage}`)
    } else if (cardToPlay === 'Island' && player.deck.length === 0) {
      addLog(`Player ${playingPlayerId} played ${cardToPlay}${effectMessage}`)
    }

    // Auto-end turn after playing a card, unless there are pending selections
    // If there are no pending selections, the card effect is complete and turn should end
    if (!newMountainTargetSelection && !newForestTargetSelection && !newSwampSelection && !newIslandSelection) {
      // Use setTimeout to ensure state updates are complete before ending turn
      // Pass the updated game state directly to avoid stale closure issues
      setTimeout(() => {
        // Draw a card at the start of next turn
        const nextPlayer = playingPlayerId === 1 ? 2 : 1
        const nextPlayerObj = updatedGameState.players[nextPlayer - 1]
        
        if (nextPlayerObj.deck.length > 0) {
          const [newDeck, drawnCard] = drawCards(nextPlayerObj.deck, 1)
          const finalPlayers: [Player, Player] = [
            nextPlayer === 1 
              ? { ...updatedGameState.players[0], deck: newDeck, hand: [...updatedGameState.players[0].hand, drawnCard[0]] }
              : updatedGameState.players[0],
            nextPlayer === 2
              ? { ...updatedGameState.players[1], deck: newDeck, hand: [...updatedGameState.players[1].hand, drawnCard[0]] }
              : updatedGameState.players[1]
          ]
          const finalGameState = { ...updatedGameState, players: finalPlayers }
          setGameState(finalGameState)
          addLog(`Player ${nextPlayer} drew ${drawnCard[0]} at start of turn`)
          
          // Check win condition after drawing
          const nextPlayerWin = checkWinCondition(finalGameState.players[nextPlayer - 1])
          if (nextPlayerWin) {
            addLog(`🎉 Player ${nextPlayer} wins! (${nextPlayerWin.reason})`)
            return
          }
        } else {
          // Still update state even if no card to draw
          setGameState(updatedGameState)
        }

        setActivePlayer(nextPlayer)
        addLog(`Player ${nextPlayer}'s turn`)
      }, 100)
    }
  }, [gameState, activePlayer, mountainTargetSelection, forestTargetSelection, swampSelection, islandSelection, addLog, checkWinCondition, drawCards, setActivePlayer, setGameState])

  const handleMountainTarget = useCallback((targetPlayerId: 1 | 2, cardIndex: number) => {
    if (!gameState || !mountainTargetSelection || mountainTargetSelection.activePlayer !== activePlayer) return
    
    const { activePlayer: effectPlayer } = mountainTargetSelection
    if (targetPlayerId === effectPlayer) return

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
    addLog(`Player ${effectPlayer} discarded ${cardToDiscard} from Player ${targetPlayerId}'s board`)
    
    // Auto-end turn after completing Mountain effect
    setTimeout(() => {
      // Draw a card at the start of next turn
      const nextPlayer = effectPlayer === 1 ? 2 : 1
      const nextPlayerObj = updatedGameState.players[nextPlayer - 1]
      
      if (nextPlayerObj.deck.length > 0) {
        const [newDeck, drawnCard] = drawCards(nextPlayerObj.deck, 1)
        const finalPlayers: [Player, Player] = [
          nextPlayer === 1 
            ? { ...updatedGameState.players[0], deck: newDeck, hand: [...updatedGameState.players[0].hand, drawnCard[0]] }
            : updatedGameState.players[0],
          nextPlayer === 2
            ? { ...updatedGameState.players[1], deck: newDeck, hand: [...updatedGameState.players[1].hand, drawnCard[0]] }
            : updatedGameState.players[1]
        ]
        const finalGameState = { ...updatedGameState, players: finalPlayers }
        setGameState(finalGameState)
        addLog(`Player ${nextPlayer} drew ${drawnCard[0]} at start of turn`)
        
        // Check win condition after drawing
        const nextPlayerWin = checkWinCondition(finalGameState.players[nextPlayer - 1])
        if (nextPlayerWin) {
          addLog(`🎉 Player ${nextPlayer} wins! (${nextPlayerWin.reason})`)
          return
        }
      } else {
        setGameState(updatedGameState)
      }

      setActivePlayer(nextPlayer)
      addLog(`Player ${nextPlayer}'s turn`)
    }, 100)
  }, [gameState, activePlayer, mountainTargetSelection, addLog, drawCards, checkWinCondition, setActivePlayer, setGameState])

  const handleForestTarget = useCallback((targetPlayerId: 1 | 2, cardIndex: number) => {
    if (!gameState || !forestTargetSelection || forestTargetSelection.activePlayer !== activePlayer) return
    
    const { activePlayer: effectPlayer } = forestTargetSelection
    if (targetPlayerId !== effectPlayer) return
    
    const player = gameState.players[targetPlayerId - 1]
    if (cardIndex < 0 || cardIndex >= player.graveyard.length) return

    const cardToReturn = player.graveyard[cardIndex]
    const newGraveyard = player.graveyard.filter((_, idx) => idx !== cardIndex)
    const newHand = [...player.hand, cardToReturn]

    const updatedPlayers: [Player, Player] = [
      targetPlayerId === 1 
        ? { ...gameState.players[0], graveyard: newGraveyard, hand: newHand }
        : gameState.players[0],
      targetPlayerId === 2
        ? { ...gameState.players[1], graveyard: newGraveyard, hand: newHand }
        : gameState.players[1]
    ]
    
    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers
    }

    setGameState(updatedGameState)
    setForestTargetSelection(null)
    addLog(`Player ${effectPlayer} returned ${cardToReturn} from graveyard to hand`)
    
    // Auto-end turn after completing Forest effect
    setTimeout(() => {
      // Draw a card at the start of next turn
      const nextPlayer = effectPlayer === 1 ? 2 : 1
      const nextPlayerObj = updatedGameState.players[nextPlayer - 1]
      
      if (nextPlayerObj.deck.length > 0) {
        const [newDeck, drawnCard] = drawCards(nextPlayerObj.deck, 1)
        const finalPlayers: [Player, Player] = [
          nextPlayer === 1 
            ? { ...updatedGameState.players[0], deck: newDeck, hand: [...updatedGameState.players[0].hand, drawnCard[0]] }
            : updatedGameState.players[0],
          nextPlayer === 2
            ? { ...updatedGameState.players[1], deck: newDeck, hand: [...updatedGameState.players[1].hand, drawnCard[0]] }
            : updatedGameState.players[1]
        ]
        const finalGameState = { ...updatedGameState, players: finalPlayers }
        setGameState(finalGameState)
        addLog(`Player ${nextPlayer} drew ${drawnCard[0]} at start of turn`)
        
        // Check win condition after drawing
        const nextPlayerWin = checkWinCondition(finalGameState.players[nextPlayer - 1])
        if (nextPlayerWin) {
          addLog(`🎉 Player ${nextPlayer} wins! (${nextPlayerWin.reason})`)
          return
        }
      } else {
        setGameState(updatedGameState)
      }

      setActivePlayer(nextPlayer)
      addLog(`Player ${nextPlayer}'s turn`)
    }, 100)
  }, [gameState, activePlayer, forestTargetSelection, addLog, drawCards, checkWinCondition, setActivePlayer, setGameState])

  const handleSwampReveal = useCallback((opponentId: 1 | 2, cardIndex: number) => {
    if (!gameState || !swampSelection || swampSelection.phase !== 'reveal') return
    
    const { activePlayer: effectPlayer, revealedCards } = swampSelection
    const opponentPlayerId = effectPlayer === 1 ? 2 : 1
    
    if (opponentId !== opponentPlayerId) return
    
    const opponent = gameState.players[opponentId - 1]
    if (cardIndex < 0 || cardIndex >= opponent.hand.length) return
    
    let newRevealedCards: number[]
    if (revealedCards.includes(cardIndex)) {
      newRevealedCards = revealedCards.filter(idx => idx !== cardIndex)
    } else if (revealedCards.length < 3) {
      newRevealedCards = [...revealedCards, cardIndex]
    } else {
      return // Already 3 cards revealed
    }

    const newSwampSelection = { ...swampSelection, revealedCards: newRevealedCards }
    setSwampSelection(newSwampSelection)

    if (newRevealedCards.length === 3) {
      addLog(`Opponent revealed 3 cards - Player ${effectPlayer} must choose one to discard`)
      setSwampSelection({ ...newSwampSelection, phase: 'discard' })
    }
  }, [gameState, swampSelection, addLog])

  const handleSwampDiscard = useCallback((opponentId: 1 | 2, cardIndex: number) => {
    if (!gameState || !swampSelection || swampSelection.phase !== 'discard') return
    
    const { activePlayer: effectPlayer, revealedCards } = swampSelection
    const opponentPlayerId = effectPlayer === 1 ? 2 : 1
    
    if (opponentId !== opponentPlayerId) return
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

    setGameState(updatedGameState)
    setSwampSelection(null)
    addLog(`Player ${effectPlayer} discarded ${cardToDiscard} from Player ${opponentId}'s hand`)
    
    // Auto-end turn after completing Swamp effect
    setTimeout(() => {
      // Draw a card at the start of next turn
      const nextPlayer = effectPlayer === 1 ? 2 : 1
      const nextPlayerObj = updatedGameState.players[nextPlayer - 1]
      
      if (nextPlayerObj.deck.length > 0) {
        const [newDeck, drawnCard] = drawCards(nextPlayerObj.deck, 1)
        const finalPlayers: [Player, Player] = [
          nextPlayer === 1 
            ? { ...updatedGameState.players[0], deck: newDeck, hand: [...updatedGameState.players[0].hand, drawnCard[0]] }
            : updatedGameState.players[0],
          nextPlayer === 2
            ? { ...updatedGameState.players[1], deck: newDeck, hand: [...updatedGameState.players[1].hand, drawnCard[0]] }
            : updatedGameState.players[1]
        ]
        const finalGameState = { ...updatedGameState, players: finalPlayers }
        setGameState(finalGameState)
        addLog(`Player ${nextPlayer} drew ${drawnCard[0]} at start of turn`)
        
        // Check win condition after drawing
        const nextPlayerWin = checkWinCondition(finalGameState.players[nextPlayer - 1])
        if (nextPlayerWin) {
          addLog(`🎉 Player ${nextPlayer} wins! (${nextPlayerWin.reason})`)
          return
        }
      } else {
        setGameState(updatedGameState)
      }

      setActivePlayer(nextPlayer)
      addLog(`Player ${nextPlayer}'s turn`)
    }, 100)
  }, [gameState, swampSelection, addLog, drawCards, checkWinCondition, setActivePlayer, setGameState])

  const handleIslandChoice = useCallback((choice: 'discard' | 'putBack') => {
    if (!gameState || !islandSelection || islandSelection.activePlayer !== activePlayer) return
    
    const { activePlayer: effectPlayer, revealedCard } = islandSelection
    const player = gameState.players[effectPlayer - 1]
    
    let updatedGameState: GameState
    
    if (choice === 'discard') {
      // Discard the revealed card
      const newGraveyard = [...player.graveyard, revealedCard]
      const updatedPlayers: [Player, Player] = [
        effectPlayer === 1 
          ? { ...gameState.players[0], graveyard: newGraveyard }
          : gameState.players[0],
        effectPlayer === 2
          ? { ...gameState.players[1], graveyard: newGraveyard }
          : gameState.players[1]
      ]
      updatedGameState = { ...gameState, players: updatedPlayers }
      setGameState(updatedGameState)
      setIslandSelection(null)
      addLog(`Player ${effectPlayer} discarded ${revealedCard} from Island effect`)
    } else {
      // drawCards pops from end, so "top" = last element. Put card on top = append to end.
      const newDeck = [...player.deck, revealedCard]
      const updatedPlayers: [Player, Player] = [
        effectPlayer === 1 
          ? { ...gameState.players[0], deck: newDeck }
          : gameState.players[0],
        effectPlayer === 2
          ? { ...gameState.players[1], deck: newDeck }
          : gameState.players[1]
      ]
      updatedGameState = { ...gameState, players: updatedPlayers }
      setGameState(updatedGameState)
      setIslandSelection(null)
      addLog(`Player ${effectPlayer} put ${revealedCard} back on top of deck`)
    }
    
    // Auto-end turn after Island choice
    setTimeout(() => {
      const nextPlayer = effectPlayer === 1 ? 2 : 1
      const nextPlayerObj = updatedGameState.players[nextPlayer - 1]
      
      if (nextPlayerObj.deck.length > 0) {
        const [newDeck, drawnCard] = drawCards(nextPlayerObj.deck, 1)
        const finalPlayers: [Player, Player] = [
          nextPlayer === 1 
            ? { ...updatedGameState.players[0], deck: newDeck, hand: [...updatedGameState.players[0].hand, drawnCard[0]] }
            : updatedGameState.players[0],
          nextPlayer === 2
            ? { ...updatedGameState.players[1], deck: newDeck, hand: [...updatedGameState.players[1].hand, drawnCard[0]] }
            : updatedGameState.players[1]
        ]
        const finalState = { ...updatedGameState, players: finalPlayers }
        setGameState(finalState)
        addLog(`Player ${nextPlayer} drew ${drawnCard[0]} at start of turn`)
        
        const nextPlayerWin = checkWinCondition(finalState.players[nextPlayer - 1])
        if (nextPlayerWin) {
          addLog(`🎉 Player ${nextPlayer} wins! (${nextPlayerWin.reason})`)
          return
        }
      } else {
        setGameState(updatedGameState)
      }

      setActivePlayer(nextPlayer)
      addLog(`Player ${nextPlayer}'s turn`)
    }, 100)
  }, [gameState, activePlayer, islandSelection, addLog, drawCards, checkWinCondition, setActivePlayer, setGameState])

  return {
    gameState,
    setGameState,
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
    addLog,
  }
}

