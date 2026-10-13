-- Lee's October 13 exact owned-intake authorization; no blanket KEF release.
CREATE OR REPLACE FUNCTION private.ech_kef_intake_exception_v27(p_sku text,p_part text,p_fulfillment text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $owner$
 SELECT lower(coalesce(p_fulfillment,''))='ech' AND EXISTS (
  SELECT 1 FROM (VALUES
   ('INT26-KEF-T301C','T301C'),
   ('INT26-KEF-CI200QL-GRILLE-WH','CI200QLGRILLE'),
   ('INT26-KEF-RIF200R','RIF200R'),
   ('INT26-KEF-Q6-META-GRILLE','Q6METAGRILLE'),
   ('INT26-KEF-CI200QR-GRILLE-WH','CI200QRGRILLE')
  ) approved(sku,part)
  WHERE approved.sku=p_sku AND approved.part=upper(regexp_replace(coalesce(p_part,''),'[^a-zA-Z0-9]','','g'))
 );
$owner$;
REVOKE ALL ON FUNCTION private.ech_kef_intake_exception_v27(text,text,text) FROM PUBLIC;
-- Candidate only. No production execution. Gate every receiving write against
-- the exact approved physical job and retained channel restrictions.
CREATE OR REPLACE FUNCTION public.ech_review_allowed_v24(p_token_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE t private.ech_review_tokens; brand text; part text; sku text; fulfillment text;
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' THEN RETURN false; END IF;
 SELECT * INTO t FROM private.ech_review_tokens WHERE token_hash=p_token_hash AND used_at IS NULL AND expires_at>now();
 IF t.queue_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.ech_ready_products q
   WHERE q.id=t.queue_id AND q.status='ready' AND q.approved_at IS NOT NULL AND q.sku=t.sku)
   OR t.authorization_data->>'sku' IS DISTINCT FROM t.sku THEN RETURN false; END IF;
 brand:=upper(regexp_replace(coalesce(t.authorization_data->>'brand',''),'[^a-zA-Z0-9]','','g'));
 part:=upper(regexp_replace(coalesce(t.authorization_data->>'part',''),'[^a-zA-Z0-9]','','g'));
 sku:=upper(regexp_replace(t.sku,'[^a-zA-Z0-9]','','g'));
 fulfillment:=lower(coalesce(t.authorization_data->>'fulfillment',''));
 IF brand IN ('FOCAL','DEFINITIVETECHNOLOGY','SONYES') OR t.sku ~* '^(FOCAL|DEFINITIVE[ _-]*TECHNOLOGY)[-_]' THEN RETURN false; END IF;
 IF (brand='KEF' OR t.sku ~* '^KEF[-_]') AND NOT (
   brand='KEF' AND private.ech_kef_intake_exception_v27(t.sku,t.authorization_data->>'part',fulfillment)
 ) THEN RETURN false; END IF;
 IF brand='SONY' AND (part ~ 'ES$' OR t.sku ~* '(^|[-_])ES($|[-_])') THEN RETURN false; END IF;
 IF brand='SONANCE' AND (sku LIKE '%MAG%' OR part LIKE '%MAG%') THEN RETURN false; END IF;
 IF brand IN ('EPISODE','TRIAD') AND fulfillment='distributor' THEN RETURN false; END IF;
 IF brand='AUDIOQUEST' THEN
   IF sku NOT IN ('AUDIPHOTON48','AUDIPQ303BSTOCK','AUDIPQ303DEMO') THEN RETURN false; END IF;
   IF sku LIKE 'AUDIPQ303%' AND fulfillment<>'ech' THEN RETURN false; END IF;
 END IF;
 RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.ech_review_allowed_v24(text) FROM PUBLIC;
