import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Job } from '../types/database.js';
import type { JobType } from '../types/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'queue.db');

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    const dataDir = path.dirname(DB_PATH);
    fs.mkdirSync(dataDir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        type         TEXT NOT NULL,
        payload      TEXT NOT NULL,
        status       TEXT DEFAULT 'pending',
        attempts     INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        error        TEXT,
        created_at   TEXT DEFAULT (datetime('now')),
        started_at   TEXT,
        completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
    `);
  }
  return db;
}

export function enqueue(type: JobType, payload: Record<string, unknown>): number {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO jobs (type, payload) VALUES (?, ?)'
  );
  const result = stmt.run(type, JSON.stringify(payload));
  return result.lastInsertRowid as number;
}

export function dequeue(): Job | null {
  const db = getDb();
  const job = db.prepare(`
    SELECT * FROM jobs
    WHERE status = 'pending' AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT 1
  `).get() as Job | undefined;

  if (!job) return null;

  db.prepare(`
    UPDATE jobs SET status = 'running', attempts = attempts + 1, started_at = datetime('now')
    WHERE id = ?
  `).run(job.id);

  return { ...job, status: 'running', attempts: job.attempts + 1 };
}

export function complete(id: number): void {
  const db = getDb();
  db.prepare(`
    UPDATE jobs SET status = 'complete', completed_at = datetime('now')
    WHERE id = ?
  `).run(id);
}

export function fail(id: number, error: string): void {
  const db = getDb();
  const job = db.prepare('SELECT attempts, max_attempts FROM jobs WHERE id = ?').get(id) as Pick<Job, 'attempts' | 'max_attempts'> | undefined;

  const newStatus = job && job.attempts >= job.max_attempts ? 'error' : 'pending';
  db.prepare(`
    UPDATE jobs SET status = ?, error = ?, completed_at = CASE WHEN ? = 'error' THEN datetime('now') ELSE NULL END
    WHERE id = ?
  `).run(newStatus, error, newStatus, id);
}

export function stats(): { pending: number; running: number; complete: number; error: number } {
  const db = getDb();
  const rows = db.prepare(`
    SELECT status, COUNT(*) as count FROM jobs GROUP BY status
  `).all() as Array<{ status: string; count: number }>;

  const result = { pending: 0, running: 0, complete: 0, error: 0 };
  for (const row of rows) {
    if (row.status in result) {
      result[row.status as keyof typeof result] = row.count;
    }
  }
  return result;
}

export function close(): void {
  if (db) db.close();
}
