/**
 * Best-effort parsing of a prescription's free-text `frequency` / `duration`
 * into a numeric schedule the reminder scheduler can reason about.
 *
 * This is intentionally NOT a full NLP parser — it recognizes the common
 * patterns clinicians actually type and falls back to safe defaults
 * otherwise. The riskiest logic in the feature, hence its own unit-tested file.
 */

/** Default doses/day when frequency is empty or unrecognized. */
export const DEFAULT_DOSES_PER_DAY = 1
/** Default course length (days) when duration is empty or unrecognized. */
export const DEFAULT_DURATION_DAYS = 7
/** Upper bounds to guard against runaway schedules from odd input. */
const MAX_DOSES_PER_DAY = 24
const MAX_DURATION_DAYS = 365

const WORD_NUMBERS: Record<string, number> = {
  once: 1,
  one: 1,
  twice: 2,
  two: 2,
  thrice: 3,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
}

/**
 * Extract a per-day dose count from a free-text frequency string.
 * Recognizes: "once/twice/three times daily", "N times a day/daily",
 * "every N hours", and bare "daily". Falls back to DEFAULT_DOSES_PER_DAY.
 */
export function parseDosesPerDay(frequency: string | null | undefined): number {
  if (!frequency) return DEFAULT_DOSES_PER_DAY
  const text = frequency.toLowerCase()

  // "every N hours" → 24 / N doses per day.
  const everyHours = text.match(/every\s+(\d+)\s*(?:hours|hrs|hr|h)\b/)
  if (everyHours) {
    const hours = parseInt(everyHours[1]!, 10)
    if (hours > 0) return clamp(Math.round(24 / hours), 1, MAX_DOSES_PER_DAY)
  }

  // "N times a day" / "N times daily" / "N times per day" (numeric).
  const numericTimes = text.match(/(\d+)\s*(?:x|times?)\s*(?:a|per|\/)?\s*day|\b(\d+)\s*(?:x|times?)\s*daily/)
  if (numericTimes) {
    const n = parseInt(numericTimes[1] ?? numericTimes[2] ?? '', 10)
    if (n > 0) return clamp(n, 1, MAX_DOSES_PER_DAY)
  }

  // "once/twice/three/... times daily" or "once/twice daily" (worded).
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    // "<word> times" or "<word> daily" / "<word> a day".
    const re = new RegExp(`\\b${word}\\b\\s*(?:times?\\b)?\\s*(?:a\\s+day|per\\s+day|daily)?`)
    if (re.test(text) && (text.includes('dai') || text.includes('day') || text.includes('time'))) {
      return clamp(n, 1, MAX_DOSES_PER_DAY)
    }
  }

  // Bare "daily" / "every day" / "per day" with no count → once a day.
  if (/\b(daily|every\s+day|per\s+day|a\s+day|qd|od)\b/.test(text)) {
    return 1
  }

  return DEFAULT_DOSES_PER_DAY
}

/**
 * Extract a course length in days from a free-text duration string.
 * Recognizes "N day(s)", "N week(s)", "N month(s)". Falls back to
 * DEFAULT_DURATION_DAYS.
 */
export function parseDurationDays(duration: string | null | undefined): number {
  if (!duration) return DEFAULT_DURATION_DAYS
  const text = duration.toLowerCase()

  const weeks = text.match(/(\d+)\s*(?:weeks?|wks?|wk)\b/)
  if (weeks) return clamp(parseInt(weeks[1]!, 10) * 7, 1, MAX_DURATION_DAYS)

  const months = text.match(/(\d+)\s*(?:months?|mos?|mo)\b/)
  if (months) return clamp(parseInt(months[1]!, 10) * 30, 1, MAX_DURATION_DAYS)

  const days = text.match(/(\d+)\s*(?:days?|d)\b/)
  if (days) return clamp(parseInt(days[1]!, 10), 1, MAX_DURATION_DAYS)

  return DEFAULT_DURATION_DAYS
}

export interface ParsedSchedule {
  dosesPerDay: number
  durationDays: number
}

export function parseSchedule(
  frequency: string | null | undefined,
  duration: string | null | undefined,
): ParsedSchedule {
  return {
    dosesPerDay: parseDosesPerDay(frequency),
    durationDays: parseDurationDays(duration),
  }
}

/**
 * Is the prescription still active at `now`? Active means the parsed course
 * length has not elapsed since it was created.
 */
export function isActive(createdAt: Date, durationDays: number, now: Date): boolean {
  const endMs = createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000
  return now.getTime() < endMs
}

/**
 * Compute the start of the current dose-window for a given doses/day cadence.
 * The day is divided into `dosesPerDay` equal windows starting at midnight
 * (local server time); we return the start instant of whichever window `now`
 * falls into. This is the dedup key — at most one reminder per window.
 */
export function currentDoseWindowStart(now: Date, dosesPerDay: number): Date {
  const doses = clamp(dosesPerDay, 1, MAX_DOSES_PER_DAY)
  const windowMs = (24 * 60 * 60 * 1000) / doses
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const elapsed = now.getTime() - startOfDay.getTime()
  const windowIndex = Math.floor(elapsed / windowMs)
  return new Date(startOfDay.getTime() + windowIndex * windowMs)
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min
  return Math.min(Math.max(n, min), max)
}
