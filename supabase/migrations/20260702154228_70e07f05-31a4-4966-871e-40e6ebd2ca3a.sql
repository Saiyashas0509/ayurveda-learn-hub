-- Pending bootstrap: holds initial super admin intent until they first sign in
CREATE TABLE public.pending_bootstrap (
  email text PRIMARY KEY,
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pending_bootstrap TO service_role;
ALTER TABLE public.pending_bootstrap ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role/security-definer paths touch this.