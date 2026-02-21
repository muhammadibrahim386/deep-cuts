import { query } from '../lib/db.js';
import { connect } from '../lib/llm.js';

/**
 * Run LLM Pass 2 (Connect) on a batch of analyzed episodes.
 * Identifies thought threads, bridges, and emerging themes.
 */
export async function connectEpisodes(since?: string): Promise<void> {
  const sinceDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const result = await query<{
    id: string;
    title: string;
    tldr: string;
    analysis: Record<string, unknown>;
  }>(
    `SELECT id, title, tldr, analysis FROM episodes
     WHERE status = 'complete' AND processed_at >= $1
     ORDER BY published_at ASC`,
    [sinceDate]
  );

  if (result.rows.length < 2) {
    console.log('[connect] Need at least 2 analyzed episodes for connection analysis');
    return;
  }

  console.log(`[connect] Analyzing connections across ${result.rows.length} episodes...`);

  // Prepare episode summaries for the LLM
  const episodes = result.rows.map((ep) => ({
    id: ep.id,
    title: ep.title,
    tldr: ep.tldr || '',
    keywords: ((ep.analysis as { keywords?: Array<{ term: string }> })?.keywords || []).map(
      (k) => k.term
    ),
  }));

  const connections = await connect(episodes);

  // Store thought threads
  for (const thread of connections.threads) {
    const threadResult = await query<{ id: string }>(
      `INSERT INTO thought_threads (name, description) VALUES ($1, $2) RETURNING id`,
      [thread.name, thread.description]
    );

    for (let i = 0; i < thread.episode_ids.length; i++) {
      await query(
        `INSERT INTO thread_episodes (thread_id, episode_id, position, context)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [threadResult.rows[0].id, thread.episode_ids[i], i, thread.evolution]
      );
    }
  }

  console.log(
    `[connect] Found ${connections.threads.length} threads, ${connections.bridges.length} bridges, ${connections.emerging_themes.length} emerging themes`
  );
}
