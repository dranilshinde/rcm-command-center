CREATE OR REPLACE FUNCTION public.email_queue_access(_hospital uuid, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.hospitals h WHERE h.id = _hospital AND h.deleted_at IS NULL
   AND public.can_access_hospital(auth.uid(), h.id)
   AND (public.is_super_admin(auth.uid()) OR EXISTS (
     SELECT 1 FROM public.user_roles ur
     JOIN public.permissions p ON p.module = 'claims' AND p.action = _action
     LEFT JOIN public.hospital_role_permissions o ON o.hospital_id = h.id AND o.role_id = ur.role_id AND o.permission_id = p.id
     WHERE ur.user_id = auth.uid()
       AND (ur.hospital_id = h.id OR (ur.hospital_id IS NULL AND ur.organization_id = h.organization_id) OR (ur.hospital_id IS NULL AND ur.organization_id IS NULL AND ur.branch_id IS NULL))
       AND (ur.branch_id IS NULL OR EXISTS (SELECT 1 FROM public.branches b WHERE b.id = ur.branch_id AND b.hospital_id = h.id))
       AND COALESCE(o.allowed, EXISTS (SELECT 1 FROM public.role_permissions rp WHERE rp.role_id = ur.role_id AND rp.permission_id = p.id))
   ))
 );
$$;
REVOKE ALL ON FUNCTION public.email_queue_access(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_queue_access(uuid,text) TO authenticated, service_role;

CREATE TABLE public.inbound_emails (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
 mailbox_connection_id uuid NOT NULL REFERENCES public.app_user_connections(id),
 provider text NOT NULL CHECK (provider IN ('google_mail','microsoft_outlook')),
 provider_message_id text NOT NULL CHECK (length(btrim(provider_message_id)) > 0),
 internet_message_id text,
 thread_id text,
 sender_email text NOT NULL,
 sender_name text,
 to_addresses text[] NOT NULL DEFAULT '{}',
 cc_addresses text[] NOT NULL DEFAULT '{}',
 subject text NOT NULL DEFAULT '',
 body_text text NOT NULL DEFAULT '',
 body_html text,
 received_at timestamptz NOT NULL,
 processing_status text NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received','parsed','failed')),
 processing_error text,
 parsed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (mailbox_connection_id, provider_message_id),
 UNIQUE (id, hospital_id, organization_id)
);
GRANT SELECT ON public.inbound_emails TO authenticated;
GRANT ALL ON public.inbound_emails TO service_role;
ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY inbound_emails_read ON public.inbound_emails FOR SELECT TO authenticated USING (public.email_queue_access(hospital_id,'VIEW'));
CREATE INDEX inbound_emails_hospital_queue ON public.inbound_emails(hospital_id, processing_status, received_at DESC, id);

CREATE TABLE public.email_claim_matches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
 email_id uuid NOT NULL,
 claim_id uuid NOT NULL REFERENCES public.claims(id),
 identifier_type text NOT NULL CHECK (identifier_type IN ('claim_code','external_claim_no','initial_claim_no')),
 identifier_value text NOT NULL CHECK (length(btrim(identifier_value)) > 0),
 match_method text NOT NULL DEFAULT 'exact' CHECK (match_method = 'exact'),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (email_id,hospital_id,organization_id) REFERENCES public.inbound_emails(id,hospital_id,organization_id),
 UNIQUE (email_id,claim_id,identifier_type,identifier_value),
 UNIQUE (id,email_id,claim_id,hospital_id,organization_id)
);
GRANT SELECT ON public.email_claim_matches TO authenticated;
GRANT ALL ON public.email_claim_matches TO service_role;
ALTER TABLE public.email_claim_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_claim_matches_read ON public.email_claim_matches FOR SELECT TO authenticated USING (public.email_queue_access(hospital_id,'VIEW'));
CREATE INDEX email_claim_matches_email ON public.email_claim_matches(email_id,claim_id);
CREATE INDEX email_claim_matches_claim ON public.email_claim_matches(hospital_id,claim_id);
CREATE INDEX claims_email_external_exact ON public.claims(hospital_id,external_claim_no) WHERE deleted_at IS NULL AND external_claim_no IS NOT NULL;
CREATE INDEX claims_email_initial_exact ON public.claims(hospital_id,initial_claim_no) WHERE deleted_at IS NULL AND initial_claim_no IS NOT NULL;
CREATE INDEX claims_email_code_exact ON public.claims(hospital_id,claim_code) WHERE deleted_at IS NULL;

CREATE TABLE public.email_parsed_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
 email_id uuid NOT NULL,
 event_key text NOT NULL DEFAULT 'primary',
 event_type text NOT NULL DEFAULT 'other' CHECK (event_type IN ('query','approval','denial','settlement','other')),
 proposed_changes jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(proposed_changes) = 'object'),
 evidence_text text NOT NULL DEFAULT '',
 parser_version text NOT NULL DEFAULT 'manual-v1',
 match_id uuid,
 claim_id uuid,
 review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','confirmed','rejected')),
 reviewed_by uuid REFERENCES public.profiles(id),
 reviewed_at timestamptz,
 review_note text,
 applied_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (email_id,hospital_id,organization_id) REFERENCES public.inbound_emails(id,hospital_id,organization_id),
 FOREIGN KEY (match_id,email_id,claim_id,hospital_id,organization_id) REFERENCES public.email_claim_matches(id,email_id,claim_id,hospital_id,organization_id),
 CHECK ((match_id IS NULL AND claim_id IS NULL) OR (match_id IS NOT NULL AND claim_id IS NOT NULL)),
 UNIQUE (email_id,event_key)
);
GRANT SELECT ON public.email_parsed_events TO authenticated;
GRANT UPDATE (review_status,review_note) ON public.email_parsed_events TO authenticated;
GRANT ALL ON public.email_parsed_events TO service_role;
ALTER TABLE public.email_parsed_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_parsed_events_read ON public.email_parsed_events FOR SELECT TO authenticated USING (public.email_queue_access(hospital_id,'VIEW'));
CREATE POLICY email_parsed_events_review ON public.email_parsed_events FOR UPDATE TO authenticated USING (public.email_queue_access(hospital_id,'VIEW') AND public.email_queue_access(hospital_id,'EDIT')) WITH CHECK (public.email_queue_access(hospital_id,'VIEW') AND public.email_queue_access(hospital_id,'EDIT'));
CREATE INDEX email_parsed_events_queue ON public.email_parsed_events(hospital_id,review_status,created_at,id);
CREATE INDEX email_parsed_events_email ON public.email_parsed_events(email_id);

CREATE TABLE public.inbound_email_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
 email_id uuid NOT NULL,
 provider_attachment_id text NOT NULL,
 file_name text NOT NULL,
 mime_type text NOT NULL,
 size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0 AND size_bytes <= 20971520),
 storage_bucket text NOT NULL DEFAULT 'inbound-email-attachments' CHECK (storage_bucket = 'inbound-email-attachments'),
 storage_path text NOT NULL UNIQUE,
 sha256 text,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (email_id,hospital_id,organization_id) REFERENCES public.inbound_emails(id,hospital_id,organization_id),
 UNIQUE(email_id,provider_attachment_id),
 CHECK (storage_path = hospital_id::text || '/' || email_id::text || '/' || id::text)
);
GRANT SELECT ON public.inbound_email_attachments TO authenticated;
GRANT ALL ON public.inbound_email_attachments TO service_role;
ALTER TABLE public.inbound_email_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY inbound_email_attachments_read ON public.inbound_email_attachments FOR SELECT TO authenticated USING (public.email_queue_access(hospital_id,'VIEW'));
CREATE INDEX inbound_email_attachments_email ON public.inbound_email_attachments(email_id);
CREATE POLICY email_attachment_download ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id = 'inbound-email-attachments' AND EXISTS (
 SELECT 1 FROM public.inbound_email_attachments a WHERE a.storage_bucket = bucket_id AND a.storage_path = name AND public.email_queue_access(a.hospital_id,'VIEW')
 ));

CREATE OR REPLACE FUNCTION public.guard_inbound_email_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND (NEW.id,NEW.organization_id,NEW.hospital_id,NEW.mailbox_connection_id,NEW.provider,NEW.provider_message_id,NEW.sender_email,NEW.sender_name,NEW.to_addresses,NEW.cc_addresses,NEW.subject,NEW.body_text,NEW.body_html,NEW.received_at,NEW.internet_message_id,NEW.thread_id) IS DISTINCT FROM (OLD.id,OLD.organization_id,OLD.hospital_id,OLD.mailbox_connection_id,OLD.provider,OLD.provider_message_id,OLD.sender_email,OLD.sender_name,OLD.to_addresses,OLD.cc_addresses,OLD.subject,OLD.body_text,OLD.body_html,OLD.received_at,OLD.internet_message_id,OLD.thread_id) THEN
 RAISE EXCEPTION 'Incoming email source and hospital are immutable'; END IF;
 IF TG_OP = 'INSERT' AND NOT EXISTS (
 SELECT 1 FROM public.app_user_connections c JOIN public.hospitals h ON h.id=c.hospital_id
 WHERE c.id=NEW.mailbox_connection_id AND c.hospital_id=NEW.hospital_id AND h.organization_id=NEW.organization_id AND c.connector_id=NEW.provider AND c.status='connected' AND h.deleted_at IS NULL
 ) THEN RAISE EXCEPTION 'Email must belong to a connected mailbox in the same hospital'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER inbound_email_source_guard BEFORE INSERT OR UPDATE ON public.inbound_emails FOR EACH ROW EXECUTE FUNCTION public.guard_inbound_email_source();
CREATE TRIGGER inbound_emails_updated BEFORE UPDATE ON public.inbound_emails FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_email_exact_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Exact-match evidence is immutable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.claims c WHERE c.id=NEW.claim_id AND c.hospital_id=NEW.hospital_id AND c.organization_id=NEW.organization_id AND c.deleted_at IS NULL
 AND NEW.identifier_value = CASE NEW.identifier_type WHEN 'claim_code' THEN c.claim_code WHEN 'external_claim_no' THEN c.external_claim_no WHEN 'initial_claim_no' THEN c.initial_claim_no END)
 THEN RAISE EXCEPTION 'Only an exact claim number in the same hospital can be matched'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER email_exact_match_guard BEFORE INSERT OR UPDATE ON public.email_claim_matches FOR EACH ROW EXECUTE FUNCTION public.guard_email_exact_match();

CREATE OR REPLACE FUNCTION public.email_exact_claim_candidates(_hospital uuid,_numbers text[])
RETURNS TABLE(claim_id uuid,identifier_type text,identifier_value text)
LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT c.id,'claim_code'::text,c.claim_code FROM public.claims c WHERE c.hospital_id=_hospital AND c.deleted_at IS NULL AND c.claim_code=ANY(_numbers) AND length(btrim(c.claim_code))>0
 UNION ALL
 SELECT c.id,'external_claim_no',c.external_claim_no FROM public.claims c WHERE c.hospital_id=_hospital AND c.deleted_at IS NULL AND c.external_claim_no=ANY(_numbers) AND length(btrim(c.external_claim_no))>0
 UNION ALL
 SELECT c.id,'initial_claim_no',c.initial_claim_no FROM public.claims c WHERE c.hospital_id=_hospital AND c.deleted_at IS NULL AND c.initial_claim_no=ANY(_numbers) AND length(btrim(c.initial_claim_no))>0;
$$;
REVOKE ALL ON FUNCTION public.email_exact_claim_candidates(uuid,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_exact_claim_candidates(uuid,text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_email_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.applied_at IS NOT NULL THEN RAISE EXCEPTION 'Claim application is not enabled in Phase 1'; END IF;
 IF TG_OP='INSERT' THEN
 IF NEW.review_status <> 'pending' OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL THEN RAISE EXCEPTION 'Every proposed event must await staff confirmation'; END IF;
 ELSE
 IF OLD.review_status <> 'pending' THEN RAISE EXCEPTION 'A completed review is immutable'; END IF;
 IF (NEW.id,NEW.hospital_id,NEW.organization_id,NEW.email_id,NEW.event_key,NEW.event_type,NEW.proposed_changes,NEW.evidence_text,NEW.parser_version,NEW.match_id,NEW.claim_id) IS DISTINCT FROM (OLD.id,OLD.hospital_id,OLD.organization_id,OLD.email_id,OLD.event_key,OLD.event_type,OLD.proposed_changes,OLD.evidence_text,OLD.parser_version,OLD.match_id,OLD.claim_id) THEN RAISE EXCEPTION 'Review cannot change the original proposal or matched claim'; END IF;
 IF NEW.review_status <> 'pending' THEN
 IF NOT public.email_queue_access(NEW.hospital_id,'VIEW') OR NOT public.email_queue_access(NEW.hospital_id,'EDIT') THEN RAISE EXCEPTION 'An authorised hospital staff member must confirm or reject this event'; END IF;
 IF NEW.review_status='confirmed' AND (NEW.match_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.claims c WHERE c.id=NEW.claim_id AND c.hospital_id=NEW.hospital_id AND c.deleted_at IS NULL)) THEN RAISE EXCEPTION 'Confirm an exact same-hospital claim match first'; END IF;
 NEW.reviewed_by:=auth.uid(); NEW.reviewed_at:=now();
 ELSE
 NEW.reviewed_by:=NULL; NEW.reviewed_at:=NULL;
 END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER email_review_guard BEFORE INSERT OR UPDATE ON public.email_parsed_events FOR EACH ROW EXECUTE FUNCTION public.guard_email_review();
CREATE TRIGGER email_events_updated BEFORE UPDATE ON public.email_parsed_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.audit_email_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.review_status IS DISTINCT FROM NEW.review_status THEN
 INSERT INTO public.audit_logs(organization_id,hospital_id,actor_id,module,action,record_id,record_label,old_value,new_value)
 VALUES(NEW.organization_id,NEW.hospital_id,NEW.reviewed_by,'communication','email_review',NEW.id,'Incoming email review',jsonb_build_object('review_status',OLD.review_status),jsonb_build_object('review_status',NEW.review_status,'email_id',NEW.email_id,'claim_id',NEW.claim_id,'reviewed_at',NEW.reviewed_at));
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER email_review_audit AFTER UPDATE ON public.email_parsed_events FOR EACH ROW EXECUTE FUNCTION public.audit_email_review();

COMMENT ON TABLE public.inbound_emails IS 'Hospital-scoped source emails; intake service writes, claim-authorised staff read; no automated claim changes.';
COMMENT ON TABLE public.email_claim_matches IS 'Exact case-sensitive claim-number evidence only; all candidates retained for staff review, never auto-selected.';
COMMENT ON COLUMN public.email_parsed_events.applied_at IS 'Reserved for a later atomic staff-confirmed claim update; Phase 1 rejects all non-null values.';
COMMENT ON TABLE public.inbound_email_attachments IS 'Private immutable attachment locators: hospital UUID/email UUID/attachment UUID; only intake service writes storage.';
REVOKE ALL ON FUNCTION public.guard_inbound_email_source(), public.guard_email_exact_match(), public.guard_email_review(), public.audit_email_review() FROM PUBLIC, anon, authenticated;
