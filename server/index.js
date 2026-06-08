import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { Server as SocketServer } from 'socket.io'
import rateLimit from 'express-rate-limit'
import marketRouter from './routes/market.js'
import watchlistRouter from './routes/watchlist.js'
import paperTradingRouter from './routes/paperTrading.js'
import { errorHandler } from './middleware/errorHandler.js'
import { initSocketBridge } from './services/socketBridge.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientDistPath = path.resolve(__dirname, '../client/dist')
const hasClientBuild = existsSync(clientDistPath)

const app = express()
const httpServer = createServer(app)

httpServer.keepAliveTimeout = 61_000
httpServer.headersTimeout = 65_000
httpServer.requestTimeout = 30_000

app.set('trust proxy', 1)

const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    methods: ['GET', 'POST'],
  },
})
initSocketBridge(io)

app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*' }))
app.use(express.json({ limit: '64kb' }))
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX ?? '300'),
  standardHeaders: true,
  legacyHeaders: false,
}))

app.use('/api/market', marketRouter)
app.use('/api/watchlist', watchlistRouter)
app.use('/api/paper-trading', paperTradingRouter)
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }))

if (hasClientBuild) {
  app.use(express.static(clientDistPath))
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io')) {
      return next()
    }
    return res.sendFile(path.join(clientDistPath, 'index.html'))
  })
}

app.use(errorHandler)

const PORT = parseInt(process.env.PORT ?? '3001')
httpServer.listen(PORT, () => {
  console.log(`StockSense server running on port ${PORT}`)
})
