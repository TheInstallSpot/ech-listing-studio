CREATE OR REPLACE FUNCTION public.ech_review_receipt(p_token_hash text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('reviewId',r.id,'status',r.review_status,'photoCount',r.photo_count)
 FROM private.ech_review_tokens t JOIN public.ech_listing_reviews r ON r.queue_id=t.queue_id
 WHERE t.token_hash=p_token_hash AND t.used_at IS NOT NULL AND t.expires_at>now() LIMIT 1;
$function$

