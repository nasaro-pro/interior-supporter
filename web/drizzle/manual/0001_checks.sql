-- ARCHITECTURE.md 5.9 I2, I8, I9
-- drizzle-kit generate 산출물은 수기 편집하지 않고 이 파일에서 CHECK 만 추가한다.

-- I2: visibility_status='scheduled' → publish_at IS NOT NULL
ALTER TABLE blocks
  ADD CONSTRAINT blocks_scheduled_publish_at_chk
  CHECK (visibility_status <> 'scheduled' OR publish_at IS NOT NULL);

ALTER TABLE design_versions
  ADD CONSTRAINT design_versions_scheduled_publish_at_chk
  CHECK (visibility_status <> 'scheduled' OR publish_at IS NOT NULL);

ALTER TABLE materials
  ADD CONSTRAINT materials_scheduled_publish_at_chk
  CHECK (visibility_status <> 'scheduled' OR publish_at IS NOT NULL);

ALTER TABLE progress_photos
  ADD CONSTRAINT progress_photos_scheduled_publish_at_chk
  CHECK (visibility_status <> 'scheduled' OR publish_at IS NOT NULL);

ALTER TABLE schedules
  ADD CONSTRAINT schedules_scheduled_publish_at_chk
  CHECK (visibility_status <> 'scheduled' OR publish_at IS NOT NULL);

-- I8: templates.scope 와 company_id / project_id 조합
ALTER TABLE templates
  ADD CONSTRAINT templates_scope_ids_chk
  CHECK (
    (scope = 'platform' AND company_id IS NULL AND project_id IS NULL)
    OR (scope = 'company' AND company_id IS NOT NULL AND project_id IS NULL)
    OR (scope = 'project' AND company_id IS NOT NULL AND project_id IS NOT NULL)
  );

-- I9: invitations.kind 와 role / project_id 조합
ALTER TABLE invitations
  ADD CONSTRAINT invitations_kind_ids_chk
  CHECK (
    (kind = 'company_member' AND role IS NOT NULL AND project_id IS NULL)
    OR (kind = 'project_customer' AND project_id IS NOT NULL AND role IS NULL)
  );
