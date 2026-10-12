CREATE OR REPLACE FUNCTION public.accept_ech_listing_review_v24(p_token_hash text, p_review_id uuid, p_listing jsonb, p_photos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_token private.ech_review_tokens; v_item jsonb; v_title text; v_count integer;
begin
  if not public.ech_review_allowed_v24(p_token_hash) then raise exception 'review authorization unavailable'; end if;
  select * into v_token from private.ech_review_tokens where token_hash=p_token_hash for update;
  if v_token.queue_id is null or v_token.used_at is not null or v_token.expires_at<=now() then
    raise exception 'review token is missing, expired, or already used';
  end if;
  if not exists(select 1 from public.ech_ready_products q where q.id=v_token.queue_id and q.status='ready' and q.sku=v_token.sku) then
    raise exception 'queued item is no longer available';
  end if;
  v_item:=p_listing->'item'; v_title:=btrim(coalesce(p_listing->>'ebayTitle',''));
  v_count:=jsonb_array_length(coalesce(p_photos,'[]'::jsonb));
  if coalesce((p_listing->>'schemaVersion')::integer,0)<>1
     or p_listing->>'reviewStatus'<>'awaiting_lee_approval'
     or v_item->>'sku' is distinct from v_token.sku
     or p_listing->>'queueId' is distinct from v_token.queue_id::text
     or coalesce(v_item->>'cond','') not in ('N1','O2','D3')
     or v_item->'quantityConfirmed' is distinct from 'true'::jsonb
     or v_item->>'sold' is distinct from v_token.authorization_data->>'saleUnitLabel'
     or (v_item->>'availableQuantity')::integer is distinct from (v_token.authorization_data->>'availableQuantity')::integer
     or v_item->>'fulfillment' is distinct from v_token.authorization_data->>'fulfillment'
     or (v_item->>'targetPrice')::numeric is distinct from (v_token.authorization_data->>'targetPrice')::numeric
     or v_item->>'ebayCategoryId' is distinct from v_token.authorization_data->>'ebayCategoryId'
     or v_item ? 'unitCost' or v_item ? 'estimatedContribution'
     or char_length(v_title) not between 1 and 80
     or coalesce(jsonb_array_length(v_item->'box'),0)<1
     or coalesce(jsonb_array_length(v_item->'ver'),0)<1
     or coalesce(p_listing->>'descriptionHtml','')=''
     or v_count not between 1 and 24
     or v_count<>coalesce(jsonb_array_length(p_listing->'photoManifest'),-1) then
    raise exception 'listing packet does not match the approved queue item';
  end if;
  if exists(select 1 from jsonb_array_elements(p_photos) photo
    where photo->>'mimeType'<>'image/jpeg'
       or coalesce((photo->>'sizeBytes')::integer,0) not between 1 and 12582912
       or coalesce((photo->>'width')::integer,0)<=0
       or coalesce((photo->>'height')::integer,0)<=0
       or coalesce(photo->>'sha256','') !~ '^[0-9a-f]{64}$'
       or coalesce(photo->>'storagePath','')='') then
    raise exception 'photo metadata is invalid';
  end if;
  insert into public.ech_listing_reviews(
    id,queue_id,recommendation_id,sku,schema_version,review_status,listing,
    condition_code,ebay_title,sale_unit,unit_cost,available_quantity,
    target_price,fulfillment_type,photo_count,warnings)
  values(p_review_id,v_token.queue_id,v_token.recommendation_id,v_token.sku,1,
    'awaiting_lee_approval',p_listing,v_item->>'cond',v_title,
    v_token.authorization_data->>'saleUnit',(v_token.authorization_data->>'unitCost')::numeric,
    (v_token.authorization_data->>'availableQuantity')::integer,
    (v_token.authorization_data->>'targetPrice')::numeric,
    v_token.authorization_data->>'fulfillment',v_count,
    coalesce(p_listing->'warnings','[]'::jsonb)||coalesce(p_listing->'issues','[]'::jsonb));
  insert into public.ech_listing_review_photos(
    review_id,display_order,storage_path,original_name,mime_type,size_bytes,sha256,width,height)
  select p_review_id,(photo->>'displayOrder')::integer,photo->>'storagePath',
    photo->>'originalName',photo->>'mimeType',(photo->>'sizeBytes')::integer,
    photo->>'sha256',(photo->>'width')::integer,(photo->>'height')::integer
  from jsonb_array_elements(p_photos) photo;
  insert into public.ech_listing_audit_log(review_id,action,actor_id,submitted_values,result_status,detail)
  values(p_review_id,'received','paige-listing-studio',
    jsonb_build_object('sku',v_token.sku,'condition',v_item->>'cond','saleUnit',v_item->>'sold',
      'unitCost',v_token.authorization_data->>'unitCost',
      'quantity',v_token.authorization_data->>'availableQuantity',
      'price',v_token.authorization_data->>'targetPrice',
      'fulfillment',v_token.authorization_data->>'fulfillment','title',v_title,'photoCount',v_count),
    'awaiting_lee_approval','{}'::jsonb);
  update private.ech_review_tokens set used_at=now() where queue_id=v_token.queue_id;
  update public.ech_ready_products set status='completed',completed_at=now(),
    output=jsonb_build_object('reviewId',p_review_id,'status','awaiting_lee_approval'),
    payload=jsonb_set(payload,'{items,0}',coalesce(payload#>'{items,0}','{}'::jsonb)-'reviewToken',false)
  where id=v_token.queue_id;
  return jsonb_build_object('reviewId',p_review_id,'status','awaiting_lee_approval');
end; $function$

