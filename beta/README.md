# PED tool — beta layout

The published app lives at `/ped-tool/beta/`. The normal root redirects here.
Maintain this directory and preserve the root redirect and retirement worker.

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

## Published

**Live: https://rbmglobal.co.uk/ped-tool/beta/** · manual at
https://rbmglobal.co.uk/ped-tool/beta/manual.html

Served by GitHub Pages from this repo (Settings → Pages → Deploy from a branch → `main` / root).
It sits under the domain because `RBMGlobal.github.io` is the organisation's site repo, which puts
every project repo at `rbmglobal.co.uk/<repo>/`. The old `rbmglobal.github.io/ped-tool/` address
still works and redirects here.
The custom domain above is the public address; the root tool URL redirects to beta.

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
is unavailable or returns an HTTP error. Bump `CACHE` in `sw.js` when you update, so
older PED beta shell copies are cleared out. Other applications and saved projects
are preserved. From the repository root, run `node --test tests/*.test.cjs` before
publishing.

## Never commit

Project `.json` files, exported packages, CSVs, KML or imagery — they carry real positions.
`.gitignore` blocks them, but check before you push.
