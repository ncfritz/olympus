-- Checks for Minerva's per-user calendar and notes tables (migration
-- 1791100000000_minerva_calendar_users). Runs in a transaction that is
-- rolled back, so it is safe on any database with the migrations applied,
-- and fails loudly on the first wrong answer:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_calendar_users.sql <database>
--
-- The migration's clear-out of the old meetings, its backfill (every
-- remaining row to ncfritz@ncfritz.net) and its refusals are checked by
-- applying it to a database seeded before it; see the plan's phase 1.

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
    ('6a2b0c6e-0000-4000-8000-000000000001', 'Calendar Check A', 'calendar-check-a@example.test'),
    ('6a2b0c6e-0000-4000-8000-0000000000ff', 'Calendar Check B', 'calendar-check-b@example.test');

-- The same person is a separate row for each user who meets them.
INSERT INTO minerva.meeting_user (user_id, email, given_name, type) VALUES
    ('6a2b0c6e-0000-4000-8000-000000000001', 'someone@example.test', 'Someone', 'person'),
    ('6a2b0c6e-0000-4000-8000-0000000000ff', 'someone@example.test', 'Someone', 'person');
SELECT pg_temp.expect_refused('same person twice for one user',
    $q$INSERT INTO minerva.meeting_user (user_id, email, given_name, type) VALUES ('6a2b0c6e-0000-4000-8000-000000000001', 'someone@example.test', 'Again', 'person')$q$, '23505');

INSERT INTO minerva.meetings (id, user_id, subject, sensitivity, occurrence_type, type, reminder,
        start_time, end_time, duration, all_day, status, cancelled, organizer_email, uid, source) VALUES
    ('check:a1', '6a2b0c6e-0000-4000-8000-000000000001', 'A one', 'normal', 'single', 'meeting', false,
        '2026-09-28T16:00Z', '2026-09-28T17:00Z', 60, false, 'busy', false, 'someone@example.test', 'a1', 'check'),
    ('check:b1', '6a2b0c6e-0000-4000-8000-0000000000ff', 'B one', 'normal', 'single', 'meeting', false,
        '2026-09-28T16:00Z', '2026-09-28T16:30Z', 30, false, 'busy', false, 'someone@example.test', 'b1', 'check');

SELECT pg_temp.expect_refused('meeting without a user',
    $q$INSERT INTO minerva.meetings (id, subject, sensitivity, occurrence_type, type, reminder, start_time, end_time, duration, all_day, cancelled, source) VALUES ('check:x', 'x', 'normal', 'single', 'meeting', false, now(), now(), 0, false, false, 'check')$q$, '23502');
SELECT pg_temp.expect_refused('meeting id taken by another user',
    $q$INSERT INTO minerva.meetings (id, user_id, subject, sensitivity, occurrence_type, type, reminder, start_time, end_time, duration, all_day, cancelled, source) VALUES ('check:a1', '6a2b0c6e-0000-4000-8000-0000000000ff', 'x', 'normal', 'single', 'meeting', false, now(), now(), 0, false, false, 'check')$q$, '23505');

-- Attendees are their meeting's user's.
INSERT INTO minerva.meeting_attendees (meeting_id, user_id, attendee_email, attendance, response) VALUES
    ('check:a1', '6a2b0c6e-0000-4000-8000-000000000001', 'someone@example.test', 'required', 'accepted');
SELECT pg_temp.expect_refused('attendee on another user''s meeting',
    $q$INSERT INTO minerva.meeting_attendees (meeting_id, user_id, attendee_email, attendance, response) VALUES ('check:a1', '6a2b0c6e-0000-4000-8000-0000000000ff', 'other@example.test', 'required', 'accepted')$q$, '23503');

INSERT INTO minerva.notes (id, user_id, author, type, value) VALUES
    ('6a2b0c6e-1000-4000-8000-000000000001', '6a2b0c6e-0000-4000-8000-000000000001', 'a', 0, 'A note'),
    ('6a2b0c6e-1000-4000-8000-0000000000ff', '6a2b0c6e-0000-4000-8000-0000000000ff', 'b', 0, 'B note');

-- A child note is its parent's user's.
INSERT INTO minerva.notes (user_id, author, type, value, parent_id) VALUES
    ('6a2b0c6e-0000-4000-8000-000000000001', 'a', 0, 'A child', '6a2b0c6e-1000-4000-8000-000000000001');
SELECT pg_temp.expect_refused('child of another user''s note',
    $q$INSERT INTO minerva.notes (user_id, author, type, value, parent_id) VALUES ('6a2b0c6e-0000-4000-8000-0000000000ff', 'b', 0, 'x', '6a2b0c6e-1000-4000-8000-000000000001')$q$, '23503');
SELECT pg_temp.expect_refused('deleting a note that has children',
    $q$DELETE FROM minerva.notes WHERE id = '6a2b0c6e-1000-4000-8000-000000000001'$q$, '23503');

-- A meeting link is its note's user's. It has no key to meetings, so it
-- may name a meeting not (yet) there: one cleared out and imported again.
INSERT INTO minerva.meeting_notes (meeting_id, note_id, user_id) VALUES
    ('check:a1', '6a2b0c6e-1000-4000-8000-000000000001', '6a2b0c6e-0000-4000-8000-000000000001'),
    ('check:not-yet-imported', '6a2b0c6e-1000-4000-8000-000000000001', '6a2b0c6e-0000-4000-8000-000000000001');
SELECT pg_temp.expect_refused('another user''s note on own meeting',
    $q$INSERT INTO minerva.meeting_notes (meeting_id, note_id, user_id) VALUES ('check:a1', '6a2b0c6e-1000-4000-8000-0000000000ff', '6a2b0c6e-0000-4000-8000-000000000001')$q$, '23503');

-- An association is its note's user's.
INSERT INTO minerva.note_associations (note_id, user_id, item_id, item_type) VALUES
    ('6a2b0c6e-1000-4000-8000-000000000001', '6a2b0c6e-0000-4000-8000-000000000001', 'check:a1', 'meeting');
SELECT pg_temp.expect_refused('association on another user''s note',
    $q$INSERT INTO minerva.note_associations (note_id, user_id, item_id, item_type) VALUES ('6a2b0c6e-1000-4000-8000-000000000001', '6a2b0c6e-0000-4000-8000-0000000000ff', 'check:b1', 'meeting')$q$, '23503');

-- The statistics count one user's rows.
DO $$
DECLARE
    a numeric;
    b numeric;
    notes_a numeric;
BEGIN
    SELECT sum(count) INTO a FROM minerva.meeting_status_statistics(
        '6a2b0c6e-0000-4000-8000-000000000001', '2026-09-28T00:00Z', '2026-09-29T00:00Z');
    SELECT sum(count) INTO b FROM minerva.meeting_hour_statistics(
        '6a2b0c6e-0000-4000-8000-0000000000ff', '2026-09-28T00:00Z', '2026-09-29T00:00Z');
    IF a <> 1 OR b <> 1 THEN
        RAISE EXCEPTION 'meeting statistics not per user: A %, B %', a, b;
    END IF;
    SELECT sum(count) INTO a FROM minerva.meeting_day_statistics(
        '6a2b0c6e-0000-4000-8000-000000000001', '2026-09-28T00:00Z', '2026-09-29T00:00Z');
    IF a <> 1 THEN
        RAISE EXCEPTION 'meeting_day_statistics not per user: %', a;
    END IF;
    SELECT sum(count) INTO notes_a FROM minerva.notes_type_statistics(
        '6a2b0c6e-0000-4000-8000-000000000001', now() - interval '1 hour', now() + interval '1 hour');
    IF notes_a <> 1 THEN
        RAISE EXCEPTION 'notes_type_statistics not per user (top-level only): %', notes_a;
    END IF;
    SELECT sum(count) INTO notes_a FROM minerva.notes_hour_statistics(
        '6a2b0c6e-0000-4000-8000-0000000000ff', now() - interval '1 hour', now() + interval '1 hour');
    IF notes_a <> 1 THEN
        RAISE EXCEPTION 'notes_hour_statistics not per user: %', notes_a;
    END IF;
END;
$$;

-- Audit times: an update moves updated_at and leaves created_at.
UPDATE minerva.meetings SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z'
    WHERE id = 'check:a1';
UPDATE minerva.meetings SET subject = 'A one, renamed' WHERE id = 'check:a1';
UPDATE minerva.meeting_attendees SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.meeting_attendees SET response = 'declined' WHERE meeting_id = 'check:a1';
UPDATE minerva.meeting_user SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z'
    WHERE email = 'someone@example.test';
UPDATE minerva.meeting_user SET alias = 'some' WHERE email = 'someone@example.test';
UPDATE minerva.note_associations SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z'
    WHERE item_id = 'check:a1';
UPDATE minerva.note_associations SET item_type = 'calendar' WHERE item_id = 'check:a1';
DO $$
DECLARE
    moved text;
BEGIN
    SELECT string_agg(t, ', ') INTO moved FROM (
        SELECT 'meetings' AS t FROM minerva.meetings
            WHERE id = 'check:a1' AND (created_at <> '2026-01-01T00:00:00Z' OR updated_at = '2026-01-01T00:00:00Z')
        UNION ALL
        SELECT 'meeting_attendees' FROM minerva.meeting_attendees
            WHERE meeting_id = 'check:a1' AND (created_at <> '2026-01-01T00:00:00Z' OR updated_at = '2026-01-01T00:00:00Z')
        UNION ALL
        SELECT 'meeting_user' FROM minerva.meeting_user
            WHERE email = 'someone@example.test' AND (created_at <> '2026-01-01T00:00:00Z' OR updated_at = '2026-01-01T00:00:00Z')
        UNION ALL
        SELECT 'note_associations' FROM minerva.note_associations
            WHERE item_id = 'check:a1' AND (created_at <> '2026-01-01T00:00:00Z' OR updated_at = '2026-01-01T00:00:00Z')
    ) wrong;
    IF moved IS NOT NULL THEN
        RAISE EXCEPTION 'audit times wrong on update: %', moved;
    END IF;
END;
$$;

-- Deleting a meeting takes its attendees, not its notes, note links or
-- note associations: a meeting synced or imported again finds them.
DELETE FROM minerva.meetings WHERE id = 'check:a1';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.meeting_attendees WHERE meeting_id = 'check:a1') THEN
        RAISE EXCEPTION 'a deleted meeting left attendees';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM minerva.notes WHERE id = '6a2b0c6e-1000-4000-8000-000000000001')
        OR NOT EXISTS (SELECT 1 FROM minerva.meeting_notes WHERE meeting_id = 'check:a1')
        OR NOT EXISTS (SELECT 1 FROM minerva.note_associations WHERE item_id = 'check:a1') THEN
        RAISE EXCEPTION 'deleting a meeting took a note, note link or association';
    END IF;
END;
$$;

-- Deleting a user removes all of their Minerva rows in one statement.
DELETE FROM olympus.users WHERE id = '6a2b0c6e-0000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.notes WHERE user_id = '6a2b0c6e-0000-4000-8000-000000000001')
        OR EXISTS (SELECT 1 FROM minerva.meeting_user WHERE user_id = '6a2b0c6e-0000-4000-8000-000000000001')
        OR EXISTS (SELECT 1 FROM minerva.note_associations WHERE user_id = '6a2b0c6e-0000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'deleting a user left Minerva rows';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM minerva.notes WHERE user_id = '6a2b0c6e-0000-4000-8000-0000000000ff') THEN
        RAISE EXCEPTION 'deleting one user removed another''s notes';
    END IF;
END;
$$;

ROLLBACK;
