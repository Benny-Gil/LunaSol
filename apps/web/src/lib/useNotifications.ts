'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { io, Socket } from 'socket.io-client'
import { apiFetch } from './api'

export interface Notification {
  id: string
  type: string
  message: string
  isRead: boolean
  createdAt: string
}

export function useNotifications() {
  const { getToken } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const markRead = useCallback(
    async (id: string) => {
      const token = await getToken()
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH', token: token || undefined })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      )
    },
    [getToken],
  )

  useEffect(() => {
    let socket: Socket | null = null

    async function init() {
      const token = await getToken()
      if (!token) return

      // Fetch notification history
      try {
        const history: Notification[] = await apiFetch('/notifications', { token })
        setNotifications(history)
      } catch {
        // Not critical — live events still work
      }

      // Connect Socket.io through Nginx at /api/socket.io
      socket = io('', {
        path: '/api/socket.io',
        auth: { token },
        transports: ['websocket'],
      })

      socket.on('notification', (payload: { id: string; type: string; message: string; createdAt: string }) => {
        const newNotification: Notification = {
          id: payload.id,
          type: payload.type,
          message: payload.message,
          isRead: false,
          createdAt: payload.createdAt ?? new Date().toISOString(),
        }
        setNotifications((prev) => [newNotification, ...prev])
      })
    }

    init()

    return () => {
      socket?.disconnect()
    }
  }, [getToken])

  return { notifications, unreadCount, markRead }
}
