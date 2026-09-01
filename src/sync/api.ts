/**
 * Server contract.
 *
 * Kept deliberately small: one endpoint, batched, idempotent. The client sends
 * mutations with the version it believes the server holds; the server applies,
 * conflicts, or rejects each one independently. Partial success is normal and
 * the client is built to expect it.
 */

export interface PushItem {
  seq: number;
  recordId: string;
  op: 'upsert' | 'delete';
  baseVersion: number | null;
  payload: Record<string, unknown>;
}

export interface PushResult {
  seq: number;
  status: 'applied' | 'conflict' | 'rejected' | 'failed';
  /** Server version after applying, or the current version on conflict. */
  version: number;
  /** Present on conflict: what the server currently holds. */
  serverData?: Record<string, unknown>;
  message?: string;
}

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const REQUEST_TIMEOUT_MS = 20_000;

export async function pushBatch(items: PushItem[]): Promise<PushResult[]> {
  if (!BASE_URL) return mockPush(items);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Lets the server dedupe an entire batch that was applied but whose
        // response never reached us.
        'Idempotency-Key': items.map((i) => `${i.recordId}:${i.seq}`).join(','),
      },
      body: JSON.stringify({ items }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Sync failed with status ${res.status}`);
    }

    const body = (await res.json()) as { results: PushResult[] };
    return body.results ?? [];
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------
 * Mock server.
 *
 * Runs in memory so the app is fully exercisable before a backend exists,
 * including the conflict path. Flip the knobs below to rehearse bad networks.
 * ---------------------------------------------------------------------- */

const mockStore = new Map<string, { version: number; data: Record<string, unknown> }>();

export const mockConfig = {
  latencyMs: 400,
  /** Probability any given batch fails outright, as a flaky network would. */
  failureRate: 0,
  /** Probability a record comes back conflicted, as a concurrent edit would. */
  conflictRate: 0,
};

async function mockPush(items: PushItem[]): Promise<PushResult[]> {
  await new Promise((r) => setTimeout(r, mockConfig.latencyMs));

  if (Math.random() < mockConfig.failureRate) {
    throw new Error('Network request failed');
  }

  return items.map((item) => {
    const existing = mockStore.get(item.recordId);

    if (item.op === 'delete') {
      mockStore.delete(item.recordId);
      return { seq: item.seq, status: 'applied', version: (existing?.version ?? 0) + 1 };
    }

    const serverVersion = existing?.version ?? null;
    const diverged =
      (serverVersion !== null && serverVersion !== item.baseVersion) ||
      (existing !== undefined && Math.random() < mockConfig.conflictRate);

    if (diverged) {
      return {
        seq: item.seq,
        status: 'conflict',
        version: existing!.version,
        serverData: existing!.data,
      };
    }

    const nextVersion = (serverVersion ?? 0) + 1;
    mockStore.set(item.recordId, {
      version: nextVersion,
      data: (item.payload.data as Record<string, unknown>) ?? {},
    });
    return { seq: item.seq, status: 'applied', version: nextVersion };
  });
}

/** Test helper: force the server ahead of the device to rehearse a conflict. */
export function mockAdvanceServer(recordId: string, data: Record<string, unknown>): void {
  const existing = mockStore.get(recordId);
  mockStore.set(recordId, { version: (existing?.version ?? 0) + 1, data });
}
