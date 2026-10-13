-- Bounded management correction/rejection lifecycle. No eBay operations.
BEGIN;
ALTER TABLE public.ech_listing_reviews DROP CONSTRAINT IF EXISTS ech_listing_reviews_review_status_check;
ALTER TABLE public.ech_listing_reviews ADD CONSTRAINT ech_listing_reviews_review_status_check CHECK
 (review_status IN ('awaiting_lee_approval','preparing_offer','ready_to_publish','publishing','published','error','returned_to_paige','rejected'));
ALTER TABLE public.ech_listing_audit_log DROP CONSTRAINT IF EXISTS ech_listing_audit_log_action_check;
ALTER TABLE public.ech_listing_audit_log ADD CONSTRAINT ech_listing_audit_log_action_check CHECK
 (action IN ('received','offer_prepare_started','offer_prepared','publish_started','published','failed','returned_to_paige','rejected'));
-- Preserve the exact existing pending-commercial exception; returned/rejected
-- reviews cannot publish, including reviews whose cost still needs Lee approval.
DO $block$ DECLARE definition text; BEGIN
 SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint
 WHERE conrelid='public.ech_listing_reviews'::regclass AND conname='ech_review_pending_commercial_values';
 IF definition IS NOT NULL AND position('returned_to_paige' in definition)=0 THEN
  EXECUTE 'ALTER TABLE public.ech_listing_reviews DROP CONSTRAINT ech_review_pending_commercial_values';
  EXECUTE 'ALTER TABLE public.ech_listing_reviews ADD CONSTRAINT ech_review_pending_commercial_values CHECK ('||
   substring(definition from 8 for length(definition)-8)||' OR review_status IN (''returned_to_paige'',''rejected''))';
 END IF;
END $block$;
CREATE TABLE IF NOT EXISTS private.ech_review_decisions (
 review_id uuid PRIMARY KEY REFERENCES public.ech_listing_reviews(id),
 action text NOT NULL CHECK(action IN ('return_to_paige','reject')),
 actor_id text NOT NULL,
 instruction text NOT NULL CHECK(length(instruction) BETWEEN 1 AND 2000),
 expected_updated_at timestamptz NOT NULL,
 next_queue_id uuid UNIQUE REFERENCES public.ech_ready_products(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.ech_review_decisions FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.decide_ech_review_v25(
 p_review_id uuid,p_expected_updated_at timestamptz,p_actor_id text,p_action text,p_instruction text,
 p_next_queue_id uuid DEFAULT NULL,p_review_token text DEFAULT NULL,p_photos jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
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
    'brand','part','what','sold','title','hook','pdesc','mounting','box','spec','ver','serialNumber','packaging','defects']);
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
REVOKE ALL ON FUNCTION public.decide_ech_review_v25(uuid,timestamptz,text,text,text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.decide_ech_review_v25(uuid,timestamptz,text,text,text,uuid,text,jsonb) TO service_role;
COMMIT;
