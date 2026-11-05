# Third-party notices

Live Avatar Printer is distributed under AGPL-3.0-only; the full license is in LICENSE. Connection lifecycle and persistence patterns are adapted from the user's upstream 0.16.0 desktop project, which uses the same license.

- tiktok-live-connector 2.5.0: AGPL-3.0-only, https://github.com/zerodytrash/TikTok-Live-Connector
- React / React DOM: MIT, https://github.com/facebook/react
- Electron: MIT, https://github.com/electron/electron
- Vite, Vitest, esbuild and TypeScript retain their respective upstream licenses in their packages.
- Noto Sans, Noto Sans CJK and Noto Sans Arabic: SIL Open Font License 1.1. Font license texts are included in src/assets and in packaged distributions. These fonts were copied from the user's existing local source assets; no download was required.

Real TikTok avatars and gift images are remote platform/viewer content. Fallback avatars use a generated color gradient. Printer artwork is implemented as Canvas geometry, gradients and raster strips; audio uses Web Audio. No paid assets or speech services are used.

The optional photographic demo uses NASA image **s90-38573**, "Portrait of Astronaut Frank L. Culbertson". Photo credit: NASA. It is a sample image and does not imply endorsement or a TikTok connection. Source image: https://images-assets.nasa.gov/image/s90-38573/s90-38573~medium.jpg ; metadata: https://images.nasa.gov/details/s90-38573 . The bundled image is used only for the clearly identified Demo Portrait.

Tier music in version 1.3.0 is synthesized from original procedural motifs in `src/music-themes.ts`. No third-party recordings or music samples are bundled. The comparison video's soundtrack is an offline rendering of those same motifs and printer sounds. User-selected local music remains the user's own external content.


## TikTok gift preview images

The seven files under resources/gifts are original WebP bytes downloaded from the TikTok CDN URLs supplied by the user for Rose, Finger Heart, Rosa, Perfume, Doughnut, Takoyaki and Hand Heart. They are used to identify gifts in the app's guide and provide an offline fallback. These images and associated marks belong to their respective owners; they are not original artwork of this project. Their successful download does not verify a room's gift ID, current price or availability. The URL manifest and HTTP results are recorded in artifacts/gift-images.json in the development workspace.
