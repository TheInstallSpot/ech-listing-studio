# ECH Studio server integration — October 12, 2026

The existing live v23 app was not changed or shown broken by this work. Earlier normal-operation acceptance remains valid for its captured scope. This is an isolated v24rc3 successor and additive server package, prepared under Lee's instruction to continue through end-to-end integration.

## Working end to end in isolation

Actual deployed review v9 / PIN v1 sources and six SQL functions were read from project qrhajotxduywvqmztvjq. Their preserved source/schema fingerprints are in server/BASELINE_MANIFEST.json. The candidate runs the actual receiver code and actual PL/pgSQL, with pgcrypto, in local PostgreSQL/PGlite0.5.9. Storage uses isolated disk-backed objects. Only the managed Supabase HTTP/storage adapter, auth-role setting and schema bootstrap are local test substitutes. No production records or credential values were copied.

34 server/SQL integration checks PASS;19 full-browser/server checks PASS;18 source/safety/cache checks and4 recovery regression checks PASS. Browser test photos are generated synthetic images, not real stock. Tests use the actual app's PIN submit, prepared queue selection, JPEG encoding, IndexedDB, cloud client and send handler. They verify correction/original recovery, private serial stripping from public HTML, independent PostgreSQL receipt readback, one review after lost commit response, durable DB/storage reopen, session reconnect, and a same-SKU next job with no inherited photos/serial/condition. No eBay publication occurs.

An early browser failure was a test-adapter URL error: the local signed photo link used an unreachable .invalid host. That adapter was corrected. It was not evidence that the existing hosted app had failed. The final corrected run passes all four browser phases.

## Candidate changes

- Preserved v24rc2 autosave notification and job-scoped photo cache/retirement fixes.
- Distinct queueId in submission; productId remains compatible with real production payloads, where17of18ready jobs use SKU as productId. It must never be mistaken for physical queue identity.
- Switching physical jobs clears prior photos even when SKU matches. Queue selection preserves exact job identity.
- Server enforces exact physical job, human contents/quantity confirmation, approved commercial/category/fulfillment/product identity and current channel holds before writes.
- Public HTML/title are rendered by the same reviewed structured renderer; dedicated serial remains private. Server item allowlist removes injected tokens/unknown fields. Missing-spec warnings are computed by server and stored for Lee.
- A committed review with a lost response is recovered through the existing durable receipt instead of producing an uncertain failure/duplicate.
- New SQL receiving functions revoke PUBLIC execution and grant service_role only. New receive-only endpoints use existing server-secret retrieval and revocable item/PIN permissions; no new eBay key, API key or paid call.
- Client/cache/config revisions advance to v24rc3, including the PIN client and receiver config.

## Additive release plan

No existing receiver/PIN function, public RPC, table, queue row, token, schedule or eBay endpoint is replaced by the candidate server package. It adds:

1. ech_review_allowed_v24 plus inspect_ech_review_token_v24, ech_draft_state_v24, accept_ech_listing_review_v24 and ech_pin_queue_v24; service-role grants only.
2. Edge endpoints ech-listing-review-v24 and ech-paige-pin-v24 in qrhajotxduywvqmztvjq. JWT gateway checking is false because these endpoints authenticate custom revocable PIN/item bearer permissions; it is not anonymous business authorization. Default allowed Origin stays https://theinstallspot.github.io.
3. Only after those endpoints are hosted/verified, the v24rc3 Studio source/config would be sent to TheInstallSpot/ech-listing-studio and published. Existing v23 endpoints and original SQL remain for old active sessions and rollback. Do not clear unsent photos or device originals during any rollout.

Compatibility regression: with additive SQL loaded, the untouched v23 receiver accepted a legacy packet lacking queueId/quantityConfirmed. The tests use real productId=SKU formatting, not a fabricated queue-ID convention. New candidate routes reject wrong queue IDs without modifying old packets.

## Evidence and limits

Fresh phase evidence: tests/runtime-evidence/server-integration.json and real-server-browser-{capture,resume,restart,next}.json. tests/server-runtime/package.json/pnpm-lock.yaml pin the local test dependency; no dependency is required by the static production app or receiver itself. server/candidate is the only proposed production-server change; server/baseline is preserved read-only evidence; tests/server-runtime/.runtime and memory-preservation are ignored and must not be transferred.

This proves isolated app/receiver/SQL behavior. It does not certify Supabase's hosted Edge/Deno deployment, production RLS/storage configuration, the hosted Hub source revision, Paige's actual camera/iOS quota/cache behavior, full-resolution cloud original backup, or any Mac mini worker. The shared Hub consumes the same review tables and receipt shape; the local Lee-review view is a test view, not a replacement/deployed Hub.

No push, deployment, production SQL mutation, real PIN/login/queue renewal, listing/price/cost/inventory write, schedule enabling/migration, credential change or remote-chat message. The eBay Agent's older candidate push prompt remains untouched. A separate final production/source-transfer approval is required by Lee's original no-deploy/no-production-change instruction.
