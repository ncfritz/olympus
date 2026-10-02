-- Pins: what a weekly review keeps from its week, an answer from one of
-- the week's daily reviews or a note (ADR 0027, activity review plan
-- phase 3). Each user's own: the API scopes every read and write by the
-- caller, and Hasura grants nothing beyond admin.
CREATE TABLE minerva.review_pins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    review_id uuid NOT NULL,
    -- Always weekly: with review_id and user_id it keys the review, so only
    -- a weekly review of the pin's user can hold pins.
    kind text DEFAULT 'weekly' NOT NULL,
    answer_id uuid,
    note_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_pins_kind_check CHECK (kind = 'weekly'),
    CONSTRAINT review_pins_target_check CHECK ((answer_id IS NULL) <> (note_id IS NULL))
);

ALTER TABLE ONLY minerva.review_pins
    ADD CONSTRAINT review_pins_pkey PRIMARY KEY (id);

ALTER TABLE ONLY minerva.review_pins
    ADD CONSTRAINT review_pins_review_fkey FOREIGN KEY (review_id, user_id, kind)
    REFERENCES minerva.reviews(id, user_id, kind) ON UPDATE CASCADE ON DELETE CASCADE;

-- For the pins' foreign key, which holds a pinned answer to the pin's user.
ALTER TABLE ONLY minerva.review_answers
    ADD CONSTRAINT review_answers_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE ONLY minerva.review_pins
    ADD CONSTRAINT review_pins_answer_fkey FOREIGN KEY (answer_id, user_id)
    REFERENCES minerva.review_answers(id, user_id) ON UPDATE CASCADE ON DELETE CASCADE;

-- Notes belong to no user yet (ADR 0026), so a note pin keys the note
-- alone. Notes are soft-deleted, so a pin outlives a deleted note until it
-- is purged.
ALTER TABLE ONLY minerva.review_pins
    ADD CONSTRAINT review_pins_note_id_fkey FOREIGN KEY (note_id)
    REFERENCES minerva.notes(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE UNIQUE INDEX review_pins_review_id_answer_id_key
    ON minerva.review_pins USING btree (review_id, answer_id) WHERE answer_id IS NOT NULL;

CREATE UNIQUE INDEX review_pins_review_id_note_id_key
    ON minerva.review_pins USING btree (review_id, note_id) WHERE note_id IS NOT NULL;

CREATE INDEX review_pins_note_id_idx ON minerva.review_pins USING btree (note_id);

CREATE TRIGGER set_minerva_review_pins_updated_at BEFORE UPDATE ON minerva.review_pins
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();
