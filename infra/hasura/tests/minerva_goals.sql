-- Checks for minerva.goals, goal_habit_rules, goal_milestones and
-- goal_tags (migration 1790920000000_minerva_goals). Runs in a transaction
-- that is rolled back, so it is safe on any database with the migrations
-- applied, and fails loudly on the first wrong answer:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_goals.sql <database>

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

-- A goal from a JSON object of its columns, the defaults filled in: the
-- checks below change one thing at a time.
CREATE FUNCTION pg_temp.goal(changes jsonb) RETURNS text LANGUAGE sql AS $$
    SELECT format(
        'INSERT INTO minerva.goals SELECT * FROM jsonb_populate_record(NULL::minerva.goals, %L)',
        jsonb_build_object(
            'id', gen_random_uuid(),
            'user_id', '5f1a0c6e-0000-4000-8000-000000000001',
            'category_id', '6a2d9e40-0000-4000-8000-000000000001',
            'title', 'A goal', 'type', 'milestone', 'status', 'active',
            'horizon', 'custom', 'start_date', '2026-01-01', 'due_date', '2026-12-31',
            'progress_mode', 'milestones', 'weight', 1, 'position', 0,
            'tolerance_pct', 10, 'created_at', now(), 'updated_at', now()
        ) || changes)
$$;

INSERT INTO olympus.users (id, display_name, email) VALUES
    ('5f1a0c6e-0000-4000-8000-000000000001', 'Goals Check', 'goals-check@example.test');
INSERT INTO minerva.goal_categories (id, user_id, name, color, icon, position) VALUES
    ('6a2d9e40-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'Learning', '#722ed1', 'book', 0);
INSERT INTO minerva.goal_cycles (id, user_id, name, start_date) VALUES
    ('2e7b4c90-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'Cycle 4', '2026-09-07');
INSERT INTO minerva.tags (id, user_id, name) VALUES
    ('4c8e1f20-0000-4000-8000-000000000001', '5f1a0c6e-0000-4000-8000-000000000001', 'reading');

-- The defaults make a valid goal, and each kind of goal can be made.
DO $$ BEGIN EXECUTE pg_temp.goal('{"id": "9b1c0000-0000-4000-8000-000000000001"}'); END $$;
DO $$ BEGIN EXECUTE pg_temp.goal('{"id": "9b1c0000-0000-4000-8000-000000000002", "type": "outcome", "progress_mode": "checkins", "unit": "books", "start_value": 0, "target_value": 24}'); END $$;
DO $$ BEGIN EXECUTE pg_temp.goal('{"id": "9b1c0000-0000-4000-8000-000000000003", "type": "habit", "progress_mode": "habit", "horizon": "ongoing", "due_date": null}'); END $$;
DO $$ BEGIN EXECUTE pg_temp.goal('{"id": "9b1c0000-0000-4000-8000-000000000004", "type": "achievement", "progress_mode": "status"}'); END $$;
DO $$ BEGIN EXECUTE pg_temp.goal('{"id": "9b1c0000-0000-4000-8000-000000000005", "horizon": "cycle", "cycle_id": "2e7b4c90-0000-4000-8000-000000000001", "parent_id": "9b1c0000-0000-4000-8000-000000000001", "progress_mode": "subgoals", "rollup": "weighted"}'); END $$;
DO $$ BEGIN EXECUTE pg_temp.goal('{"id": "9b1c0000-0000-4000-8000-000000000006", "progress_mode": "manual", "manual_progress": 40}'); END $$;
DO $$ BEGIN EXECUTE pg_temp.goal('{"id": "9b1c0000-0000-4000-8000-000000000007", "status": "missed", "closed_on": "2026-09-30"}'); END $$;

-- Each rule, broken once.
SELECT pg_temp.expect_refused('an unknown type', pg_temp.goal('{"type": "dream"}'), '23514');
SELECT pg_temp.expect_refused('an unknown status', pg_temp.goal('{"status": "done"}'), '23514');
SELECT pg_temp.expect_refused('a blank title', pg_temp.goal('{"title": "  "}'), '23514');
SELECT pg_temp.expect_refused('a progress mode the type does not allow', pg_temp.goal('{"progress_mode": "checkins"}'), '23514');
SELECT pg_temp.expect_refused('a habit not in habit mode', pg_temp.goal('{"type": "habit", "progress_mode": "manual", "manual_progress": 5}'), '23514');
SELECT pg_temp.expect_refused('an outcome without a target', pg_temp.goal('{"type": "outcome", "progress_mode": "checkins", "start_value": 0}'), '23514');
SELECT pg_temp.expect_refused('an outcome whose target is its start', pg_temp.goal('{"type": "outcome", "progress_mode": "checkins", "start_value": 5, "target_value": 5}'), '23514');
SELECT pg_temp.expect_refused('a unit on a milestone goal', pg_temp.goal('{"unit": "books"}'), '23514');
SELECT pg_temp.expect_refused('sub-goals without a rollup', pg_temp.goal('{"progress_mode": "subgoals"}'), '23514');
SELECT pg_temp.expect_refused('a rollup without sub-goals', pg_temp.goal('{"rollup": "average"}'), '23514');
SELECT pg_temp.expect_refused('a sum rollup on a milestone goal', pg_temp.goal('{"progress_mode": "subgoals", "rollup": "sum"}'), '23514');
SELECT pg_temp.expect_refused('manual mode without progress', pg_temp.goal('{"progress_mode": "manual"}'), '23514');
SELECT pg_temp.expect_refused('manual progress over 100', pg_temp.goal('{"progress_mode": "manual", "manual_progress": 101}'), '23514');
SELECT pg_temp.expect_refused('manual progress outside manual mode', pg_temp.goal('{"manual_progress": 50}'), '23514');
SELECT pg_temp.expect_refused('due before it starts', pg_temp.goal('{"due_date": "2025-12-31"}'), '23514');
SELECT pg_temp.expect_refused('ongoing with a due date', pg_temp.goal('{"horizon": "ongoing"}'), '23514');
SELECT pg_temp.expect_refused('no due date and not ongoing', pg_temp.goal('{"due_date": null}'), '23514');
SELECT pg_temp.expect_refused('a cycle horizon without a cycle', pg_temp.goal('{"horizon": "cycle"}'), '23514');
SELECT pg_temp.expect_refused('a cycle on a custom goal', pg_temp.goal('{"cycle_id": "2e7b4c90-0000-4000-8000-000000000001"}'), '23514');
SELECT pg_temp.expect_refused('closed without a date', pg_temp.goal('{"status": "achieved"}'), '23514');
SELECT pg_temp.expect_refused('a closing date while active', pg_temp.goal('{"closed_on": "2026-09-30"}'), '23514');
SELECT pg_temp.expect_refused('a weight of 0', pg_temp.goal('{"weight": 0}'), '23514');
SELECT pg_temp.expect_refused('a tolerance of 60', pg_temp.goal('{"tolerance_pct": 60}'), '23514');
SELECT pg_temp.expect_refused('its own parent',
    $q$UPDATE minerva.goals SET parent_id = id WHERE id = '9b1c0000-0000-4000-8000-000000000001'$q$, '23514');
SELECT pg_temp.expect_refused('a parent that does not exist', pg_temp.goal('{"parent_id": "9b1c0000-0000-4000-8000-0000000000ff"}'), '23503');

-- What may not be deleted from under goals.
SELECT pg_temp.expect_refused('deleting a goal with a sub-goal',
    $q$DELETE FROM minerva.goals WHERE id = '9b1c0000-0000-4000-8000-000000000001'$q$, '23503');
SELECT pg_temp.expect_refused('deleting a category with goals',
    $q$DELETE FROM minerva.goal_categories WHERE id = '6a2d9e40-0000-4000-8000-000000000001'$q$, '23503');
SELECT pg_temp.expect_refused('deleting a cycle with goals',
    $q$DELETE FROM minerva.goal_cycles WHERE id = '2e7b4c90-0000-4000-8000-000000000001'$q$, '23503');

-- Habit rules.
INSERT INTO minerva.goal_habit_rules (goal_id, frequency, times_per_period)
    VALUES ('9b1c0000-0000-4000-8000-000000000003', 'weekly', 3);
SELECT pg_temp.expect_refused('a second rule for a goal',
    $q$INSERT INTO minerva.goal_habit_rules (goal_id, frequency) VALUES ('9b1c0000-0000-4000-8000-000000000003', 'daily')$q$, '23505');
SELECT pg_temp.expect_refused('twice a day',
    $q$INSERT INTO minerva.goal_habit_rules (goal_id, frequency, times_per_period) VALUES ('9b1c0000-0000-4000-8000-000000000004', 'daily', 2)$q$, '23514');
SELECT pg_temp.expect_refused('eight times a week',
    $q$INSERT INTO minerva.goal_habit_rules (goal_id, frequency, times_per_period) VALUES ('9b1c0000-0000-4000-8000-000000000004', 'weekly', 8)$q$, '23514');
SELECT pg_temp.expect_refused('weekdays without days',
    $q$INSERT INTO minerva.goal_habit_rules (goal_id, frequency) VALUES ('9b1c0000-0000-4000-8000-000000000004', 'weekdays')$q$, '23514');
SELECT pg_temp.expect_refused('days on a daily habit',
    $q$INSERT INTO minerva.goal_habit_rules (goal_id, frequency, weekdays) VALUES ('9b1c0000-0000-4000-8000-000000000004', 'daily', 21)$q$, '23514');
SELECT pg_temp.expect_refused('a day mask past Sunday',
    $q$INSERT INTO minerva.goal_habit_rules (goal_id, frequency, weekdays) VALUES ('9b1c0000-0000-4000-8000-000000000004', 'weekdays', 128)$q$, '23514');
SELECT pg_temp.expect_refused('a unit without a quantity',
    $q$INSERT INTO minerva.goal_habit_rules (goal_id, frequency, quantity_unit) VALUES ('9b1c0000-0000-4000-8000-000000000004', 'daily', 'steps')$q$, '23514');

-- Milestones: positions unique per goal at commit.
INSERT INTO minerva.goal_milestones (id, goal_id, title, position) VALUES
    ('8c3d0000-0000-4000-8000-000000000001', '9b1c0000-0000-4000-8000-000000000001', 'Model', 0),
    ('8c3d0000-0000-4000-8000-000000000002', '9b1c0000-0000-4000-8000-000000000001', 'UI', 1);
UPDATE minerva.goal_milestones SET position = 1 WHERE id = '8c3d0000-0000-4000-8000-000000000001';
UPDATE minerva.goal_milestones SET position = 0 WHERE id = '8c3d0000-0000-4000-8000-000000000002';
SET CONSTRAINTS minerva.goal_milestones_goal_id_position_key IMMEDIATE;
SET CONSTRAINTS minerva.goal_milestones_goal_id_position_key DEFERRED;
SELECT pg_temp.expect_refused('a milestone weight of 0',
    $q$INSERT INTO minerva.goal_milestones (goal_id, title, position, weight) VALUES ('9b1c0000-0000-4000-8000-000000000001', 'Zero', 2, 0)$q$, '23514');

-- Tags: once per goal.
INSERT INTO minerva.goal_tags (goal_id, tag_id)
    VALUES ('9b1c0000-0000-4000-8000-000000000002', '4c8e1f20-0000-4000-8000-000000000001');
SELECT pg_temp.expect_refused('the same tag twice on a goal',
    $q$INSERT INTO minerva.goal_tags (goal_id, tag_id) VALUES ('9b1c0000-0000-4000-8000-000000000002', '4c8e1f20-0000-4000-8000-000000000001')$q$, '23505');

-- Audit times: an update moves updated_at and leaves created_at, on every
-- table.
UPDATE minerva.goals SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.goal_habit_rules SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.goal_milestones SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.goal_tags SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z';
UPDATE minerva.goals SET why = 'Because.';
UPDATE minerva.goal_habit_rules SET times_per_period = 4;
UPDATE minerva.goal_milestones SET done_at = now();
UPDATE minerva.goal_tags SET tag_id = tag_id;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM minerva.goals WHERE created_at <> '2026-01-01T00:00:00Z' OR updated_at <= '2026-01-01T00:00:00Z'
        UNION ALL SELECT 1 FROM minerva.goal_habit_rules WHERE created_at <> '2026-01-01T00:00:00Z' OR updated_at <= '2026-01-01T00:00:00Z'
        UNION ALL SELECT 1 FROM minerva.goal_milestones WHERE created_at <> '2026-01-01T00:00:00Z' OR updated_at <= '2026-01-01T00:00:00Z'
        UNION ALL SELECT 1 FROM minerva.goal_tags WHERE created_at <> '2026-01-01T00:00:00Z' OR updated_at <= '2026-01-01T00:00:00Z'
    ) THEN
        RAISE EXCEPTION 'an update did not keep created_at and move updated_at';
    END IF;
END;
$$;

-- A goal's rule, milestones and tags go with it; deleting a tag takes it
-- off its goals.
DELETE FROM minerva.tags WHERE id = '4c8e1f20-0000-4000-8000-000000000001';
DELETE FROM minerva.goal_milestones WHERE goal_id = '9b1c0000-0000-4000-8000-000000000001';
DELETE FROM minerva.goals WHERE id = '9b1c0000-0000-4000-8000-000000000005';
DELETE FROM minerva.goals WHERE id = '9b1c0000-0000-4000-8000-000000000003';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.goal_tags)
       OR EXISTS (SELECT 1 FROM minerva.goal_habit_rules) THEN
        RAISE EXCEPTION 'rows outlived their goal or tag';
    END IF;
END;
$$;

-- And everything goes with its user.
DELETE FROM olympus.users WHERE id = '5f1a0c6e-0000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.goals) THEN
        RAISE EXCEPTION 'goals outlived their user';
    END IF;
END;
$$;

ROLLBACK;
