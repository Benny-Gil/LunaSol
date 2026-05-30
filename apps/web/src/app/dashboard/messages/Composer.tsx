'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Paperclip, Send, X, Pill, FileText, CalendarClock, Sparkles, Activity } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import type {
  ConversationCounterpart,
  SendMessageDto,
  MessageAttachmentType,
  MessageAttachmentData,
  AiSuggestionAttachment,
  SymptomSeverity,
} from '@lunasol/types'

/** sessionStorage key the AI matcher writes so a patient can share a triage result. */
export const AI_SHARE_KEY = 'lunasol.aiSuggestion'

type Staged = { type: MessageAttachmentType; data: MessageAttachmentData; refId?: string }

interface ApptLite {
  id: string
  status: string
  isInstant?: boolean
  slot: { startTime: string } | null
  doctor?: { id: string }
  patient?: { id: string }
}

export default function Composer({
  viewerRole,
  counterpart,
  onSend,
  disabled,
}: {
  viewerRole: 'patient' | 'doctor'
  counterpart: ConversationCounterpart
  onSend: (dto: SendMessageDto) => Promise<unknown> | void
  disabled?: boolean
}) {
  const [text, setText] = useState('')
  const [staged, setStaged] = useState<Staged | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<null | 'appointment' | 'record' | 'symptom'>(null)
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if ((!text.trim() && !staged) || sending) return
    setSending(true)
    try {
      await onSend({
        body: text.trim() || undefined,
        attachmentType: staged?.type,
        attachment: staged?.data,
        refId: staged?.refId,
      })
      setText('')
      setStaged(null)
    } catch (err: any) {
      alert(err.message || 'Failed to send message.')
    } finally {
      setSending(false)
    }
  }

  function shareAiSuggestion() {
    setMenuOpen(false)
    try {
      const raw = sessionStorage.getItem(AI_SHARE_KEY)
      if (!raw) {
        alert('No AI suggestion to share yet. Run the symptom matcher on "Find a doctor" first.')
        return
      }
      const data = JSON.parse(raw) as AiSuggestionAttachment
      setStaged({ type: 'AI_SUGGESTION', data })
    } catch {
      alert('Could not read the AI suggestion.')
    }
  }

  const attachOptions =
    viewerRole === 'doctor'
      ? [
          { key: 'appointment', label: 'Appointment', icon: <CalendarClock size={15} />, onClick: () => { setMenuOpen(false); setModal('appointment') } },
          { key: 'record', label: 'Prescription / Note', icon: <Pill size={15} />, onClick: () => { setMenuOpen(false); setModal('record') } },
        ]
      : [
          { key: 'appointment', label: 'Appointment', icon: <CalendarClock size={15} />, onClick: () => { setMenuOpen(false); setModal('appointment') } },
          { key: 'symptom', label: 'Symptom', icon: <Activity size={15} />, onClick: () => { setMenuOpen(false); setModal('symptom') } },
          { key: 'ai', label: 'AI suggestion', icon: <Sparkles size={15} />, onClick: shareAiSuggestion },
        ]

  return (
    <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px 16px', background: '#ffffff', position: 'relative' }}>
      {staged && <StagedChip staged={staged} onRemove={() => setStaged(null)} />}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={disabled}
            aria-label="Attach"
            style={iconButtonStyle}
          >
            <Paperclip size={18} />
          </button>
          {menuOpen && (
            <div style={menuStyle}>
              {attachOptions.map((o) => (
                <button key={o.key} type="button" onClick={o.onClick} style={menuItemStyle}>
                  {o.icon} {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Ignore Enter while an IME composition is active, otherwise it
            // sends a half-composed message (CJK and other IME input).
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder={`Message ${counterpart.name}…`}
          rows={1}
          disabled={disabled}
          style={{ flex: 1, resize: 'none', maxHeight: '120px', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '20px', fontSize: '14px', fontFamily: 'inherit', color: '#111827', lineHeight: 1.4, boxSizing: 'border-box' }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || sending || (!text.trim() && !staged)}
          aria-label="Send"
          style={{ ...iconButtonStyle, background: '#10b981', color: '#ffffff', border: 'none', opacity: disabled || (!text.trim() && !staged) ? 0.5 : 1 }}
        >
          <Send size={18} />
        </button>
      </div>

      {modal === 'symptom' && (
        <SymptomModal onClose={() => setModal(null)} onStage={(data) => { setStaged({ type: 'SYMPTOM', data }); setModal(null) }} />
      )}
      {modal === 'appointment' && (
        <AppointmentModal
          viewerRole={viewerRole}
          counterpart={counterpart}
          onClose={() => setModal(null)}
          onStage={(staged) => { setStaged(staged); setModal(null) }}
        />
      )}
      {modal === 'record' && (
        <RecordModal
          counterpart={counterpart}
          onClose={() => setModal(null)}
          onStage={(staged) => { setStaged(staged); setModal(null) }}
        />
      )}
    </div>
  )
}

// ── Staged attachment chip ──────────────────────────────────────────────────────

function StagedChip({ staged, onRemove }: { staged: Staged; onRemove: () => void }) {
  const label: Record<MessageAttachmentType, string> = {
    PRESCRIPTION: 'Prescription',
    NOTE: 'Consultation note',
    APPOINTMENT: 'Appointment',
    AI_SUGGESTION: 'AI suggestion',
    SYMPTOM: 'Symptom report',
  }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', marginBottom: '10px' }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: '#065f46' }}>Attached: {label[staged.type]}</span>
      <button type="button" onClick={onRemove} aria-label="Remove attachment" style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', padding: 0 }}>
        <X size={14} />
      </button>
    </div>
  )
}

// ── Symptom mini-form ───────────────────────────────────────────────────────────

function SymptomModal({ onClose, onStage }: { onClose: () => void; onStage: (d: { description: string; severity: SymptomSeverity; onset?: string }) => void }) {
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<SymptomSeverity>('MODERATE')
  const [onset, setOnset] = useState('')
  return (
    <ModalShell title="Report a symptom" onClose={onClose}>
      <label style={fieldLabel}>Description</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="e.g. Persistent dry cough and mild fever" style={inputStyle} />
      <label style={fieldLabel}>Severity</label>
      <select value={severity} onChange={(e) => setSeverity(e.target.value as SymptomSeverity)} style={inputStyle}>
        <option value="MILD">Mild</option>
        <option value="MODERATE">Moderate</option>
        <option value="SEVERE">Severe</option>
      </select>
      <label style={fieldLabel}>Onset (optional)</label>
      <input value={onset} onChange={(e) => setOnset(e.target.value)} placeholder="e.g. 3 days ago" style={inputStyle} />
      <ModalActions
        confirmLabel="Attach"
        disabled={!description.trim()}
        onCancel={onClose}
        onConfirm={() => onStage({ description: description.trim(), severity, onset: onset.trim() || undefined })}
      />
    </ModalShell>
  )
}

// ── Appointment picker ──────────────────────────────────────────────────────────

function useCounterpartAppointments(viewerRole: 'patient' | 'doctor', counterpart: ConversationCounterpart) {
  const { getToken } = useAuth()
  const [appts, setAppts] = useState<ApptLite[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        const query = viewerRole === 'doctor' ? `?patientId=${counterpart.id}` : ''
        const list: ApptLite[] = await apiFetch(`/appointments/mine${query}`, { token: token || undefined })
        const filtered =
          viewerRole === 'doctor' ? list : list.filter((a) => a.doctor?.id === counterpart.id)
        if (!cancelled) setAppts(filtered)
      } catch {
        if (!cancelled) setAppts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [getToken, viewerRole, counterpart.id])
  return { appts, loading }
}

function apptLabel(a: ApptLite) {
  if (a.isInstant || !a.slot) return 'Instant consultation'
  return new Date(a.slot.startTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function AppointmentModal({
  viewerRole,
  counterpart,
  onClose,
  onStage,
}: {
  viewerRole: 'patient' | 'doctor'
  counterpart: ConversationCounterpart
  onClose: () => void
  onStage: (s: Staged) => void
}) {
  const { appts, loading } = useCounterpartAppointments(viewerRole, counterpart)
  return (
    <ModalShell title="Share an appointment" onClose={onClose}>
      {loading ? (
        <p style={emptyStyle}>Loading…</p>
      ) : appts.length === 0 ? (
        <p style={emptyStyle}>No shared appointments.</p>
      ) : (
        <div style={listStyle}>
          {appts.map((a) => (
            <button
              key={a.id}
              type="button"
              style={listItemStyle}
              onClick={() =>
                onStage({
                  type: 'APPOINTMENT',
                  refId: a.id,
                  data: { appointmentId: a.id, status: a.status, isInstant: a.isInstant ?? !a.slot, startTime: a.slot?.startTime ?? null },
                })
              }
            >
              <span style={{ fontWeight: 600, color: '#111827', fontSize: '13px' }}>{apptLabel(a)}</span>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{a.status}</span>
            </button>
          ))}
        </div>
      )}
    </ModalShell>
  )
}

// ── Prescription / Note picker (doctor) ─────────────────────────────────────────

function RecordModal({
  counterpart,
  onClose,
  onStage,
}: {
  counterpart: ConversationCounterpart
  onClose: () => void
  onStage: (s: Staged) => void
}) {
  const { getToken } = useAuth()
  const { appts, loading } = useCounterpartAppointments('doctor', counterpart)
  const [selected, setSelected] = useState<ApptLite | null>(null)
  const [record, setRecord] = useState<{ notes: string | null; prescriptions: { id: string; medicationName: string; dosage: string; frequency: string; duration: string; notes: string | null }[] } | null>(null)
  const [loadingRecord, setLoadingRecord] = useState(false)

  const loadRecord = useCallback(async (appt: ApptLite) => {
    setSelected(appt)
    setLoadingRecord(true)
    try {
      const token = await getToken()
      setRecord(await apiFetch(`/appointments/${appt.id}/record`, { token: token || undefined }))
    } catch {
      setRecord(null)
    } finally {
      setLoadingRecord(false)
    }
  }, [getToken])

  return (
    <ModalShell title={selected ? 'Share a prescription or note' : 'Pick an appointment'} onClose={onClose}>
      {!selected ? (
        loading ? (
          <p style={emptyStyle}>Loading…</p>
        ) : appts.length === 0 ? (
          <p style={emptyStyle}>No appointments with this patient.</p>
        ) : (
          <div style={listStyle}>
            {appts.map((a) => (
              <button key={a.id} type="button" style={listItemStyle} onClick={() => loadRecord(a)}>
                <span style={{ fontWeight: 600, color: '#111827', fontSize: '13px' }}>{apptLabel(a)}</span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{a.status}</span>
              </button>
            ))}
          </div>
        )
      ) : loadingRecord ? (
        <p style={emptyStyle}>Loading record…</p>
      ) : (
        <div style={listStyle}>
          {record?.notes && (
            <button
              type="button"
              style={listItemStyle}
              onClick={() => onStage({ type: 'NOTE', refId: selected.id, data: { notes: record.notes as string, date: selected.slot?.startTime ?? null } })}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#111827', fontSize: '13px' }}><FileText size={14} /> Consultation note</span>
              <span style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{record.notes}</span>
            </button>
          )}
          {record?.prescriptions?.map((p) => (
            <button
              key={p.id}
              type="button"
              style={listItemStyle}
              onClick={() => onStage({ type: 'PRESCRIPTION', data: { medicationName: p.medicationName, dosage: p.dosage, frequency: p.frequency, duration: p.duration, notes: p.notes } })}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#111827', fontSize: '13px' }}><Pill size={14} /> {p.medicationName}</span>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{p.dosage} · {p.frequency}</span>
            </button>
          ))}
          {!record?.notes && !record?.prescriptions?.length && <p style={emptyStyle}>This appointment has no note or prescriptions yet.</p>}
          <button type="button" onClick={() => { setSelected(null); setRecord(null) }} style={{ ...listItemStyle, justifyContent: 'center', color: '#6b7280', fontWeight: 600 }}>← Back to appointments</button>
        </div>
      )}
    </ModalShell>
  )
}

// ── Shared modal primitives ─────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 0 }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalActions({ confirmLabel, disabled, onConfirm, onCancel }: { confirmLabel: string; disabled?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
      <button type="button" onClick={onCancel} style={{ padding: '8px 16px', background: 'none', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}>Cancel</button>
      <button type="button" onClick={onConfirm} disabled={disabled} style={{ padding: '8px 16px', background: '#10b981', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', opacity: disabled ? 0.5 : 1 }}>{confirmLabel}</button>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const iconButtonStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', background: '#ffffff', border: '1px solid #e5e7eb', color: '#374151', cursor: 'pointer', flexShrink: 0 }
const menuStyle: React.CSSProperties = { position: 'absolute', bottom: '48px', left: 0, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px', zIndex: 20, minWidth: '190px' }
const menuItemStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'none', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: '#374151', cursor: 'pointer', textAlign: 'left', width: '100%' }
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(17,24,39,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }
const dialogStyle: React.CSSProperties = { background: '#ffffff', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '420px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', margin: '12px 0 4px' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box' }
const listStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '6px' }
const listItemStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', width: '100%' }
const emptyStyle: React.CSSProperties = { fontSize: '13px', color: '#6b7280', textAlign: 'center', padding: '20px 0', margin: 0 }
