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
  const [thought, setThought] = useState('')
  const [thinking, setThinking] = useState(false)
  const [recommendedDoctors, setRecommendedDoctors] = useState<AiRecommendedDoctor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Which engine tier produced this response: 'basic' = the local quick-match
  // fallback (shows a calm banner), null/'ai' = the conversational LLM tiers.
  const [mode, setMode] = useState<'ai' | 'basic' | null>(null)

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
    setThought('')
    setThinking(false)
    setMessages([])
    setRecommendedDoctors([])
    setError(null)
    setMode(null)
  }, [stop])

  const streamQuery = useCallback((query: string) => {
    reset()
    if (!query.trim()) return

    setLoading(true)

    const url = `/api/ai/recommend?q=${encodeURIComponent(query)}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.addEventListener('thought', (e) => {
      // Chain-of-thought preview. NestJS forwards the payload as a plain
      // string, so e.data is used directly (matching the reasoning handler).
      setThinking(true)
      setThought((prev) => prev + e.data)
    })

    es.addEventListener('reasoning', (e) => {
      // First reasoning token means thinking is done — collapse the preview.
      setThinking(false)
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

    es.addEventListener('mode', (e) => {
      setMode((e.data as 'ai' | 'basic') || null)
    })

    es.addEventListener('error', (e) => {
      const errorMsg = (e as MessageEvent).data || 'An error occurred while streaming recommendations.'
      setError(errorMsg)
      stop()
    })

    es.addEventListener('done', () => {
      setThinking(false)
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
    setMode(null)

    // Set the messages state
    setMessages(chatHistory)

    // Pre-create the assistant's typing bubble
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])
    setReasoning('')
    setThought('')
    setThinking(false)

    const url = `/api/ai/recommend?history=${encodeURIComponent(JSON.stringify(chatHistory))}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    let accumulatedReasoning = ''
    let accumulatedThought = ''

    es.addEventListener('thought', (e) => {
      setThinking(true)
      accumulatedThought += e.data
      setThought(accumulatedThought)
    })

    es.addEventListener('reasoning', (e) => {
      setThinking(false)
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

    es.addEventListener('mode', (e) => {
      setMode((e.data as 'ai' | 'basic') || null)
    })

    es.addEventListener('error', (e) => {
      const errorMsg = (e as MessageEvent).data || 'An error occurred while streaming recommendations.'
      setError(errorMsg)
      stop()
    })

    es.addEventListener('done', () => {
      setThinking(false)
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
    thought,
    thinking,
    recommendedDoctors,
    loading,
    error,
    mode,
    reset,
    stop,
  }
}
