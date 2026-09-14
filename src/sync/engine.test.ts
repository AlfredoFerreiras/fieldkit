import type * as SQLite from 'expo-sqlite';
import { openTestDb } from '../test/sqlite';
import { amendSubmitted, createDraft, getRecord, submit } from '../db/records';
import * as api from './api';
import {
  backoffMs,
  drain,
  pendingCount,
  reclaimLeases,
  resolveKeepLocal,
  resolveKeepServer,
} from './engine';
import type { FormSchema } from '../schema/types';

jest.mock('expo-crypto', () => jest.requireActual('../test/cryptoMock'));
// Never opened in tests; the in-memory sql.js database stands in for it.
jest.mock('expo-sqlite', () => ({}));

const schema: FormSchema = {
  id: 'test-form',
  version: 1,
  title: 'Test form',
  sections: [
    {
      id: 'main',
      title: 'Main',
      fields: [
        { id: 'name', type: 'text', label: 'Name' },
        { id: 'notes', type: 'longtext', label: 'Notes' },
      ],
    },
  ],
};

interface OutboxRow {
  seq: number;
  record_id: string;
  attempts: number;
  leased_at: number | null;
  last_error: string | null;
}

async function outbox(db: SQLite.SQLiteDatabase): Promise<OutboxRow[]> {
  return db.getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY seq');
}

async function submitted(db: SQLite.SQLiteDatabase, data: Record<string, unknown>) {
  const draft = await createDraft(db, schema);
  await submit(db, schema, draft.id, data);
  return draft.id;
}

// Captured before any spy is installed.
const realPush = api.pushBatch;

let db: SQLite.SQLiteDatabase;
let push: jest.SpyInstance<ReturnType<typeof api.pushBatch>, Parameters<typeof api.pushBatch>>;

beforeAll(() => {
  api.mockConfig.latencyMs = 0;
});

beforeEach(async () => {
  db = await openTestDb();
  api.mockConfig.failureRate = 0;
  api.mockConfig.conflictRate = 0;
  push = jest.spyOn(api, 'pushBatch');
});

afterEach(async () => {
  push.mockRestore();
  await db.closeAsync();
});

describe('drain', () => {
  it('sends queued mutations and marks records synced with the server version', async () => {
    const id = await submitted(db, { name: 'Unit 1' });

    expect(await drain(db)).toEqual({ sent: 1, failed: 0 });
    expect(await pendingCount(db)).toBe(0);
    expect(await getRecord(db, id)).toMatchObject({ status: 'synced', baseVersion: 1 });
  });

  it('replays mutations in the order the technician made them', async () => {
    const a = await submitted(db, { name: 'A v1' });
    const b = await submitted(db, { name: 'B v1' });
    await amendSubmitted(db, a, { name: 'A v2' });
    await amendSubmitted(db, a, { name: 'A v3' });

    await drain(db);

    const sentSeqs = push.mock.calls.flatMap(([items]) => items.map((i) => i.seq));
    expect(sentSeqs).toEqual([...sentSeqs].sort((x, y) => x - y));
    expect(sentSeqs).toHaveLength(4);

    // The two edits to A went out one at a time behind the create, each
    // carrying the version the server had just assigned, so none conflicted.
    expect(push).toHaveBeenCalledTimes(3);
    expect(await getRecord(db, a)).toMatchObject({ status: 'synced', baseVersion: 3 });
    expect(await getRecord(db, b)).toMatchObject({ status: 'synced', baseVersion: 1 });
    expect((await getRecord(db, a))?.data).toEqual({ name: 'A v3' });
  });

  it('does not show a record as synced while a newer edit is still queued', async () => {
    const id = await submitted(db, { name: 'v1' });
    await amendSubmitted(db, id, { name: 'v2' });

    // The create lands. The edit behind it dies on the wire.
    push.mockImplementationOnce(realPush).mockImplementationOnce(async () => {
      throw new Error('Network request failed');
    });

    await drain(db);

    expect(await getRecord(db, id)).toMatchObject({ status: 'queued', baseVersion: 1 });
    expect(await outbox(db)).toHaveLength(1);
  });

  it('keeps everything queued when the network is down and retries later', async () => {
    const id = await submitted(db, { name: 'Unit 1' });
    api.mockConfig.failureRate = 1;

    expect(await drain(db)).toEqual({ sent: 0, failed: 1 });

    const [row] = await outbox(db);
    expect(row).toMatchObject({
      attempts: 1,
      leased_at: null,
      last_error: 'Network request failed',
    });
    expect((await getRecord(db, id))?.status).toBe('queued');

    api.mockConfig.failureRate = 0;
    expect(await drain(db)).toEqual({ sent: 1, failed: 0 });
    expect((await getRecord(db, id))?.status).toBe('synced');
  });

  it('releases the lease on rows the server did not answer for', async () => {
    await submitted(db, { name: 'Unit 1' });
    // Server answers nothing, then the network drops, so the loop exits.
    push.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Network request failed'));

    await drain(db);

    const [row] = await outbox(db);
    expect(row.leased_at).toBeNull();
  });

  it('parks a mutation the server rejected instead of retrying forever', async () => {
    await submitted(db, { name: 'Unit 1' });
    push.mockImplementationOnce(async (items) => [
      { seq: items[0].seq, status: 'rejected', version: 0, message: 'Schema retired' },
    ]);

    expect(await drain(db)).toEqual({ sent: 0, failed: 1 });
    const [row] = await outbox(db);
    expect(row.last_error).toBe('Schema retired');

    push.mockClear();
    await drain(db);
    expect(push).not.toHaveBeenCalled();
  });

  it('does not double send a row that another request still holds', async () => {
    await submitted(db, { name: 'Unit 1' });
    await db.runAsync('UPDATE outbox SET leased_at = ?', Date.now());

    expect(await drain(db)).toEqual({ sent: 0, failed: 0 });
    expect(push).not.toHaveBeenCalled();
  });
});

describe('reclaimLeases', () => {
  it('frees rows whose lease expired because the app died mid flight', async () => {
    await submitted(db, { name: 'Unit 1' });
    await db.runAsync('UPDATE outbox SET leased_at = ?', Date.now() - 5 * 60_000);

    await reclaimLeases(db);

    const [row] = await outbox(db);
    expect(row.leased_at).toBeNull();
    expect(await drain(db)).toEqual({ sent: 1, failed: 0 });
  });
});

describe('conflicts', () => {
  async function conflicted(): Promise<string> {
    const id = await submitted(db, { name: 'local v1' });
    await drain(db);

    // Someone else edited the same record on the server.
    api.mockAdvanceServer(id, { name: 'office edit' });
    await amendSubmitted(db, id, { notes: 'from the field' });
    await drain(db);
    return id;
  }

  it('flag the record and hold the server copy instead of merging', async () => {
    const id = await conflicted();

    const record = await getRecord(db, id);
    expect(record?.status).toBe('conflict');
    expect(record?.data).toEqual({ name: 'local v1', notes: 'from the field' });
    expect(record?.conflictData).toEqual({ name: 'office edit' });
    expect(record?.baseVersion).toBe(2);
    expect(await pendingCount(db)).toBe(0);
  });

  it('keep server discards the local edit', async () => {
    const id = await conflicted();
    await resolveKeepServer(db, id);

    expect(await getRecord(db, id)).toMatchObject({
      status: 'synced',
      conflictData: null,
      data: { name: 'office edit' },
    });
  });

  it('keep local re-queues the local copy against the server version and wins', async () => {
    const id = await conflicted();
    await resolveKeepLocal(db, id);

    expect((await getRecord(db, id))?.status).toBe('queued');
    expect(await drain(db)).toEqual({ sent: 1, failed: 0 });
    expect(await getRecord(db, id)).toMatchObject({
      status: 'synced',
      baseVersion: 3,
      data: { name: 'local v1', notes: 'from the field' },
    });
  });
});

describe('backoffMs', () => {
  it('grows exponentially with jitter and caps at five minutes', () => {
    for (let i = 0; i < 20; i++) {
      const ms = backoffMs(i);
      const base = Math.min(1000 * 2 ** i, 5 * 60_000);
      expect(ms).toBeGreaterThanOrEqual(base * 0.5);
      expect(ms).toBeLessThanOrEqual(base);
    }
  });
});
