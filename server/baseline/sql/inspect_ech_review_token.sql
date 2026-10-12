CREATE OR REPLACE FUNCTION public.inspect_ech_review_token(p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_token private.ech_review_tokens;
begin
  select * into v_token
  from private.ech_review_tokens
  where token_hash = p_token_hash
    and used_at is null
    and expires_at > now();

  if v_token.queue_id is null then
    return null;
  end if;

  return jsonb_build_object(
    'queueId', v_token.queue_id,
    'recommendationId', v_token.recommendation_id,
    'sku', v_token.sku,
    'authorization', v_token.authorization_data,
    'expiresAt', v_token.expires_at
  );
end;
$function$

