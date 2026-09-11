# App icon & splash sources

This folder holds the **source images** that `@capacitor/assets` expands into
every size iOS and Android require. No generated files and no binaries live in
the scaffold — you drop them in.

## What to put here

| File | Size | Required | Notes |
|---|---|---|---|
| `icon.png` | 1024×1024 | yes | No transparency, no rounded corners — the platforms apply their own mask. |
| `splash.png` | 2732×2732 | yes | Centered artwork; the outer ~40% gets cropped on some aspect ratios. |
| `icon-foreground.png` | 1024×1024 | optional | Android adaptive icon foreground (transparent background). |
| `icon-background.png` | 1024×1024 | optional | Android adaptive icon background (usually a flat brand color). |
| `splash-dark.png` | 2732×2732 | optional | Dark-mode splash. |

## Generating

```bash
cd app && npm run cap:assets
```

That runs `capacitor-assets generate`, which writes every derived size directly
into `app/ios/` and `app/android/`.

**Re-run it after every `npx cap add <platform>`** — adding a platform recreates
the native project from the template, wiping previously generated assets.

## White-label note

These are per-team files. When standing up a new tenant, replacing the two
images here plus the `--brand-*` variables in `src/assets/css/main.css` and the
values in `src/config/tenant.ts` is the whole re-skin.
