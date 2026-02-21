import { query } from '../lib/db.js';
import { enqueue } from '../lib/queue.js';
import { parseFeed } from '../lib/rss.js';
import { extractChannelId } from '../lib/youtube.js';
import type { Show } from '../types/database.js';

/**
 * Check a show's feed for new episodes and enqueue them for processing.
 */
export async function ingestShow(showId: string): Promise<number> {
  const result = await query<Show>('SELECT * FROM shows WHERE id = $1', [showId]);
  const show = result.rows[0];
  if (!show) throw new Error(`Show not found: ${showId}`);

  let newEpisodes = 0;

  if (show.source_type === 'podcast_rss') {
    newEpisodes = await ingestPodcast(show);
  } else if (show.source_type === 'youtube_channel' || show.source_type === 'youtube_playlist') {
    newEpisodes = await ingestYouTube(show);
  }

  // Update last checked timestamp
  await query('UPDATE shows SET last_checked_at = now() WHERE id = $1', [showId]);

  return newEpisodes;
}

async function ingestPodcast(show: Show): Promise<number> {
  const feed = await parseFeed(show.source_url);
  let added = 0;

  for (const ep of feed.episodes) {
    // Skip if we already have this episode
    const exists = await query(
      'SELECT 1 FROM episodes WHERE external_id = $1',
      [ep.guid]
    );
    if (exists.rows.length > 0) continue;

    // Insert episode
    const result = await query(
      `INSERT INTO episodes (show_id, external_id, title, description, published_at, duration_seconds, thumbnail_url, source_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING id`,
      [show.id, ep.guid, ep.title, ep.description, ep.published_at, ep.duration_seconds, ep.thumbnail_url, ep.source_url]
    );

    // Enqueue transcription job
    enqueue('transcribe', {
      episode_id: result.rows[0].id,
      audio_url: ep.audio_url,
      source_type: 'podcast',
    });

    added++;
  }

  console.log(`[ingest] ${show.name}: ${added} new podcast episodes`);
  return added;
}

async function ingestYouTube(show: Show): Promise<number> {
  // TODO: Use YouTube Data API v3 to list recent videos from channel/playlist
  // For now, this is a stub — YouTube channel ingestion requires API key
  const channelInfo = extractChannelId(show.source_url);
  if (!channelInfo) {
    console.warn(`[ingest] Could not parse YouTube URL: ${show.source_url}`);
    return 0;
  }

  console.log(`[ingest] YouTube channel ingestion for ${channelInfo.id} — requires YouTube Data API v3 implementation`);
  // Implementation will use:
  // GET https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=...&type=video&order=date
  // or
  // GET https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=...

  return 0;
}

/**
 * Check all shows that are due for a check.
 */
export async function ingestAll(): Promise<void> {
  const result = await query<Show>(`
    SELECT * FROM shows
    WHERE last_checked_at IS NULL
       OR last_checked_at < now() - (check_interval_hours || ' hours')::interval
    ORDER BY last_checked_at ASC NULLS FIRST
  `);

  console.log(`[ingest] Checking ${result.rows.length} shows...`);

  for (const show of result.rows) {
    try {
      await ingestShow(show.id);
    } catch (err) {
      console.error(`[ingest] Error checking ${show.name}:`, (err as Error).message);
    }
  }
}
