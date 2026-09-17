-- 2차 설계 v2.0 스키마. drizzle-kit 산출물(0000)은 수기 편집하지 않는다.

ALTER TYPE "membership_role" ADD VALUE IF NOT EXISTS 'field_worker';
ALTER TYPE "schedule_type" ADD VALUE IF NOT EXISTS 'meeting';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'assignment_grant';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'assignment_revoke';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'field_log_complete';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'estimate_publish';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'meeting_publish';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'request_create';

DO $$ BEGIN
  CREATE TYPE "assignment_role" AS ENUM ('designer', 'field_worker');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "work_log_status" AS ENUM ('started', 'in_progress', 'done');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "request_process_status" AS ENUM ('open', 'in_progress', 'done');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "storage_objects"
  ADD COLUMN IF NOT EXISTS "derivative_of_id" uuid;

ALTER TABLE "progress_photos"
  ADD COLUMN IF NOT EXISTS "field_work_log_id" uuid;

CREATE TABLE IF NOT EXISTS "project_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "assignment_role" "assignment_role" NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone,
  "granted_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "assignments_project_user_idx"
  ON "project_assignments" ("project_id", "user_id");
CREATE INDEX IF NOT EXISTS "assignments_company_user_idx"
  ON "project_assignments" ("company_id", "user_id");

CREATE TABLE IF NOT EXISTS "field_work_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "assignment_id" uuid REFERENCES "project_assignments"("id"),
  "work_date" date NOT NULL,
  "process_category" "process_category" NOT NULL,
  "body" text NOT NULL,
  "issue" text,
  "issue_status" text,
  "status" "work_log_status" DEFAULT 'started' NOT NULL,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "revision_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "field_logs_project_date_idx"
  ON "field_work_logs" ("project_id", "work_date");

CREATE TABLE IF NOT EXISTS "estimate_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "version_no" integer NOT NULL,
  "version_name" varchar(50) NOT NULL,
  "pdf_file_id" uuid NOT NULL,
  "change_note" text,
  "visibility_status" "visibility_status" DEFAULT 'draft' NOT NULL,
  "publish_at" timestamp with time zone,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "estimate_versions_project_no_uq"
  ON "estimate_versions" ("project_id", "version_no");
CREATE INDEX IF NOT EXISTS "estimate_versions_project_vis_idx"
  ON "estimate_versions" ("project_id", "visibility_status");

CREATE TABLE IF NOT EXISTS "meeting_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "meeting_at" timestamp with time zone NOT NULL,
  "title" varchar(200) NOT NULL,
  "minutes" text,
  "decisions" text,
  "attachment_id" uuid,
  "schedule_id" uuid,
  "visibility_status" "visibility_status" DEFAULT 'draft' NOT NULL,
  "publish_at" timestamp with time zone,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "meetings_project_at_idx"
  ON "meeting_records" ("project_id", "meeting_at");

CREATE TABLE IF NOT EXISTS "meeting_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "meeting_id" uuid NOT NULL REFERENCES "meeting_records"("id") ON DELETE cascade,
  "user_id" uuid REFERENCES "users"("id"),
  "external_name" varchar(100),
  "role" varchar(50),
  "attendance_status" varchar(20)
);

CREATE INDEX IF NOT EXISTS "meeting_participants_meeting_idx"
  ON "meeting_participants" ("meeting_id");

CREATE TABLE IF NOT EXISTS "meeting_acks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "meeting_id" uuid NOT NULL REFERENCES "meeting_records"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "meeting_acks_meeting_idx"
  ON "meeting_acks" ("meeting_id");

CREATE TABLE IF NOT EXISTS "customer_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "original_body" text NOT NULL,
  "response" text,
  "process_status" "request_process_status" DEFAULT 'open' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "customer_requests_project_idx"
  ON "customer_requests" ("project_id", "created_at");

CREATE TABLE IF NOT EXISTS "request_corrections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "request_id" uuid NOT NULL REFERENCES "customer_requests"("id") ON DELETE cascade,
  "body" text NOT NULL,
  "corrected_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "request_corrections_request_idx"
  ON "request_corrections" ("request_id");

DO $$ BEGIN
  ALTER TABLE "estimate_versions"
    ADD CONSTRAINT estimate_versions_scheduled_publish_at_chk
    CHECK (visibility_status <> 'scheduled' OR publish_at IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "meeting_records"
    ADD CONSTRAINT meeting_records_scheduled_publish_at_chk
    CHECK (visibility_status <> 'scheduled' OR publish_at IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
