# deep-cuts — Media Intelligence Pipeline

## What It Does

Ingests YouTube shows and podcasts, transcribes them, runs LLM analysis to produce structured knowledge (TLDR, keywords, categories, thought threads), stores everything in a searchable database with semantic search, and generates data-driven infographic cards per episode.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     INGESTION LAYER                      │
│                                                          │
│  YouTube ──► youtube-transcript-api (captions)           │
│          ──► YouTube Data API v3 (metadata/thumbnails)   │
│          ──► Whisper API fallback (no captions)           │
│                                                          │
│  Podcasts ──► RSS parser (feed metadata)                 │
│           ──► Audio download (enclosures)                 │
│           ──► Whisper API (transcription)                 │
│                                                          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                     PROCESSING LAYER                     │
│                                                          │
│  Job Queue (SQLite) ──► Sequential processor             │
│                                                          │
│  Pass 1: EXTRACT                                         │
│    Sonnet 4.6 API → structured JSON output               │
│    - TLDR (1-3 sentences)                                │
│    - Keywords (weighted, hierarchical)                    │
│    - Categories (from controlled vocabulary)              │
│    - Named entities (people, orgs, concepts)              │
│    - Quotable moments (timestamp + text)                  │
│    - Data points (stats, claims, numbers)                 │
│    - Sentiment/tone profile                               │
│                                                          │
│  Pass 2: CONNECT                                         │
│    Sonnet 4.6 API → cross-episode analysis               │
│    - Thought threads (recurring themes across episodes)   │
│    - Entity co-occurrence graph                           │
│    - Conceptual bridges between episodes                  │
│    - Evolution tracking (how ideas change over time)      │
│                                                          │
│  Embeddings:                                              │
│    OpenAI text-embedding-3-small → pgvector              │
│    - Full transcript embedding (chunked, 512 tokens)     │
│    - TLDR embedding                                       │
│    - Per-keyword embeddings                               │
│                                                          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                      STORAGE LAYER                       │
│                                                          │
│  PostgreSQL 16 + pgvector                                │
│    - episodes (metadata, transcript, analysis JSON)      │
│    - keywords (controlled vocab, frequency tracking)     │
│    - thought_threads (cross-episode theme chains)        │
│    - embeddings (chunked vectors, HNSW indexed)          │
│    - shows (YouTube channels / podcast feeds)            │
│    - infographic_data (rendered card metadata)           │
│                                                          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                     │
│                                                          │
│  Next.js 15 Frontend                                     │
│    - Search: semantic (pgvector) + keyword + faceted     │
│    - Browse: by show, category, keyword, date            │
│    - Episode detail: TLDR, keywords, transcript, quotes  │
│    - Thought threads: force-directed graph (D3)          │
│    - Infographic cards: template-based SVG rendering     │
│                                                          │
│  Infographic Engine                                      │
│    - 5-8 templates (timeline, stat-card, topic-web,      │
│      comparison, quote-highlight, data-grid, flow)       │
│    - LLM selects template + populates data slots         │
│    - Satori (JSX → SVG) for rendering                    │
│    - Thumbnail color extraction for theming (sharp)      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Deployment Target

- **Server:** Cloud VPS (2 vCPU, 8 GB RAM)
- **Containers:** PostgreSQL+pgvector (1 container), Worker (1 container)
- **Frontend:** Static export, served via CDN or reverse proxy

## Cost Estimates

| Resource | Cost | Notes |
|---|---|---|
| YouTube captions | Free | youtube-transcript-api, no API key needed |
| YouTube Data API v3 | Free | 10,000 units/day quota, ~100 videos/day |
| Whisper API (fallback) | $0.006/min | ~$0.36/hr of audio, only for captionless content |
| Sonnet 4.6 (extract) | ~$0.09/ep | ~20k input + 2k output tokens per episode |
| Sonnet 4.6 (connect) | ~$0.15/batch | Cross-episode analysis, run weekly |
| Embeddings | ~$0.002/ep | text-embedding-3-small, cheap |
| VPS | Already running | Shared hosting |
| **Total per episode** | **~$0.10-0.45** | Depends on caption availability |
| **Monthly (20 ep/wk)** | **~$8-36** | |

## Data Model

### shows
```sql
CREATE TABLE shows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('youtube_channel', 'youtube_playlist', 'podcast_rss')),
  source_url  TEXT NOT NULL UNIQUE,
  thumbnail   TEXT,
  description TEXT,
  check_interval_hours INTEGER DEFAULT 24,
  last_checked_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### episodes
```sql
CREATE TABLE episodes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id         UUID REFERENCES shows(id),
  external_id     TEXT NOT NULL UNIQUE,  -- YouTube video ID or podcast GUID
  title           TEXT NOT NULL,
  description     TEXT,
  published_at    TIMESTAMPTZ,
  duration_seconds INTEGER,
  thumbnail_url   TEXT,
  source_url      TEXT NOT NULL,
  transcript      TEXT,                   -- full plaintext transcript
  transcript_source TEXT CHECK (transcript_source IN ('youtube_captions', 'whisper_api', 'manual')),
  analysis        JSONB,                  -- full LLM analysis output (Pass 1)
  tldr            TEXT,                   -- extracted for quick access
  sentiment       TEXT,
  dominant_color  TEXT,                   -- hex, extracted from thumbnail
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'transcribing', 'analyzing', 'complete', 'error')),
  error_message   TEXT,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### keywords
```sql
CREATE TABLE keywords (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term        TEXT NOT NULL UNIQUE,
  category    TEXT,  -- from controlled vocabulary
  frequency   INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE episode_keywords (
  episode_id  UUID REFERENCES episodes(id) ON DELETE CASCADE,
  keyword_id  UUID REFERENCES keywords(id) ON DELETE CASCADE,
  weight      REAL DEFAULT 1.0,  -- relevance score 0-1
  PRIMARY KEY (episode_id, keyword_id)
);
```

### thought_threads
```sql
CREATE TABLE thought_threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE thread_episodes (
  thread_id   UUID REFERENCES thought_threads(id) ON DELETE CASCADE,
  episode_id  UUID REFERENCES episodes(id) ON DELETE CASCADE,
  position    INTEGER,  -- order within thread
  context     TEXT,     -- why this episode belongs in this thread
  PRIMARY KEY (thread_id, episode_id)
);
```

### embeddings
```sql
CREATE TABLE embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id  UUID REFERENCES episodes(id) ON DELETE CASCADE,
  chunk_index INTEGER DEFAULT 0,
  chunk_text  TEXT NOT NULL,
  embedding   vector(1536),  -- text-embedding-3-small dimensions
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops);
```

### jobs (SQLite queue — separate from Postgres)
```sql
CREATE TABLE jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,  -- 'ingest', 'transcribe', 'analyze', 'connect', 'embed', 'infographic'
  payload     TEXT NOT NULL,  -- JSON
  status      TEXT DEFAULT 'pending',  -- 'pending', 'running', 'complete', 'error'
  attempts    INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error       TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  started_at  TEXT,
  completed_at TEXT
);
```

## LLM Prompt Schemas

### Pass 1: Extract (per episode)

**Input:** Full transcript + episode metadata
**Output schema:**
```json
{
  "tldr": "string (1-3 sentences)",
  "keywords": [
    { "term": "string", "weight": 0.0-1.0, "category": "string" }
  ],
  "categories": ["string"],
  "entities": [
    { "name": "string", "type": "person|org|concept|place|work", "mentions": 0 }
  ],
  "quotes": [
    { "text": "string", "speaker": "string|null", "timestamp_approx": "string" }
  ],
  "data_points": [
    { "claim": "string", "value": "string|null", "context": "string" }
  ],
  "sentiment": "analytical|conversational|passionate|critical|exploratory|humorous",
  "topics_discussed": ["string"],
  "infographic_suggestion": {
    "template": "timeline|stat-card|topic-web|comparison|quote-highlight|data-grid|flow",
    "rationale": "string",
    "key_data": {}
  }
}
```

### Pass 2: Connect (batch, weekly)

**Input:** TLDR + keywords + entities from N recent episodes
**Output schema:**
```json
{
  "threads": [
    {
      "name": "string",
      "description": "string",
      "episode_ids": ["string"],
      "evolution": "string (how the idea develops across episodes)"
    }
  ],
  "bridges": [
    {
      "from_episode": "string",
      "to_episode": "string",
      "relationship": "string",
      "strength": 0.0-1.0
    }
  ],
  "emerging_themes": ["string"]
}
```

## Controlled Category Vocabulary

Initial set — expands as content dictates:
- Technology
- Philosophy
- Science
- Culture
- Politics
- Economics
- Psychology
- Art & Design
- Music
- Health
- History
- Education
- Spirituality
- Environment
- Media & Communication

## Infographic Templates

### 1. stat-card
Best for: Episodes heavy on data points, numbers, claims
Layout: Large hero stat + 3-4 supporting metrics + episode title

### 2. timeline
Best for: Historical narratives, evolution of ideas, chronological content
Layout: Horizontal or vertical timeline with 4-8 key moments

### 3. topic-web
Best for: Episodes covering many interconnected topics
Layout: Central topic node + radial connections to sub-topics

### 4. comparison
Best for: Debates, pros/cons, two-sided discussions
Layout: Split view with contrasting data/arguments

### 5. quote-highlight
Best for: Interview-heavy content, memorable statements
Layout: Large pull quote + speaker attribution + context

### 6. data-grid
Best for: List-heavy content, rankings, categorized information
Layout: Card grid with icons/colors per category

### 7. flow
Best for: Process explanations, step-by-step content, cause-and-effect
Layout: Connected nodes showing progression

## CLI Interface

```bash
# Add a show to track
npm run ingest -- --add-show "https://youtube.com/@channel" --name "Show Name"
npm run ingest -- --add-show "https://feeds.example.com/podcast.xml" --name "Podcast Name"

# Manually trigger ingestion for all shows
npm run ingest -- --check-all

# Process pending episodes
npm run process -- --all
npm run process -- --episode <id>

# Run connect pass on recent episodes
npm run process -- --connect --since "2026-02-01"
```

## File Structure

```
deep-cuts/
├── SPEC.md                          # This file
├── package.json                     # Workspace root
├── docker-compose.yml               # Postgres + worker
├── .env.example                     # Required env vars
│
├── worker/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                 # Worker entry — polls job queue
│   │   ├── cli.ts                   # CLI commands (ingest, process)
│   │   ├── processors/
│   │   │   ├── ingest.ts            # YouTube/RSS feed checking
│   │   │   ├── transcribe.ts        # Caption fetch / Whisper API
│   │   │   ├── analyze.ts           # LLM Pass 1 (extract)
│   │   │   ├── connect.ts           # LLM Pass 2 (thought threads)
│   │   │   ├── embed.ts             # Generate embeddings
│   │   │   └── infographic.ts       # Template selection + data prep
│   │   ├── lib/
│   │   │   ├── db.ts                # Postgres client (pg + pgvector)
│   │   │   ├── queue.ts             # SQLite job queue
│   │   │   ├── migrate.ts           # Run SQL migrations
│   │   │   ├── youtube.ts           # YouTube API helpers
│   │   │   ├── rss.ts               # RSS parser helpers
│   │   │   ├── llm.ts               # Anthropic API client + schemas
│   │   │   └── embeddings.ts        # OpenAI embeddings client
│   │   └── types/
│   │       ├── schema.ts            # Zod schemas for LLM output
│   │       └── database.ts          # TypeScript types for DB rows
│   ├── migrations/
│   │   └── 001_initial.sql          # Full schema
│   └── scripts/
│       └── seed.ts                  # Dev seed data
│
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx             # Search + browse landing
│   │   │   ├── episode/[id]/
│   │   │   │   └── page.tsx         # Episode detail
│   │   │   ├── show/[id]/
│   │   │   │   └── page.tsx         # Show listing
│   │   │   ├── threads/
│   │   │   │   └── page.tsx         # Thought thread explorer
│   │   │   └── api/
│   │   │       ├── search/route.ts  # Semantic + keyword search
│   │   │       └── graph/route.ts   # Thread graph data
│   │   ├── components/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── EpisodeCard.tsx
│   │   │   ├── KeywordCloud.tsx
│   │   │   ├── ThreadGraph.tsx      # D3 force-directed
│   │   │   ├── InfographicCard.tsx  # SVG template renderer
│   │   │   └── FacetSidebar.tsx
│   │   └── lib/
│   │       ├── db.ts                # Server-side Postgres connection
│   │       └── search.ts            # Search query builder
│   └── public/
│       └── templates/               # SVG infographic templates
│
└── scripts/
    └── setup.sh                     # First-time setup helper
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://deep_cuts:password@localhost:5432/deep_cuts

# APIs
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...           # For embeddings only
YOUTUBE_API_KEY=AIza...         # YouTube Data API v3 (optional, for metadata enrichment)

# Worker
POLL_INTERVAL_MS=30000          # How often worker checks for jobs
MAX_CONCURRENT_JOBS=1           # Sequential on server, can increase locally
WHISPER_FALLBACK=true           # Use Whisper API when captions unavailable

# Frontend
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Phase Rollout

### Phase 1: Ingest + Transcribe (target: 1 week)
- Docker Compose up (Postgres + pgvector)
- Show management (add/remove YouTube channels and podcast feeds)
- YouTube caption fetcher (youtube-transcript-api)
- RSS feed parser + audio download
- Whisper API fallback for captionless content
- SQLite job queue with retry logic
- CLI for manual ingestion

### Phase 2: LLM Analysis (target: 1 week)
- Pass 1 processor (Sonnet 4.6 extract)
- Zod schema validation on LLM output
- Keyword + category storage
- Embedding generation (OpenAI text-embedding-3-small)
- Basic episode status tracking

### Phase 3: Search + Browse Frontend (target: 1 week)
- Next.js 15 app with Tailwind
- Semantic search (pgvector cosine similarity)
- Keyword + faceted search
- Episode detail pages (TLDR, keywords, transcript, quotes)
- Show listing pages
- Responsive — works on phone for quick lookups

### Phase 4: Thought Threads + Infographics (target: 2 weeks)
- Pass 2 processor (Sonnet 4.6 connect)
- Thread visualization (D3 force-directed graph)
- Infographic template engine (Satori JSX → SVG)
- Thumbnail color extraction (sharp)
- 3 initial templates: stat-card, quote-highlight, topic-web
- Remaining templates added iteratively

## Non-Goals (for now)
- Real-time / live transcription
- User accounts or auth
- Public-facing deployment (personal tool first)
- Video playback / embedding
- Mobile app
- Notification system for new episodes
