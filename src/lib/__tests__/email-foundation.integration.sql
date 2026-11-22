-- Run against the application database as a privileged SQL session.
-- Synthetic fixtures and audit rows are always rolled back; no real patient data.
BEGIN;
DO $$
DECLARE
 org uuid := gen_random_uuid(); ha uuid := gen_random_uuid(); hb uuid := gen_random_uuid();
 staff uuid := gen_random_uuid(); role_id uuid := gen_random_uuid();
 pa uuid := gen_random_uuid(); pb uuid := gen_random_uuid(); aa uuid := gen_random_uuid(); ab uuid := gen_random_uuid();
 ca uuid := gen_random_uuid(); cb uuid := gen_random_uuid(); connection uuid := gen_random_uuid(); connection_b uuid := gen_random_uuid(); email_b uuid := gen_random_uuid();
 email uuid := gen_random_uuid(); match uuid := gen_random_uuid(); event uuid := gen_random_uuid(); attachment uuid := gen_random_uuid();
 n integer; blocked boolean;
BEGIN
 INSERT INTO public.organizations(id,name,code,org_type) VALUES(org,'Synthetic email test organisation','EMAIL-TEST-'||org,'customer');
 INSERT INTO public.hospitals(id,organization_id,name,code) VALUES(ha,org,'Synthetic hospital A','TEST-A-'||ha),(hb,org,'Synthetic hospital B','TEST-B-'||hb);
 INSERT INTO public.profiles(id,organization_id,full_name) VALUES(staff,org,'Synthetic email reviewer');
 INSERT INTO public.roles(id,organization_id,key,name,role_level) VALUES(role_id,org,'email-test-'||role_id,'Synthetic claim reviewer','hospital');
 INSERT INTO public.role_permissions(role_id,permission_id) SELECT role_id,p.id FROM public.permissions p WHERE p.module='claims' AND p.action IN ('VIEW','EDIT');
 INSERT INTO public.user_roles(user_id,role_id,organization_id,hospital_id) VALUES(staff,role_id,org,ha);
 INSERT INTO public.user_scopes(user_id,scope_type,organization_id,hospital_id) VALUES(staff,'hospital',org,ha);
 INSERT INTO public.patients(id,organization_id,hospital_id,full_name) VALUES(pa,org,ha,'Synthetic patient A'),(pb,org,hb,'Synthetic patient B');
 INSERT INTO public.admissions(id,organization_id,hospital_id,patient_id,admission_date) VALUES(aa,org,ha,pa,current_date),(ab,org,hb,pb,current_date);
 INSERT INTO public.claims(id,claim_code,organization_id,hospital_id,patient_id,admission_id,claim_date,external_claim_no,status,approved_amount)
 VALUES(ca,'TEST-'||ca,org,ha,pa,aa,current_date,'EXACT-001','submitted',1000),(cb,'TEST-'||cb,org,hb,pb,ab,current_date,'EXACT-001','submitted',1000);
 INSERT INTO public.app_user_connections(id,hospital_id,user_id,connector_id,connection_key_ciphertext,email_address,status,updated_by)
 VALUES(connection,ha,staff,'microsoft_outlook','synthetic-noncredential','synthetic@example.invalid','connected',staff);
 INSERT INTO public.app_user_connections(id,hospital_id,user_id,connector_id,connection_key_ciphertext,email_address,status,updated_by)
 VALUES(connection_b,hb,gen_random_uuid(),'microsoft_outlook','synthetic-noncredential','synthetic-b@example.invalid','connected',staff);
 INSERT INTO public.inbound_emails(id,organization_id,hospital_id,mailbox_connection_id,provider,provider_message_id,sender_email,received_at)
 VALUES(email_b,org,hb,connection_b,'microsoft_outlook','synthetic-message-b','payer@example.invalid',now());
 INSERT INTO public.inbound_emails(id,organization_id,hospital_id,mailbox_connection_id,provider,provider_message_id,sender_email,subject,body_text,received_at)
 VALUES(email,org,ha,connection,'microsoft_outlook','synthetic-message-1','payer@example.invalid','Claim EXACT-001','Synthetic approval proposal',now());

 -- Exact equality, not prefixes, punctuation removal or case folding.
 SELECT count(*) INTO n FROM public.email_exact_claim_candidates(ha,ARRAY['EXACT-001']);
 IF n <> 1 THEN RAISE EXCEPTION 'Exact number must return only the claim in hospital A'; END IF;
 SELECT count(*) INTO n FROM public.email_exact_claim_candidates(ha,ARRAY['EXACT-00','exact-001','EXACT001',' EXACT-001','']);
 IF n <> 0 THEN RAISE EXCEPTION 'Near matches must not match'; END IF;
 SELECT count(*) INTO n FROM public.email_exact_claim_candidates(hb,ARRAY['EXACT-001']) WHERE claim_id=ca;
 IF n <> 0 THEN RAISE EXCEPTION 'Candidate matching crossed hospital boundaries'; END IF;

 blocked:=false;
 BEGIN
 INSERT INTO public.email_claim_matches(organization_id,hospital_id,email_id,claim_id,identifier_type,identifier_value) VALUES(org,ha,email,cb,'external_claim_no','EXACT-001');
 EXCEPTION WHEN raise_exception THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cross-hospital match was accepted'; END IF;
 blocked:=false;
 BEGIN
 INSERT INTO public.email_claim_matches(organization_id,hospital_id,email_id,claim_id,identifier_type,identifier_value) VALUES(org,ha,email,ca,'external_claim_no','EXACT-00');
 EXCEPTION WHEN raise_exception THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Non-exact match was accepted'; END IF;
 INSERT INTO public.email_claim_matches(id,organization_id,hospital_id,email_id,claim_id,identifier_type,identifier_value) VALUES(match,org,ha,email,ca,'external_claim_no','EXACT-001');

 -- Repeat sync must not duplicate the same provider message.
 blocked:=false;
 BEGIN
 INSERT INTO public.inbound_emails(organization_id,hospital_id,mailbox_connection_id,provider,provider_message_id,sender_email,received_at)
 VALUES(org,ha,connection,'microsoft_outlook','synthetic-message-1','payer@example.invalid',now());
 EXCEPTION WHEN unique_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Duplicate message was accepted'; END IF;
 blocked:=false;
 BEGIN
 INSERT INTO public.inbound_emails(organization_id,hospital_id,mailbox_connection_id,provider,provider_message_id,sender_email,received_at)
 VALUES(org,hb,connection,'microsoft_outlook','synthetic-message-2','payer@example.invalid',now());
 EXCEPTION WHEN raise_exception THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Mailbox was reused for another hospital'; END IF;

 -- No ingestion path may mark a proposal already confirmed.
 blocked:=false;
 BEGIN
 INSERT INTO public.email_parsed_events(organization_id,hospital_id,email_id,review_status) VALUES(org,ha,email,'confirmed');
 EXCEPTION WHEN raise_exception THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Ingestion bypassed staff confirmation'; END IF;
 INSERT INTO public.email_parsed_events(id,organization_id,hospital_id,email_id,event_type,proposed_changes,match_id,claim_id)
 VALUES(event,org,ha,email,'approval','{"status":"approved","approved_amount":1500}',match,ca);
 IF (SELECT review_status FROM public.email_parsed_events WHERE id=event) <> 'pending' THEN RAISE EXCEPTION 'Proposal did not default to pending'; END IF;
 blocked:=false;
 BEGIN
 UPDATE public.email_parsed_events SET review_status='confirmed' WHERE id=event;
 EXCEPTION WHEN raise_exception THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Anonymous service confirmed a proposal'; END IF;

 INSERT INTO public.inbound_email_attachments(id,organization_id,hospital_id,email_id,provider_attachment_id,file_name,mime_type,size_bytes,storage_path)
 VALUES(attachment,org,ha,email,'synthetic-attachment','approval.pdf','application/pdf',100,ha||'/'||email||'/'||attachment);
 blocked:=false;
 BEGIN
 INSERT INTO public.inbound_email_attachments(organization_id,hospital_id,email_id,provider_attachment_id,file_name,mime_type,storage_path)
 VALUES(org,ha,email,'wrong-path','approval.pdf','application/pdf',hb||'/'||email||'/'||gen_random_uuid());
 EXCEPTION WHEN check_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Attachment accepted a different hospital folder'; END IF;

 PERFORM set_config('request.jwt.claim.sub',staff::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated')::text,true);
 SET LOCAL ROLE authenticated;
 IF NOT public.email_queue_access(ha,'VIEW') OR public.email_queue_access(hb,'VIEW') THEN RAISE EXCEPTION 'Hospital access isolation failed'; END IF;
 SELECT count(*) INTO n FROM public.inbound_emails WHERE id=email;
 IF n <> 1 THEN RAISE EXCEPTION 'Authorised staff cannot read their email'; END IF;
 SELECT count(*) INTO n FROM public.inbound_emails WHERE id=email_b;
 IF n <> 0 THEN RAISE EXCEPTION 'Hospital A staff could read hospital B email'; END IF;
 RESET ROLE;
 -- A hospital override denying edit must keep the proposal pending.
 INSERT INTO public.hospital_role_permissions(organization_id,hospital_id,role_id,permission_id,allowed)
 SELECT org,ha,role_id,p.id,false FROM public.permissions p WHERE p.module='claims' AND p.action='EDIT';
 SET LOCAL ROLE authenticated;
 UPDATE public.email_parsed_events SET review_status='confirmed' WHERE id=event;
 IF FOUND THEN RAISE EXCEPTION 'View-only staff confirmed a proposal'; END IF;
 RESET ROLE;
 UPDATE public.hospital_role_permissions SET allowed=true WHERE hospital_id=ha;
 SET LOCAL ROLE authenticated;
 UPDATE public.email_parsed_events SET review_status='confirmed',review_note='Synthetic manual confirmation' WHERE id=event;
 IF NOT FOUND THEN RAISE EXCEPTION 'Authorised review did not save'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.email_parsed_events WHERE id=event AND reviewed_by=staff AND reviewed_at IS NOT NULL AND applied_at IS NULL) THEN RAISE EXCEPTION 'Reviewer or time was not stamped'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.claims WHERE id=ca AND status='submitted' AND approved_amount=1000) THEN RAISE EXCEPTION 'Email review changed a claim in Phase 1'; END IF;
 blocked:=false;
 BEGIN
 UPDATE public.email_parsed_events SET review_status='rejected' WHERE id=event;
 EXCEPTION WHEN raise_exception THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Final review could be rewritten'; END IF;
 RESET ROLE;
 IF NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE record_id=event AND action='email_review' AND actor_id=staff) THEN RAISE EXCEPTION 'Review audit missing'; END IF;

 -- The next phase cannot accidentally apply a proposal without explicit work.
 blocked:=false;
 BEGIN
 UPDATE public.email_parsed_events SET applied_at=now() WHERE id=event;
 EXCEPTION WHEN raise_exception THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Phase 1 allowed claim application'; END IF;
 DELETE FROM public.app_user_connections WHERE id=connection;
 IF NOT EXISTS(SELECT 1 FROM public.inbound_emails WHERE id=email AND mailbox_connection_id=connection) THEN RAISE EXCEPTION 'Mailbox disconnect lost email history'; END IF;
 RAISE NOTICE 'PASS: exact matching, tenant isolation, deduplication, private paths, staff confirmation, immutable reviews, unchanged claims and audit';
END $$;
ROLLBACK;