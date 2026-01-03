import { Card as CardType } from '@/lib/gameLogic'
import Card from './Card'

interface BoardProps {
  cards: CardType[]
  playerId: number
  onCardClick?: (cardIndex: number) => void
  isSelectable?: boolean
}

export default function Board({ cards, playerId, onCardClick, isSelectable = false }: BoardProps) {
  // Group cards by type, but we need to track the actual board index for clicking
  const cardGroups = cards.reduce((acc, card, index) => {
    if (!acc[card]) {
      acc[card] = []
    }
    acc[card].push({ card, originalIndex: index })
    return acc
  }, {} as Record<CardType, Array<{ card: CardType; originalIndex: number }>>)

  // Handle card click - for stacked cards, we pass the card type
  const handleCardClick = (cardType: CardType) => {
    if (onCardClick && isSelectable) {
      // Find the last index of this card type in the board
      const lastIndex = cards.map((c, i) => ({ card: c, index: i }))
        .filter(({ card }) => card === cardType)
        .pop()?.index
      
      if (lastIndex !== undefined) {
        onCardClick(lastIndex)
      }
    }
  }

  return (
    <div className={`board board-player${playerId}`}>
      <div className="board-cards">
        {cards.length === 0 ? null : (
          Object.entries(cardGroups).map(([cardType, cardGroup]) => (
            <div key={cardType} className="board-card-stack">
              {cardGroup.map(({ card, originalIndex }, stackIndex) => {
                // Card height is 168px, top 20% = 33.6px should be visible
                // So each card after the first should be offset by 33.6px downward
                const offset = stackIndex * 33.6
                const isTopCard = stackIndex === cardGroup.length - 1
                return (
                  <div
                    key={`board-${card}-${originalIndex}`}
                    className={`board-card-wrapper ${isSelectable && isTopCard ? 'board-card-selectable' : ''}`}
                    style={{
                      zIndex: stackIndex,
                      transform: `translateY(${offset}px)`,
                    }}
                    onClick={() => isTopCard && handleCardClick(card)}
                  >
                    <Card
                      card={card}
                      index={0}
                      totalCards={1}
                      isPlayer1={playerId === 1}
                    />
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

