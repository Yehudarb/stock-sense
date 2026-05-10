import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import useStore from '../store/useStore'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? ''

export default function useSocket() {
  const socketRef = useRef(null)
  const currentTickerRef = useRef(null)
  const subscribedTickerRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)
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
      setSnapshot(prev => prev ? {
        ...prev,
        price: data.price,
        change: data.change,
        changePct: data.changePct,
        volume: data.volume,
        timestamp: data.timestamp,
      } : prev)
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
