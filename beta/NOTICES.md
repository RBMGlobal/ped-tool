# Third-party notices

`index.html` (the PED tool) is © 2026 RBM Global, all rights reserved, and bundles the
open-source components below. All are permissive licences that allow commercial use; each
requires its copyright notice and licence text to be preserved in redistributions. The same
notices are reproduced in the header comment of `index.html`, so they travel with the file
even when it is sent on its own.

| Component | Licence | Copyright |
|---|---|---|
| Leaflet | BSD-2-Clause | © Vladimir Agafonkin, © CloudMade |
| proj4js | MIT | © proj4js contributors |
| geotiff.js | MIT | © geotiff.js contributors |
| LERC 2 decoder | Apache-2.0 | © 2015–2021 Esri |
| JSZip 3.10.1 | MIT (dual MIT / GPLv3 — used here under MIT) | © Stuart Knightley and contributors |
| mgrs | MIT | © mgrs contributors |

Before any commercial release, download each project's full LICENSE text and ship them with the
product. Apache-2.0 (LERC) additionally requires that you retain the NOTICE file if one is
supplied, and state any changes you made to the code — we made none.

## Not covered by this notice

Map tiles, road snapping (OSRM) and elevation data come from third-party services under their
own terms, and are fetched live rather than redistributed. Two matter commercially:

- **Google hybrid** uses an unofficial tile endpoint. Acceptable-ish for internal team use,
  **not** for a product offered to customers. Remove it before selling anything.
- **Esri** and **Mapbox** basemaps need commercial licence tiers above free/personal use.
- **OpenStreetMap** tiles are for light use; a commercial product should use a paid provider
  or self-hosted tiles.

The tool's "Help & OPSEC" section lists every service it contacts.

## Mapbox token

The Mapbox access token embedded in `index.html` is a public (`pk.`) token, which Mapbox intends
to be used in client-side code. It is not a secret key. GitHub's secret scanner flags it anyway.
On a public repository anyone can use it against your Mapbox quota — set usage limits and URL
restrictions on the token at mapbox.com if that matters.
