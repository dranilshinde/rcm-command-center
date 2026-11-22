REVOKE ALL ON public.inbound_emails, public.email_claim_matches, public.email_parsed_events, public.inbound_email_attachments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.inbound_emails, public.email_claim_matches, public.email_parsed_events, public.inbound_email_attachments TO authenticated;
GRANT UPDATE (review_status,review_note) ON public.email_parsed_events TO authenticated;
GRANT ALL ON public.inbound_emails, public.email_claim_matches, public.email_parsed_events, public.inbound_email_attachments TO service_role;