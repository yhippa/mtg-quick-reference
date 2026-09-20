# MTG Quick Reference

A mobile-first, offline Magic: The Gathering card reference. Type a name, tap a result, and read Oracle text and dated card-specific rulings. No accounts, prices, collection tools, runtime APIs, or server database.

## Run locally

Requires Node.js 24+ and Python 3.10+ (Python standard library only).

```sh
npm ci
npm run dev
```

A complete reduced dataset is included, so development does not require downloading upstream data. For production/offline testing:

```sh
npm test
npm run build
npm run preview
```

Open the printed localhost URL. The service worker is enabled only in production; use HTTPS or localhost. Plain HTTP on a phone's LAN address cannot install a service worker. Production output is in `dist/`. Vite's relative base and relative manifest/worker paths support both GitHub project paths and domain roots.

## Deploy to GitHub Pages

1. Create a GitHub repository and push these files to its `main` branch, including `package-lock.json` and `public/data/`.
2. In the repository, open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Open **Actions → Build, refresh data, and deploy Pages → Run workflow**. Future pushes to `main` run it automatically. Allow Actions if the repository has workflows disabled.
4. Wait for the deployment job to succeed. Its environment link and Settings → Pages show the exact HTTPS address (usually `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`).
5. Open that address on your phone while online. Wait for **Available offline** before disconnecting.
6. On iPhone, use Safari's **Share → Add to Home Screen**. On Android, use Chrome's menu **Install app** or **Add to Home screen**. The reference also works in an ordinary browser tab.
7. Turn on airplane mode, reopen the app and look up a card to verify that your phone retained its offline copy.

No repository has been published or Pages settings changed by the local build. No secret API keys are needed. The workflow requests only repository read, Pages write and OIDC deployment permissions. For private repositories, Pages availability depends on your GitHub plan/settings.

## Data pipeline and attribution

```sh
npm run data
# Or reduce an already downloaded source, without network access:
python3 scripts/build_data.py --input /path/to/AtomicCards.json.gz
```

The Python script downloads [MTGJSON AtomicCards](https://mtgjson.com/downloads/all-files/), a printing-independent bulk file containing names, rules text and official card rulings. It retains mana cost, type, rules text, power/toughness, loyalty, defense, face names and dated rulings. It preserves separate faces for transform, modal double-faced, split, adventure and other layouts. Duplicate face records and duplicate rulings are removed; rulings are oldest-first, with text as a deterministic tie-breaker. It includes all identities supplied by AtomicCards, including digital and unusual cards; it is not a format-legality filter.

An optional upstream EDHREC rank is retained only as a search relevance tie-breaker; it is not displayed. No popularity or card API is called at runtime. Data generation validates nonempty output and writes the card artifact through an atomic rename. A failed download/parse leaves the previous artifact intact. `stats.json` records the source date, identity count, byte size and estimated gzip size. Source files are not shipped to the browser.

See the [Atomic card model](https://mtgjson.com/data-models/card/card-atomic/) and [ruling model](https://mtgjson.com/data-models/rulings/). MTGJSON's [MIT license](https://mtgjson.com/license/) and copyright notice are reproduced in `public/NOTICE.txt`, which ships with the site. Magic card names and text remain Wizards of the Coast intellectual property; this is an unofficial fan reference with visible attribution, not a Wizards product. MTGJSON's software license does not transfer rights to Wizards' material.

## Architecture and search

Vanilla TypeScript renders accessible HTML with CSS system/light/dark themes. Vite and TypeScript are the only npm development dependencies; there are no runtime dependencies, remote fonts or artwork requests.

The dataset is fetched once per page session. Names and face names are normalized and tokenized once. Every keystroke scans that compact name index and returns at most 20 cards. Exact matches rank first, followed by leading whole-word matches, other whole-word matches, name prefixes, word prefixes, multiple partial words and substrings. Popularity breaks ties within a match category, followed by matching-name length and deterministic source order. Accents, case, apostrophes and punctuation are normalized. Oracle text is not searched.

Back navigation preserves the query; card links use hash routes so static hosting needs no URL rewrites. Enter opens the first result, Escape returns from details, and `/` focuses search. Mana costs, Oracle text and rulings share inline visual symbols with accessible labels (including tap/untap, colorless, hybrid and Phyrexian mana). Symbols use local CSS and text glyphs, so no external fonts or images are required; unknown notation stays readable. All source content is HTML-escaped. Autofocus is requested, but mobile browsers may require a tap before showing the keyboard.

## Offline and updates

`build-sw.mjs` hashes the entire production output (including data) to name a versioned cache and generates `sw.js`. Installation caches the complete app and dataset; if any request fails, that new cache is discarded and the previous active worker remains available. The app shows **Available offline** after an active worker is ready. The first visit must finish saving before an offline launch can work.

Controlled visits serve a consistent cached snapshot, including the dataset. The browser checks `sw.js` on registration on subsequent launches. A fully installed update waits and shows **Update ready · Reload**. Activating it swaps to the new snapshot and reloads the app. Failed or interrupted installs do not replace the previous version. Cache names are scoped by site path so another app's caches are not removed. There is no separate live-data update that can mismatch the app schema.

The first load parses the dataset and builds the name index before searching; the search field accepts typing during that load. The initial service-worker installation also downloads its own complete snapshot, so cold-start traffic can approach twice the dataset transfer. Subsequent controlled loads read local cache. Browser storage can be evicted, especially in private browsing or under storage pressure; revisit online if that happens. Data represents the displayed snapshot date and cannot refresh while offline.

## Automatic refresh

`.github/workflows/pages.yml` runs on pushes to `main`, manual dispatch and Mondays at 07:23 UTC. Every run downloads fresh bulk data, runs tests, builds the static app, reports benchmark output and deploys with the official Pages actions. Refreshes deploy directly; they do not commit generated data back to the repository. Run `npm run data` locally when you want to update the checked-in development snapshot.

A failed refresh/build prevents deployment, leaving the last successful Pages deployment available. Scheduled workflows run from the default branch (set it to `main`); GitHub may delay schedules or disable them in inactive public repositories. Inspect Actions for failures or re-enable schedules there.

## Measurements

Snapshot date: **2026-09-19**. Measured locally with Node.js 24; these are desktop measurements, not a claim about phone performance.

| Item | Measurement |
|---|---:|
| Searchable card identities | 35,282 |
| Reduced JSON | 29,228,731 bytes (29.23 MB) |
| Gzip estimate | 6,732,474 bytes (6.73 MB) |
| JS bundle | about 8.7 kB / 3.7 kB gzip |
| CSS bundle | about 6.6 kB / 2.1 kB gzip |
| Read + parse JSON | about 103 ms |
| Build name index | about 68 ms |
| Median search | about 2.8 ms |
| 95th-percentile search | about 6.6 ms |

Run `npm run bench` to reproduce the parse/index and 300-query timing sample. `npm run data` reports exact current dataset sizes; `npm run build` reports bundle sizes. Gzip size is an estimate of compressed transfer, not a measured GitHub Pages response. On a 10 Mbit/s connection, 6.73 MB alone takes roughly 5.4 seconds to transfer, before latency and parsing. Offline launches eliminate that transfer. Keep the full dataset cached before going to a game.

These measurements support a simple linear scan instead of a search dependency or database. The full retained text and rulings still occupy memory after parsing (more than the JSON byte size). Phone-specific timing/memory and first-load compression should be measured on the eventual deployment before considering data sharding or a worker.

## Tests and manual checks

`npm test` uses Node's test runner and Python unittest. It covers normalization, ranking, matching back faces, query limits, multi-face transformations, optional stats, rulings order/deduplication, and generated service-worker rollback/cache isolation. There is no large test framework.

Verified during V1 development: 375px search layout, card details, query-preserving Back, and Safari reload/search/multi-face rulings with the preview server stopped. Service-worker rollback is also covered by an automated simulated interrupted install. Physical phone installation remains a deployment check.

Before shipping changes, run `npm test`, `npm run build`, and `npm run bench`. In a production preview, test `bolt`, `sheold`, a split/adventure card, query-preserving Back, theme changes, keyboard access, a reload without the server, and an interrupted update. Check 375px phone layouts and installability on your target phone.

## Deliberately deferred

No deck building, collection, pricing or account features. Potential future work is limited to measured needs: smaller first-download shards, background indexing on slow phones, and optional language support.
