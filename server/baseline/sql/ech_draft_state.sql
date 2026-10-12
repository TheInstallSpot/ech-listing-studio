CREATE OR REPLACE FUNCTION public.ech_draft_state(p_token_hash text, p_snapshot jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE t private.ech_review_tokens; saved jsonb;
BEGIN
 SELECT * INTO t FROM private.ech_review_tokens WHERE token_hash=p_token_hash AND used_at IS NULL AND expires_at>now();
 IF t.queue_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.ech_ready_products WHERE id=t.queue_id AND status='ready') THEN
  RAISE EXCEPTION 'draft authorization unavailable';
 END IF;
 IF p_snapshot IS NOT NULL THEN
  IF jsonb_typeof(p_snapshot)<>'object' OR octet_length(p_snapshot::text)>262144 THEN RAISE EXCEPTION 'invalid draft'; END IF;
  IF p_snapshot#>>'{item,sku}' IS DISTINCT FROM t.sku THEN RAISE EXCEPTION 'different SKU'; END IF;
  IF jsonb_typeof(p_snapshot->'photos') IS DISTINCT FROM 'array' OR jsonb_array_length(p_snapshot->'photos')>24 THEN RAISE EXCEPTION 'invalid photos'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_snapshot->'photos') p WHERE
    coalesce(p->>'storagePath','') NOT LIKE t.sku||'/drafts/'||t.queue_id::text||'/%') THEN RAISE EXCEPTION 'different photo owner'; END IF;
  p_snapshot:=jsonb_set(p_snapshot,'{item}',(p_snapshot->'item')-'reviewToken'-'unitCost'-'estimatedContribution');
  INSERT INTO private.ech_photo_drafts(queue_id,snapshot) VALUES(t.queue_id,p_snapshot)
    ON CONFLICT(queue_id) DO UPDATE SET snapshot=excluded.snapshot,updated_at=now();
 END IF;
 SELECT snapshot INTO saved FROM private.ech_photo_drafts WHERE queue_id=t.queue_id;
 RETURN coalesce(saved,'{}'::jsonb);
END $function$

