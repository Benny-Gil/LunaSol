'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Zap } from 'lucide-react'
import { apiFetch } from '@/lib/api'

export default function InstantToggle() {
  const { getToken } = useAuth()
  const [accepting, setAccepting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const token = await getToken()
        const data = await apiFetch('/doctors/me', { token: token || undefined })
        setAccepting(!!data.acceptingInstant)
      } catch {
        // keep default
      } finally {
        setLoading(false)
      }
    })()
  }, [getToken])

  async function toggle() {
    const next = !accepting
    setSaving(true)
    setError('')
    // Optimistic update.
    setAccepting(next)
    try {
      const token = await getToken()
      await apiFetch('/doctors/me/instant', {
        token: token || undefined,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptingInstant: next }),
      })
    } catch (err: any) {
      setAccepting(!next)
      setError(err.message || 'Failed to update. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', padding: '12px', background: accepting ? '#ecfdf5' : '#f3f4f6', borderRadius: '12px', color: accepting ? '#059669' : '#9ca3af' }}>
        <Zap size={24} />
      </div>
      <div style={{ flex: 1, minWidth: '240px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px', color: '#111827' }}>Instant consultations</h3>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
          {accepting
            ? 'You appear as available now. Patients can start an instant consultation request with you.'
            : 'Turn this on to let patients start an on-demand consultation with you right now.'}
        </p>
        {error && <p style={{ fontSize: '13px', color: '#dc2626', margin: '8px 0 0' }}>{error}</p>}
      </div>
      <button
        onClick={toggle}
        disabled={loading || saving}
        aria-pressed={accepting}
        style={{
          position: 'relative',
          width: '52px',
          height: '30px',
          borderRadius: '15px',
          border: 'none',
          background: accepting ? '#10b981' : '#d1d5db',
          cursor: loading || saving ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '3px',
            left: accepting ? '25px' : '3px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: '#ffffff',
            transition: 'left 0.15s',
          }}
        />
      </button>
    </div>
  )
}
