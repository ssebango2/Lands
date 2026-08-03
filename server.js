const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { createGame, getGame } = require('./lib/gameStore')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

function sendJson(res, status, data) {
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = status
  res.end(JSON.stringify(data))
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      const pathname = parsedUrl.pathname || ''

      if (pathname === '/healthz') {
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/plain')
        return res.end('ok')
      }

      // Handle game API in custom server so we use the same gameStore as socket server
      if (req.method === 'POST' && pathname === '/api/games') {
        const code = createGame()
        return sendJson(res, 200, { success: true, code, message: 'Game created successfully' })
      }
      if (req.method === 'GET' && pathname.startsWith('/api/games/')) {
        const code = pathname.slice('/api/games/'.length).replace(/\/$/, '')
        const game = getGame(code)
        if (!game) {
          return sendJson(res, 404, { exists: false, error: 'Game not found' })
        }
        return sendJson(res, 200, {
          exists: true,
          code: game.code,
          players: game.players.length,
          status: game.status,
          canJoin: game.players.length < 2 && game.status === 'waiting',
        })
      }

      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize Socket.io server
  const { initializeSocketServer } = require('./lib/socketServer.js')
  initializeSocketServer(httpServer)

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
})

