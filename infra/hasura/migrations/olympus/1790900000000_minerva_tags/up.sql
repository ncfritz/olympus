-- Minerva's shared tags (ADR 0026, goals plan phase 1). Each user's own:
-- the API scopes every read and write by the caller, and Hasura grants
-- nothing beyond admin. Goals are the first thing tagged (goal_tags, phase
-- 3); notes follow with a join table of their own.

CREATE TABLE minerva.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    -- A hex colour for the tag's chip; none draws the default chip.
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tags_name_check CHECK (length(btrim(name)) BETWEEN 1 AND 50),
    CONSTRAINT tags_color_check CHECK (color ~ '^#[0-9a-f]{6}$')
);

ALTER TABLE ONLY minerva.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);

ALTER TABLE ONLY minerva.tags
    ADD CONSTRAINT tags_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- A user's tag names are unique whatever their case: `Olympus` and
-- `olympus` are one tag.
CREATE UNIQUE INDEX tags_user_id_name_key
    ON minerva.tags USING btree (user_id, lower(name));

CREATE TRIGGER set_minerva_tags_updated_at BEFORE UPDATE ON minerva.tags
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();
