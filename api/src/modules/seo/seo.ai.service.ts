import OpenAI from 'openai'
import { z } from 'zod'
import { env } from '../../env.js'
import type { EffectiveSeoMetadata, SeoOptimizeResult, SeoStructuredReport } from './seo.types.js'

const optimizationResponseSchema = z.object({
  actions: z.array(
    z.object({
      canonicalUrl: z.string().url().nullable().optional(),
      description: z.string().min(1).max(320),
      follow: z.boolean(),
      index: z.boolean(),
      keywords: z.array(z.string().min(1).max(80)).max(12),
      openGraph: z.object({
        description: z.string().min(1).max(320).optional(),
        image: z.string().url().optional(),
        title: z.string().min(1).max(120).optional(),
        type: z.string().min(1).max(40).optional(),
        url: z.string().url().optional(),
      }),
      path: z.string().min(1),
      priority: z.number().int().min(0).max(100),
      reason: z.string().min(1).max(500),
      routeType: z.enum(['landing', 'conversion', 'support']),
      title: z.string().min(1).max(120),
    }),
  ),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(1000),
})

const reportResponseSchema = z.object({
  actions: z.array(
    z.object({
      after: z.object({
        canonicalUrl: z.string().nullable(),
        description: z.string(),
        follow: z.boolean(),
        index: z.boolean(),
        keywords: z.array(z.string()),
        openGraph: z.record(z.string(), z.string().optional()).or(
          z.object({
            description: z.string().optional(),
            image: z.string().optional(),
            title: z.string().optional(),
            type: z.string().optional(),
            url: z.string().optional(),
          }),
        ),
        path: z.string(),
        priority: z.number(),
        routeType: z.enum(['landing', 'conversion', 'support']),
        title: z.string(),
      }),
      before: z.object({
        canonicalUrl: z.string().nullable(),
        description: z.string(),
        follow: z.boolean(),
        index: z.boolean(),
        keywords: z.array(z.string()),
        openGraph: z.record(z.string(), z.string().optional()).or(
          z.object({
            description: z.string().optional(),
            image: z.string().optional(),
            title: z.string().optional(),
            type: z.string().optional(),
            url: z.string().optional(),
          }),
        ),
        path: z.string(),
        priority: z.number(),
        routeType: z.enum(['landing', 'conversion', 'support']),
        title: z.string(),
      }),
      page: z.string(),
      reason: z.string(),
    }),
  ),
  confidence: z.number().min(0).max(1),
  impact: z.string().min(1).max(2000),
  keywordAlignment: z.string().min(1).max(2000),
  reasoning: z.string().min(1).max(2000),
  summary: z.string().min(1).max(1500),
})

const client = env.OPEN_AI_API_KEY
  ? new OpenAI({
      apiKey: env.OPEN_AI_API_KEY,
    })
  : null

async function callJsonModel<T>({
  prompt,
  responseSchema,
  systemPrompt,
}: {
  prompt: string
  responseSchema: z.ZodSchema<T>
  systemPrompt: string
}) {
  if (!client) {
    throw new Error('OpenAI is not configured.')
  }

  let lastError: unknown = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await Promise.race([
        client.chat.completions.create({
          model: 'gpt-5.4-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.4,
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('OpenAI request timed out.')), 15_000)
        }),
      ])

      const content = response.choices[0]?.message?.content

      if (!content) {
        throw new Error('OpenAI returned an empty response.')
      }

      return responseSchema.parse(JSON.parse(content))
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to parse OpenAI JSON response.')
}

export async function generateSeoOptimizations(input: {
  pages: Array<{
    metadata: EffectiveSeoMetadata
    notes: string[]
  }>
}) {
  const payload = JSON.stringify(input, null, 2)
  const parsed = await callJsonModel({
    prompt: `Generate SEO metadata improvements for the provided RAYD8 routes. Return valid JSON only.\n\n${payload}`,
    responseSchema: optimizationResponseSchema,
    systemPrompt:
      'You are an expert SEO optimization engine. Only return valid JSON. Optimize metadata, keywords, indexing, and OG content for the provided pages. Do not include markdown or prose outside the JSON object.',
  })

  return {
    ...parsed,
    actions: parsed.actions.map((action) => ({
      ...action,
      canonicalUrl: action.canonicalUrl ?? null,
    })),
  } satisfies SeoOptimizeResult
}

export async function generateSeoReport(input: {
  actions: Array<{
    after: EffectiveSeoMetadata
    before: EffectiveSeoMetadata
    page: string
    reason: string
  }>
}) {
  const payload = JSON.stringify(input, null, 2)
  const parsed = await callJsonModel({
    prompt: `Create a structured RAYD8 SEO optimization report from these approved actions. Return valid JSON only.\n\n${payload}`,
    responseSchema: reportResponseSchema,
    systemPrompt:
      'You are an expert SEO analyst and reporting engine. Only return valid JSON. Summarize reasoning, keyword alignment, impact, actions, and confidence from the supplied applied changes.',
  })

  return parsed satisfies SeoStructuredReport
}
