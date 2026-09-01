import * as Crypto from 'expo-crypto';
import type * as SQLite from 'expo-sqlite';

export interface ChatMessage {
  id: string;
  authorId: string;
  author: string;
  role: string;
  body: string;
  createdAt: number;
}

interface MessageRow {
  id: string;
  author_id: string;
  author: string;
  role: string;
  body: string;
  created_at: number;
}

export async function listMessages(
  db: SQLite.SQLiteDatabase,
  limit = 200,
): Promise<ChatMessage[]> {
  const rows = await db.getAllAsync<MessageRow>(
    'SELECT * FROM messages ORDER BY created_at DESC LIMIT ?',
    limit,
  );
  return rows.map((row) => ({
    id: row.id,
    authorId: row.author_id,
    author: row.author,
    role: row.role,
    body: row.body,
    createdAt: row.created_at,
  }));
}

export async function sendMessage(
  db: SQLite.SQLiteDatabase,
  author: { id: string; name: string; role: string },
  body: string,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO messages (id, author_id, author, role, body, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    Crypto.randomUUID(),
    author.id,
    author.name,
    author.role,
    body,
    Date.now(),
  );
}
