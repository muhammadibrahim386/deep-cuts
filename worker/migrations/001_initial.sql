-- deep-cuts: initial schema
-- Requires: pgvector extension

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shows (YouTube channels, playlists, podcast feeds)
CREATE TABLE shows (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  source_type          TEXT NOT NULL CHECK (source_type IN ('youtube_channel', 'youtube_playlist', 'podcast_rss')),
  source_url           TEXT NOT NULL UNIQUE,
  thumbnail            TEXT,
  description          TEXT,
  check_interval_hours INTEGER DEFAULT 24,
  last_checked_at      TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- Episodes (individual videos or podcast episodes)
CREATE TABLE episodes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id           UUID REFERENCES shows(id) ON DELETE CASCADE,
  external_id       TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  description       TEXT,
  published_at      TIMESTAMPTZ,
  duration_seconds  INTEGER,
  thumbnail_url     TEXT,
  source_url        TEXT NOT NULL,
  transcript        TEXT,
  transcript_source TEXT CHECK (transcript_source IN ('youtube_captions', 'whisper_api', 'manual')),
  analysis          JSONB,
  tldr              TEXT,
  sentiment         TEXT,
  dominant_color    TEXT,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'transcribing', 'analyzing', 'complete', 'error')),
  error_message     TEXT,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_episodes_show ON episodes(show_id);
CREATE INDEX idx_episodes_status ON episodes(status);
CREATE INDEX idx_episodes_published ON episodes(published_at DESC);

-- Keywords (controlled vocabulary)
CREATE TABLE keywords (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term       TEXT NOT NULL UNIQUE,
  category   TEXT,
  frequency  INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_keywords_term ON keywords(term);
CREATE INDEX idx_keywords_category ON keywords(category);

-- Episode <-> Keyword junction
CREATE TABLE episode_keywords (
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
  keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
  weight     REAL DEFAULT 1.0,
  PRIMARY KEY (episode_id, keyword_id)
);

-- Thought threads (cross-episode theme chains)
CREATE TABLE thought_threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Thread <-> Episode junction (ordered)
CREATE TABLE thread_episodes (
  thread_id  UUID REFERENCES thought_threads(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
  position   INTEGER,
  context    TEXT,
  PRIMARY KEY (thread_id, episode_id)
);

-- Vector embeddings (chunked transcripts)
CREATE TABLE embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id  UUID REFERENCES episodes(id) ON DELETE CASCADE,
  chunk_index INTEGER DEFAULT 0,
  chunk_text  TEXT NOT NULL,
  embedding   vector(1536),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_embeddings_episode ON embeddings(episode_id);
CREATE INDEX idx_embeddings_vector ON embeddings USING hnsw (embedding vector_cosine_ops);

-- Infographic metadata (per episode, tracks which template was used)
CREATE TABLE infographics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id  UUID REFERENCES episodes(id) ON DELETE CASCADE UNIQUE,
  template    TEXT NOT NULL,
  data        JSONB NOT NULL,
  svg_path    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
