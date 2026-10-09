-- Checks for minerva.meetings.snapshot_time (migration
-- 1791150000000_minerva_meetings_snapshot_time), with the conditional
-- upsert the API's calendar events consumer writes through Hasura: a
-- snapshot replaces a meeting only when it is no older than the one the
-- meeting holds. Runs in a transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_meetings_snapshot_time.sql <database>

\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO olympus.users (id, display_name, email) VALUES
    ('7c3d0c6e-4000-4000-8000-000000000001', 'Snapshot Check', 'snapshot-check@example.test');

-- What Hasura's insert_one with on_conflict { where } becomes.
CREATE FUNCTION pg_temp.write(subject text, snapshot timestamptz) RETURNS boolean
    LANGUAGE sql AS $$
    INSERT INTO minerva.meetings AS m (id, user_id, subject, sensitivity, occurrence_type, type, reminder,
            start_time, end_time, duration, all_day, cancelled, source, snapshot_time)
        VALUES ('snapshot-check:1', '7c3d0c6e-4000-4000-8000-000000000001', subject, 'normal', 'single',
            'meeting', false, '2026-10-05T16:00Z', '2026-10-05T17:00Z', 60, false, false, 'check', snapshot)
    ON CONFLICT (id) DO UPDATE SET subject = excluded.subject, snapshot_time = excluded.snapshot_time
        WHERE m.snapshot_time IS NULL OR m.snapshot_time <= excluded.snapshot_time
    RETURNING true;
$$;

DO $$
BEGIN
    -- Nullable: meetings from before, or not from the agent, have none.
    PERFORM 1 FROM information_schema.columns
        WHERE table_schema = 'minerva' AND table_name = 'meetings'
          AND column_name = 'snapshot_time' AND is_nullable = 'YES'
          AND data_type = 'timestamp with time zone';
    IF NOT FOUND THEN RAISE EXCEPTION 'snapshot_time: not a nullable timestamptz'; END IF;
END $$;

SELECT pg_temp.write('First', '2026-10-04T20:00Z');
SELECT pg_temp.write('Newer', '2026-10-04T20:05Z');
-- A late, older snapshot: nothing written, nothing returned.
SELECT pg_temp.write('Late', '2026-10-04T20:01Z');
-- The same snapshot again (a redelivery) is written again, harmlessly.
SELECT pg_temp.write('Newer', '2026-10-04T20:05Z');

DO $$
DECLARE kept text;
BEGIN
    SELECT subject INTO kept FROM minerva.meetings WHERE id = 'snapshot-check:1';
    IF kept <> 'Newer' THEN RAISE EXCEPTION 'expected the newer snapshot kept, got %', kept; END IF;
END $$;

ROLLBACK;
