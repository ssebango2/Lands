import { LandType } from '@/lib/gameLogic'
import Image from 'next/image'

interface CardProps {
  card: LandType
  index: number
  totalCards: number
  isPlayer1: boolean
  onClick?: () => void
  isInHand?: boolean
  isSwampRevealed?: boolean
  isSwampSelectable?: boolean
  /** Show duplicate count badge (e.g. "2" when 2 copies) */
  count?: number
  /** Flat layout - no fan/rotation, for side-by-side display */
  isFlat?: boolean
  /** Show card back (face down) - for opponent's hand in online mode */
  faceDown?: boolean
}

export default function Card({ card, index, totalCards, isPlayer1, onClick, isInHand = false, isSwampRevealed = false, isSwampSelectable = false, count, isFlat = false, faceDown = false }: CardProps) {
  const getCardClass = (landType: LandType): string => {
    const classMap: Record<LandType, string> = {
      'Plains': 'card-plains',
      'Island': 'card-island',
      'Swamp': 'card-swamp',
      'Mountain': 'card-mountain',
      'Forest': 'card-forest',
    }
    return classMap[landType]
  }

  const getCardImage = (landType: LandType): string => {
    const imageMap: Record<LandType, string> = {
      'Plains': '/images/plains.jpg',
      'Island': '/images/island.jpg',
      'Swamp': '/images/swamp.jpg',
      'Mountain': '/images/mountain.jpg',
      'Forest': '/images/forest.jpg',
    }
    return imageMap[landType]
  }

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

  const cardImage = getCardImage(card)

  if (faceDown) {
    return (
      <div
        className={`card card-face-down ${isPlayer1 ? 'card-player1' : 'card-player2'} ${isInHand ? 'card-in-hand' : ''} ${isFlat ? 'card-flat' : ''}`}
        style={cardStyle}
        onClick={onClick}
      >
        <Image
          src="/images/card-back.jpg"
          alt="Card back"
          width={120}
          height={168}
          style={{ objectFit: 'cover', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
      </div>
    )
  }

  return (
    <div 
      className={`card ${getCardClass(card)} ${isPlayer1 ? 'card-player1' : 'card-player2'} ${isInHand ? 'card-in-hand' : ''} ${isFlat ? 'card-flat' : ''} ${isSwampRevealed ? 'card-swamp-revealed' : ''} ${isSwampSelectable ? 'card-swamp-selectable' : ''}`}
      style={cardStyle}
      onClick={onClick}
    >
      <Image
        src={cardImage}
        alt={card}
        width={120}
        height={168}
        style={{ objectFit: 'cover', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />
      {count != null && count > 1 && (
        <span className="card-count-badge">{count}</span>
      )}
    </div>
  )
}

