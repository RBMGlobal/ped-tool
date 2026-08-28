# PED tool

Operational planning on a map, exported as TAK data packages for ATAK / WinTAK.
One self-contained HTML file — no build step, no dependencies, no server logic.
Nothing anyone plots leaves their own device.

© 2026 RBM Global. All rights reserved. Proprietary — see `NOTICES.md`.

## Files

| File | What it is |
|---|---|
| `index.html` | The tool. Single source of truth — all libraries vendored inside it |
| `manual.html` | The user manual |
| `sw.js` | Offline worker, so the page keeps working with no signal |
| `manifest.webmanifest` | Lets the page install to a phone or tablet home screen |
| `icon-192.png`, `icon-512.png` | Home-screen icons |
| `NOTICES.md` | Third-party licences |

## Published with GitHub Pages

Settings → Pages → Source: Deploy from a branch → `main` / root.
Live at `https://rbmglobal.github.io/ped-tool/` (and at the custom domain once DNS points here).

A GitHub Pages site is public — anyone with the URL can open it and read the source. If you later
want it restricted to your team's email addresses, Cloudflare Pages can deploy from this same repo
and put a login in front; nothing here has to be rebuilt to make that move.

## Using it on a tablet

Open the URL, then **Add to Home Screen** (Chrome: menu → Add to Home screen; Safari: share
button). It launches like an app and keeps working without signal. Exports land in the Downloads
folder — pick them up from ATAK's **Import Manager → Local SD**.

The basemap still needs signal. Offline you get the tool, your saved work and every function on a
blank map background — exactly how the local HTML file behaves today.

## Updating

Replace `index.html` (and `manual.html`) and commit. Everyone gets the new version the next time
they open the page with signal — the offline worker serves the cached copy only when the network
is unavailable. Bump `CACHE` in `sw.js` when you update, so old copies are cleared out.

## Never commit

Project `.json` files, exported packages, CSVs, KML or imagery — they carry real positions.
`.gitignore` blocks them, but check before you push.
