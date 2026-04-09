'use client'

import { Card } from '@/lib/gameLogic'
import Image from 'next/image'

const getCardImage = (landType: Card): string => {
  const imageMap: Record<Card, string> = {
    'Plains': '/images/plains.jpg',
    'Island': '/images/island.jpg',
    'Swamp': '/images/swamp.jpg',
    'Mountain': '/images/mountain.jpg',
    'Forest': '/images/forest.jpg',
  }
  return imageMap[landType]
}

interface GraveyardProps {
  cards: Card[]
  isPlayer1: boolean
  onCardClick?: (cardIndex: number) => void
  isSelectable?: boolean
  isExpanded?: boolean
  onToggleExpand?: () => void
  playerId: number
}

export default function Graveyard({ 
  cards, 
  isPlayer1, 
  onCardClick, 
  isSelectable = false,
  isExpanded = false,
  onToggleExpand,
  playerId
}: GraveyardProps) {
  return (
    <>
      <div 
        className={`graveyard ${isPlayer1 ? 'graveyard-bottom' : 'graveyard-top'} ${isSelectable ? 'graveyard-selectable' : ''}`}
        onClick={onToggleExpand ? onToggleExpand : undefined}
        role="button"
        aria-label={isExpanded ? 'Close graveyard' : 'View graveyard'}
        title="Click to view graveyard"
      >
        <div 
          className="graveyard-label" 
          onClick={onToggleExpand ? (e) => { e.stopPropagation(); onToggleExpand(); } : undefined}
        >
          Graveyard
        </div>
        <div className="graveyard-stack">
          {cards.length > 0 ? (
            <>
              {cards.map((card, index) => {
                const isTopCard = index === cards.length - 1
                // Display cards with newest on top (reverse visual order)
                const visualIndex = cards.length - 1 - index
                return (
                  <div
                    key={`graveyard-${card}-${index}`}
                    className={`graveyard-card ${isTopCard ? 'graveyard-card-top' : 'graveyard-card-back'} ${isSelectable && isTopCard ? 'graveyard-card-selectable' : ''}`}
                    style={{
                      transform: `translate(${visualIndex * 2}px, ${visualIndex * 2}px)`,
                      opacity: isTopCard ? 1 : 1 - (visualIndex * 0.15),
                      zIndex: index,
                    }}
                    onClick={(e) => {
                      // Collapsed view: always let click bubble to expand. Selection only in expanded view.
                      if (isSelectable && isTopCard && onCardClick) {
                        // Don't select here - user must expand to pick a card
                        return
                      }
                      // When !isSelectable, let click bubble to parent to trigger expand
                    }}
                  >
                    {isTopCard ? (
                      <Image
                        src={getCardImage(card)}
                        alt={card}
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes="120px"
                      />
                    ) : (
                      <div className="graveyard-card-back-inner"></div>
                    )}
                    {isSelectable && isTopCard && (
                      <div className="graveyard-card-label">{card}</div>
                    )}
                  </div>
                )
              })}
            </>
          ) : (
            <div className="graveyard-empty-indicator">Empty</div>
          )}
        </div>
        <div 
          className="graveyard-count"
          onClick={onToggleExpand ? (e) => { e.stopPropagation(); onToggleExpand(); } : undefined}
        >
          {cards.length}
        </div>
      </div>
      {isExpanded && (
        <>
          <div className="graveyard-backdrop" onClick={onToggleExpand}></div>
          <div className={`graveyard-expanded ${isPlayer1 ? 'graveyard-expanded-bottom' : 'graveyard-expanded-top'}`}>
            <div className="graveyard-expanded-header">
              <h3>Player {playerId} Graveyard</h3>
              <button className="graveyard-close-btn" onClick={(e) => {
                e.stopPropagation()
                onToggleExpand?.()
              }}>×</button>
            </div>
            <div className="graveyard-expanded-content">
              {cards.length === 0 ? (
                <div className="graveyard-empty">Graveyard is empty</div>
              ) : (
                <div className="graveyard-cards-list graveyard-cards-flat">
                  {cards.map((card, index) => {
                    const sameTypeIndices = cards.map((c, i) => c === card ? i : -1).filter(i => i >= 0)
                    const isLastOfType = index === sameTypeIndices[sameTypeIndices.length - 1]
                    const duplicateCount = sameTypeIndices.length
                    return (
                      <div
                        key={`expanded-${card}-${index}`}
                        className={`graveyard-expanded-card graveyard-expanded-card-flat ${isSelectable ? 'graveyard-expanded-card-selectable' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (isSelectable && onCardClick) onCardClick(index)
                        }}
                      >
                        <div className="graveyard-expanded-card-image">
                          <Image
                            src={getCardImage(card)}
                            alt={card}
                            fill
                            style={{ objectFit: 'cover' }}
                            sizes="150px"
                          />
                        </div>
                        {isLastOfType && duplicateCount > 1 && (
                          <div className="graveyard-card-count-badge">{duplicateCount}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

