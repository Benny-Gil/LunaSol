export interface DoctorProfile {
  id: string
  userId: string
  name: string
  bio?: string
  specialization: string
  profilePictureUrl?: string
  contactDetails?: string
  /** Whether the doctor is currently accepting instant (on-demand) consultations. */
  acceptingInstant?: boolean
}

export interface AvailabilitySlot {
  id: string
  doctorId: string
  startTime: string
  endTime: string
  isBlocked: boolean
}
