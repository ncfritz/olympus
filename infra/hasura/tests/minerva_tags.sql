-- Checks for minerva.tags (migration 1790900000000_minerva_tags). Runs in a
-- transaction that is rolled back, so it is safe on any database with the
-- migrations applied, and fails loudly on the first wrong answer:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_tags.sql <database>

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
    ('5f1a0c6e-0000-4000-8000-000000000001', 'Tag Check A', 'tag-check-a@example.test'),
    ('5f1a0c6e-0000-4000-8000-0000000000ff', 'Tag Check B', 'tag-check-b@example.test');

INSERT INTO minerva.tags (id, user_id, name, color) VALUES
    ('4c8e1f20-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'Olympus', '#1677ff');

-- Names: unique per user whatever the case, 1 to 50 characters, not blank.
SELECT pg_temp.expect_refused('same name, other case',
    $q$INSERT INTO minerva.tags (user_id, name) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'OLYMPUS')$q$, '23505');
SELECT pg_temp.expect_refused('blank name',
    $q$INSERT INTO minerva.tags (user_id, name) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '   ')$q$, '23514');
SELECT pg_temp.expect_refused('51-character name',
    $q$INSERT INTO minerva.tags (user_id, name) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', repeat('x', 51))$q$, '23514');
-- Another user may have the same name.
INSERT INTO minerva.tags (user_id, name) VALUES ('5f1a0c6e-0000-4000-8000-0000000000ff', 'olympus');

-- Colours: lowercase #rrggbb, or none.
SELECT pg_temp.expect_refused('uppercase colour',
    $q$INSERT INTO minerva.tags (user_id, name, color) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'a', '#1677FF')$q$, '23514');
SELECT pg_temp.expect_refused('short colour',
    $q$INSERT INTO minerva.tags (user_id, name, color) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'b', '#fff')$q$, '23514');
INSERT INTO minerva.tags (user_id, name, color) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'no colour', NULL);

-- Audit times: an update moves updated_at and leaves created_at.
UPDATE minerva.tags SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z'
    WHERE id = '4c8e1f20-0000-4000-8000-000000000001';
UPDATE minerva.tags SET name = 'olympus' WHERE id = '4c8e1f20-0000-4000-8000-000000000001';
DO $$
DECLARE
    tag record;
BEGIN
    SELECT created_at, updated_at INTO tag FROM minerva.tags
        WHERE id = '4c8e1f20-0000-4000-8000-000000000001';
    IF tag.created_at <> '2026-01-01T00:00:00Z' THEN
        RAISE EXCEPTION 'created_at moved on update: %', tag.created_at;
    END IF;
    IF tag.updated_at <= '2026-01-01T00:00:00Z' THEN
        RAISE EXCEPTION 'updated_at did not move on update: %', tag.updated_at;
    END IF;
END;
$$;

-- A user's tags go with the user.
DELETE FROM olympus.users WHERE id = '5f1a0c6e-0000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.tags
               WHERE user_id = '5f1a0c6e-0000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'tags outlived their user';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM minerva.tags
                   WHERE user_id = '5f1a0c6e-0000-4000-8000-0000000000ff') THEN
        RAISE EXCEPTION 'another user''s tag went with them';
    END IF;
END;
$$;

ROLLBACK;
