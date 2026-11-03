CREATE OR REPLACE FUNCTION public.save_ech_original_photo_v25(p_token_hash text, p_normalized_sha256 text, p_sha256 text, p_storage_path text, p_original_name text, p_mime_type text, p_size_bytes integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE t private.ech_review_tokens; o private.ech_original_photos; extension text;
BEGIN
 IF NOT public.ech_review_allowed_v24(p_token_hash) THEN RAISE EXCEPTION 'original photo authorization unavailable'; END IF;
 SELECT * INTO t FROM private.ech_review_tokens WHERE token_hash=p_token_hash FOR UPDATE;
 IF t.used_at IS NOT NULL OR t.expires_at<=now() THEN RAISE EXCEPTION 'original permission was consumed'; END IF;
 IF p_normalized_sha256 IS NULL OR p_normalized_sha256 !~ '^[a-f0-9]{64}$' OR p_sha256 IS NULL OR p_sha256 !~ '^[a-f0-9]{64}$'
  OR p_mime_type NOT IN ('image/jpeg','image/png','image/webp','image/heic','image/heif') OR p_mime_type IS NULL
  OR p_size_bytes IS NULL OR p_size_bytes NOT BETWEEN 1 AND 33554432
  OR p_original_name IS NULL OR length(p_original_name) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid original receipt'; END IF;
 extension:=CASE p_mime_type WHEN 'image/jpeg' THEN 'jpeg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' WHEN 'image/heic' THEN 'heic' ELSE 'heif' END;
 IF p_storage_path IS DISTINCT FROM t.sku||'/originals/'||t.queue_id::text||'/'||p_sha256||'.'||extension THEN
  RAISE EXCEPTION 'different original photo owner'; END IF;
 SELECT * INTO o FROM private.ech_original_photos WHERE queue_id=t.queue_id AND sha256=p_sha256;
 IF o.id IS NULL THEN
  IF (SELECT count(*) FROM private.ech_original_photos WHERE queue_id=t.queue_id)>=96 THEN RAISE EXCEPTION 'original archive limit reached'; END IF;
  INSERT INTO private.ech_original_photos(queue_id,sha256,storage_path,original_name,mime_type,size_bytes)
   VALUES(t.queue_id,p_sha256,p_storage_path,p_original_name,p_mime_type,p_size_bytes) RETURNING * INTO o;
 ELSIF o.storage_path<>p_storage_path OR o.mime_type<>p_mime_type OR o.size_bytes<>p_size_bytes THEN
  RAISE EXCEPTION 'original receipt is immutable';
 END IF;
 INSERT INTO private.ech_original_photo_links(queue_id,normalized_sha256,original_id)
  VALUES(t.queue_id,p_normalized_sha256,o.id) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('id',o.id,'storagePath',o.storage_path,'originalName',o.original_name,'mimeType',o.mime_type,
  'sizeBytes',o.size_bytes,'sha256',o.sha256,'normalizedSha256',p_normalized_sha256);
END $function$
