-- Goal categories, cycles and each user's goals settings (ADR 0026, goals
-- plan phase 2). Each user's own: the API scopes every read and write by
-- the caller, and Hasura grants nothing beyond admin.

-- One row per user who has used Goals. starter_categories_at records that
-- the starter categories were given, so a user who deletes them all is not
-- given them again; the row's primary key makes giving them a one-time
-- thing even when two first requests race.
CREATE TABLE minerva.goal_user_settings (
    user_id uuid NOT NULL,
    starter_categories_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY minerva.goal_user_settings
    ADD CONSTRAINT goal_user_settings_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY minerva.goal_user_settings
    ADD CONSTRAINT goal_user_settings_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TRIGGER set_minerva_goal_user_settings_updated_at BEFORE UPDATE ON minerva.goal_user_settings
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- An area of life a user's goals sit in, with what good looks like there.
CREATE TABLE minerva.goal_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    color text NOT NULL,
    -- One of the icons the model lists (GoalCategoryIcon).
    icon text NOT NULL,
    vision text,
    position integer NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT goal_categories_name_check CHECK (length(btrim(name)) BETWEEN 1 AND 50),
    CONSTRAINT goal_categories_color_check CHECK (color ~ '^#[0-9a-f]{6}$'),
    CONSTRAINT goal_categories_icon_check CHECK (icon IN (
        'heart', 'laptop', 'team', 'wallet', 'book',
        'home', 'star', 'compass', 'trophy', 'smile')),
    CONSTRAINT goal_categories_vision_check CHECK (length(vision) <= 2000)
);

ALTER TABLE ONLY minerva.goal_categories
    ADD CONSTRAINT goal_categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY minerva.goal_categories
    ADD CONSTRAINT goal_categories_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- Deferred, so a reorder can pass through a moment where two categories
-- share a position and be checked only when it commits.
ALTER TABLE ONLY minerva.goal_categories
    ADD CONSTRAINT goal_categories_user_id_position_key UNIQUE (user_id, position)
    DEFERRABLE INITIALLY DEFERRED;

CREATE UNIQUE INDEX goal_categories_user_id_name_key
    ON minerva.goal_categories USING btree (user_id, lower(name));

CREATE TRIGGER set_minerva_goal_categories_updated_at BEFORE UPDATE ON minerva.goal_categories
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- A 12-week cycle (12 Week Year): weeks of execution from a Monday, then
-- buffer weeks before the next. Cycles sit beside calendar quarters; a
-- user's cycles do not overlap, which the API checks.
CREATE TABLE minerva.goal_cycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    start_date date NOT NULL,
    weeks smallint DEFAULT 12 NOT NULL,
    buffer_weeks smallint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT goal_cycles_name_check CHECK (length(btrim(name)) BETWEEN 1 AND 50),
    CONSTRAINT goal_cycles_start_date_check CHECK (extract(isodow FROM start_date) = 1),
    CONSTRAINT goal_cycles_weeks_check CHECK (weeks BETWEEN 1 AND 26),
    CONSTRAINT goal_cycles_buffer_weeks_check CHECK (buffer_weeks BETWEEN 0 AND 2)
);

ALTER TABLE ONLY minerva.goal_cycles
    ADD CONSTRAINT goal_cycles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY minerva.goal_cycles
    ADD CONSTRAINT goal_cycles_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY minerva.goal_cycles
    ADD CONSTRAINT goal_cycles_user_id_start_date_key UNIQUE (user_id, start_date);

CREATE TRIGGER set_minerva_goal_cycles_updated_at BEFORE UPDATE ON minerva.goal_cycles
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();
