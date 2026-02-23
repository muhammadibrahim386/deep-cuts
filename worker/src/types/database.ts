export interface Show {
  id: string
  name: string
  source_type: 'youtube_channel' | 'youtube_playlist' | 'podcast_rss'
  source_url: string
  thumbnail: string | null
  description: string | null
  check_interval_hours: number
  last_checked_at: Date | null
  created_at: Date
}

export interface Episode {
  id: string
  show_id: string
  external_id: string
  title: string
  description: string | null
  published_at: Date | null
  duration_seconds: number | null
  thumbnail_url: string | null
  source_url: string
  transcript: string | null
  transcript_source: 'youtube_captions' | 'whisper_api' | 'manual' | null
  analysis: Record<string, unknown> | null
  tldr: string | null
  sentiment: string | null
  dominant_color: string | null
  status: 'pending' | 'transcribing' | 'analyzing' | 'complete' | 'error'
  error_message: string | null
  processed_at: Date | null
  created_at: Date
}

export interface Keyword {
  id: string
  term: string
  category: string | null
  frequency: number
  created_at: Date
}

export interface EpisodeKeyword {
  episode_id: string
  keyword_id: string
  weight: number
}

export interface ThoughtThread {
  id: string
  name: string
  description: string | null
  created_at: Date
}

export interface ThreadEpisode {
  thread_id: string
  episode_id: string
  position: number | null
  context: string | null
}

export interface Embedding {
  id: string
  episode_id: string
  chunk_index: number
  chunk_text: string
  embedding: number[]
  created_at: Date
}

export interface Infographic {
  id: string
  episode_id: string
  template: string
  data: Record<string, unknown>
  svg_path: string | null
  created_at: Date
}

export interface Job {
  id: number
  type: string
  payload: string
  status: 'pending' | 'running' | 'complete' | 'error'
  attempts: number
  max_attempts: number
  error: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}
