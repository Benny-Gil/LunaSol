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
          subscriber.next({
            type: 'reasoning',
            data: '⚠️ Offline Fallback: The neural AI model is currently offline. Mapping symptoms using local fuzzy matching database...\n\n'
          })
          await new Promise(resolve => setTimeout(resolve, 600))

          // Safe Fallback: Return all doctors from DB matching keywords
          try {
            const dbDoctors = await this.doctorsService.listDoctors()
            const queryLower = userTexts.toLowerCase()

            const SPECIALIZATION_KEYWORDS: Record<string, string[]> = {
              cardiology: ['chest', 'heart', 'palpitation', 'pressure', 'cardio', 'pulse', 'bp', 'cardiac', 'angina'],
              dermatology: ['skin', 'rash', 'itch', 'acne', 'eczema', 'dermatitis', 'lesion', 'spot', 'hives', 'burn', 'mole'],
              neurology: ['headache', 'migraine', 'brain', 'nerve', 'numb', 'tingle', 'dizzy', 'vertigo', 'seizure', 'paralysis'],
              orthopedics: ['bone', 'joint', 'muscle', 'fracture', 'sprain', 'knee', 'shoulder', 'back', 'spine', 'hip', 'pain', 'arthritis'],
              pediatrics: ['child', 'baby', 'toddler', 'kid', 'infant', 'pediatric', 'pediatrics'],
              psychiatry: ['anxiety', 'depression', 'mood', 'mental', 'panic', 'stress', 'sleep', 'bipolar', 'psych', 'sad', 'fear'],
              'family medicine': ['cough', 'cold', 'fever', 'flu', 'sore throat', 'stomach', 'belly', 'fatigue', 'general', 'routine'],
              'general medicine': ['cough', 'cold', 'fever', 'flu', 'sore throat', 'stomach', 'belly', 'fatigue', 'general', 'routine']
            }

            const scores = new Map<string, number>()
            for (const [spec, keywords] of Object.entries(SPECIALIZATION_KEYWORDS)) {
              let score = 0
              for (const kw of keywords) {
                if (queryLower.includes(kw)) {
                  score += 1
                }
              }
              if (queryLower.includes(spec)) {
                score += 5
              }
              scores.set(spec, score)
            }

            const mappedDocs = dbDoctors.map(doc => {
              const specLower = doc.specialization.toLowerCase()
              const score = scores.get(specLower) || 0
              let reason = 'General practitioner recommended for initial symptom consultation (AI mapping offline).'
              if (score > 0) {
                reason = `Recommended via fuzzy match: your symptom description aligns with their ${doc.specialization} specialization keywords.`
              }
              return {
                id: doc.id,
                name: doc.name,
                specialization: doc.specialization,
                bio: doc.bio,
                profilePictureUrl: doc.profilePictureUrl,
                reason,
                score
              }
            })

            // Sort by score descending
            const sortedDocs = mappedDocs.sort((a, b) => b.score - a.score)
            const fallbackList = sortedDocs.map(({ score, ...rest }) => rest)

            subscriber.next({ type: 'doctors', data: JSON.stringify(fallbackList) })
          } catch (fallbackError) {
            console.error('Graceful fallback doctor fetch failed:', fallbackError)
            subscriber.next({ type: 'error', data: 'AI service is temporarily unavailable' })
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
