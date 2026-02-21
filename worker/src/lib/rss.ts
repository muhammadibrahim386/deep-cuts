import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [
      ['enclosure', 'enclosure'],
      ['itunes:duration', 'duration'],
      ['itunes:image', 'image'],
    ],
  },
});

export interface PodcastEpisode {
  guid: string;
  title: string;
  description: string | null;
  published_at: Date | null;
  duration_seconds: number | null;
  audio_url: string | null;
  thumbnail_url: string | null;
  source_url: string;
}

/**
 * Parse an RSS feed and return episode metadata.
 */
export async function parseFeed(feedUrl: string): Promise<{
  title: string;
  description: string | null;
  episodes: PodcastEpisode[];
}> {
  const feed = await parser.parseURL(feedUrl);

  const episodes: PodcastEpisode[] = (feed.items || []).map((item) => ({
    guid: item.guid || item.link || item.title || '',
    title: item.title || 'Untitled',
    description: item.contentSnippet || item.content || null,
    published_at: item.pubDate ? new Date(item.pubDate) : null,
    duration_seconds: parseDuration(item.duration as string | undefined),
    audio_url: (item.enclosure as { url?: string })?.url || null,
    thumbnail_url: (item.image as { href?: string })?.href || null,
    source_url: item.link || feedUrl,
  }));

  return {
    title: feed.title || 'Unknown Podcast',
    description: feed.description || null,
    episodes,
  };
}

function parseDuration(raw: string | undefined): number | null {
  if (!raw) return null;

  // Could be seconds as a number
  const asNum = Number(raw);
  if (!isNaN(asNum)) return Math.round(asNum);

  // Could be HH:MM:SS or MM:SS
  const parts = raw.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];

  return null;
}
