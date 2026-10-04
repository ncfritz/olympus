-- Checks for minerva.availability_blocks and minerva.meeting_availability
-- (migration 1791140000000_minerva_availability). Runs in a transaction
-- that is rolled back, so it is safe on any database with the migrations
-- applied:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_availability.sql <database>

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
    ('7c3d0c6e-3000-4000-8000-000000000001', 'Availability Check A', 'availability-check-a@example.test'),
    ('7c3d0c6e-3000-4000-8000-0000000000ff', 'Availability Check B', 'availability-check-b@example.test');

-- Blocks: each user's own, any of the four levels.
INSERT INTO minerva.availability_blocks (user_id, start_time, end_time, status, label) VALUES
    ('7c3d0c6e-3000-4000-8000-000000000001', '2026-10-05 13:00Z', '2026-10-05 15:00Z', 'busy', 'Focus time'),
    ('7c3d0c6e-3000-4000-8000-000000000001', '2026-10-05 16:00Z', '2026-10-05 16:30Z', 'none', NULL),
    ('7c3d0c6e-3000-4000-8000-0000000000ff', '2026-10-05 13:00Z', '2026-10-05 14:00Z', 'interruptable', NULL);

SELECT pg_temp.expect_refused('a level outside the four',
    $q$INSERT INTO minerva.availability_blocks (user_id, start_time, end_time, status)
       VALUES ('7c3d0c6e-3000-4000-8000-000000000001', '2026-10-05 09:00Z', '2026-10-05 10:00Z', 'dnd')$q$, '23514');
SELECT pg_temp.expect_refused('a block that ends before it starts',
    $q$INSERT INTO minerva.availability_blocks (user_id, start_time, end_time, status)
       VALUES ('7c3d0c6e-3000-4000-8000-000000000001', '2026-10-05 10:00Z', '2026-10-05 10:00Z', 'busy')$q$, '23514');
SELECT pg_temp.expect_refused('a label over 200 characters',
    format($q$INSERT INTO minerva.availability_blocks (user_id, start_time, end_time, status, label)
       VALUES ('7c3d0c6e-3000-4000-8000-000000000001', '2026-10-05 09:00Z', '2026-10-05 10:00Z', 'busy', %L)$q$, repeat('x', 201)), '23514');
SELECT pg_temp.expect_refused('a block of no one',
    $q$INSERT INTO minerva.availability_blocks (user_id, start_time, end_time, status)
       VALUES ('7c3d0c6e-3000-4000-8000-0000000000aa', '2026-10-05 09:00Z', '2026-10-05 10:00Z', 'busy')$q$, '23503');

-- Meeting levels: one per user and meeting, with no meeting needed.
INSERT INTO minerva.meeting_availability (user_id, meeting_id, status) VALUES
    ('7c3d0c6e-3000-4000-8000-000000000001', 'work:planning-1@example', 'busy'),
    ('7c3d0c6e-3000-4000-8000-0000000000ff', 'work:planning-1@example', 'free');
SELECT pg_temp.expect_refused('two levels for one meeting',
    $q$INSERT INTO minerva.meeting_availability (user_id, meeting_id, status)
       VALUES ('7c3d0c6e-3000-4000-8000-000000000001', 'work:planning-1@example', 'free')$q$, '23505');
SELECT pg_temp.expect_refused('a meeting level outside the four',
    $q$INSERT INTO minerva.meeting_availability (user_id, meeting_id, status)
       VALUES ('7c3d0c6e-3000-4000-8000-000000000001', 'work:other@example', 'clear')$q$, '23514');

-- The audit columns move on update.
UPDATE minerva.meeting_availability SET status = 'interruptable', updated_at = now() - interval '1 day'
    WHERE user_id = '7c3d0c6e-3000-4000-8000-000000000001';
UPDATE minerva.availability_blocks SET label = 'Deep work', updated_at = now() - interval '1 day'
    WHERE user_id = '7c3d0c6e-3000-4000-8000-000000000001' AND label = 'Focus time';
DO $$
BEGIN
    IF (SELECT updated_at < now() FROM minerva.meeting_availability
        WHERE user_id = '7c3d0c6e-3000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'meeting_availability.updated_at was not set by the trigger';
    END IF;
    IF (SELECT updated_at < now() FROM minerva.availability_blocks
        WHERE label = 'Deep work') THEN
        RAISE EXCEPTION 'availability_blocks.updated_at was not set by the trigger';
    END IF;
END;
$$;

-- A user's availability goes with them; the other's stays.
DELETE FROM olympus.users WHERE id = '7c3d0c6e-3000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.availability_blocks WHERE user_id = '7c3d0c6e-3000-4000-8000-000000000001')
       OR EXISTS (SELECT 1 FROM minerva.meeting_availability WHERE user_id = '7c3d0c6e-3000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'availability outlived its user';
    END IF;
    IF (SELECT count(*) FROM minerva.availability_blocks WHERE user_id = '7c3d0c6e-3000-4000-8000-0000000000ff') <> 1
       OR (SELECT count(*) FROM minerva.meeting_availability WHERE user_id = '7c3d0c6e-3000-4000-8000-0000000000ff') <> 1 THEN
        RAISE EXCEPTION 'the other user lost their availability';
    END IF;
END;
$$;

\echo 'minerva_availability: all checks passed'
ROLLBACK;
