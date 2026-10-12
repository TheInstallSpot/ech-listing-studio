const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const BUCKET = 'ech-review-photos';
import {build, ebayTitle} from '../../shared/listing-core.ts';
const ALLOWED_ORIGIN = Deno.env.get('ECH_STUDIO_ORIGIN') || 'https://theinstallspot.github.io';
const MAX_LISTING_BYTES = 262_144;
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MAX_PHOTOS = 24;
const ITEM_FIELDS = new Set(['cond','quantityConfirmed','sku','productId','availableQuantity','fulfillment',
  'isPassive','compatibilityNote','catalogNote','ebayCategoryId','ebayCategoryName','ebayCategoryPath',
  'ebayCategoryVerifiedAt','targetPrice','shippingPlan','researchNotes','brand','part','what','sold','title',
  'hook','pdesc','mounting','box','spec','ver','serialNumber','packaging','defects']);
function cleanItem(item: Record<string, unknown>, draft = false) {
  return Object.fromEntries(Object.entries(item).filter(([key]) => ITEM_FIELDS.has(key) || (draft && key === '_draftId')));
}
const corsHeaders = (origin: string | null) => ({
  'access-control-allow-origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-max-age': '86400', vary: 'Origin',
});
const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: {
    ...corsHeaders(origin), 'content-type': 'application/json', 'cache-control': 'no-store',
  }});
function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
async function sha256(value: string | ArrayBuffer) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return hex(await crypto.subtle.digest('SHA-256', bytes));
}
async function rpc(name: string, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: {
      apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json',
    }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  const resultText = await response.text();
  if (!response.ok) {
    let message = 'Secure review validation failed.';
    try { message = (JSON.parse(resultText) as { message?: string }).message || message; } catch {}
    throw new Error(message);
  }
  return resultText ? JSON.parse(resultText) : null;
}
async function upload(path: string, file: File) {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`,
    { method: 'POST', headers: {
      apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'image/jpeg', 'x-upsert': 'false',
    }, body: file, signal: AbortSignal.timeout(30000) },
  );
  if (!response.ok) throw new Error('A review photo could not be stored safely.');
}
async function remove(paths: string[]) {
  if (!paths.length) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE', headers: {
      apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json',
    }, body: JSON.stringify({ prefixes: paths }), signal: AbortSignal.timeout(10000),
  }).catch(() => null);
}
function text(value: unknown, max: number) {
  return typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null;
}
function money(value: unknown) {
  const stringValue = typeof value === 'number' ? String(value) : value;
  if (typeof stringValue !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(stringValue)) return null;
  const numberValue = Number(stringValue);
  return Number.isFinite(numberValue) ? numberValue : null;
}
function integer(value: unknown) {
  const stringValue = typeof value === 'number' ? String(value) : value;
  if (typeof stringValue !== 'string' || !/^\d+$/.test(stringValue)) return null;
  const numberValue = Number(stringValue);
  return Number.isSafeInteger(numberValue) ? numberValue : null;
}
type ListingPacket = {
  queueId?: unknown;
  warnings?: unknown;
  schemaVersion?: unknown; reviewStatus?: unknown; preparedAt?: unknown; ebayTitle?: unknown;
  descriptionHtml?: unknown; photoManifest?: unknown; issues?: unknown; item?: Record<string, unknown>;
};
type TokenInspection = {
  queueId: string; recommendationId: string; sku: string;
  authorization: { sku?: string; saleUnit?: string; saleUnitLabel?: string;
    availableQuantity?: string; fulfillment?: string; targetPrice?: string; ebayCategoryId?: string; };
};
function packetError(packet: ListingPacket, expected: TokenInspection) {
  const item = packet.item;
  if (!item || packet.schemaVersion !== 1 || packet.reviewStatus !== 'awaiting_lee_approval')
    return 'This is not a supported Lee-review packet.';
  if (text(item.sku, 120) !== expected.sku) return 'The review token is for a different SKU.';
  for (const key of ['brand','part']) {
    const approved = (expected.authorization as Record<string, unknown>)[key];
    if (approved && String(item[key] || '') !== String(approved)) return 'The approved product identity changed.';
  }
  if (item.quantityConfirmed !== true) return 'Confirm the physical quantity and included contents.';
  if (packet.queueId !== expected.queueId)
    return 'The review is for a different physical job.';
  if (!['N1', 'O2', 'D3'].includes(String(item.cond || '')))
    return 'Choose the physical N1, O2, or D3 condition.';
  if (!['each', 'pair', 'kit', 'carton'].includes(String(expected.authorization.saleUnit || '')))
    return 'The exact sale unit is missing.';
  if (item.sold !== expected.authorization.saleUnitLabel) return 'The sale unit changed after Lee approved it.';
  if (integer(item.availableQuantity) !== integer(expected.authorization.availableQuantity))
    return 'The available quantity does not match Lee’s approval.';
  if (item.fulfillment !== expected.authorization.fulfillment) return 'The fulfillment type does not match Lee’s approval.';
  if (money(item.targetPrice) !== money(expected.authorization.targetPrice)) return 'The target price does not match Lee’s approval.';
  if (!/^\d{1,12}$/.test(String(expected.authorization.ebayCategoryId || '')))
    return 'The exact eBay category is missing from Lee’s approval.';
  if (String(item.ebayCategoryId || '') !== expected.authorization.ebayCategoryId)
    return 'The eBay category changed after Lee approved it.';
  if ('unitCost' in item || 'estimatedContribution' in item)
    return 'Private commercial values must stay in the Business Hub.';
  const title = text(packet.ebayTitle, 80);
  if (!title) return 'The eBay title is missing or longer than 80 characters.';
  if (!text(packet.descriptionHtml, 250_000)) return 'The required listing description is incomplete.';
  if (!Array.isArray(item.box) || !item.box.some((entry) => text(entry, 500))) return 'Add at least one exact “in the box” fact.';
  if (!Array.isArray(item.ver) || !item.ver.some((entry) => text(entry, 500))) return 'Add at least one verified product fact.';
  if (!Array.isArray(packet.photoManifest)) return 'The photo manifest is missing.';
  return null;
}
function jpegDimensions(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1]; offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
    if (offset + 2 > bytes.length) return null;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += length;
  }
  return null;
}
Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') {
    if (origin !== ALLOWED_ORIGIN) return json({ error: 'Origin not allowed.' }, 403, origin);
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin);
  if (origin !== ALLOWED_ORIGIN) return json({ error: 'Origin not allowed.' }, 403, origin);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Review service unavailable.' }, 503, origin);
  const match = request.headers.get('authorization')?.match(/^Bearer\s+([^\s]+)$/i);
  const reviewToken = match?.[1] || '';
  if (reviewToken.length < 48 || reviewToken.length > 256)
    return json({ error: 'The review token is missing or invalid.' }, 401, origin);
  const tokenHash = await sha256(reviewToken);
  // Consume the incoming multipart stream before making an outbound RPC.
  // No files are stored and no listing is accepted before token validation.
  console.info('review-stage: receiving-body');
  let form: FormData;
  let bodyTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    form = await Promise.race([request.formData(), new Promise<never>((_, reject) => {
      bodyTimer = setTimeout(() => reject(new Error('upload timeout')), 60000);
    })]);
  } catch { return json({ error: 'The photo transfer did not finish. Keep this page open; your photos have not been cleared.' }, 408, origin); }
  finally { clearTimeout(bodyTimer); }
  console.info('review-stage: body-received');
  let expected: TokenInspection | null;
  console.info('review-stage: authorization');
  try {
    expected = await rpc('inspect_ech_review_token_v24', { p_token_hash: tokenHash }) as TokenInspection | null;
  } catch {
    return json({ error: 'The review service could not verify this item. Your photos remain in this page; please try again.' }, 503, origin);
  }
  if (!expected) {
    try {
      const receipt = await rpc('ech_review_receipt', { p_token_hash: tokenHash });
      if (receipt) return json(receipt, 200, origin);
    } catch {}
    return json({ error: 'The review token is expired or already used.' }, 401, origin);
  }
  const mode = form.get('mode');
  if (mode === 'photo') {
    try {
      const file = form.get('photo');
      if (!(file instanceof File) || file.type !== 'image/jpeg' || file.size < 1 || file.size > MAX_PHOTO_BYTES)
        return json({ error: 'Use a JPEG photo under 12 MB.' }, 422, origin);
      const buffer = await file.arrayBuffer(), dimensions = jpegDimensions(buffer);
      if (!dimensions || dimensions.width + dimensions.height > 15000) return json({ error: 'Invalid photo dimensions.' }, 422, origin);
      const hash = await sha256(buffer);
      const path = `${expected.sku}/drafts/${expected.queueId}/${hash}.jpeg`;
      // Same bytes use the same path, so retries cannot create duplicate photos.
      const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST', headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`,
          'content-type': 'image/jpeg', 'x-upsert': 'true' }, body: buffer, signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error('Photo storage unavailable.');
      return json({ photo: { storagePath: path, originalName: file.name, mimeType: 'image/jpeg',
        sizeBytes: file.size, sha256: hash, ...dimensions } }, 201, origin);
    } catch { return json({ error: 'Photo not confirmed saved. Please retry on this page.' }, 503, origin); }
  }
  if (mode === 'draft-save' || mode === 'draft-read') {
    try {
      const raw = form.get('snapshot');
      if (mode === 'draft-save' && (typeof raw !== 'string' || raw.length > MAX_LISTING_BYTES))
        return json({ error: 'Draft is missing or too large.' }, 422, origin);
      const incoming = mode === 'draft-save' ? JSON.parse(String(raw)) : null;
      if (incoming?.item) incoming.item = cleanItem(incoming.item, true);
      const snapshot = await rpc('ech_draft_state_v24', { p_token_hash: tokenHash,
        p_snapshot: incoming });
      if (mode === 'draft-read' && snapshot && Array.isArray(snapshot.photos)) {
        for (const photo of snapshot.photos) {
          const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${photo.storagePath}`, {
            method: 'POST', headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': 'application/json' },
            body: JSON.stringify({ expiresIn: 900 }), signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) throw new Error('Photo recovery unavailable.');
          const signed = await response.json();
          photo.signedUrl = `${SUPABASE_URL}/storage/v1${signed.signedURL}`;
        }
      }
      return json({ snapshot, saved: true }, 200, origin);
    } catch { return json({ error: 'Cloud draft not confirmed. Keep this page open and retry.' }, 503, origin); }
  }
  const listingFile = form.get('listing');
  const photoFiles = form.getAll('photos');
  // New clients send only references to photos already saved in private storage.
  const references = form.get('photoReferences');
  if (references && !photoFiles.length) {
    try {
      const refs = JSON.parse(String(references));
      if (!Array.isArray(refs) || refs.length < 1 || refs.length > MAX_PHOTOS) throw new Error('Invalid references');
      for (const ref of refs) {
        const prefix = `${expected.sku}/drafts/${expected.queueId}/`;
        if (typeof ref.storagePath !== 'string' || !ref.storagePath.startsWith(prefix) ||
          !/^[a-f0-9]{64}\.jpeg$/.test(ref.storagePath.slice(prefix.length))) throw new Error('Invalid photo owner');
        const response = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${ref.storagePath}`, {
          headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` }, signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error('Saved photo unavailable');
        const data = await response.arrayBuffer();
        if (data.byteLength > MAX_PHOTO_BYTES || await sha256(data) !== ref.sha256) throw new Error('Saved photo mismatch');
        photoFiles.push(new File([data],ref.originalName || 'photo.jpeg',{type:'image/jpeg'}));
      }
    } catch { return json({ error: 'A saved photo could not be verified. Nothing was submitted.' }, 422, origin); }
  }
  if (!(listingFile instanceof File) || listingFile.size < 2 || listingFile.size > MAX_LISTING_BYTES)
    return json({ error: 'The listing JSON file is missing or too large.' }, 400, origin);
  if (!photoFiles.length || photoFiles.length > MAX_PHOTOS || photoFiles.some((entry) => !(entry instanceof File)))
    return json({ error: 'Include 1–24 JPEG photos in display order.' }, 400, origin);
  let packet: ListingPacket;
  try { packet = JSON.parse(await listingFile.text()) as ListingPacket; }
  catch { return json({ error: 'The listing JSON is not valid.' }, 400, origin); }
  // PIN queues intentionally omit commercial fields. Restore ONLY a missing
  // price from the token's existing approval; never override a supplied price.
  if (packet.item && (packet.item.targetPrice === undefined || packet.item.targetPrice === null || packet.item.targetPrice === '')) {
    packet.item.targetPrice = expected.authorization.targetPrice;
  }
  const invalid = packetError(packet, expected);
  if (invalid) return json({ error: invalid }, 422, origin);
  packet.item = cleanItem(packet.item!);
  // Render public output from the reviewed structured fields, never trust a
  // client HTML blob that could leak private serials or injected commercial data.
  packet.ebayTitle = ebayTitle(packet.item);
  packet.descriptionHtml = build(packet.item);
  packet.warnings = Array.isArray(packet.item.spec) && packet.item.spec.some((row) =>
    Array.isArray(row) && text(row[0],500) && text(row[1],1000))
    ? [] : ['Technical specifications are incomplete. Do not invent them.'];
  if ((packet.photoManifest as unknown[]).length !== photoFiles.length)
    return json({ error: 'The photo manifest does not match the uploaded photos.' }, 422, origin);
  const reviewId = crypto.randomUUID();
  const uploaded: string[] = [];
  const metadata: Array<Record<string, unknown>> = [];
  let acceptanceStarted = false;
  try {
    for (let index = 0; index < photoFiles.length; index += 1) {
      const file = photoFiles[index] as File;
      if (file.type !== 'image/jpeg' || file.size < 1 || file.size > MAX_PHOTO_BYTES)
        throw new Error(`Photo ${index + 1} must be a JPEG under 12 MB.`);
      const buffer = await file.arrayBuffer();
      const dimensions = jpegDimensions(buffer);
      if (!dimensions || dimensions.width + dimensions.height > 15_000)
        throw new Error(`Photo ${index + 1} has invalid JPEG dimensions.`);
      const storagePath = `${expected.sku}/${reviewId}/${String(index + 1).padStart(2, '0')}.jpeg`;
      const safeName = (file.name || `${index + 1}.jpeg`).replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 180);
      await upload(storagePath, new File([buffer], safeName, { type: 'image/jpeg' }));
      console.info('review-stage: photo-stored', index + 1);
      uploaded.push(storagePath);
      metadata.push({ displayOrder: index, storagePath, originalName: safeName, mimeType: 'image/jpeg',
        sizeBytes: file.size, sha256: await sha256(buffer), width: dimensions.width, height: dimensions.height });
    }
    console.info('review-stage: saving-review');
    acceptanceStarted = true;
    const accepted = await rpc('accept_ech_listing_review_v24', {
      p_token_hash: tokenHash, p_review_id: reviewId, p_listing: packet, p_photos: metadata,
    });
    return json(accepted, 201, origin);
  } catch (error) {
    // A lost database response may follow a committed review. Never delete
    // its photos when acceptance has begun and the outcome is uncertain.
    if (!acceptanceStarted) await remove(uploaded);
    if (acceptanceStarted) {
      try {
        const receipt = await rpc('ech_review_receipt', { p_token_hash: tokenHash });
        if (receipt) return json(receipt, 200, origin);
      } catch {}
    }
    const message = error instanceof Error ? error.message : 'The review could not be stored.';
    const status = /token|already|different SKU|no longer available/i.test(message) ? 409 : 422;
    return json({ error: message.slice(0, 240) }, status, origin);
  }
});

