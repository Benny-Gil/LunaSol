// Out-of-call patient↔doctor chat. One continuous conversation per pair.

export type MessageAttachmentType = 'PRESCRIPTION' | 'NOTE' | 'APPOINTMENT' | 'AI_SUGGESTION' | 'SYMPTOM'

export type SymptomSeverity = 'MILD' | 'MODERATE' | 'SEVERE'

// ── Attachment snapshots ──────────────────────────────────────────────────────
// Captured at send-time and stored denormalized, so a shared card renders the
// same forever and never live-joins another module's tables.

export interface PrescriptionAttachment {
  medicationName: string
  dosage: string
  frequency: string
  duration: string
  notes?: string | null
}

export interface NoteAttachment {
  notes: string
  /** ISO date of the consultation the note came from, for display. */
  date?: string | null
}

export interface AppointmentAttachment {
  appointmentId: string
  status: string
  isInstant: boolean
  /** ISO start time; null for instant/slotless appointments. */
  startTime?: string | null
}

export interface AiSuggestionAttachment {
  /** The symptoms the patient described to the AI matcher. */
  symptoms: string
  reasoning?: string | null
  recommendations: { name: string; specialization: string; reason?: string | null }[]
}

export interface SymptomAttachment {
  description: string
  severity: SymptomSeverity
  /** Free text, e.g. "3 days ago". */
  onset?: string | null
}

export type MessageAttachmentData =
  | PrescriptionAttachment
  | NoteAttachment
  | AppointmentAttachment
  | AiSuggestionAttachment
  | SymptomAttachment

// ── Wire shapes ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  conversationId: string
  /** User.id of the sender. */
  senderId: string
  /** Whether the sender is the patient or the doctor in this conversation. */
  senderRole: 'patient' | 'doctor'
  body: string | null
  attachmentType: MessageAttachmentType | null
  attachment: MessageAttachmentData | null
  refId: string | null
  readAt: string | null
  createdAt: string
}

/** The other participant, from the perspective of the requesting user. */
export interface ConversationCounterpart {
  id: string
  name: string
  profilePictureUrl: string | null
  role: 'patient' | 'doctor'
  specialization?: string | null
}

export interface ConversationSummary {
  id: string
  counterpart: ConversationCounterpart
  lastMessage: Pick<ChatMessage, 'body' | 'attachmentType' | 'senderId' | 'createdAt'> | null
  unreadCount: number
  updatedAt: string
}

export interface ConversationDetail {
  id: string
  counterpart: ConversationCounterpart
  messages: ChatMessage[]
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface StartConversationDto {
  /** Provided by a patient to open the thread with a doctor. */
  doctorId?: string
  /** Provided by a doctor to open the thread with a patient. */
  patientId?: string
}

export interface SendMessageDto {
  body?: string
  attachmentType?: MessageAttachmentType
  attachment?: MessageAttachmentData
  /** Optional source-entity id for deep-linking (e.g. an appointmentId). */
  refId?: string
}
