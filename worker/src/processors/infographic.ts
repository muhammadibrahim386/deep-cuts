import { query } from '../lib/db.js';
import type { Episode } from '../types/database.js';

// Template types that the LLM can suggest
export type InfographicTemplate =
  | 'timeline'
  | 'stat-card'
  | 'topic-web'
  | 'comparison'
  | 'quote-highlight'
  | 'data-grid'
  | 'flow';

/**
 * Prepare infographic data for an episode based on LLM analysis.
 * The actual SVG rendering happens in the frontend (Satori JSX → SVG).
 */
export async function prepareInfographic(episodeId: string): Promise<void> {
  const result = await query<Episode>('SELECT * FROM episodes WHERE id = $1', [episodeId]);
  const episode = result.rows[0];
  if (!episode) throw new Error(`Episode not found: ${episodeId}`);
  if (!episode.analysis) throw new Error(`No analysis for episode: ${episodeId}`);

  const analysis = episode.analysis as {
    infographic_suggestion?: {
      template: InfographicTemplate;
      rationale: string;
      key_data: Record<string, unknown>;
    };
    tldr?: string;
    keywords?: Array<{ term: string; weight: number }>;
    quotes?: Array<{ text: string; speaker: string | null }>;
    data_points?: Array<{ claim: string; value: string | null }>;
    entities?: Array<{ name: string; type: string; mentions: number }>;
  };

  const suggestion = analysis.infographic_suggestion;
  if (!suggestion) {
    console.warn(`[infographic] No template suggestion for "${episode.title}"`);
    return;
  }

  // Extract dominant color from thumbnail
  let dominantColor = episode.dominant_color;
  if (!dominantColor && episode.thumbnail_url) {
    dominantColor = await extractDominantColor(episode.thumbnail_url);
    if (dominantColor) {
      await query('UPDATE episodes SET dominant_color = $1 WHERE id = $2', [dominantColor, episodeId]);
    }
  }

  // Build template-specific data
  const infographicData = {
    template: suggestion.template,
    episode_title: episode.title,
    tldr: analysis.tldr || episode.tldr,
    dominant_color: dominantColor || '#1a1a2e',
    thumbnail_url: episode.thumbnail_url,
    ...buildTemplateData(suggestion.template, analysis, suggestion.key_data),
  };

  // Store infographic metadata
  await query(
    `INSERT INTO infographics (episode_id, template, data)
     VALUES ($1, $2, $3)
     ON CONFLICT (episode_id) DO UPDATE SET template = $2, data = $3`,
    [episodeId, suggestion.template, JSON.stringify(infographicData)]
  );

  console.log(`[infographic] Prepared ${suggestion.template} for "${episode.title}"`);
}

function buildTemplateData(
  template: InfographicTemplate,
  analysis: Record<string, unknown>,
  keyData: Record<string, unknown>
): Record<string, unknown> {
  switch (template) {
    case 'stat-card':
      return {
        data_points: (analysis.data_points as Array<{ claim: string; value: string | null }>) || [],
        hero_stat: keyData.hero_stat || null,
      };

    case 'quote-highlight':
      return {
        quotes: ((analysis.quotes as Array<{ text: string; speaker: string | null }>) || []).slice(0, 3),
      };

    case 'topic-web':
      return {
        keywords: ((analysis.keywords as Array<{ term: string; weight: number }>) || []).slice(0, 12),
        entities: ((analysis.entities as Array<{ name: string; type: string }>) || []).slice(0, 8),
      };

    case 'timeline':
    case 'comparison':
    case 'data-grid':
    case 'flow':
      return { key_data: keyData };

    default:
      return { key_data: keyData };
  }
}

/**
 * Extract dominant color from a thumbnail URL.
 * Uses sharp to analyze the image.
 */
async function extractDominantColor(imageUrl: string): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default;
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    const { dominant } = await sharp(buffer).stats();
    const hex = `#${dominant.r.toString(16).padStart(2, '0')}${dominant.g.toString(16).padStart(2, '0')}${dominant.b.toString(16).padStart(2, '0')}`;
    return hex;
  } catch (err) {
    console.warn('[infographic] Color extraction failed:', (err as Error).message);
    return null;
  }
}
