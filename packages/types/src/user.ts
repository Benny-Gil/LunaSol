export const Role = {
  PATIENT: 'PATIENT',
  DOCTOR: 'DOCTOR',
} as const

export type Role = (typeof Role)[keyof typeof Role]

export interface User {
  id: string
  clerkId: string
  email: string
  role: Role
  createdAt: string
  updatedAt: string
}
