## Full-original archive release — rc5

The new private archive, exact-byte recovery, owner original links and correction lineage are implemented. See ORIGINAL_ARCHIVE_RELEASE.md for current verification and release order. Deployment payloads are regenerated from current source; older receipts below are dated history. Device originals remain a backup; cloud archive and original availability are certified separately.

## Live correction release under verification — October 12

Lee authorized app pushes/deployments and cancelled the interim handoff. rc4 adds clear returned-item instructions and isolated correction/recovery/resubmission coverage. Existing local originals and completed receipts are retained. Additive SQL and versioned backend services are activated before client rollout; no legacy function is replaced. Default eBay writes remain blocked and schedules are unchanged. Actual receiver/PIN/PostgreSQL correction cycle and existing34 integration +18 safety checks pass. Hosted verification remains required before claiming completion.

# ECH application first stabilization

This isolated candidate starts from deployed v23 bfd4f0f6aac28ab1fa8b78213c7a522492487420. It is not deployed. Production and all live inventory/queues remain unchanged.

## Working locally

- IndexedDB stores the exact original file and draft corrections per job/product identity. Original archive is independent of the selected gallery: removing a listing photo does not erase its original. Export originals for backup; this is device-local storage, not cross-device durability or cloud original storage.
- Failed local saves block advancement/sending; failed cloud saves preserve current photos. The current cloud receiver still supplies durable review receipts for normal production workflows; local testing uses an isolated synthetic mock.
- Local recovery restores exact original bytes and user corrections after reopening. Cloud recovery cannot replace a newer user's edits. Submitted receipt detection prevents duplicate sending in tested mock behavior.
- Physical quantity/contents require a human checkbox; no initial condition is chosen. N1 new/unused remains separate from opened packaging; O2 genuinely used and D3 demo remain separate.
- Serial is private review data, never public description. Known defects and missing components are disclosed; empty technical values trigger a warning rather than invented specifications.
- Clean JPEG exports are distinct from ECH watermarked internal reference copies. Originals remain intact. Do not use reference copies in eBay galleries: https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370
- Current client holds, Sony ES identification, exact-owned AudioQuest scope and wholesale Episode/Triad gate retained. Server-side enforcement remains essential.

## Run without installation or API keys

Node 22+; browser supporting IndexedDB, File/Blob, Canvas and Web Crypto. No npm package dependency, build step, paid API or ChatGPT session is needed.

```
node tests/unit.mjs
node tests/dev-server.mjs
```

Open the printed localhost acceptance URL. Press Run acceptance suite. Then open the same URL with `&resume=1` to exercise reopening and actual send-handler delivery to the mock receiver. Finally open with `&sent=1` to verify prior receipt recognition. The local server's CSP blocks non-local requests. This test mode disables service-worker registration and bypasses existing cache entries; production cache behavior needs separate phone acceptance. Stop the development server with Control-C.

For the normal static app development preview, a standard local static HTTP server can serve this checkout. The default review configuration points to production: do not enter production credentials, PINs or live queue tokens during candidate testing. Use only the synthetic acceptance server until a separately authorized staging integration exists. Static hosting remains GitHub Pages. No Mac mini service, launchd file or new schedule is provided or required for the listing UI.

## Outstanding acceptance gates

- Hosted Hub source version61 commit2070a35080fa3230dc6702ae20e31752b2328fc3 is not in the inspected GitHub main branch. Sites Git source access is currently unavailable; no source overwrite or credential issuance was attempted.
- Actual Paige phone usability, storage quota/private-mode behavior, cache update and real camera capture need human acceptance before production deployment.
- Current real review receiver must be verified with an isolated staging environment against new intake fields and current approval semantics; no production database fixture writes are authorized.
- Cloud backups of full-resolution originals, cross-device recovery and durable worker orchestration are not implemented here.
- Automated model identification, current supplier/sold-market/pricing research is not implemented inside this PWA. Existing approved prepared facts and source dates can be consumed; missing evidence is a warning or blocker, not guessed AI output. No new paid AI call is authorized.
- Future Mac mini research worker needs complete authoritative source, secure read access, supported report contract, restart/idempotency and independent operating proof. Do not install the old SQLite/SYSTEM worker.

Overall connected system is RED pending source reconciliation and production-path/phone acceptance. The repaired Studio candidate is YELLOW: local synthetic core is demonstrated, live integration and human acceptance remain incomplete. No GREEN declaration and no Mac mini transfer.

## Recovery and production boundary

Keep unsent work open on a storage/network error. Retry after access/storage is corrected. Do not clear site data or delete IndexedDB to recover; that can erase device-local originals. Recover by exact immutable queue/job ID; same-model physical units must stay distinct. Preserve prior source and the original dirty worktrees. Reverting source should preserve the new original archive until a tested backward-compatible recovery is available; older v23 does not surface that archive.

Lee separately approves each publication, revision, price/quantity change, ending, buyer communication, refund, offer acceptance, purchase, paid API expense, database/credential/deployment/schedule change. Paige's submit creates a review packet, never a published listing.
