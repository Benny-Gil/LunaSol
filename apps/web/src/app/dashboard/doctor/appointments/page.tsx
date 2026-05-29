'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { Calendar, Clock } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface Appointment {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
  patient: { id: string; name: string }
  slot: { startTime: string; endTime: string }
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#fef9c3', text: '#854d0e' },
  CONFIRMED: { bg: '#f0fdf4', text: '#166534' },
  CANCELLED: { bg: '#fef2f2', text: '#991b1b' },
  COMPLETED: { bg: '#f3f4f6', text: '#374151' },
}

export default function DoctorAppointmentsPage() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  async function load() {
    try {
      const token = await getToken()
      const data = await apiFetch('/appointments/mine', { token: token || undefined })
      setAppointments(data)
    } catch {
      // fall through
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function act(id: string, action: 'confirm' | 'complete') {
    setActing(id)
    try {
      const token = await getToken()
      await apiFetch(`/appointments/${id}/${action}`, { token: token || undefined, method: 'PATCH' })
      await load()
    } catch (err: any) {
      alert(err.message || `Failed to ${action} appointment.`)
    } finally {
      setActing(null)
    }
  }

  const upcoming = appointments.filter((a) => a.status === 'PENDING' || a.status === 'CONFIRMED')
  const past = appointments.filter((a) => a.status === 'CANCELLED' || a.status === 'COMPLETED')

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f9fafb', minHeight: '100vh' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 40px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <a href="/dashboard/doctor" style={{ fontSize: '18px', fontWeight: 700, color: '#111827', textDecoration: 'none' }}>LunaSol</a>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>Appointments</span>
      </nav>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
        {loading ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '60px' }}>Loading appointments…</p>
        ) : appointments.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '60px' }}>No appointments yet.</p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section style={{ marginBottom: '40px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Upcoming</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {upcoming.map((appt) => (
                    <DoctorAppointmentCard key={appt.id} appt={appt} acting={acting} onAct={act} onOpen={() => router.push(`/dashboard/doctor/appointments/${appt.id}`)} />
                  ))}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Past</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {past.map((appt) => (
                    <DoctorAppointmentCard key={appt.id} appt={appt} acting={acting} onAct={act} onOpen={() => router.push(`/dashboard/doctor/appointments/${appt.id}`)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function DoctorAppointmentCard({ appt, acting, onAct, onOpen }: {
  appt: Appointment
  acting: string | null
  onAct: (id: string, action: 'confirm' | 'complete') => void
  onOpen: () => void
}) {
  const statusStyle = STATUS_COLORS[appt.status] || { bg: '#f3f4f6', text: '#374151' }
  const date = new Date(appt.slot.startTime)

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px 24px', cursor: 'pointer' }} onClick={onOpen}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111827' }}>{appt.patient.name}</h3>
        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: statusStyle.bg, color: statusStyle.text, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
          {appt.status}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: appt.status === 'PENDING' || appt.status === 'CONFIRMED' ? '16px' : '0' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6b7280' }}>
          <Calendar size={14} /> {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6b7280' }}>
          <Clock size={14} /> {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </span>
      </div>

      {(appt.status === 'PENDING' || appt.status === 'CONFIRMED') && (
        <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          {appt.status === 'PENDING' && (
            <button
              onClick={() => onAct(appt.id, 'confirm')}
              disabled={acting === appt.id}
              style={{ padding: '8px 16px', background: '#059669', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#ffffff', cursor: 'pointer' }}
            >
              {acting === appt.id ? 'Confirming…' : 'Confirm'}
            </button>
          )}
          {appt.status === 'CONFIRMED' && (
            <button
              onClick={() => onAct(appt.id, 'complete')}
              disabled={acting === appt.id}
              style={{ padding: '8px 16px', background: 'none', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
            >
              {acting === appt.id ? 'Completing…' : 'Mark complete'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
