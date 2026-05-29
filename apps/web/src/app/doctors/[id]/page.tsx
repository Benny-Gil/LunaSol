'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { User, Calendar, Clock, ArrowLeft } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface Doctor {
  id: string
  name: string
  specialization: string
  bio: string | null
  profilePictureUrl: string | null
  contactDetails: string | null
}

interface Slot {
  id: string
  startTime: string
  endTime: string
}

function groupByDate(slots: Slot[]): Record<string, Slot[]> {
  return slots.reduce((acc, slot) => {
    const date = new Date(slot.startTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    if (!acc[date]) acc[date] = []
    acc[date].push(slot)
    return acc
  }, {} as Record<string, Slot[]>)
}

export default function DoctorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { getToken, isSignedIn } = useAuth()

  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [doctorRes, slotsRes] = await Promise.all([
          fetch(`/api/doctors/${id}`),
          fetch(`/api/doctors/${id}/availability`),
        ])
        if (doctorRes.ok) setDoctor(await doctorRes.json())
        if (slotsRes.ok) setSlots(await slotsRes.json())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleBook() {
    if (!selectedSlot) return
    if (!isSignedIn) {
      router.push('/sign-in')
      return
    }

    setBooking(true)
    setError('')
    try {
      const token = await getToken()
      await apiFetch('/appointments', {
        token: token || undefined,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: selectedSlot }),
      })
      setSuccess(true)
      setTimeout(() => router.push('/dashboard/patient/appointments'), 1500)
    } catch (err: any) {
      setError(err.message || 'Booking failed. Please try again.')
    } finally {
      setBooking(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <p style={{ color: '#6b7280' }}>Loading...</p>
      </div>
    )
  }

  if (!doctor) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <p style={{ color: '#6b7280' }}>Doctor not found.</p>
      </div>
    )
  }

  const grouped = groupByDate(slots)

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f9fafb', minHeight: '100vh', color: '#111827' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 40px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#6b7280' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <span style={{ fontSize: '18px', fontWeight: 700, color: '#111827', letterSpacing: '-0.5px' }}>LunaSol</span>
      </nav>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: '32px', alignItems: 'start' }}>
        {/* Doctor info */}
        <div>
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '32px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%', flexShrink: 0,
                background: doctor.profilePictureUrl ? `url(${doctor.profilePictureUrl}) center/cover` : '#f3f4f6',
                border: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {!doctor.profilePictureUrl && <User size={32} color="#9ca3af" />}
              </div>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.5px' }}>{doctor.name}</h1>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#059669', background: '#f0fdf4', padding: '4px 10px', borderRadius: '12px' }}>
                  {doctor.specialization}
                </span>
              </div>
            </div>

            {doctor.bio && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>About</h3>
                <p style={{ fontSize: '15px', color: '#4b5563', lineHeight: 1.7, margin: 0 }}>{doctor.bio}</p>
              </div>
            )}

            {doctor.contactDetails && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contact</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{doctor.contactDetails}</p>
              </div>
            )}
          </div>
        </div>

        {/* Slot picker */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '24px', position: 'sticky', top: '80px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Calendar size={18} color="#111827" />
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Available slots</h2>
          </div>

          {slots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <Clock size={32} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>No available slots in the next 14 days.</p>
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {Object.entries(grouped).map(([date, daySlots]) => (
                <div key={date} style={{ marginBottom: '20px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>{date}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {daySlots.map((slot) => {
                      const start = new Date(slot.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                      const isSelected = selectedSlot === slot.id
                      return (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedSlot(isSelected ? null : slot.id)}
                          style={{
                            padding: '6px 12px',
                            border: `2px solid ${isSelected ? '#111827' : '#e5e7eb'}`,
                            borderRadius: '8px',
                            background: isSelected ? '#111827' : '#ffffff',
                            color: isSelected ? '#ffffff' : '#374151',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {start}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#dc2626', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#166534', fontSize: '13px', fontWeight: 600 }}>
              Appointment booked! Redirecting...
            </div>
          )}

          <button
            onClick={handleBook}
            disabled={!selectedSlot || booking || success}
            style={{
              width: '100%',
              padding: '12px',
              background: selectedSlot && !booking && !success ? '#111827' : '#d1d5db',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: selectedSlot && !booking && !success ? 'pointer' : 'not-allowed',
              marginTop: '16px',
            }}
          >
            {booking ? 'Booking...' : !isSignedIn ? 'Sign in to book' : 'Book appointment'}
          </button>

          {!isSignedIn && (
            <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', marginTop: '8px', marginBottom: 0 }}>
              You need to be signed in to book.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
