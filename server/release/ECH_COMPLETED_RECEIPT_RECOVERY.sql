CREATE OR REPLACE FUNCTION public.ech_review_receipt(p_token_hash text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $receipt$
SELECT jsonb_build_object('reviewId',r.id,'queueId',q.id,'status',r.review_status,'photoCount',r.photo_count,'retiredOwnerAlias',r.queue_id<>q.id)
FROM private.ech_review_tokens t
JOIN public.ech_ready_products q ON q.id=t.queue_id AND q.sku=t.sku
JOIN public.ech_listing_reviews r ON r.sku=t.sku AND (
(r.queue_id=q.id AND t.used_at IS NOT NULL)
OR (q.output->>'kind'='owner_resumed_original_review'
 AND q.output->>'preservedDraft'='true'
 AND q.output->>'reviewId'=r.id::text)
)
WHERE coalesce(auth.role(),'')='service_role'
AND t.token_hash=p_token_hash AND q.status='completed'
AND r.review_status NOT IN ('returned_to_paige')
LIMIT 1;
$receipt$;
REVOKE ALL ON FUNCTION public.ech_review_receipt(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ech_review_receipt(text) TO service_role;
