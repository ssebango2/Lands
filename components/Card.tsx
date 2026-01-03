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
}

export default function Card({ card, index, totalCards, isPlayer1, onClick, isInHand = false, isSwampRevealed = false, isSwampSelectable = false }: CardProps) {
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
      'Mountain': '/images/mountain.png',
      'Forest': '/images/forest.jpg',
    }
    return imageMap[landType]
  }

  // Calculate rotation and position for fan effect
  const maxRotation = 20 // degrees
  const cardSpacing = 35 // pixels between card centers
  const centerIndex = (totalCards - 1) / 2
  const offset = (index - centerIndex) * cardSpacing
  const rotation = (index - centerIndex) * (maxRotation / Math.max(1, Math.ceil(totalCards / 2)))
  
  const cardStyle = {
    left: `calc(50% + ${offset}px)`,
    transform: `translateX(-50%) rotate(${rotation}deg)`,
    zIndex: index,
    ...(isPlayer1 ? { bottom: '0px' } : { top: '0px' }),
    ...(isInHand ? { '--card-rotation': `${rotation}deg` } : {}),
  } as React.CSSProperties

  const cardImage = getCardImage(card)

  return (
    <div 
      className={`card ${getCardClass(card)} ${isPlayer1 ? 'card-player1' : 'card-player2'} ${isInHand ? 'card-in-hand' : ''} ${isSwampRevealed ? 'card-swamp-revealed' : ''} ${isSwampSelectable ? 'card-swamp-selectable' : ''}`}
      style={cardStyle}
      onClick={onClick}
    >
      <Image
        src={cardImage}
        alt={card}
        fill
        style={{ objectFit: 'cover' }}
        sizes="120px"
      />
    </div>
  )
}

