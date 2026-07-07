
REVOKE ALL ON FUNCTION public.publish_course(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unpublish_course(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_course(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.unpublish_course(uuid) TO service_role;
