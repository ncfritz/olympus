-- Reverses 1791100000000_minerva_calendar_users. Refused once a second user
-- owns Minerva rows: without user_id their rows would merge into one
-- person's. The meetings it cleared out stay cleared out.

DO $$
DECLARE
    owners integer;
BEGIN
    SELECT count(DISTINCT user_id) INTO owners FROM (
        SELECT user_id FROM minerva.meetings
        UNION SELECT user_id FROM minerva.meeting_attendees
        UNION SELECT user_id FROM minerva.meeting_notes
        UNION SELECT user_id FROM minerva.meeting_user
        UNION SELECT user_id FROM minerva.notes
        UNION SELECT user_id FROM minerva.note_associations
    ) users;
    IF owners > 1 THEN
        RAISE EXCEPTION 'minerva_calendar_users down: % users own Minerva rows', owners;
    END IF;
END;
$$;

DROP FUNCTION minerva.meeting_day_statistics(uuid, timestamp with time zone, timestamp with time zone, text);
CREATE FUNCTION minerva.meeting_day_statistics(start_date timestamp with time zone, end_date timestamp with time zone, tz text DEFAULT 'Etc/UTC'::text) RETURNS SETOF minerva.meeting_day_statistics_type
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
where all_day=false and cancelled=false
and
start_time >= start_date
  AND end_time <= end_date
group by day, status
$$;

DROP FUNCTION minerva.meeting_hour_statistics(uuid, timestamp with time zone, timestamp with time zone, text);
CREATE FUNCTION minerva.meeting_hour_statistics(start_date timestamp with time zone, end_date timestamp with time zone, tz text DEFAULT 'Etc/UTC'::text) RETURNS SETOF minerva.meeting_hour_statistics_type
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
where all_day=false and cancelled=false
and
start_time >= start_date
  AND end_time <= end_date
group by hour, status
$$;

DROP FUNCTION minerva.meeting_status_statistics(uuid, timestamp with time zone, timestamp with time zone, text);
CREATE FUNCTION minerva.meeting_status_statistics(start_date timestamp with time zone, end_date timestamp with time zone, tz text DEFAULT 'Etc/UTC'::text) RETURNS SETOF minerva.meeting_status_statistics_type
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
where all_day=false and cancelled=false
and
start_time >= start_date
  AND end_time <= end_date
group by start_date, status
$$;

DROP FUNCTION minerva.notes_hour_statistics(uuid, timestamp with time zone, timestamp with time zone, text, boolean);
CREATE FUNCTION minerva.notes_hour_statistics(start_date timestamp with time zone, end_date timestamp with time zone, tz text DEFAULT 'Etc/UTC'::text, parent_only boolean DEFAULT true) RETURNS SETOF minerva.notes_hour_statistics_type
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
notes.created_at >= start_date
  AND notes.created_at <= end_date
  AND CASE WHEN parent_only THEN notes.parent_id is NULL END
GROUP BY
  created,
  hour,
  notes.type $$;

DROP FUNCTION minerva.notes_type_statistics(uuid, timestamp with time zone, timestamp with time zone, text, boolean);
CREATE FUNCTION minerva.notes_type_statistics(start_date timestamp with time zone, end_date timestamp with time zone, tz text DEFAULT 'Etc/UTC'::text, parent_only boolean DEFAULT true) RETURNS SETOF minerva.notes_type_statistics_type
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
  notes.created_at >= start_date
  AND notes.created_at <= end_date
  AND CASE WHEN parent_only THEN notes.parent_id is NULL END
GROUP BY
  created,
  notes.type $$;

DROP TRIGGER set_minerva_meeting_user_updated_at ON minerva.meeting_user;
ALTER TABLE minerva.meeting_user DROP COLUMN created_at, DROP COLUMN updated_at;
ALTER TABLE ONLY minerva.meeting_user DROP CONSTRAINT meeting_user_pkey;
ALTER TABLE ONLY minerva.meeting_user ADD CONSTRAINT meeting_user_pkey PRIMARY KEY (email);

DROP TRIGGER set_minerva_meeting_attendees_updated_at ON minerva.meeting_attendees;
ALTER TABLE minerva.meeting_attendees DROP COLUMN created_at, DROP COLUMN updated_at;
ALTER TABLE ONLY minerva.meeting_attendees DROP CONSTRAINT meeting_attendees_meeting_id_user_id_fkey;

DROP TRIGGER set_minerva_note_associations_updated_at ON minerva.note_associations;
ALTER TABLE minerva.note_associations DROP COLUMN updated_at;
ALTER TABLE ONLY minerva.note_associations DROP CONSTRAINT note_associations_note_id_user_id_fkey;

ALTER TABLE ONLY minerva.meeting_notes DROP CONSTRAINT meeting_notes_note_id_user_id_fkey;

ALTER TABLE ONLY minerva.notes DROP CONSTRAINT notes_parent_id_user_id_fkey;
DROP INDEX minerva.notes_user_id_created_at_idx;
ALTER TABLE ONLY minerva.notes DROP CONSTRAINT notes_id_user_id_key;

DROP TRIGGER set_minerva_meetings_updated_at ON minerva.meetings;
ALTER TABLE minerva.meetings DROP COLUMN created_at, DROP COLUMN updated_at;
DROP INDEX minerva.meetings_user_id_start_time_idx;
ALTER TABLE ONLY minerva.meetings DROP CONSTRAINT meetings_id_user_id_key;

ALTER TABLE minerva.meetings DROP COLUMN user_id;
ALTER TABLE minerva.meeting_attendees DROP COLUMN user_id;
ALTER TABLE minerva.meeting_notes DROP COLUMN user_id;
ALTER TABLE minerva.meeting_user DROP COLUMN user_id;
ALTER TABLE minerva.notes DROP COLUMN user_id;
ALTER TABLE minerva.note_associations DROP COLUMN user_id;

ALTER TABLE ONLY minerva.note_associations
    ADD CONSTRAINT note_associations_note_id_fkey FOREIGN KEY (note_id)
    REFERENCES minerva.notes(id) ON UPDATE RESTRICT ON DELETE CASCADE;
