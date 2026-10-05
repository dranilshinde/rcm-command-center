REVOKE EXECUTE ON FUNCTION public.is_hospital_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_overridable_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hospital_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_overridable_role(uuid) TO authenticated;