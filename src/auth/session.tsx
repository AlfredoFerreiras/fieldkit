import React, { createContext, useContext, useEffect, useState } from 'react';
import type * as SQLite from 'expo-sqlite';
import { getMeta, setMeta } from '../db';

/**
 * Demo identity, deliberately not security. These accounts exist so the app
 * can be exercised per role before the office server exists. Real
 * authentication (tokens in expo-secure-store, refresh, server-checked
 * credentials) replaces this module wholesale; nothing else in the app should
 * know the difference, which is why everything consumes the Account shape and
 * never the PIN.
 */

export type Role = 'supervisor' | 'manager' | 'customer';

export interface Account {
  id: string;
  name: string;
  role: Role;
  pin: string;
  phone: string;
  email: string;
}

export const DEMO_ACCOUNTS: Account[] = [
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

const SESSION_KEY = 'session_account_id';

interface AuthValue {
  user: Account | null;
  ready: boolean;
  signIn: (accountId: string, pin: string) => Promise<boolean>;
  signOut: () => Promise<void>;
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

  useEffect(() => {
    void getMeta(db, SESSION_KEY).then((id) => {
      setUser(DEMO_ACCOUNTS.find((a) => a.id === id) ?? null);
      setReady(true);
    });
  }, [db]);

  async function signIn(accountId: string, pin: string): Promise<boolean> {
    const account = DEMO_ACCOUNTS.find((a) => a.id === accountId);
    if (!account || account.pin !== pin) return false;
    await setMeta(db, SESSION_KEY, account.id);
    setUser(account);
    return true;
  }

  async function signOut(): Promise<void> {
    await setMeta(db, SESSION_KEY, null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}
