# Multiplayer Setup Guide

## Overview

The multiplayer functionality uses Socket.io for real-time communication between players. Games are stored in-memory (can be upgraded to Redis for production).

## Running the Server

The app now uses a custom server (`server.js`) that includes both Next.js and Socket.io.

### Development
```bash
npm run dev
```

This starts the custom server on `http://localhost:3000`

### Production
```bash
npm run build
npm start
```

## How It Works

1. **Create Game**: Player clicks "Create New Game" → API generates unique code → Player redirected to `/game/[code]`
2. **Join Game**: Player enters code → API validates → Player redirected to `/game/[code]`
3. **Game Start**: When 2 players join, server initializes game and broadcasts to both
4. **Real-time Updates**: All game actions are sent via Socket.io and synced to all players

## File Structure

- `server.js` - Custom Next.js server with Socket.io
- `lib/socketServer.js` - Socket.io server logic
- `lib/gameStore.js` - In-memory game state storage
- `lib/gameLogic.js` - Game logic (JavaScript version for server)
- `app/api/games/` - HTTP API routes for game creation/joining
- `app/lobby/page.tsx` - Lobby screen (create/join)
- `app/game/[code]/page.tsx` - Game screen with Socket.io integration
- `lib/useSocket.ts` - React hook for Socket.io client

## Next Steps

1. **Complete Game Integration**: Update game actions in `/app/game/[code]/page.tsx` to use Socket.io
2. **Server-side Validation**: Add game logic validation on the server
3. **Error Handling**: Improve error handling and reconnection logic
4. **Production**: Consider Redis for persistent game storage

## Testing

1. Open two browser windows/tabs
2. In first window: Create a new game
3. Copy the game code
4. In second window: Join with the code
5. Both should see the game start simultaneously


