interface DeckProps {
  count: number
  isPlayer1: boolean
  onClick?: () => void
}

export default function Deck({ count, isPlayer1, onClick }: DeckProps) {
  return (
    <div 
      className={`deck ${isPlayer1 ? 'deck-bottom' : 'deck-top'}`}
      onClick={onClick}
    >
      <div className="deck-stack">
        <div className="deck-card deck-card-back"></div>
        <div className="deck-card deck-card-back"></div>
        <div className="deck-card deck-card-back"></div>
      </div>
      <div className="deck-count">{count}</div>
    </div>
  )
}


