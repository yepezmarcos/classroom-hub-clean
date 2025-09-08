BEGIN;

-- Tenant
INSERT INTO "Tenant"(id, name, "createdAt", "updatedAt")
VALUES ('t_demo', 'Demo School', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Settings (basic)
INSERT INTO "Settings"(id, "tenantId", jurisdiction, board, "lsCategories", subjects, "gradeBands", terms, "createdAt", "updatedAt")
VALUES ('set1', 't_demo', 'CA', 'Demo Board',
        ARRAY['Responsibility','Organization','Independent Work','Collaboration','Initiative','Self-Regulation'],
        ARRAY['Math','ELA','Science'],
        ARRAY['3-5'],
        3, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Classes
INSERT INTO "Classroom"(id, "tenantId", name, code, "createdAt", "updatedAt")
VALUES 
  ('c1', 't_demo', 'Homeroom A', 'HRA-24', now(), now()),
  ('c2', 't_demo', 'Math A',     'MATH-5A', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Students (10)
WITH s(first,last,id) AS (
  VALUES
  ('Alex','Rivera','s1'),('Jess','Kim','s2'),('Sam','Chen','s3'),('Taylor','Nguyen','s4'),
  ('Jordan','Singh','s5'),('Casey','Cohen','s6'),('Riley','Garcia','s7'),('Avery','Lee','s8'),
  ('Morgan','Patel','s9'),('Drew','Brown','s10')
)
INSERT INTO "Student"(id, "tenantId", first, last, grade, pronouns, iep, ell, medical, "createdAt", "updatedAt")
SELECT id, 't_demo', first, last, '5', 'they/them', false, false, false, now(), now()
FROM s
ON CONFLICT (id) DO NOTHING;

-- Guardians
WITH g(name,email,phone,id) AS (
  VALUES
  ('Alex Rivera Parent','alex.rivera.parents@example.com','555-0100','g1'),
  ('Jess Kim Parent','jess.kim.parents@example.com','555-0101','g2'),
  ('Sam Chen Parent','sam.chen.parents@example.com','555-0102','g3'),
  ('Taylor Nguyen Parent','taylor.nguyen.parents@example.com','555-0103','g4'),
  ('Jordan Singh Parent','jordan.singh.parents@example.com','555-0104','g5'),
  ('Casey Cohen Parent','casey.cohen.parents@example.com','555-0105','g6'),
  ('Riley Garcia Parent','riley.garcia.parents@example.com','555-0106','g7'),
  ('Avery Lee Parent','avery.lee.parents@example.com','555-0107','g8'),
  ('Morgan Patel Parent','morgan.patel.parents@example.com','555-0108','g9'),
  ('Drew Brown Parent','drew.brown.parents@example.com','555-0109','g10')
)
INSERT INTO "Guardian"(id, "tenantId", name, email, phone, "createdAt", "updatedAt")
SELECT id, 't_demo', name, email, phone, now(), now()
FROM g
ON CONFLICT (id) DO NOTHING;

-- Link Student <-> Guardian (1:1 for demo)
INSERT INTO "StudentGuardian"(id, "tenantId", "studentId", "guardianId", relationship, "createdAt", "updatedAt")
SELECT 'sg'||v, 't_demo', 's'||v, 'g'||v, 'Parent', now(), now()
FROM generate_series(1,10) v
ON CONFLICT (id) DO NOTHING;

-- Enrollments in Homeroom & Math
INSERT INTO "Enrollment"(id, "tenantId", "studentId", "classroomId", "createdAt", "updatedAt")
SELECT 'e_h_'||v, 't_demo', 's'||v, 'c1', now(), now()
FROM generate_series(1,10) v
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Enrollment"(id, "tenantId", "studentId", "classroomId", "createdAt", "updatedAt")
SELECT 'e_m_'||v, 't_demo', 's'||v, 'c2', now(), now()
FROM generate_series(1,10) v
ON CONFLICT (id) DO NOTHING;

-- Assignments
INSERT INTO "Assignment"(id, "tenantId", "classroomId", title, points, "dueAt", "createdAt", "updatedAt")
VALUES 
  ('a1','t_demo','c2','Unit 1 Quiz',    20, now(), now(), now()),
  ('a2','t_demo','c2','Unit 1 Project', 50, now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- Grades
INSERT INTO "Grade"(id, "tenantId", "assignmentId", "studentId", score, "createdAt", "updatedAt")
SELECT 'g_a1_'||v, 't_demo', 'a1', 's'||v, 15 + floor(random()*6)::int, now(), now()
FROM generate_series(1,10) v
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Grade"(id, "tenantId", "assignmentId", "studentId", score, "createdAt", "updatedAt")
SELECT 'g_a2_'||v, 't_demo', 'a2', 's'||v, 35 + floor(random()*16)::int, now(), now()
FROM generate_series(1,10) v
ON CONFLICT (id) DO NOTHING;

COMMIT;
