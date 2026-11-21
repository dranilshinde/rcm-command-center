REVOKE ALL ON public.app_user_connections FROM anon, authenticated;
REVOKE ALL ON public.mailbox_oauth_intents FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mailbox_oauth_intents TO service_role;

CREATE OR REPLACE FUNCTION public.guard_mailbox_binding()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.hospital_id IS DISTINCT FROM OLD.hospital_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.connector_id IS DISTINCT FROM OLD.connector_id THEN
    RAISE EXCEPTION 'Disconnect the existing mailbox before changing its hospital, provider or authorising administrator';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_mailbox_binding_changes BEFORE UPDATE ON public.app_user_connections
FOR EACH ROW EXECUTE FUNCTION public.guard_mailbox_binding();