import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../.env', import.meta.url).pathname });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHUNK_SIZE = 512; // tokens, approximate
const CHUNK_OVERLAP = 64;

/**
 * Split text into overlapping chunks for embedding.
 * Uses word-based splitting as a proxy for token boundaries.
 */
export function chunkText(text: string): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  // Rough approximation: 1 token ≈ 0.75 words for English
  const wordsPerChunk = Math.floor(CHUNK_SIZE * 0.75);
  const overlapWords = Math.floor(CHUNK_OVERLAP * 0.75);

  for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
    const chunk = words.slice(i, i + wordsPerChunk).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

/**
 * Generate embeddings for an array of text chunks.
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 */
export async function generateEmbeddings(
  chunks: string[]
): Promise<number[][]> {
  if (chunks.length === 0) return [];

  // OpenAI supports batch embedding
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: chunks,
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}
