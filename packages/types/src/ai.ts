/** Slim doctor object sent to FastAPI for matching */
export interface AiDoctorSummary {
  id: string
  name: string
  specialization: string
}

/** FastAPI request body */
export interface AiRecommendRequest {
  symptoms: string
  doctors: AiDoctorSummary[]
}

/** Single doctor recommendation from the AI */
export interface AiRecommendedDoctor {
  id: string
  reason: string
}

/** Final SSE event payload from NestJS to browser */
export interface AiDoctorsEvent {
  doctors: (AiDoctorSummary & {
    reason: string
    bio: string | null
    profilePictureUrl: string | null
  })[]
}
