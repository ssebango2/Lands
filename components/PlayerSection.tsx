import { Player } from '@/lib/gameLogic'
import Card from './Card'
import Deck from './Deck'
import Graveyard from './Graveyard'

interface PlayerSectionProps {
  player: Player
  playerId: number
  onDrawCard: () => void
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
}

export default function PlayerSection({ 
  player, 
  playerId, 
  onDrawCard, 
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
  isOpponent = false,
  atBottom = undefined,
}: PlayerSectionProps) {
  const isPlayer1 = playerId === 1
  // In multiplayer, atBottom means player's own section. Otherwise fall back to P1=bottom.
  const isBottom = atBottom ?? isPlayer1

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
              const isSelectableForDiscard = swampPhase === 'discard' && isRevealed && !!onSwampDiscard
              const revealedOrder = swampRevealedCards.indexOf(index) + 1
              return (
                <div key={index} className="hand-card-group">
                  {swampPhase === 'reveal' && isRevealed && (
                    <div className="swamp-reveal-badges">
                      <span className="swamp-reveal-badge">{revealedOrder}</span>
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
                    faceDown={!isRevealed}
                    isSwampRevealed={isRevealed}
                    isSwampSelectable={isSelectableForDiscard}
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
                  } else {
                    onPlayCard(indices[0])
                  }
                }

                return (
                  <div key={cardType} className="hand-card-group">
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
                      onClick={handleClick}
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
          onClick={isOpponent ? undefined : onDrawCard}
        />
      </div>
    </div>
  )
}

