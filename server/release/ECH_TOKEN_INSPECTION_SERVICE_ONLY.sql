-- The receiver is the token inspection boundary; never expose private
-- authorization metadata through a direct browser RPC. No records change.
REVOKE ALL ON FUNCTION public.inspect_ech_review_token_v24(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inspect_ech_review_token_v24(text) TO service_role;
