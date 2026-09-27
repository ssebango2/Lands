'use client'

import type { KeyboardEvent } from 'react'
import { Card } from '@/lib/gameLogic'
import { motionKey } from '@/lib/cardMotion'
import Image from 'next/image'
import Dialog from './Dialog'
import { CARD_IMAGE } from './Card'

interface GraveyardProps {
  cards: Card[]
  isPlayer1: boolean
  onCardClick?: (cardIndex: number) => void
  isSelectable?: boolean
  isExpanded?: boolean
  onToggleExpand?: () => void
  playerId: 1 | 2
  /** Newest cards still flying in; the pile shows them once they land */
  hiddenCount?: number
  /** Locked Forest target in this graveyard */
  targetedCard?: Card
}

/** Group identical lands, preserving first-seen order; indices point into the original array. */
function groupByType(cards: Card[]): Array<{ type: Card; indices: number[] }> {
  const groups: Array<{ type: Card; indices: number[] }> = []
  cards.forEach((card, index) => {
    const existing = groups.find((g) => g.type === card)
    if (existing) existing.indices.push(index)
    else groups.push({ type: card, indices: [index] })
  })
  return groups
}

export default function Graveyard({
  cards,
  isPlayer1,
  onCardClick,
  isSelectable = false,
  isExpanded = false,
  onToggleExpand,
  playerId,
  hiddenCount = 0,
  targetedCard,
}: GraveyardProps) {
  const pile = hiddenCount > 0 ? cards.slice(0, Math.max(0, cards.length - hiddenCount)) : cards
  const topCard = targetedCard && pile.includes(targetedCard) ? targetedCard : pile[pile.length - 1]
  const cardWord = `card${cards.length === 1 ? '' : 's'}`
  const targetText = targetedCard ? ` ${targetedCard} is targeted by Forest.` : ''

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggleExpand?.()
    }
  }

  return (
    <>
      <div
        className={`pile graveyard ${isPlayer1 ? 'graveyard-bottom' : 'graveyard-top'} ${isSelectable ? 'graveyard-selectable' : ''}${targetedCard ? ' graveyard-targeted' : ''}`}
        onClick={onToggleExpand}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={isExpanded}
        aria-label={`Player ${playerId} graveyard, ${cards.length} ${cardWord}.${targetText} ${isSelectable ? 'Open to choose a card to return.' : 'Open to view.'}`}
      >
        <div className="pile-label" aria-hidden="true">
          {isSelectable ? 'Choose a card' : 'Graveyard'}
        </div>
        <div className="pile-stack graveyard-stack" aria-hidden="true" data-motion={motionKey.graveyard(playerId)}>
          {topCard ? (
            <>
              {pile.length > 2 && <div className="graveyard-card graveyard-card-under graveyard-card-under-2" />}
              {pile.length > 1 && <div className="graveyard-card graveyard-card-under" />}
              <div className="graveyard-card graveyard-card-top">
                <Image src={CARD_IMAGE[topCard]} alt="" fill style={{ objectFit: 'cover' }} sizes="100px" />
              </div>
            </>
          ) : (
            <div className="pile-empty">Empty</div>
          )}
          <span className="pile-count graveyard-count">{pile.length}</span>
          {targetedCard && <span className="target-badge pile-target-badge">Target</span>}
        </div>
      </div>
      {isExpanded && (
        <Dialog
          className="dialog-wide graveyard-dialog"
          eyebrow={`Player ${playerId}`}
          title="Graveyard"
          description={
            isSelectable
              ? 'Choose a land to return to your hand. Your opponent can respond once you choose.'
              : `${cards.length} ${cardWord}, grouped by land type.`
          }
          onClose={onToggleExpand}
          closeLabel="Close graveyard"
        >
          {cards.length === 0 ? (
            <p className="dialog-empty">This graveyard is empty.</p>
          ) : (
            <ul className="card-gallery">
              {groupByType(cards).map(({ type, indices }) => {
                const isTarget = targetedCard === type
                const art = (
                  <>
                    <span className="gallery-card-art">
                      <Image src={CARD_IMAGE[type]} alt="" fill style={{ objectFit: 'cover' }} sizes="150px" />
                      {indices.length > 1 && (
                        <span className="card-count-badge" aria-hidden="true">×{indices.length}</span>
                      )}
                      {isTarget && <span className="target-badge" aria-hidden="true">Target</span>}
                    </span>
                    <span className="gallery-card-name">{type}</span>
                  </>
                )
                const countText = indices.length > 1 ? ` (${indices.length} copies)` : ''
                const targetLabel = isTarget ? ', targeted by Forest' : ''
                return (
                  <li key={type}>
                    {isSelectable && onCardClick ? (
                      <button
                        type="button"
                        className="gallery-card gallery-card-selectable"
                        onClick={() => onCardClick(indices[indices.length - 1])}
                        aria-label={`Return ${type} to hand${countText}`}
                      >
                        {art}
                      </button>
                    ) : (
                      <div className={`gallery-card${isTarget ? ' gallery-card-targeted' : ''}`} aria-label={`${type}${countText}${targetLabel}`} role="img">
                        {art}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Dialog>
      )}
    </>
  )
}
