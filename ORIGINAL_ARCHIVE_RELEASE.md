# Full original photo archive

Prepared for live release after Lee authorized pushing and deploying the connected ECH/Paige workflow. This is application implementation, not a new handoff package.

New user-added photos and explicit Send to Lee archive original bytes in a separate private `ech-original-photos` bucket. Existing drafts are not silently bulk-imported on page load. Raw JPEG/PNG/WebP/HEIC/HEIF files up to32MiB remain separate from clean12MiB eBay JPEGs. The actual bytes determine the archived format; filenames/MIME claims cannot turn scripts into accepted images. Oversize or failed transfers retain device originals and block a falsely confirmed submission.

Original objects use fingerprinted paths and never upsert. Duplicate/lost upload replies verify existing bytes. Server receipts are immutable and private to service-role RPCs behind exact active physical-job permission. Original links survive return-to-Paige jobs without altering or copying the raw original. Fresh-browser recovery verifies the original fingerprint before restoring it. Lee's owner review offers private signed original links. Missing legacy originals are clearly labelled; normalized JPEGs are never certified as full originals.

Verification:15actual receiver/SQL/private-storage archive checks,34existing receiver integration checks, actual correction/recover/resubmit cycle with original identity retained,18client safety checks,36valid client/server HTML/title parity cases, strict receiver/admin type checks, Hub types/lint/build, and actual browser capture, fresh-profile cloud recovery, send/lost-response recovery, true process restart and next-item separation. All data in these tests is synthetic and isolated; no real eBay action or original import was used as a readiness test.

Release order: apply `server/release/ECH_ORIGINAL_ARCHIVE.sql`, then the updated `ECH_CORRECTION_LIFECYCLE.sql`; deploy the exact versioned receiver/shared renderer and admin; deploy the corresponding Hub and rc5 client. Preserve legacy functions and all schedules. eBay write switches remain blocked. Do not manufacture missing historical originals or bulk-transfer old private images without exact approval.
