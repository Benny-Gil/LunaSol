// Canonical specialization list — the single source of truth shared by the
// web app (doctor profile selector + patient discovery filter) and the api
// (offline symptom→specialty keyword matcher). Both packages import from here
// so the list can never drift between front and back end.
export const SPECIALIZATIONS = [
  'Allergy & Immunology',
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Family Medicine',
  'Gastroenterology',
  'General Medicine',
  'Neurology',
  'Obstetrics & Gynecology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Otolaryngology (ENT)',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Rheumatology',
  'Urology',
] as const

export type Specialization = (typeof SPECIALIZATIONS)[number]
