# Annual app branding

The permanent generic ICYPAA icon lives in `apps/mobile/assets/branding/icypaa-generic/`.
`source.png` preserves the official artwork from icypaa.org; `icon.png` is the
square rendition served by its image provider. Source:
https://static.wixstatic.com/media/cb4846_9511d732b4e54f0f9d66ff830baf63bc~mv2.png

`apps/mobile/config/branding.cjs` selects the native icon, adaptive layers, and
favicon together. Its checked-in default is `generic`. Set `YAAP_BRANDING=icypaa-66`
for the preserved 66th conference icon, or add another named conference entry.
After a conference, set the default back to `generic` and remove any EAS
production environment override. The generic adaptive icon uses a native inset
to protect the lettering without modifying the official raster.

Icons are compiled into the app: bump the app version and create both store
builds when switching. An OTA update cannot replace the installed launcher icon.
The holding screen deliberately keeps the generic asset independent of the
current program. Test iOS and Android launcher masks before each release.

# 66th ICYPAA brand assets

The supplied full-bleed artwork is preserved in
`icypaa-66-app-icon-source.png`. The common, padded production master is
`icypaa-66-app-icon-master.png`.

The production exports intentionally keep the gradient full bleed while
reserving clear space around all lettering and the sun/moon motif:

- Apple, Google Play, and web exports use 12.5% minimum canvas padding on each
  side (the source artwork occupies 75% of the canvas).
- The Android adaptive foreground uses about 28% minimum canvas padding on
  each side (the source artwork occupies about 43% of the 108-unit layer).
  This keeps the square composition inside Android's guaranteed circular
  66-unit safe zone, as well as squircle and rounded-square launcher masks.

Do not derive another adaptive foreground by shrinking the padded production
master. Start from the preserved full-bleed source or the current adaptive
foreground so the padding is applied only once.

## Platform exports

- `apple/app-icon-1024.png` — opaque 1024×1024 App Store/iOS icon
- `google/google-play-icon-512.png` — opaque 512×512 Google Play listing icon
- `google/feature-graphic-1024x500.png` — opaque Google Play feature graphic
- `google/adaptive-foreground-1024.png` — transparent Android adaptive foreground
- `google/adaptive-background-1024.png` — Android adaptive gradient background
- `google/adaptive-monochrome-1024.png` — Android 13+ themed-icon layer
- `web/icon-512.png` and `web/icon-192.png` — installable web-app icons
- `web/apple-touch-icon-180.png` — Apple touch icon
- `web/favicon-48.png`, `web/favicon-32.png`, `web/favicon-16.png`, and
  `web/favicon.ico` — browser favicons

Do not add rounded corners to the source artwork. Apple, Android, and browsers
apply their own masks at display time.
