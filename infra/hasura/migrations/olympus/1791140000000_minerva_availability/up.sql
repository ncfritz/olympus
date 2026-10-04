-- Availability per user (ADR 0029, calendar users plan phase 9). The API
-- works out a user's availability from their own meetings; these are the
-- overrides they set on top. Levels: none < free < interruptable < busy.
-- The API scopes every read and write; Hasura grants nothing beyond admin.

-- A block of time with a level, whatever meetings fall in it. It wins over
-- every meeting it overlaps, and counts outside the working day too.
CREATE TABLE minerva.availability_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    status text NOT NULL,
    label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT availability_blocks_status_check CHECK (
        status IN ('none', 'free', 'interruptable', 'busy')
    ),
    CONSTRAINT availability_blocks_time_check CHECK (end_time > start_time),
    CONSTRAINT availability_blocks_label_check CHECK (length(label) <= 200)
);

ALTER TABLE ONLY minerva.availability_blocks
    ADD CONSTRAINT availability_blocks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY minerva.availability_blocks
    ADD CONSTRAINT availability_blocks_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
-- What overlaps a range: start before its end, end after its start.
CREATE INDEX availability_blocks_user_id_start_time_idx
    ON minerva.availability_blocks USING btree (user_id, start_time);

CREATE TRIGGER set_minerva_availability_blocks_updated_at BEFORE UPDATE ON minerva.availability_blocks
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- The level a user set for one of their meetings, in place of the one its
-- free/busy status gives. Keyed by the meeting's ID with no key to
-- meetings, as meeting_notes is: it outlives a re-sync, the account's
-- removal and the archive's import.
CREATE TABLE minerva.meeting_availability (
    user_id uuid NOT NULL,
    meeting_id text NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT meeting_availability_status_check CHECK (
        status IN ('none', 'free', 'interruptable', 'busy')
    )
);

ALTER TABLE ONLY minerva.meeting_availability
    ADD CONSTRAINT meeting_availability_pkey PRIMARY KEY (user_id, meeting_id);
ALTER TABLE ONLY minerva.meeting_availability
    ADD CONSTRAINT meeting_availability_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TRIGGER set_minerva_meeting_availability_updated_at BEFORE UPDATE ON minerva.meeting_availability
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();
