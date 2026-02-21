import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { ExtractResultSchema, ConnectResultSchema } from '../types/schema.js';
import type { ExtractResult, ConnectResult } from '../types/schema.js';

dotenv.config({ path: new URL('../../.env', import.meta.url).pathname });

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const EXTRACT_SYSTEM = `You are a media analysis engine. Given a transcript and metadata for a video or podcast episode, produce a structured JSON analysis.

Your output MUST be valid JSON matching this exact schema:
{
  "tldr": "1-3 sentence summary",
  "keywords": [{ "term": "...", "weight": 0.0-1.0, "category": "..." }],
  "categories": ["Technology", "Philosophy", ...],
  "entities": [{ "name": "...", "type": "person|org|concept|place|work", "mentions": N }],
  "quotes": [{ "text": "...", "speaker": "...|null", "timestamp_approx": "...|null" }],
  "data_points": [{ "claim": "...", "value": "...|null", "context": "..." }],
  "sentiment": "analytical|conversational|passionate|critical|exploratory|humorous",
  "topics_discussed": ["..."],
  "infographic_suggestion": {
    "template": "timeline|stat-card|topic-web|comparison|quote-highlight|data-grid|flow",
    "rationale": "why this template fits",
    "key_data": { ... }
  }
}

Categories must come from: Technology, Philosophy, Science, Culture, Politics, Economics, Psychology, Art & Design, Music, Health, History, Education, Spirituality, Environment, Media & Communication.

Return ONLY the JSON object, no markdown fences, no commentary.`;

const CONNECT_SYSTEM = `You are a knowledge graph builder. Given summaries and keywords from multiple episodes, identify thought threads (recurring themes that evolve across episodes), bridges (direct connections between specific episodes), and emerging themes.

Your output MUST be valid JSON matching this schema:
{
  "threads": [{
    "name": "thread name",
    "description": "what this thread is about",
    "episode_ids": ["id1", "id2"],
    "evolution": "how the idea develops across these episodes"
  }],
  "bridges": [{
    "from_episode": "id",
    "to_episode": "id",
    "relationship": "description of connection",
    "strength": 0.0-1.0
  }],
  "emerging_themes": ["themes appearing but not yet fully formed"]
}

Return ONLY the JSON object, no markdown fences, no commentary.`;

export async function extract(
  title: string,
  description: string | null,
  transcript: string
): Promise<ExtractResult> {
  const userPrompt = `Episode: "${title}"
${description ? `Description: ${description}\n` : ''}
Transcript:
${transcript}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 4096,
    system: EXTRACT_SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = JSON.parse(text);
  return ExtractResultSchema.parse(parsed);
}

export async function connect(
  episodes: Array<{ id: string; title: string; tldr: string; keywords: string[] }>
): Promise<ConnectResult> {
  const userPrompt = `Analyze these episodes for thought threads and connections:

${episodes.map((ep) => `- [${ep.id}] "${ep.title}"\n  TLDR: ${ep.tldr}\n  Keywords: ${ep.keywords.join(', ')}`).join('\n\n')}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 4096,
    system: CONNECT_SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = JSON.parse(text);
  return ConnectResultSchema.parse(parsed);
}
