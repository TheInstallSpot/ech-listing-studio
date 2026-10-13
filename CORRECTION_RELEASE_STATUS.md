# Paige correction release

rc4 retains rc3 original-photo saving, cloud drafts, one-item selection, physical condition checks, private-field exclusions, receipt-safe retries and next-item recovery. It adds clear management correction instructions and a tested return/recover/resubmit cycle.

The Hub's return action creates a separate correction job and copies verified normalized draft photos. This does not constitute a full-resolution cloud original archive. Previous local full-resolution originals remain retained. Every correction starts with condition unselected and quantity confirmation unchecked, and results in a fresh Lee review. Original review/photos and used permission remain intact. Rejection retains the submission without creating a new job.

Exact additive receiver SQL is `server/release/ADDITIVE_RECEIVER_SQL.sql`; correction SQL is `server/release/ECH_CORRECTION_LIFECYCLE.sql`. Versioned receivers activate before this public client. Existing legacy receivers and all production schedules remain unchanged. Do not use publication or real review decisions as readiness tests.

Verification: existing34 actual receiving/PIN/PostgreSQL checks,18 source/safety checks and actual return/recover/resubmit/retry lifecycle pass in isolated fixtures. Hosted deployment and operator device acceptance are verified separately.
