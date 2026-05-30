'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { History, ChevronDown, ChevronUp } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { SymptomLog } from '@lunasol/types'
import { SeverityBadge } from '@/lib/symptoms'

interface Prescription {
  id: string
  medicationName: string
  dosage: string
  frequency: string
  duration: string
}

interface Appointment {
  id: string
  status: string
  isInstant?: boolean
  slot: { startTime: string } | null
  record: { notes: string | null; prescriptions: Prescription[] } | null
}

export default function PatientHistory({ patientId, currentAppointmentId }: { patientId: string; currentAppointmentId: string }) {
  const { getToken } = useAuth()
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<Appointment[]>([])
  const [symptoms, setSymptoms] = useState<SymptomLog[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const token = await getToken()

    // Fetch consultations and symptom logs concurrently and independently, so
    // one failing (e.g. permissions) doesn't blank or delay the other.
    const [appts, logs] = await Promise.allSettled([
      apiFetch(`/appointments/mine?patientId=${patientId}`, { token: token || undefined }) as Promise<Appointment[]>,
      apiFetch(`/symptom-logs/patient/${patientId}`, { token: token || undefined }) as Promise<SymptomLog[]>,
    ])

    if (appts.status === 'fulfilled') {
      setHistory(appts.value.filter((a) => a.id !== currentAppointmentId && a.status === 'COMPLETED'))
    }
    if (logs.status === 'fulfilled') {
      setSymptoms(logs.value)
    }

    setLoaded(true)
  }, [getToken, patientId, currentAppointmentId])

  useEffect(() => { if (open && !loaded) load() }, [open, loaded, load])

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', marginTop: '20px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <History size={20} color="#059669" />
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>Patient history</span>
        </span>
        {open ? <ChevronUp size={18} color="#6b7280" /> : <ChevronDown size={18} color="#6b7280" />}
      </button>

      {open && (
        <div style={{ padding: '0 28px 24px', borderTop: '1px solid #f3f4f6' }}>
          {!loaded ? (
            <p style={{ color: '#9ca3af', fontSize: '14px', paddingTop: '20px', margin: 0 }}>Loading...</p>
          ) : history.length === 0 && symptoms.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '14px', paddingTop: '20px', margin: 0 }}>No prior consultations or symptom logs for this patient.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingTop: '20px' }}>
              {symptoms.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Reported symptoms</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {symptoms.map((s) => (
                      <div key={s.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <SeverityBadge severity={s.severity} />
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>
                            {new Date(s.loggedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{s.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {history.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Prior consultations</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {history.map((a) => {
                const date = a.slot ? new Date(a.slot.startTime) : null
                return (
                  <div key={a.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>
                      {date
                        ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                        : 'Instant consultation'}
                    </p>
                    {a.record?.notes ? (
                      <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.6, margin: '0 0 8px', whiteSpace: 'pre-line' }}>{a.record.notes}</p>
                    ) : (
                      <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 8px', fontStyle: 'italic' }}>No notes recorded.</p>
                    )}
                    {a.record && a.record.prescriptions.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {a.record.prescriptions.map((p) => (
                          <span key={p.id} style={{ fontSize: '12px', color: '#374151', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '3px 8px' }}>
                            {p.medicationName} · {p.dosage}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
