'use client'

import { useRef, useState, useEffect } from 'react'
import { Player } from '@/lib/gameLogic'
import Card from './Card'
import Deck from './Deck'
import Graveyard from './Graveyard'

interface PlayerSectionProps {
  player: Player
  playerId: number
  onPlayCard: (cardIndex: number) => void
  onGraveyardCardClick?: (cardIndex: number) => void
  isGraveyardSelectable?: boolean
  isGraveyardExpanded?: boolean
  onToggleGraveyard?: () => void
  onSwampReveal?: (cardIndex: number) => void
  onSwampDiscard?: (cardIndex: number) => void
  swampRevealedCards?: number[]
  swampPhase?: 'reveal' | 'discard' | null
  isActive?: boolean
  /** In online mode: true when this is the opponent's section (show their hand face down) */
  isOpponent?: boolean
  /** When true, position this section at bottom (player's own cards). Used in multiplayer. */
  atBottom?: boolean
  /** When false, playing cards from hand is disabled (e.g. during Swamp reveal when opponent must act) */
  canPlayCard?: boolean
  /** Index in the opponent's hand to show face-up (Forest effect: returned graveyard card) */
  forestRevealedCardIndex?: number
}

export default function PlayerSection({ 
  player, 
  playerId, 
  onPlayCard, 
  onGraveyardCardClick, 
  isGraveyardSelectable, 
  isGraveyardExpanded, 
  onToggleGraveyard,
  onSwampReveal,
  onSwampDiscard,
  swampRevealedCards = [],
  swampPhase,
  isActive = false,
  canPlayCard = true,
  isOpponent = false,
  atBottom = undefined,
  forestRevealedCardIndex,
}: PlayerSectionProps) {
  const isPlayer1 = playerId === 1
  const isBottom = atBottom ?? isPlayer1

  // --- Draw animation ---
  const prevHandRef = useRef<typeof player.hand>(player.hand)
  const [drawnCardType, setDrawnCardType] = useState<string | null>(null)
  const drawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const prevOppHandLenRef = useRef(player.hand.length)
  const [newOppCardIndex, setNewOppCardIndex] = useState<number | null>(null)
  const oppTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const prevHand = prevHandRef.current
    if (!isOpponent && player.hand.length >= prevHand.length) {
      const prevCounts: Record<string, number> = {}
      prevHand.forEach(c => { prevCounts[c] = (prevCounts[c] || 0) + 1 })
      const currCounts: Record<string, number> = {}
      player.hand.forEach(c => { currCounts[c] = (currCounts[c] || 0) + 1 })
      let newType: string | null = null
      for (const [type, count] of Object.entries(currCounts)) {
        if (count > (prevCounts[type] || 0)) { newType = type; break }
      }
      if (newType) {
        if (drawTimerRef.current) clearTimeout(drawTimerRef.current)
        setDrawnCardType(newType)
        drawTimerRef.current = setTimeout(() => setDrawnCardType(null), 650)
      }
    }
    prevHandRef.current = [...player.hand]
  }, [player.hand, isOpponent])

  useEffect(() => {
    if (isOpponent && player.hand.length > prevOppHandLenRef.current) {
      const idx = player.hand.length - 1
      if (oppTimerRef.current) clearTimeout(oppTimerRef.current)
      setNewOppCardIndex(idx)
      oppTimerRef.current = setTimeout(() => setNewOppCardIndex(null), 650)
    }
    prevOppHandLenRef.current = player.hand.length
  }, [player.hand.length, isOpponent])

  useEffect(() => () => {
    if (drawTimerRef.current) clearTimeout(drawTimerRef.current)
    if (oppTimerRef.current) clearTimeout(oppTimerRef.current)
  }, [])
  // --- end draw animation ---

  return (
    <div className={`player-section ${isBottom ? 'player-section-bottom' : 'player-section-top'} ${isActive ? 'player-active' : ''}`}>
      <div className="player-area">
        <Graveyard 
          cards={player.graveyard}
          isPlayer1={isPlayer1}
          onCardClick={onGraveyardCardClick}
          isSelectable={isGraveyardSelectable}
          isExpanded={isGraveyardExpanded}
          onToggleExpand={onToggleGraveyard}
          playerId={playerId}
        />
        <div className={`hand-container ${isBottom ? 'hand-container-bottom' : 'hand-container-top'}`}>
          {player.hand.length === 0 ? (
            <div className="empty-hand">No cards in hand</div>
          ) : isOpponent ? (
            // Opponent's hand: show face down, except Swamp-revealed cards
            player.hand.map((card, index) => {
              const isRevealed = swampRevealedCards.includes(index)
              const isForestRevealed = forestRevealedCardIndex === index
              const isSelectableForDiscard = swampPhase === 'discard' && isRevealed && !!onSwampDiscard
              const revealedOrder = swampRevealedCards.indexOf(index) + 1
              const isNewOppCard = newOppCardIndex === index
              return (
                <div key={isNewOppCard ? `${index}-draw` : `${index}`} className={`hand-card-group${isNewOppCard ? ' card-draw-anim' : ''}`} style={{ position: 'relative' }}>
                  {swampPhase === 'reveal' && isRevealed && (
                    <div className="swamp-reveal-badges">
                      <span className="swamp-reveal-badge">{revealedOrder}</span>
                    </div>
                  )}
                  {isForestRevealed && (
                    <div className="forest-reveal-badge-wrapper">
                      <span className="forest-reveal-badge">F</span>
                    </div>
                  )}
                  <Card
                    card={card as import('@/lib/gameLogic').LandType}
                    index={index}
                    totalCards={player.hand.length}
                    isPlayer1={isPlayer1}
                    onClick={isSelectableForDiscard ? () => onSwampDiscard!(index) : undefined}
                    isInHand={true}
                    isFlat={true}
                    faceDown={!isRevealed && !isForestRevealed}
                    isSwampRevealed={isRevealed}
                    isSwampSelectable={isSelectableForDiscard}
                    isForestRevealed={isForestRevealed}
                  />
                </div>
              )
            })
          ) : (
            (() => {
              // My hand: group by card type - show one card per type with count above
              const groups = player.hand.reduce((acc, card, index) => {
                if (!acc[card]) acc[card] = []
                acc[card].push(index)
                return acc
              }, {} as Record<string, number[]>)

              return Object.entries(groups).map(([cardType, indices]) => {
                const count = indices.length
                const isRevealed = indices.some(i => swampRevealedCards.includes(i))
                const isSelectableForReveal = swampPhase === 'reveal' && !!onSwampReveal
                const isSelectableForDiscard = swampPhase === 'discard' && isRevealed && !!onSwampDiscard
                const revealedOfThisType = indices.filter(i => swampRevealedCards.includes(i))
                const unrevealedOfThisType = indices.filter(i => !swampRevealedCards.includes(i))
                const revealedOrderNumbers = revealedOfThisType
                  .map(i => swampRevealedCards.indexOf(i) + 1)
                  .sort((a, b) => a - b)

                const handleClick = () => {
                  if (isSelectableForReveal) {
                    if (unrevealedOfThisType.length > 0) {
                      onSwampReveal!(unrevealedOfThisType[0])
                    } else if (revealedOfThisType.length > 0) {
                      onSwampReveal!(revealedOfThisType[revealedOfThisType.length - 1])
                    }
                  } else if (isSelectableForDiscard) {
                    onSwampDiscard!(indices[0])
                  } else if (canPlayCard) {
                    onPlayCard(indices[0])
                  }
                }
                const hasClickAction = isSelectableForReveal || isSelectableForDiscard || (canPlayCard && !!onPlayCard)

                const isNewCard = drawnCardType === cardType
                return (
                  <div key={isNewCard ? `${cardType}-draw` : cardType} className={`hand-card-group${isNewCard ? ' card-draw-anim' : ''}`}>
                    {swampPhase === 'reveal' && revealedOrderNumbers.length > 0 && (
                      <div className="swamp-reveal-badges">
                        {revealedOrderNumbers.map((orderNum) => (
                          <span key={orderNum} className="swamp-reveal-badge">{orderNum}</span>
                        ))}
                      </div>
                    )}
                    <Card
                      card={cardType as import('@/lib/gameLogic').LandType}
                      index={0}
                      totalCards={1}
                      isPlayer1={isPlayer1}
                      onClick={hasClickAction ? handleClick : undefined}
                      isInHand={true}
                      isFlat={true}
                      isSwampRevealed={isRevealed}
                      isSwampSelectable={isSelectableForReveal || isSelectableForDiscard}
                      count={count}
                    />
                  </div>
                )
              })
            })()
          )}
        </div>
        <Deck 
          count={player.deck.length} 
          isPlayer1={isPlayer1}
        />
      </div>
    </div>
  )
}

