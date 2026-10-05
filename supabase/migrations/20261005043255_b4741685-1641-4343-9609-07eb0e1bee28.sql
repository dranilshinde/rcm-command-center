CREATE TABLE public.hospital_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  allowed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (hospital_id, role_id, permission_id)
);
CREATE INDEX ON public.hospital_role_permissions(hospital_id, role_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_role_permissions TO authenticated;
GRANT ALL ON public.hospital_role_permissions TO service_role;
ALTER TABLE public.hospital_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_hospital_admin(_user_id uuid, _hospital_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.key = 'hospital_admin' AND ur.hospital_id = _hospital_id);
$$;

CREATE OR REPLACE FUNCTION public.is_overridable_role(_role_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.roles WHERE id = _role_id
    AND role_level IN ('hospital','branch','team') AND key <> 'hospital_admin');
$$;

CREATE POLICY hrp_select ON public.hospital_role_permissions FOR SELECT TO authenticated
  USING (public.can_access_hospital(auth.uid(), hospital_id));
CREATE POLICY hrp_write ON public.hospital_role_permissions FOR ALL TO authenticated
  USING (public.is_hospital_admin(auth.uid(), hospital_id) AND public.is_overridable_role(role_id))
  WITH CHECK (public.is_hospital_admin(auth.uid(), hospital_id) AND public.is_overridable_role(role_id));

CREATE TRIGGER hrp_updated BEFORE UPDATE ON public.hospital_role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Defaults: super admins only
DROP POLICY IF EXISTS rp_write ON public.role_permissions;
CREATE POLICY rp_write ON public.role_permissions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.permissions p ON p.module = _module AND p.action = _action
    LEFT JOIN public.hospital_role_permissions o
      ON o.hospital_id = ur.hospital_id AND o.role_id = ur.role_id AND o.permission_id = p.id
    WHERE ur.user_id = _user_id
      AND COALESCE(o.allowed, EXISTS (SELECT 1 FROM public.role_permissions rp
                                      WHERE rp.role_id = ur.role_id AND rp.permission_id = p.id)));
$$;

CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.module || '.' || p.action
  FROM public.user_roles ur
  CROSS JOIN public.permissions p
  LEFT JOIN public.hospital_role_permissions o
    ON o.hospital_id = ur.hospital_id AND o.role_id = ur.role_id AND o.permission_id = p.id
  WHERE ur.user_id = auth.uid()
    AND COALESCE(o.allowed, EXISTS (SELECT 1 FROM public.role_permissions rp
                                    WHERE rp.role_id = ur.role_id AND rp.permission_id = p.id));
$$;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated;

ALTER TABLE public.profiles
  ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN onboarded_at timestamptz;

CREATE POLICY tm_self_join ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.organization_id = team_members.organization_id
      AND public.can_access_hospital(auth.uid(), t.hospital_id)));