BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('ech-original-photos','ech-original-photos',false,33554432,ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'])
ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS private.ech_original_photos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), queue_id uuid NOT NULL REFERENCES public.ech_ready_products(id),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'), storage_path text NOT NULL UNIQUE,
 original_name text NOT NULL CHECK(length(original_name) BETWEEN 1 AND 200),
 mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp','image/heic','image/heif')),
 size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 33554432),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(queue_id,sha256)
);
CREATE TABLE IF NOT EXISTS private.ech_original_photo_links (
 queue_id uuid NOT NULL REFERENCES public.ech_ready_products(id),
 normalized_sha256 text NOT NULL CHECK(normalized_sha256 ~ '^[a-f0-9]{64}$'),
 original_id uuid NOT NULL REFERENCES private.ech_original_photos(id),
 PRIMARY KEY(queue_id,normalized_sha256,original_id)
);
REVOKE ALL ON private.ech_original_photos,private.ech_original_photo_links FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.save_ech_original_photo_v25(p_token_hash text,p_normalized_sha256 text,p_sha256 text,
 p_storage_path text,p_original_name text,p_mime_type text,p_size_bytes integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
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
END $function$;
CREATE OR REPLACE FUNCTION public.read_ech_original_photos_v25(p_queue_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' OR coalesce(cardinality(p_queue_ids),0) NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'original archive access denied'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('queueId',l.queue_id,'id',o.id,'storagePath',o.storage_path,
  'originalName',o.original_name,'mimeType',o.mime_type,'sizeBytes',o.size_bytes,'sha256',o.sha256,
  'normalizedSha256',l.normalized_sha256) ORDER BY o.created_at,o.id)
 FROM private.ech_original_photo_links l JOIN private.ech_original_photos o ON o.id=l.original_id WHERE l.queue_id=ANY(p_queue_ids)),'[]'::jsonb);
END $function$;
REVOKE ALL ON FUNCTION public.save_ech_original_photo_v25(text,text,text,text,text,text,integer),public.read_ech_original_photos_v25(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_ech_original_photo_v25(text,text,text,text,text,text,integer),public.read_ech_original_photos_v25(uuid[]) TO service_role;
CREATE OR REPLACE FUNCTION private.ech_keep_original_receipt() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $guard$
BEGIN RAISE EXCEPTION 'Original archive receipt is immutable'; END $guard$;
REVOKE ALL ON FUNCTION private.ech_keep_original_receipt() FROM PUBLIC;
DROP TRIGGER IF EXISTS ech_original_bytes_immutable ON private.ech_original_photos;
CREATE TRIGGER ech_original_bytes_immutable BEFORE UPDATE OR DELETE ON private.ech_original_photos FOR EACH ROW EXECUTE FUNCTION private.ech_keep_original_receipt();
DROP TRIGGER IF EXISTS ech_original_link_immutable ON private.ech_original_photo_links;
CREATE TRIGGER ech_original_link_immutable BEFORE UPDATE OR DELETE ON private.ech_original_photo_links FOR EACH ROW EXECUTE FUNCTION private.ech_keep_original_receipt();
COMMIT;
