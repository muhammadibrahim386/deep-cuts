import { query } from '../lib/db.js';
import { fetchTranscript, extractVideoId } from '../lib/youtube.js';
import type { Episode } from '../types/database.js';

/**
 * Transcribe an episode — tries YouTube captions first, falls back to Whisper API.
 */
export async function transcribe(episodeId: string, audioUrl?: string | null, sourceType?: string): Promise<void> {
  const result = await query<Episode>('SELECT * FROM episodes WHERE id = $1', [episodeId]);
  const episode = result.rows[0];
  if (!episode) throw new Error(`Episode not found: ${episodeId}`);

  // Update status
  await query("UPDATE episodes SET status = 'transcribing' WHERE id = $1", [episodeId]);

  let transcript: string | null = null;
  let transcriptSource: string | null = null;

  // Try YouTube captions first (free, instant)
  if (sourceType !== 'podcast') {
    const videoId = extractVideoId(episode.source_url) || extractVideoId(episode.external_id);
    if (videoId) {
      console.log(`[transcribe] Trying YouTube captions for ${videoId}...`);
      transcript = await fetchTranscript(videoId);
      if (transcript) {
        transcriptSource = 'youtube_captions';
        console.log(`[transcribe] Got captions for "${episode.title}" (${transcript.length} chars)`);
      }
    }
  }

  // Fallback to Whisper API
  if (!transcript && process.env.WHISPER_FALLBACK === 'true') {
    const targetUrl = audioUrl || episode.source_url;
    console.log(`[transcribe] Falling back to Whisper API for "${episode.title}"...`);
    transcript = await whisperTranscribe(targetUrl);
    if (transcript) {
      transcriptSource = 'whisper_api';
      console.log(`[transcribe] Whisper transcribed "${episode.title}" (${transcript.length} chars)`);
    }
  }

  if (!transcript) {
    await query(
      "UPDATE episodes SET status = 'error', error_message = 'No transcript available' WHERE id = $1",
      [episodeId]
    );
    throw new Error(`No transcript available for "${episode.title}"`);
  }

  // Save transcript
  await query(
    'UPDATE episodes SET transcript = $1, transcript_source = $2 WHERE id = $3',
    [transcript, transcriptSource, episodeId]
  );
}

/**
 * Use OpenAI Whisper API for transcription.
 * Requires downloading the audio first, then sending to the API.
 */
async function whisperTranscribe(audioUrl: string): Promise<string | null> {
  // TODO: Implement Whisper API transcription
  // 1. Download audio to temp file (or stream)
  // 2. POST to https://api.openai.com/v1/audio/transcriptions
  //    model: "whisper-1", file: audioBlob
  // 3. Return text
  //
  // Cost: $0.006/minute of audio
  console.warn('[transcribe] Whisper API fallback not yet implemented');
  return null;
}
