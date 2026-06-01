import { Specialization } from '@lunasol/types'

/**
 * Tier 3 recommendation engine — a dependency-free fuzzy/Levenshtein matcher used
 * when both LLM tiers (MedGemma, OpenRouter) are unavailable. It maps a free-text
 * symptom query to doctor specializations using keyword matching with:
 *
 *  - **Discriminative (IDF-style) weighting:** a keyword shared by many
 *    specializations (e.g. "stomach", "joint", "pain") counts for less than a
 *    keyword unique to one (e.g. "migraine", "glaucoma"). Self-maintaining as the
 *    keyword map evolves — no per-keyword hand-tuning.
 *  - **Generalist safety floor:** General/Family Medicine always carry a small
 *    baseline score so they surface for vague/no-match queries, while genuine
 *    specialty matches still outrank them.
 *  - **Confidence tiers:** results are bucketed (strong → generalist → possible →
 *    other) which drives both ordering and the human-readable reason.
 *  - **Negation guard:** a keyword token immediately preceded by no/not/without is
 *    ignored ("no headache" does not score Neurology).
 */

export interface FuzzyDoctor {
  id: string
  name: string
  specialization: string
  bio?: string | null
  profilePictureUrl?: string | null
}

export interface RankedDoctor {
  id: string
  name: string
  specialization: string
  bio?: string | null
  profilePictureUrl?: string | null
  reason: string
}

// Generalist specializations share one keyword list (previously duplicated).
const GENERALIST_KEYWORDS = [
  'cough', 'cold', 'fever', 'flu', 'sore throat', 'stomach', 'belly', 'fatigue',
  'general', 'routine', 'sickness', 'nausea', 'vomit', 'diarrhea', 'illness',
  'ache', 'clinic', 'checkup', 'wellness',
]

// Keyed by the canonical Specialization strings from @lunasol/types, so the typed
// Record is a compile-time error if the shared list and this matcher ever drift.
export const SPECIALIZATION_KEYWORDS: Record<Specialization, string[]> = {
  'Allergy & Immunology': ['allergy', 'allergic', 'hives', 'asthma', 'sneeze', 'sneezing', 'hay fever', 'anaphylaxis', 'food allergy', 'eczema', 'sinus', 'congestion', 'immune', 'autoimmune', 'wheeze', 'pollen', 'rhinitis'],
  'Cardiology': ['chest', 'heart', 'palpitation', 'pressure', 'cardio', 'pulse', 'bp', 'cardiac', 'angina', 'artery', 'vein', 'hypertension', 'arrhythmia', 'valve', 'murmur', 'bypass', 'cardiovascular'],
  'Dermatology': ['skin', 'rash', 'itch', 'acne', 'eczema', 'dermatitis', 'lesion', 'spot', 'hives', 'burn', 'mole', 'wrinkle', 'dermal', 'psoriasis', 'blister', 'wart', 'allergy'],
  'Endocrinology': ['diabetes', 'thyroid', 'hormone', 'insulin', 'sugar', 'glucose', 'metabolism', 'weight', 'fatigue', 'thirst', 'adrenal', 'cortisol', 'goiter', 'hypothyroid', 'hyperthyroid', 'menopause', 'cholesterol'],
  'Family Medicine': GENERALIST_KEYWORDS,
  'Gastroenterology': ['stomach', 'belly', 'abdominal', 'abdomen', 'nausea', 'vomit', 'diarrhea', 'constipation', 'heartburn', 'reflux', 'bloating', 'gut', 'bowel', 'intestine', 'liver', 'ulcer', 'indigestion', 'gastric'],
  'General Medicine': GENERALIST_KEYWORDS,
  'Neurology': ['headache', 'migraine', 'brain', 'nerve', 'numb', 'tingle', 'dizzy', 'vertigo', 'seizure', 'paralysis', 'stroke', 'coma', 'tremor', 'neuropathic', 'spinal', 'concussion', 'neuralgia'],
  'Obstetrics & Gynecology': ['pregnancy', 'pregnant', 'period', 'menstrual', 'menstruation', 'cramps', 'vaginal', 'ovary', 'ovarian', 'uterus', 'cervical', 'fertility', 'contraception', 'pelvic', 'menopause', 'gynecological', 'prenatal'],
  'Oncology': ['cancer', 'tumor', 'tumour', 'lump', 'mass', 'oncology', 'chemotherapy', 'chemo', 'malignant', 'metastasis', 'biopsy', 'lymphoma', 'leukemia', 'carcinoma'],
  'Ophthalmology': ['eyes', 'vision', 'blurry', 'blurred', 'sight', 'blind', 'cataract', 'glaucoma', 'retina', 'eyesight', 'visual', 'redeye', 'floaters', 'dry eye'],
  'Orthopedics': ['bone', 'joint', 'muscle', 'fracture', 'sprain', 'knee', 'shoulder', 'back', 'spine', 'hip', 'pain', 'arthritis', 'tendon', 'ligament', 'scoliosis', 'skeletal', 'cartilage', 'disc'],
  'Otolaryngology (ENT)': ['nose', 'throat', 'sinus', 'hearing', 'tinnitus', 'tonsil', 'tonsillitis', 'sinusitis', 'hoarse', 'voice', 'swallow', 'snoring', 'earache', 'nasal', 'vertigo', 'sinuses'],
  'Pediatrics': ['child', 'baby', 'toddler', 'kid', 'infant', 'pediatric', 'pediatrics', 'pediatrician', 'vaccine', 'adolescent', 'growth', 'newborn'],
  'Psychiatry': ['anxiety', 'depression', 'mood', 'mental', 'panic', 'stress', 'sleep', 'bipolar', 'psych', 'sad', 'fear', 'schizophrenia', 'adhd', 'psychological', 'trauma', 'hallucination'],
  'Pulmonology': ['cough', 'breath', 'breathing', 'shortness', 'wheeze', 'wheezing', 'asthma', 'lung', 'lungs', 'respiratory', 'copd', 'bronchitis', 'pneumonia', 'chest congestion', 'phlegm', 'sleep apnea', 'sputum'],
  'Rheumatology': ['joint', 'arthritis', 'inflammation', 'autoimmune', 'lupus', 'fibromyalgia', 'gout', 'swelling', 'stiff', 'stiffness', 'rheumatoid', 'connective tissue', 'flare', 'achy', 'tendonitis'],
  'Urology': ['urine', 'urinary', 'bladder', 'kidney', 'prostate', 'urinate', 'incontinence', 'kidney stone', 'erectile', 'testicular', 'frequent urination', 'blood in urine', 'renal'],
}

// Tuning constants.
const STRONG_THRESHOLD = 1.5 // ~one discriminative keyword, or two shared ones
const GENERALIST_FLOOR = 0.5 // baseline so generalists beat score-0 specialists
const EXACT_NAME_BONUS = 5 // query literally names the specialization
const NEGATORS = new Set(['no', 'not', 'without', 'denies', 'deny', 'never'])

/**
 * Inverse-document-frequency weight per keyword, derived from the map itself:
 * weight(k) = ln(1 + N / df(k)) where df is how many specializations list k.
 * Computed once at module load.
 */
const KEYWORD_WEIGHT: Map<string, number> = (() => {
  const specs = Object.values(SPECIALIZATION_KEYWORDS)
  const n = specs.length
  const df = new Map<string, number>()
  for (const keywords of specs) {
    for (const kw of new Set(keywords)) {
      df.set(kw, (df.get(kw) || 0) + 1)
    }
  }
  const weights = new Map<string, number>()
  for (const [kw, count] of df) {
    weights.set(kw, Math.log(1 + n / count))
  }
  return weights
})()

export function getLevenshteinDistance(a: string, b: string): number {
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

export function isFuzzyMatch(word: string, keyword: string): boolean {
  const w = word.toLowerCase()
  const kw = keyword.toLowerCase()

  if (w.includes(kw) || kw.includes(w)) {
    return true
  }

  // Keywords/words shorter than 4 chars are too prone to spurious edit-distance
  // collisions (e.g. 'eat'→'ear', 'has'→'gas'); require an exact/substring hit.
  if (w.length < 4 || kw.length < 4) {
    return false
  }

  const maxDistance = kw.length <= 4 ? 1 : 2
  // For the looser distance-2 band, also require the same first letter — this
  // kills collisions like 'cough'→'rough' / 'tough' while keeping typo tolerance
  // (e.g. 'migrane'→'migraine').
  if (maxDistance === 2 && w[0] !== kw[0]) {
    return false
  }
  return getLevenshteinDistance(w, kw) <= maxDistance
}

/**
 * Split a query into matchable tokens (length ≥ 3), dropping any token that is
 * negated by an immediately-preceding negator word.
 */
export function tokenize(queryLower: string): string[] {
  const words = queryLower.split(/[^a-zA-Z]+/g).filter(Boolean)
  const active: string[] = []
  for (let i = 0; i < words.length; i++) {
    const word = words[i] as string
    const prev = i > 0 ? words[i - 1] : undefined
    if (prev && NEGATORS.has(prev)) continue // skip negated token
    if (word.length > 2) active.push(word)
  }
  return active
}

function matchesKeyword(queryLower: string, tokens: string[], keyword: string): boolean {
  const kw = keyword.toLowerCase()

  if (kw.includes(' ')) {
    // Multi-word keywords are long and specific — a substring hit is safe, and
    // also accept all sub-words fuzzy-matching distinct query tokens.
    if (queryLower.includes(kw)) return true
    return kw.split(' ').every(sub => tokens.some(token => isFuzzyMatch(token, sub)))
  }

  // Single-word: token-bounded match only (no unbounded whole-query substring,
  // which previously let short keywords like 'bp' hit inside unrelated words).
  return tokens.some(token => isFuzzyMatch(token, kw))
}

/** Score every specialization for the query. Keys are lowercased spec names. */
export function scoreSpecializations(query: string): Map<string, number> {
  const queryLower = query.toLowerCase()
  const tokens = tokenize(queryLower)
  const scores = new Map<string, number>()

  for (const [specName, keywords] of Object.entries(SPECIALIZATION_KEYWORDS)) {
    const specLower = specName.toLowerCase()
    let score = 0
    for (const kw of keywords) {
      if (matchesKeyword(queryLower, tokens, kw)) {
        score += KEYWORD_WEIGHT.get(kw) ?? 1
      }
    }
    if (queryLower.includes(specLower)) {
      score += EXACT_NAME_BONUS
    }
    // Generalist safety floor.
    if ((specLower.includes('general') || specLower.includes('family')) && score < GENERALIST_FLOOR) {
      score = GENERALIST_FLOOR
    }
    scores.set(specLower, score)
  }
  return scores
}

type Bucket = 0 | 1 | 2 | 3 // strong | generalist | possible | other

function bucketFor(specLower: string, score: number): Bucket {
  const isGeneralist = specLower.includes('general') || specLower.includes('family')
  if (score >= STRONG_THRESHOLD) return 0
  if (isGeneralist) return 1
  if (score > 0) return 2
  return 3
}

function reasonFor(bucket: Bucket): string {
  switch (bucket) {
    case 0:
      return 'Closely matches the symptoms you described.'
    case 1:
      return 'A good first stop — they can assess your symptoms and refer you onward if needed.'
    case 2:
      return 'May be relevant to some of the symptoms you described.'
    default:
      return 'Also available in our network.'
  }
}

/**
 * Rank doctors for a symptom query. Returns every doctor (this is the last-resort
 * tier, so the patient can still choose) ordered strong → generalist → possible →
 * other, with a confidence-tier reason. Ordering is fully deterministic.
 */
export function rankDoctorsFuzzy(query: string, doctors: FuzzyDoctor[]): RankedDoctor[] {
  const scores = scoreSpecializations(query)

  const annotated = doctors.map(doc => {
    const specLower = doc.specialization.toLowerCase()
    const score = scores.get(specLower) ?? 0
    const bucket = bucketFor(specLower, score)
    return { doc, score, bucket }
  })

  annotated.sort((a, b) => {
    if (a.bucket !== b.bucket) return a.bucket - b.bucket
    if (b.score !== a.score) return b.score - a.score
    // Deterministic tie-break (e.g. General vs Family Medicine no longer arbitrary).
    const bySpec = a.doc.specialization.localeCompare(b.doc.specialization)
    if (bySpec !== 0) return bySpec
    return a.doc.name.localeCompare(b.doc.name)
  })

  return annotated.map(({ doc, bucket }) => ({
    id: doc.id,
    name: doc.name,
    specialization: doc.specialization,
    bio: doc.bio,
    profilePictureUrl: doc.profilePictureUrl,
    reason: reasonFor(bucket),
  }))
}
