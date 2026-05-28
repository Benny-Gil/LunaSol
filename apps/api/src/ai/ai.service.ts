import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { AiDoctorSummary } from '@lunasol/types'

@Injectable()
export class AiService {
  private readonly aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai:8000'

  async streamRecommendations(
    payload: { symptoms?: string; messages?: { role: string; content: string }[] },
    doctors: AiDoctorSummary[]
  ): Promise<Response> {
    try {
      const response = await fetch(`${this.aiServiceUrl}/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...payload, doctors }),
      })

      if (!response.ok) {
        throw new Error(`AI service returned status ${response.status}`)
      }

      return response
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to connect to AI service'
      )
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.aiServiceUrl}/health`)
      if (response.ok) {
        const data = await response.json()
        return data.status === 'ok'
      }
      return false
    } catch {
      return false
    }
  }
}
