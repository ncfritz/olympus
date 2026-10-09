-- Goals, their habit rules, milestones and tags (ADR 0026, goals plan
-- phase 3). Each user's own: the API scopes every read and write by the
-- caller, and Hasura grants nothing beyond admin. Progress, pace and
-- health are computed by the API on read, so nothing here caches them.

CREATE TABLE minerva.goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category_id uuid NOT NULL,
    parent_id uuid,
    cycle_id uuid,
    title text NOT NULL,
    why text,
    type text NOT NULL,
    status text DEFAULT 'active' NOT NULL,
    horizon text NOT NULL,
    start_date date NOT NULL,
    -- None only for an ongoing goal.
    due_date date,
    progress_mode text NOT NULL,
    -- How sub-goals combine; only when progress comes from them.
    rollup text,
    -- This goal's weight among its siblings in a weighted rollup.
    weight numeric DEFAULT 1 NOT NULL,
    -- Progress set by hand, 0 to 100; only in manual mode.
    manual_progress smallint,
    position integer NOT NULL,
    -- An outcome goal's measure: from start_value towards target_value,
    -- up or down as the two say.
    unit text,
    start_value numeric,
    target_value numeric,
    -- How far behind pace, in points of the goal's range, still counts as
    -- on track.
    tolerance_pct smallint DEFAULT 10 NOT NULL,
    closed_on date,
    close_note text,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT goals_title_check CHECK (length(btrim(title)) BETWEEN 1 AND 120),
    CONSTRAINT goals_why_check CHECK (length(why) <= 500),
    CONSTRAINT goals_type_check CHECK (type IN ('outcome', 'milestone', 'habit', 'achievement')),
    CONSTRAINT goals_status_check CHECK (status IN ('draft', 'active', 'paused', 'achieved', 'missed', 'dropped')),
    CONSTRAINT goals_horizon_check CHECK (horizon IN ('year', 'quarter', 'cycle', 'custom', 'ongoing')),
    CONSTRAINT goals_progress_mode_check CHECK (
        (type = 'outcome' AND progress_mode IN ('checkins', 'subgoals'))
        OR (type = 'milestone' AND progress_mode IN ('milestones', 'subgoals', 'manual'))
        OR (type = 'habit' AND progress_mode = 'habit')
        OR (type = 'achievement' AND progress_mode = 'status')),
    CONSTRAINT goals_rollup_check CHECK (
        (progress_mode = 'subgoals') = (rollup IS NOT NULL)
        AND (rollup IS NULL OR rollup IN ('average', 'weighted', 'sum'))
        AND (rollup IS DISTINCT FROM 'sum' OR type = 'outcome')),
    CONSTRAINT goals_weight_check CHECK (weight > 0 AND weight <= 1000),
    CONSTRAINT goals_manual_progress_check CHECK (
        (progress_mode = 'manual') = (manual_progress IS NOT NULL)
        AND (manual_progress IS NULL OR manual_progress BETWEEN 0 AND 100)),
    CONSTRAINT goals_outcome_check CHECK (
        (type = 'outcome' AND start_value IS NOT NULL AND target_value IS NOT NULL
            AND start_value <> target_value)
        OR (type <> 'outcome' AND start_value IS NULL AND target_value IS NULL AND unit IS NULL)),
    CONSTRAINT goals_unit_check CHECK (length(btrim(unit)) BETWEEN 1 AND 20),
    CONSTRAINT goals_tolerance_pct_check CHECK (tolerance_pct BETWEEN 1 AND 50),
    CONSTRAINT goals_dates_check CHECK (due_date IS NULL OR due_date >= start_date),
    CONSTRAINT goals_ongoing_check CHECK ((horizon = 'ongoing') = (due_date IS NULL)),
    CONSTRAINT goals_cycle_check CHECK ((horizon = 'cycle') = (cycle_id IS NOT NULL)),
    CONSTRAINT goals_closed_check CHECK (
        (status IN ('achieved', 'missed', 'dropped')) = (closed_on IS NOT NULL)),
    CONSTRAINT goals_close_note_check CHECK (length(close_note) <= 2000),
    CONSTRAINT goals_parent_check CHECK (parent_id <> id)
);

ALTER TABLE ONLY minerva.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY minerva.goals
    ADD CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- A category with goals, deleted or not, cannot be deleted; the API moves
-- them first when asked to.
ALTER TABLE ONLY minerva.goals
    ADD CONSTRAINT goals_category_id_fkey FOREIGN KEY (category_id)
    REFERENCES minerva.goal_categories(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY minerva.goals
    ADD CONSTRAINT goals_parent_id_fkey FOREIGN KEY (parent_id)
    REFERENCES minerva.goals(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- Deleting a cycle makes its goals custom first, in the same mutation.
ALTER TABLE ONLY minerva.goals
    ADD CONSTRAINT goals_cycle_id_fkey FOREIGN KEY (cycle_id)
    REFERENCES minerva.goal_cycles(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX goals_user_id_idx ON minerva.goals USING btree (user_id);
CREATE INDEX goals_category_id_idx ON minerva.goals USING btree (category_id);
CREATE INDEX goals_parent_id_idx ON minerva.goals USING btree (parent_id);
CREATE INDEX goals_cycle_id_idx ON minerva.goals USING btree (cycle_id);

CREATE TRIGGER set_minerva_goals_updated_at BEFORE UPDATE ON minerva.goals
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- A habit goal's schedule. One per habit goal; saving it again updates the
-- row, so its created_at survives.
CREATE TABLE minerva.goal_habit_rules (
    goal_id uuid NOT NULL,
    frequency text NOT NULL,
    times_per_period smallint DEFAULT 1 NOT NULL,
    -- Monday = 1, Tuesday = 2, ... Sunday = 64; only for weekdays.
    weekdays smallint,
    -- A habit counted by quantity: a day counts when it reaches this.
    quantity_target numeric,
    quantity_unit text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT goal_habit_rules_frequency_check CHECK (frequency IN ('daily', 'weekly', 'weekdays', 'monthly')),
    CONSTRAINT goal_habit_rules_times_check CHECK (
        (frequency IN ('daily', 'weekdays') AND times_per_period = 1)
        OR (frequency = 'weekly' AND times_per_period BETWEEN 1 AND 7)
        OR (frequency = 'monthly' AND times_per_period BETWEEN 1 AND 31)),
    CONSTRAINT goal_habit_rules_weekdays_check CHECK (
        (frequency = 'weekdays') = (weekdays IS NOT NULL)
        AND (weekdays IS NULL OR weekdays BETWEEN 1 AND 127)),
    CONSTRAINT goal_habit_rules_quantity_check CHECK (
        (quantity_target IS NULL OR quantity_target > 0)
        AND (quantity_unit IS NULL OR quantity_target IS NOT NULL)
        AND (quantity_unit IS NULL OR length(btrim(quantity_unit)) BETWEEN 1 AND 20))
);

ALTER TABLE ONLY minerva.goal_habit_rules
    ADD CONSTRAINT goal_habit_rules_pkey PRIMARY KEY (goal_id);

ALTER TABLE ONLY minerva.goal_habit_rules
    ADD CONSTRAINT goal_habit_rules_goal_id_fkey FOREIGN KEY (goal_id)
    REFERENCES minerva.goals(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TRIGGER set_minerva_goal_habit_rules_updated_at BEFORE UPDATE ON minerva.goal_habit_rules
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

CREATE TABLE minerva.goal_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal_id uuid NOT NULL,
    title text NOT NULL,
    due_date date,
    weight numeric DEFAULT 1 NOT NULL,
    position integer NOT NULL,
    done_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT goal_milestones_title_check CHECK (length(btrim(title)) BETWEEN 1 AND 120),
    CONSTRAINT goal_milestones_weight_check CHECK (weight > 0 AND weight <= 1000)
);

ALTER TABLE ONLY minerva.goal_milestones
    ADD CONSTRAINT goal_milestones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY minerva.goal_milestones
    ADD CONSTRAINT goal_milestones_goal_id_fkey FOREIGN KEY (goal_id)
    REFERENCES minerva.goals(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- Deferred, so a reorder can pass through a moment where two milestones
-- share a position and be checked only when it commits.
ALTER TABLE ONLY minerva.goal_milestones
    ADD CONSTRAINT goal_milestones_goal_id_position_key UNIQUE (goal_id, position)
    DEFERRABLE INITIALLY DEFERRED;

CREATE TRIGGER set_minerva_goal_milestones_updated_at BEFORE UPDATE ON minerva.goal_milestones
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

CREATE TABLE minerva.goal_tags (
    goal_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY minerva.goal_tags
    ADD CONSTRAINT goal_tags_pkey PRIMARY KEY (goal_id, tag_id);

ALTER TABLE ONLY minerva.goal_tags
    ADD CONSTRAINT goal_tags_goal_id_fkey FOREIGN KEY (goal_id)
    REFERENCES minerva.goals(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY minerva.goal_tags
    ADD CONSTRAINT goal_tags_tag_id_fkey FOREIGN KEY (tag_id)
    REFERENCES minerva.tags(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX goal_tags_tag_id_idx ON minerva.goal_tags USING btree (tag_id);

CREATE TRIGGER set_minerva_goal_tags_updated_at BEFORE UPDATE ON minerva.goal_tags
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();
