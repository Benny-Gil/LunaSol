import type { AvailabilitySlot } from './doctor'

export const AppointmentStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const

export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus]

export interface Appointment {
  id: string
  patientId: string
  doctorId: string
  /** Null for instant (on-demand) appointments, which have no pre-booked slot. */
  slotId?: string | null
  slot?: AvailabilitySlot | null
  isInstant: boolean
  status: AppointmentStatus
  livekitRoom?: string
  createdAt: string
  updatedAt: string
}

export interface ConsultationRecord {
  id: string
  appointmentId: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Prescription {
  id: string
  consultationRecordId: string
  medicationName: string
  dosage: string
  frequency: string
  duration: string
  notes?: string
  createdAt: string
}
