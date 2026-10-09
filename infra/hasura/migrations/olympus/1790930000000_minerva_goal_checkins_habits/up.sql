-- Goal check-ins and habit logs (ADR 0026, goals plan phase 4). Each
-- user's own through their goal: the API scopes every read and write by
-- the goal's owner, and Hasura grants nothing beyond admin. Dates are the
-- caller's local days, from the x-ncfritz-tz header.

CREATE TABLE minerva.goal_checkins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal_id uuid NOT NULL,
    checkin_date date NOT NULL,
    value numeric,
    confidence text,
    note text,
    source text DEFAULT 'goal' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT goal_checkins_confidence_check
        CHECK (confidence IN ('on_track', 'at_risk', 'off_track')),
    CONSTRAINT goal_checkins_note_check CHECK (length(note) <= 2000),
    CONSTRAINT goal_checkins_source_check
        CHECK (source IN ('goal', 'daily_review', 'weekly_review')),
    -- A check-in says something: a value, a confidence or both.
    CONSTRAINT goal_checkins_says_check
        CHECK (value IS NOT NULL OR confidence IS NOT NULL)
);

ALTER TABLE ONLY minerva.goal_checkins
    ADD CONSTRAINT goal_checkins_pkey PRIMARY KEY (id);

ALTER TABLE ONLY minerva.goal_checkins
    ADD CONSTRAINT goal_checkins_goal_id_fkey FOREIGN KEY (goal_id)
    REFERENCES minerva.goals(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX goal_checkins_goal_id_checkin_date_idx
    ON minerva.goal_checkins (goal_id, checkin_date DESC, created_at DESC);

CREATE TRIGGER set_minerva_goal_checkins_updated_at BEFORE UPDATE ON minerva.goal_checkins
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

CREATE TABLE minerva.goal_habit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal_id uuid NOT NULL,
    log_date date NOT NULL,
    done boolean DEFAULT false NOT NULL,
    quantity numeric,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT goal_habit_logs_quantity_check CHECK (quantity >= 0),
    CONSTRAINT goal_habit_logs_note_check CHECK (length(note) <= 500),
    -- A log records something: done, or a quantity towards the target.
    CONSTRAINT goal_habit_logs_says_check CHECK (done OR quantity IS NOT NULL)
);

ALTER TABLE ONLY minerva.goal_habit_logs
    ADD CONSTRAINT goal_habit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY minerva.goal_habit_logs
    ADD CONSTRAINT goal_habit_logs_goal_id_fkey FOREIGN KEY (goal_id)
    REFERENCES minerva.goals(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- One log per goal per day: logging a day again is an upsert on this.
ALTER TABLE ONLY minerva.goal_habit_logs
    ADD CONSTRAINT goal_habit_logs_goal_id_log_date_key UNIQUE (goal_id, log_date);

CREATE TRIGGER set_minerva_goal_habit_logs_updated_at BEFORE UPDATE ON minerva.goal_habit_logs
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();
