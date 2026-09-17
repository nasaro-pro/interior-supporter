-- ARCHITECTURE.md 6.6 — ENABLE only (no FORCE). Table owner still bypasses;
-- app isolation remains DataContext. tenantTransaction() sets LOCAL GUCs.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'memberships',
    'invitations',
    'customers',
    'projects',
    'project_access',
    'pages',
    'blocks',
    'templates',
    'design_versions',
    'materials',
    'progress_photos',
    'schedules',
    'comments',
    'storage_objects',
    'notifications',
    'audit_logs',
    'project_assignments',
    'field_work_logs',
    'estimate_versions',
    'meeting_records',
    'meeting_participants',
    'meeting_acks',
    'customer_requests',
    'request_corrections'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (
        current_setting(''app.bypass_rls'', true) = ''on''
        OR company_id::text = current_setting(''app.company_id'', true)
      )',
      t
    );
  END LOOP;
END $$;
