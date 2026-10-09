-- Checks for minerva.goal_checkins and goal_habit_logs (migration
-- 1790930000000_minerva_goal_checkins_habits). Runs in a transaction that
-- is rolled back, so it is safe on any database with the migrations
-- applied, and fails loudly on the first wrong answer:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_goal_checkins_habits.sql <database>

\set ON_ERROR_STOP 1
BEGIN;

-- Runs `statement` and fails unless it is refused with `code` (a SQLSTATE).
CREATE FUNCTION pg_temp.expect_refused(label text, statement text, code text)
    RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE statement;
    RAISE EXCEPTION '%: not refused', label;
EXCEPTION
    WHEN OTHERS THEN
        IF SQLSTATE = 'P0001' OR SQLSTATE <> code THEN
            RAISE EXCEPTION '%: expected %, got % (%)', label, code, SQLSTATE, SQLERRM;
        END IF;
END;
$$;

INSERT INTO olympus.users (id, display_name, email) VALUES
    ('5f1a0c6e-0000-4000-8000-000000000001', 'Goals Check', 'goals-check@example.test');
INSERT INTO minerva.goal_categories (id, user_id, name, color, icon, position) VALUES
    ('6a2d9e40-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'Health', '#52c41a', 'heart', 0);
INSERT INTO minerva.goals (id, user_id, category_id, title, type, status, horizon,
        start_date, due_date, progress_mode, position, unit, start_value, target_value) VALUES
    ('9b1c0000-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001',
        '6a2d9e40-0000-4000-8000-000000000001', 'Weigh 75 kg', 'outcome', 'active', 'year',
        '2026-01-01', '2026-12-31', 'checkins', 0, 'kg', 82.4, 75);
INSERT INTO minerva.goals (id, user_id, category_id, title, type, status, horizon,
        start_date, progress_mode, position) VALUES
    ('9b1c0000-0000-4000-8000-000000000002', '5f1a0c6e-0000-4000-8000-000000000001',
        '6a2d9e40-0000-4000-8000-000000000001', 'Run 3× a week', 'habit', 'active', 'ongoing',
        '2026-09-14', 'habit', 1);

-- Check-ins: a value, a confidence or both; the source defaults to the
-- goal page.
INSERT INTO minerva.goal_checkins (id, goal_id, checkin_date, value, confidence) VALUES
    ('7d4e0000-0000-4000-8000-000000000001', '9b1c0000-0000-4000-8000-000000000001', '2026-09-01', 80.1, 'on_track');
INSERT INTO minerva.goal_checkins (goal_id, checkin_date, value, source) VALUES
    ('9b1c0000-0000-4000-8000-000000000001', '2026-09-15', 79.6, 'weekly_review');
INSERT INTO minerva.goal_checkins (goal_id, checkin_date, confidence, note, source) VALUES
    ('9b1c0000-0000-4000-8000-000000000002', '2026-09-30', 'at_risk', 'Knee', 'daily_review');
DO $$
BEGIN
    IF (SELECT source FROM minerva.goal_checkins WHERE id = '7d4e0000-0000-4000-8000-000000000001') <> 'goal' THEN
        RAISE EXCEPTION 'a check-in''s source did not default to goal';
    END IF;
END;
$$;
SELECT pg_temp.expect_refused('a check-in that says nothing',
    $q$INSERT INTO minerva.goal_checkins (goal_id, checkin_date) VALUES ('9b1c0000-0000-4000-8000-000000000001', '2026-09-20')$q$, '23514');
SELECT pg_temp.expect_refused('an unknown confidence',
    $q$INSERT INTO minerva.goal_checkins (goal_id, checkin_date, confidence) VALUES ('9b1c0000-0000-4000-8000-000000000001', '2026-09-20', 'fine')$q$, '23514');
SELECT pg_temp.expect_refused('an unknown source',
    $q$INSERT INTO minerva.goal_checkins (goal_id, checkin_date, value, source) VALUES ('9b1c0000-0000-4000-8000-000000000001', '2026-09-20', 79, 'ios')$q$, '23514');
SELECT pg_temp.expect_refused('a note too long',
    $q$INSERT INTO minerva.goal_checkins (goal_id, checkin_date, value, note) VALUES ('9b1c0000-0000-4000-8000-000000000001', '2026-09-20', 79, repeat('x', 2001))$q$, '23514');
SELECT pg_temp.expect_refused('a check-in on no goal',
    $q$INSERT INTO minerva.goal_checkins (goal_id, checkin_date, value) VALUES ('9b1c0000-0000-4000-8000-0000000000ff', '2026-09-20', 79)$q$, '23503');

-- Habit logs: one per goal per day, done or a quantity; logging the day
-- again is an upsert that keeps the row.
INSERT INTO minerva.goal_habit_logs (id, goal_id, log_date, done) VALUES
    ('3a5f0000-0000-4000-8000-000000000001', '9b1c0000-0000-4000-8000-000000000002', '2026-09-28', true);
INSERT INTO minerva.goal_habit_logs (goal_id, log_date, quantity) VALUES
    ('9b1c0000-0000-4000-8000-000000000002', '2026-09-30', 3.5);
INSERT INTO minerva.goal_habit_logs (goal_id, log_date, done, note)
    VALUES ('9b1c0000-0000-4000-8000-000000000002', '2026-09-28', true, 'Again')
    ON CONFLICT ON CONSTRAINT goal_habit_logs_goal_id_log_date_key
    DO UPDATE SET done = EXCLUDED.done, note = EXCLUDED.note;
DO $$
BEGIN
    IF (SELECT count(*) FROM minerva.goal_habit_logs WHERE log_date = '2026-09-28') <> 1
       OR (SELECT note FROM minerva.goal_habit_logs WHERE id = '3a5f0000-0000-4000-8000-000000000001') <> 'Again' THEN
        RAISE EXCEPTION 'logging a day again did not update the one row';
    END IF;
END;
$$;
SELECT pg_temp.expect_refused('a second log for a day',
    $q$INSERT INTO minerva.goal_habit_logs (goal_id, log_date, done) VALUES ('9b1c0000-0000-4000-8000-000000000002', '2026-09-30', true)$q$, '23505');
SELECT pg_temp.expect_refused('a log that records nothing',
    $q$INSERT INTO minerva.goal_habit_logs (goal_id, log_date) VALUES ('9b1c0000-0000-4000-8000-000000000002', '2026-09-29')$q$, '23514');
SELECT pg_temp.expect_refused('a negative quantity',
    $q$INSERT INTO minerva.goal_habit_logs (goal_id, log_date, quantity) VALUES ('9b1c0000-0000-4000-8000-000000000002', '2026-09-29', -1)$q$, '23514');
SELECT pg_temp.expect_refused('a log note too long',
    $q$INSERT INTO minerva.goal_habit_logs (goal_id, log_date, done, note) VALUES ('9b1c0000-0000-4000-8000-000000000002', '2026-09-29', true, repeat('x', 501))$q$, '23514');

-- Audit times: an update moves updated_at and leaves created_at.
UPDATE minerva.goal_checkins SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.goal_habit_logs SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.goal_checkins SET note = 'Edited';
UPDATE minerva.goal_habit_logs SET done = true;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM minerva.goal_checkins WHERE created_at <> '2026-01-01T00:00:00Z' OR updated_at <= '2026-01-01T00:00:00Z'
        UNION ALL SELECT 1 FROM minerva.goal_habit_logs WHERE created_at <> '2026-01-01T00:00:00Z' OR updated_at <= '2026-01-01T00:00:00Z'
    ) THEN
        RAISE EXCEPTION 'an update did not keep created_at and move updated_at';
    END IF;
END;
$$;

-- Check-ins and logs go with their goal, and so with their user.
DELETE FROM minerva.goals WHERE id = '9b1c0000-0000-4000-8000-000000000002';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.goal_habit_logs)
       OR EXISTS (SELECT 1 FROM minerva.goal_checkins WHERE goal_id = '9b1c0000-0000-4000-8000-000000000002') THEN
        RAISE EXCEPTION 'check-ins or logs outlived their goal';
    END IF;
END;
$$;
DELETE FROM olympus.users WHERE id = '5f1a0c6e-0000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.goal_checkins) THEN
        RAISE EXCEPTION 'check-ins outlived their user';
    END IF;
END;
$$;

ROLLBACK;
