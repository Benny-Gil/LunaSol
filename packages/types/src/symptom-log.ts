import type { SymptomSeverity } from './chat'

export interface SymptomLog {
  id: string
  patientId: string
  description: string
  severity: SymptomSeverity
  loggedAt: string
  createdAt: string
  updatedAt: string
}
