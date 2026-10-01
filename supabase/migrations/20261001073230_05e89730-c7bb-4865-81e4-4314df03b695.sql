CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS sla_due_at timestamptz, ADD COLUMN IF NOT EXISTS sla_process text,
  ADD COLUMN IF NOT EXISTS next_followup_at timestamptz, ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_claims_sla ON public.claims(hospital_id, sla_due_at) WHERE deleted_at IS NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz, ADD COLUMN IF NOT EXISTS rule_id uuid;

-- ============ rules ============
CREATE TABLE public.sla_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  hospital_id uuid REFERENCES public.hospitals(id),
  insurer_id uuid REFERENCES public.insurers(id),
  tpa_id uuid REFERENCES public.tpas(id),
  process text NOT NULL,
  target_hours integer NOT NULL CHECK (target_hours > 0),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_by uuid
);
CREATE INDEX idx_sla_rules_lookup ON public.sla_rules(process, is_active);

CREATE TABLE public.reminder_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  hospital_id uuid REFERENCES public.hospitals(id),
  insurer_id uuid REFERENCES public.insurers(id),
  tpa_id uuid REFERENCES public.tpas(id),
  rule_key text NOT NULL,
  name text NOT NULL,
  threshold_hours integer NOT NULL CHECK (threshold_hours >= 0),
  escalation_level integer NOT NULL DEFAULT 0,
  notify_roles text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_by uuid
);
CREATE INDEX idx_rem_rules_lookup ON public.reminder_rules(rule_key, is_active);

-- ============ queries / follow-ups / escalations ============
CREATE TABLE public.claim_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL, hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'documentation',
  query_text text NOT NULL,
  raised_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  reply_text text, replied_at timestamptz, replied_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_by uuid
);
CREATE INDEX idx_cq_hosp ON public.claim_queries(hospital_id, status, due_at);
CREATE INDEX idx_cq_claim ON public.claim_queries(claim_id);

CREATE TABLE public.claim_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL, hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'call',
  contact_name text, spoc_id uuid REFERENCES public.tpa_spocs(id),
  outcome text NOT NULL,
  notes text,
  commitment_date date, commitment_amount numeric(14,2),
  next_followup_at timestamptz,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid
);
CREATE INDEX idx_cf_claim ON public.claim_followups(claim_id, created_at DESC);
CREATE INDEX idx_cf_commit ON public.claim_followups(hospital_id, commitment_date) WHERE commitment_date IS NOT NULL;

CREATE TABLE public.escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL, hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  claim_id uuid REFERENCES public.claims(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  rule_id uuid REFERENCES public.reminder_rules(id) ON DELETE SET NULL,
  level integer NOT NULL DEFAULT 1,
  reason text NOT NULL,
  notified_roles text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open',
  resolution_note text, resolved_at timestamptz, resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by uuid
);
CREATE INDEX idx_esc_hosp ON public.escalations(hospital_id, status, created_at DESC);
CREATE INDEX idx_esc_claim ON public.escalations(claim_id);

CREATE TABLE public.engine_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_rules, public.reminder_rules, public.claim_queries, public.claim_followups, public.escalations TO authenticated;
GRANT SELECT ON public.engine_runs TO authenticated;
GRANT ALL ON public.sla_rules, public.reminder_rules, public.claim_queries, public.claim_followups, public.escalations, public.engine_runs TO service_role;

-- rules RLS: platform defaults (org null) readable by all, editable by super admin only
ALTER TABLE public.sla_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_rules ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['sla_rules','reminder_rules'] LOOP
  EXECUTE format('CREATE POLICY %1$s_select ON public.%1$I FOR SELECT TO authenticated USING (organization_id IS NULL OR public.can_access_org(auth.uid(), organization_id))', t);
  EXECUTE format('CREATE POLICY %1$s_write ON public.%1$I FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()) OR (organization_id IS NOT NULL AND public.can_access_org(auth.uid(), organization_id) AND (hospital_id IS NULL OR public.can_access_hospital(auth.uid(), hospital_id)) AND public.has_permission(auth.uid(),''followups'',''CONFIGURE''))) WITH CHECK (public.is_super_admin(auth.uid()) OR (organization_id IS NOT NULL AND public.can_access_org(auth.uid(), organization_id) AND (hospital_id IS NULL OR public.can_access_hospital(auth.uid(), hospital_id)) AND public.has_permission(auth.uid(),''followups'',''CONFIGURE'')))', t);
  EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.write_audit_log()', t);
END LOOP; END $$;

DO $$ DECLARE r record; BEGIN
FOR r IN SELECT * FROM (VALUES ('claim_queries','queries'),('claim_followups','followups'),('escalations','followups')) v(t,m) LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.t);
  EXECUTE format('CREATE POLICY %1$s_select ON public.%1$I FOR SELECT TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(), %2$L, ''VIEW''))', r.t, r.m);
  EXECUTE format('CREATE POLICY %1$s_insert ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(), %2$L, ''CREATE''))', r.t, r.m);
  EXECUTE format('CREATE POLICY %1$s_update ON public.%1$I FOR UPDATE TO authenticated USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(), %2$L, ''EDIT'')) WITH CHECK (public.can_access_hospital(auth.uid(), hospital_id))', r.t, r.m);
  EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.write_audit_log()', r.t);
END LOOP; END $$;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.claim_queries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.escalations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.engine_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY engine_runs_select ON public.engine_runs FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'followups','CONFIGURE'));

-- ============ rule resolution (most specific wins: TPA > insurer > hospital > organisation > platform) ============
CREATE OR REPLACE FUNCTION public.pick_reminder_rule(_key text, _org uuid, _hosp uuid, _ins uuid, _tpa uuid)
RETURNS public.reminder_rules LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.reminder_rules
  WHERE rule_key = _key AND is_active
    AND (organization_id IS NULL OR organization_id = _org)
    AND (hospital_id IS NULL OR hospital_id = _hosp)
    AND (insurer_id IS NULL OR insurer_id = _ins)
    AND (tpa_id IS NULL OR tpa_id = _tpa)
  ORDER BY (tpa_id IS NOT NULL) DESC, (insurer_id IS NOT NULL) DESC, (hospital_id IS NOT NULL) DESC, (organization_id IS NOT NULL) DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.sla_hours(_process text, _hosp uuid, _ins uuid, _tpa uuid, _default integer)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT s.target_hours FROM public.sla_rules s
    WHERE s.process = _process AND s.is_active
      AND (s.organization_id IS NULL OR s.organization_id = (SELECT organization_id FROM public.hospitals WHERE id = _hosp))
      AND (s.hospital_id IS NULL OR s.hospital_id = _hosp)
      AND (s.insurer_id IS NULL OR s.insurer_id = _ins)
      AND (s.tpa_id IS NULL OR s.tpa_id = _tpa)
    ORDER BY (s.tpa_id IS NOT NULL) DESC, (s.insurer_id IS NOT NULL) DESC, (s.hospital_id IS NOT NULL) DESC, (s.organization_id IS NOT NULL) DESC
    LIMIT 1), _default)
$$;

CREATE OR REPLACE FUNCTION public.role_recipients(_hosp uuid, _roles text[])
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ur.user_id FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  JOIN public.hospitals h ON h.id = _hosp
  JOIN public.profiles p ON p.id = ur.user_id AND p.status <> 'inactive'
  WHERE r.key = ANY(_roles)
    AND (ur.hospital_id = _hosp OR (ur.hospital_id IS NULL AND (ur.organization_id = h.organization_id OR ur.organization_id IS NULL)))
$$;

-- ============ the engine ============
CREATE OR REPLACE FUNCTION public.run_rcm_engine()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  run_id uuid;
  r record; rule public.reminder_rules; lvl integer; u uuid; t_id uuid;
  n_followup int := 0; n_remind int := 0; n_commit int := 0; n_esc int := 0; n_breach int := 0;
  last_activity timestamptz; age_from timestamptz;
BEGIN
  IF uid IS NOT NULL AND NOT (public.is_super_admin(uid) OR public.has_permission(uid, 'followups', 'CONFIGURE')) THEN
    RAISE EXCEPTION 'You do not have permission to run the follow-up engine.';
  END IF;
  INSERT INTO public.engine_runs(triggered_by) VALUES (uid) RETURNING id INTO run_id;

  FOR r IN
    SELECT c.id, c.claim_code, c.organization_id, c.hospital_id, c.branch_id, c.status, c.assigned_to, c.last_status_at,
           c.document_submitted_at, c.created_at, c.claimed_amount, c.approved_amount, c.escalation_level,
           a.insurer_id, a.tpa_id,
           (SELECT max(f.created_at) FROM public.claim_followups f WHERE f.claim_id = c.id) AS last_fu
    FROM public.claims c JOIN public.admissions a ON a.id = c.admission_id
    WHERE c.deleted_at IS NULL AND c.status IN ('submitted','query','query_replied','approved','short_paid')
  LOOP
    last_activity := GREATEST(r.last_status_at, COALESCE(r.last_fu, r.last_status_at));

    -- 1. payer follow-up task when the claim has been quiet too long
    IF r.status IN ('submitted','query_replied','approved') THEN
      rule := public.pick_reminder_rule('payer_followup', r.organization_id, r.hospital_id, r.insurer_id, r.tpa_id);
      IF rule.id IS NOT NULL AND last_activity < now() - make_interval(hours => rule.threshold_hours)
         AND NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.claim_id = r.id AND t.task_type = 'payer_followup' AND t.status IN ('open','in_progress','waiting','escalated')) THEN
        INSERT INTO public.tasks(organization_id, hospital_id, branch_id, claim_id, entity_id, title, description, task_type, priority, assigned_to, due_at, amount_at_stake, rule_id)
        VALUES (r.organization_id, r.hospital_id, r.branch_id, r.id, r.id, 'Follow up with payer — ' || r.claim_code,
                'No payer movement for ' || extract(day FROM now() - last_activity)::int || ' days (rule: ' || rule.name || ')',
                'payer_followup', 'normal', r.assigned_to, now() + interval '1 day', GREATEST(r.approved_amount, r.claimed_amount), rule.id);
        n_followup := n_followup + 1;
      END IF;

      -- 2. no-response reminder on the open follow-up task
      rule := public.pick_reminder_rule('no_response', r.organization_id, r.hospital_id, r.insurer_id, r.tpa_id);
      IF rule.id IS NOT NULL AND last_activity < now() - make_interval(hours => rule.threshold_hours) THEN
        FOR t_id, u IN
          SELECT t.id, t.assigned_to FROM public.tasks t
          WHERE t.claim_id = r.id AND t.task_type = 'payer_followup' AND t.status IN ('open','in_progress','waiting','escalated')
            AND (t.last_reminded_at IS NULL OR t.last_reminded_at < now() - make_interval(hours => GREATEST(rule.threshold_hours, 24)))
        LOOP
          FOR u IN SELECT u WHERE u IS NOT NULL UNION SELECT public.role_recipients(r.hospital_id, rule.notify_roles) LOOP
            INSERT INTO public.notifications(organization_id, hospital_id, user_id, category, title, body, severity, link_to)
            VALUES (r.organization_id, r.hospital_id, u, 'reminder', 'No payer response — ' || r.claim_code,
                    'No response for ' || round(extract(epoch FROM now() - last_activity) / 3600)::int || ' hours. Log a follow-up.', 'warning', '/claims/' || r.id);
          END LOOP;
          UPDATE public.tasks SET last_reminded_at = now() WHERE id = t_id;
          n_remind := n_remind + 1;
        END LOOP;
      END IF;
    END IF;

    -- 3. ageing escalation ladder (levels 1..6)
    age_from := COALESCE(r.document_submitted_at::timestamptz, r.created_at);
    FOR lvl IN 1..6 LOOP
      rule := public.pick_reminder_rule('escalate_l' || lvl, r.organization_id, r.hospital_id, r.insurer_id, r.tpa_id);
      CONTINUE WHEN rule.id IS NULL OR r.escalation_level >= lvl OR age_from > now() - make_interval(hours => rule.threshold_hours);
      INSERT INTO public.escalations(organization_id, hospital_id, claim_id, rule_id, level, reason, notified_roles)
      VALUES (r.organization_id, r.hospital_id, r.id, rule.id, lvl,
              rule.name || ': pending ' || extract(day FROM now() - age_from)::int || ' days since submission', rule.notify_roles);
      UPDATE public.claims SET escalation_level = lvl WHERE id = r.id;
      UPDATE public.tasks SET status = 'escalated', priority = 'urgent', escalation_level = lvl
        WHERE claim_id = r.id AND status IN ('open','in_progress','waiting');
      FOR u IN SELECT public.role_recipients(r.hospital_id, rule.notify_roles) UNION SELECT r.assigned_to WHERE r.assigned_to IS NOT NULL LOOP
        INSERT INTO public.notifications(organization_id, hospital_id, user_id, category, title, body, severity, link_to)
        VALUES (r.organization_id, r.hospital_id, u, 'escalation', 'Escalation L' || lvl || ' — ' || r.claim_code,
                rule.name || '. Amount ₹' || to_char(GREATEST(r.approved_amount, r.claimed_amount), 'FM99,99,99,999'), 'critical', '/claims/' || r.id);
      END LOOP;
      r.escalation_level := lvl;
      n_esc := n_esc + 1;
    END LOOP;
  END LOOP;

  -- 4. missed payer commitments
  FOR r IN
    SELECT DISTINCT ON (f.claim_id) f.claim_id, f.commitment_date, f.commitment_amount, f.contact_name,
           c.claim_code, c.organization_id, c.hospital_id, c.branch_id, c.assigned_to, a.insurer_id, a.tpa_id
    FROM public.claim_followups f
    JOIN public.claims c ON c.id = f.claim_id AND c.deleted_at IS NULL AND c.status NOT IN ('settled','closed','denied','preauth_rejected')
    JOIN public.admissions a ON a.id = c.admission_id
    ORDER BY f.claim_id, f.created_at DESC
  LOOP
    CONTINUE WHEN r.commitment_date IS NULL;
    rule := public.pick_reminder_rule('commitment_missed', r.organization_id, r.hospital_id, r.insurer_id, r.tpa_id);
    CONTINUE WHEN rule.id IS NULL OR (r.commitment_date::timestamptz + make_interval(hours => rule.threshold_hours)) > now();
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.tasks t WHERE t.claim_id = r.claim_id AND t.task_type = 'commitment_missed' AND t.created_at > r.commitment_date::timestamptz);
    INSERT INTO public.tasks(organization_id, hospital_id, branch_id, claim_id, entity_id, title, description, task_type, priority, assigned_to, due_at, amount_at_stake, rule_id)
    VALUES (r.organization_id, r.hospital_id, r.branch_id, r.claim_id, r.claim_id, 'Payer missed commitment — ' || r.claim_code,
            'Payer committed payment by ' || to_char(r.commitment_date, 'DD Mon YYYY') || COALESCE(' (' || r.contact_name || ')', ''),
            'commitment_missed', 'high', r.assigned_to, now() + interval '4 hours', COALESCE(r.commitment_amount, 0), rule.id);
    FOR u IN SELECT public.role_recipients(r.hospital_id, rule.notify_roles) UNION SELECT r.assigned_to WHERE r.assigned_to IS NOT NULL LOOP
      INSERT INTO public.notifications(organization_id, hospital_id, user_id, category, title, body, severity, link_to)
      VALUES (r.organization_id, r.hospital_id, u, 'reminder', 'Payer commitment missed — ' || r.claim_code, 'Commitment date ' || to_char(r.commitment_date, 'DD Mon YYYY') || ' has passed.', 'warning', '/claims/' || r.claim_id);
    END LOOP;
    n_commit := n_commit + 1;
  END LOOP;

  -- 5. SLA breaches on active tasks
  FOR r IN
    SELECT t.id, t.title, t.claim_id, t.organization_id, t.hospital_id, t.assigned_to, t.due_at, a.insurer_id, a.tpa_id
    FROM public.tasks t
    LEFT JOIN public.claims c ON c.id = t.claim_id
    LEFT JOIN public.admissions a ON a.id = c.admission_id
    WHERE t.status IN ('open','in_progress','waiting') AND t.due_at IS NOT NULL AND t.due_at < now()
  LOOP
    rule := public.pick_reminder_rule('sla_breach', r.organization_id, r.hospital_id, r.insurer_id, r.tpa_id);
    CONTINUE WHEN rule.id IS NULL OR r.due_at > now() - make_interval(hours => rule.threshold_hours);
    UPDATE public.tasks SET status = 'escalated', priority = 'urgent', escalation_level = GREATEST(escalation_level, 1) WHERE id = r.id;
    INSERT INTO public.escalations(organization_id, hospital_id, claim_id, task_id, rule_id, level, reason, notified_roles)
    VALUES (r.organization_id, r.hospital_id, r.claim_id, r.id, rule.id, 1, 'SLA breached: ' || r.title, rule.notify_roles);
    FOR u IN SELECT public.role_recipients(r.hospital_id, rule.notify_roles) UNION SELECT r.assigned_to WHERE r.assigned_to IS NOT NULL LOOP
      INSERT INTO public.notifications(organization_id, hospital_id, user_id, category, title, body, severity, link_to)
      VALUES (r.organization_id, r.hospital_id, u, 'sla', 'SLA breached', r.title, 'critical', CASE WHEN r.claim_id IS NOT NULL THEN '/claims/' || r.claim_id ELSE '/work-queue' END);
    END LOOP;
    n_breach := n_breach + 1;
  END LOOP;

  UPDATE public.engine_runs SET finished_at = now(),
    stats = jsonb_build_object('followup_tasks', n_followup, 'reminders', n_remind, 'missed_commitments', n_commit, 'escalations', n_esc, 'sla_breaches', n_breach)
  WHERE id = run_id;
  RETURN jsonb_build_object('followup_tasks', n_followup, 'reminders', n_remind, 'missed_commitments', n_commit, 'escalations', n_esc, 'sla_breaches', n_breach);
END $$;

REVOKE ALL ON FUNCTION public.run_rcm_engine() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_rcm_engine() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.pick_reminder_rule(text,uuid,uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.role_recipients(uuid,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pick_reminder_rule(text,uuid,uuid,uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.role_recipients(uuid,text[]) TO service_role;
REVOKE ALL ON FUNCTION public.sla_hours(text,uuid,uuid,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sla_hours(text,uuid,uuid,uuid,integer) TO authenticated, service_role;

-- ============ platform default rules ============
INSERT INTO public.sla_rules (process, target_hours, description) VALUES
 ('preauth', 4, 'Payer decision on a pre-auth request'),
 ('query_response', 48, 'Hospital reply to a payer query'),
 ('submission', 72, 'Claim submitted after discharge'),
 ('payment', 720, 'Payment received after approval (30 days)'),
 ('settlement', 1080, 'Claim settled after submission (45 days)');

INSERT INTO public.reminder_rules (rule_key, name, threshold_hours, escalation_level, notify_roles) VALUES
 ('payer_followup', 'Follow up when no payer movement for 7 days', 168, 0, '{}'),
 ('no_response', 'Remind owner when payer silent for 48 hours', 48, 0, '{}'),
 ('commitment_missed', 'Payer commitment date passed', 0, 0, '{rcm_manager}'),
 ('sla_breach', 'Escalate a task when its SLA is breached', 0, 1, '{rcm_manager}'),
 ('escalate_l1', 'Pending 30 days — escalate to RCM manager', 720, 1, '{rcm_manager,ar_manager}'),
 ('escalate_l2', 'Pending 60 days — escalate to RCM head', 1440, 2, '{rcm_head}'),
 ('escalate_l3', 'Pending 90 days — escalate to management', 2160, 3, '{hospital_admin,cfo}');