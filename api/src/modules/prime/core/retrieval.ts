import type { PilotSigil, SigilStatus } from './catalog.js'
import type { SigilDomain } from './svg.js'

export interface RetrievalQuery {
  intention: string
  threshold: number
  limits: Partial<Record<SigilDomain, number>>
  includeUnpublished?: boolean
}

export interface RetrievalHit {
  publicCode: string
  name: string
  domain: SigilDomain
  score: number
  explanation: string
  keywords: string[]
  status: SigilStatus
}

const DOMAIN_HINTS: Array<{ domain: SigilDomain; words: string[] }> = [
  { domain: 'physical', words: ['body', 'energy', 'heart', 'physical', 'vitality', 'health'] },
  { domain: 'emotional', words: ['emotion', 'happy', 'happiness', 'peace', 'love', 'joy', 'calm'] },
  { domain: 'mental', words: ['mind', 'clarity', 'focus', 'confidence', 'mastery', 'thought'] },
  { domain: 'causal', words: ['money', 'wealth', 'prosperity', 'stability', 'financial', 'abundance', 'harmony'] },
]

export function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2)
}

export function hashEmbedding(text: string, dimensions = 32) {
  const vector = Array.from({ length: dimensions }, () => 0)
  for (const token of tokenize(text)) {
    let hash = 2166136261
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    const slot = (hash >>> 0) % dimensions
    const sign = (hash & 1) === 0 ? 1 : -1
    vector[slot] = (vector[slot] ?? 0) + sign
  }
  return vector
}

export function cosineSimilarity(left: number[], right: number[]) {
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0
    const b = right[index] ?? 0
    dot += a * b
    leftNorm += a * a
    rightNorm += b * b
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return 0
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

function searchableText(sigil: PilotSigil) {
  return [
    sigil.name,
    sigil.description,
    sigil.assumptionStatement,
    ...sigil.primaryKeywords,
    ...sigil.secondaryKeywords,
    ...sigil.semanticTags,
    ...sigil.synonyms,
  ].join(' ')
}

export function detectDomains(intention: string) {
  const tokens = new Set(tokenize(intention))
  const domains = DOMAIN_HINTS.filter((hint) => hint.words.some((word) => tokens.has(word))).map(
    (hint) => hint.domain,
  )
  return domains.length > 0 ? domains : (['physical', 'emotional', 'mental', 'causal'] as SigilDomain[])
}

export function retrieveSigils(catalog: PilotSigil[], query: RetrievalQuery): RetrievalHit[] {
  const tokens = tokenize(query.intention)
  const queryVector = hashEmbedding(query.intention)
  const domains = detectDomains(query.intention)
  const hits: RetrievalHit[] = []

  for (const sigil of catalog) {
    if (!query.includeUnpublished && sigil.status !== 'published') {
      continue
    }
    if (!domains.includes(sigil.domain)) {
      continue
    }

    const corpus = tokenize(searchableText(sigil))
    const matched = tokens.filter((token) => corpus.some((word) => word.includes(token) || token.includes(word)))
    const keywordScore = tokens.length === 0 ? 0 : matched.length / tokens.length
    const semantic = cosineSimilarity(queryVector, hashEmbedding(searchableText(sigil)))
    const domainBoost = domains.includes(sigil.domain) ? 0.15 : 0
    const score = Math.min(1, keywordScore * 0.6 + Math.max(0, semantic) * 0.25 + domainBoost)

    if (score < query.threshold && matched.length === 0) {
      continue
    }

    hits.push({
      publicCode: sigil.publicCode,
      name: sigil.name,
      domain: sigil.domain,
      score: Number(score.toFixed(3)),
      explanation:
        matched.length > 0
          ? `Matched ${matched.join(', ')} in the published record.`
          : 'Ranked by semantic similarity within the detected domain.',
      keywords: matched,
      status: sigil.status,
    })
  }

  const limits = query.limits
  const grouped = new Map<SigilDomain, RetrievalHit[]>()
  for (const hit of hits.sort((left, right) => right.score - left.score)) {
    const bucket = grouped.get(hit.domain) ?? []
    const limit = limits[hit.domain] ?? 2
    if (bucket.length >= limit) {
      continue
    }
    if (bucket.some((existing) => existing.publicCode === hit.publicCode)) {
      continue
    }
    bucket.push(hit)
    grouped.set(hit.domain, bucket)
  }

  return [...grouped.values()].flat()
}
