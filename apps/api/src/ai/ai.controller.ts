import { Controller, Get, Query, Sse, MessageEvent, BadRequestException } from '@nestjs/common'
import { Observable } from 'rxjs'
import { Public } from '../auth/decorators/public.decorator'
import { DoctorsService } from '../doctors/doctors.service'
import { AiService } from './ai.service'

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly doctorsService: DoctorsService
  ) {}

  @Sse('recommend')
  @Public()
  recommend(
    @Query('q') q?: string,
    @Query('history') history?: string
  ): Observable<MessageEvent> {
    if ((!q || q.trim().length === 0) && (!history || history.trim().length === 0)) {
      throw new BadRequestException('Query parameter "q" or "history" is required')
    }

    let messages: { role: string; content: string }[] = []
    if (history && history.trim().length > 0) {
      try {
        messages = JSON.parse(history)
      } catch (err) {
        throw new BadRequestException('Invalid JSON format in "history" parameter')
      }
    } else if (q) {
      messages = [{ role: 'user', content: q }]
    }

    const userTexts = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' ')

    const emergencyKeywords = [
      'chest pain', 'heart attack', 'stroke', 'cannot breathe',
      'heavy bleeding', 'suicide', 'kill myself', 'overdose',
      'shortness of breath', 'difficulty breathing'
    ]
    const isEmergency = emergencyKeywords.some(kw => userTexts.toLowerCase().includes(kw))

    return new Observable<MessageEvent>((subscriber) => {
      // Asynchronously process the stream
      ;(async () => {
        try {
          if (isEmergency) {
            subscriber.next({
              type: 'reasoning',
              data: '⚠️ EMERGENCY NOTICE: If you are experiencing severe, life-threatening symptoms, please call emergency services (like 911) or visit the nearest emergency room immediately.\n\n'
            })
            // Sleep to let user register emergency message
            await new Promise(resolve => setTimeout(resolve, 300))
          }

          // 1. Fetch all doctors to pass to the AI mapping service
          const dbDoctors = await this.doctorsService.listDoctors()
          const summaries = dbDoctors.map(doc => ({
            id: doc.id,
            name: doc.name,
            specialization: doc.specialization
          }))

          // 2. Obtain stream connection from Python FastAPI service
          const payload = q ? { symptoms: q } : { messages }
          const response = await this.aiService.streamRecommendations(payload, summaries)
          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error('No body stream reader available from AI service')
          }

          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { value, done } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            let currentEvent = ''
            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed.startsWith('event:')) {
                currentEvent = trimmed.substring(6).trim()
              } else if (trimmed.startsWith('data:')) {
                const data = trimmed.substring(5).trim()
                if (currentEvent === 'reasoning') {
                  subscriber.next({ type: 'reasoning', data })
                } else if (currentEvent === 'recommendations') {
                  try {
                    const matchedDocs = JSON.parse(data)
                    const enriched = await this.enrichDoctors(matchedDocs)
                    subscriber.next({ type: 'doctors', data: enriched })
                  } catch (e) {
                    console.error('Error parsing or enriching doctors payload:', e)
                  }
                } else if (currentEvent === 'error') {
                  subscriber.next({ type: 'error', data })
                }
              } else if (trimmed === '') {
                currentEvent = ''
              }
            }
          }

          subscriber.next({ type: 'done', data: '[DONE]' })
          subscriber.complete()
        } catch (error) {
          console.error('AI Recommendation Controller Stream Exception:', error)
          subscriber.next({ type: 'error', data: 'AI service is temporarily unavailable' })

          // Safe Fallback: Return all doctors from DB
          try {
            const dbDoctors = await this.doctorsService.listDoctors()
            const fallbackList = dbDoctors.map(doc => ({
              id: doc.id,
              name: doc.name,
              specialization: doc.specialization,
              bio: doc.bio,
              profilePictureUrl: doc.profilePictureUrl,
              reason: 'Available medical professional (AI mapping currently offline).'
            }))
            subscriber.next({ type: 'doctors', data: fallbackList })
          } catch (fallbackError) {
            console.error('Graceful fallback doctor fetch failed:', fallbackError)
          }

          subscriber.next({ type: 'done', data: '[DONE]' })
          subscriber.complete()
        }
      })()
    })
  }

  private async enrichDoctors(recommendations: { id: string; reason: string }[]) {
    const enriched = []
    for (const rec of recommendations) {
      try {
        const doc = await this.doctorsService.getDoctorById(rec.id)
        if (doc) {
          enriched.push({
            id: doc.id,
            name: doc.name,
            specialization: doc.specialization,
            bio: doc.bio,
            profilePictureUrl: doc.profilePictureUrl,
            reason: rec.reason
          })
        }
      } catch (err) {
        console.warn(`Could not enrich doctor ${rec.id} during AI mapping:`, err)
      }
    }
    return enriched
  }
}
