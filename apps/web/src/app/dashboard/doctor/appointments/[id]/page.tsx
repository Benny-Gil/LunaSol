'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft, Calendar, Clock, User, Video, Zap } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import ConsultationSession from '@/components/ConsultationSession'
import ConsultationPanel from './ConsultationPanel'
import PatientHistory from './PatientHistory'

interface Appointment {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
  livekitRoom: string | null
  isInstant: boolean
  patient: { id: string; name: string; profilePictureUrl: string | null }
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

export default function DoctorAppointmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { getToken } = useAuth()
  const [appt, setAppt] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [inSession, setInSession] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      const data = await apiFetch(`/appointments/${id}`, { token: token || undefined })
      setAppt(data)
    } catch {
      // fall through
    } finally {
      setLoading(false)
    }
  }, [getToken, id])

  useEffect(() => { load() }, [load])

  // Keep the join window accurate without a manual refresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  async function act(action: 'confirm' | 'complete') {
    setActing(true)
    try {
      const token = await getToken()
      await apiFetch(`/appointments/${id}/${action}`, { token: token || undefined, method: 'PATCH' })
      await load()
    } catch (err: any) {
      alert(err.message || `Failed to ${action} appointment.`)
    } finally {
      setActing(false)
    }
  }

  if (inSession && appt) {
    // Re-fetch on leave so a status change (e.g. completed) is reflected.
    return <ConsultationSession appointmentId={appt.id} onLeave={() => { setInSession(false); load() }} />
  }

  const isInstant = !!appt?.isInstant || (!!appt && !appt.slot)
  const date = appt?.slot ? new Date(appt.slot.startTime) : null
  const statusStyle = appt ? STATUS_COLORS[appt.status] : null
  const start = appt?.slot ? new Date(appt.slot.startTime).getTime() : 0
  const end = appt?.slot ? new Date(appt.slot.endTime).getTime() : 0
  // Instant consultations have no slot window — joinable as soon as confirmed.
  const withinWindow = isInstant || (now >= start - JOIN_LEAD_MS && now <= end)
  const canJoin = appt?.status === 'CONFIRMED' && !!appt.livekitRoom && withinWindow

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f9fafb', minHeight: '100vh' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 40px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <a href="/dashboard/doctor" style={{ fontSize: '18px', fontWeight: 700, color: '#111827', textDecoration: 'none' }}>LunaSol</a>
        <span style={{ color: '#d1d5db' }}>/</span>
        <a href="/dashboard/doctor/appointments" style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500, textDecoration: 'none' }}>Appointments</a>
      </nav>

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
        <button
          onClick={() => router.push('/dashboard/doctor/appointments')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#6b7280', fontSize: '14px', cursor: 'pointer', marginBottom: '24px', padding: 0 }}
        >
          <ArrowLeft size={16} /> Back to appointments
        </button>

        {loading ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '60px' }}>Loading...</p>
        ) : !appt ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '60px' }}>Appointment not found.</p>
        ) : (
          <>
            <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ display: 'flex', padding: '12px', background: '#ecfdf5', borderRadius: '12px', color: '#059669' }}>
                    <User size={24} />
                  </div>
                  <div>
                    <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 4px', letterSpacing: '-0.5px' }}>{appt.patient.name || 'Patient'}</h1>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Consultation</p>
                  </div>
                </div>
                {statusStyle && (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '12px', background: statusStyle.bg, color: statusStyle.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {appt.status}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '24px', paddingBottom: '24px', borderBottom: '1px solid #f3f4f6' }}>
                {isInstant || !date ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#059669', fontWeight: 600 }}>
                    <Zap size={16} /> Instant consultation · Now
                  </span>
                ) : (
                  <>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#4b5563' }}>
                      <Calendar size={16} color="#9ca3af" /> {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#4b5563' }}>
                      <Clock size={16} color="#9ca3af" /> {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </span>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px', flexWrap: 'wrap' }}>
                {appt.status === 'PENDING' && (
                  <button
                    onClick={() => act('confirm')}
                    disabled={acting}
                    style={{ padding: '10px 20px', background: '#10b981', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#ffffff', cursor: 'pointer' }}
                  >
                    {acting ? 'Working...' : 'Confirm appointment'}
                  </button>
                )}
                {appt.status === 'CONFIRMED' && (
                  <>
                    <button
                      onClick={() => setInSession(true)}
                      disabled={!canJoin}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: canJoin ? '#059669' : '#e5e7eb', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: canJoin ? '#ffffff' : '#9ca3af', cursor: canJoin ? 'pointer' : 'not-allowed' }}
                    >
                      <Video size={16} /> Join session
                    </button>
                    <button
                      onClick={() => act('complete')}
                      disabled={acting}
                      style={{ padding: '10px 20px', background: 'none', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                    >
                      {acting ? 'Working...' : 'Mark complete'}
                    </button>
                  </>
                )}
              </div>
              {appt.status === 'CONFIRMED' && !canJoin && (
                <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '12px' }}>
                  The session opens from {new Date(start - JOIN_LEAD_MS).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} on the day of the appointment.
                </p>
              )}
            </div>

            {(appt.status === 'CONFIRMED' || appt.status === 'COMPLETED') && (
              <ConsultationPanel appointmentId={appt.id} />
            )}

            <PatientHistory patientId={appt.patient.id} currentAppointmentId={appt.id} />
          </>
        )}
      </main>
    </div>
  )
}
