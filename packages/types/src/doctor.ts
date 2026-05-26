export interface DoctorProfile {
  id: string
  userId: string
  name: string
  bio?: string
  specialization: string
  profilePictureUrl?: string
  contactDetails?: string
}

export interface AvailabilitySlot {
  id: string
  doctorId: string
  startTime: string
  endTime: string
  isBlocked: boolean
}
