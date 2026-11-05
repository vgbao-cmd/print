# Gift Guide LIVE display repair

Root cause: PaperScene and PaperPrinter supplied an empty catalog unless connected;
guideItems then removed every LIVE entry unless verified. Switching to LIVE also
cleared the active catalog. This was a data/filter issue, not STOP or CSS.

Display now has its own account/room-scoped catalog cache. Before the first catalog,
configured suggestions are explicitly labeled. A known missing catalog entry is
hidden. Disconnect/reconnect preserves display only for the same account/room;
a new account or room invalidates the display cache. No ledger/event verification
or gift-ID matching was relaxed. Reset keeps settings and display metadata.

Validation: 86 unit tests passed; production build/typecheck and npm run pack passed.
Electron's actual Broadcast Output was exercised with synthetic catalogs and events:
seven suggestions in disconnected/stopped LIVE, seven verified catalog entries,
six when Takoyaki is missing, seven with failed remote images and bundled fallback,
STOP/RESUME, Reset Session retaining settings/catalog, disconnected cached display,
and seven synthetic prints completing through the real scheduler/SQLite queue.
Unit tests additionally cover changing account/room and custom settings preservation.
The canvas remains 1080x1920, fitting 540x960, 720x1280 and 960x540 viewports without
cropping or stretching. Resize checks wait for the actual target viewport and scale;
an initial check had raced asynchronous window resizing.

Evidence: gift-guide/result.json, gift-guide/live-unverified-suggestions.png and
gift-guide/disconnected-last-catalog.png. The screenshots come from the actual
Broadcast Output canvas, not the Control Panel preview.

These are simulated catalog/event checks, not a real TikTok LIVE connection.
Windows x64 packaging was built on Linux; Windows execution and a real room's
catalog, gift images and incoming LIVE events remain to be checked on Windows.
New executable: release/win-unpacked/Live Avatar Printer.exe. Keep the full folder.
