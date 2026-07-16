import { getDb } from './db.js';

export function getMessages(projectId) {
  const db = getDb();
  if (projectId) {
    return db.prepare(`
      SELECT id, project_id as projectId, sender, sender_role as senderRole, message, created_at as createdAt
      FROM chat_messages
      WHERE project_id = ?
      ORDER BY created_at ASC
    `).all(projectId);
  }
  return db.prepare(`
    SELECT id, project_id as projectId, sender, sender_role as senderRole, message, created_at as createdAt
    FROM chat_messages
    WHERE project_id IS NULL
    ORDER BY created_at ASC
  `).all();
}

export function sendMessage({ projectId, sender, senderRole, message }) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO chat_messages (project_id, sender, sender_role, message)
    VALUES (?, ?, ?, ?)
  `).run(projectId || null, sender, senderRole, message);
  return {
    id: result.lastInsertRowid,
    projectId: projectId || null,
    sender,
    senderRole,
    message,
    createdAt: new Date().toISOString(),
  };
}
