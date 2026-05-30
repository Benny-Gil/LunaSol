'use client'

import Link from 'next/link'
import { Pill, FileText, CalendarClock, Sparkles, Activity, ExternalLink, Zap } from 'lucide-react'
import type {
  MessageAttachmentType,
  MessageAttachmentData,
  PrescriptionAttachment,
  NoteAttachment,
  AppointmentAttachment,
  AiSuggestionAttachment,
  SymptomAttachment,
} from '@lunasol/types'

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  MILD: { bg: '#f0fdf4', text: '#166534' },
  MODERATE: { bg: '#fef9c3', text: '#854d0e' },
  SEVERE: { bg: '#fef2f2', text: '#991b1b' },
}

/** Renders a shared entity snapshot as a compact card inside a chat bubble. */
export default function AttachmentCard({
  type,
  data,
  viewerRole,
}: {
  type: MessageAttachmentType
  data: MessageAttachmentData
  viewerRole: 'patient' | 'doctor'
}) {
  switch (type) {
    case 'PRESCRIPTION': {
      const p = data as PrescriptionAttachment
      return (
        <Shell icon={<Pill size={15} />} label="Prescription" accent="#7c3aed">
          <p style={titleStyle}>{p.medicationName}</p>
          <p style={metaStyle}>
            {[p.dosage, p.frequency, p.duration].filter(Boolean).join(' · ')}
          </p>
          {p.notes && <p style={noteStyle}>{p.notes}</p>}
        </Shell>
      )
    }
    case 'NOTE': {
      const n = data as NoteAttachment
      return (
        <Shell icon={<FileText size={15} />} label="Consultation note" accent="#0891b2">
          {n.date && <p style={metaStyle}>{new Date(n.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
          <p style={{ ...bodyStyle, whiteSpace: 'pre-wrap' }}>{n.notes}</p>
        </Shell>
      )
    }
    case 'APPOINTMENT': {
      const a = data as AppointmentAttachment
      return (
        <Shell icon={<CalendarClock size={15} />} label="Appointment" accent="#059669">
          <p style={titleStyle}>
            {a.isInstant || !a.startTime
              ? (<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Zap size={13} /> Instant consultation</span>)
              : new Date(a.startTime).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </p>
          <p style={metaStyle}>Status: {a.status}</p>
          <Link href={`/dashboard/${viewerRole}/appointments/${a.appointmentId}`} style={linkStyle}>
            Open appointment <ExternalLink size={12} />
          </Link>
        </Shell>
      )
    }
    case 'AI_SUGGESTION': {
      const s = data as AiSuggestionAttachment
      const recommendations = Array.isArray(s.recommendations) ? s.recommendations : []
      return (
        <Shell icon={<Sparkles size={15} />} label="AI triage suggestion" accent="#2563eb">
          <p style={metaStyle}>Symptoms described</p>
          <p style={bodyStyle}>{s.symptoms}</p>
          {recommendations.length > 0 && (
            <>
              <p style={{ ...metaStyle, marginTop: '8px' }}>Suggested specialists</p>
              <ul style={{ margin: '4px 0 0', paddingLeft: '16px' }}>
                {recommendations.map((r, i) => (
                  <li key={i} style={bodyStyle}>
                    <strong>{r.name}</strong> — {r.specialization}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Shell>
      )
    }
    case 'SYMPTOM': {
      const s = data as SymptomAttachment
      const sev = SEVERITY_COLORS[s.severity] ?? { bg: '#fef9c3', text: '#854d0e' }
      return (
        <Shell icon={<Activity size={15} />} label="Symptom report" accent="#dc2626">
          <p style={bodyStyle}>{s.description}</p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: sev.bg, color: sev.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {s.severity}
            </span>
            {s.onset && <span style={metaStyle}>Onset: {s.onset}</span>}
          </div>
        </Shell>
      )
    }
    default:
      return null
  }
}

function Shell({ icon, label, accent, children }: { icon: React.ReactNode; label: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 14px', maxWidth: '320px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: accent, marginBottom: '6px' }}>
        {icon}
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      {children}
    </div>
  )
}

const titleStyle: React.CSSProperties = { fontSize: '14px', fontWeight: 700, color: '#111827', margin: '0 0 2px' }
const bodyStyle: React.CSSProperties = { fontSize: '13px', color: '#374151', margin: 0, lineHeight: 1.5 }
const metaStyle: React.CSSProperties = { fontSize: '12px', color: '#6b7280', margin: 0 }
const noteStyle: React.CSSProperties = { fontSize: '12px', color: '#9ca3af', fontStyle: 'italic', margin: '4px 0 0' }
const linkStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#059669', textDecoration: 'none', marginTop: '8px' }
