
DROP FUNCTION IF EXISTS public.bootstrap_current_user(text);

CREATE OR REPLACE FUNCTION public.bootstrap_user(_user_id uuid, _email text, _full_name text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  platform_org uuid;
  sa_role uuid;
  existing_admins int;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Missing user'; END IF;
  SELECT id INTO platform_org FROM public.organizations WHERE code = 'RCMBUDDY';
  SELECT id INTO sa_role FROM public.roles WHERE key = 'super_admin';
  SELECT count(*) INTO existing_admins FROM public.user_roles ur WHERE ur.role_id = sa_role;

  INSERT INTO public.profiles (id, organization_id, full_name, email, is_platform_user, last_active_at)
  VALUES (_user_id, CASE WHEN existing_admins = 0 THEN platform_org ELSE NULL END,
          COALESCE(NULLIF(_full_name,''), split_part(COALESCE(_email,'user'),'@',1)), _email,
          existing_admins = 0, now())
  ON CONFLICT (id) DO UPDATE SET last_active_at = now(),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END;

  IF existing_admins = 0 THEN
    INSERT INTO public.user_roles (user_id, role_id, organization_id) VALUES (_user_id, sa_role, platform_org)
      ON CONFLICT DO NOTHING;
    INSERT INTO public.user_scopes (user_id, scope_type, organization_id) VALUES (_user_id, 'platform', platform_org);
    UPDATE public.profiles SET organization_id = platform_org, is_platform_user = true WHERE id = _user_id;
  END IF;
  RETURN _user_id;
END; $$;

REVOKE ALL ON FUNCTION public.bootstrap_user(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_user(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_hospital(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_branch(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_org(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.write_audit_log() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_hospital(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_branch(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_org(uuid, uuid) TO authenticated, service_role;
