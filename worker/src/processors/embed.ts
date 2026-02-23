import { query } from '../lib/db.js'
import { chunkText, generateEmbeddings } from '../lib/embeddings.js'
import type { Episode } from '../types/database.js'

/**
 * Generate vector embeddings for an episode's transcript chunks.
 * Stores in pgvector for semantic search.
 */
export async function embed(episodeId: string): Promise<void> {
  const result = await query<Episode>('SELECT * FROM episodes WHERE id = $1', [episodeId])
  const episode = result.rows[0]
  if (!episode) throw new Error(`Episode not found: ${episodeId}`)
  if (!episode.transcript) throw new Error(`No transcript for episode: ${episodeId}`)

  // Clear existing embeddings for this episode (in case of re-run)
  await query('DELETE FROM embeddings WHERE episode_id = $1', [episodeId])

  // Chunk the transcript
  const chunks = chunkText(episode.transcript)
  console.log(`[embed] "${episode.title}" — ${chunks.length} chunks`)

  if (chunks.length === 0) return

  // Generate embeddings in batches (OpenAI supports up to 2048 inputs)
  const BATCH_SIZE = 100
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const vectors = await generateEmbeddings(batch)

    // Insert into pgvector
    for (let j = 0; j < batch.length; j++) {
      const chunkIndex = i + j
      const vectorStr = `[${vectors[j].join(',')}]`

      await query(
        `INSERT INTO embeddings (episode_id, chunk_index, chunk_text, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [episodeId, chunkIndex, batch[j], vectorStr],
      )
    }
  }

  console.log(`[embed] Stored ${chunks.length} embeddings for "${episode.title}"`)
}
