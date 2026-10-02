-- Reviews, their prompts and answers, and each user's review settings
-- (ADR 0027, activity review plan phase 1). Each user's own: the API scopes
-- every read and write by the caller, and Hasura grants nothing beyond
-- admin.

-- One row per user who has used the reviews. starter_prompts_at records
-- that the starter prompts were given, so a user who deletes them all is
-- not given them again; the primary key makes giving them a one-time thing
-- even when two first requests race.
CREATE TABLE minerva.review_user_settings (
    user_id uuid NOT NULL,
    starter_prompts_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY minerva.review_user_settings
    ADD CONSTRAINT review_user_settings_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY minerva.review_user_settings
    ADD CONSTRAINT review_user_settings_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TRIGGER set_minerva_review_user_settings_updated_at BEFORE UPDATE ON minerva.review_user_settings
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- A daily or weekly review: the day, or the ISO week from its Monday, and
-- what its author scored. What was written lives in review_answers; what
-- happened is read from the features that own it, not copied here.
CREATE TABLE minerva.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    period_start date NOT NULL,
    -- The guided step the author reached: 1 to 4 for a day, 1 to 5 for a week.
    step smallint DEFAULT 1 NOT NULL,
    overall smallint,
    mood smallint,
    energy smallint,
    focus smallint,
    progress smallint,
    balance smallint,
    -- Set once, when the review is completed; its ratings are locked from
    -- then on, which the API enforces.
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_kind_check CHECK (kind IN ('daily', 'weekly')),
    CONSTRAINT reviews_period_start_check CHECK (
        kind = 'daily' OR extract(isodow FROM period_start) = 1),
    CONSTRAINT reviews_step_check CHECK (
        step >= 1 AND step <= CASE kind WHEN 'daily' THEN 4 ELSE 5 END),
    CONSTRAINT reviews_ratings_range_check CHECK (
        overall BETWEEN 1 AND 5 AND mood BETWEEN 1 AND 5
        AND energy BETWEEN 1 AND 5 AND focus BETWEEN 1 AND 5
        AND progress BETWEEN 1 AND 5 AND balance BETWEEN 1 AND 5),
    -- Mood, energy and focus are a day's; progress and balance a week's.
    CONSTRAINT reviews_ratings_kind_check CHECK (
        (kind = 'daily' AND progress IS NULL AND balance IS NULL)
        OR (kind = 'weekly' AND mood IS NULL AND energy IS NULL AND focus IS NULL))
);

ALTER TABLE ONLY minerva.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);

ALTER TABLE ONLY minerva.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY minerva.reviews
    ADD CONSTRAINT reviews_user_id_kind_period_start_key UNIQUE (user_id, kind, period_start);

-- For review_answers' foreign key, which holds an answer to its review's
-- user and kind.
ALTER TABLE ONLY minerva.reviews
    ADD CONSTRAINT reviews_id_user_id_kind_key UNIQUE (id, user_id, kind);

CREATE TRIGGER set_minerva_reviews_updated_at BEFORE UPDATE ON minerva.reviews
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- A question a user's reviews of one kind ask, in the Reflect or Plan step.
-- One with answers is archived rather than deleted, so old reviews keep
-- their questions.
CREATE TABLE minerva.review_prompts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    section text NOT NULL,
    label text NOT NULL,
    placeholder text,
    position integer NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_prompts_kind_check CHECK (kind IN ('daily', 'weekly')),
    CONSTRAINT review_prompts_section_check CHECK (section IN ('reflect', 'plan')),
    -- Something besides whitespace, and at most 120 characters.
    CONSTRAINT review_prompts_label_check CHECK (label ~ '[^[:space:]]' AND length(label) <= 120),
    CONSTRAINT review_prompts_placeholder_check CHECK (length(placeholder) <= 200)
);

ALTER TABLE ONLY minerva.review_prompts
    ADD CONSTRAINT review_prompts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY minerva.review_prompts
    ADD CONSTRAINT review_prompts_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- Deferred, so a reorder can pass through a moment where two prompts share
-- a position and be checked only when it commits.
ALTER TABLE ONLY minerva.review_prompts
    ADD CONSTRAINT review_prompts_user_id_kind_section_position_key
    UNIQUE (user_id, kind, section, position) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY minerva.review_prompts
    ADD CONSTRAINT review_prompts_id_user_id_kind_key UNIQUE (id, user_id, kind);

CREATE TRIGGER set_minerva_review_prompts_updated_at BEFORE UPDATE ON minerva.review_prompts
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- What a review's author wrote for one of its prompts. An empty answer is
-- no row. user_id and kind repeat the review's so the two composite foreign
-- keys hold an answer to a prompt of its review's user and kind.
CREATE TABLE minerva.review_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    review_id uuid NOT NULL,
    prompt_id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_answers_body_check CHECK (body ~ '[^[:space:]]' AND length(body) <= 10000)
);

ALTER TABLE ONLY minerva.review_answers
    ADD CONSTRAINT review_answers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY minerva.review_answers
    ADD CONSTRAINT review_answers_review_id_prompt_id_key UNIQUE (review_id, prompt_id);

ALTER TABLE ONLY minerva.review_answers
    ADD CONSTRAINT review_answers_review_fkey FOREIGN KEY (review_id, user_id, kind)
    REFERENCES minerva.reviews(id, user_id, kind) ON UPDATE CASCADE ON DELETE CASCADE;

-- NO ACTION rather than RESTRICT: a prompt with answers cannot be deleted,
-- but deleting a user removes their answers and prompts in one statement.
ALTER TABLE ONLY minerva.review_answers
    ADD CONSTRAINT review_answers_prompt_fkey FOREIGN KEY (prompt_id, user_id, kind)
    REFERENCES minerva.review_prompts(id, user_id, kind) ON UPDATE CASCADE ON DELETE NO ACTION;

CREATE INDEX review_answers_prompt_id_idx ON minerva.review_answers USING btree (prompt_id);

CREATE TRIGGER set_minerva_review_answers_updated_at BEFORE UPDATE ON minerva.review_answers
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();
