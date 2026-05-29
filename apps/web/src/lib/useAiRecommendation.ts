import { useState, useRef, useEffect, useCallback } from 'react'

export interface AiRecommendedDoctor {
  id: string
  name: string
  specialization: string
  bio: string | null
  profilePictureUrl: string | null
  reason: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export function useAiRecommendation() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [reasoning, setReasoning] = useState('')
  const [recommendedDoctors, setRecommendedDoctors] = useState<AiRecommendedDoctor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)

  const stop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setLoading(false)
  }, [])

  const reset = useCallback(() => {
    stop()
    setReasoning('')
    setMessages([])
    setRecommendedDoctors([])
    setError(null)
  }, [stop])

  const streamQuery = useCallback((query: string) => {
    reset()
    if (!query.trim()) return

    setLoading(true)

    const url = `/api/ai/recommend?q=${encodeURIComponent(query)}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.addEventListener('reasoning', (e) => {
      const chunk = e.data
      setReasoning((prev) => prev + chunk)
    })

    es.addEventListener('doctors', (e) => {
      try {
        const docs = JSON.parse(e.data)
        setRecommendedDoctors(docs)
      } catch (err) {
        console.error('Failed to parse doctors event data:', err)
      }
    })

    es.addEventListener('error', (e) => {
      const errorMsg = (e as MessageEvent).data || 'An error occurred while streaming recommendations.'
      setError(errorMsg)
      stop()
    })

    es.addEventListener('done', () => {
      stop()
    })

    es.onerror = (err) => {
      console.error('EventSource error:', err)
      setError('Connection to AI service failed or timed out.')
      stop()
    }
  }, [reset, stop])

  const streamChat = useCallback((chatHistory: ChatMessage[]) => {
    stop()
    if (chatHistory.length === 0) return

    setLoading(true)
    setError(null)
    setRecommendedDoctors([])

    // Set the messages state
    setMessages(chatHistory)

    // Pre-create the assistant's typing bubble
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])
    setReasoning('')

    const url = `/api/ai/recommend?history=${encodeURIComponent(JSON.stringify(chatHistory))}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    let accumulatedReasoning = ''

    es.addEventListener('reasoning', (e) => {
      const chunk = e.data
      accumulatedReasoning += chunk
      setReasoning(accumulatedReasoning)
      setMessages((prev) => {
        const updated = [...prev]
        if (updated.length > 0) {
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant') {
            last.content = accumulatedReasoning
          }
        }
        return updated
      })
    })

    es.addEventListener('doctors', (e) => {
      try {
        const docs = JSON.parse(e.data)
        setRecommendedDoctors(docs)
      } catch (err) {
        console.error('Failed to parse doctors event data:', err)
      }
    })

    es.addEventListener('error', (e) => {
      const errorMsg = (e as MessageEvent).data || 'An error occurred while streaming recommendations.'
      setError(errorMsg)
      stop()
    })

    es.addEventListener('done', () => {
      stop()
    })

    es.onerror = (err) => {
      console.error('EventSource error:', err)
      setError('Connection to AI service failed or timed out.')
      stop()
    }
  }, [stop])

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  return {
    streamQuery,
    streamChat,
    messages,
    setMessages,
    reasoning,
    recommendedDoctors,
    loading,
    error,
    reset,
    stop,
  }
}
