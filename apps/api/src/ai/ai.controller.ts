import { Controller, Query, Sse, MessageEvent, BadRequestException } from '@nestjs/common'
import { Observable } from 'rxjs'
import { Public } from '../auth/decorators/public.decorator'
import { DoctorsService } from '../doctors/doctors.service'
import { AiService } from './ai.service'
import { Specialization } from '@lunasol/types'

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

          // eslint-disable-next-line no-constant-condition
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
            const tokens = queryLower.split(/[^a-zA-Z]+/g).filter(t => t.length > 2)

            // Keyed by the canonical Specialization strings from @lunasol/types,
            // so the typed Record is a compile-time error if the shared list and
            // this matcher ever drift. Lowercased at use to match doc.specialization.
            const SPECIALIZATION_KEYWORDS: Record<Specialization, string[]> = {
              'Allergy & Immunology': ['allergy', 'allergic', 'hives', 'asthma', 'sneeze', 'sneezing', 'hay fever', 'anaphylaxis', 'food allergy', 'eczema', 'sinus', 'congestion', 'immune', 'autoimmune', 'wheeze', 'pollen', 'rhinitis'],
              'Cardiology': ['chest', 'heart', 'palpitation', 'pressure', 'cardio', 'pulse', 'bp', 'cardiac', 'angina', 'artery', 'vein', 'hypertension', 'arrhythmia', 'valve', 'murmur', 'bypass', 'cardiovascular'],
              'Dermatology': ['skin', 'rash', 'itch', 'acne', 'eczema', 'dermatitis', 'lesion', 'spot', 'hives', 'burn', 'mole', 'wrinkle', 'dermal', 'psoriasis', 'blister', 'wart', 'allergy'],
              'Endocrinology': ['diabetes', 'thyroid', 'hormone', 'insulin', 'sugar', 'glucose', 'metabolism', 'weight', 'fatigue', 'thirst', 'adrenal', 'cortisol', 'goiter', 'hypothyroid', 'hyperthyroid', 'menopause', 'cholesterol'],
              'Family Medicine': ['cough', 'cold', 'fever', 'flu', 'sore throat', 'stomach', 'belly', 'fatigue', 'general', 'routine', 'sickness', 'nausea', 'vomit', 'diarrhea', 'illness', 'ache', 'clinic', 'checkup', 'wellness'],
              'Gastroenterology': ['stomach', 'belly', 'abdominal', 'abdomen', 'nausea', 'vomit', 'diarrhea', 'constipation', 'heartburn', 'reflux', 'bloating', 'gut', 'bowel', 'intestine', 'liver', 'ulcer', 'indigestion', 'gastric', 'gas'],
              'General Medicine': ['cough', 'cold', 'fever', 'flu', 'sore throat', 'stomach', 'belly', 'fatigue', 'general', 'routine', 'sickness', 'nausea', 'vomit', 'diarrhea', 'illness', 'ache', 'clinic', 'checkup', 'wellness'],
              'Neurology': ['headache', 'migraine', 'brain', 'nerve', 'numb', 'tingle', 'dizzy', 'vertigo', 'seizure', 'paralysis', 'stroke', 'coma', 'tremor', 'neuropathic', 'spinal', 'concussion', 'neuralgia'],
              'Obstetrics & Gynecology': ['pregnancy', 'pregnant', 'period', 'menstrual', 'menstruation', 'cramps', 'vaginal', 'ovary', 'ovarian', 'uterus', 'cervical', 'fertility', 'contraception', 'pelvic', 'menopause', 'gynecological', 'prenatal'],
              'Oncology': ['cancer', 'tumor', 'tumour', 'lump', 'mass', 'oncology', 'chemotherapy', 'chemo', 'malignant', 'metastasis', 'biopsy', 'lymphoma', 'leukemia', 'carcinoma'],
              'Ophthalmology': ['eye', 'eyes', 'vision', 'blurry', 'blurred', 'sight', 'blind', 'cataract', 'glaucoma', 'retina', 'eyesight', 'visual', 'redeye', 'floaters', 'dry eye'],
              'Orthopedics': ['bone', 'joint', 'muscle', 'fracture', 'sprain', 'knee', 'shoulder', 'back', 'spine', 'hip', 'pain', 'arthritis', 'tendon', 'ligament', 'scoliosis', 'skeletal', 'cartilage', 'disc'],
              'Otolaryngology (ENT)': ['ear', 'nose', 'throat', 'sinus', 'hearing', 'tinnitus', 'tonsil', 'tonsillitis', 'sinusitis', 'hoarse', 'voice', 'swallow', 'snoring', 'earache', 'nasal', 'vertigo', 'sinuses'],
              'Pediatrics': ['child', 'baby', 'toddler', 'kid', 'infant', 'pediatric', 'pediatrics', 'pediatrician', 'vaccine', 'adolescent', 'growth', 'newborn'],
              'Psychiatry': ['anxiety', 'depression', 'mood', 'mental', 'panic', 'stress', 'sleep', 'bipolar', 'psych', 'sad', 'fear', 'schizophrenia', 'adhd', 'psychological', 'trauma', 'hallucination'],
              'Pulmonology': ['cough', 'breath', 'breathing', 'shortness', 'wheeze', 'wheezing', 'asthma', 'lung', 'lungs', 'respiratory', 'copd', 'bronchitis', 'pneumonia', 'chest congestion', 'phlegm', 'sleep apnea', 'sputum'],
              'Rheumatology': ['joint', 'arthritis', 'inflammation', 'autoimmune', 'lupus', 'fibromyalgia', 'gout', 'swelling', 'stiff', 'stiffness', 'rheumatoid', 'connective tissue', 'flare', 'achy', 'tendonitis'],
              'Urology': ['urine', 'urinary', 'bladder', 'kidney', 'prostate', 'pee', 'urinate', 'incontinence', 'uti', 'kidney stone', 'erectile', 'testicular', 'frequent urination', 'blood in urine', 'renal'],
            }

            const scores = new Map<string, number>()
            for (const [specName, keywords] of Object.entries(SPECIALIZATION_KEYWORDS)) {
              const spec = specName.toLowerCase()
              let score = 0
              for (const kw of keywords) {
                if (matchesKeyword(queryLower, tokens, kw)) {
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
              let reason = ''
              if (score > 0) {
                reason = `Recommended via fuzzy match: your symptoms align with their ${doc.specialization} specialization.`
              } else if (specLower.includes('general') || specLower.includes('family')) {
                reason = 'General practitioner recommended for initial symptom consultation (AI mapping offline).'
              } else {
                reason = `Available specialist: ${doc.specialization} (AI mapping offline).`
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
            const fallbackList = sortedDocs.map(({ score: _score, ...rest }) => rest)

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

function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => 
    new Array<number>(b.length + 1).fill(0)
  )

  for (let i = 0; i <= a.length; i++) {
    const row = matrix[i]
    if (row) row[0] = i
  }
  for (let j = 0; j <= b.length; j++) {
    const row = matrix[0]
    if (row) row[j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const row = matrix[i]
      const prevRow = matrix[i - 1]
      if (row && prevRow) {
        if (a[i - 1] === b[j - 1]) {
          row[j] = prevRow[j - 1] ?? 0
        } else {
          row[j] = Math.min(
            (prevRow[j] ?? 0) + 1,    // deletion
            (row[j - 1] ?? 0) + 1,    // insertion
            (prevRow[j - 1] ?? 0) + 1 // substitution
          )
        }
      }
    }
  }
  const lastRow = matrix[a.length]
  return lastRow ? (lastRow[b.length] ?? 0) : 0
}

function isFuzzyMatch(word: string, keyword: string): boolean {
  const w = word.toLowerCase()
  const kw = keyword.toLowerCase()

  if (w.includes(kw) || kw.includes(w)) {
    return true
  }

  if (w.length < 3 || kw.length < 3) {
    return false
  }

  const maxDistance = kw.length <= 4 ? 1 : 2
  const distance = getLevenshteinDistance(w, kw)
  return distance <= maxDistance
}

function matchesKeyword(queryLower: string, tokens: string[], keyword: string): boolean {
  const kw = keyword.toLowerCase()

  if (queryLower.includes(kw)) {
    return true
  }

  if (kw.includes(' ')) {
    const subKws = kw.split(' ')
    return subKws.every(subKw => 
      tokens.some(token => isFuzzyMatch(token, subKw))
    )
  }

  return tokens.some(token => isFuzzyMatch(token, kw))
}

