# Fieldkit

[![CI](https://github.com/alfredoferreiras/fieldkit/actions/workflows/ci.yml/badge.svg)](https://github.com/alfredoferreiras/fieldkit/actions/workflows/ci.yml)

Offline-first field app for a fire damage restoration contractor. Technicians
fill out job reports on site, often in a burned building with no signal. The
office gets the reports when the phone finds a connection, in order, without
anything lost or duplicated.

Forms are JSON schemas, not code. Changing a job sheet means editing a schema,
not shipping an app release.

**Status:** working prototype, built for a family member's fire cleanup company
and in hands-on testing with them. Runs end to end today against an in-memory
mock server, including the conflict path. The office server is the next piece.

## Screenshots

<!-- Add phone screenshots to docs/screenshots and reference them here. -->

_Screenshots coming. The offline demo below is the best way to see it work._

## What it does

- **Role-based login.** Supervisor, manager, and customer accounts with PINs,
  stored salted and hashed in SQLite. Supervisors add and manage accounts on the
  device.
- **Job reports from a schema.** Text, number, boolean, select, multiselect,
  date, photo, tag, and signature fields. Fields show or hide based on other
  answers, and hidden values are pruned on submit.
- **Offline queue with visible state.** Every screen reads local SQLite. A
  banner shows what is queued, what is syncing, and what failed.
- **Conflict resolution.** When the office has changed a record the phone also
  edited, both copies are held and a human picks one. Nothing merges on its
  own.
- **Customer issue reports.** Customers file issues from their own login; staff
  verify and amend them after submission.
- **Reports and dashboard.** Job counts, status breakdowns, and trends computed
  directly from local records over a chosen period. No reporting table to keep
  in sync.
- **Team chat and tab badges.** Unread messages, unverified issues, and pending
  conflicts show as counts on the tab bar.
- **English and Spanish**, switchable at runtime, including form labels from the
  schema.

## Run it

You need Node 20 or newer and the Expo Go app on your phone (it runs Expo SDK 57, which this project targets).

```bash
git clone https://github.com/alfredoferreiras/fieldkit.git
cd fieldkit
npm install
npx expo start
```

Scan the QR code with Expo Go. If the phone cannot reach your computer over
Wi-Fi, use `npx expo start --tunnel`.

With no `EXPO_PUBLIC_API_URL` set, the app runs against an in-memory mock server
in `src/sync/api.ts`. Everything works end to end, including conflicts.

### Demo accounts

Pick an account on the login screen and enter its PIN. These are seeded on
first run so every role is usable out of the box.

| Name       | Role       | PIN  |
| ---------- | ---------- | ---- |
| Alfredo    | Supervisor | 1111 |
| Maria      | Manager    | 2222 |
| James      | Manager    | 3333 |
| Ana Torres | Customer   | 0000 |

## Try the thing that makes it interesting

1. Put the phone in airplane mode.
2. Fill out two job reports and submit both. The banner turns amber.
3. Force quit the app. Reopen it. The queue is still there, ordered.
4. Turn airplane mode off. Watch the queue drain.

To rehearse a conflict, set `mockConfig.conflictRate = 1` in `src/sync/api.ts`,
submit a record twice, and you land on the resolution screen.

To rehearse a bad network, set `mockConfig.failureRate = 0.5` and watch the
backoff and the attempt counter in the `outbox` table.

## Architecture

**SQLite is the source of truth for the device.** No screen ever awaits the
network. The server is a peer we reconcile with, not a store we read through.

**The outbox is an ordered append only log**, not a set of dirty flags.
Mutations replay in the order the technician made them, so an edit can never
overtake the create it depends on.

**Delivery is at least once, not at most once.** Rows are leased before a
request goes out. If the process dies mid flight we do not know whether the
server applied the batch, so we reclaim the lease and resend. The server dedupes
on `(record_id, seq)`. Losing an inspection is worse than applying one twice.

**Conflicts use versions, not timestamps.** Field device clocks are wrong often
enough that last write wins on wall clock quietly destroys data. Each record
carries the server version it was last reconciled against; a mismatch is a
conflict.

**Conflicts never auto resolve.** The server copy is held next to the local copy
until a human picks. Automatically merging an inspection is how you end up
certifying a unit nobody looked at.

**Drafts never sync.** A half filled form in someone's pocket does not reach the
office and does not burn battery on retries. Only submission enqueues.

**One in-flight mutation per record.** An edit queued behind an unsynced create
carries a version the server has not assigned yet. The engine sends them in
separate round trips and stamps each result's version onto the rows still
waiting behind it, so a device's own chain of edits never reads as a conflict.

## Tests

```bash
npm run check   # typecheck, lint, and tests
npm test
```

The sync engine and record store run in tests against a real SQLite database
(in-memory, via sql.js) using the app's own migrations, so the tests exercise
the actual SQL. Covered:

- Submit is atomic: the record flips to queued and the outbox row appears
  together. Drafts never enqueue, and a draft edit cannot overwrite a queued
  record.
- Mutations replay in sequence order, and a record is not shown as synced while
  a newer edit is still queued.
- A dead network leaves everything queued with the attempt counted, and a later
  drain sends it. Expired leases from a mid-flight crash are reclaimed. Rows
  another request still holds are not double sent.
- Rejected mutations are parked instead of retried forever.
- A server-side edit produces a conflict that holds both copies. Keep-server and
  keep-local each resolve it correctly, and keep-local wins on the next sync.
- Migrations bring a fresh database to the current version and seed accounts
  with hashed PINs.

## Project layout

```
app/            expo-router screens (tabs, job, issue, reports, dashboard, users)
src/auth/       accounts and session
src/components/ form renderer, field widgets, signature pad, sync banner
src/db/         migrations, record store, chat storage
src/schema/     form schema types, validation, bundled example schemas
src/sync/       outbox engine and server contract (with mock server)
src/i18n/       English and Spanish dictionaries
src/reporting/  shared period logic for reports and dashboard
src/test/       in-memory SQLite harness for tests
```

## What is not built yet

- **The office server.** Sync runs against the in-memory mock. Team chat and
  accounts are local to the device until the server exists.
- **Attachment upload.** The `attachments` table and its state machine exist;
  photos currently live as local URIs inside the record payload. Photos need
  their own upload lane with resumability, because a 4MB photo over a 2 bar
  connection is a different problem from a 3KB JSON row.
- **Barcode scanning.** Currently a text input for the tag. Needs `expo-camera`.
- **Schema delivery.** Schemas are bundled; the `schemas` table is ready for
  them to arrive from the server.
- **Background sync.** Currently foreground plus reconnect plus a slow poll.
  `expo-background-task` is the next step.
- **Real auth.** A PIN hash on a device someone holds is a speed bump, not a
  vault. Server-checked credentials and tokens in secure storage replace it
  when the server arrives.

## Shipping it

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile preview
```

EAS builds on its own macOS machines and handles certificates and provisioning.
The `preview` profile produces an internal distribution build for registered
devices. For TestFlight, use `--profile production` then `eas submit`. Both
need an Apple Developer Program membership.

## License

MIT
