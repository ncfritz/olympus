-- Checks for minerva.goal_user_settings, goal_categories and goal_cycles
-- (migration 1790910000000_minerva_goal_categories_cycles). Runs in a
-- transaction that is rolled back, so it is safe on any database with the
-- migrations applied, and fails loudly on the first wrong answer:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_goal_categories_cycles.sql <database>

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
    ('5f1a0c6e-0000-4000-8000-000000000001', 'Goals Check A', 'goals-check-a@example.test'),
    ('5f1a0c6e-0000-4000-8000-0000000000ff', 'Goals Check B', 'goals-check-b@example.test');

-- Settings: one row per user.
INSERT INTO minerva.goal_user_settings (user_id, starter_categories_at)
    VALUES ('5f1a0c6e-0000-4000-8000-000000000001', now());
SELECT pg_temp.expect_refused('a second settings row',
    $q$INSERT INTO minerva.goal_user_settings (user_id) VALUES ('5f1a0c6e-0000-4000-8000-000000000001')$q$, '23505');

-- Categories.
INSERT INTO minerva.goal_categories (id, user_id, name, color, icon, position) VALUES
    ('6a2d9e40-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'Health', '#52c41a', 'heart', 0),
    ('6a2d9e40-0000-4000-8000-000000000002', '5f1a0c6e-0000-4000-8000-000000000001', 'Work', '#1677ff', 'laptop', 1);
SELECT pg_temp.expect_refused('same name, other case',
    $q$INSERT INTO minerva.goal_categories (user_id, name, color, icon, position) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'HEALTH', '#52c41a', 'heart', 2)$q$, '23505');
SELECT pg_temp.expect_refused('an icon not in the list',
    $q$INSERT INTO minerva.goal_categories (user_id, name, color, icon, position) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'Craft', '#52c41a', 'unicorn', 2)$q$, '23514');
SELECT pg_temp.expect_refused('an uppercase colour',
    $q$INSERT INTO minerva.goal_categories (user_id, name, color, icon, position) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'Craft', '#52C41A', 'star', 2)$q$, '23514');
SELECT pg_temp.expect_refused('no colour',
    $q$INSERT INTO minerva.goal_categories (user_id, name, icon, position) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'Craft', 'star', 2)$q$, '23502');
SELECT pg_temp.expect_refused('a 2,001-character vision',
    $q$INSERT INTO minerva.goal_categories (user_id, name, color, icon, position, vision) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'Craft', '#52c41a', 'star', 2, repeat('x', 2001))$q$, '23514');
-- Another user may use the same name and position.
INSERT INTO minerva.goal_categories (user_id, name, color, icon, position)
    VALUES ('5f1a0c6e-0000-4000-8000-0000000000ff', 'Health', '#52c41a', 'heart', 0);

-- Positions are unique per user, checked at commit, so a swap passes
-- through a moment where two categories share one.
SAVEPOINT swap;
UPDATE minerva.goal_categories SET position = 1 WHERE id = '6a2d9e40-0000-4000-8000-000000000001';
UPDATE minerva.goal_categories SET position = 0 WHERE id = '6a2d9e40-0000-4000-8000-000000000002';
SET CONSTRAINTS minerva.goal_categories_user_id_position_key IMMEDIATE;
RELEASE SAVEPOINT swap;
SET CONSTRAINTS minerva.goal_categories_user_id_position_key DEFERRED;
SELECT pg_temp.expect_refused('two categories in one position at commit', $q$
    DO $do$
    BEGIN
        UPDATE minerva.goal_categories SET position = 0
            WHERE id = '6a2d9e40-0000-4000-8000-000000000001';
        SET CONSTRAINTS minerva.goal_categories_user_id_position_key IMMEDIATE;
    END;
    $do$
$q$, '23505');

-- Cycles.
INSERT INTO minerva.goal_cycles (id, user_id, name, start_date)
    VALUES ('2e7b4c90-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'Cycle 4', '2026-09-07');
DO $$
BEGIN
    IF (SELECT weeks FROM minerva.goal_cycles WHERE id = '2e7b4c90-0000-4000-8000-000000000001') <> 12
       OR (SELECT buffer_weeks FROM minerva.goal_cycles WHERE id = '2e7b4c90-0000-4000-8000-000000000001') <> 1 THEN
        RAISE EXCEPTION 'a cycle is not 12 + 1 weeks by default';
    END IF;
END;
$$;
SELECT pg_temp.expect_refused('a start that is not a Monday',
    $q$INSERT INTO minerva.goal_cycles (user_id, name, start_date) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'Tuesday', '2026-09-08')$q$, '23514');
SELECT pg_temp.expect_refused('a second cycle on the same Monday',
    $q$INSERT INTO minerva.goal_cycles (user_id, name, start_date) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'Again', '2026-09-07')$q$, '23505');
SELECT pg_temp.expect_refused('27 weeks',
    $q$INSERT INTO minerva.goal_cycles (user_id, name, start_date, weeks) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'Long', '2027-01-04', 27)$q$, '23514');
SELECT pg_temp.expect_refused('three buffer weeks',
    $q$INSERT INTO minerva.goal_cycles (user_id, name, start_date, buffer_weeks) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'Slow', '2027-01-04', 3)$q$, '23514');

-- Audit times: an update moves updated_at and leaves created_at, on every
-- table.
UPDATE minerva.goal_user_settings SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.goal_categories SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.goal_cycles SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.goal_user_settings SET starter_categories_at = now();
UPDATE minerva.goal_categories SET vision = 'Ride every week.' WHERE name = 'Health';
UPDATE minerva.goal_cycles SET name = 'Cycle Four';
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM minerva.goal_user_settings
            WHERE created_at <> '2026-01-01T00:00:00Z' OR updated_at <= '2026-01-01T00:00:00Z'
        UNION ALL
        SELECT 1 FROM minerva.goal_categories
            WHERE created_at <> '2026-01-01T00:00:00Z' OR updated_at <= '2026-01-01T00:00:00Z'
        UNION ALL
        SELECT 1 FROM minerva.goal_cycles
            WHERE created_at <> '2026-01-01T00:00:00Z' OR updated_at <= '2026-01-01T00:00:00Z'
    ) THEN
        RAISE EXCEPTION 'an update did not keep created_at and move updated_at';
    END IF;
END;
$$;

-- Everything goes with its user, and only theirs.
DELETE FROM olympus.users WHERE id = '5f1a0c6e-0000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.goal_user_settings WHERE user_id = '5f1a0c6e-0000-4000-8000-000000000001')
       OR EXISTS (SELECT 1 FROM minerva.goal_categories WHERE user_id = '5f1a0c6e-0000-4000-8000-000000000001')
       OR EXISTS (SELECT 1 FROM minerva.goal_cycles WHERE user_id = '5f1a0c6e-0000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'goals rows outlived their user';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM minerva.goal_categories WHERE user_id = '5f1a0c6e-0000-4000-8000-0000000000ff') THEN
        RAISE EXCEPTION 'another user''s category went with them';
    END IF;
END;
$$;

ROLLBACK;
