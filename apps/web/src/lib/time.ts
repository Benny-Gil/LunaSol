'use client'

import { useEffect, useState } from 'react'

/**
 * Format the time remaining until an appointment's absolute UTC start instant.
 *
 * Pure and timezone-agnostic: it compares two absolute instants (epoch ms), so
 * it stays consistent with browser-local `toLocaleTimeString` rendering — both
 * derive from the same underlying UTC instant.
 *
 * @param startTimeIso ISO 8601 timestamp of the appointment start.
 * @param now Epoch ms to compare against; defaults to `Date.now()`.
 * @returns A short human label, or `null` when there's nothing to show.
 *   - `null` when the start time is invalid or already past (more than a moment ago)
 *   - `"starting now"` when within the start instant (<= 0)
 *   - `"in 45m"` when under an hour away
 *   - `"in 2h 15m"` when under a day away
 *   - `"in 3d 4h"` when a day or more away
 */
export function formatTimeRemaining(startTimeIso: string, now?: number): string | null {
  const start = new Date(startTimeIso).getTime()
  if (Number.isNaN(start)) return null

  const diffMs = start - (now ?? Date.now())

  if (diffMs <= 0) {
    // Within a short grace window of the start, surface "starting now".
    // Past that, the appointment is effectively underway/over — hide it.
    return diffMs > -60_000 ? 'starting now' : null
  }

  const totalMinutes = Math.floor(diffMs / 60_000)
  const minutes = totalMinutes % 60
  const totalHours = Math.floor(totalMinutes / 60)
  const hours = totalHours % 24
  const days = Math.floor(totalHours / 24)

  if (days >= 1) return `in ${days}d ${hours}h`
  if (totalHours >= 1) return `in ${totalHours}h ${minutes}m`
  return `in ${totalMinutes}m`
}

/**
 * Returns a `Date.now()` value that ticks every `intervalMs` (default 1 minute),
 * so countdowns on a long-open page don't go stale. Cleans up on unmount.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
