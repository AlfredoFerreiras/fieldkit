import type * as SQLite from 'expo-sqlite';
import { pushBatch, type PushResult } from './api';

/**
 * Sync engine.
 *
 * Design decisions worth defending:
 *
 * 1. The outbox is an ordered log, not a set of dirty rows. Replaying in order
 *    means the server sees the same sequence of intents the technician made,
 *    so an edit that follows a create can never arrive first.
 *
 * 2. Rows are leased before the request goes out. If the app is killed mid
 *    flight we do not know whether the server applied the batch, so on restart
 *    we reclaim expired leases and resend. The server dedupes on (record_id,
 *    seq), which makes the whole pipeline idempotent and lets us choose at
 *    least once delivery instead of at most once. Losing an inspection is
 *    worse than applying one twice.
 *
 * 3. Conflicts are detected with a version check, not a timestamp. Device
 *    clocks in the field are wrong often enough that last write wins on
 *    wall clock silently destroys data.
 *
 * 4. A conflict never resolves itself. The record is flagged and the server
 *    copy is held alongside the local copy until a human picks. Automatic
 *    merging of an inspection report is how you end up certifying a unit
 *    nobody looked at.
 */

const BATCH_SIZE = 25;
const LEASE_MS = 60_000;
const MAX_ATTEMPTS = 8;

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  pending: number;
  lastSyncAt: number | null;
  lastError: string | null;
}

interface OutboxRow {
  seq: number;
  record_id: string;
  op: 'upsert' | 'delete';
  payload: string;
  base_version: number | null;
  attempts: number;
}

/** Exponential backoff with jitter, so a fleet of devices does not stampede a
 *  recovering server the moment the depot wifi comes back. */
export function backoffMs(attempts: number): number {
  const base = Math.min(1000 * 2 ** attempts, 5 * 60_000);
  return base * (0.5 + Math.random() * 0.5);
}

export async function pendingCount(db: SQLite.SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
  return row?.n ?? 0;
}

/** Reclaim rows whose lease expired because the app died mid flight. */
export async function reclaimLeases(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync(
    'UPDATE outbox SET leased_at = NULL WHERE leased_at IS NOT NULL AND leased_at < ?',
    Date.now() - LEASE_MS,
  );
}

async function claimBatch(db: SQLite.SQLiteDatabase): Promise<OutboxRow[]> {
  const now = Date.now();
  let claimed: OutboxRow[] = [];

  await db.withTransactionAsync(async () => {
    claimed = await db.getAllAsync<OutboxRow>(
      `SELECT seq, record_id, op, payload, base_version, attempts
         FROM outbox
        WHERE leased_at IS NULL
          AND attempts < ?
        ORDER BY seq ASC
        LIMIT ?`,
      MAX_ATTEMPTS,
      BATCH_SIZE,
    );

    if (claimed.length > 0) {
      const marks = claimed.map(() => '?').join(',');
      await db.runAsync(
        `UPDATE outbox SET leased_at = ? WHERE seq IN (${marks})`,
        now,
        ...claimed.map((r) => r.seq),
      );
    }
  });

  return claimed;
}

async function applyResults(
  db: SQLite.SQLiteDatabase,
  batch: OutboxRow[],
  results: PushResult[],
): Promise<void> {
  const bySeq = new Map(results.map((r) => [r.seq, r]));

  await db.withTransactionAsync(async () => {
    for (const row of batch) {
      const result = bySeq.get(row.seq);

      // Server said nothing about this row. Release the lease and let the next
      // pass retry it rather than guessing.
      if (!result) {
        await db.runAsync('UPDATE outbox SET leased_at = NULL WHERE seq = ?', row.seq);
        continue;
      }

      if (result.status === 'applied') {
        await db.runAsync('DELETE FROM outbox WHERE seq = ?', row.seq);

        // Only mark the record synced if nothing newer is still queued for it.
        // Otherwise the tech sees a green check while an edit is still in
        // flight, which is a lie the UI should never tell.
        const remaining = await db.getFirstAsync<{ n: number }>(
          'SELECT COUNT(*) AS n FROM outbox WHERE record_id = ?',
          row.record_id,
        );
        await db.runAsync(
          `UPDATE records
              SET base_version = ?,
                  status = CASE WHEN ? = 0 THEN 'synced' ELSE status END,
                  updated_at = updated_at
            WHERE id = ?`,
          result.version,
          remaining?.n ?? 0,
          row.record_id,
        );
        continue;
      }

      if (result.status === 'conflict') {
        // Drop every queued mutation for this record. Replaying them on top of
        // a server state we have not seen would compound the divergence.
        await db.runAsync('DELETE FROM outbox WHERE record_id = ?', row.record_id);
        await db.runAsync(
          `UPDATE records
              SET status = 'conflict',
                  conflict_data = ?,
                  base_version = ?
            WHERE id = ?`,
          JSON.stringify(result.serverData ?? {}),
          result.version,
          row.record_id,
        );
        continue;
      }

      // Rejected outright, for example a schema the server retired. Retrying
      // will never help, so park it rather than looping forever.
      if (result.status === 'rejected') {
        await db.runAsync(
          'UPDATE outbox SET leased_at = NULL, attempts = ?, last_error = ? WHERE seq = ?',
          MAX_ATTEMPTS,
          result.message ?? 'Rejected by server',
          row.seq,
        );
        continue;
      }

      // Transient failure.
      await db.runAsync(
        'UPDATE outbox SET leased_at = NULL, attempts = attempts + 1, last_error = ? WHERE seq = ?',
        result.message ?? 'Temporary failure',
        row.seq,
      );
    }
  });
}

/**
 * Drain the outbox. Safe to call from anywhere, including on a timer, on
 * reconnect, and from a background task. Returns when there is nothing left
 * to send or the network gives up.
 */
export async function drain(db: SQLite.SQLiteDatabase): Promise<{ sent: number; failed: number }> {
  await reclaimLeases(db);

  let sent = 0;
  let failed = 0;

  for (;;) {
    const batch = await claimBatch(db);
    if (batch.length === 0) break;

    try {
      const results = await pushBatch(
        batch.map((r) => ({
          seq: r.seq,
          recordId: r.record_id,
          op: r.op,
          baseVersion: r.base_version,
          payload: JSON.parse(r.payload),
        })),
      );
      await applyResults(db, batch, results);
      sent += results.filter((r) => r.status === 'applied').length;
      failed += results.filter((r) => r.status !== 'applied').length;
    } catch (err) {
      // Whole request failed, most likely no network. Release leases and stop.
      const message = err instanceof Error ? err.message : String(err);
      const marks = batch.map(() => '?').join(',');
      await db.runAsync(
        `UPDATE outbox
            SET leased_at = NULL, attempts = attempts + 1, last_error = ?
          WHERE seq IN (${marks})`,
        message,
        ...batch.map((r) => r.seq),
      );
      failed += batch.length;
      break;
    }
  }

  return { sent, failed };
}

/** Keep the local copy, overwrite the server. */
export async function resolveKeepLocal(db: SQLite.SQLiteDatabase, recordId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{
      data: string;
      base_version: number | null;
      schema_id: string;
      schema_version: number;
    }>('SELECT data, base_version, schema_id, schema_version FROM records WHERE id = ?', recordId);
    if (!row) return;

    await db.runAsync(
      `UPDATE records SET status = 'queued', conflict_data = NULL WHERE id = ?`,
      recordId,
    );
    await db.runAsync(
      `INSERT INTO outbox (record_id, op, payload, base_version, created_at)
       VALUES (?, 'upsert', ?, ?, ?)`,
      recordId,
      JSON.stringify({
        id: recordId,
        schemaId: row.schema_id,
        schemaVersion: row.schema_version,
        data: JSON.parse(row.data),
      }),
      row.base_version,
      Date.now(),
    );
  });
}

/** Discard the local copy and take the server's. */
export async function resolveKeepServer(
  db: SQLite.SQLiteDatabase,
  recordId: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE records
        SET data = COALESCE(conflict_data, data),
            conflict_data = NULL,
            status = 'synced',
            updated_at = ?
      WHERE id = ?`,
    Date.now(),
    recordId,
  );
}
