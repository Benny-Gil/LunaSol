'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Cake, ClipboardList, Stethoscope } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface Prescription {
  id: string
  medicationName: string
  dosage: string
}

interface PriorAppointment {
  id: string
  status: string
  slot: { startTime: string } | null
  record: { notes: string | null; prescriptions: Prescription[] } | null
}

interface Patient {
  id: string
  birthday?: string | null
  medicalHistory?: string | null
}

// Compute whole-year age from a birthday in the viewer's local time.
function computeAge(birthday: string): number | null {
  const dob = new Date(birthday)
  if (isNaN(dob.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age >= 0 ? age : null
}

const CARD: React.CSSProperties = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '20px 22px',
  marginTop: '24px',
}

const LABEL: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: '0 0 8px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}

export default function PatientOverview({
  patient,
  currentAppointmentId,
}: {
  patient: Patient
  currentAppointmentId: string
}) {
  const { getToken } = useAuth()
  const [lastVisit, setLastVisit] = useState<PriorAppointment | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      const appts = (await apiFetch(`/appointments/mine?patientId=${patient.id}`, {
        token: token || undefined,
      })) as PriorAppointment[]
      const prior = appts
        .filter((a) => a.id !== currentAppointmentId && a.status === 'COMPLETED' && a.slot)
        .sort(
          (a, b) =>
            new Date(b.slot!.startTime).getTime() - new Date(a.slot!.startTime).getTime(),
        )
      setLastVisit(prior[0] ?? null)
    } catch {
      // Recap is best-effort; profile summary still renders.
    } finally {
      setLoaded(true)
    }
  }, [getToken, patient.id, currentAppointmentId])

  useEffect(() => {
    load()
  }, [load])

  const age = patient.birthday ? computeAge(patient.birthday) : null
  const history = patient.medicalHistory?.trim()

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          <div>
            <p style={LABEL}>
              <Cake size={15} color="#059669" /> Age
            </p>
            <p style={{ fontSize: '15px', color: '#111827', fontWeight: 600, margin: 0 }}>
              {age != null ? `${age} years` : 'Not provided'}
            </p>
          </div>
        </div>

        <div>
          <p style={LABEL}>
            <ClipboardList size={15} color="#059669" /> Medical history &amp; allergies
          </p>
          {history ? (
            <p
              style={{
                fontSize: '14px',
                color: '#4b5563',
                lineHeight: 1.6,
                margin: 0,
                whiteSpace: 'pre-line',
              }}
            >
              {history}
            </p>
          ) : (
            <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0, fontStyle: 'italic' }}>
              No medical history on file.
            </p>
          )}
        </div>

        <div>
          <p style={LABEL}>
            <Stethoscope size={15} color="#059669" /> Last visit
          </p>
          {!loaded ? (
            <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>Loading...</p>
          ) : !lastVisit ? (
            <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0, fontStyle: 'italic' }}>
              No prior completed consultations.
            </p>
          ) : (
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#374151', margin: '0 0 6px' }}>
                {lastVisit.slot
                  ? new Date(lastVisit.slot.startTime).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Instant consultation'}
              </p>
              {lastVisit.record?.notes ? (
                <p
                  style={{
                    fontSize: '14px',
                    color: '#4b5563',
                    lineHeight: 1.6,
                    margin: '0 0 8px',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {lastVisit.record.notes}
                </p>
              ) : (
                <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 8px', fontStyle: 'italic' }}>
                  No notes recorded.
                </p>
              )}
              {lastVisit.record && lastVisit.record.prescriptions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {lastVisit.record.prescriptions.map((p) => (
                    <span
                      key={p.id}
                      style={{
                        fontSize: '12px',
                        color: '#374151',
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        padding: '3px 8px',
                      }}
                    >
                      {p.medicationName} · {p.dosage}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
