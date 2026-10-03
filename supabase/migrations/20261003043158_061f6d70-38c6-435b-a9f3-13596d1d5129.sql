ALTER TABLE public.insurers ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.tpas ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';