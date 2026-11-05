# Live Avatar Printer 1.5.0 - delivery

- [Windows portable application](../release/Live-Avatar-Printer-1.5.0-Windows.exe)
- [Full 1080 x 1920 source screenshot](gift-guide/broadcast-full.png)
- [360 x 640 phone preview](gift-guide/phone-preview.png)
- [LIVE Studio setup and side-space diagnosis](../LIVE-STUDIO-SETUP.md)
- [Operating instructions](../README.md), [validation details](../VALIDATION.md)
- [Gift Guide integration results](gift-guide/result.json), [CDN download results](gift-images.json)

## Implemented

Removed the entire fake left gift column and all NOT CONFIGURED broadcast labels. The front-facing machine is now approximately 960 pixels wide and paper is 800 pixels wide. Its moving print head and full-color, proportional avatars remain. The bottom Gift Guide uses four plus three cells, actual gift artwork, English names, coin prices and print style. It is separate from paper and spotlight space. The source remains 1080 x 1920.

The suggestions are Rose 1 / Finger Heart 5 / Rosa 10 / Perfume 20 / Doughnut 30 / Takoyaki 88 / Hand Heart 100. No preset gift ID is fabricated. On connection, the installed connector requests gifts for the actual room ID. The app accepts unique exact name/price matches and verifies saved mapping IDs, names and prices for that room. It preserves custom mappings without auto-substituting another same-price gift. English display names remain editable. LIVE Guide entries and gift activation use the same verification predicate and configuration.

LEGENDARY now requires verified Takoyaki at 88 COINS. The old default mapping is removed during migration; other mappings, volumes, tier styles, music and account/session data remain. Scale 3.5, a nine-second dragon spotlight, original epic music and English voice remain. Gifts arriving without a matching catalog are deferred on disk and retried after verification. Combo finals and receipt keys prevent duplicate rewards. Reset clears deferred work and preserves its replay keys.

All seven supplied CDN files returned HTTP 200 and were decoded in Electron. The exact original WebP files are bundled as an offline fallback. Current catalog artwork has priority, followed by the supplied matching CDN image and local original. Static WebP handling was added because Electron nativeImage could not decode those files. Downloads, positive/negative cache entries, disk cache and decoder concurrency are bounded. Avatars are resampled without stretching. Failed gift images never become fake gift symbols.

Demo displays GIFT GUIDE - DEMO PREVIEW and always previews the seven suggestions. Custom live mappings remain separate. Only verified entries appear on a LIVE source; missing/unverified entries are warned about in Control Panel. Likes, adaptive/group printing, the four large performances, independent spotlight/music queues, durable work, deduplication, Stop/Resume and Reset Session remain. No TikFinity or original upstream project changes were introduced.

## Tested

48 automated tests and the production build passed. The final portable executable smoke test also passed. The packaged Electron app passed Gift Guide integration: seven actual CDN pictures, all seven print tiers, applicable spotlights, a synthetic full room catalog, a missing-Takoyaki catalog, forced offline image fallback, unverified entries hidden on LIVE, no obsolete Legendary labels, and seven completed rewards through the real scheduler. The fixture IDs are synthetic and are explicitly labeled as such in the results.

The packaged regression test passed Stop during a print and during speech/spotlight, Resume with the same job, accepted events while stopped, one music track at a time, a single honored guest, then Reset after a 1,000-event burst and a combo. Old combo replay remained rejected and one new print completed after reset. Unit tests also verify that deferred gifts survive reopening and do not reappear after reset.

At 540 x 960 and 720 x 1280 client sizes, the complete 9:16 source touches all four viewport edges with no app padding. At 960 x 540, it stays proportional and centered with intentional side space; the source canvas is still 1080 x 1920. LIVE-STUDIO-SETUP.md explains how to use a matching portrait canvas and full-source fit, and how to distinguish composition margins from host-window or LIVE Studio letterboxing. No zoom/crop/stretch is required for a matching 9:16 canvas.

## Verification limits

The CDN bytes and app behavior were tested. The suggested gift IDs, prices and availability were NOT verified against a real LIVE room. No account was connected and no livestream or LIVE Studio session was started. The fixture catalog is a logic test, not evidence of actual room availability. The seven default IDs remain unset until a real matching room catalog is received.

No multi-hour memory soak or sustained 30 fps guarantee is claimed. Cache/texture/queue structures are bounded in RAM; receipts and deferred events remain on disk, so disk use grows. Real connection/signing availability, actual room gifts, complete event delivery, speaker/voice audibility and LIVE Studio audio capture still need target-environment verification.

Measured CPU draw calls in the packaged guide check averaged 7.46 ms, with a 177.3 ms maximum during loading/capture. The packaged Stop/Resume regression averaged 1.28 ms, with a 177.1 ms maximum. These CPU-only capture measurements exclude compositor/GPU cost and are not a sustained frame-rate guarantee.
