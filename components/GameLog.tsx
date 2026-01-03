interface GameLogProps {
  logs: string[]
}

export default function GameLog({ logs }: GameLogProps) {
  return (
    <div className="game-log">
      <h3>Game Log</h3>
      <div className="log-content">
        {logs.length === 0 ? (
          <div className="empty-hand">No game activity yet</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="log-entry">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  )
}


