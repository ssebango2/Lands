# Multiplayer Implementation Plan

## Technology Stack

### Recommended: Socket.io + Redis (or in-memory for dev)

**Why Socket.io?**
- Real-time bidirectional communication
- Works seamlessly with Next.js
- Handles reconnections automatically
- Room-based architecture perfect for game sessions
- Large community and good documentation

**Why Redis?**
- Persistent game state (survives server restarts)
- Can scale horizontally
- Built-in expiration for cleanup
- Alternative: In-memory Map for development (simpler, but lost on restart)

## Architecture

```
Client (Browser)
    ↓
Next.js API Routes (HTTP)
    ├─ POST /api/games → Create game, return code
    ├─ GET /api/games/[code] → Check if game exists
    └─ POST /api/games/[code]/join → Join game
    ↓
Socket.io Server (WebSocket)
    ├─ Connection → Join socket room
    ├─ game:action → Broadcast to room
    └─ game:state → Sync state to clients
    ↓
Game State Storage
    ├─ Redis (production)
    └─ In-memory Map (development)
```

## Implementation Steps

1. **Install Dependencies**
   - socket.io, socket.io-client
   - ioredis (optional, for Redis)
   - nanoid (for unique game codes)

2. **Create Socket.io Server**
   - Custom server or Next.js API route
   - Handle connections, rooms, game actions

3. **Game Management**
   - Generate unique 6-character codes
   - Store game state server-side
   - Handle player joining/leaving

4. **Client Updates**
   - Replace local state with Socket.io events
   - Add lobby screen (create/join)
   - Sync game state from server

5. **State Management**
   - Server is source of truth
   - Clients emit actions, server validates and broadcasts
   - All game logic runs server-side

## Alternative: Simpler Approach (No Redis)

For MVP, you can use:
- In-memory Map to store games
- Socket.io for real-time updates
- Game codes stored in memory (lost on restart, but simpler)

## File Structure

```
/
├── app/
│   ├── page.tsx (lobby/join screen)
│   ├── game/[code]/page.tsx (game screen)
│   └── api/
│       ├── games/route.ts (create game)
│       ├── games/[code]/route.ts (join game)
│       └── socket/route.ts (Socket.io handler)
├── lib/
│   ├── gameLogic.ts (existing)
│   ├── gameServer.ts (server-side game logic)
│   └── socket.ts (Socket.io client setup)
├── server/
│   └── socketServer.ts (Socket.io server)
└── public/
```


