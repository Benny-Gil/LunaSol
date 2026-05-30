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
  /**
   * Optional content rendered in a collapsible drawer next to the video (e.g.
   * the doctor's notes/prescription panel). When omitted, the video fills the
   * screen as before — so the patient side is unchanged.
   */
  sidePanel?: React.ReactNode
}

/**
 * Full-screen LiveKit consultation room. Fetches a short-lived token for the
 * given appointment, then renders the native LiveKit video UI (which includes
 * the ControlBar — mute, camera toggle, leave). No iframe.
 */
export default function ConsultationSession({ appointmentId, onLeave, sidePanel }: ConsultationSessionProps) {
  const { getToken } = useAuth()
  const [token, setToken] = useState<string>()
  const [serverUrl, setServerUrl] = useState<string>()
  const [error, setError] = useState<string>()
  const [panelOpen, setPanelOpen] = useState(true)

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
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', background: '#111827' }}>
      <div style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
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
        {sidePanel && !panelOpen && (
          <button onClick={() => setPanelOpen(true)} style={notesTabStyle}>
            📝 Notes
          </button>
        )}
      </div>
      {sidePanel && panelOpen && (
        <aside style={drawerStyle}>
          <div style={drawerHeaderStyle}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Consultation
            </span>
            <button onClick={() => setPanelOpen(false)} style={drawerHideButtonStyle}>
              Hide
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>{sidePanel}</div>
        </aside>
      )}
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

const drawerStyle: React.CSSProperties = {
  width: '400px',
  maxWidth: '90vw',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: '#f3f4f6',
  borderLeft: '1px solid #e5e7eb',
}

const drawerHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  borderBottom: '1px solid #e5e7eb',
  background: '#ffffff',
}

const drawerHideButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'none',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  cursor: 'pointer',
}

const notesTabStyle: React.CSSProperties = {
  position: 'absolute',
  top: '16px',
  right: '16px',
  padding: '8px 14px',
  background: '#ffffff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 600,
  color: '#111827',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  zIndex: 51,
}
