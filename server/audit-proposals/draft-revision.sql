BEGIN;
CREATE TABLE IF NOT EXISTS private.ech_photo_draft_versions_v29 (
 queue_id uuid NOT NULL REFERENCES public.ech_ready_products(id),
 revision integer NOT NULL CHECK(revision>=0),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 saved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(queue_id,revision)
);
ALTER TABLE private.ech_photo_draft_versions_v29 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ech_photo_draft_versions_v29 FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.ech_keep_draft_version_v29() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $guard$
BEGIN RAISE EXCEPTION 'Saved draft versions are immutable'; END $guard$;
REVOKE ALL ON FUNCTION private.ech_keep_draft_version_v29() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS ech_draft_version_immutable ON private.ech_photo_draft_versions_v29;
CREATE TRIGGER ech_draft_version_immutable BEFORE UPDATE OR DELETE ON private.ech_photo_draft_versions_v29
 FOR EACH ROW EXECUTE FUNCTION private.ech_keep_draft_version_v29();

CREATE OR REPLACE FUNCTION public.ech_draft_state_v24(p_token_hash text, p_snapshot jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE t private.ech_review_tokens; saved jsonb; current_revision integer; modern boolean;
 incoming_at timestamptz; saved_at timestamptz;
BEGIN
 IF NOT public.ech_review_allowed_v24(p_token_hash) THEN RAISE EXCEPTION 'draft authorization unavailable'; END IF;
 SELECT * INTO t FROM private.ech_review_tokens WHERE token_hash=p_token_hash AND used_at IS NULL AND expires_at>now() FOR UPDATE;
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
  SELECT snapshot INTO saved FROM private.ech_photo_drafts WHERE queue_id=t.queue_id;
  current_revision:=coalesce((saved->>'_revision')::integer,0);
  modern:=p_snapshot ? '_baseRevision';
  -- A response lost after commit can be retried without another revision.
  IF modern AND p_snapshot->>'_mutationId' IS NOT NULL
     AND p_snapshot->>'_mutationId'=saved->>'_mutationId' THEN
   IF (p_snapshot-'_baseRevision'-'_revision'-'_protocol') IS DISTINCT FROM (saved-'_revision'-'_protocol') THEN
    RAISE EXCEPTION 'draft mutation identity does not match saved work';
   END IF;
   RETURN saved;
  END IF;
  IF modern THEN
   IF jsonb_typeof(p_snapshot->'_baseRevision') IS DISTINCT FROM 'number'
      OR p_snapshot->>'_baseRevision' !~ '^[0-9]{1,9}$'
      OR (p_snapshot->>'_baseRevision')::integer<>current_revision THEN
    RAISE EXCEPTION 'draft revision conflict: recover current cloud work before saving';
   END IF;
  ELSE
   -- Existing installed rc17 tabs keep saving until a modern client owns the
   -- revision chain. Out-of-order legacy delivery must never erase new work.
   IF saved->>'_protocol'='2' THEN RAISE EXCEPTION 'draft revision conflict: update this app before saving'; END IF;
   IF p_snapshot->>'updatedAt' IS NULL THEN
    IF saved IS NOT NULL THEN RAISE EXCEPTION 'draft revision conflict: missing legacy save time'; END IF;
   ELSE
    incoming_at:=(p_snapshot->>'updatedAt')::timestamptz;
    saved_at:=(saved->>'updatedAt')::timestamptz;
    IF saved_at IS NOT NULL AND (incoming_at<saved_at OR (incoming_at=saved_at AND
      ((p_snapshot->'item') IS DISTINCT FROM (saved->'item') OR EXISTS(
       SELECT 1 FROM jsonb_array_elements(saved->'photos') photo WHERE NOT (p_snapshot->'photos') @> jsonb_build_array(photo))))) THEN
     RAISE EXCEPTION 'draft revision conflict: older saved work cannot replace newer work';
    END IF;
   END IF;
  END IF;
  -- Preserve the pre-upgrade active draft and every subsequent accepted save.
  IF saved IS NOT NULL THEN
   INSERT INTO private.ech_photo_draft_versions_v29(queue_id,revision,snapshot)
    VALUES(t.queue_id,current_revision,saved) ON CONFLICT DO NOTHING;
  END IF;
  p_snapshot:=jsonb_set(p_snapshot-'_baseRevision','{_revision}',to_jsonb(current_revision+1));
  IF modern THEN p_snapshot:=jsonb_set(p_snapshot,'{_protocol}','2'::jsonb); END IF;
  INSERT INTO private.ech_photo_draft_versions_v29(queue_id,revision,snapshot)
   VALUES(t.queue_id,current_revision+1,p_snapshot);
  INSERT INTO private.ech_photo_drafts(queue_id,snapshot) VALUES(t.queue_id,p_snapshot)
    ON CONFLICT(queue_id) DO UPDATE SET snapshot=excluded.snapshot,updated_at=now();
 END IF;
 SELECT snapshot INTO saved FROM private.ech_photo_drafts WHERE queue_id=t.queue_id;
 RETURN coalesce(saved,'{}'::jsonb);
END $function$
;
COMMIT;
