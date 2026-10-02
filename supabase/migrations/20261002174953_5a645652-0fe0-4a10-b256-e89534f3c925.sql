ALTER TABLE public.insurers ADD COLUMN IF NOT EXISTS preferred_channel text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS escalation_email text, ADD COLUMN IF NOT EXISTS relationship_notes text,
  ADD COLUMN IF NOT EXISTS target_payment_days integer;
ALTER TABLE public.tpas ADD COLUMN IF NOT EXISTS preferred_channel text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS escalation_email text, ADD COLUMN IF NOT EXISTS relationship_notes text,
  ADD COLUMN IF NOT EXISTS target_payment_days integer;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS spoc_id uuid REFERENCES public.tpa_spocs(id) ON DELETE SET NULL;
ALTER TABLE public.escalations ADD COLUMN IF NOT EXISTS spoc_id uuid REFERENCES public.tpa_spocs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tpa_spocs_insurer ON public.tpa_spocs(insurer_id);
CREATE INDEX IF NOT EXISTS idx_admissions_payer ON public.admissions(insurer_id, tpa_id);

DROP POLICY IF EXISTS ins_write ON public.insurers;
CREATE POLICY ins_write ON public.insurers FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (public.can_access_org(auth.uid(), organization_id) AND public.has_permission(auth.uid(),'payers','EDIT')))
  WITH CHECK (public.is_super_admin(auth.uid()) OR (public.can_access_org(auth.uid(), organization_id) AND public.has_permission(auth.uid(),'payers','EDIT')));
DROP POLICY IF EXISTS tpa_write ON public.tpas;
CREATE POLICY tpa_write ON public.tpas FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (public.can_access_org(auth.uid(), organization_id) AND public.has_permission(auth.uid(),'payers','EDIT')))
  WITH CHECK (public.is_super_admin(auth.uid()) OR (public.can_access_org(auth.uid(), organization_id) AND public.has_permission(auth.uid(),'payers','EDIT')));
DROP POLICY IF EXISTS spoc_write ON public.tpa_spocs;
CREATE POLICY spoc_write ON public.tpa_spocs FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (public.can_access_org(auth.uid(), organization_id) AND (hospital_id IS NULL OR public.can_access_hospital(auth.uid(), hospital_id)) AND public.has_permission(auth.uid(),'payers','EDIT')))
  WITH CHECK (public.is_super_admin(auth.uid()) OR (public.can_access_org(auth.uid(), organization_id) AND (hospital_id IS NULL OR public.can_access_hospital(auth.uid(), hospital_id)) AND public.has_permission(auth.uid(),'payers','EDIT')));

-- Picks the best payer contact: TPA before insurer, hospital-specific before org-wide,
-- highest seniority not exceeding the wanted level (falls back to the most junior above it).
CREATE OR REPLACE FUNCTION public.pick_spoc(_hosp uuid, _ins uuid, _tpa uuid, _level integer)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id FROM public.tpa_spocs s
  WHERE s.status = 'active'
    AND ((_tpa IS NOT NULL AND s.tpa_id = _tpa) OR (_ins IS NOT NULL AND s.insurer_id = _ins AND s.tpa_id IS NULL))
    AND (s.hospital_id IS NULL OR s.hospital_id = _hosp)
  ORDER BY (s.tpa_id IS NOT NULL AND s.tpa_id = _tpa) DESC,
           (s.hospital_id = _hosp) DESC NULLS LAST,
           (s.escalation_level <= _level) DESC,
           CASE WHEN s.escalation_level <= _level THEN -s.escalation_level ELSE s.escalation_level END
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.pick_spoc(uuid,uuid,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pick_spoc(uuid,uuid,uuid,integer) TO authenticated, service_role;

-- Attach the right contact to follow-up tasks and escalations as the engine creates them.
CREATE OR REPLACE FUNCTION public.attach_payer_spoc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; lvl integer; sname text; sphone text;
BEGIN
  IF NEW.spoc_id IS NOT NULL OR NEW.claim_id IS NULL THEN RETURN NEW; END IF;
  SELECT ad.insurer_id, ad.tpa_id INTO a FROM public.claims c JOIN public.admissions ad ON ad.id = c.admission_id WHERE c.id = NEW.claim_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'escalations' THEN
    lvl := CASE WHEN NEW.level <= 2 THEN 1 WHEN NEW.level <= 4 THEN 2 ELSE 3 END;
  ELSE
    IF NEW.task_type NOT IN ('payer_followup','commitment_missed') THEN RETURN NEW; END IF;
    lvl := 1;
  END IF;
  NEW.spoc_id := public.pick_spoc(NEW.hospital_id, a.insurer_id, a.tpa_id, lvl);
  IF TG_TABLE_NAME = 'tasks' AND NEW.spoc_id IS NOT NULL THEN
    SELECT name, phone INTO sname, sphone FROM public.tpa_spocs WHERE id = NEW.spoc_id;
    NEW.description := COALESCE(NEW.description, '') || ' — contact ' || sname || COALESCE(' (' || sphone || ')', '');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.attach_payer_spoc() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_tasks_spoc ON public.tasks;
CREATE TRIGGER trg_tasks_spoc BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.attach_payer_spoc();
DROP TRIGGER IF EXISTS trg_escalations_spoc ON public.escalations;
CREATE TRIGGER trg_escalations_spoc BEFORE INSERT ON public.escalations FOR EACH ROW EXECUTE FUNCTION public.attach_payer_spoc();