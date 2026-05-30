'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { FolderOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface Prescription {
  id: string
  medicationName: string
  dosage: string
  frequency: string
  duration: string
  notes: string | null
}

interface ConsultationRecord {
  id: string
  notes: string | null
  prescriptions: Prescription[]
}

interface Appointment {
  id: string
  status: string
  isInstant?: boolean
  slot: { startTime: string } | null
  doctor: { name: string; specialization: string }
  record: ConsultationRecord | null
}

export default function RecordsPage() {
  const { getToken } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const data: Appointment[] = await apiFetch('/appointments/mine', { token: token || undefined })
        setAppointments(data.filter((a) => a.status === 'COMPLETED'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken])

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f9fafb', minHeight: '100vh' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 40px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <a href="/dashboard/patient" style={{ fontSize: '18px', fontWeight: 700, color: '#111827', textDecoration: 'none' }}>LunaSol</a>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>Medical Records</span>
      </nav>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.5px' }}>Medical Records</h1>
          <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>Your past consultations, notes, and prescriptions.</p>
        </div>

        {loading ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '60px' }}>Loading records...</p>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <FolderOpen size={48} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>No records yet</h2>
            <p style={{ color: '#6b7280' }}>Completed consultations and prescriptions will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {appointments.map((appt) => {
              const isOpen = expanded === appt.id
              const date = appt.slot ? new Date(appt.slot.startTime) : null
              const dateLabel = date
                ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : 'Instant consultation'

              return (
                <div key={appt.id} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : appt.id)}
                    style={{ width: '100%', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div>
                      <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{appt.doctor.name}</p>
                      <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                        {appt.doctor.specialization} · {dateLabel}
                      </p>
                    </div>
                    {isOpen ? <ChevronUp size={18} color="#6b7280" /> : <ChevronDown size={18} color="#6b7280" />}
                  </button>

                  {isOpen && (
                    <div style={{ padding: '0 24px 24px', borderTop: '1px solid #f3f4f6' }}>
                      {!appt.record ? (
                        <p style={{ color: '#6b7280', fontSize: '14px', paddingTop: '20px', margin: 0 }}>No consultation notes added yet.</p>
                      ) : (
                        <>
                          {appt.record.notes && (
                            <div style={{ paddingTop: '20px', marginBottom: '20px' }}>
                              <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Consultation Notes</h4>
                              <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>{appt.record.notes}</p>
                            </div>
                          )}

                          {appt.record.prescriptions.length > 0 && (
                            <div>
                              <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>
                                Prescriptions ({appt.record.prescriptions.length})
                              </h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {appt.record.prescriptions.map((rx) => (
                                  <div key={rx.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px 16px' }}>
                                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>{rx.medicationName}</p>
                                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                                      {rx.dosage} · {rx.frequency} · {rx.duration}
                                    </p>
                                    {rx.notes && <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0', fontStyle: 'italic' }}>{rx.notes}</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
