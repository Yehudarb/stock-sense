import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import useStore from '../store/useStore'
import { mergeTickIntoBars, shouldApplyTick } from '../lib/liveBar'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? ''

export default function useSocket() {
  const socketRef = useRef(null)
  const currentTickerRef = useRef(null)
  const subscribedTickerRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)
  // Throttle state for folding ticks into the bars. Refs, not state: these
  // must not themselves cause a render.
  const lastAppliedAtRef = useRef(null)
  const lastAppliedPriceRef = useRef(null)
  const { currentTicker, setSnapshot } = useStore()

  useEffect(() => {
    currentTickerRef.current = currentTicker
  }, [currentTicker])

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      if (currentTickerRef.current && subscribedTickerRef.current !== currentTickerRef.current) {
        socket.emit('subscribe', { ticker: currentTickerRef.current })
        subscribedTickerRef.current = currentTickerRef.current
      }
    })
    socket.on('disconnect', () => setIsConnected(false))
    socket.on('tick', (data) => {
      if (data.ticker !== currentTickerRef.current) return

      // The price alone only ever reached the header. Folding it into the last
      // bar is what makes the indicators, signal, patterns and levels live,
      // since every one of them already derives from ohlcv.
      if (shouldApplyTick({
        lastAppliedAt: lastAppliedAtRef.current,
        lastAppliedPrice: lastAppliedPriceRef.current,
        tickPrice: data.price,
      })) {
        const { ohlcv, interval, applyLiveBars } = useStore.getState()
        const merged = mergeTickIntoBars(ohlcv, data, interval)
        // mergeTickIntoBars returns the SAME array when the tick does not
        // apply, so a rejected or unchanged tick costs no recompute.
        if (merged !== ohlcv) {
          applyLiveBars(merged)
          lastAppliedAtRef.current = Date.now()
          lastAppliedPriceRef.current = data.price
        }
      }

      setSnapshot(prev => {
        const base = prev || {}
        return {
          ...base,
          ticker: data.ticker,
          name: data.name ?? prev?.name ?? data.ticker,
          price: data.price,
          change: data.change,
          changePct: data.changePct,
          volume: data.volume,
          timestamp: data.timestamp,
        }
      })
    })

    return () => { socket.disconnect() }
  }, [setSnapshot])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !currentTicker) return

    const previousTicker = subscribedTickerRef.current
    if (previousTicker && previousTicker !== currentTicker) {
      socket.emit('unsubscribe', { ticker: previousTicker })
    }

    socket.emit('subscribe', { ticker: currentTicker })
    subscribedTickerRef.current = currentTicker

    return () => {
      if (socket.connected && subscribedTickerRef.current === currentTicker) {
        socket.emit('unsubscribe', { ticker: currentTicker })
        subscribedTickerRef.current = null
      }
    }
  }, [currentTicker])

  return { isConnected }
}
