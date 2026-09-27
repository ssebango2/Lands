'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { GameState } from './gameLogic'

export type IntroPhase = 'idle' | 'shuffle' | 'dealing' | 'complete'

const OPENING_HAND_SIZE = 4
const FULL_DECK_SIZE = 25
const SHUFFLE_MS = 1100
const DEAL_STAGGER_MS = 280
const DEAL_TAIL_MS = 350

/** True when this looks like a fresh game that should play the opening ritual. */
export function shouldPlayOpeningIntro(gameState: GameState): boolean {
  if (gameState.turnNumber !== 1) return false
  if (gameState.stack && gameState.stack.length > 0) return false
  return gameState.players.every(
    (p) =>
      p.board.length === 0 &&
      p.graveyard.length === 0 &&
      p.hand.length === OPENING_HAND_SIZE
  )
}

/**
 * Client-only opening ritual: shuffle decks, then deal opening hands one-by-one.
 * Server/local state can already be fully dealt — this only controls presentation.
 */
export function useGameIntro(active: boolean, sessionKey: string | number | null) {
  const [phase, setPhase] = useState<IntroPhase>('idle')
  const [dealtCount, setDealtCount] = useState(0)
  const sessionRef = useRef<string | number | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  const finish = useCallback(() => {
    clearTimers()
    setPhase('complete')
    setDealtCount(OPENING_HAND_SIZE)
  }, [clearTimers])

  useEffect(() => {
    if (!active || sessionKey == null) {
      clearTimers()
      setPhase('idle')
      setDealtCount(0)
      sessionRef.current = null
      return
    }

    if (sessionRef.current === sessionKey) return
    sessionRef.current = sessionKey
    clearTimers()

    setPhase('shuffle')
    setDealtCount(0)

    const timers: ReturnType<typeof setTimeout>[] = []

    timers.push(
      setTimeout(() => {
        setPhase('dealing')
        for (let i = 1; i <= OPENING_HAND_SIZE; i++) {
          timers.push(setTimeout(() => setDealtCount(i), i * DEAL_STAGGER_MS))
        }
        timers.push(
          setTimeout(
            () => setPhase('complete'),
            OPENING_HAND_SIZE * DEAL_STAGGER_MS + DEAL_TAIL_MS
          )
        )
      }, SHUFFLE_MS)
    )

    timersRef.current = timers
    return () => clearTimers()
  }, [active, sessionKey, clearTimers])

  const isIntroActive = phase === 'shuffle' || phase === 'dealing'
  const isInteractive = phase === 'complete' || phase === 'idle'

  /** Override deck count during intro; null = use real game state. */
  const displayDeckCount: number | null =
    phase === 'shuffle'
      ? FULL_DECK_SIZE
      : phase === 'dealing'
        ? FULL_DECK_SIZE - dealtCount
        : null

  /** Override visible hand size during intro; null = show full hand. */
  const displayHandCount: number | null =
    phase === 'shuffle' ? 0 : phase === 'dealing' ? dealtCount : null

  return {
    phase,
    dealtCount,
    displayDeckCount,
    displayHandCount,
    isIntroActive,
    isInteractive,
    skip: finish,
  }
}
