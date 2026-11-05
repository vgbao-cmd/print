# Gift intake repair

## Evidence and limits

Pinned versions: tiktok-live-connector 2.5.0, tiktok-live-proto 0.2.4, native v3.
Inspected the installed connector's WebcastGiftMessage dispatch, gift/list route,
v3 WebcastGiftMessage/Gift/CommonMessageData schema, and official version-tagged
README (https://github.com/zerodytrash/TikTok-Live-Connector/blob/v2.5.0/README.md).
The README's legacy giftDetails example does not replace the actual v3 gift.type,
gift.diamondCount, groupId and numeric repeatEnd fields emitted by this package.

Confirmed reproducible defects:
- catalog() discarded real gift metadata if an image was absent. This made an
  otherwise valid ID/name/price unavailable to verification and mapping.
- Intermediate and final combo updates sharing msgId used the same durable
  receipt. The intermediate update committed that receipt, so the final could be
  classified as a duplicate before creating a job. Receipts now distinguish update
  quantity/end state; the existing final group key still permits only one reward.
- A protobuf-default top-level giftId "0" masked a valid nested gift.id. ID fallback
  now skips empty/zero placeholders. Positive price metadata is normalized without
  treating protobuf defaults as verified prices; the room catalog remains required.

This does not establish which defect affected the user's Windows LIVE session.
No real incoming gift log or actual room catalog was available in this task.
The production connector remains unchanged and no gift IDs were invented for it.

## Production mapping expectations (not verified room metadata)

| Suggested name | Expected coins | Tier | Actual room ID |
| --- | ---: | --- | --- |
| Rose | 1 | GLOW PRINT | Not obtained |
| Finger Heart | 5 | BLOOM PRINT | Not obtained |
| Rosa | 10 | LOVE PRINT | Not obtained |
| Perfume | 20 | ROYAL PRINT | Not obtained |
| Doughnut | 30 | RAINBOW PRINT | Not obtained |
| Takoyaki | 88 | LEGENDARY PRINT | Not obtained |
| Hand Heart | 100 | HALL OF FAME PRINT | Not obtained |

Existing mappings are retained. Defaults have no gift IDs. Legacy Legendary Tea / 50
is already removed by validSettings; it is not used as a replacement for Takoyaki.
Only a current real catalog and explicitly configured/verified mapping can authorize
LIVE effects. No coin-only fallback, fake VERIFIED flag or signing bypass was added.

## Validation

- 100 tests across seven files: seven v3-encoded/decoded mappings, ordinary gift
  without repeatEnd, combo updates sharing msgId, final duplicate under new msgId,
  two independent sends, numeric/string IDs, zero placeholders, missing catalog
  images, missing mapping, price mismatch, deferred replay, wrong room, reconnect
  listener cleanup, rejected payload diagnostics, and configurable likes alongside
  gifts. Existing ledger/combo/reset/spotlight/playback tests remain in the suite.
- npm run check:gifts (Linux container display helper): synthetic connector,
  actual Electron main/preload/IPC, persistence worker, SQLite, Control Panel and
  Broadcast Output. It queues 10 gift jobs (including one combo x3) and two like
  jobs while stopped, then resumes and completes all 12 via output acknowledgments.
  See gift-intake-result.json for the actual run timestamp and redacted outcomes.
- npm run build/typecheck and npm run pack: run for Windows x64 packaging.

Real room gift IDs/names/prices, actual LIVE delivery, and execution on Windows
remain unverified. After connecting on Windows, inspect Recent Gift Events. For a
remaining failure, provide COPY DIAGNOSTICS and the seven configured room mappings
(ID, catalog name, price, English display name); do not provide cookies/tokens.

## Changed files

- electron/normalizer.ts, store.ts, tiktok.ts: gift metadata, receipts and listener diagnosis.
- electron/gift-diagnostics.ts (new): whitelisted/redacted event metadata.
- electron/ledger.ts, persistence-worker.ts, main.ts: committed outcome reporting and UI snapshots.
- src/shared.ts, App.tsx: Recent Gift Events in Control Panel only.
- electron/gift-check.ts (new), tests/gift-intake.test.ts (new), tests/tiktok.test.ts:
  native-schema and pipeline/reconnect regression checks.
- package.json and README.md: check:gifts command and diagnostic instructions.
- artifacts/gift-intake-result.json: timestamped simulated end-to-end evidence.

No modifications to the original An Nhien project, like threshold logic,
Gift Guide display, audio/TTS or spotlight implementations were required.
