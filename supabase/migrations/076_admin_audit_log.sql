-- Admin audit log: captures service-key writes for traceability.
-- This table records who performed admin actions and what resource was affected.
-- Populated by application code via the withAdmin HOF when audit logging is enabled.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT,
  action      TEXT        NOT NULL,
  resource    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Only admins (service role) should access this table.
-- Disable RLS so service-key client can write freely; the table itself is not
-- exposed to the anon or authenticated roles.
ALTER TABLE admin_audit_log DISABLE ROW LEVEL SECURITY;

-- Ensure authenticated/anon roles cannot select from this table.
REVOKE ALL ON admin_audit_log FROM anon, authenticated;
