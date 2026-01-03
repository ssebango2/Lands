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
  swampPhase
}: PlayerSectionProps) {
  const isPlayer1 = playerId === 1

  return (
    <div className={`player-section ${isPlayer1 ? 'player-section-bottom' : 'player-section-top'}`}>
      <div className="player-info">
        {isPlayer1 ? (
          <>
            <div className="player-identity">
              <div className="player-avatar">P{playerId}</div>
              <div className="player-name">Player {playerId}</div>
            </div>
            <div className="player-resource">6</div>
          </>
        ) : (
          <>
            <div className="player-resource">5</div>
            <div className="player-identity">
              <div className="player-avatar">P{playerId}</div>
              <div className="player-name">Player {playerId}</div>
            </div>
          </>
        )}
        <div className="player-health">30</div>
      </div>
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
        <div className={`hand-container ${isPlayer1 ? 'hand-container-bottom' : 'hand-container-top'}`}>
          {player.hand.length === 0 ? (
            <div className="empty-hand">No cards in hand</div>
          ) : (
            player.hand.map((card, index) => {
              const isRevealed = swampRevealedCards.includes(index)
              const isSelectableForReveal = swampPhase === 'reveal' && !!onSwampReveal
              const isSelectableForDiscard = swampPhase === 'discard' && isRevealed && !!onSwampDiscard
              
              const handleClick = () => {
                if (isSelectableForReveal) {
                  onSwampReveal(index)
                } else if (isSelectableForDiscard) {
                  onSwampDiscard(index)
                } else {
                  onPlayCard(index)
                }
              }
              
              return (
                <Card 
                  key={`${card}-${index}`} 
                  card={card} 
                  index={index}
                  totalCards={player.hand.length}
                  isPlayer1={isPlayer1}
                  onClick={handleClick}
                  isInHand={true}
                  isSwampRevealed={isRevealed}
                  isSwampSelectable={isSelectableForReveal || isSelectableForDiscard}
                />
              )
            })
          )}
        </div>
        <Deck 
          count={player.deck.length} 
          isPlayer1={isPlayer1}
          onClick={onDrawCard}
        />
      </div>
    </div>
  )
}

