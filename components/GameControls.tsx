import { GameState } from '@/lib/gameLogic'

interface GameControlsProps {
  onNewGame: () => void
  onDrawCard: (playerId: 1 | 2) => void
  gameState: GameState | null
}

export default function GameControls({ onNewGame, onDrawCard, gameState }: GameControlsProps) {
  return (
    <div className="game-controls">
      <button className="btn btn-small" onClick={onNewGame}>
        New Game
      </button>
    </div>
  )
}

