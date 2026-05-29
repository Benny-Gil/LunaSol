'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Plus, FileText } from 'lucide-react'
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

const EMPTY_RX = { medicationName: '', dosage: '', frequency: '', duration: '', notes: '' }

export default function ConsultationPanel({ appointmentId }: { appointmentId: string }) {
  const { getToken } = useAuth()
  const [record, setRecord] = useState<ConsultationRecord | null>(null)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [rx, setRx] = useState({ ...EMPTY_RX })
  const [addingRx, setAddingRx] = useState(false)
  const [showRxForm, setShowRxForm] = useState(false)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      const data = await apiFetch(`/appointments/${appointmentId}/record`, { token: token || undefined })
      setRecord(data)
      setNotes(data?.notes ?? '')
    } catch {
      // no record yet
    }
  }, [getToken, appointmentId])

  useEffect(() => { load() }, [load])

  async function saveNotes() {
    setSavingNotes(true)
    try {
      const token = await getToken()
      await apiFetch(`/appointments/${appointmentId}/record`, {
        token: token || undefined,
        method: record ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      await load()
    } catch (err: any) {
      alert(err.message || 'Failed to save notes.')
    } finally {
      setSavingNotes(false)
    }
  }

  async function addPrescription() {
    if (!rx.medicationName.trim()) {
      alert('Medication name is required.')
      return
    }
    setAddingRx(true)
    try {
      const token = await getToken()
      await apiFetch(`/appointments/${appointmentId}/record/prescriptions`, {
        token: token || undefined,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rx),
      })
      setRx({ ...EMPTY_RX })
      setShowRxForm(false)
      await load()
    } catch (err: any) {
      alert(err.message || 'Failed to add prescription.')
    } finally {
      setAddingRx(false)
    }
  }

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '28px', marginTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <FileText size={20} color="#059669" />
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>Consultation notes</h2>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Summary, observations, recommendations..."
        rows={5}
        style={{ width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', color: '#111827', resize: 'vertical', boxSizing: 'border-box' }}
      />
      <button
        onClick={saveNotes}
        disabled={savingNotes}
        style={{ marginTop: '12px', padding: '10px 20px', background: '#10b981', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#ffffff', cursor: 'pointer' }}
      >
        {savingNotes ? 'Saving...' : 'Save notes'}
      </button>

      <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Prescriptions {record?.prescriptions.length ? `(${record.prescriptions.length})` : ''}
          </h3>
          {!showRxForm && (
            <button
              onClick={() => setShowRxForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'none', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
            >
              <Plus size={14} /> Add
            </button>
          )}
        </div>

        {record && record.prescriptions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: showRxForm ? '20px' : 0 }}>
            {record.prescriptions.map((p) => (
              <div key={p.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px 16px' }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>{p.medicationName}</p>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{p.dosage} · {p.frequency} · {p.duration}</p>
                {p.notes && <p style={{ fontSize: '13px', color: '#9ca3af', margin: '4px 0 0', fontStyle: 'italic' }}>{p.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {showRxForm && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <Field label="Medication" value={rx.medicationName} onChange={(v) => setRx({ ...rx, medicationName: v })} />
              <Field label="Dosage" value={rx.dosage} onChange={(v) => setRx({ ...rx, dosage: v })} />
              <Field label="Frequency" value={rx.frequency} onChange={(v) => setRx({ ...rx, frequency: v })} />
              <Field label="Duration" value={rx.duration} onChange={(v) => setRx({ ...rx, duration: v })} />
            </div>
            <Field label="Notes (optional)" value={rx.notes} onChange={(v) => setRx({ ...rx, notes: v })} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={addPrescription}
                disabled={addingRx}
                style={{ padding: '8px 16px', background: '#10b981', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#ffffff', cursor: 'pointer' }}
              >
                {addingRx ? 'Adding...' : 'Add prescription'}
              </button>
              <button
                onClick={() => { setShowRxForm(false); setRx({ ...EMPTY_RX }) }}
                style={{ padding: '8px 16px', background: 'none', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!record?.prescriptions.length && !showRxForm && (
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>No prescriptions added.</p>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', color: '#111827', boxSizing: 'border-box' }}
      />
    </label>
  )
}
