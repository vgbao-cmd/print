# Validation — 1.5.0

All 48 automated tests passed. TypeScript checking and the production build passed. Tests cover the original like/gift rules, identities, deduplication, combos, fairness, queue recovery and speed policy, plus the following premium behavior:

- Exact nominal avatar diameters: 128 / 160 / 192 / 256 / 320 / 384 / 448 / 512 source pixels.
- Variable row geometry stays within the 650-pixel sheet width and does not overlap during grouped printing or feeding.
- Existing products retain their awarded geometry when Settings changes; paper positions remain continuous across batch/history handoff.
- Unicode names wrap at word boundaries where possible and preserve complete grapheme clusters.
- Print completion and spotlight creation are atomic; duplicate completion does not create another spotlight.
- A final five-gift combo creates one ×5 spotlight with a five-second ROYAL duration.
- Active/pending spotlights survive database close/reopen, while completed prints are not replayed.
- A large synthetic spotlight backlog stays in SQLite with a bounded renderer preview.
- Invalid scale/duration/music paths are rejected and older saved settings are migrated.

`npm run check:premium` exercises both actual Electron renderers. Its generated `artifacts/premium-result.json` records each tier's size and confirms that the same photographic NASA sample loaded for all eight tiers. Pixel checks confirm an empty reveal mask, partial deposition and an exact final texture match.

The integration test uses real application timers and completion IPC: CLASSIC, ROYAL and HALL OF FAME finish printing while the five-second ROYAL spotlight is still active and HALL OF FAME is waiting in the independent spotlight queue. It also checks eight tier settings sections and all three master volume controls, captures long-name/invalid-avatar and grouped cases, and saves every spotlight effect.

A generated local WAV is copied through the same managed-file importer used by the file dialog, returned through the restricted music IPC and decoded by an actual HTML audio element (`readyState = 4`). Only one music track is active. The actual Web Audio music-bus gain is measured while ducked and after restoration. This tests routing and gain changes; it is not a speaker, microphone or LIVE Studio recording test. The native file-picker interaction itself is not automated.

## Delivered media

- `artifacts/tier-classic.png`, `tier-royal.png`, `tier-fame.png`: same photographic avatar at the requested relative sizes.
- `artifacts/spotlight-*.png`: all six default spotlight effects.
- `artifacts/tiers-mixed.png`, `tiers-long-name.png`, `tiers-concurrent.png`, `tier-settings.png`: grouped geometry, fallback/long names, concurrent printing and Settings.
- `artifacts/tier-comparison.mp4`: 25 seconds, 1080 × 1920, 15 fps. CLASSIC → ROYAL → HALL OF FAME, then another CLASSIC while HALL OF FAME remains in the spotlight. ROYAL lasts five seconds and HALL OF FAME twelve seconds. The video is a deterministic export of the actual application canvas. Its original procedural soundtrack is rendered offline from the same theme definitions and includes printer sounds, fades and the two tier motifs; it contains no TTS or real LIVE footage.

## Performance and practical limits

`premium-result.json` reports the measured CPU draw-call mean/maximum, current texture count and main-process memory at the end of the test. CPU draw timing excludes display compositing and video encoding; occasional stalls can exceed one 30 fps frame. These values are not a sustained-FPS guarantee. The application caps source drawing at 30 fps and the operator preview at 15 fps.

Paper metadata is limited to twelve completed entries. Textures are retained only for the visible paper, one buffer entry, the active print batch and one spotlight. Effects have at most forty particles. Synthesized audio schedules a short rolling window of notes and releases stopped nodes; local music has one active player. Main-process avatar cache limits, download limits and intake backpressure remain enabled. Spotlight backlogs increase waiting time rather than dropping rewards or creating concurrent large effects.

No multi-hour memory soak or real TikTok LIVE stress test has been completed. Real connection/signing availability, real gift catalog/image/price consistency, real incoming event completeness, English voice audibility/pronunciation and LIVE Studio application-audio capture still require verification in the target environment. No livestream was started and no paid service was enabled.

Recovery guarantees apply to committed SQLite receipts and completions. A crash during an uncommitted print or spotlight can replay that unfinished animation. A completed print or spotlight is not intentionally replayed. The last twelve paper entries now remain durable. Closing the output stops playback and saves the current print/spotlight checkpoint; reopen it and choose RESUME.


## Version 1.4.0 validation

`npm test`: 38 tests passed, including five new tests for frozen virtual time, reset with receipt/combo replay protection, bounded honor/badge/history state, a durable stopped job, and stale native-speech callbacks after Stop and Reset.

`npm run check:shows` runs the actual Electron queue and actual Control Panel buttons. It records the four serial shows, stops during printing and speech/spotlight, confirms unchanged job tokens and virtual elapsed time, accepts new events while stopped, resumes, and verifies one music track at a time. A 1,000-event burst precedes the real reset confirmation dialog. The test checks empty session data, rejects replayed combo receipts, then completes exactly one new photographic print. Results and timestamps are in `artifacts/shows/result.json`.

The show video uses timestamped captures of the application canvas and the actual Control Panel. Hidden Windows windows can throttle requestAnimationFrame, so the validation hook explicitly draws the current real virtual-clock position at capture time. This is a low-frame-rate QA recording, not a sustained 30 fps benchmark. The video soundtrack is rendered offline from original app themes and observed performance/Stop/Resume timestamps. The hidden-window MediaRecorder capture had discontinuous timing and is not used for the final soundtrack. Native Windows TTS is checked in application diagnostics but is not included in the video. No real TikTok LIVE was started or tested. No multi-hour memory soak, speaker audibility or LIVE Studio audio-routing guarantee is made.


## Version 1.5.0 Gift Guide and source layout

48 tests cover the existing print/session rules plus ten gift-guide tests: exact seven suggestions without fabricated IDs, same-price substitution and ambiguous-name rejection, custom-setting preservation and Legendary migration, missing/changed catalog gifts, room-specific deferred activation, price mismatch and combo finals, reset replay protection for deferred events, all seven synthetic rewards and wider paper geometry, real bundled WebP headers, and deferred-event recovery after reopening.

`npm run check:guide` uses isolated Electron profiles. It decodes the seven supplied CDN assets, captures every tier and applicable spotlight, checks a synthetic verified catalog and a missing-Takoyaki catalog, then disables network image loading to prove the exact bundled assets work. It checks an empty LIVE guide for unverified gifts and inspects source/viewport bounds at 540 x 960, 720 x 1280 and 960 x 540. The internal canvas is always 1080 x 1920. All seven synthetic gift rewards must finish through the actual print scheduler.

See `artifacts/gift-guide/result.json` and `artifacts/gift-images.json`. The fixture catalog IDs begin with `fixture-only-`; none is claimed to be a genuine TikTok gift ID. All provided CDN files returned HTTP 200, but that alone does not verify prices, IDs or availability on any LIVE room. No real LIVE account or LIVE Studio session was used. The seven suggested prices remain explicitly unverified until connection and room-catalog comparison.

The renderer now supports static WebP supplied by TikTok even when nativeImage cannot decode it. Download dimensions are bounded; two decoder slots resample large avatars to 512 pixels while preserving aspect ratio. RAM/disk image caches are bounded and failures have retry backoff. Queued unverified gift payloads and replay keys remain on disk, processed in batches of 128 rather than a growing RAM list.
