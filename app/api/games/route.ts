import { NextRequest, NextResponse } from 'next/server'
import { createGame } from '@/lib/gameStore'

export async function POST(request: NextRequest) {
  try {
    const code = createGame()
    return NextResponse.json({ 
      success: true, 
      code,
      message: 'Game created successfully' 
    })
  } catch (error) {
    console.error('Error creating game:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create game' },
      { status: 500 }
    )
  }
}


