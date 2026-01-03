'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LobbyPage() {
  const router = useRouter()
  const [gameCode, setGameCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState('')

  const handleCreateGame = async () => {
    setIsCreating(true)
    setError('')
    
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (data.success) {
        router.push(`/game/${data.code}`)
      } else {
        setError(data.error || 'Failed to create game')
      }
    } catch (err) {
      setError('Failed to create game. Please try again.')
      console.error('Error creating game:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinGame = async () => {
    if (!gameCode.trim()) {
      setError('Please enter a game code')
      return
    }

    setIsJoining(true)
    setError('')
    
    try {
      const response = await fetch(`/api/games/${gameCode.toUpperCase()}`)
      const data = await response.json()
      
      if (data.exists && data.canJoin) {
        router.push(`/game/${gameCode.toUpperCase()}`)
      } else if (data.exists && !data.canJoin) {
        setError('Game is full or has already started')
      } else {
        setError('Game not found. Please check the code.')
      }
    } catch (err) {
      setError('Failed to join game. Please try again.')
      console.error('Error joining game:', err)
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="lobby-container">
      <div className="lobby-card">
        <h1>Basic Lands Game</h1>
        <p className="lobby-subtitle">Magic: The Gathering Basic Lands Card Game</p>
        
        <div className="lobby-actions">
          <button 
            className="btn btn-primary btn-large"
            onClick={handleCreateGame}
            disabled={isCreating || isJoining}
          >
            {isCreating ? 'Creating...' : 'Create New Game'}
          </button>
          
          <div className="lobby-divider">
            <span>OR</span>
          </div>
          
          <div className="join-section">
            <input
              type="text"
              className="game-code-input"
              placeholder="Enter Game Code"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinGame()}
              maxLength={8}
              disabled={isJoining || isCreating}
            />
            <button
              className="btn btn-secondary btn-large"
              onClick={handleJoinGame}
              disabled={isJoining || isCreating || !gameCode.trim()}
            >
              {isJoining ? 'Joining...' : 'Join Game'}
            </button>
          </div>
        </div>

        {error && (
          <div className="lobby-error">
            {error}
          </div>
        )}

        <div className="lobby-info">
          <p>• Create a game to get a unique code</p>
          <p>• Share the code with a friend to play together</p>
          <p>• Games support 2 players</p>
        </div>
      </div>
    </div>
  )
}


