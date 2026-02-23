import { z } from 'zod'

// --- Pass 1: Extract schema ---

export const KeywordSchema = z.object({
  term: z.string(),
  weight: z.number().min(0).max(1),
  category: z.string(),
})

export const EntitySchema = z.object({
  name: z.string(),
  type: z.enum(['person', 'org', 'concept', 'place', 'work']),
  mentions: z.number().int().min(1),
})

export const QuoteSchema = z.object({
  text: z.string(),
  speaker: z.string().nullable(),
  timestamp_approx: z.string().nullable(),
})

export const DataPointSchema = z.object({
  claim: z.string(),
  value: z.string().nullable(),
  context: z.string(),
})

export const InfographicSuggestionSchema = z.object({
  template: z.enum(['timeline', 'stat-card', 'topic-web', 'comparison', 'quote-highlight', 'data-grid', 'flow']),
  rationale: z.string(),
  key_data: z.record(z.unknown()),
})

export const ExtractResultSchema = z.object({
  tldr: z.string(),
  keywords: z.array(KeywordSchema),
  categories: z.array(z.string()),
  entities: z.array(EntitySchema),
  quotes: z.array(QuoteSchema),
  data_points: z.array(DataPointSchema),
  sentiment: z.enum(['analytical', 'conversational', 'passionate', 'critical', 'exploratory', 'humorous']),
  topics_discussed: z.array(z.string()),
  infographic_suggestion: InfographicSuggestionSchema,
})

export type ExtractResult = z.infer<typeof ExtractResultSchema>

// --- Pass 2: Connect schema ---

export const ThreadSchema = z.object({
  name: z.string(),
  description: z.string(),
  episode_ids: z.array(z.string()),
  evolution: z.string(),
})

export const BridgeSchema = z.object({
  from_episode: z.string(),
  to_episode: z.string(),
  relationship: z.string(),
  strength: z.number().min(0).max(1),
})

export const ConnectResultSchema = z.object({
  threads: z.array(ThreadSchema),
  bridges: z.array(BridgeSchema),
  emerging_themes: z.array(z.string()),
})

export type ConnectResult = z.infer<typeof ConnectResultSchema>

// --- Job queue types ---

export const JobTypeSchema = z.enum(['ingest', 'transcribe', 'analyze', 'connect', 'embed', 'infographic'])

export type JobType = z.infer<typeof JobTypeSchema>
