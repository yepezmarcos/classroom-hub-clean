-- scripts/harden_tenancy.sql
BEGIN;

-- 0) Ensure a default tenant exists (safe if it already exists)
INSERT INTO "Tenant"(id, name)
SELECT 'default', 'Default Tenant'
    WHERE NOT EXISTS (SELECT 1 FROM "Tenant" WHERE id='default');

-- 1) Add tenantId to all core tables if missing; backfill; index it
DO $$
DECLARE
t RECORD;
  idx_name TEXT;
BEGIN
FOR t IN
SELECT unnest(ARRAY[
                  'Classroom',
              'Student',
              'Guardian',
              'StudentGuardian',
              'Assignment',
              'Grade',
              'Enrollment',
              'Note',
              'CommentTemplate',
              'StandardSet',
              'StandardSkill',
              'Settings'
                  ]) AS t
    LOOP
      -- Add column tenantId if not present
      IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name = t.t AND column_name='tenantId'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN "tenantId" TEXT;', t.t);
END IF;

    -- Backfill NULL tenantId -> 'default'
EXECUTE format('UPDATE %I SET "tenantId"=''default'' WHERE "tenantId" IS NULL;', t.t);

-- Create index on tenantId if missing
idx_name := format('idx_%s_tenantId', lower(t.t));
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename=t.t AND indexname=idx_name
    ) THEN
      EXECUTE format('CREATE INDEX %I ON %I("tenantId");', idx_name, t.t);
END IF;
END LOOP;
END $$;

-- 2) Uniqueness helpers for join tables (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='enroll_tenant_student_class_uniq') THEN
CREATE UNIQUE INDEX enroll_tenant_student_class_uniq
    ON "Enrollment"("tenantId","studentId","classroomId");
END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='sg_tenant_student_guardian_uniq') THEN
CREATE UNIQUE INDEX sg_tenant_student_guardian_uniq
    ON "StudentGuardian"("tenantId","studentId","guardianId");
END IF;
END $$;

COMMIT;