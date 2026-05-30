'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { TrendingUp, CalendarClock, Scale, Ruler, Zap } from 'lucide-react'
import type { PatientMetric } from '@lunasol/types'
import { apiFetch } from '@/lib/api'
import { formatTimeRemaining, useNow } from '@/lib/time'

interface Appointment {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
  isInstant: boolean
  doctor: { id: string; name: string; specialization: string } | null
  slot: { startTime: string; endTime: string } | null
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
}

/**
 * Lightweight inline-SVG line chart of a metric series. No charting dependency —
 * matches the repo's no-Tailwind, inline-style convention. Renders a smooth
 * polyline with point markers, scaled to the data's own min/max.
 */
function Sparkline({
  values,
  color,
  width = 520,
  height = 120,
}: {
  values: number[]
  color: string
  width?: number
  height?: number
}) {
  if (values.length === 0) return null

  const pad = 12
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const innerW = width - pad * 2
  const innerH = height - pad * 2

  const points = values.map((v, i) => {
    const x = values.length === 1 ? width / 2 : pad + (i / (values.length - 1)) * innerW
    const y = pad + (1 - (v - min) / span) * innerH
    return { x, y }
  })

  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
      role="img"
      aria-label="Trend chart"
    >
      <polygon points={area} fill={color} fillOpacity={0.08} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#ffffff" stroke={color} strokeWidth={2} />
      ))}
    </svg>
  )
}

export default function HealthDashboard() {
  const { getToken } = useAuth()
  const now = useNow()
  const [metrics, setMetrics] = useState<PatientMetric[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const token = await getToken()
        const opts = { token: token || undefined }
        const [m, a] = await Promise.all([
          apiFetch('/patients/me/metrics', opts),
          apiFetch('/appointments/mine', opts),
        ])
        if (!cancelled) {
          setMetrics(m)
          setAppointments(a)
        }
      } catch {
        // Leave empty states in place on failure.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [getToken])

  // Soonest upcoming PENDING/CONFIRMED appointment. Instant appointments have
  // slot === null; treat them as immediately upcoming so they sort first.
  const nextAppt = appointments
    .filter((a) => a.status === 'PENDING' || a.status === 'CONFIRMED')
    .filter((a) => !a.slot || new Date(a.slot.startTime).getTime() > now - 60 * 60_000)
    .sort((a, b) => {
      const ta = a.slot ? new Date(a.slot.startTime).getTime() : 0
      const tb = b.slot ? new Date(b.slot.startTime).getTime() : 0
      return ta - tb
    })[0]

  const weights = metrics.map((m) => m.weight)
  const latest = metrics[metrics.length - 1]
  const first = metrics[0]
  const weightDelta = latest && first ? latest.weight - first.weight : 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '24px', marginBottom: '40px' }}>
      {/* Weight trend */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'inline-flex', padding: '8px', background: '#eff6ff', borderRadius: '8px', color: '#2563eb' }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#111827' }}>Weight Trend</h3>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0 0' }}>Over your recorded history</p>
            </div>
          </div>
          {latest && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>
                {latest.weight} <span style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>kg</span>
              </div>
              {metrics.length > 1 && (
                <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '4px', color: weightDelta > 0 ? '#b91c1c' : weightDelta < 0 ? '#15803d' : '#6b7280' }}>
                  {weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} kg
                </div>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>Loading…</p>
        ) : metrics.length === 0 ? (
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
            No measurements yet. Update your weight and height on your{' '}
            <a href="/dashboard/patient/profile" style={{ color: '#2563eb' }}>profile</a> to start tracking trends.
          </p>
        ) : (
          <>
            <Sparkline values={weights} color="#2563eb" />
            <div style={{ display: 'flex', gap: '24px', marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6b7280' }}>
                <Scale size={15} /> {weights.length} reading{weights.length === 1 ? '' : 's'}
              </div>
              {latest && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6b7280' }}>
                  <Ruler size={15} /> {latest.height} cm
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Next appointment summary */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ display: 'inline-flex', padding: '8px', background: '#f0fdf4', borderRadius: '8px', color: '#16a34a' }}>
            <CalendarClock size={20} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#111827' }}>Next Appointment</h3>
        </div>

        {loading ? (
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>Loading…</p>
        ) : !nextAppt ? (
          <div>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              You have no upcoming appointments.
            </p>
            <a href="/doctors" style={{ display: 'inline-block', background: '#111827', color: '#ffffff', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
              Book a Doctor
            </a>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
              {nextAppt.doctor?.name ?? 'Your doctor'}
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
              {nextAppt.doctor?.specialization ?? 'Consultation'}
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px', background: nextAppt.status === 'CONFIRMED' ? '#f0fdf4' : '#fef9c3', color: nextAppt.status === 'CONFIRMED' ? '#166534' : '#854d0e', marginBottom: '12px' }}>
              {nextAppt.status}
            </div>

            {nextAppt.isInstant || !nextAppt.slot ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#7c3aed', fontWeight: 600 }}>
                <Zap size={15} /> Instant consultation
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#374151' }}>
                {new Date(nextAppt.slot.startTime).toLocaleString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {(() => {
                  const rel = formatTimeRemaining(nextAppt.slot.startTime, now)
                  return rel ? <span style={{ color: '#6b7280' }}> · {rel}</span> : null
                })()}
              </div>
            )}

            <a href="/dashboard/patient/appointments" style={{ display: 'inline-block', marginTop: '16px', fontSize: '13px', fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}>
              View all appointments →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
