-- Lock down the tables that were created without row level security.
-- The backend connects with the service role, which bypasses RLS, so the app
-- behaves exactly as before; this only blocks direct access with the anon key.
-- Safe to re-run.

-- Unused since admins moved to phone sign-in, but still holds password hashes.
ALTER TABLE IF EXISTS admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS citation_verifications ENABLE ROW LEVEL SECURITY;

-- A view runs with its owner's rights by default, skipping RLS on the tables
-- underneath. Make ai_usage_summary use the caller's rights (Postgres 15+).
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 150000 THEN
    EXECUTE 'ALTER VIEW IF EXISTS ai_usage_summary SET (security_invoker = true)';
  END IF;
END $$;
