# 24rc23-recovery-integrity — November 27, 2026

- Normalize new captures once. Keep the exact normalized JPEG in local drafts and recover its checksum-verified bytes separately from the full original. Reopening must not re-encode JPEGs or invalidate original associations.
- Reconcile approved identity, title, unit and quantities only for the same physical queue ID. Preserve operator inspection/correction fields and all photos. Reset contents confirmation only when managed contents/counts changed.
- Check a server receipt before Send writes and again after an ambiguous submission response. A confirmed completed job can leave the work screen without retrying an expired upload.
- Validate prepared sale units/required facts/title lengths before capture. Server queue marks hidden authorization-unit mismatches without disclosing commercial fields.
- Existing device drafts, original archives, immutable cloud versions, PIN sessions and prior offline caches are retained. No eBay publication capability added to Paige.

Validation: full unit/recovery/switch/update suite; original archive and correction integration; current deployed receiver/client HTML parity; draft upgrade and upload boundaries; prepared contract and queue SQL checks. Chrome actual-app/current receiver/PostgreSQL test used a complex real JPEG, exact normalized/original fingerprint checks, reopen, lost commit response, server restart and same-SKU next job. Capturing/reopening/sending passed without repeating photos. Test evidence under tests/runtime-evidence (ignored generated files).

Production acceptance still requires a real phone capture on this release; desktop Chrome and synthetic local inventory do not certify iOS camera behavior. No photos or drafts deleted. Rollback app shell to e30a166 while retaining all archives if necessary; backend queue guard only adds an error marker, with unchanged existing permissions.
