# PED code review — 25 October 2026

Reviewed the published `beta/` app, its offline worker and the retired root routes. This is a source review and an automated worker regression check, not a claim that every browser, import format or operational feature has been exercised. No user project files were used. The application monolith changes only in generic attachment display and autosave lifecycle handling. Embedded vendor/model bytes, project schema and operational functions are unchanged.

## Implemented: isolate and preserve the offline app

The old `beta/sw.js` activation deleted **every other cache on rbmglobal.co.uk**. The fetch handler also intercepted every same-origin GET, cached HTTP errors and fell back to app HTML for missing images/manuals. These faults could break other installed apps or poison PED's offline copy during a server failure.

The worker now:

- Deletes only numbered, old `ped-beta-` shell caches; preserves LZ, OCR, other applications and non-shell caches.
- Handles only eight explicit PED beta shell resources. Other pages, tiles, data requests, POSTs and range requests bypass it.
- Preserves and serves the last good file when the network fails or returns an HTTP error. Redirected responses and failed downloads never replace the cache.
- Uses only its current named cache. A missing icon or manual cannot receive app HTML by mistake.
- Saves one copy of `index.html`, shared by directory and query-string URLs, instead of two copies. At the reviewed revision this removes **7,699,402 bytes** of duplicate shell content from the explicit precache list; browser overhead/compression may differ.
- Keeps background cache writes alive without allowing cache/storage failures to prevent an otherwise valid online response.

Root redirects, retirement worker, localStorage keys, project data and UI/layout are untouched. The beta cache version is now 10 so the updated shell is precached.

### Validation

Run with Node 20 or newer:

```sh
node --test tests/*.test.cjs
```

The same command runs in GitHub Actions on pull requests and pushes to main, using Node 22 and read-only repository permissions.

All 24 tests pass: 11 worker regressions plus 13 synthetic attachment/autosave regressions. Tests execute the real worker scripts and extracted application functions in a VM with simulated browser APIs, storage and deterministic timers. Installation checks that each shell asset exists. They cover blank-start protection, the last edit before hide, duplicate lifecycle events, normal debouncing, attachment quota/lite fallback and recovery, legacy-key migration, import rollback cancellation and attribute escaping. A real-browser upgrade/offline smoke test is still needed before deploying; these tests do not fully simulate browser lifecycle or storage eviction.

## Implemented follow-up: attachment display and pending autosave

### Imported attachment HTML attribute injection

The original loader accepts attachment `dataURL` values from imported projects and `popupHTML` placed them directly into a quoted image `src`. The generated HTML is supplied to Leaflet `bindPopup`. An isolated invocation of the real popup function confirmed that a harmless quoted value could add an unintended `data-audit` attribute.

The image source is now escaped using the application's existing `esc` function. Synthetic tests show that quotes/markup remain inside the attribute, ordinary image URLs still display identically, and the original attachment bytes remain unchanged for save/export. No script execution was attempted. This fixes that specific display sink; it does not establish that every import sink is safe.

### Pending edits on page hide

The original content/view saves waited 800 ms with no lifecycle flush. Pending edits could be missed when the tab closed before the callback ran. Both callbacks are now named functions that clear their pending timer identifiers. `visibilitychange` to hidden and `pagehide` flush only actual pending work, so duplicate events do not trigger duplicate writes.

The existing content-arming rule still prevents a blank startup from replacing a previous autosave. Attachment quota fallback, the periodic full-save retry, migration only after a successful write and import rollback cancellation remain intact. Explicit save-file and stored schema behavior are unchanged. A process crash or forced device shutdown can still prevent browser lifecycle events; this is improved normal lifecycle handling, not a guarantee against every shutdown.

The beta README now names the beta app/manual URLs and removes its stale build-folder reference.

## Remaining review items

### P1 — complete the imported-content boundary review

Adjacent imported layer keys and colors still reach HTML/SVG string interpolation through `makeLayer`, `buildLayerRow` and `frameSVG`. Their schemas and all display sinks need a systematic audit; the attachment fix is deliberately not presented as a complete import security solution.

Recommended next step: validate import types, identifiers and uniqueness before mutating the current project; use DOM property assignment where practical and escape remaining text/attribute sinks. Preserve older valid saved-project formats and test malformed imports against synthetic fixtures. Never use real saved projects in CI.

### P3 — measure optional embedded asset cost before changing packaging

The app is a self-contained HTML file with embedded libraries and compressed models. After measuring a real cold start on supported phone/tablet browsers, consider separating optional assets while keeping the documented downloadable/offline use case working. Splitting assets without an offline migration test would risk regressing the workflow, so this patch only removes the proven duplicate precache download.
