import { SymptomSeverity } from '@lunasol/types'

/** Severity values in display order (mild → severe). */
export const SEVERITY_ORDER: SymptomSeverity[] = ['MILD', 'MODERATE', 'SEVERE']

/** Badge colors + human label per severity. Single source of truth for the UI. */
export const SEVERITY_STYLES: Record<SymptomSeverity, { bg: string; color: string; label: string }> = {
  MILD: { bg: '#f0fdf4', color: '#15803d', label: 'Mild' },
  MODERATE: { bg: '#fffbeb', color: '#b45309', label: 'Moderate' },
  SEVERE: { bg: '#fef2f2', color: '#b91c1c', label: 'Severe' },
}

export function SeverityBadge({ severity }: { severity: SymptomSeverity }) {
  const s = SEVERITY_STYLES[severity]
  return (
    <span style={{ fontSize: '12px', fontWeight: 700, color: s.color, background: s.bg, padding: '3px 10px', borderRadius: '12px' }}>
      {s.label}
    </span>
  )
}

// ─── Date helpers ───────────────────────────────────────────────────────────
// `loggedAt` is a calendar day chosen in an <input type="date">. We round-trip
// it through *local* midnight so the day the user picked is the day stored and
// displayed — `new Date('YYYY-MM-DD')` parses as UTC midnight, which would shift
// the date back a day for any timezone west of UTC.

/** ISO string for the local-midnight instant of a "YYYY-MM-DD" date input. */
export function dateInputToISO(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toISOString()
}

/** "YYYY-MM-DD" (local) for an ISO timestamp, for use as an <input type="date"> value. */
export function isoToDateInput(iso: string): string {
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - off).toISOString().slice(0, 10)
}

/** Today's date as "YYYY-MM-DD" in local time. */
export function todayDateInput(): string {
  return isoToDateInput(new Date().toISOString())
}
