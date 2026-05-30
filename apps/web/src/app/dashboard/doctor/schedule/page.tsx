'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface Slot {
  id: string
  startTime: string
  endTime: string
  isBlocked: boolean
  appointment: { id: string; status: string } | null
}

const START_HOUR = 8
const END_HOUR = 18
const STEP_MIN = 30
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function startOfWeek(d: Date) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const day = (date.getDay() + 6) % 7 // Mon = 0
  date.setDate(date.getDate() - day)
  return date
}

function addDays(d: Date, n: number) {
  const date = new Date(d)
  date.setDate(date.getDate() + n)
  return date
}

// Half-hour offsets from START_HOUR, e.g. [480, 510, ... 1050]
const TIME_ROWS: number[] = []
for (let m = START_HOUR * 60; m < END_HOUR * 60; m += STEP_MIN) TIME_ROWS.push(m)

function cellStartFor(weekStart: Date, dayIndex: number, minutes: number) {
  const d = addDays(weekStart, dayIndex)
  d.setHours(0, minutes / 60, minutes % 60, 0)
  return d
}

function fmtTime(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const ampm = h < 12 ? 'AM' : 'PM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default function DoctorSchedulePage() {
  const { getToken } = useAuth()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [slots, setSlots] = useState<Slot[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      const data = await apiFetch('/doctors/me/availability', { token: token || undefined })
      setSlots(data)
    } catch {
      // fall through
    }
  }, [getToken])

  useEffect(() => { load() }, [load])

  async function mutate(fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      await load()
      setSelected(null)
    } catch (err: any) {
      alert(err.message || 'Action failed.')
    } finally {
      setBusy(false)
    }
  }

  async function createSlot(start: Date) {
    const end = new Date(start.getTime() + STEP_MIN * 60 * 1000)
    const token = await getToken()
    await mutate(() =>
      apiFetch('/doctors/me/availability', {
        token: token || undefined,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: start.toISOString(), endTime: end.toISOString() }),
      }),
    )
  }

  async function setBlocked(slot: Slot, blocked: boolean) {
    const token = await getToken()
    await mutate(() =>
      apiFetch(`/doctors/me/availability/${slot.id}/${blocked ? 'block' : 'unblock'}`, {
        token: token || undefined,
        method: 'PATCH',
      }),
    )
  }

  async function deleteSlot(slot: Slot) {
    const token = await getToken()
    await mutate(() =>
      apiFetch(`/doctors/me/availability/${slot.id}`, { token: token || undefined, method: 'DELETE' }),
    )
  }

  // Index slots by the half-hour cell they start in.
  const slotByCell = new Map<string, Slot>()
  for (const s of slots) {
    const st = new Date(s.startTime)
    const key = `${st.toDateString()}|${st.getHours() * 60 + st.getMinutes()}`
    slotByCell.set(key, s)
  }

  const now = new Date()
  const weekEnd = addDays(weekStart, 6)

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f9fafb', minHeight: '100vh' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 40px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/dashboard/doctor" style={{ fontSize: '18px', fontWeight: 700, color: '#111827', textDecoration: 'none' }}>LunaSol</a>
          <span style={{ color: '#d1d5db' }}>/</span>
          <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>Schedule</span>
        </div>
        <a href="/dashboard/doctor/appointments" style={{ padding: '8px 16px', background: '#10b981', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#ffffff', textDecoration: 'none' }}>
          Appointments
        </a>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>Availability</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week" style={navBtn}><ChevronLeft size={18} /></button>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151', minWidth: '180px', textAlign: 'center' }}>
              {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week" style={navBtn}><ChevronRight size={18} /></button>
          </div>
        </div>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px' }}>
          Click an empty cell to open a 30-minute slot. Click a slot to block or remove it. Booked slots are locked.
        </p>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', fontSize: '12px', color: '#6b7280' }}>
          <Legend color="#ecfdf5" border="#a7f3d0" label="Open" />
          <Legend color="#dbeafe" border="#93c5fd" label="Booked" />
          <Legend color="#fef2f2" border="#fca5a5" label="Blocked" />
        </div>

        <div style={{ overflowX: 'auto', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '720px' }}>
            <thead>
              <tr>
                <th style={{ ...headCell, width: '70px' }}></th>
                {DAY_LABELS.map((label, i) => {
                  const d = addDays(weekStart, i)
                  return (
                    <th key={label} style={headCell}>
                      <div>{label}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{d.getDate()}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {TIME_ROWS.map((minutes) => (
                <tr key={minutes}>
                  <td style={{ ...timeCell }}>{fmtTime(minutes)}</td>
                  {DAY_LABELS.map((_, dayIndex) => {
                    const cellStart = cellStartFor(weekStart, dayIndex, minutes)
                    const key = `${cellStart.toDateString()}|${minutes}`
                    const slot = slotByCell.get(key)
                    const isPast = cellStart < now
                    return (
                      <Cell
                        key={key}
                        slot={slot}
                        isPast={isPast}
                        busy={busy}
                        selected={!!slot && selected === slot.id}
                        onCreate={() => createSlot(cellStart)}
                        onSelect={() => slot && setSelected(selected === slot.id ? null : slot.id)}
                        onBlock={() => slot && setBlocked(slot, !slot.isBlocked)}
                        onDelete={() => slot && deleteSlot(slot)}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

function Cell({ slot, isPast, busy, selected, onCreate, onSelect, onBlock, onDelete }: {
  slot?: Slot
  isPast: boolean
  busy: boolean
  selected: boolean
  onCreate: () => void
  onSelect: () => void
  onBlock: () => void
  onDelete: () => void
}) {
  const base: React.CSSProperties = { border: '1px solid #f3f4f6', height: '40px', padding: '2px', textAlign: 'center', verticalAlign: 'middle' }

  if (!slot) {
    return (
      <td style={base}>
        {!isPast && (
          <button
            onClick={onCreate}
            disabled={busy}
            title="Open a slot"
            style={{ width: '100%', height: '100%', background: 'none', border: 'none', color: '#d1d5db', fontSize: '16px', cursor: 'pointer', borderRadius: '4px' }}
          >
            +
          </button>
        )}
      </td>
    )
  }

  if (slot.appointment) {
    return <td style={{ ...base, background: '#dbeafe', color: '#1e40af', fontSize: '11px', fontWeight: 600 }}>Booked</td>
  }

  const bg = slot.isBlocked ? '#fef2f2' : '#ecfdf5'
  const fg = slot.isBlocked ? '#991b1b' : '#166534'

  if (selected) {
    return (
      <td style={{ ...base, background: bg }}>
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
          <button onClick={onBlock} disabled={busy} style={miniBtn}>{slot.isBlocked ? 'Unblock' : 'Block'}</button>
          <button onClick={onDelete} disabled={busy} style={{ ...miniBtn, color: '#dc2626' }}>Delete</button>
        </div>
      </td>
    )
  }

  return (
    <td style={base}>
      <button
        onClick={onSelect}
        disabled={busy}
        style={{ width: '100%', height: '100%', background: bg, color: fg, border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
      >
        {slot.isBlocked ? 'Blocked' : 'Open'}
      </button>
    </td>
  )
}

function Legend({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: '14px', height: '14px', background: color, border: `1px solid ${border}`, borderRadius: '3px', display: 'inline-block' }} />
      {label}
    </span>
  )
}

const navBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', color: '#374151' }
const headCell: React.CSSProperties = { padding: '8px 4px', fontSize: '13px', fontWeight: 700, color: '#374151', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }
const timeCell: React.CSSProperties = { padding: '4px 8px', fontSize: '11px', color: '#6b7280', textAlign: 'right', whiteSpace: 'nowrap' }
const miniBtn: React.CSSProperties = { padding: '2px 6px', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '10px', fontWeight: 600, color: '#374151', cursor: 'pointer' }
