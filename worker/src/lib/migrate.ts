import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { close, query } from './db.js'

dotenv.config({ path: new URL('../../.env', import.meta.url).pathname })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations')

async function migrate() {
  console.log('[migrate] Running migrations...')

  // Create migrations tracking table
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `)

  // Get applied migrations
  const applied = await query<{ name: string }>('SELECT name FROM _migrations ORDER BY name')
  const appliedSet = new Set(applied.rows.map((r) => r.name))

  // Get migration files
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`[migrate] Skipping ${file} (already applied)`)
      continue
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
    console.log(`[migrate] Applying ${file}...`)

    try {
      await query(sql)
      await query('INSERT INTO _migrations (name) VALUES ($1)', [file])
      console.log(`[migrate] Applied ${file}`)
    } catch (err) {
      console.error(`[migrate] Failed on ${file}:`, err)
      process.exit(1)
    }
  }

  console.log('[migrate] Done.')
  await close()
}

migrate()
