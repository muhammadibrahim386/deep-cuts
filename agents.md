# deep-cuts — Architecture

Media intelligence pipeline. Ingests YouTube shows and podcasts, transcribes them, runs two-pass LLM analysis (extract + connect), stores everything in a searchable database with vector embeddings, and generates template-based infographic cards per episode.

**Status**: Scaffolded (2026-02-20). Not yet functional — needs `npm install`, Docker up, API keys, and implementation of TODO stubs.
**Full spec**: [SPEC.md](SPEC.md)

## Stack

- **Worker**: TypeScript, tsx, better-sqlite3 (job queue), pg + pgvector (data), Anthropic SDK (Sonnet 4.6), OpenAI SDK (embeddings), rss-parser, youtube-transcript, sharp, zod
- **Frontend**: Next.js 15, React 19, Tailwind v4, D3 (force graph), Satori (JSX→SVG infographics), pg + pgvector
- **Database**: PostgreSQL 16 + pgvector (Docker, port 5433)
- **Workspace**: `deep-cuts` in CODE monorepo

## File Map

```
deep-cuts/
├── SPEC.md                          # Full spec (architecture, data model, schemas, costs, phases)
├── agents.md                        # This file
├── package.json                     # Workspace root (dev:worker, dev:frontend, db:migrate, ingest, process)
├── docker-compose.yml               # Postgres+pgvector on port 5433
├── .env.example                     # Required env vars (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
├── .gitignore                       # Excludes .env, *.db, worker/data/, .next/
│
├── worker/
│   ├── package.json                 # Dependencies: @anthropic-ai/sdk, better-sqlite3, pg, pgvector, etc.
│   ├── tsconfig.json
│   ├── migrations/
│   │   └── 001_initial.sql          # Full schema: shows, episodes, keywords, thought_threads, embeddings, infographics
│   └── src/
│       ├── index.ts                 # Worker entry — polls SQLite job queue, dispatches to processors
│       ├── cli.ts                   # CLI: ingest (add-show, check-all), process (all, episode, connect), status
│       ├── processors/
│       │   ├── ingest.ts            # RSS feed parsing + YouTube channel listing (YT API stub)
│       │   ├── transcribe.ts        # YouTube captions (youtube-transcript) + Whisper API fallback (stub)
│       │   ├── analyze.ts           # LLM Pass 1: extract TLDR, keywords, entities, quotes, data points
│       │   ├── connect.ts           # LLM Pass 2: cross-episode thought threads, bridges, emerging themes
│       │   ├── embed.ts             # Chunk transcript → OpenAI embeddings → pgvector
│       │   └── infographic.ts       # Template selection + data prep + thumbnail color extraction
│       ├── lib/
│       │   ├── db.ts                # Postgres client (pg pool, slow query warnings)
│       │   ├── queue.ts             # SQLite job queue (enqueue, dequeue, complete, fail, stats)
│       │   ├── migrate.ts           # SQL migration runner with tracking table
│       │   ├── youtube.ts           # fetchTranscript, extractVideoId, extractChannelId
│       │   ├── rss.ts               # parseFeed → PodcastEpisode[]
│       │   ├── llm.ts               # Anthropic client: extract() + connect() with Zod validation
│       │   └── embeddings.ts        # OpenAI client: chunkText() + generateEmbeddings()
│       └── types/
│           ├── schema.ts            # Zod schemas: ExtractResult, ConnectResult, JobType
│           └── database.ts          # TypeScript interfaces: Show, Episode, Keyword, Job, etc.
│
├── frontend/
│   ├── package.json                 # Dependencies: next, react, d3, pg, pgvector, satori, tailwindcss
│   ├── tsconfig.json
│   ├── next.config.ts               # output: 'standalone'
│   ├── postcss.config.mjs           # @tailwindcss/postcss
│   └── src/
│       ├── app/
│       │   ├── layout.tsx           # Dark theme shell, nav (Search, Threads)
│       │   ├── page.tsx             # Search bar + stats + recent episodes (placeholder)
│       │   ├── globals.css          # CSS vars: --bg-primary, --accent, etc.
│       │   └── threads/
│       │       └── page.tsx         # Thought thread graph (D3 placeholder)
│       └── lib/
│           └── db.ts                # Server-side Postgres + semanticSearch() helper
│
└── scripts/
    └── setup.sh                     # First-time setup: Docker, npm install, migrate
```

## Data Flow

```
YouTube/Podcast URL
  → ingest.ts (RSS parse or YT API)
  → transcribe.ts (captions or Whisper API)
  → analyze.ts (Sonnet 4.6 Pass 1 → ExtractResult)
  → embed.ts (OpenAI text-embedding-3-small → pgvector)
  → infographic.ts (template select + data prep)
  → connect.ts (Sonnet 4.6 Pass 2 → thought threads, weekly batch)
```

## Key Design Decisions

| Decision | Rationale |
|---|---|
| YouTube captions first, Whisper API fallback | EC2 has no GPU — local Whisper would take 10-20x real-time |
| SQLite job queue, not BullMQ+Redis | Processing 5-20 jobs/week, not 50k/sec. One less container. |
| PostgreSQL + pgvector only, no Neo4j | Neo4j advantages only materialize at >100k nodes. JSONB + join tables handle thought-threading fine. |
| Two-pass LLM (extract → connect) | Better schema enforcement per pass. Extract is per-episode, connect is cross-episode batch. |
| Template-based infographics (Satori) | Raw SVG generation from LLMs is unreliable. 7 templates with LLM slot-filling is predictable. |
| Zod schema validation on LLM output | LLMs occasionally drift from schema — Zod catches it before DB insertion. |

## Costs

~$0.10-0.45 per episode depending on caption availability. ~$8-36/month at 20 episodes/week. See SPEC.md for full breakdown.

## Ports

- Frontend: 3002 (Next.js)
- PostgreSQL: 5433 (Docker, avoids localhost Postgres conflicts)

## TODO Stubs (not yet implemented)

1. `ingest.ts` → `ingestYouTube()` — needs YouTube Data API v3 integration
2. `transcribe.ts` → `whisperTranscribe()` — needs audio download + OpenAI Whisper API call
3. `frontend/` → all pages are placeholder shells, no live data fetching yet
4. Infographic SVG rendering (Satori templates) — `infographic.ts` preps data but templates aren't built
5. `episode/[id]/page.tsx` and `show/[id]/page.tsx` — route pages not created yet

## Getting Started (when ready to build)

```bash
cd deep-cuts
cp .env.example .env              # Fill in API keys
docker compose up -d              # Start Postgres+pgvector
cd worker && npm install && cd ..
cd frontend && npm install && cd ..
npm run db:migrate                # Apply schema
npm run ingest -- --add-show "https://youtube.com/@channel" --name "Show Name"
npm run dev:worker                # Start job processor
npm run dev:frontend              # Start frontend on :3002
```
