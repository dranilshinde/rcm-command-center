ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS rohini_id text;
CREATE INDEX IF NOT EXISTS idx_hospitals_rohini ON public.hospitals(rohini_id);

CREATE SEQUENCE IF NOT EXISTS public.claim_code_seq;

CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  uhid text, full_name text NOT NULL, phone text, member_id text, gender text, date_of_birth date,
  deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);
CREATE INDEX idx_patients_hosp ON public.patients(hospital_id, full_name);
CREATE INDEX idx_patients_member ON public.patients(hospital_id, member_id);
CREATE UNIQUE INDEX uq_patients_uhid ON public.patients(hospital_id, uhid) WHERE uhid IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE public.admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  branch_id uuid REFERENCES public.branches(id),
  department_id uuid REFERENCES public.departments(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  ip_number text, admission_date date NOT NULL, discharge_date date,
  status text NOT NULL DEFAULT 'admitted',
  treating_doctor text, treatment text, diagnosis text,
  insurer_id uuid REFERENCES public.insurers(id), tpa_id uuid REFERENCES public.tpas(id),
  policy_number text, policy_type text, policy_holder_name text, employee_code text, member_id text,
  deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);
CREATE INDEX idx_adm_hosp ON public.admissions(hospital_id, status, admission_date DESC);
CREATE INDEX idx_adm_patient ON public.admissions(patient_id);
CREATE UNIQUE INDEX uq_adm_ip ON public.admissions(hospital_id, ip_number) WHERE ip_number IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE public.preauths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  admission_id uuid NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  reference_no text, kind text NOT NULL DEFAULT 'initial',
  requested_amount numeric(14,2) NOT NULL DEFAULT 0, approved_amount numeric(14,2),
  status text NOT NULL DEFAULT 'requested',
  requested_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, remarks text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);
CREATE INDEX idx_preauth_hosp ON public.preauths(hospital_id, status, requested_at DESC);
CREATE INDEX idx_preauth_adm ON public.preauths(admission_id);

CREATE TABLE public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_code text NOT NULL UNIQUE DEFAULT ('RCM-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.claim_code_seq')::text, 6, '0')),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  branch_id uuid REFERENCES public.branches(id),
  admission_id uuid NOT NULL REFERENCES public.admissions(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  external_claim_no text, initial_claim_no text, case_ref_id text, invoice_number text,
  claim_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'draft',
  reconciled boolean NOT NULL DEFAULT false,
  claimed_amount numeric(14,2) NOT NULL DEFAULT 0, approved_amount numeric(14,2) NOT NULL DEFAULT 0,
  copay numeric(14,2) NOT NULL DEFAULT 0, shortfall_amount numeric(14,2) NOT NULL DEFAULT 0,
  hospital_discount numeric(14,2) NOT NULL DEFAULT 0, patient_paid numeric(14,2) NOT NULL DEFAULT 0,
  settled_amount numeric(14,2) NOT NULL DEFAULT 0, tds_amount numeric(14,2) NOT NULL DEFAULT 0,
  short_payment numeric(14,2) GENERATED ALWAYS AS (GREATEST(approved_amount - settled_amount - tds_amount, 0)) STORED,
  document_submitted_at date, payment_date date, insurer_comments text,
  readiness_score integer NOT NULL DEFAULT 0, readiness_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  assigned_to uuid REFERENCES public.profiles(id), priority text NOT NULL DEFAULT 'normal',
  last_status_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);
CREATE INDEX idx_claims_hosp ON public.claims(hospital_id, status, claim_date DESC);
CREATE INDEX idx_claims_assignee ON public.claims(assigned_to, status);
CREATE INDEX idx_claims_adm ON public.claims(admission_id);
CREATE UNIQUE INDEX uq_claims_ext ON public.claims(hospital_id, external_claim_no) WHERE external_claim_no IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE public.claim_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL, hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  from_status text, to_status text NOT NULL, note text, actor_id uuid, actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_csh_claim ON public.claim_status_history(claim_id, created_at);

CREATE TABLE public.claim_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL, hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL DEFAULT 0, tds_amount numeric(14,2) NOT NULL DEFAULT 0,
  utr_number text, payment_date date, receipt_no text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_by uuid
);
CREATE INDEX idx_cp_claim ON public.claim_payments(claim_id);
CREATE INDEX idx_cp_utr ON public.claim_payments(hospital_id, utr_number);

CREATE TABLE public.claim_couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL, hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  agency text, provider text, destination text, dispatch_date date, sender_name text, tracking_id text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_by uuid
);
CREATE INDEX idx_cc_claim ON public.claim_couriers(claim_id);

CREATE TABLE public.claim_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL, hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  body text NOT NULL, author_id uuid, author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cn_claim ON public.claim_notes(claim_id, created_at);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL, hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  branch_id uuid REFERENCES public.branches(id), team_id uuid REFERENCES public.teams(id),
  entity_type text NOT NULL DEFAULT 'claim', entity_id uuid, claim_id uuid REFERENCES public.claims(id) ON DELETE CASCADE,
  title text NOT NULL, description text, task_type text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'open', priority text NOT NULL DEFAULT 'normal',
  assigned_to uuid REFERENCES public.profiles(id), due_at timestamptz, completed_at timestamptz,
  amount_at_stake numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_by uuid
);
CREATE INDEX idx_tasks_hosp ON public.tasks(hospital_id, status, due_at);
CREATE INDEX idx_tasks_assignee ON public.tasks(assigned_to, status, due_at);
CREATE INDEX idx_tasks_claim ON public.tasks(claim_id);

CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL, hospital_id uuid REFERENCES public.hospitals(id),
  file_name text NOT NULL, import_type text NOT NULL DEFAULT 'claims',
  status text NOT NULL DEFAULT 'validated',
  total_rows integer NOT NULL DEFAULT 0, valid_rows integer NOT NULL DEFAULT 0, error_rows integer NOT NULL DEFAULT 0,
  created_rows integer NOT NULL DEFAULT 0, updated_rows integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by uuid, completed_at timestamptz
);
CREATE INDEX idx_ij_org ON public.import_jobs(organization_id, created_at DESC);

CREATE TABLE public.import_job_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  row_number integer NOT NULL, status text NOT NULL, errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  claim_id uuid REFERENCES public.claims(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ijr_job ON public.import_job_rows(job_id, row_number);

-- grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients, public.admissions, public.preauths, public.claims, public.claim_status_history, public.claim_payments, public.claim_couriers, public.claim_notes, public.tasks, public.import_jobs, public.import_job_rows TO authenticated;
GRANT ALL ON public.patients, public.admissions, public.preauths, public.claims, public.claim_status_history, public.claim_payments, public.claim_couriers, public.claim_notes, public.tasks, public.import_jobs, public.import_job_rows TO service_role;
GRANT USAGE ON SEQUENCE public.claim_code_seq TO authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('patients','patients'),('admissions','patients'),('preauths','preauth'),('claims','claims'),
    ('claim_payments','claims'),('claim_couriers','claims'),('tasks','tasks')) v(t,m)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.t);
    EXECUTE format('CREATE POLICY %1$s_select ON public.%1$I FOR SELECT TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(), %2$L, ''VIEW''))', r.t, r.m);
    EXECUTE format('CREATE POLICY %1$s_insert ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(), %2$L, ''CREATE''))', r.t, r.m);
    EXECUTE format('CREATE POLICY %1$s_update ON public.%1$I FOR UPDATE TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(), %2$L, ''EDIT'')) WITH CHECK (public.can_access_hospital(auth.uid(), hospital_id))', r.t, r.m);
    EXECUTE format('CREATE POLICY %1$s_delete ON public.%1$I FOR DELETE TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(), %2$L, ''DELETE''))', r.t, r.m);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', r.t);
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.write_audit_log()', r.t);
  END LOOP;
END $$;

-- append-only history & notes
ALTER TABLE public.claim_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY csh_select ON public.claim_status_history FOR SELECT TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'claims','VIEW'));
CREATE POLICY csh_insert ON public.claim_status_history FOR INSERT TO authenticated WITH CHECK (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'claims','VIEW') AND actor_id = auth.uid());
ALTER TABLE public.claim_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY cn_select ON public.claim_notes FOR SELECT TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'claims','VIEW'));
CREATE POLICY cn_insert ON public.claim_notes FOR INSERT TO authenticated WITH CHECK (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'claims','VIEW') AND author_id = auth.uid());

-- imports
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ij_select ON public.import_jobs FOR SELECT TO authenticated USING (public.can_access_org(auth.uid(), organization_id) AND (hospital_id IS NULL OR public.can_access_hospital(auth.uid(), hospital_id)) AND public.has_permission(auth.uid(),'claims','IMPORT'));
CREATE POLICY ij_insert ON public.import_jobs FOR INSERT TO authenticated WITH CHECK (public.can_access_org(auth.uid(), organization_id) AND public.has_permission(auth.uid(),'claims','IMPORT') AND created_by = auth.uid());
CREATE POLICY ij_update ON public.import_jobs FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.import_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.import_job_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY ijr_select ON public.import_job_rows FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.import_jobs j WHERE j.id = job_id AND j.created_by = auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY ijr_insert ON public.import_job_rows FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.import_jobs j WHERE j.id = job_id AND j.created_by = auth.uid()));

-- managers/executives get claims IMPORT where they lacked it
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key IN ('rcm_executive','billing_executive','cashless_executive') AND p.module IN ('claims','preauth','discharge','patients','tasks') AND p.action IN ('ASSIGN','IMPORT')
ON CONFLICT DO NOTHING;