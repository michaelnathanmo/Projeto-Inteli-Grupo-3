import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'inteli-camp.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      requester TEXT NOT NULL,
      business_unit TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'RASCUNHO',
      current_version_id INTEGER,
      marketing_submitted_version_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      version_number INTEGER NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      created_by TEXT NOT NULL,
      change_description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS marketing_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      reviewed_version_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      general_comments TEXT,
      positive_points TEXT,
      attention_points TEXT,
      recommendations TEXT,
      communication_suggestions TEXT,
      image_risks TEXT,
      audience_considerations TEXT,
      requester_response TEXT,
      has_considerations INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (reviewed_version_id) REFERENCES project_versions(id)
    );

    CREATE TABLE IF NOT EXISTS management_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      evaluated_version_id INTEGER NOT NULL,
      manager TEXT NOT NULL,
      decision TEXT NOT NULL,
      justification TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (evaluated_version_id) REFERENCES project_versions(id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      sender TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
