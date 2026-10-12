# ECH Studio repairs — October 12, 2026

Release candidate 0.24.0-rc.2, based on preserved local candidate 986ba614aa70b3a1f33bd750dc0fa042f8c0df91. Local application repairs authorized by Lee's request to start fixing. Production and schedules remain untouched.

Fixed:

1. Legacy localStorage failure no longer suppresses the event that triggers independent IndexedDB originals/correction storage. Actual browser tests deliberately reject legacy writes, then verify original files and changed text remain in IndexedDB.
2. Cloud photo-reference cache is scoped to immutable draft identity plus upload permission and content hash. Identical photos under two jobs sharing a SKU receive independent uploads; retry reuses only the same job's acknowledged reference. Permission values remain in memory; no new persisted credential field.
3. Sending a review captures the immutable draft identity before asynchronous work and removes only that job. Same-SKU siblings and ambiguous legacy rows survive. No inventory or cloud queue deletion occurs.

Cache/script revisions advance to v24rc2; package test command includes the new recovery regression suite. The local test server preserves phase-specific evidence for future runs.

Validation: 18 source/safety/cache checks, 4 targeted recovery regression checks, and 77 real-browser assertions passed. Browser fixtures cover six synthetic classifications, full legacy cache, failed local/cloud save, corrections, original bytes, separate clean/reference exports, reopening, actual mock send handler and duplicate receipt reopening. Evidence: tests/runtime-evidence/intake-results.json, reopen-results.json, receipt-results.json, mock-review-*.json. They are synthetic local evidence, not production records. The browser test's CSP restricts requests to localhost and disables service-worker registration; real phone/cache/server acceptance is separate.

Preserved existing dirty checkouts and canonical Documents project files. This checkout lives in the authorized Agent Desk workspace. No push, deployment, schedule, production queue, credentials, eBay listings, supplier purchase or paid call. Existing ECH holds, unit/condition gates and Lee publication approval remain.

Next engineering phase: reconcile authoritative hosted Hub/server source and build an isolated staging integration for the reviewed candidate. This repair receipt closes the three identified local code defects; it does not label the entire always-on system accepted.
