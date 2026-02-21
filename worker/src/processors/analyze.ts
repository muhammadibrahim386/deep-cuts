import { query } from '../lib/db.js';
import { enqueue } from '../lib/queue.js';
import { extract } from '../lib/llm.js';
import type { Episode } from '../types/database.js';

/**
 * Run LLM Pass 1 (Extract) on an episode's transcript.
 * Produces structured analysis: TLDR, keywords, entities, quotes, etc.
 */
export async function analyze(episodeId: string): Promise<void> {
  const result = await query<Episode>('SELECT * FROM episodes WHERE id = $1', [episodeId]);
  const episode = result.rows[0];
  if (!episode) throw new Error(`Episode not found: ${episodeId}`);
  if (!episode.transcript) throw new Error(`No transcript for episode: ${episodeId}`);

  await query("UPDATE episodes SET status = 'analyzing' WHERE id = $1", [episodeId]);

  console.log(`[analyze] Processing "${episode.title}"...`);

  // Run LLM extraction
  const analysis = await extract(
    episode.title,
    episode.description,
    episode.transcript
  );

  // Save analysis
  await query(
    `UPDATE episodes SET
       analysis = $1,
       tldr = $2,
       sentiment = $3,
       status = 'complete',
       processed_at = now()
     WHERE id = $4`,
    [JSON.stringify(analysis), analysis.tldr, analysis.sentiment, episodeId]
  );

  // Upsert keywords
  for (const kw of analysis.keywords) {
    const kwResult = await query<{ id: string }>(
      `INSERT INTO keywords (term, category)
       VALUES ($1, $2)
       ON CONFLICT (term) DO UPDATE SET
         category = COALESCE(EXCLUDED.category, keywords.category),
         frequency = keywords.frequency + 1
       RETURNING id`,
      [kw.term.toLowerCase(), kw.category]
    );

    await query(
      `INSERT INTO episode_keywords (episode_id, keyword_id, weight)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [episodeId, kwResult.rows[0].id, kw.weight]
    );
  }

  // Enqueue embedding generation
  enqueue('embed', { episode_id: episodeId });

  console.log(`[analyze] Completed "${episode.title}" — ${analysis.keywords.length} keywords, sentiment: ${analysis.sentiment}`);
}
