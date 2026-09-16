# Seed assets

Drop your local images in these folders and run `npm run seed` (from the repo
root). The seed uploads whatever it finds to the **Storage emulator** and wires
it into the seeded club and hunt.

Everything here is **optional**. An empty folder just means that asset is
skipped — no logo, no avatars, or a mission that runs on its written hint alone.
So the seed works on a fresh clone with these folders empty, and gets richer as
you add files.

## Folders

| Folder | What goes in it |
|---|---|
| `logo/` | One image (a PNG or SVG with a transparent background works best). The **first** image found becomes the club logo. |
| `avatars/` | Square images fans can pick as their avatar. The file name (minus extension) becomes the label — `slugger.png` → "Slugger". Up to 24. |
| `targets/` | The mission target photos. They map to the seeded missions **in file-name order**, so name them `01-…`, `02-…`, `03-…`. Fewer than the mission count is fine; the rest run on their hint. |
| `prize/` | One image for the seeded hunt's prize (shown on the redeem screen). The first image found is used. |

Supported: `.png .jpg .jpeg .webp .svg`. Max **5 MB** each (matches `storage.rules`).

## Nothing here is committed

The images you add are git-ignored — these are *your* local assets, not part of
the repo. Only this README, the `.gitignore`, and the empty folders are tracked.

## Seeing the images on a phone (tailnet)

By default the seed stores download URLs pointing at the Storage emulator
(`http://127.0.0.1:10199`), which only resolves **on the machine running the
emulator**. To test on a phone over your tailnet, point the seed at the dev
server's public origin instead — it proxies `/v0` to the emulator, so the URLs
are reachable and not blocked as mixed content:

```sh
SEED_STORAGE_PUBLIC_URL=https://your-host.tailnet.ts.net:8445 npm run seed
```

## Overrides

| Env var | Default | Purpose |
|---|---|---|
| `SEED_STORAGE_URL` | `http://127.0.0.1:10199` | Where the seed uploads to (the emulator). |
| `SEED_STORAGE_PUBLIC_URL` | same as `SEED_STORAGE_URL` | Base of the stored download URLs (set to the tailnet origin for phone testing). |
| `SEED_STORAGE_BUCKET` | `demo-app.appspot.com` | Emulator bucket name. |
