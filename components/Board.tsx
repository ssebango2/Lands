import { Card as CardType } from '@/lib/gameLogic'
import Card from './Card'

interface BoardProps {
  cards: CardType[]
  playerId: number
  onCardClick?: (cardIndex: number) => void
  isSelectable?: boolean
  /** When counter is pending, show this card on board as if played (visual only) */
  pendingCard?: CardType
}

export default function Board({ cards, playerId, onCardClick, isSelectable = false, pendingCard }: BoardProps) {
  // Include pending card (e.g. on stack) in display when counter decision is pending
  const displayCards = pendingCard ? [...cards, pendingCard] : cards
  // Group cards by type for flat display with count badges
  const cardGroups = displayCards.reduce((acc, card, index) => {
    if (!acc[card]) {
      acc[card] = []
    }
    acc[card].push({ card, originalIndex: index })
    return acc
  }, {} as Record<CardType, Array<{ card: CardType; originalIndex: number }>>)

  // Pending cards are not clickable
  const handleCardClick = (cardType: CardType) => {
    if (onCardClick && isSelectable) {
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
      <div className="board-cards board-cards-flat">
        {displayCards.length === 0 ? null : (
          Object.entries(cardGroups).map(([cardType, cardGroup]) => {
            const count = cardGroup.length
            const isSelectableCard = isSelectable
            return (
              <div
                key={cardType}
                className={`board-card-flat board-card-group ${isSelectableCard ? 'board-card-selectable' : ''}`}
                onClick={() => isSelectableCard && handleCardClick(cardType as CardType)}
              >
                <Card
                  card={cardType as CardType}
                  index={0}
                  totalCards={1}
                  isPlayer1={playerId === 1}
                  isFlat={true}
                  count={count}
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

