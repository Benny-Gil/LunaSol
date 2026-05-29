'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { LiveKitRoom, VideoConference } from '@livekit/components-react'
import '@livekit/components-styles'
import { apiFetch } from '@/lib/api'

interface ConsultationSessionProps {
  appointmentId: string
  /** Called when the participant disconnects / leaves the room. */
  onLeave: () => void
}

/**
 * Full-screen LiveKit consultation room. Fetches a short-lived token for the
 * given appointment, then renders the native LiveKit video UI (which includes
 * the ControlBar — mute, camera toggle, leave). No iframe.
 */
export default function ConsultationSession({ appointmentId, onLeave }: ConsultationSessionProps) {
  const { getToken } = useAuth()
  const [token, setToken] = useState<string>()
  const [serverUrl, setServerUrl] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const clerkToken = await getToken()
        const data = await apiFetch(`/appointments/${appointmentId}/livekit-token`, {
          token: clerkToken || undefined,
        })
        if (cancelled) return
        if (!data.url) throw new Error('LiveKit URL is not configured')
        setToken(data.token)
        setServerUrl(data.url)
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Could not start the session.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [appointmentId, getToken])

  if (error) {
    return (
      <div style={overlayStyle}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <p style={{ marginBottom: '16px' }}>{error}</p>
          <button onClick={onLeave} style={leaveButtonStyle}>
            Back to appointment
          </button>
        </div>
      </div>
    )
  }

  if (!token || !serverUrl) {
    return (
      <div style={overlayStyle}>
        <p style={{ color: '#fff' }}>Connecting to the consultation…</p>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        data-lk-theme="default"
        onDisconnected={onLeave}
        style={{ height: '100%' }}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#111827',
}

const leaveButtonStyle: React.CSSProperties = {
  padding: '10px 20px',
  background: '#ffffff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  color: '#111827',
  cursor: 'pointer',
}
