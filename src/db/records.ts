import * as Crypto from 'expo-crypto';
import type * as SQLite from 'expo-sqlite';
import type { FormSchema, FormValues } from '../schema/types';
import { pruneHidden } from '../schema/types';

export type RecordStatus = 'draft' | 'queued' | 'synced' | 'conflict';

export interface FieldRecord {
  id: string;
  schemaId: string;
  schemaVersion: number;
  data: FormValues;
  status: RecordStatus;
  baseVersion: number | null;
  conflictData: FormValues | null;
  createdAt: number;
  updatedAt: number;
}

interface RecordRow {
  id: string;
  schema_id: string;
  schema_version: number;
  data: string;
  status: RecordStatus;
  base_version: number | null;
  conflict_data: string | null;
  created_at: number;
  updated_at: number;
}

function hydrate(row: RecordRow): FieldRecord {
  return {
    id: row.id,
    schemaId: row.schema_id,
    schemaVersion: row.schema_version,
    data: JSON.parse(row.data),
    status: row.status,
    baseVersion: row.base_version,
    conflictData: row.conflict_data ? JSON.parse(row.conflict_data) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function newId(): string {
  return Crypto.randomUUID();
}

export async function createDraft(
  db: SQLite.SQLiteDatabase,
  schema: FormSchema,
  initial: FormValues = {},
): Promise<FieldRecord> {
  const id = newId();
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO records
       (id, schema_id, schema_version, data, status, base_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'draft', NULL, ?, ?)`,
    id,
    schema.id,
    schema.version,
    JSON.stringify(initial),
    now,
    now,
  );

  return {
    id,
    schemaId: schema.id,
    schemaVersion: schema.version,
    data: initial,
    status: 'draft',
    baseVersion: null,
    conflictData: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Saving a draft touches only the local row. Drafts are private to the device
 * and never sync, so a half filled form in someone's pocket never reaches the
 * office and never burns battery on retries.
 */
export async function saveDraft(
  db: SQLite.SQLiteDatabase,
  recordId: string,
  values: FormValues,
): Promise<void> {
  await db.runAsync(
    'UPDATE records SET data = ?, updated_at = ? WHERE id = ? AND status IN (?, ?)',
    JSON.stringify(values),
    Date.now(),
    recordId,
    'draft',
    'conflict',
  );
}

/**
 * Submitting flips the record to queued and appends to the outbox in one
 * transaction. Either both happen or neither does. This is the invariant the
 * whole sync design rests on: a queued record always has a matching outbox row.
 */
export async function submit(
  db: SQLite.SQLiteDatabase,
  schema: FormSchema,
  recordId: string,
  values: FormValues,
): Promise<void> {
  const clean = pruneHidden(schema, values);
  const now = Date.now();
  const json = JSON.stringify(clean);

  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ base_version: number | null }>(
      'SELECT base_version FROM records WHERE id = ?',
      recordId,
    );

    await db.runAsync(
      `UPDATE records
          SET data = ?, status = 'queued', conflict_data = NULL, updated_at = ?
        WHERE id = ?`,
      json,
      now,
      recordId,
    );

    await db.runAsync(
      `INSERT INTO outbox (record_id, op, payload, base_version, created_at)
       VALUES (?, 'upsert', ?, ?, ?)`,
      recordId,
      JSON.stringify({
        id: recordId,
        schemaId: schema.id,
        schemaVersion: schema.version,
        data: clean,
      }),
      row?.base_version ?? null,
      now,
    );
  });
}

export async function getRecord(
  db: SQLite.SQLiteDatabase,
  id: string,
): Promise<FieldRecord | null> {
  const row = await db.getFirstAsync<RecordRow>('SELECT * FROM records WHERE id = ?', id);
  return row ? hydrate(row) : null;
}

export async function listRecords(db: SQLite.SQLiteDatabase, limit = 100): Promise<FieldRecord[]> {
  const rows = await db.getAllAsync<RecordRow>(
    `SELECT * FROM records
      ORDER BY CASE status
                 WHEN 'conflict' THEN 0
                 WHEN 'draft'    THEN 1
                 WHEN 'queued'   THEN 2
                 ELSE 3
               END,
               updated_at DESC
      LIMIT ?`,
    limit,
  );
  return rows.map(hydrate);
}

export async function countByStatus(
  db: SQLite.SQLiteDatabase,
): Promise<Record<RecordStatus, number>> {
  const rows = await db.getAllAsync<{ status: RecordStatus; n: number }>(
    'SELECT status, COUNT(*) AS n FROM records GROUP BY status',
  );
  const out: Record<RecordStatus, number> = {
    draft: 0,
    queued: 0,
    synced: 0,
    conflict: 0,
  };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export async function deleteRecord(db: SQLite.SQLiteDatabase, recordId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ status: RecordStatus; base_version: number | null }>(
      'SELECT status, base_version FROM records WHERE id = ?',
      recordId,
    );
    if (!row) return;

    // The server has never seen a pure draft, so there is nothing to tell it.
    if (row.base_version !== null) {
      await db.runAsync(
        `INSERT INTO outbox (record_id, op, payload, base_version, created_at)
         VALUES (?, 'delete', ?, ?, ?)`,
        recordId,
        JSON.stringify({ id: recordId }),
        row.base_version,
        Date.now(),
      );
    }

    await db.runAsync('DELETE FROM attachments WHERE record_id = ?', recordId);
    await db.runAsync('DELETE FROM records WHERE id = ?', recordId);
  });
}
