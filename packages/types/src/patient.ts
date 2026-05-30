export interface PatientProfile {
  id: string
  userId: string
  name: string
  birthday: string
  weight: number
  height: number
  profilePictureUrl?: string
  phone?: string
  address?: string
  medicalHistory?: string
}

/**
 * Time-series snapshot of a patient's weight/height, captured whenever the
 * patient updates those values on their profile. Powers the health dashboard.
 */
export interface PatientMetric {
  id: string
  patientId: string
  weight: number
  height: number
  recordedAt: string
}
