# Multiplayer Setup - Quick Start

## Installation

All dependencies are already installed. The multiplayer functionality uses:
- Socket.io (server & client)
- Custom Next.js server with Socket.io integration
- In-memory game state storage

## Running the Application

### Development Mode
```bash
npm run dev
```

This starts the custom server on `http://localhost:3000` with Socket.io support.

### How to Test Multiplayer

1. **Start the server**: Run `npm run dev`
2. **Open two browser windows/tabs** (or use incognito mode for the second)
3. **Window 1**: Navigate to `http://localhost:3000/lobby` and click "Create New Game"
4. **Copy the game code** that appears
5. **Window 2**: Navigate to `http://localhost:3000/lobby` and enter the game code, then click "Join Game"
6. **Both windows** should automatically redirect to the game and see it start simultaneously

## Features

✅ **Real-time synchronization** - All game actions sync across players
✅ **Game creation & joining** - Unique game codes for each game
✅ **Waiting room** - Players wait until both join before game starts
✅ **Full game functionality** - All card effects work in multiplayer:
   - Plains: Draw card
   - Mountain: Target opponent's board card
   - Forest: Return card from graveyard
   - Swamp: Opponent reveals 3 cards, then discard one

## Architecture

- **Server**: `server.js` - Custom Next.js server with Socket.io
- **Socket Server**: `lib/socketServer.js` - Handles WebSocket connections
- **Game Store**: `lib/gameStore.js` - In-memory game state management
- **Client Hook**: `lib/useSocket.ts` - React hook for Socket.io client
- **Game Logic Hook**: `lib/useGame.ts` - Game action handlers with Socket.io sync
- **Lobby**: `app/lobby/page.tsx` - Create/join game interface
- **Game Page**: `app/game/[code]/page.tsx` - Main game interface with multiplayer

## Notes

- Games are stored in-memory (will be lost on server restart)
- For production, consider using Redis for persistent game storage
- Currently supports 2 players per game
- Game codes are 6-character uppercase alphanumeric strings


