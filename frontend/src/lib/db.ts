import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
})

export async function query<T extends pg.QueryResultRow>(text: string, params?: unknown[]): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params)
}

export async function semanticSearch(
  queryEmbedding: number[],
  limit = 10,
): Promise<Array<{ episode_id: string; chunk_text: string; similarity: number }>> {
  const vectorStr = `[${queryEmbedding.join(',')}]`
  const result = await pool.query(
    `SELECT episode_id, chunk_text,
            1 - (embedding <=> $1::vector) as similarity
     FROM embeddings
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [vectorStr, limit],
  )
  return result.rows
}
