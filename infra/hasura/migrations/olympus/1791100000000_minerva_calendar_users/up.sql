-- Minerva's calendar and notes tables become per user (ADR 0028, calendar
-- users plan phase 1), as tags, goals and reviews already are. The API
-- scopes every read and write by the caller; Hasura grants nothing beyond
-- admin.
--
-- Every existing row is Neil's, the only user before this change: the user
-- whose email is ncfritz@ncfritz.net. A database with rows and no such user
-- is refused, changing nothing; an empty one (a new laptop) needs no user.
-- Rows the new foreign keys would refuse are refused here too, by count,
-- rather than deleted: what to do with them is decided by a person.
--
-- One such decision is made here (Neil, 2026-10-03): attendees whose meeting
-- no longer exists are deleted. The old sync replaced meetings without
-- their attendees (6,260 rows in prod); nothing could reach them, and the
-- raw records are archived for a one-time import later. Only those rows go:
-- no meeting, note, note link or note association is touched.

DO $$
DECLARE
    removed integer;
BEGIN
    DELETE FROM minerva.meeting_attendees a
        WHERE NOT EXISTS (SELECT 1 FROM minerva.meetings m WHERE m.id = a.meeting_id);
    GET DIAGNOSTICS removed = ROW_COUNT;
    RAISE NOTICE 'minerva_calendar_users: deleted % attendees whose meeting no longer exists', removed;
END;
$$;

DO $$
DECLARE
    owner uuid;
    has_rows boolean;
    orphans text;
BEGIN
    SELECT string_agg(label || ': ' || n, ', ') INTO orphans FROM (
        SELECT 'meeting_attendees without their meeting' AS label, count(*) AS n
            FROM minerva.meeting_attendees a
            WHERE NOT EXISTS (SELECT 1 FROM minerva.meetings m WHERE m.id = a.meeting_id)
        UNION ALL
        SELECT 'meeting_notes without their meeting', count(*)
            FROM minerva.meeting_notes mn
            WHERE NOT EXISTS (SELECT 1 FROM minerva.meetings m WHERE m.id = mn.meeting_id)
        UNION ALL
        SELECT 'meeting_notes without their note', count(*)
            FROM minerva.meeting_notes mn
            WHERE NOT EXISTS (SELECT 1 FROM minerva.notes n WHERE n.id = mn.note_id)
        UNION ALL
        SELECT 'notes without their parent', count(*)
            FROM minerva.notes n
            WHERE n.parent_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM minerva.notes p WHERE p.id = n.parent_id)
    ) found WHERE n > 0;
    IF orphans IS NOT NULL THEN
        RAISE EXCEPTION 'minerva_calendar_users: rows the new foreign keys refuse: %', orphans;
    END IF;

    SELECT EXISTS (SELECT 1 FROM minerva.meetings)
        OR EXISTS (SELECT 1 FROM minerva.meeting_attendees)
        OR EXISTS (SELECT 1 FROM minerva.meeting_notes)
        OR EXISTS (SELECT 1 FROM minerva.meeting_user)
        OR EXISTS (SELECT 1 FROM minerva.notes)
        OR EXISTS (SELECT 1 FROM minerva.note_associations)
        INTO has_rows;
    SELECT id INTO owner FROM olympus.users WHERE lower(email) = 'ncfritz@ncfritz.net';
    IF has_rows AND owner IS NULL THEN
        RAISE EXCEPTION 'minerva_calendar_users: there are Minerva rows and no user ncfritz@ncfritz.net to give them to';
    END IF;

    -- Kept for the statements below; dropped at the end of the migration.
    CREATE TEMPORARY TABLE minerva_calendar_users_owner AS SELECT owner AS id;
END;
$$;

-- user_id on all six tables, filled, then required.

ALTER TABLE minerva.meetings ADD COLUMN user_id uuid;
ALTER TABLE minerva.meeting_attendees ADD COLUMN user_id uuid;
ALTER TABLE minerva.meeting_notes ADD COLUMN user_id uuid;
ALTER TABLE minerva.meeting_user ADD COLUMN user_id uuid;
ALTER TABLE minerva.notes ADD COLUMN user_id uuid;
ALTER TABLE minerva.note_associations ADD COLUMN user_id uuid;

UPDATE minerva.meetings SET user_id = (SELECT id FROM minerva_calendar_users_owner);
UPDATE minerva.meeting_attendees SET user_id = (SELECT id FROM minerva_calendar_users_owner);
UPDATE minerva.meeting_notes SET user_id = (SELECT id FROM minerva_calendar_users_owner);
UPDATE minerva.meeting_user SET user_id = (SELECT id FROM minerva_calendar_users_owner);
UPDATE minerva.notes SET user_id = (SELECT id FROM minerva_calendar_users_owner);
UPDATE minerva.note_associations SET user_id = (SELECT id FROM minerva_calendar_users_owner);

ALTER TABLE minerva.meetings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE minerva.meeting_attendees ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE minerva.meeting_notes ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE minerva.meeting_user ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE minerva.notes ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE minerva.note_associations ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE ONLY minerva.meetings
    ADD CONSTRAINT meetings_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.meeting_user
    ADD CONSTRAINT meeting_user_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.notes
    ADD CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- Meetings: the key the tables below point at, the list's index, and the
-- audit columns every table has (existing rows get the migration's time).

ALTER TABLE ONLY minerva.meetings
    ADD CONSTRAINT meetings_id_user_id_key UNIQUE (id, user_id);
CREATE INDEX meetings_user_id_start_time_idx
    ON minerva.meetings USING btree (user_id, start_time);
ALTER TABLE minerva.meetings
    ADD COLUMN created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN updated_at timestamp with time zone DEFAULT now() NOT NULL;
CREATE TRIGGER set_minerva_meetings_updated_at BEFORE UPDATE ON minerva.meetings
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- Notes: the same, and a child note is its parent's user's.

ALTER TABLE ONLY minerva.notes
    ADD CONSTRAINT notes_id_user_id_key UNIQUE (id, user_id);
CREATE INDEX notes_user_id_created_at_idx
    ON minerva.notes USING btree (user_id, created_at);
ALTER TABLE ONLY minerva.notes
    ADD CONSTRAINT notes_parent_id_user_id_fkey FOREIGN KEY (parent_id, user_id)
    REFERENCES minerva.notes(id, user_id) ON UPDATE CASCADE ON DELETE NO ACTION;

-- A note is linked only to its own user's meeting.

ALTER TABLE ONLY minerva.meeting_notes
    ADD CONSTRAINT meeting_notes_meeting_id_user_id_fkey FOREIGN KEY (meeting_id, user_id)
    REFERENCES minerva.meetings(id, user_id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.meeting_notes
    ADD CONSTRAINT meeting_notes_note_id_user_id_fkey FOREIGN KEY (note_id, user_id)
    REFERENCES minerva.notes(id, user_id) ON UPDATE CASCADE ON DELETE CASCADE;

-- An association is its note's user's: the composite key replaces the
-- single-column one.

ALTER TABLE ONLY minerva.note_associations
    DROP CONSTRAINT note_associations_note_id_fkey;
ALTER TABLE ONLY minerva.note_associations
    ADD CONSTRAINT note_associations_note_id_user_id_fkey FOREIGN KEY (note_id, user_id)
    REFERENCES minerva.notes(id, user_id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE minerva.note_associations
    ADD COLUMN updated_at timestamp with time zone DEFAULT now() NOT NULL;
CREATE TRIGGER set_minerva_note_associations_updated_at BEFORE UPDATE ON minerva.note_associations
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- An attendee is its meeting's.

ALTER TABLE ONLY minerva.meeting_attendees
    ADD CONSTRAINT meeting_attendees_meeting_id_user_id_fkey FOREIGN KEY (meeting_id, user_id)
    REFERENCES minerva.meetings(id, user_id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE minerva.meeting_attendees
    ADD COLUMN created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN updated_at timestamp with time zone DEFAULT now() NOT NULL;
CREATE TRIGGER set_minerva_meeting_attendees_updated_at BEFORE UPDATE ON minerva.meeting_attendees
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- The people a user meets are that user's: the same address is a separate
-- row for each user.

ALTER TABLE ONLY minerva.meeting_user DROP CONSTRAINT meeting_user_pkey;
ALTER TABLE ONLY minerva.meeting_user
    ADD CONSTRAINT meeting_user_pkey PRIMARY KEY (user_id, email);
ALTER TABLE minerva.meeting_user
    ADD COLUMN created_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN updated_at timestamp with time zone DEFAULT now() NOT NULL;
CREATE TRIGGER set_minerva_meeting_user_updated_at BEFORE UPDATE ON minerva.meeting_user
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- The statistics count one user's rows. The argument is `for_user`, not
-- `user_id`: in a SQL function a column of the same name would win.
-- Otherwise the bodies are unchanged.

DROP FUNCTION minerva.meeting_day_statistics(timestamp with time zone, timestamp with time zone, text);
CREATE FUNCTION minerva.meeting_day_statistics(for_user uuid, start_date timestamp with time zone, end_date timestamp with time zone, tz text DEFAULT 'Etc/UTC'::text) RETURNS SETOF minerva.meeting_day_statistics_type
    LANGUAGE sql STABLE
    AS $$
select
    to_char(
        minerva.meetings.start_time at time zone tz,
        'D' :: text
    ) AS day,
    status,
    sum(duration) as duration,
    count(*)
from minerva.meetings
where user_id = for_user
and all_day=false and cancelled=false
and
start_time >= start_date
  AND end_time <= end_date
group by day, status
$$;

DROP FUNCTION minerva.meeting_hour_statistics(timestamp with time zone, timestamp with time zone, text);
CREATE FUNCTION minerva.meeting_hour_statistics(for_user uuid, start_date timestamp with time zone, end_date timestamp with time zone, tz text DEFAULT 'Etc/UTC'::text) RETURNS SETOF minerva.meeting_hour_statistics_type
    LANGUAGE sql STABLE
    AS $$
select
    to_char(
        minerva.meetings.start_time at time zone tz,
        'HH24' :: text
    ) AS hour,
    status,
    sum(duration) as duration,
    count(*)
from minerva.meetings
where user_id = for_user
and all_day=false and cancelled=false
and
start_time >= start_date
  AND end_time <= end_date
group by hour, status
$$;

DROP FUNCTION minerva.meeting_status_statistics(timestamp with time zone, timestamp with time zone, text);
CREATE FUNCTION minerva.meeting_status_statistics(for_user uuid, start_date timestamp with time zone, end_date timestamp with time zone, tz text DEFAULT 'Etc/UTC'::text) RETURNS SETOF minerva.meeting_status_statistics_type
    LANGUAGE sql STABLE
    AS $$
select
    to_char(
        minerva.meetings.start_time at time zone tz,
        'YYYY-MM-DD' :: text
    ) AS start_date,
    status,
    sum(duration),
    count(*)
from minerva.meetings
where user_id = for_user
and all_day=false and cancelled=false
and
start_time >= start_date
  AND end_time <= end_date
group by start_date, status
$$;

DROP FUNCTION minerva.notes_hour_statistics(timestamp with time zone, timestamp with time zone, text, boolean);
CREATE FUNCTION minerva.notes_hour_statistics(for_user uuid, start_date timestamp with time zone, end_date timestamp with time zone, tz text DEFAULT 'Etc/UTC'::text, parent_only boolean DEFAULT true) RETURNS SETOF minerva.notes_hour_statistics_type
    LANGUAGE sql STABLE
    AS $$
SELECT
  to_char(
    minerva.notes.created_at at time zone tz,
    'YYYY-MM-DD' :: text
  ) AS created,
  to_char(
    minerva.notes.created_at at time zone tz,
    'HH' :: text
  ) AS hour,
  minerva.notes.type,
  count(*) AS count
FROM
  minerva.notes
  WHERE
notes.user_id = for_user
  AND notes.created_at >= start_date
  AND notes.created_at <= end_date
  AND CASE WHEN parent_only THEN notes.parent_id is NULL END
GROUP BY
  created,
  hour,
  notes.type $$;

DROP FUNCTION minerva.notes_type_statistics(timestamp with time zone, timestamp with time zone, text, boolean);
CREATE FUNCTION minerva.notes_type_statistics(for_user uuid, start_date timestamp with time zone, end_date timestamp with time zone, tz text DEFAULT 'Etc/UTC'::text, parent_only boolean DEFAULT true) RETURNS SETOF minerva.notes_type_statistics_type
    LANGUAGE sql STABLE
    AS $$
SELECT
  to_char(
    notes.created_at at time zone tz,
    'YYYY-MM-DD' :: text
  ) AS created,
  notes.type,
  count(*) AS count
FROM
  minerva.notes
WHERE
  notes.user_id = for_user
  AND notes.created_at >= start_date
  AND notes.created_at <= end_date
  AND CASE WHEN parent_only THEN notes.parent_id is NULL END
GROUP BY
  created,
  notes.type $$;

DROP TABLE minerva_calendar_users_owner;
