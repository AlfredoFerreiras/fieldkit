import * as Crypto from 'expo-crypto';
import type * as SQLite from 'expo-sqlite';

/**
 * Accounts live in SQLite like everything else, so users created on the
 * device survive restarts and ride along when the office server arrives.
 *
 * PINs are stored as salted SHA-256 hashes. Honest scope note: a 4-digit PIN
 * hash on a device someone holds is a speed bump, not a vault. It exists so
 * PINs are never readable in the database file, and so the server swap-in
 * (tokens in expo-secure-store, server-checked credentials) changes this
 * module and nothing else.
 */

export type Role = 'supervisor' | 'manager' | 'customer';

export interface Account {
  id: string;
  name: string;
  role: Role;
  phone: string;
  email: string;
}

interface AccountRow {
  id: string;
  name: string;
  role: Role;
  phone: string;
  email: string;
  pin_hash: string;
  pin_salt: string;
}

/** First-run accounts, so the app is usable per role out of the box. Same ids
 *  as the old hardcoded list, so records created before the accounts table
 *  keep their owners. */
export const SEED_ACCOUNTS: (Account & { pin: string })[] = [
  {
    id: 'sup-1',
    name: 'Alfredo',
    role: 'supervisor',
    pin: '1111',
    phone: '+15550100',
    email: 'supervisor@example.com',
  },
  {
    id: 'mgr-1',
    name: 'Maria',
    role: 'manager',
    pin: '2222',
    phone: '+15550101',
    email: 'maria@example.com',
  },
  {
    id: 'mgr-2',
    name: 'James',
    role: 'manager',
    pin: '3333',
    phone: '+15550102',
    email: 'james@example.com',
  },
  {
    id: 'cust-1',
    name: 'Ana Torres',
    role: 'customer',
    pin: '0000',
    phone: '+15550103',
    email: 'ana@example.com',
  },
];

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

function toAccount(row: AccountRow): Account {
  return { id: row.id, name: row.name, role: row.role, phone: row.phone, email: row.email };
}

/** Called from the migration that creates the accounts table. */
export async function seedAccounts(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const seed of SEED_ACCOUNTS) {
    const salt = Crypto.randomUUID();
    await db.runAsync(
      `INSERT INTO accounts (id, name, role, pin_hash, pin_salt, phone, email, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      seed.id,
      seed.name,
      seed.role,
      await hashPin(seed.pin, salt),
      salt,
      seed.phone,
      seed.email,
      Date.now(),
    );
  }
}

/** Staff first, then customers, alphabetical inside each role. */
export async function listAccounts(db: SQLite.SQLiteDatabase): Promise<Account[]> {
  const rows = await db.getAllAsync<AccountRow>(
    `SELECT * FROM accounts
      ORDER BY CASE role
                 WHEN 'supervisor' THEN 0
                 WHEN 'manager'    THEN 1
                 ELSE 2
               END,
               name COLLATE NOCASE`,
  );
  return rows.map(toAccount);
}

export async function getAccount(
  db: SQLite.SQLiteDatabase,
  id: string,
): Promise<Account | null> {
  const row = await db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', id);
  return row ? toAccount(row) : null;
}

/** Returns the account when the PIN matches, null otherwise. */
export async function verifyPin(
  db: SQLite.SQLiteDatabase,
  accountId: string,
  pin: string,
): Promise<Account | null> {
  const row = await db.getFirstAsync<AccountRow>(
    'SELECT * FROM accounts WHERE id = ?',
    accountId,
  );
  if (!row) return null;
  const hash = await hashPin(pin, row.pin_salt);
  return hash === row.pin_hash ? toAccount(row) : null;
}

export interface NewAccount {
  name: string;
  role: Role;
  pin: string;
  phone?: string;
  email?: string;
}

export async function createAccount(
  db: SQLite.SQLiteDatabase,
  input: NewAccount,
): Promise<Account> {
  const account: Account = {
    id: Crypto.randomUUID(),
    name: input.name.trim(),
    role: input.role,
    phone: input.phone?.trim() ?? '',
    email: input.email?.trim() ?? '',
  };
  const salt = Crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO accounts (id, name, role, pin_hash, pin_salt, phone, email, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    account.id,
    account.name,
    account.role,
    await hashPin(input.pin, salt),
    salt,
    account.phone,
    account.email,
    Date.now(),
  );
  return account;
}
