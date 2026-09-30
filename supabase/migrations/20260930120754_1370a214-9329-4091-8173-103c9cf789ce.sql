
-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ core hierarchy ============
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  org_type text NOT NULL DEFAULT 'customer' CHECK (org_type IN ('platform','customer')),
  status text NOT NULL DEFAULT 'active',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

CREATE TABLE public.hospital_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  headquarters_city text,
  status text NOT NULL DEFAULT 'active',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

CREATE TABLE public.hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hospital_group_id uuid REFERENCES public.hospital_groups(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  city text, state text, bed_count integer,
  status text NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding','active','suspended','inactive')),
  go_live_date date,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  city text, state text, address text,
  status text NOT NULL DEFAULT 'active',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  dept_type text NOT NULL DEFAULT 'clinical' CHECK (dept_type IN ('clinical','rcm','finance','support')),
  status text NOT NULL DEFAULT 'active',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (hospital_id, code)
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  employee_code text,
  job_title text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','on_leave')),
  availability text NOT NULL DEFAULT 'available' CHECK (availability IN ('available','busy','away')),
  backup_user_id uuid,
  is_platform_user boolean NOT NULL DEFAULT false,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text NOT NULL,
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (hospital_id, code)
);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_in_team text NOT NULL DEFAULT 'member' CHECK (role_in_team IN ('manager','member','backup')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (team_id, user_id)
);

-- ============ RBAC ============
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  role_level text NOT NULL DEFAULT 'hospital' CHECK (role_level IN ('platform','group','hospital','branch','team')),
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL CHECK (action IN ('VIEW','CREATE','EDIT','DELETE','ASSIGN','REASSIGN','APPROVE','EXPORT','IMPORT','ESCALATE','CLOSE','REOPEN','CONFIGURE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, action)
);

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (user_id, role_id, hospital_id, branch_id)
);

CREATE TABLE public.user_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('platform','group','hospital','branch')),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  hospital_group_id uuid REFERENCES public.hospital_groups(id) ON DELETE CASCADE,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- ============ payer master ============
CREATE TABLE public.insurers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  payer_code text NOT NULL,
  insurer_type text NOT NULL DEFAULT 'private' CHECK (insurer_type IN ('public','private','government_scheme','corporate')),
  portal_url text, support_email text, support_phone text,
  status text NOT NULL DEFAULT 'active',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (organization_id, payer_code)
);

CREATE TABLE public.tpas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  tpa_code text NOT NULL,
  portal_url text, support_email text, support_phone text,
  status text NOT NULL DEFAULT 'active',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (organization_id, tpa_code)
);

CREATE TABLE public.tpa_spocs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tpa_id uuid REFERENCES public.tpas(id) ON DELETE CASCADE,
  insurer_id uuid REFERENCES public.insurers(id) ON DELETE CASCADE,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  designation text, email text, phone text, location text,
  escalation_level integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

-- ============ configurable master data ============
CREATE TABLE public.master_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.master_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.master_lists(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

-- ============ onboarding ============
CREATE TABLE public.onboarding_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('not_started','in_progress','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id)
);

CREATE TABLE public.onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.onboarding_checklists(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','skipped')),
  completed_at timestamptz,
  completed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checklist_id, step_key)
);

-- ============ notifications / audit / settings ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  body text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  link_to text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  hospital_id uuid,
  branch_id uuid,
  actor_id uuid,
  actor_name text,
  module text NOT NULL,
  action text NOT NULL,
  record_id uuid,
  record_label text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- ============ indexes ============
CREATE INDEX idx_hospitals_org ON public.hospitals(organization_id);
CREATE INDEX idx_hospitals_group ON public.hospitals(hospital_group_id);
CREATE INDEX idx_hospitals_status ON public.hospitals(status);
CREATE INDEX idx_branches_hospital ON public.branches(hospital_id);
CREATE INDEX idx_departments_hospital ON public.departments(hospital_id);
CREATE INDEX idx_departments_branch ON public.departments(branch_id);
CREATE INDEX idx_teams_hospital ON public.teams(hospital_id);
CREATE INDEX idx_team_members_team ON public.team_members(team_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_scopes_user ON public.user_scopes(user_id);
CREATE INDEX idx_tpa_spocs_tpa ON public.tpa_spocs(tpa_id);
CREATE INDEX idx_tpa_spocs_hospital ON public.tpa_spocs(hospital_id);
CREATE INDEX idx_master_items_list ON public.master_list_items(list_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read_at);
CREATE INDEX idx_audit_hospital ON public.audit_logs(hospital_id, created_at DESC);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);

-- ============ updated_at triggers ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','hospital_groups','hospitals','branches','departments','profiles','teams','team_members','roles','insurers','tpas','tpa_spocs','master_lists','master_list_items','onboarding_checklists','onboarding_steps','settings']
  LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- ============ security definer helpers ============
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.key = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.module = _module AND p.action = _action);
$$;

CREATE OR REPLACE FUNCTION public.can_access_hospital(_user_id uuid, _hospital_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_scopes s
    LEFT JOIN public.hospitals h ON h.id = _hospital_id
    LEFT JOIN public.branches b ON b.id = s.branch_id
    WHERE s.user_id = _user_id AND (
      s.scope_type = 'platform'
      OR (s.scope_type = 'group' AND s.hospital_group_id = h.hospital_group_id)
      OR (s.scope_type = 'hospital' AND s.hospital_id = _hospital_id)
      OR (s.scope_type = 'branch' AND b.hospital_id = _hospital_id)
    ));
$$;

CREATE OR REPLACE FUNCTION public.can_access_branch(_user_id uuid, _branch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_scopes s
    LEFT JOIN public.branches tb ON tb.id = _branch_id
    WHERE s.user_id = _user_id AND (
      s.scope_type = 'platform'
      OR (s.scope_type = 'group' AND s.hospital_group_id = (SELECT hospital_group_id FROM public.hospitals WHERE id = tb.hospital_id))
      OR (s.scope_type = 'hospital' AND s.hospital_id = tb.hospital_id)
      OR (s.scope_type = 'branch' AND s.branch_id = _branch_id)
    ));
$$;

CREATE OR REPLACE FUNCTION public.can_access_org(_user_id uuid, _organization_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_scopes s WHERE s.user_id = _user_id
      AND (s.scope_type = 'platform' OR s.organization_id = _organization_id));
$$;

-- bootstrap: create own profile; first ever user becomes platform super admin
CREATE OR REPLACE FUNCTION public.bootstrap_current_user(_full_name text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  platform_org uuid;
  sa_role uuid;
  existing_admins int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT email INTO uemail FROM auth.users WHERE id = uid;
  SELECT id INTO platform_org FROM public.organizations WHERE code = 'RCMBUDDY';
  SELECT id INTO sa_role FROM public.roles WHERE key = 'super_admin';
  SELECT count(*) INTO existing_admins FROM public.user_roles ur WHERE ur.role_id = sa_role;

  INSERT INTO public.profiles (id, organization_id, full_name, email, is_platform_user, last_active_at)
  VALUES (uid, CASE WHEN existing_admins = 0 THEN platform_org ELSE NULL END,
          COALESCE(NULLIF(_full_name,''), split_part(COALESCE(uemail,'user'),'@',1)), uemail,
          existing_admins = 0, now())
  ON CONFLICT (id) DO UPDATE SET last_active_at = now(),
    full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END;

  IF existing_admins = 0 THEN
    INSERT INTO public.user_roles (user_id, role_id, organization_id) VALUES (uid, sa_role, platform_org)
      ON CONFLICT DO NOTHING;
    INSERT INTO public.user_scopes (user_id, scope_type, organization_id) VALUES (uid, 'platform', platform_org);
    UPDATE public.profiles SET organization_id = platform_org, is_platform_user = true WHERE id = uid;
  END IF;
  RETURN uid;
END; $$;

-- ============ grants ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','hospital_groups','hospitals','branches','departments','profiles','teams','team_members','roles','permissions','role_permissions','user_roles','user_scopes','insurers','tpas','tpa_spocs','master_lists','master_list_items','onboarding_checklists','onboarding_steps','notifications','settings']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============ policies ============
-- organizations
CREATE POLICY org_select ON public.organizations FOR SELECT TO authenticated USING (public.can_access_org(auth.uid(), id));
CREATE POLICY org_write ON public.organizations FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- hospital_groups
CREATE POLICY hg_select ON public.hospital_groups FOR SELECT TO authenticated USING (public.can_access_org(auth.uid(), organization_id));
CREATE POLICY hg_write ON public.hospital_groups FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'hospitals','EDIT')) WITH CHECK (public.has_permission(auth.uid(),'hospitals','EDIT'));

-- hospitals
CREATE POLICY hosp_select ON public.hospitals FOR SELECT TO authenticated USING (public.can_access_hospital(auth.uid(), id));
CREATE POLICY hosp_insert ON public.hospitals FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(),'hospitals','CREATE'));
CREATE POLICY hosp_update ON public.hospitals FOR UPDATE TO authenticated USING (public.can_access_hospital(auth.uid(), id) AND public.has_permission(auth.uid(),'hospitals','EDIT')) WITH CHECK (public.can_access_hospital(auth.uid(), id));
CREATE POLICY hosp_delete ON public.hospitals FOR DELETE TO authenticated USING (public.has_permission(auth.uid(),'hospitals','DELETE'));

-- branches
CREATE POLICY br_select ON public.branches FOR SELECT TO authenticated USING (public.can_access_branch(auth.uid(), id) OR public.can_access_hospital(auth.uid(), hospital_id));
CREATE POLICY br_insert ON public.branches FOR INSERT TO authenticated WITH CHECK (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'hospitals','CREATE'));
CREATE POLICY br_update ON public.branches FOR UPDATE TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'hospitals','EDIT')) WITH CHECK (public.can_access_hospital(auth.uid(), hospital_id));
CREATE POLICY br_delete ON public.branches FOR DELETE TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'hospitals','DELETE'));

-- departments
CREATE POLICY dept_select ON public.departments FOR SELECT TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id));
CREATE POLICY dept_write ON public.departments FOR ALL TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'master_data','EDIT')) WITH CHECK (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'master_data','EDIT'));

-- profiles
CREATE POLICY prof_self ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY prof_admin_select ON public.profiles FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'users','VIEW'));
CREATE POLICY prof_self_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY prof_admin_write ON public.profiles FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'users','EDIT')) WITH CHECK (public.has_permission(auth.uid(),'users','EDIT'));

-- teams
CREATE POLICY team_select ON public.teams FOR SELECT TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id));
CREATE POLICY team_write ON public.teams FOR ALL TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'teams','EDIT')) WITH CHECK (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'teams','EDIT'));

-- team members
CREATE POLICY tm_select ON public.team_members FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND public.can_access_hospital(auth.uid(), t.hospital_id)));
CREATE POLICY tm_write ON public.team_members FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'teams','ASSIGN')) WITH CHECK (public.has_permission(auth.uid(),'teams','ASSIGN'));

-- roles / permissions
CREATE POLICY roles_select ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY roles_write ON public.roles FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'administration','CONFIGURE')) WITH CHECK (public.has_permission(auth.uid(),'administration','CONFIGURE'));
CREATE POLICY perms_select ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY perms_write ON public.permissions FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY rp_select ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY rp_write ON public.role_permissions FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'administration','CONFIGURE')) WITH CHECK (public.has_permission(auth.uid(),'administration','CONFIGURE'));

-- user roles / scopes
CREATE POLICY ur_select ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_permission(auth.uid(),'users','VIEW'));
CREATE POLICY ur_write ON public.user_roles FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'users','ASSIGN')) WITH CHECK (public.has_permission(auth.uid(),'users','ASSIGN'));
CREATE POLICY us_select ON public.user_scopes FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_permission(auth.uid(),'users','VIEW'));
CREATE POLICY us_write ON public.user_scopes FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'users','ASSIGN')) WITH CHECK (public.has_permission(auth.uid(),'users','ASSIGN'));

-- payer master
CREATE POLICY ins_select ON public.insurers FOR SELECT TO authenticated USING (public.can_access_org(auth.uid(), organization_id));
CREATE POLICY ins_write ON public.insurers FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'payers','EDIT')) WITH CHECK (public.has_permission(auth.uid(),'payers','EDIT'));
CREATE POLICY tpa_select ON public.tpas FOR SELECT TO authenticated USING (public.can_access_org(auth.uid(), organization_id));
CREATE POLICY tpa_write ON public.tpas FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'payers','EDIT')) WITH CHECK (public.has_permission(auth.uid(),'payers','EDIT'));
CREATE POLICY spoc_select ON public.tpa_spocs FOR SELECT TO authenticated USING (hospital_id IS NULL AND public.can_access_org(auth.uid(), organization_id) OR public.can_access_hospital(auth.uid(), hospital_id));
CREATE POLICY spoc_write ON public.tpa_spocs FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'payers','EDIT')) WITH CHECK (public.has_permission(auth.uid(),'payers','EDIT'));

-- master data
CREATE POLICY ml_select ON public.master_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY ml_write ON public.master_lists FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'master_data','CONFIGURE')) WITH CHECK (public.has_permission(auth.uid(),'master_data','CONFIGURE'));
CREATE POLICY mli_select ON public.master_list_items FOR SELECT TO authenticated USING (hospital_id IS NULL OR public.can_access_hospital(auth.uid(), hospital_id));
CREATE POLICY mli_write ON public.master_list_items FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'master_data','EDIT')) WITH CHECK (public.has_permission(auth.uid(),'master_data','EDIT'));

-- onboarding
CREATE POLICY ob_select ON public.onboarding_checklists FOR SELECT TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id));
CREATE POLICY ob_write ON public.onboarding_checklists FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'hospitals','EDIT')) WITH CHECK (public.has_permission(auth.uid(),'hospitals','EDIT'));
CREATE POLICY obs_select ON public.onboarding_steps FOR SELECT TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id));
CREATE POLICY obs_write ON public.onboarding_steps FOR ALL TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'hospitals','EDIT')) WITH CHECK (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'hospitals','EDIT'));

-- notifications
CREATE POLICY notif_select ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notif_update ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notif_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(),'administration','CONFIGURE'));

-- audit logs: read-only for admins, never writable from the client
CREATE POLICY audit_select ON public.audit_logs FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'audit','VIEW') AND (hospital_id IS NULL OR public.can_access_hospital(auth.uid(), hospital_id)));

-- settings
CREATE POLICY set_select ON public.settings FOR SELECT TO authenticated USING (hospital_id IS NULL OR public.can_access_hospital(auth.uid(), hospital_id));
CREATE POLICY set_write ON public.settings FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'settings','CONFIGURE')) WITH CHECK (public.has_permission(auth.uid(),'settings','CONFIGURE'));

-- ============ generic audit trigger ============
CREATE OR REPLACE FUNCTION public.write_audit_log() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_name text;
  v_hospital uuid;
  v_org uuid;
  v_rec jsonb;
BEGIN
  v_rec := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_actor;
  v_hospital := NULLIF(v_rec->>'hospital_id','')::uuid;
  IF TG_TABLE_NAME = 'hospitals' THEN v_hospital := NULLIF(v_rec->>'id','')::uuid; END IF;
  v_org := NULLIF(v_rec->>'organization_id','')::uuid;

  INSERT INTO public.audit_logs (organization_id, hospital_id, actor_id, actor_name, module, action, record_id, record_label, old_value, new_value)
  VALUES (v_org, v_hospital, v_actor, v_name, TG_TABLE_NAME, TG_OP,
          NULLIF(v_rec->>'id','')::uuid, COALESCE(v_rec->>'name', v_rec->>'full_name', v_rec->>'label'),
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
          CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END; $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hospital_groups','hospitals','branches','departments','teams','team_members','profiles','user_roles','user_scopes','insurers','tpas','tpa_spocs','master_list_items','onboarding_steps','role_permissions','settings']
  LOOP
    EXECUTE format('CREATE TRIGGER audit_%s AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.write_audit_log()', t, t);
  END LOOP;
END $$;

-- ============ seed: permissions & roles ============
INSERT INTO public.permissions (module, action)
SELECT m, a FROM unnest(ARRAY['dashboard','command_center','work_queue','claims','preauth','discharge','queries','denials','ar','followups','payers','communication','settlements','reconciliation','tariffs','patients','documents','tasks','teams','reports','analytics','master_data','hospitals','users','administration','settings','audit']) m
CROSS JOIN unnest(ARRAY['VIEW','CREATE','EDIT','DELETE','ASSIGN','REASSIGN','APPROVE','EXPORT','IMPORT','ESCALATE','CLOSE','REOPEN','CONFIGURE']) a;

INSERT INTO public.roles (key, name, description, role_level) VALUES
 ('super_admin','Super Admin','Full platform access across all hospitals','platform'),
 ('ops_admin','Operations Admin','Manages assigned hospitals and operations','platform'),
 ('support','Support','Supports hospitals without financial access','platform'),
 ('hospital_admin','Hospital Admin','Administers a single hospital','hospital'),
 ('cfo','CFO','Financial leadership view','hospital'),
 ('finance_head','Finance Head','Finance oversight','hospital'),
 ('rcm_head','RCM Head','Owns the revenue cycle for the hospital','hospital'),
 ('rcm_manager','RCM Manager','Runs day-to-day RCM operations','hospital'),
 ('rcm_executive','RCM Executive','Works claims and follow-ups','branch'),
 ('billing_manager','Billing Manager','Billing oversight','hospital'),
 ('billing_executive','Billing Executive','Billing operations','branch'),
 ('ar_manager','AR Manager','Owns accounts receivable','hospital'),
 ('ar_executive','AR Executive','AR follow-up','branch'),
 ('denial_manager','Denial Manager','Owns denial management','hospital'),
 ('denial_executive','Denial Executive','Denial follow-up','branch'),
 ('cashless_manager','Cashless Manager','Owns pre-authorisation','hospital'),
 ('cashless_executive','Cashless Executive','Pre-auth operations','branch'),
 ('auditor','Auditor','Read-only audit access','hospital'),
 ('management_viewer','Management Viewer','Read-only management dashboards','hospital');

-- super admin: everything
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.key = 'super_admin';

-- ops admin: everything except platform administration deletes
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key = 'ops_admin' AND NOT (p.module IN ('administration','settings') AND p.action = 'DELETE');

-- support: view + audit view
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key = 'support' AND p.action = 'VIEW' AND p.module NOT IN ('settlements','reconciliation','analytics');

-- hospital admin / rcm head: full within hospital modules
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key IN ('hospital_admin','rcm_head') AND p.module <> 'administration';

-- managers: operate their modules
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key IN ('rcm_manager','billing_manager','ar_manager','denial_manager','cashless_manager')
  AND p.module NOT IN ('administration','users','hospitals')
  AND p.action <> 'DELETE';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key IN ('rcm_manager','billing_manager','ar_manager','denial_manager','cashless_manager')
  AND p.module IN ('users','teams') AND p.action IN ('VIEW','ASSIGN','REASSIGN')
ON CONFLICT DO NOTHING;

-- executives: work their queues
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key IN ('rcm_executive','billing_executive','ar_executive','denial_executive','cashless_executive')
  AND p.module IN ('dashboard','command_center','work_queue','claims','preauth','discharge','queries','denials','ar','followups','tasks','documents','patients','communication','payers')
  AND p.action IN ('VIEW','CREATE','EDIT','ESCALATE','CLOSE');

-- finance
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key IN ('cfo','finance_head')
  AND (p.action IN ('VIEW','EXPORT') OR (p.module IN ('settlements','reconciliation') AND p.action IN ('CREATE','EDIT','APPROVE')));

-- read-only roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key = 'management_viewer' AND p.action = 'VIEW' AND p.module IN ('dashboard','command_center','analytics','reports','claims','ar','denials','payers','teams');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key = 'auditor' AND p.action IN ('VIEW','EXPORT');

-- ============ seed: organisations & hierarchy ============
INSERT INTO public.organizations (name, code, org_type) VALUES
 ('RCM Buddy Platform','RCMBUDDY','platform'),
 ('Apex Healthcare Holdings','APEXORG','customer'),
 ('Sanjeevani Care Trust','SANJORG','customer');

INSERT INTO public.hospital_groups (organization_id, name, code, headquarters_city)
SELECT o.id, g.name, g.code, g.city FROM (VALUES
 ('APEXORG','Apex Hospitals Group','APEXGRP','Mumbai'),
 ('SANJORG','Sanjeevani Hospitals Group','SANJGRP','Hyderabad')
) AS g(org, name, code, city) JOIN public.organizations o ON o.code = g.org;

INSERT INTO public.hospitals (organization_id, hospital_group_id, name, code, city, state, bed_count, status, go_live_date)
SELECT hg.organization_id, hg.id, h.name, h.code, h.city, h.state, h.beds, h.status, h.go_live::date
FROM (VALUES
 ('APEXGRP','Apex Superspeciality Hospital, Andheri','APX-AND','Mumbai','Maharashtra',420,'active','2025-06-01'),
 ('APEXGRP','Apex Multispeciality Hospital, Pune','APX-PUN','Pune','Maharashtra',260,'active','2025-09-15'),
 ('SANJGRP','Sanjeevani Institute of Medical Sciences','SNJ-HYD','Hyderabad','Telangana',510,'active','2025-03-10'),
 ('SANJGRP','Sanjeevani Hospital, Vijayawada','SNJ-VJA','Vijayawada','Andhra Pradesh',180,'onboarding',NULL)
) AS h(grp, name, code, city, state, beds, status, go_live)
JOIN public.hospital_groups hg ON hg.code = h.grp;

INSERT INTO public.branches (organization_id, hospital_id, name, code, city, state)
SELECT hp.organization_id, hp.id, b.name, b.code, b.city, b.state
FROM (VALUES
 ('APX-AND','Andheri East Main Campus','APX-AND-MAIN','Mumbai','Maharashtra'),
 ('APX-AND','Andheri West Daycare Centre','APX-AND-DAY','Mumbai','Maharashtra'),
 ('APX-PUN','Kothrud Campus','APX-PUN-KOT','Pune','Maharashtra'),
 ('SNJ-HYD','Banjara Hills Campus','SNJ-HYD-BAN','Hyderabad','Telangana'),
 ('SNJ-HYD','Gachibowli Campus','SNJ-HYD-GAC','Hyderabad','Telangana'),
 ('SNJ-VJA','Benz Circle Campus','SNJ-VJA-BEN','Vijayawada','Andhra Pradesh')
) AS b(hosp, name, code, city, state)
JOIN public.hospitals hp ON hp.code = b.hosp;

INSERT INTO public.departments (organization_id, hospital_id, branch_id, name, code, dept_type)
SELECT b.organization_id, b.hospital_id, b.id, d.name, d.code || '-' || b.code, d.dtype
FROM public.branches b
CROSS JOIN (VALUES
 ('Insurance Desk','INSDESK','rcm'),
 ('Billing','BILLING','rcm'),
 ('Accounts Receivable','ARDEPT','finance'),
 ('Medical Records','MRD','support'),
 ('Cardiology','CARD','clinical'),
 ('Orthopaedics','ORTHO','clinical')
) AS d(name, code, dtype);

INSERT INTO public.teams (organization_id, hospital_id, branch_id, department_id, name, code)
SELECT d.organization_id, d.hospital_id, d.branch_id, d.id,
       CASE d.code_prefix WHEN 'INSDESK' THEN 'Cashless Team' WHEN 'ARDEPT' THEN 'AR Follow-up Team' ELSE 'Billing Team' END,
       d.code_prefix || '-TEAM-' || substr(d.id::text,1,8)
FROM (SELECT *, split_part(code,'-',1) AS code_prefix FROM public.departments) d
WHERE d.code_prefix IN ('INSDESK','ARDEPT','BILLING');

-- ============ seed: payers ============
INSERT INTO public.insurers (organization_id, name, payer_code, insurer_type, portal_url, support_email)
SELECT o.id, i.name, i.code, i.itype, i.portal, i.email
FROM public.organizations o
CROSS JOIN (VALUES
 ('Star Health and Allied Insurance','STAR','private','https://portal.starhealth.in','provider@starhealth.in'),
 ('HDFC ERGO General Insurance','HDFCERGO','private','https://portal.hdfcergo.com','hospitals@hdfcergo.com'),
 ('Niva Bupa Health Insurance','NIVABUPA','private','https://provider.nivabupa.com','provider@nivabupa.com'),
 ('New India Assurance','NIA','public','https://portal.newindia.co.in','claims@newindia.co.in'),
 ('Ayushman Bharat PM-JAY','PMJAY','government_scheme','https://hospitals.pmjay.gov.in','support@pmjay.gov.in'),
 ('ICICI Lombard General Insurance','ICICIL','private','https://provider.icicilombard.com','provider@icicilombard.com')
) AS i(name, code, itype, portal, email)
WHERE o.org_type = 'customer';

INSERT INTO public.tpas (organization_id, name, tpa_code, portal_url, support_email)
SELECT o.id, t.name, t.code, t.portal, t.email
FROM public.organizations o
CROSS JOIN (VALUES
 ('Medi Assist Insurance TPA','MEDIASSIST','https://portal.mediassist.in','provider@mediassist.in'),
 ('Paramount Health Services TPA','PARAMOUNT','https://portal.paramounttpa.com','hospital@paramounttpa.com'),
 ('Vidal Health TPA','VIDAL','https://portal.vidalhealth.com','provider@vidalhealth.com'),
 ('Health India TPA','HEALTHINDIA','https://portal.healthindiatpa.com','claims@healthindiatpa.com'),
 ('Raksha Health Insurance TPA','RAKSHA','https://portal.rakshatpa.com','hospital@rakshatpa.com')
) AS t(name, code, portal, email)
WHERE o.org_type = 'customer';

INSERT INTO public.tpa_spocs (organization_id, tpa_id, hospital_id, name, designation, email, phone, location, escalation_level)
SELECT h.organization_id, t.id, h.id, s.name, s.designation, s.email, s.phone, h.city, s.lvl
FROM public.hospitals h
JOIN public.tpas t ON t.organization_id = h.organization_id
CROSS JOIN (VALUES
 ('Rahul Deshmukh','Provider Relationship Manager','rahul.d@tpa-example.in','+91 98200 11223',1),
 ('Sneha Iyer','Regional Escalation Manager','sneha.i@tpa-example.in','+91 98450 33445',2)
) AS s(name, designation, email, phone, lvl)
WHERE t.tpa_code IN ('MEDIASSIST','PARAMOUNT');

-- ============ seed: master lists ============
INSERT INTO public.master_lists (key, name, description) VALUES
 ('claim_status','Claim Statuses','Configurable stages of the claim lifecycle'),
 ('denial_reason','Denial Reasons','Reasons payers deny a claim'),
 ('query_reason','Query Reasons','Common payer query categories'),
 ('claim_type','Claim Types','Cashless, reimbursement and scheme claims'),
 ('task_type','Task Types','Types of work created across modules'),
 ('communication_type','Communication Types','Channels used to contact payers');

INSERT INTO public.master_list_items (list_id, code, label, sort_order)
SELECT l.id, i.code, i.label, i.ord FROM public.master_lists l
JOIN (VALUES
 ('claim_status','ADMITTED','Patient Admitted',1),
 ('claim_status','PREAUTH_INITIATED','Pre-auth Initiated',2),
 ('claim_status','PREAUTH_APPROVED','Pre-auth Approved',3),
 ('claim_status','DISCHARGED','Patient Discharged',4),
 ('claim_status','CLAIM_READY','Claim Ready',5),
 ('claim_status','SUBMITTED','Claim Submitted',6),
 ('claim_status','QUERY','Claim Query',7),
 ('claim_status','APPROVED','Claim Approved',8),
 ('claim_status','PAYMENT_RECEIVED','Payment Received',9),
 ('claim_status','RECONCILED','Reconciled',10),
 ('claim_status','SHORT_PAID','Short Payment',11),
 ('claim_status','DENIED','Denied',12),
 ('claim_status','CLOSED','Closed',13),
 ('denial_reason','DOC_MISSING','Documentation incomplete',1),
 ('denial_reason','ELIGIBILITY','Eligibility not established',2),
 ('denial_reason','AUTH','Authorisation not obtained',3),
 ('denial_reason','CODING','Coding error',4),
 ('denial_reason','TARIFF','Tariff mismatch',5),
 ('denial_reason','MED_NECESSITY','Medical necessity not proven',6),
 ('denial_reason','EXCLUSION','Policy exclusion',7),
 ('denial_reason','TIMELY_FILING','Timely filing breach',8),
 ('query_reason','DISCHARGE_SUMMARY','Discharge summary required',1),
 ('query_reason','INVESTIGATION','Investigation reports required',2),
 ('query_reason','ID_PROOF','KYC / ID proof required',3),
 ('query_reason','BILL_BREAKUP','Detailed bill break-up required',4),
 ('claim_type','CASHLESS','Cashless',1),
 ('claim_type','REIMBURSEMENT','Reimbursement',2),
 ('claim_type','SCHEME','Government Scheme',3),
 ('claim_type','CORPORATE','Corporate',4),
 ('task_type','FOLLOWUP','Payer Follow-up',1),
 ('task_type','QUERY_RESPONSE','Query Response',2),
 ('task_type','DOC_UPLOAD','Document Upload',3),
 ('task_type','AR_CALL','AR Call',4),
 ('task_type','ESCALATION','Escalation',5),
 ('communication_type','EMAIL','Email',1),
 ('communication_type','PHONE','Phone',2),
 ('communication_type','WHATSAPP','WhatsApp',3),
 ('communication_type','PORTAL','Payer Portal',4),
 ('communication_type','MEETING','Meeting',5),
 ('communication_type','LETTER','Letter',6)
) AS i(list_key, code, label, ord) ON i.list_key = l.key;

-- ============ seed: onboarding checklists ============
INSERT INTO public.onboarding_checklists (organization_id, hospital_id, status)
SELECT organization_id, id, CASE WHEN status = 'active' THEN 'completed' ELSE 'in_progress' END FROM public.hospitals;

INSERT INTO public.onboarding_steps (checklist_id, organization_id, hospital_id, step_key, title, sort_order, status, completed_at)
SELECT c.id, c.organization_id, c.hospital_id, s.key, s.title, s.ord,
  CASE WHEN c.status = 'completed' THEN 'completed' WHEN s.ord <= 4 THEN 'completed' WHEN s.ord = 5 THEN 'in_progress' ELSE 'pending' END,
  CASE WHEN c.status = 'completed' OR s.ord <= 4 THEN now() ELSE NULL END
FROM public.onboarding_checklists c
CROSS JOIN (VALUES
 ('hospital_details','Hospital details captured',1),
 ('branches','Branches created',2),
 ('departments','Departments created',3),
 ('teams','Teams created',4),
 ('payers','Payers mapped',5),
 ('tpas','TPAs mapped',6),
 ('spocs','TPA contacts captured',7),
 ('tariffs','Tariffs uploaded',8),
 ('users','Users created and roles assigned',9),
 ('historical_claims','Historical claims imported',10),
 ('sla','SLA rules configured',11),
 ('workflows','Workflows configured',12),
 ('escalation','Escalation matrix configured',13),
 ('go_live','Go live',14)
) AS s(key, title, ord);
