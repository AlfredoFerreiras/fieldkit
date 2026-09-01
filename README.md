# Fieldkit

Offline first field data capture. One binary, many customers: forms are defined
by JSON schemas the customer controls, so changing a form does not require an
app release.

Built to work with no signal in a basement and reconcile later without losing or
duplicating anyone's work.

## Getting it running

You need Node 20 or newer and an Expo account. Everything below runs on Windows.

```bash
npx create-expo-app@latest fieldkit --template blank-typescript
cd fieldkit
```

Then copy the `app/` and `src/` folders from this bundle over the generated
project, delete the generated `App.tsx`, and install dependencies:

```bash
npx expo install expo-router expo-sqlite expo-crypto expo-image-picker \
  @react-native-community/netinfo react-native-safe-area-context react-native-screens
```

Point the entry point at expo-router in `package.json`:

```json
"main": "expo-router/entry"
```

Add the router plugin and the camera permission string to `app.json`:

```json
{
  "expo": {
    "scheme": "fieldkit",
    "plugins": [
      "expo-router",
      ["expo-image-picker", {
        "cameraPermission": "Fieldkit uses the camera to attach photos to inspections."
      }]
    ],
    "ios": { "bundleIdentifier": "com.yourname.fieldkit", "supportsTablet": true }
  }
}
```

Then:

```bash
npx expo start
```

With no `EXPO_PUBLIC_API_URL` set, the app runs against an in memory mock server
in `src/sync/api.ts`. Everything works end to end, including conflicts.

## Try the thing that makes it interesting

1. Put the phone in airplane mode.
2. Fill out two inspections and submit both. The banner turns amber.
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

## What is not built yet

- Attachment upload. The `attachments` table and its state machine exist; photos
  currently live as local URIs inside the record payload. Photos need their own
  upload lane with resumability, because a 4MB photo over a 2 bar connection is a
  different problem from a 3KB JSON row.
- Signature capture. Stubbed in `src/components/fields.tsx`.
- Barcode scanning. Currently a text input. Needs `expo-camera`.
- Schema delivery. Schemas are bundled; the `schemas` table is ready for them to
  arrive from the server.
- Auth. Nothing here is authenticated yet.
- Background sync. Currently foreground plus reconnect plus a slow poll.
  `expo-background-task` is the next step.

## Shipping it from Windows

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios --profile preview
```

EAS builds on its own macOS machines and handles certificates and provisioning.
The `preview` profile produces an internal distribution build you can install on
registered devices. For TestFlight, use `--profile production` then
`eas submit --platform ios`. Both need an Apple Developer Program membership.
