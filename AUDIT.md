# PED code review — 25 October 2026

Reviewed the published `beta/` app, its offline worker and the retired root routes. This is a source review and an automated worker regression check, not a claim that every browser, import format or operational feature has been exercised. No user project files were used. The application monolith and its embedded vendor libraries are unchanged in this patch.

## Implemented: isolate and preserve the offline app

The old `beta/sw.js` activation deleted **every other cache on rbmglobal.co.uk**. The fetch handler also intercepted every same-origin GET, cached HTTP errors and fell back to app HTML for missing images/manuals. These faults could break other installed apps or poison PED's offline copy during a server failure.

The worker now:

- Deletes only numbered, old `ped-beta-` shell caches; preserves LZ, OCR, other applications and non-shell caches.
- Handles only eight explicit PED beta shell resources. Other pages, tiles, data requests, POSTs and range requests bypass it.
- Preserves and serves the last good file when the network fails or returns an HTTP error. Redirected responses and failed downloads never replace the cache.
- Uses only its current named cache. A missing icon or manual cannot receive app HTML by mistake.
- Saves one copy of `index.html`, shared by directory and query-string URLs, instead of two copies. At the reviewed revision this removes **7,699,402 bytes** of duplicate shell content from the explicit precache list; browser overhead/compression may differ.
- Keeps background cache writes alive without allowing cache/storage failures to prevent an otherwise valid online response.

Root redirects, retirement worker, localStorage keys, project data and UI/layout are untouched. The beta cache version changes from 8 to 9.

### Validation

Run with Node 20 or newer:

```sh
node --test tests/service-worker.test.cjs
```

The same command runs in GitHub Actions on pull requests and pushes to main, using Node 22 and read-only repository permissions.

Eleven passing tests cover installation, cache isolation, non-shell bypass, successful refresh, query/root aliases, HTTP errors, missing-file behavior, unavailable storage, redirects and actual retirement-worker navigation. Tests execute the real worker scripts in a VM with simulated browser APIs. Installation checks that each shell asset exists in the repository. A real-browser upgrade/offline smoke test is still needed before merging/deploying; these tests do not simulate browser worker lifecycle or storage eviction fully.

## Follow-up findings (not fixed by this bounded patch)

### P1 — imported project values cross HTML attribute boundaries

Source trace, `beta/index.html`:

1. Lines 3388–3389 parse an imported project and call `loadProjectChecked`.
2. Line 6133 accepts any truthy attachment `dataURL` from the project.
3. Line 2151 interpolates that value directly into a quoted `<img src="...">` in `popupHTML`, after only testing the `data:image` prefix.
4. Line 2284 passes the generated HTML to Leaflet `bindPopup`.

A local, isolated invocation of the real `popupHTML` function used a harmless attachment value with an additional `data-audit` attribute after a quote. The returned HTML contained that additional attribute outside `src`. This confirms an HTML attribute injection path; executing a script in a live browser was deliberately not part of this review. A crafted imported file can therefore influence DOM markup on the same origin as the other tools and their browser storage. This is the first follow-up to address.

Adjacent imported layer keys and colors also reach HTML/SVG string interpolation (`makeLayer`, line 1875; `buildLayerRow`, line 2393; `frameSVG`, line 1907). These need a systematic boundary review rather than treating one escaped attachment field as a complete fix.

Recommended next step: use DOM property assignment for attachment URLs, validate allowed data URL formats, validate import schema/types/identifier uniqueness before mutating the current project, and escape all remaining text/attribute sinks. Preserve older valid saved-project formats and test malformed imports against synthetic fixtures. Never use real saved projects in CI.

### P2 — recent edits can miss the browser autosave on close/background

`scheduleAutosave` at lines 1798–1827 waits 800 ms before writing. `scheduleViewSave` has the same delay at lines 1792–1796. There is no `pagehide` or `visibilitychange` flush handler in the reviewed application. A tab closed before the pending callback runs loses that pending write; mobile background suspension can delay it as well.

Reproduction to verify in a browser: make an edit to a synthetic existing project, reload within 800 ms, and restore. Compare with a reload after the timer has fired. This was identified from the timer/lifecycle code, not an executed browser reproduction.

Recommended next step: isolate the existing storage routine into a flush function, flush only pending dirty work on `visibilitychange` to hidden and `pagehide`, and preserve the current rule that opening a blank page never overwrites a previous autosave. Test quota errors, saved attachments, legacy-key migration and cancellation/rollback during imports.

### P3 — documentation and load-size maintenance

`beta/README.md` still advertises the retired root URL and references build-folder notes that are absent from this repository. Align the documentation with the beta-only publication arrangement.

The current app is a 7.7 MB self-contained HTML file with embedded libraries and compressed models. After measuring a real cold start on the supported phone/tablet browsers, consider separating optional OCR/vendor assets while keeping the documented downloadable/offline use case working. Splitting assets without an offline migration test would risk regressing the existing workflow, so this patch only removes the proven duplicate precache download.
