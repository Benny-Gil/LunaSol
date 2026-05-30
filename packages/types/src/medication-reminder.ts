/** A surfaced medication-reminder, derived from an active prescription. */
export interface MedicationReminder {
  id: string
  prescriptionId: string
  patientId: string
  /** Start of the dose-window this reminder represents (ISO string). */
  scheduledFor: string
  taken: boolean
  takenAt: string | null
  createdAt: string
  /** Denormalized prescription details for display. */
  prescription?: {
    id: string
    medicationName: string
    dosage: string
    frequency: string
    duration: string
    notes: string | null
  }
}
