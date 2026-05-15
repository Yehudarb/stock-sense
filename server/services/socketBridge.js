import { getSnapshot } from './yahooFinance.js'

const subscriptions = new Map()

export function initSocketBridge(io) {
  io.on('connection', socket => {
    socket.on('subscribe', ({ ticker }) => {
      if (!ticker) return
      const upper = ticker.toUpperCase()
      socket.join(upper)

      if (!subscriptions.has(upper)) {
        const interval = setInterval(async () => {
          try {
            const snap = await getSnapshot(upper)
            io.to(upper).emit('tick', {
              ticker: upper,
              name: snap.name,
              price: snap.price,
              change: snap.change,
              changePct: snap.changePct,
              volume: snap.volume,
              timestamp: snap.timestamp,
            })
          } catch {}
        }, 3000)
        subscriptions.set(upper, { interval, count: 1 })
      } else {
        subscriptions.get(upper).count++
      }
    })

    socket.on('unsubscribe', ({ ticker }) => {
      if (!ticker) return
      const upper = ticker.toUpperCase()
      socket.leave(upper)
      const sub = subscriptions.get(upper)
      if (sub) {
        sub.count--
        if (sub.count <= 0) {
          clearInterval(sub.interval)
          subscriptions.delete(upper)
        }
      }
    })

    socket.on('disconnect', () => {
      for (const [ticker, sub] of subscriptions.entries()) {
        if (socket.rooms?.has(ticker)) {
          sub.count--
          if (sub.count <= 0) {
            clearInterval(sub.interval)
            subscriptions.delete(ticker)
          }
        }
      }
    })
  })
}
