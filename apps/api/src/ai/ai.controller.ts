import { Controller, Query, Sse, MessageEvent, BadRequestException } from '@nestjs/common'
import { Observable, Subscriber } from 'rxjs'
import { Public } from '../auth/decorators/public.decorator'
import { DoctorsService } from '../doctors/doctors.service'
import { AiService } from './ai.service'
import { rankDoctorsFuzzy } from './fuzzy-match'
import { AiDoctorSummary } from '@lunasol/types'

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
      } catch {
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
      // Recommendation engine ladder, tried in order:
      //   Tier 1  MedGemma (local FastAPI)   — only when MEDGEMMA_ENABLED=true
      //   Tier 2  OpenRouter (cloud Gemma 4) — used when Tier 1 is off or fails
      //   Tier 3  local fuzzy/Levenshtein matcher — when both LLM tiers fail
      ;(async () => {
        if (isEmergency) {
          subscriber.next({
            type: 'reasoning',
            data: '⚠️ EMERGENCY NOTICE: If you are experiencing severe, life-threatening symptoms, please call emergency services (like 911) or visit the nearest emergency room immediately.\n\n'
          })
          // Sleep to let user register emergency message
          await new Promise(resolve => setTimeout(resolve, 300))
        }

        // Fetch all doctors once; shared by every tier.
        let dbDoctors: Awaited<ReturnType<DoctorsService['listDoctors']>> = []
        try {
          dbDoctors = await this.doctorsService.listDoctors()
        } catch (e) {
          console.error('Failed to load doctors for AI recommendation:', e)
        }
        const summaries: AiDoctorSummary[] = dbDoctors.map(doc => ({
          id: doc.id,
          name: doc.name,
          specialization: doc.specialization
        }))

        const medgemmaEnabled = process.env.MEDGEMMA_ENABLED === 'true'

        // ── Tier 1: MedGemma (local FastAPI) — only when explicitly enabled ──
        if (medgemmaEnabled) {
          try {
            const payload = q ? { symptoms: q } : { messages }
            await this.streamFromFastApi(subscriber, payload, summaries)
            subscriber.next({ type: 'done', data: '[DONE]' })
            subscriber.complete()
            return
          } catch (error) {
            console.error('Tier 1 MedGemma (FastAPI) failed, falling back to OpenRouter:', error)
            subscriber.next({
              type: 'reasoning',
              data: '⚠️ Local model offline. Switching to the OpenRouter (Gemma 4) cloud engine...\n\n'
            })
          }
        }

        // ── Tier 2: OpenRouter (Gemma 4) ──
        try {
          for await (const ev of this.aiService.streamOpenRouterEvents(messages, summaries)) {
            if (ev.type === 'reasoning') {
              subscriber.next({ type: 'reasoning', data: ev.data as string })
            } else if (ev.type === 'recommendations') {
              const enriched = await this.enrichDoctors(ev.data as { id: string; reason: string }[])
              subscriber.next({ type: 'doctors', data: enriched })
            }
          }
          subscriber.next({ type: 'done', data: '[DONE]' })
          subscriber.complete()
          return
        } catch (error) {
          console.error('Tier 2 OpenRouter failed (rate limit or error), falling back to fuzzy matcher:', error)
        }

        // ── Tier 3: local fuzzy / Levenshtein matcher ──
        subscriber.next({
          type: 'reasoning',
          data: '⚠️ Offline Fallback: AI engines are currently unavailable. Mapping symptoms using the local fuzzy matching database...\n\n'
        })
        await new Promise(resolve => setTimeout(resolve, 600))

        try {
          const fallbackList = rankDoctorsFuzzy(userTexts, dbDoctors)
          subscriber.next({ type: 'doctors', data: JSON.stringify(fallbackList) })
        } catch (fallbackError) {
          console.error('Graceful fallback doctor fetch failed:', fallbackError)
          subscriber.next({ type: 'error', data: 'AI service is temporarily unavailable' })
        }

        subscriber.next({ type: 'done', data: '[DONE]' })
        subscriber.complete()
      })()
    })
  }

  /**
   * Tier 1 — proxy the SSE stream from the Python FastAPI (MedGemma) service,
   * forwarding reasoning/thought/doctors/error events to the subscriber. Does
   * NOT emit the terminal `done`/complete (the caller does) and throws on any
   * connection or stream error so the ladder can fall through to Tier 2.
   */
  private async streamFromFastApi(
    subscriber: Subscriber<MessageEvent>,
    payload: { symptoms?: string; messages?: { role: string; content: string }[] },
    summaries: AiDoctorSummary[]
  ): Promise<void> {
    const response = await this.aiService.streamRecommendations(payload, summaries)
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No body stream reader available from AI service')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let currentEvent = ''
      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.substring(6).trim()
        } else if (line.startsWith('data:')) {
          // SSE field separator), then JSON-decode. The AI service
          // JSON-encodes every payload (see _sse in triage.py), so a
          // single parse restores the original value: reasoning strings
          // keep their real newlines (which would otherwise break SSE
          // framing) and recommendations come back as an array. Fall
          // back to the raw text if a line is somehow not valid JSON.
          let raw = line.substring(5)
          if (raw.startsWith(' ')) raw = raw.slice(1)
          let data: unknown
          try {
            data = JSON.parse(raw)
          } catch {
            data = raw
          }
          if (currentEvent === 'reasoning') {
            subscriber.next({ type: 'reasoning', data: data as string })
          } else if (currentEvent === 'thought') {
            // Chain-of-thought preview: shown live in the UI while the
            // model is thinking, then collapsed once the reply begins.
            subscriber.next({ type: 'thought', data: data as string })
          } else if (currentEvent === 'recommendations') {
            try {
              const matchedDocs = typeof data === 'string' ? JSON.parse(data) : data
              const enriched = await this.enrichDoctors(matchedDocs)
              subscriber.next({ type: 'doctors', data: enriched })
            } catch (e) {
              console.error('Error parsing or enriching doctors payload:', e)
            }
          } else if (currentEvent === 'error') {
            const message = typeof data === 'string' ? data.trim() : String(data)
            subscriber.next({ type: 'error', data: message })
          }
        } else if (line === '') {
          currentEvent = ''
        }
      }
    }
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
