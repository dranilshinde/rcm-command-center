REVOKE EXECUTE ON FUNCTION public.run_rcm_engine() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.pick_reminder_rule(text,uuid,uuid,uuid,uuid) FROM authenticated;
ALTER FUNCTION public.sla_hours(text,uuid,uuid,uuid,integer) SECURITY INVOKER;