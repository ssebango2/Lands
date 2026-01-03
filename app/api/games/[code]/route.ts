import { NextRequest, NextResponse } from 'next/server'
import { getGame } from '@/lib/gameStore'

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code
    const game = getGame(code)
    
    if (!game) {
      return NextResponse.json(
        { exists: false, error: 'Game not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      exists: true,
      code: game.code,
      players: game.players.length,
      status: game.status,
      canJoin: game.players.length < 2 && game.status === 'waiting',
    })
  } catch (error) {
    console.error('Error checking game:', error)
    return NextResponse.json(
      { exists: false, error: 'Failed to check game' },
      { status: 500 }
    )
  }
}


