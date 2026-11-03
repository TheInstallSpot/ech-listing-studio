CREATE OR REPLACE FUNCTION private.ech_pending_commercial_allowed_v28(p_queue_id uuid, p_sku text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.ech_ready_products q JOIN private.ech_review_tokens t ON t.queue_id=q.id
 WHERE q.id=p_queue_id AND q.sku=p_sku AND t.sku=p_sku AND q.approved_at IS NOT NULL
 AND q.status IN ('ready','completed') AND t.authorization_data->>'sku'=p_sku
 AND t.authorization_data->>'fulfillment'='ech' AND t.authorization_data->>'commercialPendingLee'='true');
$function$
