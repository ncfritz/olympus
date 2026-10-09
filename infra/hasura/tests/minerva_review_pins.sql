-- Checks for minerva.review_pins (migration
-- 1791020000000_minerva_review_pins). Runs in a transaction that is rolled
-- back, so it is safe on any database with the migrations applied, and
-- fails loudly on the first wrong answer:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_review_pins.sql <database>

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
    ('5f1a0c6e-0000-4000-8000-000000000001', 'Pins Check A', 'pins-check-a@example.test'),
    ('5f1a0c6e-0000-4000-8000-0000000000ff', 'Pins Check B', 'pins-check-b@example.test');

-- Week 40's review, Wednesday's daily review with one answer, and a note.
INSERT INTO minerva.reviews (id, user_id, kind, period_start) VALUES
    ('7b3e1d00-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'weekly', '2026-09-28'),
    ('7b3e1d00-0000-4000-8000-000000000002', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', '2026-09-30'),
    ('7b3e1d00-0000-4000-8000-0000000000ff', '5f1a0c6e-0000-4000-8000-0000000000ff', 'weekly', '2026-09-28'),
    ('7b3e1d00-0000-4000-8000-0000000000fe', '5f1a0c6e-0000-4000-8000-0000000000ff', 'daily', '2026-09-30');
INSERT INTO minerva.review_prompts (id, user_id, kind, section, label, position) VALUES
    ('8c4f2e00-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'reflect', 'What went well?', 0),
    ('8c4f2e00-0000-4000-8000-0000000000ff', '5f1a0c6e-0000-4000-8000-0000000000ff', 'daily', 'reflect', 'What went well?', 0);
INSERT INTO minerva.review_answers (id, review_id, prompt_id, user_id, kind, body) VALUES
    ('9d5a3f00-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000002',
     '8c4f2e00-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'daily',
     'Design review landed.'),
    ('9d5a3f00-0000-4000-8000-0000000000ff', '7b3e1d00-0000-4000-8000-0000000000fe',
     '8c4f2e00-0000-4000-8000-0000000000ff', '5f1a0c6e-0000-4000-8000-0000000000ff', 'daily',
     'Theirs.');
INSERT INTO minerva.notes (id, user_id, type, value) VALUES
    ('c0ffee00-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 0, 'Q4 scope is too big');

-- A weekly review pins an answer and a note, each once.
INSERT INTO minerva.review_pins (id, user_id, review_id, answer_id) VALUES
    ('b0b0b0b0-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001',
     '7b3e1d00-0000-4000-8000-000000000001', '9d5a3f00-0000-4000-8000-000000000001');
INSERT INTO minerva.review_pins (id, user_id, review_id, note_id) VALUES
    ('b0b0b0b0-0000-4000-8000-000000000002', '5f1a0c6e-0000-4000-8000-000000000001',
     '7b3e1d00-0000-4000-8000-000000000001', 'c0ffee00-0000-4000-8000-000000000001');
DO $$
BEGIN
    IF (SELECT kind FROM minerva.review_pins WHERE id = 'b0b0b0b0-0000-4000-8000-000000000001') <> 'weekly' THEN
        RAISE EXCEPTION 'a pin is not weekly by default';
    END IF;
END;
$$;
SELECT pg_temp.expect_refused('the answer pinned twice',
    $q$INSERT INTO minerva.review_pins (user_id, review_id, answer_id) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000001', '9d5a3f00-0000-4000-8000-000000000001')$q$, '23505');
SELECT pg_temp.expect_refused('the note pinned twice',
    $q$INSERT INTO minerva.review_pins (user_id, review_id, note_id) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000001', 'c0ffee00-0000-4000-8000-000000000001')$q$, '23505');
SELECT pg_temp.expect_refused('a pin to nothing',
    $q$INSERT INTO minerva.review_pins (user_id, review_id) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000001')$q$, '23514');
SELECT pg_temp.expect_refused('a pin to an answer and a note',
    $q$INSERT INTO minerva.review_pins (user_id, review_id, answer_id, note_id) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000001', '9d5a3f00-0000-4000-8000-000000000001', 'c0ffee00-0000-4000-8000-000000000001')$q$, '23514');
SELECT pg_temp.expect_refused('a pin on a daily review',
    $q$INSERT INTO minerva.review_pins (user_id, review_id, note_id) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000002', 'c0ffee00-0000-4000-8000-000000000001')$q$, '23503');
SELECT pg_temp.expect_refused('a pin claiming to be daily',
    $q$INSERT INTO minerva.review_pins (user_id, review_id, kind, note_id) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000002', 'daily', 'c0ffee00-0000-4000-8000-000000000001')$q$, '23514');
SELECT pg_temp.expect_refused('a pin on another user''s review',
    $q$INSERT INTO minerva.review_pins (user_id, review_id, note_id) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-0000000000ff', 'c0ffee00-0000-4000-8000-000000000001')$q$, '23503');
SELECT pg_temp.expect_refused('another user''s answer',
    $q$INSERT INTO minerva.review_pins (user_id, review_id, answer_id) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000001', '9d5a3f00-0000-4000-8000-0000000000ff')$q$, '23503');

-- Audit times: an update moves updated_at and leaves created_at.
UPDATE minerva.review_pins SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.review_pins SET note_id = note_id WHERE note_id IS NOT NULL;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM minerva.review_pins
            WHERE note_id IS NOT NULL
              AND (created_at <> '2026-01-01T00:00:00Z' OR updated_at <= '2026-01-01T00:00:00Z')
    ) THEN
        RAISE EXCEPTION 'an update did not keep created_at and move updated_at';
    END IF;
END;
$$;

-- A soft-deleted note keeps its pin; a removed answer takes its pin.
UPDATE minerva.notes SET deleted_at = now() WHERE id = 'c0ffee00-0000-4000-8000-000000000001';
DELETE FROM minerva.review_answers WHERE id = '9d5a3f00-0000-4000-8000-000000000001';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM minerva.review_pins WHERE id = 'b0b0b0b0-0000-4000-8000-000000000002') THEN
        RAISE EXCEPTION 'a soft-deleted note lost its pin';
    END IF;
    IF EXISTS (SELECT 1 FROM minerva.review_pins WHERE id = 'b0b0b0b0-0000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'a pin outlived its answer';
    END IF;
END;
$$;

-- A note purged for good takes its pin; a review takes its pins.
DELETE FROM minerva.notes WHERE id = 'c0ffee00-0000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.review_pins WHERE id = 'b0b0b0b0-0000-4000-8000-000000000002') THEN
        RAISE EXCEPTION 'a pin outlived its purged note';
    END IF;
END;
$$;
-- Notes are per user (migration 1791100000000_minerva_calendar_users):
-- each user pins a note of their own.
INSERT INTO minerva.notes (id, user_id, type, value) VALUES
    ('c0ffee00-0000-4000-8000-000000000002', '5f1a0c6e-0000-4000-8000-000000000001', 0, 'Another'),
    ('c0ffee00-0000-4000-8000-000000000003', '5f1a0c6e-0000-4000-8000-0000000000ff', 0, 'Theirs');
INSERT INTO minerva.review_pins (user_id, review_id, note_id) VALUES
    ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000001', 'c0ffee00-0000-4000-8000-000000000002'),
    ('5f1a0c6e-0000-4000-8000-0000000000ff', '7b3e1d00-0000-4000-8000-0000000000ff', 'c0ffee00-0000-4000-8000-000000000003');
DELETE FROM minerva.reviews WHERE id = '7b3e1d00-0000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.review_pins WHERE review_id = '7b3e1d00-0000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'pins outlived their review';
    END IF;
END;
$$;

-- Everything goes with its user, and only theirs.
DELETE FROM olympus.users WHERE id = '5f1a0c6e-0000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.review_pins WHERE user_id = '5f1a0c6e-0000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'pins outlived their user';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM minerva.review_pins WHERE user_id = '5f1a0c6e-0000-4000-8000-0000000000ff') THEN
        RAISE EXCEPTION 'another user''s pins went with them';
    END IF;
END;
$$;

ROLLBACK;
