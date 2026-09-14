import type * as SQLite from 'expo-sqlite';
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { migrate } from '../db';

/**
 * In-memory SQLite for tests, backed by sql.js (pure JavaScript, no native
 * build). Implements the subset of expo-sqlite's async API the app uses, so
 * the real migrations, record store, and sync engine run unchanged against it.
 */

// The asm.js build avoids wasm loading quirks under Jest.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const initSqlJs: () => Promise<SqlJsStatic> = require('sql.js/dist/sql-asm.js');

let sqlPromise: Promise<SqlJsStatic> | null = null;

function flatten(params: unknown[]): SqlValue[] {
  // expo-sqlite accepts either variadic params or a single array.
  const list = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
  return list.map((p) => (p === undefined ? null : (p as SqlValue)));
}

class TestDatabase {
  constructor(private readonly db: Database) {}

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<SQLite.SQLiteRunResult> {
    this.db.run(sql, flatten(params));
    const changes = this.db.getRowsModified();
    const row = this.db.exec('SELECT last_insert_rowid() AS id')[0];
    return { changes, lastInsertRowId: Number(row?.values[0]?.[0] ?? 0) };
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(flatten(params));
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, ...params);
    return rows[0] ?? null;
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await task();
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async closeAsync(): Promise<void> {
    this.db.close();
  }
}

/** A fresh, fully migrated database. Each test should open its own. */
export async function openTestDb(): Promise<SQLite.SQLiteDatabase> {
  sqlPromise ??= initSqlJs();
  const SQL = await sqlPromise;
  const db = new TestDatabase(new SQL.Database()) as unknown as SQLite.SQLiteDatabase;
  await migrate(db);
  return db;
}
