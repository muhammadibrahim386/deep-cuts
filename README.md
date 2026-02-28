# Deep Cuts

AI-powered media intelligence pipeline. Ingests YouTube shows and podcasts, transcribes them, runs two-pass LLM analysis, and surfaces cross-episode connections through semantic search and auto-generated infographic cards.

![deep-cuts](https://assets.travisbreaks.com/github/deep-cuts.png)

## Tech Stack

**Worker**: TypeScript, Anthropic SDK (Claude Sonnet), OpenAI Embeddings, PostgreSQL + pgvector, Zod

**Frontend**: Next.js 15, React 19, Tailwind CSS, D3, Satori (JSX to SVG)

## Features

- **Two-pass LLM pipeline**: Pass 1 extracts structured data per episode (TLDR, entities, quotes, sentiment, keywords). Pass 2 connects episodes into cross-show thought threads and thematic bridges.
- **Semantic search**: pgvector HNSW indexing on chunked transcript embeddings for fast cosine similarity retrieval, no external vector database needed
- **Template-based infographics**: 7 card templates (stat-card, quote-highlight, topic-web, timeline, comparison, data-grid, flow) rendered via Satori for pixel-perfect output
- **Smart ingestion**: YouTube captions via free API (Whisper fallback), podcast RSS parsing, thumbnail color extraction for visual theming
- **Schema-validated outputs**: every LLM response validated against Zod schemas before database insertion

## Architecture

```
YouTube/Podcasts → Ingest → Transcribe → Analyze (Pass 1) → Embed → Connect (Pass 2)
                                                                        ↓
                                              Frontend ← PostgreSQL + pgvector
```

## Development

```bash
docker compose up -d   # PostgreSQL + pgvector
npm run db:migrate     # Apply schema
npm run dev:worker     # Start worker
npm run dev:frontend   # http://localhost:3002
```

---

Part of the [travisBREAKS](https://travisbreaks.org) portfolio.
