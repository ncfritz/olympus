-- Checks for answers as lists (migration
-- 1791030000000_minerva_review_answer_lists). Runs in a transaction that is
-- rolled back, so it is safe on any database with the migrations applied,
-- and fails loudly on the first wrong answer:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_review_answer_lists.sql <database>

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
    ('5f1a0c6e-0000-4000-8000-000000000001', 'Lists Check A', 'lists-check-a@example.test'),
    ('5f1a0c6e-0000-4000-8000-0000000000ff', 'Lists Check B', 'lists-check-b@example.test');

-- Wednesday's review, a list prompt and a text one, and Thursday's to-do.
INSERT INTO minerva.reviews (id, user_id, kind, period_start) VALUES
    ('7b3e1d00-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', '2026-09-30'),
    ('7b3e1d00-0000-4000-8000-0000000000ff', '5f1a0c6e-0000-4000-8000-0000000000ff', 'daily', '2026-09-30');
INSERT INTO minerva.review_prompts (id, user_id, kind, section, label, position, style) VALUES
    ('8c4f2e00-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'reflect', 'What went well?', 0, 'list');
INSERT INTO minerva.review_prompts (id, user_id, kind, section, label, position) VALUES
    ('8c4f2e00-0000-4000-8000-000000000002', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'reflect', 'Anything else about today', 1);
INSERT INTO minerva.review_items (id, user_id, review_id, scope, period_start, kind, title, position) VALUES
    ('a1a1a1a1-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001',
     '7b3e1d00-0000-4000-8000-000000000001', 'day', '2026-10-01', 'todo', 'Book the vendor call', 0),
    ('a1a1a1a1-0000-4000-8000-0000000000ff', '5f1a0c6e-0000-4000-8000-0000000000ff',
     '7b3e1d00-0000-4000-8000-0000000000ff', 'day', '2026-10-01', 'todo', 'Theirs', 0);

DO $$
BEGIN
    IF (SELECT style FROM minerva.review_prompts WHERE id = '8c4f2e00-0000-4000-8000-000000000002') <> 'text' THEN
        RAISE EXCEPTION 'a prompt is not text by default';
    END IF;
END;
$$;

SELECT pg_temp.expect_refused('a style that is neither',
    $s$UPDATE minerva.review_prompts SET style = 'essay' WHERE id = '8c4f2e00-0000-4000-8000-000000000001'$s$,
    '23514');

-- Three items for one prompt, in their order; the text answer at 0.
INSERT INTO minerva.review_answers (id, review_id, prompt_id, user_id, kind, body, position) VALUES
    ('9d5a3f00-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000001',
     '8c4f2e00-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'Design review landed', 0),
    ('9d5a3f00-0000-4000-8000-000000000002', '7b3e1d00-0000-4000-8000-000000000001',
     '8c4f2e00-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'Vendor call is overdue', 1),
    ('9d5a3f00-0000-4000-8000-000000000003', '7b3e1d00-0000-4000-8000-000000000001',
     '8c4f2e00-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'Lunch outside', 2),
    ('9d5a3f00-0000-4000-8000-000000000004', '7b3e1d00-0000-4000-8000-000000000001',
     '8c4f2e00-0000-4000-8000-000000000002', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'A long day.', 0);

SELECT pg_temp.expect_refused('a position below 0',
    $s$UPDATE minerva.review_answers SET position = -1 WHERE id = '9d5a3f00-0000-4000-8000-000000000003'$s$,
    '23514');

-- A reorder passes through a shared position and is checked at the end.
SAVEPOINT reorder;
UPDATE minerva.review_answers SET position = 0 WHERE id = '9d5a3f00-0000-4000-8000-000000000003';
UPDATE minerva.review_answers SET position = 2 WHERE id = '9d5a3f00-0000-4000-8000-000000000001';
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;
RELEASE SAVEPOINT reorder;

SAVEPOINT clash;
SELECT pg_temp.expect_refused('two items at one position',
    $s$UPDATE minerva.review_answers SET position = 1 WHERE id = '9d5a3f00-0000-4000-8000-000000000003';
       SET CONSTRAINTS ALL IMMEDIATE$s$,
    '23505');
ROLLBACK TO SAVEPOINT clash;
SET CONSTRAINTS ALL DEFERRED;

-- An item becomes a to-do of its user's, once.
UPDATE minerva.review_answers SET review_item_id = 'a1a1a1a1-0000-4000-8000-000000000001'
WHERE id = '9d5a3f00-0000-4000-8000-000000000002';

SELECT pg_temp.expect_refused('another user''s to-do',
    $s$UPDATE minerva.review_answers SET review_item_id = 'a1a1a1a1-0000-4000-8000-0000000000ff'
       WHERE id = '9d5a3f00-0000-4000-8000-000000000003'$s$,
    '23503');
SELECT pg_temp.expect_refused('two items as one to-do',
    $s$UPDATE minerva.review_answers SET review_item_id = 'a1a1a1a1-0000-4000-8000-000000000001'
       WHERE id = '9d5a3f00-0000-4000-8000-000000000003'$s$,
    '23505');

-- Deleting the to-do keeps the item and clears its link.
DELETE FROM minerva.review_items WHERE id = 'a1a1a1a1-0000-4000-8000-000000000001';
DO $$
DECLARE
    linked uuid;
BEGIN
    SELECT review_item_id INTO STRICT linked FROM minerva.review_answers
    WHERE id = '9d5a3f00-0000-4000-8000-000000000002';
    IF linked IS NOT NULL THEN
        RAISE EXCEPTION 'deleting a to-do left its item linked';
    END IF;
END;
$$;

-- Deleting the review takes its items with it.
DELETE FROM minerva.reviews WHERE id = '7b3e1d00-0000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.review_answers WHERE review_id = '7b3e1d00-0000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'deleting a review left its answers';
    END IF;
END;
$$;

\echo 'minerva_review_answer_lists: all checks passed'
ROLLBACK;
