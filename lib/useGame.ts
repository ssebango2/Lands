'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { GameState, Player, drawCards, LandType, StackEntry } from './gameLogic'

/** Check if player has won: 1 of each land or 5 of one type. Inlined to avoid import/bundling issues. */
function checkWinBeforeAdvance(player: Player, playerId: 1 | 2): { playerId: 1 | 2; reason: string } | null {
  const landTypes: LandType[] = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']
  if (landTypes.every(type => player.board.includes(type))) {
    return { playerId, reason: 'Domain (1 of each basic land type)' }
  }
  for (const landType of landTypes) {
    if (player.board.filter(card => card === landType).length >= 5) {
      return { playerId, reason: `5 ${landType}s` }
    }
  }
  return null
}
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
  const stateVersionRef = useRef<number>(0)
  useEffect(() => {
    stateVersionRef.current = gameState?.stateVersion ?? 0
  }, [gameState])

  // Derive from synced gameState so both players see pending effects
  const pe = gameState?.pendingEffect
  const mountainTargetSelection = pe?.type === 'mountain'
    ? { activePlayer: pe.activePlayer as 1 | 2, cardIndex: pe.cardIndex }
    : null
  const forestTargetSelection = pe?.type === 'forest'
    ? { activePlayer: pe.activePlayer as 1 | 2 }
    : null
  const swampSelection = pe?.type === 'swamp'
    ? { activePlayer: pe.activePlayer as 1 | 2, phase: pe.phase, revealedCards: pe.revealedCards }
    : null
  const islandSelection = pe?.type === 'island'
    ? { activePlayer: pe.activePlayer as 1 | 2, revealedCard: pe.revealedCard }
    : null
  const counterSelection = pe?.type === 'counterSelect'
    ? { priorityHolder: pe.priorityHolder as 1 | 2, spell: pe.spell, counterCount: pe.counterCount, selectedIndices: pe.selectedIndices }
    : null

  const stack = gameState?.stack ?? []
  const priorityHolder = gameState?.priorityHolder ?? null

  const addLog = useCallback((message: string) => {
    setGameLog(prev => [...prev, message])
  }, [])

  const updateGameStateAndSync = useCallback((newState: GameState) => {
    setGameState(newState)
    if (socket) {
      const fromVersion = stateVersionRef.current
      socket.emit('game:state-update', { gameState: newState, fromVersion })
    }
  }, [socket, setGameState])

  // Advance to next player's turn: draw for them (except turn 1 for player 1)
  const advanceTurn = useCallback((state: GameState): GameState => {
    const nextPlayer = state.activePlayer === 1 ? 2 : 1
    const nextTurnNumber = state.turnNumber + 1
    const nextPlayerObj = state.players[nextPlayer - 1]

    // Draw for next player (Player 1 doesn't draw on turn 1)
    if (nextPlayerObj.deck.length > 0 && !(nextPlayer === 1 && nextTurnNumber === 1)) {
      const [newDeck, drawnCard] = drawCards(nextPlayerObj.deck, 1)
      const updatedPlayers: [Player, Player] = [
        nextPlayer === 1
          ? { ...state.players[0], deck: newDeck, hand: [...state.players[0].hand, drawnCard[0]] }
          : state.players[0],
        nextPlayer === 2
          ? { ...state.players[1], deck: newDeck, hand: [...state.players[1].hand, drawnCard[0]] }
          : state.players[1],
      ]
      return { ...state, players: updatedPlayers, activePlayer: nextPlayer, turnNumber: nextTurnNumber, stack: [], priorityHolder: undefined }
    }
    return { ...state, activePlayer: nextPlayer, turnNumber: nextTurnNumber, stack: [], priorityHolder: undefined }
  }, [])

  const handleDrawCard = useCallback((targetPlayerId: 1 | 2) => {
    if (!gameState || !playerId || targetPlayerId !== playerId) return
    if ((gameState.activePlayer ?? 1) !== playerId) return

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

  // Check if player can pay counter cost. First: 1 Island + 1 same type (or 2 Islands); subsequent: 2 Islands
  const canPayCounterCost = useCallback((p: Player, spell: LandType, counterCount: number): boolean => {
    const islands = p.hand.filter(c => c === 'Island').length
    const sameType = p.hand.filter(c => c === spell).length
    if (counterCount === 0) {
      if (spell === 'Island') return islands >= 2
      return islands >= 1 && sameType >= 1
    }
    return islands >= 2
  }, [])

  const handlePlayCard = useCallback((targetPlayerId: 1 | 2, cardIndex: number) => {
    if (!gameState || !playerId || targetPlayerId !== playerId) return
    if ((gameState.activePlayer ?? 1) !== playerId) return
    // Can't play land if stack has items (counter war in progress)
    if ((gameState.stack ?? []).length > 0) return
    // Can't play land while pending effects (e.g. Swamp reveal, Mountain target) need to be resolved
    if (mountainTargetSelection || forestTargetSelection || swampSelection || islandSelection || counterSelection) {
      addLog('Complete the current card effect before playing another card')
      return
    }

    const player = gameState.players[playerId - 1]
    if (cardIndex < 0 || cardIndex >= player.hand.length) return

    const cardToPlay = player.hand[cardIndex] as LandType
    const newHand = player.hand.filter((_, idx) => idx !== cardIndex)

    // Put land on stack - priority passes to opponent
    const stackEntry = { spell: cardToPlay, controller: playerId as 1 | 2, counterCount: 0 }
    const newStack = [...(gameState.stack ?? []), stackEntry]
    const opponentId = playerId === 1 ? 2 : 1

    const updatedPlayers: [Player, Player] = [
      playerId === 1
        ? { ...gameState.players[0], hand: newHand }
        : gameState.players[0],
      playerId === 2
        ? { ...gameState.players[1], hand: newHand }
        : gameState.players[1],
    ]

    const stateToSync: GameState = {
      ...gameState,
      players: updatedPlayers,
      stack: newStack,
      priorityHolder: opponentId,
    }

    updateGameStateAndSync(stateToSync)
    addLog(`Player ${playerId} played ${cardToPlay} - awaiting response`)
  }, [gameState, playerId, mountainTargetSelection, forestTargetSelection, swampSelection, islandSelection, counterSelection, addLog, updateGameStateAndSync])

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
      players: updatedPlayers,
      pendingEffect: null,
    }
    const ap = updatedGameState.activePlayer ?? 1
    const winCheck = checkWinBeforeAdvance(updatedGameState.players[ap - 1], ap)
    if (winCheck) {
      addLog(`🎉 Player ${winCheck.playerId} wins! (${winCheck.reason})`)
      updateGameStateAndSync({ ...updatedGameState, winner: winCheck.playerId })
      return
    }
    const nextState = advanceTurn({ ...updatedGameState, activePlayer: ap, turnNumber: updatedGameState.turnNumber ?? 1 })
    updateGameStateAndSync(nextState)
    addLog(`Player ${activePlayer} discarded ${cardToDiscard} from Player ${targetPlayerId}'s board`)
    addLog(`Player ${nextState.activePlayer}'s turn`)
  }, [gameState, mountainTargetSelection, playerId, addLog, updateGameStateAndSync, advanceTurn])

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
      players: updatedPlayers,
      pendingEffect: null,
    }
    const ap = updatedGameState.activePlayer ?? 1
    const winCheck = checkWinBeforeAdvance(updatedGameState.players[ap - 1], ap)
    if (winCheck) {
      addLog(`🎉 Player ${winCheck.playerId} wins! (${winCheck.reason})`)
      updateGameStateAndSync({ ...updatedGameState, winner: winCheck.playerId })
      return
    }
    const nextState = advanceTurn({ ...updatedGameState, activePlayer: ap, turnNumber: updatedGameState.turnNumber ?? 1 })
    updateGameStateAndSync(nextState)
    addLog(`Player ${activePlayer} returned ${cardToReturn} from graveyard to hand`)
    addLog(`Player ${nextState.activePlayer}'s turn`)
  }, [gameState, forestTargetSelection, playerId, addLog, updateGameStateAndSync, advanceTurn])

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
      updateGameStateAndSync({ ...gameState, pendingEffect: { type: 'swamp', activePlayer, phase: 'reveal', revealedCards: newRevealedCards } })
    } else if (revealedCards.length < 3) {
      const newRevealedCards = [...revealedCards, cardIndex]
      const newPhase = newRevealedCards.length === 3 ? 'discard' as const : 'reveal' as const
      if (newRevealedCards.length === 3) {
        addLog(`Opponent revealed 3 cards - Player ${activePlayer} must choose one to discard`)
      }
      updateGameStateAndSync({ ...gameState, pendingEffect: { type: 'swamp', activePlayer, phase: newPhase, revealedCards: newRevealedCards } })
    }
  }, [gameState, swampSelection, playerId, addLog, updateGameStateAndSync])

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
      players: updatedPlayers,
      pendingEffect: null,
    }
    const ap = updatedGameState.activePlayer ?? 1
    const winCheck = checkWinBeforeAdvance(updatedGameState.players[ap - 1], ap)
    if (winCheck) {
      addLog(`🎉 Player ${winCheck.playerId} wins! (${winCheck.reason})`)
      updateGameStateAndSync({ ...updatedGameState, winner: winCheck.playerId })
      return
    }
    const nextState = advanceTurn({ ...updatedGameState, activePlayer: ap, turnNumber: updatedGameState.turnNumber ?? 1 })
    updateGameStateAndSync(nextState)
    addLog(`Player ${activePlayer} discarded ${cardToDiscard} from Player ${opponentId}'s hand`)
    addLog(`Player ${nextState.activePlayer}'s turn`)
  }, [gameState, swampSelection, playerId, addLog, updateGameStateAndSync, advanceTurn])

  // Resolve top of stack: even counterCount = to board + ETB, odd = to graveyard
  const resolveStackTop = useCallback((state: GameState): GameState => {
    const st = state.stack ?? []
    if (st.length === 0) return state
    const top = st[st.length - 1]
    const newStack = st.slice(0, -1)
    const controller = top.controller
    const spell = top.spell
    const resolved = top.counterCount % 2 === 0 // even = resolve

    let nextState: GameState = { ...state, stack: newStack.length > 0 ? newStack : undefined, priorityHolder: newStack.length > 0 ? state.priorityHolder : undefined }
    const player = nextState.players[controller - 1]
    let updatedPlayers: [Player, Player]

    if (resolved) {
      // Add to board, run ETB
      const newBoard = [...player.board, spell]
      updatedPlayers = [
        controller === 1 ? { ...nextState.players[0], board: newBoard } : nextState.players[0],
        controller === 2 ? { ...nextState.players[1], board: newBoard } : nextState.players[1],
      ]
      let pendingEffect: GameState['pendingEffect'] = null
      let updatedDeck = player.deck
      let updatedHand = player.hand

      // ETB effects
      if (spell === 'Plains') {
        if (player.deck.length > 0) {
          const [newDeck, drawn] = drawCards(player.deck, 1)
          updatedDeck = newDeck
          updatedHand = [...player.hand, drawn[0]]
          addLog(`Player ${controller} drew ${drawn[0]} from Plains`)
        }
      } else if (spell === 'Mountain') {
        const opponentId = controller === 1 ? 2 : 1
        const opponent = nextState.players[opponentId - 1]
        if (opponent.board.length > 0) {
          pendingEffect = { type: 'mountain', activePlayer: controller as 1 | 2, cardIndex: newBoard.length - 1 }
        }
      } else if (spell === 'Forest') {
        if (player.graveyard.length > 0) {
          pendingEffect = { type: 'forest', activePlayer: controller as 1 | 2 }
        }
      } else if (spell === 'Swamp') {
        const opponentId = controller === 1 ? 2 : 1
        const opponent = nextState.players[opponentId - 1]
        if (opponent.hand.length > 0) {
          if (opponent.hand.length <= 3) {
            // Opponent has 3 or fewer cards — auto-reveal all of them and go straight to discard
            const allIndices = opponent.hand.map((_, i) => i)
            pendingEffect = { type: 'swamp', activePlayer: controller as 1 | 2, phase: 'discard', revealedCards: allIndices }
            addLog(`Opponent has ${opponent.hand.length} card(s) — all automatically revealed. Player ${controller} must choose one to discard`)
          } else {
            pendingEffect = { type: 'swamp', activePlayer: controller as 1 | 2, phase: 'reveal', revealedCards: [] }
          }
        }
      } else if (spell === 'Island') {
        if (player.deck.length > 0) {
          const [newDeck, drawn] = drawCards(player.deck, 1)
          updatedDeck = newDeck
          pendingEffect = { type: 'island', activePlayer: controller as 1 | 2, revealedCard: drawn[0] }
        }
      }

      updatedPlayers = [
        controller === 1 ? { ...updatedPlayers[0], hand: updatedHand, deck: updatedDeck } : updatedPlayers[0],
        controller === 2 ? { ...updatedPlayers[1], hand: updatedHand, deck: updatedDeck } : updatedPlayers[1],
      ]
      nextState = { ...nextState, players: updatedPlayers, pendingEffect }
    } else {
      const newGraveyard = [...player.graveyard, spell]
      updatedPlayers = [
        controller === 1 ? { ...nextState.players[0], graveyard: newGraveyard } : nextState.players[0],
        controller === 2 ? { ...nextState.players[1], graveyard: newGraveyard } : nextState.players[1],
      ]
      nextState = { ...nextState, players: updatedPlayers }
      addLog(`${spell} was countered and put in graveyard`)
    }
    return nextState
  }, [addLog])

  const handlePass = useCallback(() => {
    if (!gameState || !playerId) return
    const st = gameState.stack ?? []
    const ph = gameState.priorityHolder
    const ap = gameState.activePlayer ?? 1

    if (st.length === 0) {
      if (ap !== playerId) return
      addLog(`Player ${playerId} passes (no land played)`)
      const winCheck = checkWinBeforeAdvance(gameState.players[ap - 1], ap)
      if (winCheck) {
        addLog(`🎉 Player ${ap} wins! (${winCheck.reason})`)
        updateGameStateAndSync({ ...gameState, stack: [], priorityHolder: undefined, winner: ap })
        return
      }
      const nextState = advanceTurn({ ...gameState, stack: [], priorityHolder: undefined })
      updateGameStateAndSync(nextState)
      addLog(`Player ${nextState.activePlayer}'s turn`)
      return
    }

    if (ph !== playerId) return
    addLog(`Player ${playerId} passes priority`)
    let nextState = resolveStackTop(gameState)
    if (!nextState.pendingEffect && (nextState.stack ?? []).length === 0) {
      const ap2 = nextState.activePlayer ?? 1
      const winCheck = checkWinBeforeAdvance(nextState.players[ap2 - 1], ap2)
      if (winCheck) {
        addLog(`🎉 Player ${ap2} wins! (${winCheck.reason})`)
        updateGameStateAndSync({ ...nextState, winner: ap2 })
        return
      }
      nextState = advanceTurn({ ...nextState, stack: [], priorityHolder: undefined })
      addLog(`Player ${nextState.activePlayer}'s turn`)
    }
    updateGameStateAndSync(nextState)
  }, [gameState, playerId, addLog, updateGameStateAndSync, advanceTurn, resolveStackTop])

  const handleCounter = useCallback(() => {
    if (!gameState || !playerId) return
    const st = gameState.stack ?? []
    if (st.length === 0) return
    const ph = gameState.priorityHolder
    if (ph !== playerId) return

    const top = st[st.length - 1]
    const counteringPlayer = gameState.players[ph - 1]
    if (!canPayCounterCost(counteringPlayer, top.spell, top.counterCount)) {
      addLog('Cannot counter - insufficient cost (need Islands + matching land or 2 Islands)')
      return
    }

    updateGameStateAndSync({
      ...gameState,
      pendingEffect: { type: 'counterSelect', priorityHolder: ph, spell: top.spell, counterCount: top.counterCount, selectedIndices: [] },
    })
    addLog(`Player ${ph} chooses to counter - select cards to pay cost`)
  }, [gameState, playerId, canPayCounterCost, addLog, updateGameStateAndSync])

  const handleCounterSelectCard = useCallback((cardIndex: number) => {
    if (!gameState || !counterSelection || !playerId) return
    if (counterSelection.priorityHolder !== playerId) return

    const { selectedIndices } = counterSelection
    const idx = selectedIndices.indexOf(cardIndex)
    let newIndices: number[]
    if (idx >= 0) {
      newIndices = selectedIndices.filter(i => i !== cardIndex)
    } else if (selectedIndices.length < 2) {
      newIndices = [...selectedIndices, cardIndex].sort((a, b) => a - b)
    } else return

    updateGameStateAndSync({
      ...gameState,
      pendingEffect: { type: 'counterSelect' as const, priorityHolder: counterSelection.priorityHolder, spell: counterSelection.spell, counterCount: counterSelection.counterCount, selectedIndices: newIndices },
    })
  }, [gameState, counterSelection, playerId, updateGameStateAndSync])

  const handleCounterCostSubmit = useCallback(() => {
    if (!gameState || !counterSelection || !playerId) return
    if (counterSelection.priorityHolder !== playerId) return
    const { priorityHolder: ph, spell, counterCount, selectedIndices } = counterSelection
    if (selectedIndices.length !== 2) return

    const player = gameState.players[ph - 1]
    const [c1, c2] = selectedIndices.map(i => player.hand[i]).sort()
    const cards = [player.hand[selectedIndices[0]], player.hand[selectedIndices[1]]]
    const hasIsland = cards.includes('Island')
    const hasSpellType = cards.includes(spell)

    const valid = counterCount === 0
      ? (spell === 'Island' ? cards.filter(c => c === 'Island').length === 2 : hasIsland && hasSpellType)
      : cards.filter(c => c === 'Island').length === 2

    if (!valid) {
      addLog('Invalid counter cost - select 1 Island + 1 of same type, or 2 Islands')
      return
    }

    const toDiscard = selectedIndices.sort((a, b) => b - a)
    let newHand = [...player.hand]
    let newGraveyard = [...player.graveyard]
    toDiscard.forEach(i => {
      newGraveyard = [...newGraveyard, newHand[i]]
      newHand = newHand.filter((_, idx) => idx !== i)
    })

    const updatedPlayers: [Player, Player] = [
      ph === 1 ? { ...gameState.players[0], hand: newHand, graveyard: newGraveyard } : gameState.players[0],
      ph === 2 ? { ...gameState.players[1], hand: newHand, graveyard: newGraveyard } : gameState.players[1],
    ]

    const st = [...(gameState.stack ?? [])]
    const top = { ...st[st.length - 1], counterCount: st[st.length - 1].counterCount + 1 }
    st[st.length - 1] = top
    const otherPlayer = ph === 1 ? 2 : 1
    const stateToSync: GameState = {
      ...gameState,
      players: updatedPlayers,
      stack: st,
      priorityHolder: otherPlayer,
      pendingEffect: null,
    }
    updateGameStateAndSync(stateToSync)
    addLog(`Player ${ph} countered with ${cards.join(' + ')}`)
    addLog(`Counter count: ${top.counterCount} - Player ${otherPlayer}'s priority`)
  }, [gameState, counterSelection, playerId, addLog, updateGameStateAndSync])

  const handleIslandChoice = useCallback((choice: 'discard' | 'putBack') => {
    if (!gameState || !islandSelection || !playerId) return
    if (islandSelection.activePlayer !== playerId) return

    const { activePlayer, revealedCard } = islandSelection
    const player = gameState.players[activePlayer - 1]

    let updatedGameState: GameState
    if (choice === 'discard') {
      const newGraveyard = [...player.graveyard, revealedCard]
      const updatedPlayers: [Player, Player] = [
        activePlayer === 1 ? { ...gameState.players[0], graveyard: newGraveyard } : gameState.players[0],
        activePlayer === 2 ? { ...gameState.players[1], graveyard: newGraveyard } : gameState.players[1],
      ]
      updatedGameState = { ...gameState, players: updatedPlayers, pendingEffect: null }
      addLog(`Player ${activePlayer} discarded ${revealedCard} from Island effect`)
    } else {
      // drawCards pops from end, so "top" = last element. Put card on top = append to end.
      const newDeck = [...player.deck, revealedCard]
      const updatedPlayers: [Player, Player] = [
        activePlayer === 1 ? { ...gameState.players[0], deck: newDeck } : gameState.players[0],
        activePlayer === 2 ? { ...gameState.players[1], deck: newDeck } : gameState.players[1],
      ]
      updatedGameState = { ...gameState, players: updatedPlayers, pendingEffect: null }
      addLog(`Player ${activePlayer} put ${revealedCard} back on top of deck`)
    }
    // Use Island controller (activePlayer from islandSelection) for advance - not state.activePlayer, which can be stale in online sync
    const effectPlayer = islandSelection.activePlayer
    const winCheck = checkWinBeforeAdvance(updatedGameState.players[effectPlayer - 1], effectPlayer)
    if (winCheck) {
      addLog(`🎉 Player ${winCheck.playerId} wins! (${winCheck.reason})`)
      updateGameStateAndSync({ ...updatedGameState, winner: winCheck.playerId })
      return
    }
    const nextState = advanceTurn({ ...updatedGameState, activePlayer: effectPlayer, turnNumber: updatedGameState.turnNumber ?? 1 })
    updateGameStateAndSync(nextState)
    addLog(`Player ${nextState.activePlayer}'s turn`)
  }, [gameState, islandSelection, playerId, addLog, updateGameStateAndSync, advanceTurn])

  const handleEndTurn = useCallback(() => {
    if (!gameState || !playerId) return
    if ((gameState.activePlayer ?? 1) !== playerId) return
    if (mountainTargetSelection || forestTargetSelection || swampSelection || islandSelection || counterSelection) {
      addLog('Cannot end turn - resolve pending card effects first')
      return
    }
    if ((gameState.stack ?? []).length > 0 && gameState.priorityHolder === playerId) {
      addLog('Cannot end turn - pass or counter the spell on stack first')
      return
    }
    const ap = gameState.activePlayer ?? 1
    const winCheck = checkWinBeforeAdvance(gameState.players[ap - 1], ap)
    if (winCheck) {
      addLog(`🎉 Player ${winCheck.playerId} wins! (${winCheck.reason})`)
      updateGameStateAndSync({ ...gameState, winner: winCheck.playerId })
      return
    }
    const nextState = advanceTurn({ ...gameState, activePlayer: ap, turnNumber: gameState.turnNumber ?? 1 })
    updateGameStateAndSync(nextState)
    addLog(`Player ${nextState.activePlayer}'s turn`)
  }, [gameState, playerId, mountainTargetSelection, forestTargetSelection, swampSelection, islandSelection, counterSelection, addLog, updateGameStateAndSync, advanceTurn])

  return {
    activePlayer: gameState?.activePlayer ?? 1,
    handleEndTurn,
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
    islandSelection,
    handleIslandChoice,
    stack,
    priorityHolder,
    canPayCounterCost,
    handlePass,
    handleCounter,
    handleCounterSelectCard,
    handleCounterCostSubmit,
    counterSelection,
  }
}

