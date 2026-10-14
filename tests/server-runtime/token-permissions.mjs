import { createSystem } from './system.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const system = await createSystem();
try {
  // Reproduce the explicit grants found in production, not just defaults.
  await system.db.exec('GRANT EXECUTE ON FUNCTION public.inspect_ech_review_token_v24(text) TO anon, authenticated;');
  await system.db.exec(await fs.readFile(new URL('../../server/release/ECH_TOKEN_INSPECTION_SERVICE_ONLY.sql', import.meta.url), 'utf8'));
  const job = await system.seed();
  for (const role of ['anon', 'authenticated']) {
    await system.db.exec(`SET ROLE ${role}`);
    await assert.rejects(system.db.query('SELECT public.inspect_ech_review_token_v24($1)', [job.token]), /permission denied/);
    await system.db.exec('RESET ROLE');
  }
  const privileges = (await system.db.query("SELECT has_function_privilege('anon', 'public.inspect_ech_review_token_v24(text)', 'execute') a, has_function_privilege('authenticated', 'public.inspect_ech_review_token_v24(text)', 'execute') u, has_function_privilege('service_role', 'public.inspect_ech_review_token_v24(text)', 'execute') s")).rows[0];
  assert.deepEqual(privileges, { a: false, u: false, s: true });
  const { digest } = await import('./system.mjs');
  await system.db.exec('SET ROLE service_role');
  const inspected = await system.rpc('inspect_ech_review_token_v24', { p_token_hash: digest(job.token) });
  assert.equal(inspected.queueId, job.id);
  await system.db.exec('RESET ROLE');
  console.log('Token inspection: anonymous and signed-in callers denied; backend inspection retained.');
} finally { await system.close(); }
