import dotenv from 'dotenv'

dotenv.config()

import { close as closeDb } from './lib/db.js'
import { close as closeQueue, complete, dequeue, fail, stats } from './lib/queue.js'
import { analyze } from './processors/analyze.js'
import { connectEpisodes } from './processors/connect.js'
import { embed } from './processors/embed.js'
import { prepareInfographic } from './processors/infographic.js'
import { ingestAll, ingestShow } from './processors/ingest.js'
import { transcribe } from './processors/transcribe.js'

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '30000', 10)

async function processJob(job: NonNullable<ReturnType<typeof dequeue>>): Promise<void> {
  const payload = JSON.parse(job.payload)

  switch (job.type) {
    case 'ingest':
      if (payload.show_id) {
        await ingestShow(payload.show_id)
      } else {
        await ingestAll()
      }
      break

    case 'transcribe':
      await transcribe(payload.episode_id, payload.audio_url, payload.source_type)
      break

    case 'analyze':
      await analyze(payload.episode_id)
      break

    case 'connect':
      await connectEpisodes(payload.since)
      break

    case 'embed':
      await embed(payload.episode_id)
      break

    case 'infographic':
      await prepareInfographic(payload.episode_id)
      break

    default:
      throw new Error(`Unknown job type: ${job.type}`)
  }
}

async function pollLoop(): Promise<void> {
  console.log('[worker] Starting poll loop...')
  console.log(`[worker] Poll interval: ${POLL_INTERVAL}ms`)
  console.log('[worker] Queue stats:', stats())

  while (true) {
    const job = dequeue()

    if (job) {
      console.log(`[worker] Processing job #${job.id} (${job.type}), attempt ${job.attempts}/${job.max_attempts}`)

      try {
        await processJob(job)
        complete(job.id)
        console.log(`[worker] Job #${job.id} complete`)
      } catch (err) {
        const message = (err as Error).message
        console.error(`[worker] Job #${job.id} failed:`, message)
        fail(job.id, message)
      }
    }

    await new Promise((resolve) => setTimeout(resolve, job ? 1000 : POLL_INTERVAL))
  }
}

// Graceful shutdown
function shutdown() {
  console.log('\n[worker] Shutting down...')
  closeQueue()
  closeDb().then(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

pollLoop().catch((err) => {
  console.error('[worker] Fatal error:', err)
  shutdown()
})
