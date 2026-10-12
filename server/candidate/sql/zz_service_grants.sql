-- Additive v24 receive-only interface; publication functions are unchanged.
REVOKE ALL ON FUNCTION public.inspect_ech_review_token_v24(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ech_draft_state_v24(text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_ech_listing_review_v24(text,uuid,jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ech_pin_queue_v24(text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inspect_ech_review_token_v24(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ech_draft_state_v24(text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_ech_listing_review_v24(text,uuid,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ech_pin_queue_v24(text,boolean) TO service_role;
