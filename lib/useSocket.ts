'use client'

import { useEffect, useRef, useState } from 'react'
import io from 'socket.io-client'

export function useSocket() {
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<ReturnType<typeof io> | null>(null)

  useEffect(() => {
    // Initialize socket connection
    // Polling fallback lets the client reconnect while the host is still waking
    // from idle, when the WebSocket upgrade would fail outright.
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin, {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 2000,
    })

    socketInstance.on('connect', () => {
      console.log('Connected to server')
      setIsConnected(true)
    })

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from server')
      setIsConnected(false)
    })

    socketRef.current = socketInstance
    setSocket(socketInstance)

    return () => {
      socketInstance.close()
    }
  }, [])

  return { socket, isConnected }
}

