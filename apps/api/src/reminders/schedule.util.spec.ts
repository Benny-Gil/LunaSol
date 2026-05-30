import {
  parseDosesPerDay,
  parseDurationDays,
  parseSchedule,
  isActive,
  currentDoseWindowStart,
  DEFAULT_DOSES_PER_DAY,
  DEFAULT_DURATION_DAYS,
} from './schedule.util'

describe('parseDosesPerDay', () => {
  it.each([
    ['Once daily at bedtime', 1],
    ['once a day', 1],
    ['Twice daily', 2],
    ['twice a day', 2],
    ['Three times daily', 3],
    ['three times a day', 3],
    ['2 times a day', 2],
    ['3 times daily', 3],
    ['4x daily', 4],
    ['every 8 hours', 3],
    ['Every 6 hours', 4],
    ['every 12 hours', 2],
    ['daily', 1],
    ['per day', 1],
  ])('parses %p as %i doses/day', (input, expected) => {
    expect(parseDosesPerDay(input)).toBe(expected)
  })

  it('falls back to default for empty / unparseable input', () => {
    expect(parseDosesPerDay('')).toBe(DEFAULT_DOSES_PER_DAY)
    expect(parseDosesPerDay(null)).toBe(DEFAULT_DOSES_PER_DAY)
    expect(parseDosesPerDay('as needed')).toBe(DEFAULT_DOSES_PER_DAY)
  })

  it('clamps absurd cadences', () => {
    expect(parseDosesPerDay('every 1 hours')).toBe(24)
    expect(parseDosesPerDay('99 times a day')).toBe(24)
  })
})

describe('parseDurationDays', () => {
  it.each([
    ['14 days', 14],
    ['7 day', 7],
    ['1 week', 7],
    ['2 weeks', 14],
    ['1 month', 30],
    ['3 months', 90],
    ['90 days', 90],
  ])('parses %p as %i days', (input, expected) => {
    expect(parseDurationDays(input)).toBe(expected)
  })

  it('falls back to default for empty / unparseable input', () => {
    expect(parseDurationDays('')).toBe(DEFAULT_DURATION_DAYS)
    expect(parseDurationDays(null)).toBe(DEFAULT_DURATION_DAYS)
    expect(parseDurationDays('until symptoms resolve')).toBe(DEFAULT_DURATION_DAYS)
  })

  it('clamps to one year', () => {
    expect(parseDurationDays('100 weeks')).toBe(365)
  })
})

describe('parseSchedule', () => {
  it('combines both parsers', () => {
    expect(parseSchedule('twice daily', '10 days')).toEqual({ dosesPerDay: 2, durationDays: 10 })
  })
})

describe('isActive', () => {
  const created = new Date('2026-05-01T09:00:00Z')

  it('is active before the course elapses', () => {
    expect(isActive(created, 14, new Date('2026-05-10T09:00:00Z'))).toBe(true)
  })

  it('is inactive once the course elapses', () => {
    expect(isActive(created, 14, new Date('2026-05-20T09:00:00Z'))).toBe(false)
  })

  it('is active exactly within the window edge', () => {
    expect(isActive(created, 1, new Date('2026-05-01T23:00:00Z'))).toBe(true)
  })
})

describe('currentDoseWindowStart', () => {
  it('returns midnight for once-daily', () => {
    const now = new Date('2026-05-10T15:30:00')
    const start = currentDoseWindowStart(now, 1)
    expect(start.getHours()).toBe(0)
    expect(start.getDate()).toBe(now.getDate())
  })

  it('buckets into 12-hour windows for twice-daily', () => {
    const morning = currentDoseWindowStart(new Date('2026-05-10T08:00:00'), 2)
    const evening = currentDoseWindowStart(new Date('2026-05-10T20:00:00'), 2)
    expect(morning.getHours()).toBe(0)
    expect(evening.getHours()).toBe(12)
    expect(morning.getTime()).not.toBe(evening.getTime())
  })

  it('is stable within a window (dedup key)', () => {
    const a = currentDoseWindowStart(new Date('2026-05-10T08:00:00'), 3)
    const b = currentDoseWindowStart(new Date('2026-05-10T09:59:00'), 3)
    expect(a.getTime()).toBe(b.getTime())
  })
})
