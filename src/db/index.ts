import * as SQLite from 'expo-sqlite';

/**
 * The device database is the source of truth for the device. The server is a
 * peer that we reconcile with, not an authority we read through. Every screen
 * reads from SQLite and never waits on the network.
 */

export const DB_NAME = 'fieldkit.db';

/**
 * Migrations run in order, tracked by PRAGMA user_version. Never edit a
 * migration that has shipped. Append a new one instead. Field devices go
 * months between updates and will jump several versions at once.
 */
const MIGRATIONS: ((db: SQLite.SQLiteDatabase) => Promise<void>)[] = [
  async (db) => {
    await db.execAsync(`
      CREATE TABLE schemas (
        id            TEXT NOT NULL,
        version       INTEGER NOT NULL,
        json          TEXT NOT NULL,
        installed_at  INTEGER NOT NULL,
        PRIMARY KEY (id, version)
      );

      CREATE TABLE records (
        -- Client generated UUID. The client owns identity, so a record created
        -- offline keeps the same id forever and never needs an id rewrite.
        id             TEXT PRIMARY KEY NOT NULL,
        schema_id      TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        data           TEXT NOT NULL,
        -- draft | queued | synced | conflict
        status         TEXT NOT NULL DEFAULT 'draft',
        -- Server version this record was last reconciled against. NULL means
        -- the server has never seen it.
        base_version   INTEGER,
        -- Server payload we could not merge, held until a human resolves it.
        conflict_data  TEXT,
        created_at     INTEGER NOT NULL,
        updated_at     INTEGER NOT NULL
      );

      CREATE INDEX idx_records_status ON records (status, updated_at DESC);

      -- Append only mutation log. Order is the ordering guarantee: mutations
      -- replay against the server in exactly the order the tech made them.
      CREATE TABLE outbox (
        seq          INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id    TEXT NOT NULL,
        op           TEXT NOT NULL,          -- upsert | delete
        payload      TEXT NOT NULL,
        base_version INTEGER,
        attempts     INTEGER NOT NULL DEFAULT 0,
        last_error   TEXT,
        -- Set when the row is handed to an in flight request, so a crash mid
        -- flight does not lose it and a retry does not double send.
        leased_at    INTEGER,
        created_at   INTEGER NOT NULL
      );

      CREATE INDEX idx_outbox_record ON outbox (record_id, seq);

      CREATE TABLE attachments (
        id         TEXT PRIMARY KEY NOT NULL,
        record_id  TEXT NOT NULL,
        field_id   TEXT NOT NULL,
        local_uri  TEXT NOT NULL,
        remote_url TEXT,
        bytes      INTEGER,
        -- pending | uploading | uploaded | failed
        status     TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL
      );

      CREATE INDEX idx_attachments_record ON attachments (record_id);
      CREATE INDEX idx_attachments_status ON attachments (status);

      CREATE TABLE meta (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );
    `);
  },
];

export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);
  return db;
}

export async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;

  while (current < MIGRATIONS.length) {
    const next = MIGRATIONS[current];
    await db.withTransactionAsync(async () => {
      await next(db);
    });
    current += 1;
    // PRAGMA does not accept bound parameters.
    await db.execAsync(`PRAGMA user_version = ${current}`);
  }
}

export async function getMeta(
  db: SQLite.SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM meta WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setMeta(
  db: SQLite.SQLiteDatabase,
  key: string,
  value: string | null,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
