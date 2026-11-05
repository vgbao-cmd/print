# TikTok connection repair validation — 2026-11-05

- Inspected the pinned `tiktok-live-connector` 2.5.0 package, lockfile and official
  version-tagged documentation:
  https://github.com/zerodytrash/TikTok-Live-Connector/blob/v2.5.0/README.md
- Its documented `error` event is `{info, exception}`, not an Error. The previous
  handler classified the wrapper as `[object Object]`, removed listeners before
  the underlying connect rejection, and replaced the actual failure with a generic
  message. Its shared deadline could also be cleared by an old attempt finishing
  after a retry began. Both paths now have regression coverage.
- `npm run build`: passed (TypeScript, Vite and Electron main/preload/worker bundles).
- `npm test`: 84 tests passed in six files. 36 connection tests include input
  normalization, confirmed/unconfirmed success, error categories and redaction,
  wrapped errors, factory timeout, duplicate requests, pending cancellation,
  backoff exhaustion/cancellation, late callbacks, stream end and manual retry.
  Transport-success tests are mocks, not real LIVE evidence.
- Electron smoke test on Linux/Xorg dummy: passed; two renderer windows, real
  preload/IPC and SQLite worker, three completed synthetic prints, empty queue,
  50 remaining likes. See `connection-smoke-result.json`. Synthetic only.
- Electron connection check: passed through the actual Connect button, IPC and
  installed connector; tested ERROR UI, Demo/LIVE separation, duplicate Connect,
  STOP preserving transport, Copy Diagnostics, Disconnect and cancellation during
  CONNECTING. See `connection-result.json` for the timestamped, redacted evidence.
- Actual `pinus.si` attempt: room lookup failed with nested `EAI_AGAIN` DNS errors
  in this restricted cloud machine. This does not establish that the Windows
  machine has the same network problem, that the account is offline/nonexistent,
  or that a dependency update is required. The connector stays pinned at 2.5.0.
- Windows x64 unpacked packaging completed with electron-builder. Windows runtime
  execution, room connection, receiving real likes/gifts, catalog signing and
  sending real LIVE events through the durable print queue remain unverified.

On the user's Windows machine, run the rebuilt app while the intended account is
LIVE. If it fails, use COPY DIAGNOSTICS and provide that redacted report. No token,
cookie or raw environment dump is needed.
