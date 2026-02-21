#!/usr/bin/env bash
set -euo pipefail

echo "=== deep-cuts setup ==="

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker is required. Install it first."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required. Install it first."; exit 1; }

# Copy .env if needed
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — fill in your API keys"
fi

# Start database
echo "Starting PostgreSQL + pgvector..."
docker compose up -d

# Wait for DB to be ready
echo "Waiting for database..."
until docker compose exec -T postgres pg_isready -U deep_cuts > /dev/null 2>&1; do
  sleep 1
done
echo "Database ready."

# Install dependencies
echo "Installing worker dependencies..."
cd worker && npm install && cd ..

echo "Installing frontend dependencies..."
cd frontend && npm install && cd ..

# Run migrations
echo "Running migrations..."
cd worker && npx tsx src/lib/migrate.ts && cd ..

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit .env with your API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY)"
echo "  2. Add a show:  npm run ingest -- --add-show 'https://youtube.com/@channel' --name 'Show Name'"
echo "  3. Start worker: npm run dev:worker"
echo "  4. Start frontend: npm run dev:frontend (port 3002)"
