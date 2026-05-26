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
