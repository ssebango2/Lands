'use client'

import { Card as CardType, LandType, Player } from '@/lib/gameLogic'
import { motionKey } from '@/lib/cardMotion'
import { MotionHolds, NO_HOLDS } from '@/lib/useCardMotion'
import Card from './Card'
import Deck from './Deck'
import Graveyard from './Graveyard'

interface PlayerSectionProps {
  player: Player
  playerId: 1 | 2
  onPlayCard: (cardIndex: number) => void
  onGraveyardCardClick?: (cardIndex: number) => void
  isGraveyardSelectable?: boolean
  isGraveyardExpanded?: boolean
  onToggleGraveyard?: () => void
  onSwampReveal?: (cardIndex: number) => void
  onSwampDiscard?: (cardIndex: number) => void
  swampRevealedCards?: number[]
  swampPhase?: 'reveal' | 'discard' | null
  /** Set while this player must discard down to the hand limit */
  onHandLimitDiscard?: (cardIndex: number) => void
  isActive?: boolean
  /** In online mode: true when this is the opponent's section (show their hand face down) */
  isOpponent?: boolean
  /** When true, position this section at bottom (player's own cards). Used in multiplayer. */
  atBottom?: boolean
  /** When false, playing cards from hand is disabled (e.g. during Swamp reveal when opponent must act) */
  canPlayCard?: boolean
  /** Index in the opponent's hand to show face-up (Forest effect: returned graveyard card) */
  forestRevealedCardIndex?: number
  /** Graveyard card locked in as a Forest target (shown to both players) */
  graveyardTarget?: LandType
  /** Cards still travelling here; hidden until they land */
  motionHolds?: MotionHolds
  /** Opening intro: override visible hand size (null = full hand) */
  introHandCount?: number | null
  /** Opening intro: override deck count display (null = real count) */
  introDeckCount?: number | null
  /** Opening intro: play deck shuffle animation */
  isShuffling?: boolean
  /** Opening intro: deal cards one-by-one instead of grouping by type */
  isIntroDealing?: boolean
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
  onHandLimitDiscard,
  isActive = false,
  canPlayCard = true,
  isOpponent = false,
  atBottom = undefined,
  forestRevealedCardIndex,
  graveyardTarget,
  motionHolds = NO_HOLDS,
  introHandCount = null,
  introDeckCount = null,
  isShuffling = false,
  isIntroDealing = false,
}: PlayerSectionProps) {
  const isPlayer1 = playerId === 1
  const isBottom = atBottom ?? isPlayer1

  const visibleHand =
    introHandCount == null ? player.hand : player.hand.slice(0, Math.max(0, introHandCount))
  const deckCount = introDeckCount ?? player.deck.length
  const firstInFlightIndex = visibleHand.length - motionHolds.handTail

  const renderIntroDealHand = () =>
    visibleHand.map((card, index) => (
      <div
        key={`intro-${index}-${card}`}
        className="hand-card-group card-deal-anim"
        style={{ animationDelay: '0ms' }}
      >
        <Card
          card={card}
          index={index}
          totalCards={visibleHand.length}
          isPlayer1={isPlayer1}
          isInHand={true}
          isFlat={true}
          faceDown={isOpponent}
        />
      </div>
    ))

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
          hiddenCount={motionHolds.graveyard}
          targetedCard={graveyardTarget}
        />
        <div
          className={`hand-container ${isBottom ? 'hand-container-bottom' : 'hand-container-top'}${isOpponent ? ' hand-container-opponent' : ''}`}
          aria-label={`Player ${playerId} hand, ${visibleHand.length} card${visibleHand.length === 1 ? '' : 's'}`}
          role="group"
          data-motion={motionKey.hand(playerId)}
        >
          {visibleHand.length === 0 ? (
            <div className="empty-hand">{isShuffling ? 'Shuffling…' : 'No cards in hand'}</div>
          ) : isIntroDealing ? (
            renderIntroDealHand()
          ) : isOpponent ? (
            // Opponent's hand: show face down, except Swamp-revealed cards
            visibleHand.map((card, index) => {
              const isRevealed = swampRevealedCards.includes(index)
              const isForestRevealed = forestRevealedCardIndex === index
              const isSelectableForDiscard = swampPhase === 'discard' && isRevealed && !!onSwampDiscard
              const revealedOrder = swampRevealedCards.indexOf(index) + 1
              const inFlight = index >= firstInFlightIndex
              return (
                <div
                  key={index}
                  className={`hand-card-group${inFlight ? ' motion-awaiting' : ''}`}
                  style={{ position: 'relative' }}
                  data-motion={motionKey.handIndex(playerId, index)}
                >
                  {swampPhase === 'reveal' && isRevealed && (
                    <div className="swamp-reveal-badges">
                      <span className="swamp-reveal-badge" title={`Revealed card ${revealedOrder}`}>{revealedOrder}</span>
                    </div>
                  )}
                  {isForestRevealed && (
                    <div className="forest-reveal-badge-wrapper">
                      <span className="forest-reveal-badge" title="Returned from graveyard by Forest">Returned</span>
                    </div>
                  )}
                  <Card
                    card={card}
                    index={index}
                    totalCards={visibleHand.length}
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
              const groups = visibleHand.reduce((acc, card, index) => {
                if (!acc[card]) acc[card] = []
                acc[card].push(index)
                return acc
              }, {} as Record<string, number[]>)

              return Object.entries(groups).map(([cardType, indices]) => {
                const inFlight = motionHolds.handByType[cardType as LandType] ?? 0
                const landedCount = indices.length - inFlight
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
                  } else if (onHandLimitDiscard) {
                    onHandLimitDiscard(indices[indices.length - 1])
                  } else if (canPlayCard) {
                    onPlayCard(indices[0])
                  }
                }
                const hasClickAction =
                  isSelectableForReveal || isSelectableForDiscard || !!onHandLimitDiscard || (canPlayCard && !!onPlayCard)

                return (
                  <div
                    key={cardType}
                    className={`hand-card-group${landedCount <= 0 ? ' motion-awaiting' : ''}`}
                    data-motion={motionKey.handCard(playerId, cardType as CardType)}
                  >
                    {swampPhase === 'reveal' && revealedOrderNumbers.length > 0 && (
                      <div className="swamp-reveal-badges">
                        {revealedOrderNumbers.map((orderNum) => (
                          <span key={orderNum} className="swamp-reveal-badge" title={`Revealed card ${orderNum}`}>{orderNum}</span>
                        ))}
                      </div>
                    )}
                    <Card
                      card={cardType as CardType}
                      index={0}
                      totalCards={1}
                      isPlayer1={isPlayer1}
                      onClick={hasClickAction ? handleClick : undefined}
                      isInHand={true}
                      isFlat={true}
                      isSwampRevealed={isRevealed}
                      isSwampSelectable={isSelectableForReveal || isSelectableForDiscard || !!onHandLimitDiscard}
                      count={Math.max(1, landedCount)}
                    />
                  </div>
                )
              })
            })()
          )}
        </div>
        <Deck
          count={deckCount}
          isPlayer1={isPlayer1}
          isShuffling={isShuffling}
          motionKey={motionKey.deck(playerId)}
        />
      </div>
    </div>
  )
}
