export type Role = 'PATIENT' | 'DOCTOR'

export interface User {
  id: string
  email: string
  role: Role
  createdAt: string
  updatedAt: string
}
