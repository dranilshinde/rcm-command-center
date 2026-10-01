CREATE TABLE public.admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  user_id uuid,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  send_count integer NOT NULL DEFAULT 1,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_invitations_hospital_idx ON public.admin_invitations(hospital_id, status);
CREATE INDEX admin_invitations_email_idx ON public.admin_invitations(lower(email));

GRANT SELECT ON public.admin_invitations TO authenticated;
GRANT ALL ON public.admin_invitations TO service_role;
ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY inv_select ON public.admin_invitations FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid())
  OR (public.has_permission(auth.uid(),'users','VIEW') AND public.can_access_hospital(auth.uid(), hospital_id)));

CREATE TRIGGER admin_invitations_updated_at BEFORE UPDATE ON public.admin_invitations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER admin_invitations_audit AFTER INSERT OR UPDATE OR DELETE ON public.admin_invitations
FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();