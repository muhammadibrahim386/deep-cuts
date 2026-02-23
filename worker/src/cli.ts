import dotenv from 'dotenv'

dotenv.config()

import { close as closeDb, query } from './lib/db.js'
import { close as closeQueue, enqueue, stats } from './lib/queue.js'
import { ingestAll, ingestShow } from './processors/ingest.js'

const args = process.argv.slice(2)
const command = args[0]

async function main() {
  switch (command) {
    case 'ingest': {
      const subcommand = args[1]

      if (subcommand === '--add-show') {
        const url = args[2]
        const nameIdx = args.indexOf('--name')
        const name = nameIdx !== -1 ? args[nameIdx + 1] : url

        if (!url) {
          console.error('Usage: cli ingest --add-show <url> --name "Show Name"')
          process.exit(1)
        }

        // Detect source type
        let sourceType = 'podcast_rss'
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          sourceType = url.includes('playlist') ? 'youtube_playlist' : 'youtube_channel'
        }

        const result = await query(
          `INSERT INTO shows (name, source_type, source_url) VALUES ($1, $2, $3) RETURNING id, name`,
          [name, sourceType, url],
        )
        console.log(`Added show: ${result.rows[0].name} (${result.rows[0].id})`)

        // Enqueue initial ingestion
        enqueue('ingest', { show_id: result.rows[0].id })
        console.log('Queued initial ingestion')
      } else if (subcommand === '--check-all') {
        await ingestAll()
      } else if (subcommand === '--show') {
        const showId = args[2]
        if (!showId) {
          console.error('Usage: cli ingest --show <show-id>')
          process.exit(1)
        }
        await ingestShow(showId)
      } else {
        console.log('Usage:')
        console.log('  cli ingest --add-show <url> --name "Show Name"')
        console.log('  cli ingest --check-all')
        console.log('  cli ingest --show <show-id>')
      }
      break
    }

    case 'process': {
      const subcommand = args[1]

      if (subcommand === '--all') {
        // Queue analysis for all pending episodes that have transcripts
        const result = await query<{ id: string; title: string }>(
          "SELECT id, title FROM episodes WHERE status = 'pending' AND transcript IS NOT NULL",
        )
        for (const ep of result.rows) {
          enqueue('analyze', { episode_id: ep.id })
          console.log(`Queued analysis for: ${ep.title}`)
        }
      } else if (subcommand === '--episode') {
        const episodeId = args[2]
        if (!episodeId) {
          console.error('Usage: cli process --episode <episode-id>')
          process.exit(1)
        }
        enqueue('analyze', { episode_id: episodeId })
        console.log(`Queued analysis for episode ${episodeId}`)
      } else if (subcommand === '--connect') {
        const sinceIdx = args.indexOf('--since')
        const since = sinceIdx !== -1 ? args[sinceIdx + 1] : undefined
        enqueue('connect', { since })
        console.log(`Queued connect pass${since ? ` since ${since}` : ''}`)
      } else {
        console.log('Usage:')
        console.log('  cli process --all')
        console.log('  cli process --episode <episode-id>')
        console.log('  cli process --connect [--since YYYY-MM-DD]')
      }
      break
    }

    case 'status': {
      const queueStats = stats()
      console.log('Queue stats:', queueStats)

      const showCount = await query('SELECT COUNT(*) as count FROM shows')
      const episodeCount = await query('SELECT status, COUNT(*) as count FROM episodes GROUP BY status')
      console.log(`\nShows: ${showCount.rows[0].count}`)
      console.log('Episodes by status:')
      for (const row of episodeCount.rows) {
        console.log(
          `  ${(row as { status: string; count: number }).status}: ${(row as { status: string; count: number }).count}`,
        )
      }
      break
    }

    default:
      console.log('deep-cuts CLI')
      console.log('')
      console.log('Commands:')
      console.log('  ingest    Add shows and check feeds')
      console.log('  process   Run analysis on episodes')
      console.log('  status    Show queue and episode stats')
  }

  closeQueue()
  await closeDb()
}

main().catch((err) => {
  console.error('CLI error:', err.message)
  process.exit(1)
})
