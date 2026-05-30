'use client'

import { useState, useEffect, useCallback, FormEvent } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Activity, Plus, Pencil, Trash2, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { SymptomLog, SymptomSeverity } from '@lunasol/types'
import { SEVERITY_ORDER, SEVERITY_STYLES, SeverityBadge, dateInputToISO, isoToDateInput, todayDateInput } from '@/lib/symptoms'

export default function SymptomsPage() {
  const { getToken } = useAuth()
  const [logs, setLogs] = useState<SymptomLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<SymptomSeverity>('MILD')
  const [loggedAt, setLoggedAt] = useState(() => todayDateInput())
  const [saving, setSaving] = useState(false)

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editSeverity, setEditSeverity] = useState<SymptomSeverity>('MILD')
  const [editLoggedAt, setEditLoggedAt] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      const data: SymptomLog[] = await apiFetch('/symptom-logs/mine', { token: token || undefined })
      setLogs(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load symptom logs.')
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!description.trim() || saving) return
    setSaving(true)
    try {
      const token = await getToken()
      await apiFetch('/symptom-logs', {
        token: token || undefined,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          severity,
          loggedAt: dateInputToISO(loggedAt),
        }),
      })
      setDescription('')
      setSeverity('MILD')
      setLoggedAt(todayDateInput())
      await load()
    } catch (err: any) {
      alert(err.message || 'Failed to save symptom.')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(log: SymptomLog) {
    setEditingId(log.id)
    setEditDescription(log.description)
    setEditSeverity(log.severity)
    setEditLoggedAt(isoToDateInput(log.loggedAt))
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault()
    if (!editingId || !editDescription.trim() || editSaving) return
    setEditSaving(true)
    try {
      const token = await getToken()
      await apiFetch(`/symptom-logs/${editingId}`, {
        token: token || undefined,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editDescription.trim(),
          severity: editSeverity,
          loggedAt: dateInputToISO(editLoggedAt),
        }),
      })
      setEditingId(null)
      await load()
    } catch (err: any) {
      alert(err.message || 'Failed to update symptom.')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this symptom entry?')) return
    try {
      const token = await getToken()
      await apiFetch(`/symptom-logs/${id}`, { token: token || undefined, method: 'DELETE' })
      await load()
    } catch (err: any) {
      alert(err.message || 'Failed to delete symptom.')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
    fontSize: '14px', color: '#111827', boxSizing: 'border-box', background: '#ffffff',
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f9fafb', minHeight: '100vh' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 40px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <a href="/dashboard/patient" style={{ fontSize: '18px', fontWeight: 700, color: '#111827', textDecoration: 'none' }}>LunaSol</a>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>Symptom Log</span>
      </nav>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.5px' }}>Symptom Log</h1>
          <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>Track how you feel over time. Doctors you have appointments with can review this.</p>
        </div>

        {/* Add form */}
        <form onSubmit={handleCreate} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px 24px', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} color="#059669" /> Log a symptom
          </h2>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>What are you experiencing?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your symptom in your own words…"
              style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1', minWidth: '140px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as SymptomSeverity)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{SEVERITY_STYLES[s].label}</option>)}
              </select>
            </div>
            <div style={{ flex: '1', minWidth: '140px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Date</label>
              <input type="date" value={loggedAt} max={todayDateInput()} onChange={(e) => setLoggedAt(e.target.value)} style={inputStyle} />
            </div>
            <button
              type="submit"
              disabled={!description.trim() || saving}
              style={{
                padding: '10px 20px', borderRadius: '8px', border: 'none',
                background: !description.trim() || saving ? '#9ca3af' : '#10b981',
                color: '#ffffff', fontSize: '14px', fontWeight: 700,
                cursor: !description.trim() || saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Add entry'}
            </button>
          </div>
        </form>

        {/* List */}
        {loading ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '60px' }}>Loading symptom log…</p>
        ) : error ? (
          <p style={{ color: '#b91c1c', textAlign: 'center', padding: '40px' }}>{error}</p>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Activity size={48} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>No symptoms logged yet</h2>
            <p style={{ color: '#6b7280' }}>Use the form above to start tracking how you feel.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {logs.map((log) => {
              const date = new Date(log.loggedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

              if (editingId === log.id) {
                return (
                  <form key={log.id} onSubmit={handleUpdate} style={{ background: '#ffffff', border: '1px solid #10b981', borderRadius: '12px', padding: '16px 20px' }}>
                    <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} style={{ ...inputStyle, minHeight: '64px', resize: 'vertical', marginBottom: '12px' }} />
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div style={{ flex: '1', minWidth: '120px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Severity</label>
                        <select value={editSeverity} onChange={(e) => setEditSeverity(e.target.value as SymptomSeverity)} style={{ ...inputStyle, cursor: 'pointer' }}>
                          {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{SEVERITY_STYLES[s].label}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: '1', minWidth: '120px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Date</label>
                        <input type="date" value={editLoggedAt} max={todayDateInput()} onChange={(e) => setEditLoggedAt(e.target.value)} style={inputStyle} />
                      </div>
                      <button type="submit" disabled={editSaving} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: editSaving ? '#9ca3af' : '#10b981', color: '#ffffff', fontSize: '14px', fontWeight: 700, cursor: editSaving ? 'not-allowed' : 'pointer' }}>{editSaving ? 'Saving…' : 'Save'}</button>
                      <button type="button" onClick={() => setEditingId(null)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#ffffff', color: '#6b7280', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><X size={14} /> Cancel</button>
                    </div>
                  </form>
                )
              }

              return (
                <div key={log.id} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <SeverityBadge severity={log.severity} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{date}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => startEdit(log)} title="Edit" style={{ padding: '6px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#ffffff', color: '#6b7280', cursor: 'pointer', display: 'flex' }}><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(log.id)} title="Delete" style={{ padding: '6px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#ffffff', color: '#dc2626', cursor: 'pointer', display: 'flex' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.6, margin: '10px 0 0', whiteSpace: 'pre-line' }}>{log.description}</p>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
