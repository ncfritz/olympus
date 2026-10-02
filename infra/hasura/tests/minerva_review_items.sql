-- Checks for minerva.review_items (migration
-- 1791010000000_minerva_review_items). Runs in a transaction that is rolled
-- back, so it is safe on any database with the migrations applied, and
-- fails loudly on the first wrong answer:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_review_items.sql <database>

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
    ('5f1a0c6e-0000-4000-8000-000000000001', 'Items Check A', 'items-check-a@example.test'),
    ('5f1a0c6e-0000-4000-8000-0000000000ff', 'Items Check B', 'items-check-b@example.test');

INSERT INTO minerva.reviews (id, user_id, kind, period_start) VALUES
    ('7b3e1d00-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', '2026-10-01'),
    ('7b3e1d00-0000-4000-8000-000000000002', '5f1a0c6e-0000-4000-8000-000000000001', 'weekly', '2026-09-28'),
    ('7b3e1d00-0000-4000-8000-0000000000ff', '5f1a0c6e-0000-4000-8000-0000000000ff', 'daily', '2026-10-01');

-- Thursday's review plans Friday: a Top 3 and a to-do, open by default.
INSERT INTO minerva.review_items (id, user_id, review_id, scope, period_start, kind, title, position) VALUES
    ('a1b2c3d4-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001',
     '7b3e1d00-0000-4000-8000-000000000001', 'day', '2026-10-02', 'priority', 'Draft Q4 OKRs', 0),
    ('a1b2c3d4-0000-4000-8000-000000000002', '5f1a0c6e-0000-4000-8000-000000000001',
     '7b3e1d00-0000-4000-8000-000000000001', 'day', '2026-10-02', 'priority', 'Finish history range picker', 1),
    ('a1b2c3d4-0000-4000-8000-000000000003', '5f1a0c6e-0000-4000-8000-000000000001',
     '7b3e1d00-0000-4000-8000-000000000001', 'day', '2026-10-02', 'todo', 'Book dentist', 0);
DO $$
BEGIN
    IF (SELECT status FROM minerva.review_items WHERE id = 'a1b2c3d4-0000-4000-8000-000000000001') <> 'open'
       OR (SELECT carry_count FROM minerva.review_items WHERE id = 'a1b2c3d4-0000-4000-8000-000000000001') <> 0 THEN
        RAISE EXCEPTION 'an item does not start open with no carries';
    END IF;
END;
$$;

SELECT pg_temp.expect_refused('another user''s review',
    $q$INSERT INTO minerva.review_items (user_id, review_id, scope, period_start, kind, title, position) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-0000000000ff', 'day', '2026-10-02', 'todo', 'Not mine', 1)$q$, '23503');
SELECT pg_temp.expect_refused('a week from a Tuesday',
    $q$INSERT INTO minerva.review_items (user_id, review_id, scope, period_start, kind, title, position) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000002', 'week', '2026-10-06', 'priority', 'Hm', 0)$q$, '23514');
SELECT pg_temp.expect_refused('a month',
    $q$INSERT INTO minerva.review_items (user_id, review_id, scope, period_start, kind, title, position) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000001', 'month', '2026-10-01', 'todo', 'Hm', 1)$q$, '23514');
SELECT pg_temp.expect_refused('a goal kind',
    $q$INSERT INTO minerva.review_items (user_id, review_id, scope, period_start, kind, title, position) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000001', 'day', '2026-10-02', 'goal', 'Hm', 1)$q$, '23514');
SELECT pg_temp.expect_refused('a title of only a newline',
    $q$INSERT INTO minerva.review_items (user_id, review_id, scope, period_start, kind, title, position) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000001', 'day', '2026-10-02', 'todo', E'\n', 1)$q$, '23514');
SELECT pg_temp.expect_refused('a 201-character title',
    $q$INSERT INTO minerva.review_items (user_id, review_id, scope, period_start, kind, title, position) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000001', 'day', '2026-10-02', 'todo', repeat('x', 201), 1)$q$, '23514');
SELECT pg_temp.expect_refused('a status not in the list',
    $q$UPDATE minerva.review_items SET status = 'blocked' WHERE id = 'a1b2c3d4-0000-4000-8000-000000000003'$q$, '23514');

-- Done, and only done, records when.
SELECT pg_temp.expect_refused('done with no time',
    $q$UPDATE minerva.review_items SET status = 'done' WHERE id = 'a1b2c3d4-0000-4000-8000-000000000003'$q$, '23514');
SELECT pg_temp.expect_refused('a time while open',
    $q$UPDATE minerva.review_items SET done_at = now() WHERE id = 'a1b2c3d4-0000-4000-8000-000000000003'$q$, '23514');
UPDATE minerva.review_items SET status = 'done', done_at = now() WHERE id = 'a1b2c3d4-0000-4000-8000-000000000003';
UPDATE minerva.review_items SET status = 'open', done_at = NULL WHERE id = 'a1b2c3d4-0000-4000-8000-000000000003';

-- Scheduling: a day item on its day; a week item on a day of its week; a
-- block with both ends, in order, on a day.
UPDATE minerva.review_items SET scheduled_on = '2026-10-02', scheduled_start = '09:00', scheduled_end = '11:00'
    WHERE id = 'a1b2c3d4-0000-4000-8000-000000000001';
SELECT pg_temp.expect_refused('a day item on another day',
    $q$UPDATE minerva.review_items SET scheduled_on = '2026-10-03' WHERE id = 'a1b2c3d4-0000-4000-8000-000000000002'$q$, '23514');
SELECT pg_temp.expect_refused('a block ending before it starts',
    $q$UPDATE minerva.review_items SET scheduled_on = '2026-10-02', scheduled_start = '11:00', scheduled_end = '09:00' WHERE id = 'a1b2c3d4-0000-4000-8000-000000000002'$q$, '23514');
SELECT pg_temp.expect_refused('a block with one end',
    $q$UPDATE minerva.review_items SET scheduled_on = '2026-10-02', scheduled_start = '11:00' WHERE id = 'a1b2c3d4-0000-4000-8000-000000000002'$q$, '23514');
SELECT pg_temp.expect_refused('a block on no day',
    $q$UPDATE minerva.review_items SET scheduled_start = '09:00', scheduled_end = '10:00' WHERE id = 'a1b2c3d4-0000-4000-8000-000000000002'$q$, '23514');
INSERT INTO minerva.review_items (id, user_id, review_id, scope, period_start, kind, title, position, scheduled_on, scheduled_start, scheduled_end)
    VALUES ('a1b2c3d4-0000-4000-8000-000000000010', '5f1a0c6e-0000-4000-8000-000000000001',
            '7b3e1d00-0000-4000-8000-000000000002', 'week', '2026-10-05', 'priority',
            'Finalize Q4 OKRs and share', 0, '2026-10-07', '09:00', '11:00');
SELECT pg_temp.expect_refused('a week item outside its week',
    $q$UPDATE minerva.review_items SET scheduled_on = '2026-10-12' WHERE id = 'a1b2c3d4-0000-4000-8000-000000000010'$q$, '23514');

-- Positions are unique per user, scope, period and kind, checked at
-- commit, so a swap passes through a moment where two items share one.
SAVEPOINT swap;
UPDATE minerva.review_items SET position = 1 WHERE id = 'a1b2c3d4-0000-4000-8000-000000000001';
UPDATE minerva.review_items SET position = 0 WHERE id = 'a1b2c3d4-0000-4000-8000-000000000002';
SET CONSTRAINTS minerva.review_items_user_id_scope_period_start_kind_position_key IMMEDIATE;
RELEASE SAVEPOINT swap;
SET CONSTRAINTS minerva.review_items_user_id_scope_period_start_kind_position_key DEFERRED;
SELECT pg_temp.expect_refused('two items in one position at commit', $q$
    DO $do$
    BEGIN
        UPDATE minerva.review_items SET position = 0
            WHERE id = 'a1b2c3d4-0000-4000-8000-000000000001';
        SET CONSTRAINTS minerva.review_items_user_id_scope_period_start_kind_position_key IMMEDIATE;
    END;
    $do$
$q$, '23505');

-- Carrying: the to-do moves to Saturday, then on to Sunday, each copy
-- counting the carries before it; an item has one copy at most.
INSERT INTO minerva.reviews (id, user_id, kind, period_start) VALUES
    ('7b3e1d00-0000-4000-8000-000000000003', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', '2026-10-02'),
    ('7b3e1d00-0000-4000-8000-000000000004', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', '2026-10-03');
UPDATE minerva.review_items SET status = 'carried' WHERE id = 'a1b2c3d4-0000-4000-8000-000000000003';
INSERT INTO minerva.review_items (id, user_id, review_id, scope, period_start, kind, title, position, carried_from_id, carry_count)
    VALUES ('a1b2c3d4-0000-4000-8000-000000000004', '5f1a0c6e-0000-4000-8000-000000000001',
            '7b3e1d00-0000-4000-8000-000000000003', 'day', '2026-10-03', 'todo', 'Book dentist', 0,
            'a1b2c3d4-0000-4000-8000-000000000003', 1);
UPDATE minerva.review_items SET status = 'carried' WHERE id = 'a1b2c3d4-0000-4000-8000-000000000004';
INSERT INTO minerva.review_items (id, user_id, review_id, scope, period_start, kind, title, position, carried_from_id, carry_count)
    VALUES ('a1b2c3d4-0000-4000-8000-000000000005', '5f1a0c6e-0000-4000-8000-000000000001',
            '7b3e1d00-0000-4000-8000-000000000004', 'day', '2026-10-04', 'todo', 'Book dentist', 0,
            'a1b2c3d4-0000-4000-8000-000000000004', 2);
SELECT pg_temp.expect_refused('a second copy of one item',
    $q$INSERT INTO minerva.review_items (user_id, review_id, scope, period_start, kind, title, position, carried_from_id, carry_count) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000003', 'day', '2026-10-03', 'todo', 'Book dentist', 1, 'a1b2c3d4-0000-4000-8000-000000000003', 1)$q$, '23505');
SELECT pg_temp.expect_refused('a negative carry count',
    $q$UPDATE minerva.review_items SET carry_count = -1 WHERE id = 'a1b2c3d4-0000-4000-8000-000000000005'$q$, '23514');

-- Audit times: an update moves updated_at and leaves created_at.
UPDATE minerva.review_items SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.review_items SET title = title || '!';
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM minerva.review_items
            WHERE created_at <> '2026-01-01T00:00:00Z' OR updated_at <= '2026-01-01T00:00:00Z'
    ) THEN
        RAISE EXCEPTION 'an update did not keep created_at and move updated_at';
    END IF;
END;
$$;

-- A review takes the items it planned; an item carried out of it keeps its
-- copy, which forgets where it came from but keeps its count.
DELETE FROM minerva.reviews WHERE id = '7b3e1d00-0000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.review_items WHERE review_id = '7b3e1d00-0000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'items outlived the review that planned them';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM minerva.review_items
            WHERE id = 'a1b2c3d4-0000-4000-8000-000000000004'
              AND carried_from_id IS NULL AND carry_count = 1
    ) THEN
        RAISE EXCEPTION 'a copy did not outlive what it was carried from';
    END IF;
END;
$$;

-- Everything goes with its user, and only theirs.
INSERT INTO minerva.review_items (user_id, review_id, scope, period_start, kind, title, position)
    VALUES ('5f1a0c6e-0000-4000-8000-0000000000ff', '7b3e1d00-0000-4000-8000-0000000000ff', 'day', '2026-10-02', 'todo', 'Theirs', 0);
DELETE FROM olympus.users WHERE id = '5f1a0c6e-0000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.review_items WHERE user_id = '5f1a0c6e-0000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'items outlived their user';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM minerva.review_items WHERE user_id = '5f1a0c6e-0000-4000-8000-0000000000ff') THEN
        RAISE EXCEPTION 'another user''s items went with them';
    END IF;
END;
$$;

ROLLBACK;
