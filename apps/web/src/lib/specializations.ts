// Canonical specialization list shared between the doctor profile form
// (what a doctor can pick) and the patient discovery filter (what patients
// can filter by). Keeping a single source of truth ensures a doctor's chosen
// specialization is always a value patients can actually filter on.
export const SPECIALIZATIONS = [
  'Cardiology',
  'Dermatology',
  'Family Medicine',
  'General Medicine',
  'Neurology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
] as const

export type Specialization = (typeof SPECIALIZATIONS)[number]
