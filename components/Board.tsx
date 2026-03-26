'use client'

import { useRef, useState, useEffect } from 'react'
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

function detectNewType(prevCards: CardType[], currCards: CardType[]): CardType | null {
  const prevCounts: Record<string, number> = {}
  prevCards.forEach(c => { prevCounts[c] = (prevCounts[c] || 0) + 1 })
  const currCounts: Record<string, number> = {}
  currCards.forEach(c => { currCounts[c] = (currCounts[c] || 0) + 1 })
  for (const [type, count] of Object.entries(currCounts)) {
    if (count > (prevCounts[type] || 0)) return type as CardType
  }
  return null
}

export default function Board({ cards, playerId, onCardClick, isSelectable = false, pendingCard }: BoardProps) {
  const displayCards = pendingCard ? [...cards, pendingCard] : cards

  // --- Play animation ---
  const [playedCardType, setPlayedCardType] = useState<CardType | null>(null)
  const prevCardsRef = useRef<CardType[]>(cards)
  const prevPendingRef = useRef<CardType | undefined>(pendingCard)
  const lastAnimatedPendingRef = useRef<CardType | undefined>(undefined)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Animate when pendingCard first appears (card just played in online mode)
  useEffect(() => {
    if (pendingCard && !prevPendingRef.current) {
      lastAnimatedPendingRef.current = pendingCard
      if (timerRef.current) clearTimeout(timerRef.current)
      setPlayedCardType(pendingCard)
      timerRef.current = setTimeout(() => setPlayedCardType(null), 700)
    }
    prevPendingRef.current = pendingCard
  }, [pendingCard])

  // Animate when a card is permanently added to board (local mode, or stack resolution)
  useEffect(() => {
    const prevCards = prevCardsRef.current
    if (cards.length > prevCards.length) {
      const newType = detectNewType(prevCards, cards)
      // Skip if this type was already animated as a pendingCard (avoid double animation)
      if (newType && newType !== lastAnimatedPendingRef.current) {
        if (timerRef.current) clearTimeout(timerRef.current)
        setPlayedCardType(newType)
        timerRef.current = setTimeout(() => setPlayedCardType(null), 700)
      }
      lastAnimatedPendingRef.current = undefined
    }
    prevCardsRef.current = [...cards]
  }, [cards])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])
  // --- end play animation ---

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

  // Player 1 is at bottom (hand below board) → card rises up; Player 2 at top → card drops down
  const playAnimClass = playerId === 1 ? 'card-play-anim-rise' : 'card-play-anim-drop'

  return (
    <div className={`board board-player${playerId}`}>
      <div className="board-cards board-cards-flat">
        {displayCards.length === 0 ? null : (
          Object.entries(cardGroups).map(([cardType, cardGroup]) => {
            const count = cardGroup.length
            const isSelectableCard = isSelectable
            const isAnimating = playedCardType === (cardType as CardType)
            return (
              <div
                key={isAnimating ? `${cardType}-play` : cardType}
                className={`board-card-flat board-card-group ${isSelectableCard ? 'board-card-selectable' : ''} ${isAnimating ? playAnimClass : ''}`}
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
