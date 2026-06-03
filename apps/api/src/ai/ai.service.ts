import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { AiDoctorSummary } from '@lunasol/types'

type ChatMessage = { role: string; content: string }

@Injectable()
export class AiService {
  private readonly aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai:8000'
  private readonly openRouterUrl =
    process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
  private readonly openRouterModel =
    process.env.OPENROUTER_MODEL || 'google/gemma-4-26b-a4b-it:free'

  async streamRecommendations(
    payload: { symptoms?: string; messages?: { role: string; content: string }[] },
    doctors: AiDoctorSummary[]
  ): Promise<Response> {
    if (process.env.AI_ENABLED === 'false') {
      throw new InternalServerErrorException('AI service is disabled')
    }
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

  /**
   * Secondary recommendation engine (Tier 2). Streams from OpenRouter's
   * chat-completions API using a cloud Gemma model, normalizing its output to
   * the same event shape the FastAPI tier produces so the controller can
   * forward it through the identical SSE pipeline.
   *
   * Throws on a missing key, a non-OK response (including HTTP 429 rate
   * limiting), or a missing body — the controller treats any throw here as the
   * signal to drop to the Tier 3 fuzzy matcher.
   *
   * Yields `reasoning` chunks (the patient-facing reply, streamed token-by-token
   * with a marker hold-back so the internal [RECOMMENDATIONS] marker never
   * leaks) and, at the end, a single `recommendations` event carrying the
   * parsed `[{ id, reason }]` array.
   */
  async *streamOpenRouterEvents(
    messages: ChatMessage[],
    doctors: AiDoctorSummary[]
  ): AsyncGenerator<{ type: 'reasoning' | 'recommendations'; data: unknown }> {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error('OpenRouter is not configured (OPENROUTER_API_KEY missing)')
    }

    const systemPrompt = this.buildOpenRouterSystemPrompt(doctors)
    const response = await fetch(`${this.openRouterUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter attribution headers (optional but recommended).
        'HTTP-Referer': 'https://lunasol.app',
        'X-Title': 'Lunasol Triage',
      },
      body: JSON.stringify({
        model: this.openRouterModel,
        stream: true,
        temperature: 0.4,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
    })

    if (!response.ok || !response.body) {
      // 429 (rate limit) lands here too — surfaced as a throw so the controller
      // falls through to the fuzzy matcher.
      throw new Error(`OpenRouter returned status ${response.status}`)
    }

    const MARKER = '[RECOMMENDATIONS]'
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let sseBuffer = ''
    let pending = '' // reasoning text not yet safe to emit (possible partial marker)
    let jsonBuf = '' // accumulated text after the marker
    let inJson = false
    let fullText = ''

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      sseBuffer += decoder.decode(value, { stream: true })
      const lines = sseBuffer.split('\n')
      sseBuffer = lines.pop() || ''

      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line || line.startsWith(':')) continue // keep-alive / comment
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') continue

        let content = ''
        try {
          const chunk = JSON.parse(payload)
          content = chunk?.choices?.[0]?.delta?.content ?? ''
        } catch {
          continue // ignore unparseable keep-alive frames
        }
        if (!content) continue
        fullText += content

        if (inJson) {
          jsonBuf += content
          continue
        }

        pending += content
        const idx = pending.indexOf(MARKER)
        if (idx !== -1) {
          const before = pending.slice(0, idx)
          jsonBuf = pending.slice(idx + MARKER.length)
          pending = ''
          inJson = true
          if (before) yield { type: 'reasoning', data: before }
          continue
        }
        // Hold back the last (MARKER.length - 1) chars in case they are the
        // start of the marker arriving across chunk boundaries.
        const keep = MARKER.length - 1
        if (pending.length > keep) {
          const emit = pending.slice(0, pending.length - keep)
          pending = pending.slice(pending.length - keep)
          if (emit) yield { type: 'reasoning', data: emit }
        }
      }
    }

    // Flush any held-back reasoning that turned out not to be a marker.
    if (!inJson && pending) {
      yield { type: 'reasoning', data: pending }
    }

    const recommendations = this.parseRecommendations(inJson ? jsonBuf : fullText)
    if (recommendations.length > 0) {
      yield { type: 'recommendations', data: recommendations }
    }
  }

  /** Tolerant extraction of the [{ id, reason }] array from model output. */
  private parseRecommendations(text: string): { id: string; reason: string }[] {
    const tryParse = (s: string): { id: string; reason: string }[] | null => {
      try {
        const parsed = JSON.parse(s)
        if (Array.isArray(parsed)) {
          return parsed
            .filter((r) => r && typeof r.id !== 'undefined')
            .map((r) => ({ id: String(r.id), reason: String(r.reason ?? '') }))
        }
      } catch {
        /* fall through */
      }
      return null
    }

    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
    const direct = tryParse(cleaned)
    if (direct) return direct

    // Regex fallback: grab the first [...] array anywhere in the text.
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (match) {
      const fromRegex = tryParse(match[0])
      if (fromRegex) return fromRegex
    }
    return []
  }

  /**
   * System prompt for the OpenRouter tier. Mirrors the safety rules of the
   * FastAPI MedGemma prompt (apps/ai/src/triage.py) but uses a single
   * [RECOMMENDATIONS] marker for simpler streaming.
   */
  private buildOpenRouterSystemPrompt(doctors: AiDoctorSummary[]): string {
    const doctorList = doctors
      .map((d) => `- ID: ${d.id}, Name: ${d.name}, Specialization: ${d.specialization}`)
      .join('\n')

    return (
      'You are a medical triage assistant for a telehealth platform. Given a patient\'s ' +
      'symptoms and a list of available doctors, recommend the most relevant doctors.\n\n' +
      'CRITICAL SAFETY RULE: You are NOT a doctor. Do NOT diagnose, prescribe medication, or ' +
      'suggest specific treatments. Your role is to map symptoms to the most relevant doctor ' +
      'specialization (e.g. Cardiology for chest pain, Dermatology for skin issues) and explain ' +
      'briefly why. You may offer general, low-risk self-care comfort tips (rest, hydration, ' +
      'compresses) but MUST add a disclaimer that they are not a medical plan and the patient ' +
      'should consult their matched physician.\n\n' +
      'EMERGENCY PROTOCOL: If the symptoms indicate an acute, life-threatening emergency (severe ' +
      'chest pain, sudden numbness, difficulty breathing, heavy bleeding), begin your reply with: ' +
      '"⚠️ EMERGENCY NOTICE: If you are experiencing life-threatening symptoms, please call ' +
      'emergency services (like 911) or go to the nearest emergency room immediately."\n\n' +
      'If no doctor is a strong match, recommend a General Medicine or Family Medicine doctor and ' +
      'explain that a general consultation is the best starting point.\n\n' +
      'OUTPUT FORMAT — follow exactly:\n' +
      '1. Write a short, warm, patient-facing reply (2-4 sentences). When you recommend a doctor, ' +
      'state their name (e.g. "I\'d suggest booking with Dr. Jane Smith, a Cardiologist.").\n' +
      '2. Then output the exact word [RECOMMENDATIONS] on its own line, followed by a JSON array ' +
      'of the recommended doctors in this exact format:\n' +
      '[{"id": "doctor_id", "reason": "short explanation"}]\n' +
      'Do not write anything after the JSON array.\n\n' +
      `Available Doctors:\n${doctorList}`
    )
  }
}
