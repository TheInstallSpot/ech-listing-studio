-- Owner-requested October 13 photo intake may await commercial approval.
-- Preserve all existing exceptions; priced/approved publication stages unchanged.
DO $repair$ DECLARE definition text; BEGIN
 SELECT pg_get_constraintdef(oid) INTO STRICT definition FROM pg_constraint WHERE conrelid='public.ech_listing_reviews'::regclass AND conname='ech_review_pending_commercial_values';
 IF position('INT26-C4-SR260' in definition)=0 THEN
 EXECUTE 'ALTER TABLE public.ech_listing_reviews DROP CONSTRAINT ech_review_pending_commercial_values';
 EXECUTE 'ALTER TABLE public.ech_listing_reviews ADD CONSTRAINT ech_review_pending_commercial_values CHECK ('||substring(definition from 8 for length(definition)-8)||' OR (review_status = ''awaiting_lee_approval'' AND sku IN (''INT26-C4-SR260'',''INT26-AVPRO-AC-MXNET-SW10'',''INT26-NETGEAR-GS348PP'',''INT26-EPISODE-ESS-SUB-SNGL-8'',''INT26-KEF-T301C'',''INT26-KEF-CI200QL-GRILLE-WH'',''INT26-KEF-RIF200R'',''INT26-KEF-Q6-META-GRILLE'',''INT26-KEF-CI200QR-GRILLE-WH'')))';
 END IF;
END $repair$;
