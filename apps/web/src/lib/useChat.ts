'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { io, Socket } from 'socket.io-client'
import { apiFetch } from './api'
import type {
  ChatMessage,
  ConversationSummary,
  ConversationDetail,
  SendMessageDto,
  StartConversationDto,
} from '@lunasol/types'

/**
 * Out-of-call chat state: conversation list, the open thread, sending, and a
 * live `chat:message` subscription over the shared Socket.IO connection.
 */
export function useChat() {
  const { getToken } = useAuth()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [thread, setThread] = useState<ConversationDetail | null>(null)
  const [loadingThread, setLoadingThread] = useState(false)

  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = activeId

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  const refreshConversations = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    try {
      setConversations(await apiFetch('/chat/conversations', { token }))
    } catch {
      // non-critical
    }
  }, [getToken])

  /** Open an existing conversation by id (fetches the thread + marks it read). */
  const openConversation = useCallback(
    async (id: string) => {
      setActiveId(id)
      setLoadingThread(true)
      try {
        const token = await getToken()
        const detail: ConversationDetail = await apiFetch(`/chat/conversations/${id}/messages`, {
          token: token || undefined,
        })
        setThread(detail)
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)))
      } finally {
        setLoadingThread(false)
      }
    },
    [getToken],
  )

  /** Open (or create) the conversation with a counterpart and select it. */
  const startConversation = useCallback(
    async (dto: StartConversationDto) => {
      setLoadingThread(true)
      try {
        const token = await getToken()
        const detail: ConversationDetail = await apiFetch('/chat/conversations', {
          token: token || undefined,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dto),
        })
        setActiveId(detail.id)
        setThread(detail)
        await refreshConversations()
        return detail
      } finally {
        setLoadingThread(false)
      }
    },
    [getToken, refreshConversations],
  )

  const sendMessage = useCallback(
    async (dto: SendMessageDto) => {
      const id = activeIdRef.current
      if (!id) return
      const token = await getToken()
      const msg: ChatMessage = await apiFetch(`/chat/conversations/${id}/messages`, {
        token: token || undefined,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      })
      setThread((prev) => (prev && prev.id === id ? { ...prev, messages: [...prev.messages, msg] } : prev))
      await refreshConversations()
      return msg
    },
    [getToken, refreshConversations],
  )

  const closeThread = useCallback(() => {
    setActiveId(null)
    setThread(null)
  }, [])

  // Initial load + live subscription.
  useEffect(() => {
    let cancelled = false
    let socket: Socket | null = null

    async function init() {
      const token = await getToken()
      if (cancelled || !token) return
      refreshConversations()

      socket = io('', { path: '/api/socket.io', auth: { token }, transports: ['websocket'] })
      socket.on('chat:message', async (msg: ChatMessage) => {
        if (msg.conversationId === activeIdRef.current) {
          // Append to the open thread (guard against an echo) and persist read.
          setThread((prev) =>
            prev && prev.id === msg.conversationId && !prev.messages.some((m) => m.id === msg.id)
              ? { ...prev, messages: [...prev.messages, msg] }
              : prev,
          )
          const t = await getToken()
          apiFetch(`/chat/conversations/${msg.conversationId}/messages`, { token: t || undefined }).catch(() => {})
        }
        refreshConversations()
      })
    }

    init()
    return () => {
      cancelled = true
      socket?.disconnect()
    }
  }, [getToken, refreshConversations])

  return {
    conversations,
    activeId,
    thread,
    loadingThread,
    totalUnread,
    openConversation,
    startConversation,
    sendMessage,
    closeThread,
  }
}
