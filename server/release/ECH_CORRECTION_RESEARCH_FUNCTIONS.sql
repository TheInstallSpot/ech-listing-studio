-- Function-only correction repair. Preserve every record, photo, approval and existing token-inspection grant.
BEGIN;
DO $guard$ BEGIN
 IF md5(pg_get_functiondef('public.decide_ech_review_v25(uuid,timestamptz,text,text,text,uuid,text,jsonb)'::regprocedure)) <> 'a5ad17738730dd7187c611027ea87e71' THEN RAISE EXCEPTION 'Correction function changed; reconcile source before upgrade'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.inspect_ech_correction_source_v27(p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE result jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
 SELECT jsonb_build_object('sourceReviewId',r.id,'sourcePreparation',r.listing->'agentPreparation') INTO result
 FROM private.ech_review_tokens t
 JOIN private.ech_review_decisions d ON d.next_queue_id=t.queue_id AND d.action='return_to_paige'
 JOIN public.ech_listing_reviews r ON r.id=d.review_id AND r.sku=t.sku AND r.review_status='returned_to_paige'
 WHERE t.token_hash=p_token_hash AND t.used_at IS NULL AND t.expires_at>now();
 RETURN result;
END $function$;
REVOKE ALL ON FUNCTION public.inspect_ech_correction_source_v27(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inspect_ech_correction_source_v27(text) TO service_role;

CREATE OR REPLACE FUNCTION public.decide_ech_review_v25(p_review_id uuid, p_expected_updated_at timestamp with time zone, p_actor_id text, p_action text, p_instruction text, p_next_queue_id uuid DEFAULT NULL::uuid, p_review_token text DEFAULT NULL::text, p_photos jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r public.ech_listing_reviews; q public.ech_ready_products; t private.ech_review_tokens;
 d private.ech_review_decisions; item jsonb; payload jsonb; next_recommendation text; output_status text;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' OR NOT EXISTS(
  SELECT 1 FROM private.ech_publish_approvers WHERE actor_id=p_actor_id AND active) THEN
  RAISE EXCEPTION 'owner approval required'; END IF;
 IF p_action NOT IN ('return_to_paige','reject') OR p_instruction IS NULL OR
  length(btrim(p_instruction)) NOT BETWEEN 1 AND 2000 OR p_expected_updated_at IS NULL THEN
  RAISE EXCEPTION 'complete decision instructions required'; END IF;
 SELECT * INTO r FROM public.ech_listing_reviews WHERE id=p_review_id FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'review unavailable'; END IF;
 SELECT * INTO d FROM private.ech_review_decisions WHERE review_id=r.id;
 IF d.review_id IS NOT NULL THEN
  IF d.action<>p_action OR d.actor_id<>p_actor_id OR d.instruction<>btrim(p_instruction) OR
   d.expected_updated_at<>p_expected_updated_at THEN RAISE EXCEPTION 'decision already recorded'; END IF;
  RETURN jsonb_build_object('reviewId',r.id,'status',r.review_status,'nextQueueId',d.next_queue_id,'replayed',true);
 END IF;
 IF r.updated_at IS DISTINCT FROM p_expected_updated_at OR r.review_status<>'awaiting_lee_approval'
  OR r.offer_id IS NOT NULL OR r.listing_id IS NOT NULL OR r.published_at IS NOT NULL THEN
  RAISE EXCEPTION 'review changed or external offer requires reconciliation'; END IF;
 output_status:=CASE WHEN p_action='reject' THEN 'rejected' ELSE 'returned_to_paige' END;
 IF p_action='return_to_paige' THEN
  IF p_next_queue_id IS NULL OR p_review_token !~ '^[a-f0-9]{64}$' OR jsonb_typeof(p_photos)<>'array'
   OR jsonb_array_length(p_photos)<>r.photo_count THEN RAISE EXCEPTION 'complete recovery photos required'; END IF;
  SELECT * INTO q FROM public.ech_ready_products WHERE id=r.queue_id FOR UPDATE;
  SELECT * INTO t FROM private.ech_review_tokens WHERE queue_id=r.queue_id;
  IF t.queue_id IS NULL OR q.status<>'completed' THEN RAISE EXCEPTION 'original job unavailable'; END IF;
  -- Each new draft photo must retain the exact original receipt fingerprint.
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_photos) f WHERE NOT EXISTS(
   SELECT 1 FROM public.ech_listing_review_photos o WHERE o.review_id=r.id
    AND o.display_order=(f->>'displayOrder')::integer AND o.sha256=f->>'sha256'
    AND o.size_bytes=(f->>'sizeBytes')::integer AND o.width=(f->>'width')::integer
    AND o.height=(f->>'height')::integer AND f->>'mimeType'='image/jpeg'
    AND f->>'storagePath'=r.sku||'/drafts/'||p_next_queue_id::text||'/'||o.sha256||'.jpeg'))
   OR (SELECT count(DISTINCT f->>'displayOrder') FROM jsonb_array_elements(p_photos) f)<>r.photo_count THEN
   RAISE EXCEPTION 'correction photos do not match original receipt'; END IF;
  SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO item FROM jsonb_each(r.listing->'item')
   WHERE key=ANY(ARRAY['cond','quantityConfirmed','sku','productId','availableQuantity','fulfillment','isPassive',
    'compatibilityNote','catalogNote','ebayCategoryId','ebayCategoryName','ebayCategoryPath','ebayCategoryVerifiedAt',
    'brand','part','what','sold','title','hook','pdesc','mounting','box','spec','ver','serialNumber','packaging','defects','packedWeightLb','packedLengthIn','packedWidthIn','packedHeightIn']);
  item:=item||jsonb_build_object('_draftId',p_next_queue_id,'quantityConfirmed',false,'cond','');
  payload:=jsonb_build_object('items',jsonb_build_array((item-'_draftId')||jsonb_build_object(
   'reviewToken',p_review_token,'correctionNote',btrim(p_instruction),'returnedFromReview',r.id)));
  next_recommendation:='correction:'||r.id::text;
  INSERT INTO public.ech_ready_products(id,recommendation_id,sku,payload,status,approved_at)
   VALUES(p_next_queue_id,next_recommendation,r.sku,payload,'ready',q.approved_at);
  INSERT INTO private.ech_review_tokens(queue_id,recommendation_id,sku,token_hash,authorization_data,expires_at)
   VALUES(p_next_queue_id,next_recommendation,r.sku,encode(extensions.digest(p_review_token,'sha256'),'hex'),
    t.authorization_data,now()+interval '7 days');
  INSERT INTO private.ech_photo_drafts(queue_id,snapshot) VALUES(p_next_queue_id,jsonb_build_object('item',item,'photos',p_photos));
  INSERT INTO private.ech_original_photo_links(queue_id,normalized_sha256,original_id)
   SELECT p_next_queue_id,l.normalized_sha256,l.original_id FROM private.ech_original_photo_links l
   WHERE l.queue_id=r.queue_id AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_photos) f WHERE f->>'sha256'=l.normalized_sha256);
 ELSE
  p_next_queue_id:=NULL;
 END IF;
 INSERT INTO private.ech_review_decisions(review_id,action,actor_id,instruction,expected_updated_at,next_queue_id)
  VALUES(r.id,p_action,p_actor_id,btrim(p_instruction),p_expected_updated_at,p_next_queue_id);
 UPDATE public.ech_listing_reviews SET review_status=output_status,approved_by=NULL,approved_at=NULL,
  updated_at=now(),listing=(listing-'publicationEvidence')||jsonb_build_object('managementDecision',
   jsonb_build_object('action',p_action,'instruction',btrim(p_instruction),'nextQueueId',p_next_queue_id,'at',now())) WHERE id=r.id;
 INSERT INTO public.ech_listing_audit_log(review_id,action,actor_id,result_status,detail)
  VALUES(r.id,output_status,p_actor_id,output_status,jsonb_build_object('instruction',btrim(p_instruction),'nextQueueId',p_next_queue_id));
 RETURN jsonb_build_object('reviewId',r.id,'status',output_status,'nextQueueId',p_next_queue_id);
END $function$;


COMMIT;
