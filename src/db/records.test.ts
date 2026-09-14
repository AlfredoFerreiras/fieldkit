import type * as SQLite from 'expo-sqlite';
import { openTestDb } from '../test/sqlite';
import { SEED_ACCOUNTS, listAccounts, verifyPin } from '../auth/accounts';
import { createDraft, deleteRecord, getRecord, saveDraft, submit } from './records';
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
        { id: 'name', type: 'text', label: 'Name', required: true },
        { id: 'damaged', type: 'boolean', label: 'Damaged?' },
        {
          id: 'damage_notes',
          type: 'longtext',
          label: 'Notes',
          visibleWhen: { field: 'damaged', equals: true },
        },
      ],
    },
  ],
};

interface OutboxRow {
  record_id: string;
  op: string;
  payload: string;
  base_version: number | null;
}

async function outbox(db: SQLite.SQLiteDatabase): Promise<OutboxRow[]> {
  return db.getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY seq');
}

let db: SQLite.SQLiteDatabase;

beforeEach(async () => {
  db = await openTestDb();
});

afterEach(async () => {
  await db.closeAsync();
});

describe('migrations', () => {
  it('bring a fresh database to the latest version', async () => {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(3);
  });

  it('seed the demo accounts with hashed pins', async () => {
    const accounts = await listAccounts(db);
    expect(accounts.map((a) => a.id).sort()).toEqual(SEED_ACCOUNTS.map((a) => a.id).sort());

    const stored = await db.getFirstAsync<{ pin_hash: string }>(
      'SELECT pin_hash FROM accounts WHERE id = ?',
      'sup-1',
    );
    expect(stored?.pin_hash).not.toBe('1111');
    expect(await verifyPin(db, 'sup-1', '1111')).toMatchObject({ id: 'sup-1' });
    expect(await verifyPin(db, 'sup-1', '9999')).toBeNull();
  });
});

describe('drafts', () => {
  it('never reach the outbox', async () => {
    const draft = await createDraft(db, schema, {}, 'sup-1');
    await saveDraft(db, draft.id, { name: 'half filled' });

    expect(await outbox(db)).toEqual([]);
    expect((await getRecord(db, draft.id))?.status).toBe('draft');
  });

  it('cannot overwrite a record that is already queued', async () => {
    const draft = await createDraft(db, schema);
    await submit(db, schema, draft.id, { name: 'final' });
    await saveDraft(db, draft.id, { name: 'stale edit' });

    expect((await getRecord(db, draft.id))?.data).toEqual({ name: 'final' });
  });
});

describe('submit', () => {
  it('queues the record and appends exactly one outbox row together', async () => {
    const draft = await createDraft(db, schema);
    await submit(db, schema, draft.id, { name: 'Unit 4B' });

    const record = await getRecord(db, draft.id);
    expect(record?.status).toBe('queued');
    expect(record?.baseVersion).toBeNull();

    const rows = await outbox(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ record_id: draft.id, op: 'upsert', base_version: null });
    expect(JSON.parse(rows[0].payload)).toEqual({
      id: draft.id,
      schemaId: 'test-form',
      schemaVersion: 1,
      data: { name: 'Unit 4B' },
    });
  });

  it('drops values for fields the schema hides', async () => {
    const draft = await createDraft(db, schema);
    await submit(db, schema, draft.id, {
      name: 'Unit 4B',
      damaged: false,
      damage_notes: 'should not survive',
    });

    const rows = await outbox(db);
    expect(JSON.parse(rows[0].payload).data).toEqual({ name: 'Unit 4B', damaged: false });
    expect((await getRecord(db, draft.id))?.data).toEqual({ name: 'Unit 4B', damaged: false });
  });
});

describe('deleteRecord', () => {
  it('tells the server nothing about a record it has never seen', async () => {
    const draft = await createDraft(db, schema);
    await deleteRecord(db, draft.id);

    expect(await getRecord(db, draft.id)).toBeNull();
    expect(await outbox(db)).toEqual([]);
  });

  it('enqueues a delete for a record the server holds', async () => {
    const draft = await createDraft(db, schema);
    await db.runAsync(
      `UPDATE records SET status = 'synced', base_version = 3 WHERE id = ?`,
      draft.id,
    );
    await deleteRecord(db, draft.id);

    expect(await outbox(db)).toEqual([
      expect.objectContaining({ record_id: draft.id, op: 'delete', base_version: 3 }),
    ]);
  });
});
