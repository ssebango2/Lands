import { Card } from '@/lib/gameLogic'
import CardComponent from './Card'

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
        onClick={onToggleExpand && !isSelectable ? onToggleExpand : undefined}
      >
        <div className="graveyard-label">Graveyard</div>
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
                    className={`graveyard-card graveyard-card-back ${isSelectable && isTopCard ? 'graveyard-card-selectable' : ''}`}
                    style={{
                      transform: `translate(${visualIndex * 2}px, ${visualIndex * 2}px)`,
                      opacity: 1 - (visualIndex * 0.1),
                      zIndex: index,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isTopCard && onCardClick) {
                        onCardClick(index)
                      }
                    }}
                  >
                    {isSelectable && isTopCard && (
                      <div className="graveyard-card-label">{card}</div>
                    )}
                  </div>
                )
              })}
            </>
          ) : null}
        </div>
        <div className="graveyard-count">{cards.length}</div>
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
                <div className="graveyard-cards-list">
                  {cards.map((card, index) => (
                    <div key={`expanded-${card}-${index}`} className="graveyard-expanded-card">
                      <CardComponent
                        card={card}
                        index={0}
                        totalCards={1}
                        isPlayer1={isPlayer1}
                      />
                      <div className="graveyard-card-order">#{index + 1}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

