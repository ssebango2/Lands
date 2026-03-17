'use client'

import { useEffect, useRef } from 'react'

interface GameLogProps {
  logs: string[]
}

export default function GameLog({ logs }: GameLogProps) {
  const logContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll to bottom when new logs are added
    if (logContentRef.current) {
      logContentRef.current.scrollTop = logContentRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="game-log">
      <div className="log-content" ref={logContentRef}>
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


