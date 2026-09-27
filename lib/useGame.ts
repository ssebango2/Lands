'use client'

import { useCallback, useEffect, useRef } from 'react'
import io from 'socket.io-client'
import { GameState, LandType, Player } from './gameLogic'

type SocketType = ReturnType<typeof io>

interface UseGameProps {
  socket: SocketType | null
  playerId: 1 | 2 | null
  gameState: GameState | null
}

type Intent =
  | { type: 'playCard'; cardIndex: number }
  | { type: 'selectTarget'; targetPlayerId: 1 | 2; cardIndex: number; effectId: number }
  | { type: 'pass' }
  | { type: 'counter' }
  | { type: 'swampReveal'; cardIndex: number }
  | { type: 'swampDiscard'; cardIndex: number }
  | { type: 'islandChoice'; choice: 'discard' | 'putBack' }
  | { type: 'handLimitDiscard'; cardIndex: number }
  | { type: 'endTurn' }

/** Same rule as lib/engine.js; used only to decide whether to show the Counter button. */
export function canPayCounterCost(p: Player, spell: LandType, counterCount: number): boolean {
  const islands = p.hand.filter(c => c === 'Island').length
  if (counterCount === 0 && spell !== 'Island') return islands >= 1 && p.hand.includes(spell)
  return islands >= 2
}

/**
 * Online play: the server runs the rules (lib/engine.js). This hook only
 * derives view state from the synced game state and sends intents tagged with
 * the version they were made against, so stale or repeated clicks are refused.
 */
export function useGame({ socket, playerId, gameState }: UseGameProps) {
  const sentForVersionRef = useRef<number | null>(null)
  useEffect(() => {
    sentForVersionRef.current = null
  }, [gameState])

  const send = useCallback((intent: Intent) => {
    if (!socket || !gameState || !playerId) return
    const fromVersion = gameState.stateVersion ?? 0
    // One intent per state version; the next broadcast clears the latch.
    if (sentForVersionRef.current === fromVersion) return
    sentForVersionRef.current = fromVersion
    socket.emit('game:intent', { intent, fromVersion })
  }, [socket, gameState, playerId])

  const te = gameState?.targetedEffect ?? null
  const choosingTarget = te?.phase === 'AWAITING_TARGET_SELECTION'
  const mountainTargetSelection = choosingTarget && te.spell === 'Mountain' ? { activePlayer: te.controller } : null
  const forestTargetSelection = choosingTarget && te.spell === 'Forest' ? { activePlayer: te.controller } : null

  const pe = gameState?.pendingEffect
  const swampSelection = pe?.type === 'swamp'
    ? { activePlayer: pe.activePlayer, phase: pe.phase, revealedCards: pe.revealedCards }
    : null
  const islandSelection = pe?.type === 'island'
    ? { activePlayer: pe.activePlayer, revealedCard: pe.revealedCard }
    : null
  const handLimitSelection = pe?.type === 'handLimit'
    ? { playerId: pe.playerId, discardCount: pe.discardCount }
    : null
  const handlePlayCard = useCallback((ownerId: 1 | 2, cardIndex: number) => {
    if (ownerId !== playerId) return
    send({ type: 'playCard', cardIndex })
  }, [playerId, send])

  const selectTarget = useCallback((targetPlayerId: 1 | 2, cardIndex: number) => {
    if (!te) return
    send({ type: 'selectTarget', targetPlayerId, cardIndex, effectId: te.id })
  }, [te, send])

  const handleSwampReveal = useCallback((_ownerId: 1 | 2, cardIndex: number) => {
    send({ type: 'swampReveal', cardIndex })
  }, [send])

  const handleSwampDiscard = useCallback((_ownerId: 1 | 2, cardIndex: number) => {
    send({ type: 'swampDiscard', cardIndex })
  }, [send])

  const setAutoPass = useCallback((enabled: boolean) => {
    socket?.emit('game:set-auto-pass', { enabled })
  }, [socket])

  const handleIslandChoice = useCallback((choice: 'discard' | 'putBack') => send({ type: 'islandChoice', choice }), [send])
  const handleHandLimitDiscard = useCallback((cardIndex: number) => send({ type: 'handLimitDiscard', cardIndex }), [send])
  const handlePass = useCallback(() => send({ type: 'pass' }), [send])
  const handleCounter = useCallback(() => send({ type: 'counter' }), [send])
  const handleEndTurn = useCallback(() => send({ type: 'endTurn' }), [send])

  return {
    activePlayer: gameState?.activePlayer ?? 1,
    gameLog: gameState?.log ?? [],
    targetedEffect: te,
    mountainTargetSelection,
    forestTargetSelection,
    swampSelection,
    islandSelection,
    handLimitSelection,
    stack: gameState?.stack ?? [],
    priorityHolder: gameState?.priorityHolder ?? null,
    autoPass: !!(playerId && gameState?.autoPass?.[playerId]),
    canPayCounterCost,
    handlePlayCard,
    handleMountainTarget: selectTarget,
    handleForestTarget: selectTarget,
    handleSwampReveal,
    handleSwampDiscard,
    handleIslandChoice,
    handleHandLimitDiscard,
    handlePass,
    handleCounter,
    handleEndTurn,
    setAutoPass,
  }
}
