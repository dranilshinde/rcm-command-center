CREATE TABLE public.denials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'denial' CHECK (kind IN ('denial','short_payment')),
  category text NOT NULL DEFAULT 'other',
  reason text,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','appealed','recovered','partially_recovered','written_off')),
  appeal_submitted_at date,
  recovered_amount numeric NOT NULL DEFAULT 0,
  resolution_note text,
  closed_at timestamptz,
  owner_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);
CREATE UNIQUE INDEX denials_one_per_claim_kind ON public.denials(claim_id, kind);
CREATE INDEX idx_denials_hosp ON public.denials(hospital_id, status, category);

CREATE TABLE public.bank_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  receipt_date date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  utr_number text,
  payer_name text,
  narration text,
  match_status text NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('unmatched','matched','partially_matched','short_paid','overpaid','duplicate')),
  match_method text,
  claim_id uuid REFERENCES public.claims(id) ON DELETE SET NULL,
  claim_payment_id uuid REFERENCES public.claim_payments(id) ON DELETE SET NULL,
  variance numeric,
  matched_by uuid, matched_at timestamptz,
  source_file text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);
CREATE INDEX idx_bank_receipts_hosp ON public.bank_receipts(hospital_id, match_status, receipt_date DESC);
CREATE INDEX idx_bank_receipts_utr ON public.bank_receipts(utr_number);
CREATE INDEX IF NOT EXISTS idx_claim_payments_utr ON public.claim_payments(utr_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.denials, public.bank_receipts TO authenticated;
GRANT ALL ON public.denials, public.bank_receipts TO service_role;
ALTER TABLE public.denials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY denials_select ON public.denials FOR SELECT TO authenticated
  USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'denials','VIEW'));
CREATE POLICY denials_write ON public.denials FOR ALL TO authenticated
  USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'denials','EDIT'))
  WITH CHECK (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'denials','EDIT'));
CREATE POLICY receipts_select ON public.bank_receipts FOR SELECT TO authenticated
  USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'reconciliation','VIEW'));
CREATE POLICY receipts_write ON public.bank_receipts FOR ALL TO authenticated
  USING (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'reconciliation','EDIT'))
  WITH CHECK (public.can_access_hospital(auth.uid(), hospital_id) AND public.has_permission(auth.uid(),'reconciliation','EDIT'));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.denials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bank_receipts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER audit_denials AFTER INSERT OR UPDATE OR DELETE ON public.denials FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
CREATE TRIGGER audit_bank_receipts AFTER INSERT OR UPDATE OR DELETE ON public.bank_receipts FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

-- Every denied or short-paid claim gets a recovery record, whichever path set the status.
CREATE OR REPLACE FUNCTION public.open_denial_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE short numeric;
BEGIN
  IF NEW.status = 'denied' THEN
    INSERT INTO public.denials(organization_id, hospital_id, claim_id, kind, category, reason, amount, owner_id, created_by)
    VALUES (NEW.organization_id, NEW.hospital_id, NEW.id, 'denial', 'other', NEW.insurer_comments,
            GREATEST(NEW.approved_amount, NEW.claimed_amount), NEW.assigned_to, auth.uid())
    ON CONFLICT (claim_id, kind) DO UPDATE SET status = CASE WHEN public.denials.status IN ('recovered','written_off') THEN 'open' ELSE public.denials.status END;
  ELSIF NEW.status = 'short_paid' THEN
    short := COALESCE(NULLIF(NEW.short_payment, 0), NEW.approved_amount - NEW.settled_amount - NEW.tds_amount);
    IF short > 0.5 THEN
      INSERT INTO public.denials(organization_id, hospital_id, claim_id, kind, category, reason, amount, owner_id, created_by)
      VALUES (NEW.organization_id, NEW.hospital_id, NEW.id, 'short_payment', 'tariff', NEW.insurer_comments, short, NEW.assigned_to, auth.uid())
      ON CONFLICT (claim_id, kind) DO UPDATE SET amount = EXCLUDED.amount;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.open_denial_record() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_claims_denial AFTER INSERT OR UPDATE OF status, settled_amount ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.open_denial_record();

INSERT INTO public.denials(organization_id, hospital_id, claim_id, kind, category, reason, amount, owner_id)
SELECT organization_id, hospital_id, id, 'denial', 'other', insurer_comments, GREATEST(approved_amount, claimed_amount), assigned_to
FROM public.claims WHERE status = 'denied' AND deleted_at IS NULL ON CONFLICT DO NOTHING;
INSERT INTO public.denials(organization_id, hospital_id, claim_id, kind, category, reason, amount, owner_id)
SELECT organization_id, hospital_id, id, 'short_payment', 'tariff', insurer_comments,
       COALESCE(NULLIF(short_payment,0), approved_amount - settled_amount - tds_amount), assigned_to
FROM public.claims WHERE status = 'short_paid' AND deleted_at IS NULL
  AND COALESCE(NULLIF(short_payment,0), approved_amount - settled_amount - tds_amount) > 0.5 ON CONFLICT DO NOTHING;