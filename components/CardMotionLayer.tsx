'use client'

import { memo, useLayoutEffect, useRef } from 'react'
import { ActiveFlight, Rect } from '@/lib/useCardMotion'
import { CARD_BACK_IMAGE as CARD_BACK, CARD_IMAGE } from '@/lib/cardImages'

const DISCARD_MS = 380
const DRAW_MS = 520
const DISCARD_EASE = 'cubic-bezier(0.55, 0, 0.75, 0.2)'
const LIFT_EASE = 'cubic-bezier(0.2, 0.6, 0.35, 1)'
const TRAVEL_EASE = 'cubic-bezier(0.3, 0.65, 0.2, 1)'

const centerX = (r: Rect) => r.left + r.width / 2
const centerY = (r: Rect) => r.top + r.height / 2

/**
 * FLIP-style transform relative to `base` (the larger rect, so the image is
 * only ever scaled down and stays sharp).
 */
function transformFor(base: Rect, r: Rect, { lift = 0, grow = 1, rotate = 0 } = {}) {
  const dx = centerX(r) - centerX(base)
  const dy = centerY(r) - centerY(base) - lift
  const sx = (r.width / base.width) * grow
  const sy = (r.height / base.height) * grow
  return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(${rotate}deg)`
}

const Flight = memo(function Flight({ flight, onDone }: { flight: ActiveFlight; onDone: (id: string) => void }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const { fromRect, toRect } = flight
  const base = fromRect.width * fromRect.height >= toRect.width * toRect.height ? fromRect : toRect
  const flips = flight.backAtStart !== flight.backAtEnd

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || typeof outer.animate !== 'function') {
      onDoneRef.current(flight.id)
      return
    }

    let animation: Animation
    if (flight.kind === 'discard') {
      const tilt = flight.playerId === 1 ? -3 : 3
      animation = outer.animate(
        [
          { transform: transformFor(base, fromRect) },
          { transform: transformFor(base, toRect, { rotate: tilt }) },
        ],
        { duration: DISCARD_MS, delay: flight.delay, easing: DISCARD_EASE, fill: 'both' },
      )
    } else {
      const lift = Math.min(18, fromRect.height * 0.14)
      animation = outer.animate(
        [
          { transform: transformFor(base, fromRect), easing: LIFT_EASE },
          { transform: transformFor(base, fromRect, { lift, grow: 1.05 }), offset: 0.2, easing: TRAVEL_EASE },
          { transform: transformFor(base, toRect) },
        ],
        { duration: DRAW_MS, delay: flight.delay, fill: 'both' },
      )
      if (flips && inner) {
        inner.animate(
          [
            { transform: 'rotateY(0deg)' },
            { transform: 'rotateY(0deg)', offset: 0.2, easing: 'ease-in-out' },
            { transform: 'rotateY(180deg)', offset: 0.8 },
            { transform: 'rotateY(180deg)' },
          ],
          { duration: DRAW_MS, delay: flight.delay, fill: 'both' },
        )
      }
    }

    animation.onfinish = () => onDoneRef.current(flight.id)
    return () => {
      animation.onfinish = null
    }
    // A flight's geometry is fixed when it is planned.
  }, [flight.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const face = <img className="motion-face motion-face-front" src={CARD_IMAGE[flight.card]} alt="" draggable={false} />
  const back = <img className="motion-face motion-face-back" src={CARD_BACK} alt="" draggable={false} />

  return (
    <div
      ref={outerRef}
      className={`motion-card motion-card-${flight.kind}`}
      style={{ left: base.left, top: base.top, width: base.width, height: base.height }}
    >
      {flips ? (
        <div ref={innerRef} className="motion-card-inner">
          {back}
          {face}
        </div>
      ) : (
        <div ref={innerRef} className="motion-card-inner motion-card-static">
          {flight.backAtStart ? back : face}
        </div>
      )}
    </div>
  )
})

export default function CardMotionLayer({ flights, onDone }: { flights: ActiveFlight[]; onDone: (id: string) => void }) {
  if (flights.length === 0) return null
  return (
    <div className="motion-layer" aria-hidden="true">
      {flights.map(flight => (
        <Flight key={flight.id} flight={flight} onDone={onDone} />
      ))}
    </div>
  )
}
