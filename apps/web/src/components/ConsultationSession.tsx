'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { LiveKitRoom, VideoConference } from '@livekit/components-react'
import '@livekit/components-styles'
import { NotebookPen, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface ConsultationSessionProps {
  appointmentId: string
  /** Called when the participant disconnects / leaves the room. */
  onLeave: () => void
  /**
   * Optional content rendered in a collapsible panel next to the video (e.g.
   * the doctor's notes/prescription panel). When omitted, the video fills the
   * screen as before — so the patient side is unchanged.
   */
  sidePanel?: React.ReactNode
}

/** True when the viewport is too narrow to show video + drawer side by side. */
function useIsNarrow(maxWidth = 820) {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [maxWidth])
  return narrow
}

/**
 * Full-screen LiveKit consultation room. Fetches a short-lived token for the
 * given appointment, then renders the LiveKit video UI (ControlBar — mute,
 * camera toggle, leave) under a light theme. An optional `sidePanel` rides
 * along in a collapsible drawer (side-by-side on desktop, full overlay on
 * narrow screens).
 */
export default function ConsultationSession({ appointmentId, onLeave, sidePanel }: ConsultationSessionProps) {
  const { getToken } = useAuth()
  const [token, setToken] = useState<string>()
  const [serverUrl, setServerUrl] = useState<string>()
  const [error, setError] = useState<string>()
  const [panelOpen, setPanelOpen] = useState(true)
  const narrow = useIsNarrow()

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
      <div style={messageOverlayStyle}>
        <div style={{ textAlign: 'center', color: '#111827' }}>
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
      <div style={messageOverlayStyle}>
        <p style={{ color: '#6b7280' }}>Connecting to the consultation…</p>
      </div>
    )
  }

  const showDrawer = !!sidePanel && panelOpen

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', background: '#f9fafb' }}>
      <div style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          connect
          data-lk-theme="default"
          onDisconnected={onLeave}
          style={{ height: '100%', ...lightThemeVars }}
        >
          <VideoConference />
        </LiveKitRoom>
        {sidePanel && !panelOpen && (
          <button onClick={() => setPanelOpen(true)} style={notesTabStyle}>
            <NotebookPen size={16} /> Notes
          </button>
        )}
      </div>

      {showDrawer && (
        <aside style={narrow ? drawerOverlayStyle : drawerStyle}>
          <div style={drawerHeaderStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: '#111827' }}>
              <NotebookPen size={17} color="#059669" /> Consultation notes
            </span>
            <button onClick={() => setPanelOpen(false)} style={drawerHideButtonStyle} aria-label="Hide notes panel">
              <X size={15} /> {narrow ? null : 'Hide'}
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }}>{sidePanel}</div>
        </aside>
      )}
    </div>
  )
}

/**
 * Inline overrides that flip LiveKit's default (dark) theme to a light palette
 * matching the app. Set on the room element, these beat the stylesheet's
 * `[data-lk-theme="default"]` rules. The bgN ladder goes light→mid-gray; the
 * accent uses the app's green instead of LiveKit blue.
 */
const lightThemeVars = {
  '--lk-bg': '#ffffff',
  '--lk-bg2': '#f3f4f6',
  '--lk-bg3': '#e5e7eb',
  '--lk-bg4': '#d1d5db',
  '--lk-bg5': '#9ca3af',
  '--lk-fg': '#111827',
  '--lk-fg2': '#1f2937',
  '--lk-fg3': '#374151',
  '--lk-fg4': '#4b5563',
  '--lk-fg5': '#6b7280',
  '--lk-border-color': 'rgba(0, 0, 0, 0.08)',
  '--lk-accent-bg': '#10b981',
  '--lk-accent-fg': '#ffffff',
} as React.CSSProperties

const messageOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f9fafb',
}

const leaveButtonStyle: React.CSSProperties = {
  padding: '10px 20px',
  background: '#111827',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  color: '#ffffff',
  cursor: 'pointer',
}

const drawerStyle: React.CSSProperties = {
  width: 'clamp(320px, 32vw, 440px)',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: '#ffffff',
  borderLeft: '1px solid #e5e7eb',
  boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.06)',
}

const drawerOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 52,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: '#ffffff',
}

const drawerHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  borderBottom: '1px solid #e5e7eb',
  background: '#ffffff',
  flexShrink: 0,
}

const drawerHideButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
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
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '9px 14px',
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  fontSize: '13px',
  fontWeight: 600,
  color: '#111827',
  cursor: 'pointer',
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.12)',
  zIndex: 51,
}
