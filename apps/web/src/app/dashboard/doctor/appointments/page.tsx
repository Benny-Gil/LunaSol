'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { Calendar, Clock, User } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface Appointment {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
  patient: { id: string; name: string; profilePictureUrl: string | null }
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

  useEffect(() => {
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
    load()
  }, [getToken])

  const upcoming = appointments.filter((a) => a.status === 'PENDING' || a.status === 'CONFIRMED')
  const past = appointments.filter((a) => a.status === 'CANCELLED' || a.status === 'COMPLETED')

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f9fafb', minHeight: '100vh' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 40px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/dashboard/doctor" style={{ fontSize: '18px', fontWeight: 700, color: '#111827', textDecoration: 'none' }}>LunaSol</a>
          <span style={{ color: '#d1d5db' }}>/</span>
          <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>Appointments</span>
        </div>
        <a href="/dashboard/doctor/schedule" style={{ padding: '8px 16px', background: '#10b981', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#ffffff', textDecoration: 'none' }}>
          Manage schedule
        </a>
      </nav>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
        {loading ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '60px' }}>Loading appointments...</p>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Calendar size={48} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>No appointments yet</h2>
            <p style={{ color: '#6b7280' }}>When patients book your open slots, their requests will appear here.</p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section style={{ marginBottom: '40px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Upcoming</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {upcoming.map((appt) => <AppointmentCard key={appt.id} appt={appt} onClick={() => router.push(`/dashboard/doctor/appointments/${appt.id}`)} />)}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Past</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {past.map((appt) => <AppointmentCard key={appt.id} appt={appt} onClick={() => router.push(`/dashboard/doctor/appointments/${appt.id}`)} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function AppointmentCard({ appt, onClick }: { appt: Appointment; onClick: () => void }) {
  const statusStyle = STATUS_COLORS[appt.status] || { bg: '#f3f4f6', text: '#374151' }
  const date = new Date(appt.slot.startTime)

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px 24px', cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', padding: '8px', background: '#ecfdf5', borderRadius: '8px', color: '#059669' }}>
            <User size={18} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111827' }}>{appt.patient.name || 'Patient'}</h3>
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: statusStyle.bg, color: statusStyle.text, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
          {appt.status}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6b7280' }}>
          <Calendar size={14} /> {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#6b7280' }}>
          <Clock size={14} /> {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </span>
      </div>
    </div>
  )
}
