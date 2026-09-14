import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type * as SQLite from 'expo-sqlite';
import { getMeta, setMeta } from '../db';
import {
  createAccount,
  getAccount,
  listAccounts,
  verifyPin,
  type Account,
  type NewAccount,
} from './accounts';

export type { Account, Role } from './accounts';

/**
 * Device sign-in over the local accounts table. Screens consume the Account
 * shape and never touch PINs; when the office server brings real
 * authentication (tokens in expo-secure-store, server-checked credentials),
 * this module is the only thing that changes.
 */

const SESSION_KEY = 'session_account_id';

interface AuthValue {
  user: Account | null;
  ready: boolean;
  accounts: Account[];
  signIn: (accountId: string, pin: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  addAccount: (input: NewAccount) => Promise<Account>;
  reloadAccounts: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function AuthProvider({
  db,
  children,
}: {
  db: SQLite.SQLiteDatabase;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const reloadAccounts = useCallback(async () => {
    setAccounts(await listAccounts(db));
  }, [db]);

  useEffect(() => {
    void (async () => {
      const id = await getMeta(db, SESSION_KEY);
      setUser(id ? await getAccount(db, id) : null);
      await reloadAccounts();
      setReady(true);
    })();
  }, [db, reloadAccounts]);

  async function signIn(accountId: string, pin: string): Promise<boolean> {
    const account = await verifyPin(db, accountId, pin);
    if (!account) return false;
    await setMeta(db, SESSION_KEY, account.id);
    setUser(account);
    return true;
  }

  async function signOut(): Promise<void> {
    await setMeta(db, SESSION_KEY, null);
    setUser(null);
  }

  async function addAccount(input: NewAccount): Promise<Account> {
    const account = await createAccount(db, input);
    await reloadAccounts();
    return account;
  }

  return (
    <AuthContext.Provider
      value={{ user, ready, accounts, signIn, signOut, addAccount, reloadAccounts }}
    >
      {children}
    </AuthContext.Provider>
  );
}
