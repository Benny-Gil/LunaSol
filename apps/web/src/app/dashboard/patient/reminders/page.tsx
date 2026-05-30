'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Pill, Check, BellRing } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface MedicationReminder {
  id: string
  scheduledFor: string
  taken: boolean
  takenAt: string | null
  prescription: {
    id: string
    medicationName: string
    dosage: string
    frequency: string
    duration: string
    notes: string | null
  } | null
}

export default function RemindersPage() {
  const { getToken } = useAuth()
  const [reminders, setReminders] = useState<MedicationReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const data: MedicationReminder[] = await apiFetch('/reminders/mine', { token: token || undefined })
        setReminders(data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken])

  async function markTaken(id: string) {
    setMarking(id)
    try {
      const token = await getToken()
      await apiFetch(`/reminders/${id}/taken`, { method: 'PATCH', token: token || undefined })
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, taken: true, takenAt: new Date().toISOString() } : r)),
      )
    } finally {
      setMarking(null)
    }
  }

  const pending = reminders.filter((r) => !r.taken)
  const done = reminders.filter((r) => r.taken)

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f9fafb', minHeight: '100vh' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 40px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <a href="/dashboard/patient" style={{ fontSize: '18px', fontWeight: 700, color: '#111827', textDecoration: 'none' }}>LunaSol</a>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>Medication Reminders</span>
      </nav>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.5px' }}>Medication Reminders</h1>
          <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>Stay on track with your active prescriptions. Mark each dose as taken.</p>
        </div>

        {loading ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '60px' }}>Loading reminders...</p>
        ) : reminders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <BellRing size={48} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>No reminders yet</h2>
            <p style={{ color: '#6b7280' }}>Reminders appear here automatically while you have active prescriptions.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {pending.length > 0 && (
              <section>
                <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>
                  Due ({pending.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {pending.map((r) => (
                    <ReminderCard key={r.id} reminder={r} marking={marking === r.id} onTaken={() => markTaken(r.id)} />
                  ))}
                </div>
              </section>
            )}

            {done.length > 0 && (
              <section>
                <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>
                  Taken ({done.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {done.map((r) => (
                    <ReminderCard key={r.id} reminder={r} marking={false} onTaken={() => {}} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function ReminderCard({
  reminder,
  marking,
  onTaken,
}: {
  reminder: MedicationReminder
  marking: boolean
  onTaken: () => void
}) {
  const rx = reminder.prescription
  const when = new Date(reminder.scheduledFor).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', opacity: reminder.taken ? 0.6 : 1 }}>
      <div style={{ display: 'inline-flex', padding: '10px', background: reminder.taken ? '#f0fdf4' : '#eff6ff', borderRadius: '10px', color: reminder.taken ? '#16a34a' : '#2563eb' }}>
        <Pill size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
          {rx ? rx.medicationName : 'Medication'}
        </p>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
          {rx ? `${rx.dosage} · ${rx.frequency}` : ''}
          {rx ? ' · ' : ''}Due {when}
        </p>
      </div>
      {reminder.taken ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#16a34a' }}>
          <Check size={16} /> Taken
        </span>
      ) : (
        <button
          onClick={onTaken}
          disabled={marking}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#111827', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: marking ? 'default' : 'pointer', opacity: marking ? 0.6 : 1 }}
        >
          <Check size={16} /> {marking ? 'Saving...' : 'Mark as taken'}
        </button>
      )}
    </div>
  )
}
