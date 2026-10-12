# ECH receiver release candidate

baseline/ is the preserved deployed reviewv9/PINv1 source and SQL/schema metadata. It contains no live credential values or production records. candidate/ holds additive v24 code. shared/listing-core.ts is the same renderer as builder-core.js with module exports.

Local verification:

```
node tests/unit.mjs
node tests/recovery-regressions.mjs
cd tests/server-runtime
pnpm install --frozen-lockfile --ignore-scripts
cd ../..
node tests/server-runtime/integration.mjs
ECH_LOCAL_PORT=8894 node tests/server-runtime/serve.mjs
```

Open the printed localhost URL, run the full-server workflow, then use ?phase=resume, restart the isolated system through its test control and use ?phase=restart, then ?phase=next. Stop/start the test server process, and open /tests/process-restart.html for independent process-recovery verification. Never enter a real PIN/token in this local fixture. Synthetic test PIN123456 is seeded only in its isolated database. PGlite is a test engine, not a proposed mini production database or worker.

For approved release only, concatenate candidate/sql/*.sql in filename order inside one transaction; these add versioned functions and service-role grants without replacing the current APIs. Deploy the candidate review/PIN sources to the two versioned slugs in SERVER_INTEGRATION_RECEIPT_2026-10-12.md. Include shared/listing-core.ts as the review function's relative dependency. Default allowed origin remains the existing Studio origin; no staging origin setting is needed for production. Static Pages/config must follow successful hosted backend verification.

Do not execute release SQL or deploy based on this README. Lee's current production and source-transfer approval is still required. No publication, credentials, schedule or inventory action is part of the receive-only package.
