-- Plan items: the priorities and to-dos a review plans for the next day
-- or week (ADR 0027, activity review plan phase 2). Each user's own: the
-- API scopes every read and write by the caller, and Hasura grants nothing
-- beyond admin. They stay review items until Tasks exists.
CREATE TABLE minerva.review_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    -- The review that planned the item, or carried it here.
    review_id uuid NOT NULL,
    -- The period the item is for: a day, or an ISO week from its Monday.
    scope text NOT NULL,
    period_start date NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    position integer NOT NULL,
    status text DEFAULT 'open' NOT NULL,
    done_at timestamp with time zone,
    -- The item this one was carried from, and how many carries led here.
    carried_from_id uuid,
    carry_count smallint DEFAULT 0 NOT NULL,
    -- A day and, optionally, a block of time the item is planned into: the
    -- item's own day, or a day of its week. Drawn by the reviews and
    -- Minerva Home; never written to the calendar.
    scheduled_on date,
    scheduled_start time without time zone,
    scheduled_end time without time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_items_scope_check CHECK (scope IN ('day', 'week')),
    CONSTRAINT review_items_period_start_check CHECK (
        scope = 'day' OR extract(isodow FROM period_start) = 1),
    CONSTRAINT review_items_kind_check CHECK (kind IN ('priority', 'todo')),
    -- Something besides whitespace, and at most 200 characters.
    CONSTRAINT review_items_title_check CHECK (title ~ '[^[:space:]]' AND length(title) <= 200),
    CONSTRAINT review_items_status_check CHECK (
        status IN ('open', 'done', 'carried', 'someday', 'dropped')),
    -- Done, and only done, records when.
    CONSTRAINT review_items_done_at_check CHECK ((status = 'done') = (done_at IS NOT NULL)),
    CONSTRAINT review_items_carry_count_check CHECK (carry_count >= 0),
    CONSTRAINT review_items_scheduled_on_check CHECK (
        scheduled_on IS NULL OR scheduled_on BETWEEN period_start
            AND period_start + CASE scope WHEN 'week' THEN 6 ELSE 0 END),
    -- A block has both ends, starts before it ends, and sits on a day.
    CONSTRAINT review_items_scheduled_times_check CHECK (
        (scheduled_start IS NULL) = (scheduled_end IS NULL)
        AND (scheduled_start IS NULL
             OR (scheduled_start < scheduled_end AND scheduled_on IS NOT NULL)))
);

ALTER TABLE ONLY minerva.review_items
    ADD CONSTRAINT review_items_pkey PRIMARY KEY (id);

-- For the items' foreign key, which holds an item to its review's user.
ALTER TABLE ONLY minerva.reviews
    ADD CONSTRAINT reviews_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE ONLY minerva.review_items
    ADD CONSTRAINT review_items_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- The planning review must be the item's user's.
ALTER TABLE ONLY minerva.review_items
    ADD CONSTRAINT review_items_review_fkey FOREIGN KEY (review_id, user_id)
    REFERENCES minerva.reviews(id, user_id) ON UPDATE CASCADE ON DELETE CASCADE;

-- A copy outlives what it was carried from.
ALTER TABLE ONLY minerva.review_items
    ADD CONSTRAINT review_items_carried_from_id_fkey FOREIGN KEY (carried_from_id)
    REFERENCES minerva.review_items(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- An item is carried once: its copy is the only one.
CREATE UNIQUE INDEX review_items_carried_from_id_key
    ON minerva.review_items USING btree (carried_from_id);

-- Deferred, so a reorder can pass through a moment where two items share a
-- position and be checked only when it commits.
ALTER TABLE ONLY minerva.review_items
    ADD CONSTRAINT review_items_user_id_scope_period_start_kind_position_key
    UNIQUE (user_id, scope, period_start, kind, position) DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX review_items_review_id_idx ON minerva.review_items USING btree (review_id);

CREATE TRIGGER set_minerva_review_items_updated_at BEFORE UPDATE ON minerva.review_items
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();
