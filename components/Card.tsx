import type { KeyboardEvent } from 'react'
import { LandType } from '@/lib/gameLogic'
import { CARD_BACK_IMAGE, CARD_IMAGE } from '@/lib/cardImages'
import Image from 'next/image'

export { CARD_IMAGE }

const CARD_CLASS: Record<LandType, string> = {
  Plains: 'card-plains',
  Island: 'card-island',
  Swamp: 'card-swamp',
  Mountain: 'card-mountain',
  Forest: 'card-forest',
}

interface CardProps {
  card: LandType
  index: number
  totalCards: number
  isPlayer1: boolean
  onClick?: () => void
  isInHand?: boolean
  isSwampRevealed?: boolean
  isSwampSelectable?: boolean
  isForestRevealed?: boolean
  /** Show duplicate count badge (e.g. "2" when 2 copies) */
  count?: number
  /** Flat layout - no fan/rotation, for side-by-side display */
  isFlat?: boolean
  /** Show card back (face down) - for opponent's hand in online mode */
  faceDown?: boolean
}

const IMAGE_STYLE: React.CSSProperties = {
  objectFit: 'cover',
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
}

export default function Card({ card, index, totalCards, isPlayer1, onClick, isInHand = false, isSwampRevealed = false, isSwampSelectable = false, isForestRevealed = false, count, isFlat = false, faceDown = false }: CardProps) {
  // Flat layout: no fan effect. Otherwise use rotation/position for legacy.
  const cardStyle: React.CSSProperties = isFlat || isInHand
    ? { position: 'relative', zIndex: index }
    : {
        position: 'absolute',
        left: `calc(50% + ${(index - (totalCards - 1) / 2) * 35}px)`,
        transform: `translateX(-50%) rotate(${(index - (totalCards - 1) / 2) * 10}deg)`,
        zIndex: index,
        ...(isPlayer1 ? { bottom: '0px' } : { top: '0px' }),
      }

  const hasCopies = count != null && count > 1
  const label = faceDown ? 'Face-down card' : hasCopies ? `${card}, ${count} copies` : card

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick?.()
    }
  }

  const interactiveProps = onClick
    ? { role: 'button' as const, tabIndex: 0, onKeyDown: handleKeyDown, 'aria-label': label }
    : {}

  const baseClass = [
    'card',
    isPlayer1 ? 'card-player1' : 'card-player2',
    isInHand && 'card-in-hand',
    isFlat && 'card-flat',
    onClick && 'card-interactive',
  ].filter(Boolean).join(' ')

  if (faceDown) {
    return (
      <div
        className={`${baseClass} card-face-down${isSwampSelectable ? ' card-swamp-selectable' : ''}`}
        style={cardStyle}
        onClick={onClick}
        {...interactiveProps}
      >
        <Image src={CARD_BACK_IMAGE} alt="Face-down card" width={120} height={168} style={IMAGE_STYLE} />
      </div>
    )
  }

  const stateClass = [
    CARD_CLASS[card],
    isSwampRevealed && 'card-swamp-revealed',
    isSwampSelectable && 'card-swamp-selectable',
    isForestRevealed && 'card-forest-revealed',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={`${baseClass} ${stateClass}`}
      style={cardStyle}
      onClick={onClick}
      {...interactiveProps}
    >
      <Image src={CARD_IMAGE[card]} alt={card} width={120} height={168} style={IMAGE_STYLE} />
      {hasCopies && (
        <span className="card-count-badge">
          <span aria-hidden="true">×</span>{count}
          <span className="visually-hidden"> copies</span>
        </span>
      )}
    </div>
  )
}
