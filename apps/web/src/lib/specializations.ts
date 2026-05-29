// Canonical specialization list shared between the doctor profile form
// (what a doctor can pick) and the patient discovery filter (what patients
// can filter by). Keeping a single source of truth ensures a doctor's chosen
// specialization is always a value patients can actually filter on.
//
// Names are kept in sync with SPECIALIZATION_KEYWORDS in
// apps/api/src/ai/ai.controller.ts (the offline symptom→specialty matcher),
// keyed by the lowercased string below.
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
