import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'gitlens.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    snapshot TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_analyses_repo_path_created_at ON analyses (repo_path, created_at DESC);
`);

export function saveAnalysis(repoPath: string, snapshot: any) {
  const stmt = db.prepare('INSERT INTO analyses (repo_path, snapshot) VALUES (?, ?)');
  const info = stmt.run(repoPath, JSON.stringify(snapshot));
  return info.lastInsertRowid;
}

export function getHistory(repoPath: string, limit: number = 10) {
  const stmt = db.prepare('SELECT * FROM analyses WHERE repo_path = ? ORDER BY created_at DESC LIMIT ?');
  const rows = stmt.all(repoPath, limit) as any[];
  return rows.map(row => ({
    ...row,
    snapshot: JSON.parse(row.snapshot)
  }));
}

export default db;
