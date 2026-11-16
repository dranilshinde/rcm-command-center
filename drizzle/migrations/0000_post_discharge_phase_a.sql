CREATE OR REPLACE FUNCTION public.claim_outstanding(_approved numeric, _settled numeric, _tds numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT GREATEST(COALESCE(_approved,0) - COALESCE(_settled,0) - COALESCE(_tds,0), 0)::numeric(14,2)
$$;
GRANT EXECUTE ON FUNCTION public.claim_outstanding(numeric,numeric,numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reconcile_receipt(_receipt uuid, _claim uuid, _tds numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r public.bank_receipts; c public.claims; pay_id uuid; s numeric; t numeric; short numeric; before numeric; v numeric; to_status text; m text;
BEGIN
  SELECT * INTO r FROM public.bank_receipts WHERE id = _receipt FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receipt not found.'; END IF;
  IF r.match_status <> 'unmatched' THEN RAISE EXCEPTION 'This receipt is already reconciled. Unmatch it first.'; END IF;
  SELECT * INTO c FROM public.claims WHERE id = _claim FOR UPDATE;
  IF NOT FOUND OR c.hospital_id <> r.hospital_id THEN RAISE EXCEPTION 'Pick a claim from the same hospital.'; END IF;
  IF c.status NOT IN ('approved','short_paid','settled','under_processing') THEN RAISE EXCEPTION 'Only approved claims can receive money.'; END IF;
  before := public.claim_outstanding(c.approved_amount, c.settled_amount, c.tds_amount);
  INSERT INTO public.claim_payments(organization_id, hospital_id, claim_id, amount, tds_amount, utr_number, payment_date, created_by)
  VALUES (c.organization_id, c.hospital_id, c.id, r.amount, COALESCE(_tds,0), r.utr_number, r.receipt_date, auth.uid()) RETURNING id INTO pay_id;
  SELECT COALESCE(sum(amount),0), COALESCE(sum(tds_amount),0) INTO s, t FROM public.claim_payments WHERE claim_id = c.id;
  short := c.approved_amount - s - t;
  to_status := CASE WHEN short > 0.5 THEN 'short_paid' ELSE 'settled' END;
  UPDATE public.claims SET settled_amount = s, tds_amount = t, short_payment = GREATEST(short,0), payment_date = r.receipt_date,
    status = to_status, reconciled = true, last_status_at = now(), sla_process = NULL, sla_due_at = NULL, updated_by = auth.uid() WHERE id = c.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'You do not have permission to update this claim.'; END IF;
  IF to_status <> c.status THEN
    INSERT INTO public.claim_status_history(organization_id, hospital_id, claim_id, from_status, to_status, note, actor_id)
    VALUES (c.organization_id, c.hospital_id, c.id, c.status, to_status,
      'Bank receipt ₹' || to_char(r.amount,'FM99,99,99,99,990') || ' reconciled' || COALESCE(' (UTR ' || r.utr_number || ')',''), auth.uid());
  END IF;
  UPDATE public.tasks SET status = 'completed', completed_at = now()
   WHERE claim_id = c.id AND task_type IN ('payment_followup','payer_followup','commitment_missed') AND status IN ('open','in_progress','waiting','escalated');
  v := r.amount + COALESCE(_tds,0) - before;
  m := CASE WHEN abs(v) < 1 THEN 'matched' WHEN v < 0 THEN 'short_paid' ELSE 'overpaid' END;
  UPDATE public.bank_receipts SET match_status = m, match_method = 'manual', claim_id = c.id, claim_payment_id = pay_id, variance = v,
    matched_by = auth.uid(), matched_at = now(), updated_by = auth.uid() WHERE id = r.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'You do not have permission to update this receipt.'; END IF;
  RETURN jsonb_build_object('status', m, 'variance', v, 'claimStatus', to_status);
END $$;
REVOKE ALL ON FUNCTION public.reconcile_receipt(uuid,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_receipt(uuid,uuid,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_denial_outcome(_id uuid, _category text, _reason text, _status text, _appeal date, _recovered numeric, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE d public.denials; c public.claims; delta numeric; closed boolean := _status IN ('recovered','written_off');
BEGIN
  SELECT * INTO d FROM public.denials WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record not found.'; END IF;
  IF _recovered > d.amount + 1 THEN RAISE EXCEPTION 'Recovered amount cannot be more than the amount at stake.'; END IF;
  delta := COALESCE(_recovered,0) - d.recovered_amount;
  UPDATE public.denials SET category = _category, reason = _reason, status = _status, appeal_submitted_at = _appeal,
    recovered_amount = COALESCE(_recovered,0), resolution_note = _note, closed_at = CASE WHEN closed THEN now() ELSE NULL END, updated_by = auth.uid()
   WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'You do not have permission to update this record.'; END IF;
  IF abs(delta) > 0.004 THEN
    SELECT * INTO c FROM public.claims WHERE id = d.claim_id FOR UPDATE;
    INSERT INTO public.claim_payments(organization_id, hospital_id, claim_id, amount, tds_amount, payment_date, receipt_no, created_by)
    VALUES (c.organization_id, c.hospital_id, c.id, delta, 0, current_date, 'RECOVERY', auth.uid());
    UPDATE public.claims SET settled_amount = settled_amount + delta, updated_by = auth.uid() WHERE id = c.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'You do not have permission to update this claim.'; END IF;
  END IF;
  IF closed THEN
    UPDATE public.tasks SET status = 'completed', completed_at = now()
     WHERE claim_id = d.claim_id AND status IN ('open','in_progress','waiting','escalated')
       AND task_type = ANY (CASE WHEN d.kind = 'short_payment' THEN ARRAY['short_payment','appeal_followup'] ELSE ARRAY['denial','denial_review','appeal_followup'] END);
  END IF;
  RETURN jsonb_build_object('ok', true, 'posted', delta);
END $$;
REVOKE ALL ON FUNCTION public.save_denial_outcome(uuid,text,text,text,date,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_denial_outcome(uuid,text,text,text,date,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.open_denial_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE short numeric;
BEGIN
  IF NEW.status IN ('denied','partially_rejected') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.denials(organization_id, hospital_id, claim_id, kind, category, reason, amount, owner_id, created_by)
    VALUES (NEW.organization_id, NEW.hospital_id, NEW.id, 'denial', 'other', NEW.insurer_comments,
            CASE WHEN NEW.status = 'partially_rejected' THEN GREATEST(NEW.claimed_amount - NEW.approved_amount, 0) ELSE GREATEST(NEW.approved_amount, NEW.claimed_amount) END,
            NEW.assigned_to, auth.uid())
    ON CONFLICT (claim_id, kind) DO UPDATE SET status = CASE WHEN public.denials.status IN ('recovered','written_off') THEN 'open' ELSE public.denials.status END;
  ELSIF NEW.status = 'short_paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    short := COALESCE(NULLIF(NEW.short_payment, 0), NEW.approved_amount - NEW.settled_amount - NEW.tds_amount);
    IF short > 0.5 THEN
      INSERT INTO public.denials(organization_id, hospital_id, claim_id, kind, category, reason, amount, owner_id, created_by)
      VALUES (NEW.organization_id, NEW.hospital_id, NEW.id, 'short_payment', 'tariff', NEW.insurer_comments, short, NEW.assigned_to, auth.uid())
      ON CONFLICT (claim_id, kind) DO UPDATE SET amount = EXCLUDED.amount;
    END IF;
  END IF;
  RETURN NEW;
END $$;

UPDATE public.claims SET status = 'denied' WHERE status = 'preauth_rejected';
UPDATE public.tasks SET status = 'cancelled' WHERE task_type = 'preauth' AND status IN ('open','in_progress','waiting','escalated');
DELETE FROM public.sla_rules WHERE process = 'preauth';
DELETE FROM public.hospital_role_permissions WHERE permission_id IN (SELECT id FROM public.permissions WHERE module IN ('preauth','discharge'));
DELETE FROM public.role_permissions WHERE permission_id IN (SELECT id FROM public.permissions WHERE module IN ('preauth','discharge'));
DELETE FROM public.permissions WHERE module IN ('preauth','discharge');
DELETE FROM public.hospital_role_permissions WHERE role_id IN (SELECT id FROM public.roles WHERE key IN ('cashless_manager','cashless_executive'));
DELETE FROM public.role_permissions WHERE role_id IN (SELECT id FROM public.roles WHERE key IN ('cashless_manager','cashless_executive'));
DELETE FROM public.user_roles WHERE role_id IN (SELECT id FROM public.roles WHERE key IN ('cashless_manager','cashless_executive'));
DELETE FROM public.roles WHERE key IN ('cashless_manager','cashless_executive');
DELETE FROM public.master_list_items WHERE lower(label) IN ('patient admitted','pre-auth initiated','pre-auth approved','preauth initiated','preauth approved');
DELETE FROM public.onboarding_steps WHERE step_key = 'tariffs' AND status <> 'completed';
COMMENT ON TABLE public.preauths IS 'DEPRECATED: pre-discharge scope removed; kept for history only';

SELECT cron.schedule('rcm-engine-hourly', '17 * * * *', 'SELECT public.run_rcm_engine()');