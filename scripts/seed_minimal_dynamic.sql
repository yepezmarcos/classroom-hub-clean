-- scripts/seed_minimal_dynamic.sql
-- Idempotent, schema-flexible demo seed for the "default" tenant.

BEGIN;

-- Always seed under the same tenant id
SELECT set_config('app.tenant_id', 'default', false);

-- Ensure default tenant exists
INSERT INTO "Tenant"(id, name)
SELECT 'default','Default Tenant'
    WHERE NOT EXISTS (SELECT 1 FROM "Tenant" WHERE id='default');

-- ---------------------------------------
-- Classroom (requires: name, code)
-- ---------------------------------------
DO $$
DECLARE
has_id      boolean;
  has_code    boolean;
  has_created boolean;
  has_updated boolean;
  cols        text := '"tenantId","name","code"';
  vals        text;
BEGIN
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Classroom' AND column_name='id')        INTO has_id;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Classroom' AND column_name='code')      INTO has_code;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Classroom' AND column_name='createdAt') INTO has_created;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Classroom' AND column_name='updatedAt') INTO has_updated;

IF NOT has_code THEN
    RAISE EXCEPTION 'Classroom table is missing required "code" column.';
END IF;

  IF has_id      THEN cols := '"id",' || cols; END IF;
  IF has_created THEN cols := cols || ',"createdAt"'; END IF;
  IF has_updated THEN cols := cols || ',"updatedAt"'; END IF;

  vals :=
    (CASE WHEN has_id THEN quote_literal('class_hra24') || ',' ELSE '' END) ||
    quote_literal(current_setting('app.tenant_id')) || ',' ||
    quote_literal('Homeroom A') || ',' ||
    quote_literal('HRA-24') ||
    (CASE WHEN has_created THEN ', now()' ELSE '' END) ||
    (CASE WHEN has_updated THEN ', now()' ELSE '' END);

EXECUTE format('INSERT INTO "Classroom"(%s) VALUES (%s) ON CONFLICT DO NOTHING;', cols, vals);
END $$;

-- ---------------------------------------
-- Students (10 records; safe wrt optional columns)
-- ---------------------------------------
DO $$
DECLARE
has_id      boolean;
  has_email   boolean;
  has_grade   boolean;
  has_gender  boolean;
  has_pron    boolean;
  has_iep     boolean;
  has_ell     boolean;
  has_med     boolean;
  has_created boolean;
  has_updated boolean;

  cols text := '"tenantId","first","last"';
  vals text;
  i   int;

  firsts text[] := ARRAY['Alex','Jess','Sam','Avery','Jordan','Taylor','Riley','Parker','Casey','Morgan'];
  lasts  text[] := ARRAY['Rivera','Kim','Chen','Patel','Nguyen','Garcia','Singh','Brown','Lee','Martinez'];
BEGIN
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Student' AND column_name='id')        INTO has_id;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Student' AND column_name='email')     INTO has_email;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Student' AND column_name='grade')     INTO has_grade;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Student' AND column_name='gender')    INTO has_gender;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Student' AND column_name='pronouns')  INTO has_pron;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Student' AND column_name='iep')       INTO has_iep;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Student' AND column_name='ell')       INTO has_ell;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Student' AND column_name='medical')   INTO has_med;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Student' AND column_name='createdAt') INTO has_created;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Student' AND column_name='updatedAt') INTO has_updated;

IF has_id      THEN cols := '"id",' || cols; END IF;
  IF has_email   THEN cols := cols || ',"email"'; END IF;
  IF has_grade   THEN cols := cols || ',"grade"'; END IF;
  IF has_gender  THEN cols := cols || ',"gender"'; END IF;
  IF has_pron    THEN cols := cols || ',"pronouns"'; END IF;
  IF has_iep     THEN cols := cols || ',"iep"'; END IF;
  IF has_ell     THEN cols := cols || ',"ell"'; END IF;
  IF has_med     THEN cols := cols || ',"medical"'; END IF;
  IF has_created THEN cols := cols || ',"createdAt"'; END IF;
  IF has_updated THEN cols := cols || ',"updatedAt"'; END IF;

FOR i IN 1..10 LOOP
    vals :=
      (CASE WHEN has_id THEN quote_literal(format('stu_%02s', i)) || ',' ELSE '' END) ||
      quote_literal(current_setting('app.tenant_id')) || ',' ||
      quote_literal(firsts[i]) || ',' ||
      quote_literal(lasts[i]);

    IF has_email   THEN vals := vals || ',' || quote_literal(lower(firsts[i]||'.'||lasts[i])||'@example.edu'); END IF;
    IF has_grade   THEN vals := vals || ',' || quote_literal('5'); END IF;
    IF has_gender  THEN vals := vals || ', NULL'; END IF;               -- token NULL (not quoted)
    IF has_pron    THEN vals := vals || ',' || quote_literal('they/them'); END IF;
    IF has_iep     THEN vals := vals || ', false'; END IF;              -- boolean tokens
    IF has_ell     THEN vals := vals || ', false'; END IF;
    IF has_med     THEN vals := vals || ', false'; END IF;
    IF has_created THEN vals := vals || ', now()'; END IF;
    IF has_updated THEN vals := vals || ', now()'; END IF;

EXECUTE format('INSERT INTO "Student"(%s) VALUES (%s) ON CONFLICT DO NOTHING;', cols, vals);
END LOOP;
END $$;

-- ---------------------------------------
-- Enrollment (students -> classroom)
-- ---------------------------------------
DO $$
DECLARE
has_id      boolean;
  has_created boolean;
  has_updated boolean;

  cols text := '"tenantId","studentId","classroomId"';
  vals text;
  sid  text;
BEGIN
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Enrollment' AND column_name='id')        INTO has_id;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Enrollment' AND column_name='createdAt') INTO has_created;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Enrollment' AND column_name='updatedAt') INTO has_updated;

IF has_id      THEN cols := '"id",' || cols; END IF;
  IF has_created THEN cols := cols || ',"createdAt"'; END IF;
  IF has_updated THEN cols := cols || ',"updatedAt"'; END IF;

FOR sid IN SELECT format('stu_%02s', g) FROM generate_series(1,10) g LOOP
    vals :=
      (CASE WHEN has_id THEN quote_literal('enr_'||sid) || ',' ELSE '' END) ||
      quote_literal(current_setting('app.tenant_id')) || ',' ||
      quote_literal(sid) || ',' ||
      quote_literal('class_hra24');

IF has_created THEN vals := vals || ', now()'; END IF;
    IF has_updated THEN vals := vals || ', now()'; END IF;

EXECUTE format('INSERT INTO "Enrollment"(%s) VALUES (%s) ON CONFLICT DO NOTHING;', cols, vals);
END LOOP;
END $$;

-- ---------------------------------------
-- Assignments (supports name|title|label + optional code + points)
-- ---------------------------------------
DO $$
DECLARE
has_id       boolean;
  has_name     boolean;
  has_title    boolean;
  has_label    boolean;
  has_code     boolean;
  has_created  boolean;
  has_updated  boolean;

  points_col   text := NULL;   -- one of: points|maxPoints|total|outOf
  text_col     text := NULL;   -- one of: name|title|label

  tenant_id    text := current_setting('app.tenant_id');
  class_id     text := 'class_hra24';

  cols         text := '"tenantId","classroomId"';
  vals_a       text;
  vals_b       text;
BEGIN
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Assignment' AND column_name='id')          INTO has_id;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Assignment' AND column_name='name')        INTO has_name;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Assignment' AND column_name='title')       INTO has_title;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Assignment' AND column_name='label')       INTO has_label;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Assignment' AND column_name='code')        INTO has_code;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Assignment' AND column_name='createdAt')   INTO has_created;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Assignment' AND column_name='updatedAt')   INTO has_updated;

-- pick display column by priority
IF has_name THEN
    text_col := 'name';
  ELSIF has_title THEN
    text_col := 'title';
  ELSIF has_label THEN
    text_col := 'label';
ELSE
    RAISE EXCEPTION 'Assignment needs one of: name, title or label.';
END IF;

  -- detect optional points column
SELECT column_name
INTO points_col
FROM information_schema.columns
WHERE table_name='Assignment' AND column_name IN ('points','maxPoints','total','outOf')
ORDER BY CASE column_name
             WHEN 'points' THEN 1
             WHEN 'maxPoints' THEN 2
             WHEN 'total' THEN 3
             WHEN 'outOf' THEN 4
             END
    LIMIT 1;

-- columns
IF has_id      THEN cols := '"id",' || cols; END IF;
  cols := cols || ',' || quote_ident(text_col);
  IF has_code    THEN cols := cols || ',"code"'; END IF;
  IF points_col IS NOT NULL THEN cols := cols || ',' || quote_ident(points_col); END IF;
  IF has_created THEN cols := cols || ',"createdAt"'; END IF;
  IF has_updated THEN cols := cols || ',"updatedAt"'; END IF;

  -- values A
  vals_a :=
    (CASE WHEN has_id THEN quote_literal('asmt_a') || ',' ELSE '' END) ||
    quote_literal(tenant_id) || ',' ||
    quote_literal(class_id) || ',' ||
    quote_literal('Reading Check A');

  IF has_code    THEN vals_a := vals_a || ',' || quote_literal('READ-A'); END IF;
  IF points_col IS NOT NULL THEN vals_a := vals_a || ', 100'; END IF;
  IF has_created THEN vals_a := vals_a || ', now()'; END IF;
  IF has_updated THEN vals_a := vals_a || ', now()'; END IF;

  -- values B
  vals_b :=
    (CASE WHEN has_id THEN quote_literal('asmt_b') || ',' ELSE '' END) ||
    quote_literal(tenant_id) || ',' ||
    quote_literal(class_id) || ',' ||
    quote_literal('Math Quiz B');

  IF has_code    THEN vals_b := vals_b || ',' || quote_literal('MATH-B'); END IF;
  IF points_col IS NOT NULL THEN vals_b := vals_b || ', 100'; END IF;
  IF has_created THEN vals_b := vals_b || ', now()'; END IF;
  IF has_updated THEN vals_b := vals_b || ', now()'; END IF;

EXECUTE format('INSERT INTO "Assignment"(%s) VALUES (%s) ON CONFLICT DO NOTHING;', cols, vals_a);
EXECUTE format('INSERT INTO "Assignment"(%s) VALUES (%s) ON CONFLICT DO NOTHING;', cols, vals_b);
END $$;

-- ---------------------------------------
-- Grades (detect score column; one grade per student per assignment)
-- ---------------------------------------
DO $$
DECLARE
has_id       boolean;
  has_created  boolean;
  has_updated  boolean;
  score_col    text := NULL; -- try several conventional names

  cols         text := '"tenantId","studentId","assignmentId"';
  vals         text;
  sid          text;
  asmt         text;
  base         int;
  score        int;
BEGIN
  -- choose score column
SELECT column_name INTO score_col
FROM information_schema.columns
WHERE table_name='Grade' AND column_name IN ('value','score','points','percent','mark','grade')
ORDER BY CASE column_name
             WHEN 'value'   THEN 1
             WHEN 'score'   THEN 2
             WHEN 'points'  THEN 3
             WHEN 'percent' THEN 4
             WHEN 'mark'    THEN 5
             WHEN 'grade'   THEN 6
             END
    LIMIT 1;

IF score_col IS NULL THEN
    RAISE NOTICE 'No numeric score column found on "Grade"; skipping grade seeds.';
    RETURN;
END IF;

SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Grade' AND column_name='id')        INTO has_id;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Grade' AND column_name='createdAt') INTO has_created;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Grade' AND column_name='updatedAt') INTO has_updated;

IF has_id      THEN cols := '"id",' || cols; END IF;
  cols := cols || ',' || quote_ident(score_col);
  IF has_created THEN cols := cols || ',"createdAt"'; END IF;
  IF has_updated THEN cols := cols || ',"updatedAt"'; END IF;

FOR sid IN SELECT format('stu_%02s', g) FROM generate_series(1,10) g LOOP
    FOREACH asmt IN ARRAY ARRAY['asmt_a','asmt_b'] LOOP
      base  := 70 + (random()*30)::int;   -- 70..99
score := LEAST(base, 100);

      vals :=
        (CASE WHEN has_id THEN quote_literal('grade_'||sid||'_'||asmt) || ',' ELSE '' END) ||
        quote_literal(current_setting('app.tenant_id')) || ',' ||
        quote_literal(sid) || ',' ||
        quote_literal(asmt) || ',' ||
        score;

      IF has_created THEN vals := vals || ', now()'; END IF;
      IF has_updated THEN vals := vals || ', now()'; END IF;

EXECUTE format('INSERT INTO "Grade"(%s) VALUES (%s) ON CONFLICT DO NOTHING;', cols, vals);
END LOOP;
END LOOP;
END $$;

-- ---------------------------------------
-- Comment Templates (with emoji in text)
-- ---------------------------------------
DO $$
DECLARE
has_id      boolean;
  has_cat     boolean;
  has_tone    boolean;
  has_level   boolean;
  has_created boolean;
  has_updated boolean;

  cols text := '"tenantId","text"';

rows jsonb := jsonb_build_array(
    jsonb_build_object('text','🟢 Strength: Consistently participates and helps peers.'),
    jsonb_build_object('text','🟡 Growing: Shows improvement with multi-step problems.'),
    jsonb_build_object('text','🔴 Next Step: Benefit from targeted small-group practice.')
  );
  i int;
  v text;
BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='CommentTemplate';
  IF NOT FOUND THEN
    RAISE NOTICE 'No CommentTemplate table; skipping.';
    RETURN;
END IF;

  PERFORM 1 FROM information_schema.columns WHERE table_name='CommentTemplate' AND column_name='text';
  IF NOT FOUND THEN
    RAISE NOTICE 'CommentTemplate has no "text" column; skipping.';
    RETURN;
END IF;

SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='CommentTemplate' AND column_name='id')        INTO has_id;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='CommentTemplate' AND column_name='category')  INTO has_cat;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='CommentTemplate' AND column_name='tone')      INTO has_tone;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='CommentTemplate' AND column_name='level')     INTO has_level;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='CommentTemplate' AND column_name='createdAt') INTO has_created;
SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='CommentTemplate' AND column_name='updatedAt') INTO has_updated;

IF has_id      THEN cols := '"id",' || cols; END IF;
  IF has_cat     THEN cols := cols || ',"category"'; END IF;
  IF has_tone    THEN cols := cols || ',"tone"'; END IF;
  IF has_level   THEN cols := cols || ',"level"'; END IF;
  IF has_created THEN cols := cols || ',"createdAt"'; END IF;
  IF has_updated THEN cols := cols || ',"updatedAt"'; END IF;

FOR i IN 0..(jsonb_array_length(rows)-1) LOOP
    v :=
      (CASE WHEN has_id THEN quote_literal('ct_'||i) || ',' ELSE '' END) ||
      quote_literal(current_setting('app.tenant_id')) || ',' ||
      quote_literal( (rows->i->>'text') );

    IF has_cat   THEN v := v || ',' || quote_literal( CASE i WHEN 0 THEN 'strength' WHEN 1 THEN 'growth' ELSE 'next-step' END ); END IF;
    IF has_tone  THEN v := v || ',' || quote_literal( CASE i WHEN 0 THEN 'encouraging' WHEN 1 THEN 'neutral' ELSE 'actionable' END ); END IF;
    IF has_level THEN v := v || ',' || quote_literal( CASE i WHEN 0 THEN 'E' WHEN 1 THEN 'G' ELSE 'NS' END ); END IF;
    IF has_created THEN v := v || ', now()'; END IF;
    IF has_updated THEN v := v || ', now()'; END IF;

EXECUTE format('INSERT INTO "CommentTemplate"(%s) VALUES (%s) ON CONFLICT DO NOTHING;', cols, v);
END LOOP;
END $$;

COMMIT;