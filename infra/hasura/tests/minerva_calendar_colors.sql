-- Checks for minerva.calendar_colors (migration
-- 1791120000000_minerva_calendar_colors). Runs in a transaction that is
-- rolled back, so it is safe on any database with the migrations applied:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_calendar_colors.sql <database>

\set ON_ERROR_STOP 1
BEGIN;

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
    ('7c3d0c6e-2000-4000-8000-000000000001', 'Color Check A', 'color-check-a@example.test'),
    ('7c3d0c6e-2000-4000-8000-0000000000ff', 'Color Check B', 'color-check-b@example.test');

-- Each user colors the same source their own way.
INSERT INTO minerva.calendar_colors (user_id, source, color) VALUES
    ('7c3d0c6e-2000-4000-8000-000000000001', 'personal', '#1677ff'),
    ('7c3d0c6e-2000-4000-8000-0000000000ff', 'personal', '#fa8c16');

SELECT pg_temp.expect_refused('one color per user and source',
    $q$INSERT INTO minerva.calendar_colors (user_id, source, color)
       VALUES ('7c3d0c6e-2000-4000-8000-000000000001', 'personal', '#000000')$q$, '23505');
SELECT pg_temp.expect_refused('a color is six lower-case hex digits',
    $q$INSERT INTO minerva.calendar_colors (user_id, source, color)
       VALUES ('7c3d0c6e-2000-4000-8000-000000000001', 'work', 'blue')$q$, '23514');
SELECT pg_temp.expect_refused('no upper-case hex',
    $q$INSERT INTO minerva.calendar_colors (user_id, source, color)
       VALUES ('7c3d0c6e-2000-4000-8000-000000000001', 'work', '#1677FF')$q$, '23514');
SELECT pg_temp.expect_refused('a source of at most 64 characters',
    format($q$INSERT INTO minerva.calendar_colors (user_id, source, color)
       VALUES ('7c3d0c6e-2000-4000-8000-000000000001', %L, '#000000')$q$, repeat('x', 65)), '23514');

-- The audit columns move on update.
UPDATE minerva.calendar_colors SET color = '#52c41a', updated_at = now() - interval '1 day'
    WHERE user_id = '7c3d0c6e-2000-4000-8000-000000000001';
DO $$
BEGIN
    IF (SELECT updated_at < now() FROM minerva.calendar_colors
        WHERE user_id = '7c3d0c6e-2000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'updated_at was not set by the trigger';
    END IF;
END;
$$;

-- A user's colors go with them.
DELETE FROM olympus.users WHERE id = '7c3d0c6e-2000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.calendar_colors
               WHERE user_id = '7c3d0c6e-2000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'colors outlived their user';
    END IF;
END;
$$;

\echo 'minerva_calendar_colors: all checks passed'
ROLLBACK;
