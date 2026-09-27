interface DeckProps {
  count: number
  isPlayer1: boolean
  onClick?: () => void
  /** Play shuffle jitter animation (opening ritual) */
  isShuffling?: boolean
  /** `data-motion` anchor for cards drawn from this deck */
  motionKey?: string
}

export default function Deck({ count, isPlayer1, onClick, isShuffling = false, motionKey }: DeckProps) {
  const label = isShuffling ? 'Deck, shuffling' : `Deck, ${count} card${count === 1 ? '' : 's'} remaining`

  return (
    <div
      className={`pile deck ${isPlayer1 ? 'deck-bottom' : 'deck-top'}${isShuffling ? ' deck-shuffling' : ''}${count === 0 ? ' deck-empty' : ''}`}
      onClick={onClick}
      role="group"
      aria-label={label}
    >
      <div className="pile-label" aria-hidden="true">Deck</div>
      <div className="pile-stack deck-stack" aria-hidden="true" data-motion={motionKey}>
        {count > 0 ? (
          <>
            <div className="deck-card deck-card-back" />
            {count > 1 && <div className="deck-card deck-card-back" />}
            {count > 2 && <div className="deck-card deck-card-back" />}
          </>
        ) : (
          <div className="pile-empty">Empty</div>
        )}
        <span className="pile-count deck-count">{count}</span>
      </div>
    </div>
  )
}
