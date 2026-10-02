-- Checks for minerva.review_user_settings, reviews, review_prompts and
-- review_answers (migration 1791000000000_minerva_reviews). Runs in a
-- transaction that is rolled back, so it is safe on any database with the
-- migrations applied, and fails loudly on the first wrong answer:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_reviews.sql <database>

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
    ('5f1a0c6e-0000-4000-8000-000000000001', 'Reviews Check A', 'reviews-check-a@example.test'),
    ('5f1a0c6e-0000-4000-8000-0000000000ff', 'Reviews Check B', 'reviews-check-b@example.test');

-- Settings: one row per user.
INSERT INTO minerva.review_user_settings (user_id, starter_prompts_at)
    VALUES ('5f1a0c6e-0000-4000-8000-000000000001', now());
SELECT pg_temp.expect_refused('a second settings row',
    $q$INSERT INTO minerva.review_user_settings (user_id) VALUES ('5f1a0c6e-0000-4000-8000-000000000001')$q$, '23505');

-- Reviews: one per user, kind and period; a week starts on a Monday.
INSERT INTO minerva.reviews (id, user_id, kind, period_start, overall, focus) VALUES
    ('7b3e1d00-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', '2026-10-01', 4, 2),
    ('7b3e1d00-0000-4000-8000-000000000002', '5f1a0c6e-0000-4000-8000-000000000001', 'weekly', '2026-09-28', NULL, NULL);
-- A day and the week it starts can both be reviewed, and another user may
-- review the same day.
INSERT INTO minerva.reviews (user_id, kind, period_start) VALUES
    ('5f1a0c6e-0000-4000-8000-000000000001', 'daily', '2026-09-28'),
    ('5f1a0c6e-0000-4000-8000-0000000000ff', 'daily', '2026-10-01');
DO $$
BEGIN
    IF (SELECT step FROM minerva.reviews WHERE id = '7b3e1d00-0000-4000-8000-000000000001') <> 1 THEN
        RAISE EXCEPTION 'a review does not start at step 1';
    END IF;
END;
$$;
SELECT pg_temp.expect_refused('a second review of the day',
    $q$INSERT INTO minerva.reviews (user_id, kind, period_start) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'daily', '2026-10-01')$q$, '23505');
SELECT pg_temp.expect_refused('a week from a Tuesday',
    $q$INSERT INTO minerva.reviews (user_id, kind, period_start) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'weekly', '2026-09-29')$q$, '23514');
SELECT pg_temp.expect_refused('a monthly review',
    $q$INSERT INTO minerva.reviews (user_id, kind, period_start) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'monthly', '2026-10-01')$q$, '23514');
SELECT pg_temp.expect_refused('step 5 of a day',
    $q$UPDATE minerva.reviews SET step = 5 WHERE id = '7b3e1d00-0000-4000-8000-000000000001'$q$, '23514');
SELECT pg_temp.expect_refused('step 0',
    $q$UPDATE minerva.reviews SET step = 0 WHERE id = '7b3e1d00-0000-4000-8000-000000000002'$q$, '23514');
UPDATE minerva.reviews SET step = 5 WHERE id = '7b3e1d00-0000-4000-8000-000000000002';
SELECT pg_temp.expect_refused('an overall of 6',
    $q$UPDATE minerva.reviews SET overall = 6 WHERE id = '7b3e1d00-0000-4000-8000-000000000001'$q$, '23514');
SELECT pg_temp.expect_refused('a focus of 0',
    $q$UPDATE minerva.reviews SET focus = 0 WHERE id = '7b3e1d00-0000-4000-8000-000000000001'$q$, '23514');
-- Halves are ratings too (migration 1791040000000_minerva_review_half_ratings);
-- quarters and anything under a half are not.
UPDATE minerva.reviews SET focus = 3.5 WHERE id = '7b3e1d00-0000-4000-8000-000000000001';
UPDATE minerva.reviews SET focus = 0.5 WHERE id = '7b3e1d00-0000-4000-8000-000000000001';
SELECT pg_temp.expect_refused('a focus of 2.25',
    $q$UPDATE minerva.reviews SET focus = 2.25 WHERE id = '7b3e1d00-0000-4000-8000-000000000001'$q$, '23514');
SELECT pg_temp.expect_refused('a focus of 0.4',
    $q$UPDATE minerva.reviews SET focus = 0.4 WHERE id = '7b3e1d00-0000-4000-8000-000000000001'$q$, '23514');
SELECT pg_temp.expect_refused('an overall of 5.5',
    $q$UPDATE minerva.reviews SET overall = 5.5 WHERE id = '7b3e1d00-0000-4000-8000-000000000001'$q$, '23514');
SELECT pg_temp.expect_refused('progress on a day',
    $q$UPDATE minerva.reviews SET progress = 3 WHERE id = '7b3e1d00-0000-4000-8000-000000000001'$q$, '23514');
SELECT pg_temp.expect_refused('mood on a week',
    $q$UPDATE minerva.reviews SET mood = 3 WHERE id = '7b3e1d00-0000-4000-8000-000000000002'$q$, '23514');
UPDATE minerva.reviews SET progress = 4, balance = 2, overall = 4
    WHERE id = '7b3e1d00-0000-4000-8000-000000000002';

-- Prompts.
INSERT INTO minerva.review_prompts (id, user_id, kind, section, label, position) VALUES
    ('8c4f2e00-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'reflect', 'What went well?', 0),
    ('8c4f2e00-0000-4000-8000-000000000002', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'reflect', 'What didn''t go well?', 1),
    ('8c4f2e00-0000-4000-8000-000000000003', '5f1a0c6e-0000-4000-8000-000000000001', 'weekly', 'reflect', 'Biggest win', 0),
    ('8c4f2e00-0000-4000-8000-000000000004', '5f1a0c6e-0000-4000-8000-0000000000ff', 'daily', 'reflect', 'What went well?', 0);
-- Positions count within a kind and section.
INSERT INTO minerva.review_prompts (user_id, kind, section, label, position)
    VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'plan', 'Thoughts for tomorrow', 0);
SELECT pg_temp.expect_refused('a blank label',
    $q$INSERT INTO minerva.review_prompts (user_id, kind, section, label, position) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'plan', '   ', 1)$q$, '23514');
SELECT pg_temp.expect_refused('a label of only a newline',
    $q$INSERT INTO minerva.review_prompts (user_id, kind, section, label, position) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'plan', E'\n', 1)$q$, '23514');
SELECT pg_temp.expect_refused('a 121-character label',
    $q$INSERT INTO minerva.review_prompts (user_id, kind, section, label, position) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'plan', repeat('x', 121), 1)$q$, '23514');
SELECT pg_temp.expect_refused('a section not in the list',
    $q$INSERT INTO minerva.review_prompts (user_id, kind, section, label, position) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'look_back', 'Hm', 1)$q$, '23514');
SELECT pg_temp.expect_refused('a 201-character placeholder',
    $q$INSERT INTO minerva.review_prompts (user_id, kind, section, label, placeholder, position) VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'plan', 'Hm', repeat('x', 201), 1)$q$, '23514');

-- Positions are unique per user, kind and section, checked at commit, so a
-- swap passes through a moment where two prompts share one.
SAVEPOINT swap;
UPDATE minerva.review_prompts SET position = 1 WHERE id = '8c4f2e00-0000-4000-8000-000000000001';
UPDATE minerva.review_prompts SET position = 0 WHERE id = '8c4f2e00-0000-4000-8000-000000000002';
SET CONSTRAINTS minerva.review_prompts_user_id_kind_section_position_key IMMEDIATE;
RELEASE SAVEPOINT swap;
SET CONSTRAINTS minerva.review_prompts_user_id_kind_section_position_key DEFERRED;
SELECT pg_temp.expect_refused('two prompts in one position at commit', $q$
    DO $do$
    BEGIN
        UPDATE minerva.review_prompts SET position = 0
            WHERE id = '8c4f2e00-0000-4000-8000-000000000001';
        SET CONSTRAINTS minerva.review_prompts_user_id_kind_section_position_key IMMEDIATE;
    END;
    $do$
$q$, '23505');

-- Answers: one per review and prompt, to a prompt of the review's user and
-- kind.
INSERT INTO minerva.review_answers (id, review_id, prompt_id, user_id, kind, body) VALUES
    ('9d5a3f00-0000-4000-8000-000000000001', '7b3e1d00-0000-4000-8000-000000000001',
     '8c4f2e00-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'daily',
     'Design review landed.'),
    ('9d5a3f00-0000-4000-8000-000000000002', '7b3e1d00-0000-4000-8000-000000000002',
     '8c4f2e00-0000-4000-8000-000000000003', '5f1a0c6e-0000-4000-8000-000000000001', 'weekly',
     'Weather station views shipped.');
-- A prompt can hold several answers, as a list's items, each at its own
-- position (migration 1791030000000_minerva_review_answer_lists).
SELECT pg_temp.expect_refused('a second answer at the same position',
    $q$INSERT INTO minerva.review_answers (review_id, prompt_id, user_id, kind, body) VALUES ('7b3e1d00-0000-4000-8000-000000000001', '8c4f2e00-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'Again');
       SET CONSTRAINTS ALL IMMEDIATE$q$, '23505');
SET CONSTRAINTS ALL DEFERRED;
SELECT pg_temp.expect_refused('a weekly prompt on a daily review',
    $q$INSERT INTO minerva.review_answers (review_id, prompt_id, user_id, kind, body) VALUES ('7b3e1d00-0000-4000-8000-000000000001', '8c4f2e00-0000-4000-8000-000000000003', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'Wrong kind')$q$, '23503');
SELECT pg_temp.expect_refused('another user''s prompt',
    $q$INSERT INTO minerva.review_answers (review_id, prompt_id, user_id, kind, body) VALUES ('7b3e1d00-0000-4000-8000-000000000001', '8c4f2e00-0000-4000-8000-000000000004', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', 'Not mine')$q$, '23503');
SELECT pg_temp.expect_refused('an answer claiming another user',
    $q$INSERT INTO minerva.review_answers (review_id, prompt_id, user_id, kind, body) VALUES ('7b3e1d00-0000-4000-8000-000000000001', '8c4f2e00-0000-4000-8000-000000000002', '5f1a0c6e-0000-4000-8000-0000000000ff', 'daily', 'Spoofed')$q$, '23503');
SELECT pg_temp.expect_refused('a blank answer',
    $q$INSERT INTO minerva.review_answers (review_id, prompt_id, user_id, kind, body) VALUES ('7b3e1d00-0000-4000-8000-000000000001', '8c4f2e00-0000-4000-8000-000000000002', '5f1a0c6e-0000-4000-8000-000000000001', 'daily', E' \n\t ')$q$, '23514');

-- An answered prompt is archived, not deleted; an unanswered one deletes.
SELECT pg_temp.expect_refused('deleting an answered prompt',
    $q$DELETE FROM minerva.review_prompts WHERE id = '8c4f2e00-0000-4000-8000-000000000001'$q$, '23503');
DELETE FROM minerva.review_prompts WHERE id = '8c4f2e00-0000-4000-8000-000000000002';

-- An answer saved again keeps its row and created_at: the API rewrites
-- it in place.
UPDATE minerva.review_answers SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.review_answers SET body = 'Design review landed; ADR merged.'
    WHERE id = '9d5a3f00-0000-4000-8000-000000000001';
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM minerva.review_answers
            WHERE id = '9d5a3f00-0000-4000-8000-000000000001'
              AND body = 'Design review landed; ADR merged.'
              AND created_at = '2026-01-01T00:00:00Z'
              AND updated_at > '2026-01-01T00:00:00Z'
    ) THEN
        RAISE EXCEPTION 'an answer saved again did not keep its row and created_at';
    END IF;
END;
$$;

-- Audit times: an update moves updated_at and leaves created_at, on every
-- table.
UPDATE minerva.review_user_settings SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.reviews SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.review_prompts SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.review_answers SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.review_user_settings SET starter_prompts_at = now();
UPDATE minerva.reviews SET completed_at = now();
UPDATE minerva.review_prompts SET archived_at = now();
UPDATE minerva.review_answers SET body = body || '!';
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM minerva.review_user_settings
            WHERE created_at <> '2026-01-01T00:00:00Z' OR updated_at <= '2026-01-01T00:00:00Z'
        UNION ALL
        SELECT 1 FROM minerva.reviews
            WHERE created_at <> '2026-01-01T00:00:00Z' OR updated_at <= '2026-01-01T00:00:00Z'
        UNION ALL
        SELECT 1 FROM minerva.review_prompts
            WHERE created_at <> '2026-01-01T00:00:00Z' OR updated_at <= '2026-01-01T00:00:00Z'
        UNION ALL
        SELECT 1 FROM minerva.review_answers
            WHERE created_at <> '2026-01-01T00:00:00Z' OR updated_at <= '2026-01-01T00:00:00Z'
    ) THEN
        RAISE EXCEPTION 'an update did not keep created_at and move updated_at';
    END IF;
END;
$$;

-- A review takes its answers with it.
DELETE FROM minerva.reviews WHERE id = '7b3e1d00-0000-4000-8000-000000000002';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.review_answers WHERE review_id = '7b3e1d00-0000-4000-8000-000000000002') THEN
        RAISE EXCEPTION 'answers outlived their review';
    END IF;
END;
$$;

-- Everything goes with its user, answered prompts included, and only theirs.
DELETE FROM olympus.users WHERE id = '5f1a0c6e-0000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.review_user_settings WHERE user_id = '5f1a0c6e-0000-4000-8000-000000000001')
       OR EXISTS (SELECT 1 FROM minerva.reviews WHERE user_id = '5f1a0c6e-0000-4000-8000-000000000001')
       OR EXISTS (SELECT 1 FROM minerva.review_prompts WHERE user_id = '5f1a0c6e-0000-4000-8000-000000000001')
       OR EXISTS (SELECT 1 FROM minerva.review_answers WHERE user_id = '5f1a0c6e-0000-4000-8000-000000000001') THEN
        RAISE EXCEPTION 'review rows outlived their user';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM minerva.reviews WHERE user_id = '5f1a0c6e-0000-4000-8000-0000000000ff')
       OR NOT EXISTS (SELECT 1 FROM minerva.review_prompts WHERE user_id = '5f1a0c6e-0000-4000-8000-0000000000ff') THEN
        RAISE EXCEPTION 'another user''s reviews went with them';
    END IF;
END;
$$;

ROLLBACK;
