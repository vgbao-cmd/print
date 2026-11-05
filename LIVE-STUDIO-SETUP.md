# Portrait source and LIVE Studio setup

The application's drawing surface is always **1080 x 1920 (9:16)**. Its source host has zero outer padding and no rounded card or width cap. The machine intentionally has small composition margins inside that image. Those margins are part of the studio background, rather than an extra black border.

1. Open Broadcast Output from Control Panel. Capture that window's **client/content area**, rather than Control Panel, the entire monitor or its operating-system title bar. Depending on the installed LIVE Studio version, the window-capture controls can use different labels.
2. Select a **portrait 9:16 scene/canvas**, with a target of **1080 x 1920**. If the version exposes both portrait and landscape layouts, configure the portrait view first and inspect both views separately.
3. Reset any previous source crop, stretch or transform. Position the full source at the canvas origin and fit it proportionally to the whole canvas. Where numeric source controls are available, use X = 0, Y = 0, width = 1080, height = 1920, with aspect ratio preserved. Never stretch one axis or zoom to fill before checking the scene ratio.
4. Check all four source edges, the entire printer body, both supports, the bottom Gift Guide, the likes instruction and the spotlight name. None should be cropped. Use the app's full source PNG as a comparison image.
5. Use a phone preview or a private recording to check actual readable size and TikTok's overlays. Important content sits inside the portrait image, but account/comment overlays and device presentation can vary. The app does not copy those TikTok controls into its output.
6. Capture application audio once and test Music, Print Sounds and Voice independently. Do not add desktop audio for the same process a second time. Enable the English voice in Settings if wanted. No stream is started automatically by this app.

## Diagnose empty space

- **Space appears in the app's full 1080 x 1920 PNG:** this is app composition. The new printer is about 960 pixels wide and the paper is 800 pixels wide; there is no old left icon column. Navy margins remain around the physical machine.
- **PNG fills 9:16 but LIVE Studio has side bars:** compare the canvas ratio, captured source rectangle and existing crop/transform. A 9:16 picture inside a 16:9 canvas cannot fill both axes while preserving its shape and all content. Select the portrait canvas or design a separate landscape arrangement.
- **A manually resized app window has bars:** the renderer fits the complete fixed-ratio source uniformly. Normal interactive resizing requests a 9:16 window ratio. Programmatic or operating-system resizing can still produce a different viewport; letterboxing then preserves the entire source. Restore a 9:16 client size, such as 540 x 960 or 720 x 1280, before capture. The internal canvas remains 1080 x 1920 regardless.
- **The actual destination is another ratio:** use a matching 9:16 canvas when possible. Otherwise keep the proportional source and place other content in the remaining space, or build a separate layout for that ratio. Filling the destination by cropping will remove parts of the printer or guide; stretching will distort avatars.

The application was tested at 540 x 960, 720 x 1280 and 960 x 540 client sizes. Source geometry remains 9:16 and fully visible. The wide viewport intentionally has side space. These are application tests, not a claim that a real LIVE Studio session was verified.

TikTok's [official dual-layout guide](https://www.tiktok.com/live/studio/help/article/Enhance-visuals/Use-dual-layout-to-go-LIVE-in-portrait-and-landscape-simultaneously) explains the separate portrait/landscape arrangements and proportional source adaptation. Exact menu names and available resolution controls depend on the installed version.
