'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LandType } from './gameLogic'
import { PlannedFlight, ZoneViews, planCardMotions } from './cardMotion'

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export interface ActiveFlight extends PlannedFlight {
  fromRect: Rect
  toRect: Rect
}

/** What each zone should temporarily hold back while a card is still travelling to it. */
export interface MotionHolds {
  graveyard: number
  /** Face-up (grouped) hands: copies of each type still in the air */
  handByType: Partial<Record<LandType, number>>
  /** Face-down (indexed) hands: trailing cards still in the air */
  handTail: number
}

export const NO_HOLDS: MotionHolds = { graveyard: 0, handByType: {}, handTail: 0 }

// Rects are captured after each commit; re-measure once CSS entry animations have settled.
const SETTLE_REMEASURE_MS = 750

function measure(): Map<string, Rect> {
  const rects = new Map<string, Rect>()
  document.querySelectorAll<HTMLElement>('[data-motion]').forEach(el => {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      rects.set(el.dataset.motion!, { left: r.left, top: r.top, width: r.width, height: r.height })
    }
  })
  return rects
}

function pick(rects: Map<string, Rect>, keys: string[]): Rect | undefined {
  for (const key of keys) {
    const r = rects.get(key)
    if (r) return r
  }
  return undefined
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

interface UseCardMotionOptions {
  /** Memoize: a new object means the game state changed */
  views: ZoneViews | null
  /** Changing this (new match, intro replay) drops in-flight cards without animating the jump */
  resetKey: string | number
  enabled: boolean
  faceUpHands: { 1: boolean; 2: boolean }
}

/**
 * Turns zone changes between two game states into short card flights. The
 * game state is never delayed: destinations just hide the arriving card until
 * its clone lands, so nothing is shown twice.
 */
export function useCardMotion({ views, resetKey, enabled, faceUpHands }: UseCardMotionOptions) {
  const [flights, setFlights] = useState<ActiveFlight[]>([])
  const prevViewsRef = useRef<ZoneViews | null>(views)
  const rectsRef = useRef<Map<string, Rect>>(new Map())
  const resetKeyRef = useRef(resetKey)
  const reduced = usePrefersReducedMotion()
  const faceUpRef = useRef(faceUpHands)
  faceUpRef.current = faceUpHands

  useLayoutEffect(() => {
    const prev = prevViewsRef.current
    prevViewsRef.current = views
    const before = rectsRef.current
    const now = measure()
    rectsRef.current = now

    if (resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey
      setFlights([])
      return
    }
    if (!enabled || reduced || !prev || !views || prev === views) return

    const planned = planCardMotions(prev, views, { faceUpHands: faceUpRef.current })
    const ready: ActiveFlight[] = []
    for (const flight of planned) {
      // Origins come from the previous frame (that DOM is gone now); destinations from this one.
      const fromRect = pick(before, flight.from) ?? pick(now, flight.from)
      const toRect = pick(now, flight.to)
      if (fromRect && toRect) ready.push({ ...flight, fromRect, toRect })
    }
    if (ready.length > 0) setFlights(current => [...current, ...ready])
  }, [views, resetKey, enabled, reduced])

  useEffect(() => {
    const remeasure = () => {
      rectsRef.current = measure()
    }
    const timer = window.setTimeout(remeasure, SETTLE_REMEASURE_MS)
    let frame = 0
    const onViewportChange = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(remeasure)
    }
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [views, flights.length])

  const finishFlight = useCallback((id: string) => {
    setFlights(current => current.filter(f => f.id !== id))
  }, [])

  const holds = useMemo(() => {
    const result: Record<1 | 2, MotionHolds> = {
      1: { graveyard: 0, handByType: {}, handTail: 0 },
      2: { graveyard: 0, handByType: {}, handTail: 0 },
    }
    for (const f of flights) {
      const h = result[f.playerId]
      if (f.kind === 'discard') {
        h.graveyard++
      } else {
        h.handByType[f.card] = (h.handByType[f.card] ?? 0) + 1
        h.handTail++
      }
    }
    return result
  }, [flights])

  return { flights, holds, finishFlight }
}
