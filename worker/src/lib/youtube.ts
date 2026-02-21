import { YoutubeTranscript } from 'youtube-transcript';

export interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

/**
 * Fetch YouTube auto-generated or manual captions.
 * Uses youtube-transcript package — no API key needed.
 * Returns null if no captions available.
 */
export async function fetchTranscript(videoId: string): Promise<string | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    if (!segments || segments.length === 0) return null;

    // Join segments into plain text, preserving paragraph breaks
    // Group by ~30 second windows for natural paragraph breaks
    const paragraphs: string[] = [];
    let current: string[] = [];
    let windowStart = 0;

    for (const seg of segments) {
      if (seg.offset - windowStart > 30000 && current.length > 0) {
        paragraphs.push(current.join(' '));
        current = [];
        windowStart = seg.offset;
      }
      current.push(seg.text.trim());
    }
    if (current.length > 0) {
      paragraphs.push(current.join(' '));
    }

    return paragraphs.join('\n\n');
  } catch (err) {
    console.warn(`[youtube] No captions for ${videoId}:`, (err as Error).message);
    return null;
  }
}

/**
 * Extract video ID from various YouTube URL formats.
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // Could be a bare video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;

  return null;
}

/**
 * Extract channel/playlist ID from YouTube URL.
 */
export function extractChannelId(url: string): { type: 'channel' | 'playlist'; id: string } | null {
  const channelMatch = url.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
  if (channelMatch) return { type: 'channel', id: channelMatch[1] };

  const channelIdMatch = url.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
  if (channelIdMatch) return { type: 'channel', id: channelIdMatch[1] };

  const playlistMatch = url.match(/youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/);
  if (playlistMatch) return { type: 'playlist', id: playlistMatch[1] };

  return null;
}
