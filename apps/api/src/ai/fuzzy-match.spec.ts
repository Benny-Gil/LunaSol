import { rankDoctorsFuzzy, scoreSpecializations, FuzzyDoctor } from './fuzzy-match'

function doc(specialization: string, name: string): FuzzyDoctor {
  return { id: `${specialization}-${name}`, name, specialization, bio: '', profilePictureUrl: null }
}

const DOCTORS: FuzzyDoctor[] = [
  doc('Neurology', 'Dr. Neuro'),
  doc('Dermatology', 'Dr. Derm'),
  doc('Orthopedics', 'Dr. Ortho'),
  doc('Rheumatology', 'Dr. Rheum'),
  doc('Cardiology', 'Dr. Cardio'),
  doc('General Medicine', 'Dr. Gen'),
  doc('Family Medicine', 'Dr. Fam'),
]

const idxOf = (ranked: { specialization: string }[], spec: string) =>
  ranked.findIndex(r => r.specialization === spec)

describe('rankDoctorsFuzzy', () => {
  it('returns every doctor (last-resort tier never drops candidates)', () => {
    const ranked = rankDoctorsFuzzy('headache', DOCTORS)
    expect(ranked).toHaveLength(DOCTORS.length)
  })

  it('ranks the discriminative-keyword specialty first', () => {
    const ranked = rankDoctorsFuzzy('I have a terrible migraine', DOCTORS)
    expect(ranked[0]?.specialization).toBe('Neurology')
    expect(ranked[0]?.reason).toMatch(/Closely matches/)
  })

  it('tolerates typos via Levenshtein (migrane → Neurology)', () => {
    const ranked = rankDoctorsFuzzy('bad migrane for days', DOCTORS)
    expect(ranked[0]?.specialization).toBe('Neurology')
  })

  it('ranks overlapping specialties above unrelated ones (joint pain → Ortho/Rheum)', () => {
    const ranked = rankDoctorsFuzzy('joint pain', DOCTORS)
    expect(idxOf(ranked, 'Orthopedics')).toBeLessThan(idxOf(ranked, 'Dermatology'))
    expect(idxOf(ranked, 'Rheumatology')).toBeLessThan(idxOf(ranked, 'Dermatology'))
    // "pain" is unique to Orthopedics, so it should edge out Rheumatology.
    expect(idxOf(ranked, 'Orthopedics')).toBeLessThan(idxOf(ranked, 'Rheumatology'))
  })

  it('down-weights generic/shared keywords vs specific ones', () => {
    const scores = scoreSpecializations('migraine')
    // "migraine" is unique to Neurology (high IDF weight); a single shared word
    // such as "fatigue" (Endocrinology + generalists) scores lower.
    expect(scores.get('neurology')!).toBeGreaterThan(scoreSpecializations('fatigue').get('endocrinology')!)
  })

  it('surfaces a generalist when nothing matches (safety floor)', () => {
    const ranked = rankDoctorsFuzzy('asdfgh qwerty zxcvbn', DOCTORS)
    expect(ranked[0]?.specialization).toMatch(/General Medicine|Family Medicine/)
    expect(ranked[0]?.reason).toMatch(/good first stop/)
  })

  it('breaks the generalist tie deterministically (Family before General)', () => {
    const ranked = rankDoctorsFuzzy('zzzz', DOCTORS)
    expect(idxOf(ranked, 'Family Medicine')).toBeLessThan(idxOf(ranked, 'General Medicine'))
  })

  it('honors negation (no headache → Neurology not boosted)', () => {
    const ranked = rankDoctorsFuzzy('no headache but a bad rash', DOCTORS)
    expect(idxOf(ranked, 'Dermatology')).toBeLessThan(idxOf(ranked, 'Neurology'))
    expect(scoreSpecializations('no headache but a bad rash').get('neurology')).toBe(0)
  })
})
