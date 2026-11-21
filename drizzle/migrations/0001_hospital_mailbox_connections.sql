CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  user_id uuid NOT NULL,
  connector_id text NOT NULL CHECK (connector_id IN ('google_mail', 'microsoft_outlook')),
  connection_key_ciphertext text NOT NULL,
  email_address text NOT NULL,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'reconnect_required')),
  verified_at timestamptz,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id),
  UNIQUE (hospital_id, connector_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.app_user_connections IS 'Server-only encrypted mailbox handles; never expose ciphertext through the browser Data API. One administrator-provider grant is bound to one hospital.';

CREATE TABLE public.mailbox_oauth_intents (
  nonce_hash text PRIMARY KEY,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  user_id uuid NOT NULL,
  connector_id text NOT NULL CHECK (connector_id IN ('google_mail', 'microsoft_outlook')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mailbox_oauth_intents TO service_role;
ALTER TABLE public.mailbox_oauth_intents ENABLE ROW LEVEL SECURITY;
CREATE INDEX mailbox_oauth_intents_expiry_idx ON public.mailbox_oauth_intents(expires_at);

CREATE OR REPLACE FUNCTION public.audit_mailbox_connection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hospital uuid; v_record uuid; v_actor uuid; v_email text; v_provider text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_hospital := OLD.hospital_id; v_record := OLD.id; v_actor := NULL;
    v_email := OLD.email_address; v_provider := OLD.connector_id;
  ELSE
    v_hospital := NEW.hospital_id; v_record := NEW.id; v_actor := NEW.updated_by;
    v_email := NEW.email_address; v_provider := NEW.connector_id;
  END IF;
  INSERT INTO public.audit_logs (organization_id, hospital_id, module, action, record_id, record_label, actor_id, new_value)
  SELECT h.organization_id, v_hospital, 'settings', TG_OP, v_record,
    'Mailbox ' || v_email, v_actor, jsonb_build_object('provider', v_provider, 'email_address', v_email)
  FROM public.hospitals h WHERE h.id = v_hospital;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE TRIGGER audit_mailbox_connection_changes
AFTER INSERT OR UPDATE OR DELETE ON public.app_user_connections
FOR EACH ROW EXECUTE FUNCTION public.audit_mailbox_connection();