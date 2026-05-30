'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { Calendar, Clock, Video, ArrowLeft, Zap } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import ConsultationSession from '@/components/ConsultationSession'

interface Appointment {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
  livekitRoom: string | null
  isInstant: boolean
  doctor: { id: string; name: string; specialization: string }
  slot: { startTime: string; endTime: string } | null
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#fef9c3', text: '#854d0e' },
  CONFIRMED: { bg: '#f0fdf4', text: '#166534' },
  CANCELLED: { bg: '#fef2f2', text: '#991b1b' },
  COMPLETED: { bg: '#f3f4f6', text: '#374151' },
}

// Join is allowed from 5 minutes before the slot start until the slot ends.
const JOIN_LEAD_MS = 5 * 60 * 1000

export default function PatientAppointmentDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { getToken } = useAuth()
  const [appt, setAppt] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [inSession, setInSession] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    ;(async () => {
      try {
        const token = await getToken()
        const data = await apiFetch(`/appointments/${id}`, { token: token || undefined })
        setAppt(data)
      } catch {
        // fall through to not-found state
      } finally {
        setLoading(false)
      }
    })()
  }, [id, getToken])

  // Keep the join window accurate without a manual refresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  if (inSession && appt) {
    return <ConsultationSession appointmentId={appt.id} onLeave={() => setInSession(false)} />
  }

  const isInstant = !!appt?.isInstant || !appt?.slot
  const start = appt?.slot ? new Date(appt.slot.startTime).getTime() : 0
  const end = appt?.slot ? new Date(appt.slot.endTime).getTime() : 0
  // Instant consultations have no slot window — the room is open as soon as it's confirmed.
  const withinWindow = isInstant || (now >= start - JOIN_LEAD_MS && now <= end)
  const canJoin = appt?.status === 'CONFIRMED' && !!appt.livekitRoom && withinWindow
  const statusStyle = (appt && STATUS_COLORS[appt.status]) || { bg: '#f3f4f6', text: '#374151' }

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f9fafb', minHeight: '100vh' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 40px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.push('/dashboard/patient/appointments')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#6b7280', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
          <ArrowLeft size={16} /> Appointments
        </button>
      </nav>

      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px' }}>
        {loading ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '60px' }}>Loading…</p>
        ) : !appt ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '60px' }}>Appointment not found.</p>
        ) : (
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: '#111827' }}>{appt.doctor.name}</h1>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>{appt.doctor.specialization}</p>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '12px', background: statusStyle.bg, color: statusStyle.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {appt.status}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '24px', marginBottom: '28px' }}>
              {isInstant || !appt.slot ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#059669', fontWeight: 600 }}>
                  <Zap size={16} /> Instant consultation · Now
                </span>
              ) : (
                <>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#374151' }}>
                    <Calendar size={16} /> {new Date(appt.slot.startTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#374151' }}>
                    <Clock size={16} /> {new Date(appt.slot.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </span>
                </>
              )}
            </div>

            {appt.status === 'CONFIRMED' && (
              <div>
                <button
                  onClick={() => setInSession(true)}
                  disabled={!canJoin}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: canJoin ? '#059669' : '#e5e7eb', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: canJoin ? '#ffffff' : '#9ca3af', cursor: canJoin ? 'pointer' : 'not-allowed' }}
                >
                  <Video size={16} /> Join session
                </button>
                {!canJoin && (
                  <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '10px' }}>
                    Available from {new Date(start - JOIN_LEAD_MS).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} on the day of your appointment.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
