# V1.2.2 — Invisible PWA updates

## Previous lifecycle (inspected before implementation)

On production startup, `setupOffline` registered `./sw.js`. The generated worker used a scope-specific content-hash cache and precached all 20 build artifacts, then checked each artifact's SHA-256 against its embedded manifest. Failed installs deleted only their candidate cache. Successful replacement workers waited while the active release had clients.

The app watched `registration.waiting`/installation state and displayed “Update ready · Reload”. Clicking sent `ACTIVATE` to the waiting worker, whose message handler called `skipWaiting()`. The app's `controllerchange` handler then reloaded. Activation deleted older caches in the same scope. The first install used the normal browser lifecycle; `ready` marked offline availability.

Baseline validation: 38 Node + 5 Python production tests, 2 Node + 3 Python research tests, and production build all pass.

## New lifecycle

The smallest change is removal of the update button/style, waiting-worker UI checks, ACTIVATE message handler, and controller-change reload listener. No custom activation orchestration, timers, focus polling, state migration or storage clearing was introduced.

1. Every production app startup still calls `navigator.serviceWorker.register('./sw.js')`. Registration and browser-managed in-scope navigation checks discover changed worker scripts. The browser schedules checks; this app promises no fixed detection deadline.
2. A candidate downloads into its own content-hash cache. Every artifact must pass the same embedded SHA-256 manifest verification before install succeeds. Existing rules runtime corpus/index/release identity validation also remains unchanged.
3. Successful install makes a replacement eligible, normally waiting. The app does not call `skipWaiting`, claim clients, or reload pages.
4. The browser can activate the waiting worker after the old worker no longer controls clients and its outstanding work completes. All app tabs/windows matter, including an installed PWA sharing that registration.
5. Only the activate event removes older caches with this app's scope-specific prefix. Unrelated caches are retained. The new worker then serves its own complete verified release cache.

This is standard lifecycle behavior, not an app-enforced activation deadline. [Browser lifecycle guidance](https://web.dev/articles/service-worker-lifecycle) explains why refresh alone need not release the old worker; [registration documentation](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register) describes registration/update behavior.

| Situation | Result |
|---|---|
| Ordinary tab startup | Registers/checks normally; complete replacements can wait without disturbing the tab |
| Browser reload | May still use A because old/new document lifetimes overlap; **not guaranteed** to activate B |
| Installed PWA launch | Uses the active release; if all old clients ended, a verified waiting release can activate before the new launch is served |
| Long-lived open PWA/tab | Can remain on A as long as it remains an old client; no idle detection, polling or forced reload |
| All old tabs/windows close, then reopen | Normal safe adoption boundary; browser activation scheduling still applies |
| Offline launch | Uses the last complete installed release; update checks may fail harmlessly |

An indefinitely open client can hold an old release indefinitely. This is the deliberate tradeoff for uninterrupted use, not a manual-update dependency. Bringing a suspended PWA to the foreground is not necessarily a new launch. No promise of update-on-every-refresh or background discovery deadline is made.

## Failure behavior and integrity

Download interruption, missing artifacts and hash mismatches reject installation and delete the failed candidate cache only. The active cache is not deleted while a replacement is installing or waiting. No failed candidate is manually activated. Existing offline users continue using the old release; initial-install failure still uses the existing offline-save failure message because there is no guaranteed offline copy yet.

Successful replacement installs are silent. `Available offline` remains tied to a ready active registration, not a waiting update. No update-management controls, notifications or replacement badges remain in the shipped UI. Already-open V1.2.1 code cannot be retroactively changed: its old button may remain until that session ends. The V1.2.2 worker deliberately does not honor forced activation messages from that older UI; closing old clients adopts the verified release safely.

Manifest/hash validation, rules corpus/index consistency, source metadata, card data and scope isolation are unchanged. No preferences or recents are cleared. Search, Back, New search and exact child state are not touched during an update. Closing a session has the existing application state semantics; this patch does not add persisted search-session restoration.

## Validation

- **50 automated tests pass:** 40 Node + 5 Python production; 2 Node + 3 Python research.
- Actual generated worker is executed in the existing VM cache/lifecycle harness. Checks include interrupted and corrupt installs, old cache survival, A still served while B waits, no activation message handler, activation-event-only cleanup, unrelated-cache preservation, and cold offline B corpus/index hydration and complete family reading.
- Actual app registration function is executed with browser event doubles. Waiting/install/redundant transitions leave the active user's status alone, register once, and add no controller-change reload handler. First-install failure remains visible.
- Assertions guard against reintroducing update UI, skipWaiting, client claiming or forced reload.
- All V1.2.1 family, card, search, recents, source-policy and offline regressions still pass.
- Production build passes: 20 hash-verified offline artifacts.
- All five full frozen evaluation variants rerun. All 66 production top-ten lists remain unchanged; split/prebuilt Hit@5 0.833333, MRR@10 0.699657, nDCG@5 0.715994. Detailed evaluation is in `experiments.json`.

### Real browser verification performed

Used temporary copies of the production build on a separate localhost scope. A test-only release label and lifecycle probe (not shipped) made release identity observable and invoked `registration.update()` to deterministically discover the next fixture without waiting for browser scheduling.

1. Loaded fixture A, established worker control, opened exact 702.22a.
2. Built fixture B with a different verified HTML marker. Triggered the test-only update check. B reached waiting; A's rule URL and focused-child presentation remained intact. No production update control existed.
3. Ordinary reload still served A, confirming the documented limitation.
4. Closed the last A tab and reopened. B appeared automatically, without an activation message.
5. Published candidate C with a deliberately corrupted rules index after generating its manifest. C did not become waiting/active; B remained usable, including Sol Ring detail.
6. Stopped the local server, closed/reopened the tab. B cold-started offline, retained the Sol Ring recent, and searched/opened 702.22a with all 12 family members.

Interrupted-download behavior is covered by the generated-worker simulation; the real-browser failure check used a hash-mismatched candidate. Physical installed-PWA tests have **not** been performed.

### Real phone / installed PWA checklist

1. Install/open A online, then make B available. Use card search and child-focused rules while the browser discovers/downloads B. Confirm no update notification or interruption.
2. Reload once; A may remain. Close **all** app tabs and installed windows, then fully relaunch. Confirm B once installation/activation has completed.
3. Disable networking, fully close/relaunch, and verify B card/rules search, references, Back, recents and theme.
4. Start downloading another release and interrupt connectivity. Fully relaunch offline: the previous complete release must still work. Retry online later.
5. Repeat on iOS Safari standalone and Android Chrome standalone. Also leave another app tab open to confirm it delays activation safely. Mere backgrounding is not necessarily closure.

## Payload and scope

Main JS decreases **305 bytes** (19,717 → 19,412); CSS decreases **107 bytes** (10,008 → 9,901). Together, 124 fewer gzip bytes using the same Python gzip settings on both builds. Generated SW decreases 16 bytes; rules worker is byte-identical. `payload.json` records sizes and data comparisons. No additional startup requests or recurring checks were added; fewer listeners and no update UI bookkeeping are required. No new startup timing claim is made for this small removal.

All five data files, including rules release metadata, are byte-identical to the pre-change production build. Corpus/parser/index, ranking/routing, card details, rule-family layout, authoritative text, snapshot/effective-date handling, preferences and navigation logic are unchanged. Package version is 1.2.2. Nothing was deployed or pushed.
